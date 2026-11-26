'use server';

import { withTeamPermissionGuard } from "@/app/api/guards";
import { PERMISSIONS } from '@/app/config/permissions';
import { insertGeisingerConfigContextDocument, selectGeisingerConfigContextDocuments, updateGeisingerConfigContextDocumentById } from '@/app/services/geisingerConfigService';
import { NextResponse } from 'next/server';

export const POST = withTeamPermissionGuard(PERMISSIONS.REGULATORY_CONFIG_MANAGE)(postHandler);

// POST /api/admin/geisingerConfig/import
// Body: { items: [ { ...GeisingerConfigDoc }, ... ] }
// Processes one record at a time performing an UPSERT based on composite keys: title, collectionName, inferredLob, purpose.
// 1) For each incoming document ensure type='GeisingerConfig' and required fields exist.
// 2) Search for existing document(s) matching composite keys (title, collectionName, inferredLob, purpose)
// 3) If found: update that existing document by id (id from matched doc)
// 4) If not found: insert as new document (generate id if absent)
// No deletions are performed. Returns counts: inserted, updated, attempted.
async function postHandler(req) {
  try {
    const body = await req.json();
    let { items } = body || {};
    if (!Array.isArray(items)) {
      return NextResponse.json({ error: 'Body must include array property "items"' }, { status: 400 });
    }
    const errors = [];
    let inserted = 0;
    let updated = 0;

    for (let i = 0; i < items.length; i++) {
      const raw = items[i];
      if (!raw || typeof raw !== 'object') {
        errors.push({ index: i, error: 'Item not an object' });
        continue;
      }

      // Clone & normalize
      const obj = { ...raw };
      obj.type = 'GeisingerConfig';
      if (obj._id) delete obj._id; // ensure no accidental _id

      // Required fields for composite key & content
      const { title, collectionName, inferredLob, purpose } = obj;
      if (!title || !inferredLob || !purpose) {
        errors.push({ index: i, error: 'Missing required field (title, inferredLob, purpose)' });
        continue;
      }
      // collectionName is part of composite key; allow empty but normalize to '' for lookup consistency
      const normalizedCollectionName = collectionName || '';
      obj.collectionName = normalizedCollectionName;

      if (!obj.documentText) {
        errors.push({ index: i, error: 'Missing required field (documentText)' });
        continue;
      }

      // Build composite key search
      const searchParams = {
        type: 'GeisingerConfig',
        title: title,
        collectionName: normalizedCollectionName,
        inferredLob: inferredLob,
        purpose: purpose
      };

      try {
        const { data: matches } = await selectGeisingerConfigContextDocuments(searchParams);
        if (Array.isArray(matches) && matches.length > 0) {
          // Update first match (assumes uniqueness of composite key)
          const existing = matches[0];
          const existingId = existing.id;
          // Preserve existing id; ignore incoming id to avoid accidental reassignment
          try {
            await updateGeisingerConfigContextDocumentById(existingId, { ...existing, ...obj, id: existingId });
            updated++;
          } catch (updErr) {
            errors.push({ index: i, id: existingId, error: 'Failed to update document', detail: updErr.message });
          }
        } else {
          // Insert new
          if (!obj.id) {
            obj.id = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
          }
          try {
            await insertGeisingerConfigContextDocument(obj);
            inserted++;
          } catch (insErr) {
            errors.push({ index: i, id: obj.id, error: 'Failed to insert document', detail: insErr.message });
          }
        }
      } catch (searchErr) {
        errors.push({ index: i, error: 'Search failed prior to upsert', detail: searchErr.message });
        continue;
      }
    }

    const response = {
      success: true,
      mode: 'upsert',
      inserted,
      updated,
      deleted: 0,
      attempted: items.length,
      validationErrors: errors.length ? errors : undefined
    };
    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    console.error('Import error (GeisingerConfig):', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
