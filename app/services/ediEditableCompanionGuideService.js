import { v4 as uuidv4 } from 'uuid';
import {
  downloadBlobText,
  getBlockBlobClient,
  listBlobsInContainer,
  uploadBlobToContainer,
} from './blobStorageService';

const EDITABLE_GUIDE_TYPE = 'EdiEditableCompanionGuide';
const EDITABLE_GUIDE_CONTAINER = 'edi-companion-guides';

function encodePathSegment(value) {
  return encodeURIComponent(String(value));
}

function getGuidePrefix(teamName, assistantName, smartNoteId) {
  return [teamName, assistantName, smartNoteId]
    .map(encodePathSegment)
    .join('/') + '/';
}

function getGuideBlobName(teamName, assistantName, smartNoteId, guideId) {
  return `${getGuidePrefix(teamName, assistantName, smartNoteId)}${encodePathSegment(guideId)}.json`;
}

export async function listSavedEditableCompanionGuides({ teamName, assistantName, smartNoteId }) {
  const prefix = getGuidePrefix(teamName, assistantName, smartNoteId);
  const blobNames = await listBlobsInContainer(EDITABLE_GUIDE_CONTAINER, prefix);
  const guides = await Promise.all(blobNames.map(async (blobName) => {
    const guide = JSON.parse(await downloadBlobText(EDITABLE_GUIDE_CONTAINER, blobName));
    const { editableGuide, ...summary } = guide;
    return summary;
  }));

  return guides.sort((left, right) => (
    new Date(right.savedAt).getTime() - new Date(left.savedAt).getTime()
  ));
}

export async function getSavedEditableCompanionGuide({ teamName, assistantName, smartNoteId, guideId }) {
  const blobName = getGuideBlobName(teamName, assistantName, smartNoteId, guideId);
  const blobClient = await getBlockBlobClient(EDITABLE_GUIDE_CONTAINER, blobName);

  if (!(await blobClient.exists())) {
    return null;
  }

  return JSON.parse((await blobClient.downloadToBuffer()).toString('utf-8'));
}

export async function persistEditableCompanionGuide({
  teamName,
  assistantName,
  smartNoteId,
  companion,
  editableGuide,
  efssPackageVersion,
  validationStatus = 'draft',
}) {
  if (!teamName || !assistantName || !smartNoteId || !editableGuide) {
    throw new Error('Editable companion guide persistence context is incomplete');
  }

  if (editableGuide.schemaVersion !== 1) {
    throw new Error('Editable companion guide schema version is not supported');
  }

  const normalizedValidationStatus = validationStatus === 'validated' ? 'validated' : 'draft';
  const document = {
    id: uuidv4(),
    type: EDITABLE_GUIDE_TYPE,
    parentId: smartNoteId,
    smartNoteId,
    teamName,
    assistantName,
    revision: uuidv4(),
    schemaVersion: editableGuide.schemaVersion,
    efssPackageVersion: efssPackageVersion || null,
    sourceArtifact: {
      kind: 'csv',
      container: companion?.container || null,
      blobName: companion?.blobName || null,
      fileName: companion?.fileName || editableGuide?.source?.name || null,
    },
    editableGuide: structuredClone(editableGuide),
    validationStatus: normalizedValidationStatus,
    savedAt: new Date(),
    ...(normalizedValidationStatus === 'validated' ? { validatedAt: new Date() } : {}),
  };

  try {
    const blobName = getGuideBlobName(teamName, assistantName, smartNoteId, document.id);
    const fileBuffer = Buffer.from(JSON.stringify(document), 'utf-8');
    const uploaded = await uploadBlobToContainer(
      EDITABLE_GUIDE_CONTAINER,
      blobName,
      fileBuffer,
      'application/json; charset=utf-8',
    );

    if (!uploaded) {
      throw new Error('Azure Blob Storage did not accept the editable companion guide');
    }

    console.log(JSON.stringify({
      kpmsg: {
        id: 'AI_PORTAL_NOTEBOOK',
        name: 'persistEditableCompanionGuide',
        detail: {
          id: document.id,
          revision: document.revision,
          schemaVersion: document.schemaVersion,
          efssPackageVersion: document.efssPackageVersion,
          validationStatus: document.validationStatus,
          container: EDITABLE_GUIDE_CONTAINER,
          blobName,
        },
      },
    }));
    return document;
  } catch (error) {
    console.error(JSON.stringify({
      kpmsg: {
        id: 'AI_PORTAL_NOTEBOOK',
        name: 'persistEditableCompanionGuide',
        detail: {
          id: document.id,
          revision: document.revision,
          error: error?.message || 'Failed to persist editable companion guide',
        },
      },
    }));
    throw error;
  }
}

export async function persistValidatedEditableCompanionGuide(args) {
  return persistEditableCompanionGuide({ ...args, validationStatus: 'validated' });
}

export { EDITABLE_GUIDE_CONTAINER, EDITABLE_GUIDE_TYPE };