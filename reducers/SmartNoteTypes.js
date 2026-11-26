import PropTypes from 'prop-types';

export const SAVED_NOTE = 'SavedNote';
export const UPLOADED_DOCUMENT = 'UploadedDocument';
export const SHAREPOINT_FILE = 'SharePointFile';
export const WEBSITE_URL = 'WebsiteURL';
export const SAVED_RESPONSE = 'SavedResponse';
export const DESIGN_REFERENCE = 'DesignReference';
export const DESIGN_INDEX = 'DesignIndex';
export const JIRA_ISSUE = 'JiraIssue';

export const NotePropType = PropTypes.shape({
  id: PropTypes.string.isRequired,
  title: PropTypes.string.isRequired,
  content: PropTypes.string.isRequired
}).isRequired;

export const UploadedDocPropType = PropTypes.shape({
  id: PropTypes.string.isRequired,
  docName: PropTypes.string.isRequired,
  dateUploaded: PropTypes.instanceOf(Date).isRequired
}).isRequired;

export const SavedResponsePropType = PropTypes.shape({
  id: PropTypes.string.isRequired,
  responseMarkdown: PropTypes.string.isRequired,
  responseSaveDate: PropTypes.instanceOf(Date).isRequired
}).isRequired;

export const SuggestedPromptPropType = PropTypes.shape({
  id: PropTypes.string.isRequired,
  prompt: PropTypes.string.isRequired
}).isRequired;

export const ReferenceType = PropTypes.shape({
  id: PropTypes.string.isRequired,
  referenceName: PropTypes.string.isRequired,
  referenceType: PropTypes.string.isRequired,
  referenceLink: PropTypes.string.isRequired
}).isRequired;

export const JiraContextIssueType = PropTypes.shape({
  id: PropTypes.string.isRequired,
  issueType: PropTypes.string.isRequired,
  jiraKey: PropTypes.string.isRequired,
  description: PropTypes.string.isRequired,
  summary: PropTypes.string.isRequired
})

export const SourceType = PropTypes.shape({
  sourceId: PropTypes.string.isRequired,
  selected: PropTypes.bool.isRequired,
  sourceType: PropTypes.oneOf([
    SAVED_NOTE,
    UPLOADED_DOCUMENT,
    SAVED_RESPONSE,
    DESIGN_REFERENCE,
    JIRA_ISSUE
  ]).isRequired
}).isRequired;

export const ChatInteractionType = PropTypes.shape({
  id: PropTypes.string.isRequired,
  prompt: PropTypes.string.isRequired,
  response: PropTypes.string.isRequired,
}).isRequired;

export const SmartNotePropType = PropTypes.shape({
  id: PropTypes.string.isRequired,
  team: PropTypes.string.isRequired,
  createdNUID: PropTypes.string.isRequired,
  title: PropTypes.string.isRequired,
  savedNotes: PropTypes.arrayOf(NotePropType).isRequired,
  uploadedDocuments: PropTypes.arrayOf(UploadedDocPropType).isRequired,
  savedResponses: PropTypes.arrayOf(SavedResponsePropType).isRequired,
  designReferences: PropTypes.arrayOf(ReferenceType).isRequired,
  jiraIssues: PropTypes.arrayOf(JiraContextIssueType).isRequired,
  prelude: PropTypes.string.isRequired,
  suggestedPrompts: PropTypes.arrayOf(SuggestedPromptPropType).isRequired,
  libraryPrompts: PropTypes.arrayOf(PropTypes.string).isRequired,
  sources: PropTypes.arrayOf(
    SourceType
  ).isRequired,
  chatInteractions: PropTypes.arrayOf(ChatInteractionType).isRequired
}).isRequired;