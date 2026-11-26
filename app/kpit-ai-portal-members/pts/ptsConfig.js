// PTS Configuration
// This file contains configuration constants for the PTS application

export const PTS_CONFIG = {
  // API Configuration
  API: {
    BASE_URL: '/api/pts',
    TIMEOUT: 30000, // 30 seconds
    RETRY_ATTEMPTS: 3,
  },

  // File Upload Configuration
  UPLOAD: {
    MAX_FILE_SIZE: 100 * 1024 * 1024, // 100 MB
    ALLOWED_EXTENSIONS: ['csv', 'xlsx', 'xls', 'txt'],
    CHUNK_SIZE: 1024 * 1024, // 1 MB chunks
  },

  // Source Type Configuration
  SOURCE_TYPES: {
    LOADRUNNER: 'loadrunner',
    DYNATRACE: 'dynatrace',
    AZURE: 'azure',
  },

  // LoadRunner Files
  LOADRUNNER_FILES: [
    'FullDurationSummary.xlsx', // Mandatory file (Excel worksheet)
    'SteadyStateSummary.xlsx',  // Mandatory file (Excel worksheet)
    'HTTPResponsesperSecond.csv',
    'ErrorsPerSecond.csv',
    'TotalTransactionsperSecond.csv',
    'RunningVusers.csv',
    'AverageTransactionResponseTime.csv',
    'ConnectionsPerSecond.csv',
    'ControllerandLoadGeneratorsResources.csv',
  ],

  // Dynatrace Files
  DYNATRACE_FILES: [
    'HostName_to_ServerName_Mapping.txt',
    'Host_CPUUsed_In_Percentage.txt',
    'Host_MemoryTotal_In_Bytes.txt',
    'Host_MemoryUsed_In_Bytes.txt',
    'Services_Response_Times_In_Microseconds.txt',
    'Service_Errors.txt',
    'Service_ID_to_Service_Name_Mapping.txt',
    'RunInfo.txt',
    'combined_spans.csv',
    'trace_calls.csv',
    'trace_exceptions.csv',
    'trace_http_errors.csv',
    'trace_summary.csv',
    'ResourceUtilization.json',
    'service_problems.json',
  ],

  // SLA Configuration
  SLA: {
    REQUIRED_COLUMNS: [
      'Transaction Name',
      'Transaction per second',
      'Transaction Success Rate SLA',
      'Response time SLA (95th percentile)',
    ],
    ALLOWED_FORMATS: ['xlsx', 'xls', 'csv'],
  },

  // Session Status
  SESSION_STATUS: {
    ACTIVE: 'active',
    COMPLETED: 'completed',
    FAILED: 'failed',
    ARCHIVED: 'archived',
  },

  // Analysis Status
  ANALYSIS_STATUS: {
    PENDING: 'pending',
    IN_PROGRESS: 'in_progress',
    COMPLETED: 'completed',
    FAILED: 'failed',
  },

  // UI Configuration
  UI: {
    TABS: {
      SESSION_INFO: 0,
      SLA_CONFIG: 1,
      UPLOAD_RESULTS: 2,
      ANALYZE: 3,
      REPORT: 4,
      CHAT: 5,
    },
    ANIMATION_DURATION: 300, // milliseconds
    AUTO_SCROLL_DELAY: 100, // milliseconds
  },

  // Messages
  MESSAGES: {
    SESSION_REQUIRED: 'Please enter a session ID first',
    SLA_REQUIRED: 'Please upload the SLA Limits file before analyzing',
    SLA_CONFIRMATION_REQUIRED: 'Please confirm SLA values before analyzing',
    FILES_REQUIRED: 'Please upload at least one test result file',
    FILE_UPLOAD_SUCCESS: 'File uploaded successfully',
    ANALYSIS_COMPLETE: 'Analysis complete! Check the report tab.',
    LOADING: 'Processing...',
  },

  // Validation
  VALIDATION: {
    SESSION_ID_MIN_LENGTH: 3,
    SESSION_ID_MAX_LENGTH: 50,
    SESSION_ID_PATTERN: /^[a-zA-Z0-9_-]+$/,
  },
};

export const getPtsConfig = (key) => {
  const keys = key.split('.');
  let value = PTS_CONFIG;
  for (const k of keys) {
    value = value[k];
    if (value === undefined) return undefined;
  }
  return value;
};
