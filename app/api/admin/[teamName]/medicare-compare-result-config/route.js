import { NextResponse } from 'next/server';
import { withTeamPermissionGuard } from '@/app/api/guards';
import { PERMISSIONS } from '@/app/config/permissions';
import {
  getMedicareCompareResultConfig,
  saveMedicareCompareResultConfig,
  getSqlColumnsForInvoiceType,
} from '@/app/services/medicareCompareResultConfigService';

export const GET = withTeamPermissionGuard(PERMISSIONS.MEDICARE_AUDIT_TEMPLATE_MANAGE)(getHandler);
export const PUT = withTeamPermissionGuard(PERMISSIONS.MEDICARE_AUDIT_TEMPLATE_MANAGE)(putHandler);

async function getHandler() {
  try {
    const config = await getMedicareCompareResultConfig();

    const medColumns = await getSqlColumnsForInvoiceType('med');

    return NextResponse.json({
      config: config || null,
      sqlColumns: { med: medColumns },
    }, { status: 200 });
  } catch (error) {
    console.error(JSON.stringify({
      kpmsg: {
        id: 'AI_PORTAL_NOTEBOOK',
        name: 'GET: MedicareCompareResultConfig',
        detail: { error: error.message },
      },
    }));
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

async function putHandler(req) {
  try {
    const config = await req.json();

    if (!config) {
      return NextResponse.json(
        { error: 'invalid config' },
        { status: 400 },
      );
    }

    const invoiceConfig = config['med'];
    if (!invoiceConfig.sqlFile || !invoiceConfig.worksheetName || !invoiceConfig.filenameLabel) {
      return NextResponse.json(
        { error: `Invoice type "med" is missing required fields (sqlFile, worksheetName, filenameLabel).` },
        { status: 400 },
      );
    }
    if (!Array.isArray(invoiceConfig.columnHeaders) || invoiceConfig.columnHeaders.length === 0) {
      return NextResponse.json(
        { error: `Invoice type "med" must have at least one column header.` },
        { status: 400 },
      );
    }

    const saved = await saveMedicareCompareResultConfig(config);
    if (!saved) {
      return NextResponse.json({ error: 'Failed to save config.' }, { status: 500 });
    }

    return NextResponse.json(saved, { status: 200 });
  } catch (error) {
    console.error(JSON.stringify({
      kpmsg: {
        id: 'AI_PORTAL_NOTEBOOK',
        name: 'PUT: MedicareCompareResultConfig',
        detail: { error: error.message },
      },
    }));
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
