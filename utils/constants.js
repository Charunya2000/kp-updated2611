export const supportedFileExtensions = ["docx", "pptx", "xlsx", "xlsm", "odt", "odp", "ods", "pdf", "txt", "png", 'jpg', 'jpeg', 'webp', 'heic', 'tiff', "xml"];

export const acceptedFileTypes = {
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx', '.xlsm'],
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': ['.pptx'],
  'text/plain': ['.txt'],
  'application/pdf': ['.pdf'],
  'image/png': ['.png', '.jpg', '.jpeg', '.webp', '.heic', '.tiff'],
  'application/xml': ['.xml'],
  'text/xml': ['.xml']
};

export const smartNoteStatus = {
  Ready: 'Ready',
  Cloning: 'Cloning',
  Error: 'Error',
  Archived: 'Archived',
  Deleted: 'Deleted',
  Canceled: 'Canceled'
};

export const jobStatus = {
  PROCESSING: 'PROCESSING',
  INDEXING: 'INDEXING',
  COMPLETE: 'COMPLETE',
  ERROR: 'ERROR',
  CANCELED: 'CANCELED'
}

export const kpifCompareStatus = {
  START: 'START',
  IN_PROGRESS: 'IN_PROGRESS',
  CA_SOURCE_COMPLETE: 'KPIF_CMP_SOURCE_CA_XML INSERTION COMPLETED',
  ROC_SOURCE_COMPLETE: 'KPIF_CMP_SOURCE_ROC_XML INSERTION COMPLETED',
  ORMB_TARGET_COMPLETE: 'KPIF_CMP_TARGET_ORMB INSERTION COMPLETED',
  RESULTS_COMPLETE: 'KPIF_CMP_RESULTS INSERTION COMPLETED',
  COMPLETE: 'COMPLETE',
  ERROR: 'ERROR',
  CANCELED: 'CANCELED'
}

export const medicareCompareStatus = {
  START: 'START',
  IN_PROGRESS: 'IN_PROGRESS',
  SOURCE_COMPLETE: 'XML DATA INSERTION COMPLETED',
  DATAHUB_TARGET_COMPLETE: 'DATAHUB DATA INSERTION COMPLETED',
  RESULTS_COMPLETE: 'RESULTS INSERTION COMPLETED',
  COMPLETE: 'COMPLETE',
  ERROR: 'ERROR',
  CANCELED: 'CANCELED'
}

/**
 * Determines the MIME content type for a given file based on its extension.
 * @param {string} fileName - The name of the file (with extension).
 * @returns {string} - The MIME type for the file.
 */
export function getContentType(fileName) {
  const ext = fileName.split('.').pop().toLowerCase();
  const types = {
    // Documents
    'txt': 'text/plain',
    'pdf': 'application/pdf',
    'doc': 'application/msword',
    'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'odt': 'application/vnd.oasis.opendocument.text',

    // Spreadsheets
    'xls': 'application/vnd.ms-excel',
    'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'xlsm': 'application/vnd.ms-excel.sheet.macroEnabled.12',
    'ods': 'application/vnd.oasis.opendocument.spreadsheet',
    'csv': 'text/csv',

    // Presentations
    'ppt': 'application/vnd.ms-powerpoint',
    'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'odp': 'application/vnd.oasis.opendocument.presentation',

    // Images
    'png': 'image/png',
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'webp': 'image/webp',
    'heic': 'image/heic',
    'tiff': 'image/tiff',
    'tif': 'image/tiff',
    'gif': 'image/gif',

    // Data formats
    'json': 'application/json',
    'xml': 'application/xml',
  };

  return types[ext] || 'application/octet-stream';
}