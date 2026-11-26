'use server';

export async function validateArgumentsSingle(document) {
  const requiredFields = ['type', 'nuid', 'id', 'parentId'];
  await validateArguments(document, requiredFields);
}

export async function validateArgumentsMulti(document) {
  const requiredFields = ['type', 'nuid', 'parentId'];
  await validateArguments(document, requiredFields);
}

export async function validateSingleUserDocument(document) {
  const requiredFields = ['type', 'nuid'];
  await validateArguments(document, requiredFields);
}

export async function validateBasicSingle(document) {
  const requiredFields = ['type', 'id'];
  await validateArguments(document, requiredFields);
}

export async function validateDefaultSingle(document) {
  const requiredFields = ['type', '_id'];
  await validateArguments(document, requiredFields);
}

export async function validateArgumentsSmartNoteMulti(document) {
  const requiredFields = ['nuid', 'smartNoteId'];
  await validateArguments(document, requiredFields);
}

export async function validateApp(document) {
  const requiredFields = ['app'];
  await validateArguments(document, requiredFields);
}

export async function validateSharePointSite(document) {
  const requiredFields = ['type', 'name', 'createdByNUID', 'updatedByNUID', 'assistantIds'];
  await validateArguments(document, requiredFields);
}

export async function validateTemplateDocument(document) {
  const requiredFields = ['type', 'name', 'content', 'description', 'inputs'];
  await validateArguments(document, requiredFields);
}

export async function validateTemplateCollection(document) {
  const requiredFields = ['type', 'name', 'displayName'];
  await validateArguments(document, requiredFields);
}

export async function validateTemplatePurpose(document) {
  const requiredFields = ['type', 'name', 'displayName'];
  await validateArguments(document, requiredFields);
}

export async function validateWorkflow(document) {
  const requiredFields = ['type', 'name', 'displayName', 'steps'];
  await validateArguments(document, requiredFields);
}

export async function validateDocumentDelete(document) {
  const requiredFields = ['type', 'id'];
  await validateArguments(document, requiredFields);
}

export async function validateDocumentDeleteDefault(document) {
  const requiredFields = ['type', '_id'];
  await validateArguments(document, requiredFields);
}

export async function validateArguments(document, requiredFields) {
  for (const field of requiredFields) {
    if (!document.hasOwnProperty(field)) {
      throw new Error(`Missing required field: ${field} in ${JSON.stringify(document)}`);
    }
  }
}

export async function validateBasicChildSingle(document) {
  const requiredFields = ['type', 'id', 'parentId'];
  await validateArguments(document, requiredFields);
}

export async function validateBasicMulti(document) {
  const requiredFields = ['type'];
  await validateArguments(document, requiredFields);
}

export async function validateBasicSingleByName(document) {
  const requiredFields = ['type', 'name'];
  await validateArguments(document, requiredFields);
}

export async function validateBasicSingleUserRole(document) {
  const requiredFields = ['type', 'roleId', 'userNUID'];
  await validateArguments(document, requiredFields);
}

export async function validateBasicSingleUserAssistant(document) {
  const requiredFields = ['type', 'assistantId', 'nuid'];
  await validateArguments(document, requiredFields);
}

export async function validateBasicSingleByUseCase(document) {
  const requiredFields = ['type', 'useCase'];
  await validateArguments(document, requiredFields);
}

export async function validateBasicChildMulti(document) {
  const requiredFields = ['type', 'parentId'];
  await validateArguments(document, requiredFields);
}

export async function validateAdminTabCreate(document) {
  const requiredFields = ['type', 'name', 'prompt', 'assistantName'];
  await validateArguments(document, requiredFields);
}

export async function validateCreatePromptLibrary(document) {
  const requiredFields = ['type', 'name', 'details', 'assistantName', 'category', 'associatedPersonas'];
  await validateArguments(document, requiredFields);
}

export async function validateGetPromptByName(document) {
  const requiredFields = ['type', 'assistantName', 'name'];
  await validateArguments(document, requiredFields);
}

export async function validateCreateSearchIndex(document) {
  const requiredFields = ['type', 'indexName', 'nearestNeighbors', 'selectFields', 'template', 'assistantId'];
  await validateArguments(document, requiredFields);
}

export async function validateCreateChatCompletions(document) {
  const requiredFields = ['type', 'name', 'temperature', 'max_completion_tokens', 'model', 'assistantName'];
  await validateArguments(document, requiredFields);
}

export async function validateGetAllPrompts(document) {
  const requiredFields = ['type', 'assistantName'];
  await validateArguments(document, requiredFields);
}

export async function validateGetPromptByNameForSearchIndex(document) {
  const requiredFields = ['type', 'name'];
  await validateArguments(document, requiredFields);
}

export async function validateGetAllSearchIndex(document) {
  const requiredFields = ['type', 'assistantName'];
  await validateArguments(document, requiredFields);
}

export async function validateSelectSystemPrompt(document) {
  const requiredFields = ['type', 'assistantName'];
  await validateArguments(document, requiredFields);
}

export async function validateSelectPersona(document) {
  const requiredFields = ['type', 'assistantName', 'enabled'];
  await validateArguments(document, requiredFields);
}

export async function validateSelectLibraryPrompt(document) {
  const requiredFields = ['type', 'assistantName', 'enabled', 'name', 'category', 'associatedPersonas'];
  await validateArguments(document, requiredFields);
}

export async function validateUpdatePrompt(document) {
  const requiredFields = ['type', 'id', 'assistantName'];
  await validateArguments(document, requiredFields);  
}

export async function validateSelectNews(document) {
  const requiredFields = ['type', 'assistantName'];
  await validateArguments(document, requiredFields);
}

export async function validateUpsertNews(document) {
  const requiredFields = ['type', 'assistantName', 'news'];
  await validateArguments(document, requiredFields);
}

export async function validateUpdateSearchIndex(document) {
  const requiredFields = ['type', 'id'];
  await validateArguments(document, requiredFields);
}


export async function validateInsight360Query(document) {
  const requiredFields = ['type'];
  await validateArguments(document, requiredFields);
}

export async function validateUpdateInsight360Query(document) {
  const requiredFields = ['type', 'id', 'query'];
  await validateArguments(document, requiredFields);
}

export async function validateQtest(document) {
  const requiredFields = ['id', 'projectId', 'name', 'description', 'type', 'items', 'nuid'];
  await validateArguments(document, requiredFields);
}

export async function validateDealCanvasDocument(document) {
  const requiredFields = ['type', 'id', 'parentId', 'teamName', 'assistantName', 'scope', 'lanes'];
  await validateArguments(document, requiredFields);
}

export async function validateDealCanvasQuery(document) {
  const requiredFields = ['type', 'id', 'parentId', 'teamName', 'assistantName'];
  await validateArguments(document, requiredFields);
}

export async function validateGetAllMcpServers(document) {
  const requiredFields = ['type', 'assistantName'];
  await validateArguments(document, requiredFields);
}

export async function validateCreateMcpServer(document) {
  const requiredFields = ['type', 'serverLabel', 'serverUrl', 'requireApproval', 'assistantName'];
  await validateArguments(document, requiredFields);
}

export async function validateUpdateMcpServer(document) {
  const requiredFields = ['type', 'id'];
  await validateArguments(document, requiredFields);
}
