'use server';

import { chatCompletion } from "@/app/services/chatCompletionService2";
import {
  initializeTestCaseGenerationProgress,
  updateSectionProgress,
  failTestCaseGeneration
} from "@/app/services/testCaseService";
const fs = require('fs').promises;
const path = require('path');

const DEFAULT_DOCUMENT_SECTION_INTRO = `You are a technical documentation analyzer specializing in test case preparation.

Your task is to analyze and separate a document by its logical content sections.

The document will contain design information including:
- Business rules and requirements
- UI screenshots and mockups
- Feature definitions and specifications
- Technical constraints and dependencies

Your goal is to identify distinct sections that are suitable for writing test cases.`;

const REQUIRED_DOCUMENT_SECTION_FORMAT_INSTRUCTIONS = `Instructions:
1. Analyze the entire document and divide it into logical sections based on content boundaries
2. Each section should represent a cohesive unit of functionality or requirements that can be tested
3. Return an array of section objects with the following structure:
  - start_index: The character position where the section begins
  - end_index: The character position where the section ends
  - short_topic: A brief descriptive title for the section (2-5 words)
  - test_case_suggestions: A brief note on what types of test cases would be appropriate for this section

Important:
- Sections should not overlap
- Each section should contain enough context to write meaningful test cases
- After you identify these sections, each will be provided to you individually to generate 1 or more test cases

Return your response as a valid JSON array.`;

const DEFAULT_DOCUMENT_SECTION_SYSTEM_MESSAGE = `${DEFAULT_DOCUMENT_SECTION_INTRO}

${REQUIRED_DOCUMENT_SECTION_FORMAT_INSTRUCTIONS}`;

const DEFAULT_CATEGORY_ANALYSIS_DIRECTIONS = `You are a QTest test case generator specializing in creating well-structured test cases from documents.

When analyzing a document and its description, you should:
1. Identify all testable requirements or functionality
2. Create comprehensive test cases that cover both positive and negative scenarios
3. Follow best practices for test case creation including clear steps and expected results

For each test case, extract or create the following fields:
- testCaseId: A unique identifier (format: TC-XXX where XXX is a sequential number)
- testCaseName: A clear, concise name that describes the test's purpose
- description: A detailed description of what the test verifies
- preCondition: Any prerequisites or setup needed before test execution
- requirementIds: Any known requirement IDs
- requirements: Any known requirements
- steps: An array of test steps with:
  * Any data known to be needed for the test
  * stepNumber: Sequential number
  * stepDescription: Clear action to perform
  * expectedResult: Expected outcome of the step
- testCaseType: Type of test (e.g., Functional, Integration, Performance)
- testCaseStatus: Status (e.g., Draft, Ready, In Progress)
- testCasePriority: Priority level (e.g., High, Medium, Low)
- testCaseDesignerName: 'Schedule to Pay AI' always
- testCaseAssignedTo: always blank
- module: always blank
- method: always blank
- market: always blank
- application: If know then put application else blank
- workstream: If known then put workstream else blank
- feature: If know then put feature else blank
- category:  If known then put category else blank
- persona:  If known then put persona else blank
- union:  If known then put union else blank

Structure your output as a JSON array of test case objects with all the fields mentioned above.`;

function resolveDirections(state) {
  const sectioningIntro = typeof state?.llmDirections?.sectioningDirections === 'string'
    ? state.llmDirections.sectioningDirections.trim()
    : '';
  const effectiveSectioningIntro = sectioningIntro || DEFAULT_DOCUMENT_SECTION_INTRO;
  const sectioningDirections = `${effectiveSectioningIntro}

${REQUIRED_DOCUMENT_SECTION_FORMAT_INSTRUCTIONS}`;

  const baseCategoryAnalysisDirections = state?.systemMessage || DEFAULT_CATEGORY_ANALYSIS_DIRECTIONS;
  const additionalCategoryGuidance = typeof state?.llmDirections?.categoryAnalysisDirections === 'string'
    ? state.llmDirections.categoryAnalysisDirections.trim()
    : '';

  const categoryAnalysisDirections = additionalCategoryGuidance
    ? `${baseCategoryAnalysisDirections}

Additional High-Level Guidance (supplemental only):
${additionalCategoryGuidance}

Critical constraints:
- Keep the required JSON array output format exactly as specified above.
- Do not remove, rename, or alter required test case fields.
- Always return steps as an array of objects with stepNumber, stepDescription, and expectedResult.
- Treat the supplemental guidance as high-level (such as more/fewer test cases or emphasis areas), not as schema changes.`
    : baseCategoryAnalysisDirections;

  return { sectioningDirections, categoryAnalysisDirections };
}

/**
 * Helper: Make a single chat completion call
 */
const makeChatCompletionCall = async (systemMessage, userContent, maxTokens = 4000, teamName, assistantName) => {
  const messages = [
    {
      role: "system",
      content: systemMessage
    },
    {
      role: "user",
      content: userContent
    }
  ];

  const response = await chatCompletion({
    temperature: 0.7,
    max_tokens: maxTokens,
    messages: messages,
    teamName,
    assistantName
  });

  return response;
};

function findBalancedJsonArray(text) {
  if (typeof text !== 'string' || !text.trim()) {
    return null;
  }

  let inString = false;
  let escape = false;
  let depth = 0;
  let start = -1;

  for (let index = 0; index < text.length; index++) {
    const char = text[index];

    if (inString) {
      if (escape) {
        escape = false;
      } else if (char === '\\') {
        escape = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
      continue;
    }

    if (char === '[') {
      if (depth === 0) {
        start = index;
      }
      depth++;
      continue;
    }

    if (char === ']') {
      if (depth === 0) {
        continue;
      }
      depth--;
      if (depth === 0 && start >= 0) {
        return text.slice(start, index + 1);
      }
    }
  }

  return null;
}

function toTestCaseArray(candidate) {
  if (Array.isArray(candidate)) {
    return candidate;
  }
  if (candidate && typeof candidate === 'object') {
    if (Array.isArray(candidate.testCases)) {
      return candidate.testCases;
    }
    if (Array.isArray(candidate.data)) {
      return candidate.data;
    }
  }
  return null;
}

function parseJsonTestCaseArray(text) {
  if (typeof text !== 'string' || !text.trim()) {
    return null;
  }

  const parseCandidates = [];
  const fencedBlocks = [...text.matchAll(/```(?:json)?\s*([\s\S]*?)```/gi)];
  fencedBlocks.forEach(match => {
    if (match?.[1]) {
      parseCandidates.push(match[1].trim());
    }
  });

  const balancedArray = findBalancedJsonArray(text);
  if (balancedArray) {
    parseCandidates.push(balancedArray);
  }

  parseCandidates.push(text.trim());

  for (const candidate of parseCandidates) {
    try {
      const parsed = JSON.parse(candidate);
      const testCases = toTestCaseArray(parsed);
      if (Array.isArray(testCases)) {
        return testCases;
      }
    } catch (_error) {
      // try next parse candidate
    }
  }

  return null;
}

function findBalancedSegment(text, openChar, closeChar, startIndex) {
  if (typeof text !== 'string' || startIndex < 0 || startIndex >= text.length) {
    return null;
  }

  let inString = false;
  let escape = false;
  let depth = 0;

  for (let index = startIndex; index < text.length; index++) {
    const char = text[index];

    if (inString) {
      if (escape) {
        escape = false;
      } else if (char === '\\') {
        escape = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
      continue;
    }

    if (char === openChar) {
      depth++;
      continue;
    }

    if (char === closeChar) {
      depth--;
      if (depth === 0) {
        return text.slice(startIndex, index + 1);
      }
    }
  }

  return null;
}

function extractStringFieldFromJsonish(text, keys) {
  const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  for (const key of keys) {
    const keyPattern = `(?:"|')?${escapeRegex(key)}(?:"|')?`;
    const patterns = [
      new RegExp(`${keyPattern}\\s*:\\s*"((?:\\\\.|[^"\\\\])*)"`, 'i'),
      new RegExp(`${keyPattern}\\s*:\\s*'((?:\\\\.|[^'\\\\])*)'`, 'i'),
      new RegExp(`${keyPattern}\\s*:\\s*([^,}\\n\\r]+)`, 'i')
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match?.[1]) {
        return match[1].trim();
      }
    }
  }

  return '';
}

function extractStepsFromJsonish(text) {
  const stepsKeyMatch = text.match(/(?:"|')?steps(?:"|')?\s*:/i);
  if (!stepsKeyMatch) {
    return [{ stepNumber: 1, stepDescription: '', expectedResult: '' }];
  }

  const arrayStart = text.indexOf('[', stepsKeyMatch.index);
  if (arrayStart === -1) {
    return [{ stepNumber: 1, stepDescription: '', expectedResult: '' }];
  }

  const stepsArrayText = findBalancedSegment(text, '[', ']', arrayStart);
  if (!stepsArrayText) {
    return [{ stepNumber: 1, stepDescription: '', expectedResult: '' }];
  }

  const stepObjects = [];
  for (let index = 0; index < stepsArrayText.length; index++) {
    if (stepsArrayText[index] !== '{') {
      continue;
    }

    const stepObjectText = findBalancedSegment(stepsArrayText, '{', '}', index);
    if (!stepObjectText) {
      continue;
    }

    stepObjects.push({
      stepNumber: extractStringFieldFromJsonish(stepObjectText, ['stepNumber']),
      stepDescription: extractStringFieldFromJsonish(stepObjectText, ['stepDescription', 'description']),
      expectedResult: extractStringFieldFromJsonish(stepObjectText, ['expectedResult', 'expectedOutcome'])
    });

    index += stepObjectText.length - 1;
  }

  return stepObjects.length > 0 ? stepObjects : [{ stepNumber: 1, stepDescription: '', expectedResult: '' }];
}

function parseJsonishTestCaseArray(text) {
  if (typeof text !== 'string' || !text.trim()) {
    return [];
  }

  const normalizedText = text.replace(/[\u201C\u201D]/g, '"').replace(/[\u2018\u2019]/g, "'");
  const testCases = [];

  for (let index = 0; index < normalizedText.length; index++) {
    if (normalizedText[index] !== '{') {
      continue;
    }

    const objectText = findBalancedSegment(normalizedText, '{', '}', index);
    if (!objectText) {
      continue;
    }

    if (!/(?:"|')?testCase(Name|Id|Priority|Status)(?:"|')?\s*:/i.test(objectText)) {
      index += objectText.length - 1;
      continue;
    }

    testCases.push({
      testCaseId: extractStringFieldFromJsonish(objectText, ['testCaseId', 'id']),
      testCaseName: extractStringFieldFromJsonish(objectText, ['testCaseName', 'name']),
      description: extractStringFieldFromJsonish(objectText, ['description']),
      preCondition: extractStringFieldFromJsonish(objectText, ['preCondition', 'precondition']),
      requirementIds: extractStringFieldFromJsonish(objectText, ['requirementIds', 'requirementId']),
      requirements: extractStringFieldFromJsonish(objectText, ['requirements']),
      steps: extractStepsFromJsonish(objectText),
      testCaseType: extractStringFieldFromJsonish(objectText, ['testCaseType', 'type']),
      testCaseStatus: extractStringFieldFromJsonish(objectText, ['testCaseStatus', 'status']),
      testCasePriority: extractStringFieldFromJsonish(objectText, ['testCasePriority', 'priority']),
      testCaseDesignerName: extractStringFieldFromJsonish(objectText, ['testCaseDesignerName', 'designerName']),
      testCaseAssignedTo: extractStringFieldFromJsonish(objectText, ['testCaseAssignedTo', 'assignedTo']),
      module: extractStringFieldFromJsonish(objectText, ['module']),
      method: extractStringFieldFromJsonish(objectText, ['method']),
      market: extractStringFieldFromJsonish(objectText, ['market']),
      application: extractStringFieldFromJsonish(objectText, ['application']),
      workstream: extractStringFieldFromJsonish(objectText, ['workstream']),
      feature: extractStringFieldFromJsonish(objectText, ['feature']),
      category: extractStringFieldFromJsonish(objectText, ['category']),
      persona: extractStringFieldFromJsonish(objectText, ['persona']),
      union: extractStringFieldFromJsonish(objectText, ['union'])
    });

    index += objectText.length - 1;
  }

  return testCases;
}

function isPotentiallyCorruptedJsonBlob(value) {
  if (typeof value !== 'string') {
    return false;
  }
  const trimmed = value.trim();
  if (!trimmed || !/^[\[{]/.test(trimmed)) {
    return false;
  }
  return /"testCase(Name|Id|Priority|Status)"|"steps"|"stepDescription"/i.test(trimmed);
}

function toSafeString(value, { maxLength = 1000 } = {}) {
  if (value === null || value === undefined) {
    return '';
  }

  if (Array.isArray(value)) {
    const primitiveItems = value
      .filter(item => ['string', 'number', 'boolean'].includes(typeof item))
      .map(item => String(item).trim())
      .filter(Boolean);
    return primitiveItems.join(', ').slice(0, maxLength);
  }

  if (['string', 'number', 'boolean'].includes(typeof value)) {
    const normalized = String(value).trim();
    if (isPotentiallyCorruptedJsonBlob(normalized)) {
      return '';
    }
    return normalized.slice(0, maxLength);
  }

  return '';
}

function normalizeSteps(rawSteps) {
  if (!Array.isArray(rawSteps) || rawSteps.length === 0) {
    return [{ stepNumber: 1, stepDescription: '', expectedResult: '' }];
  }

  const normalizedSteps = rawSteps
    .map((step, stepIndex) => {
      if (step && typeof step === 'object') {
        return {
          stepNumber: Number.isFinite(Number(step.stepNumber)) ? Number(step.stepNumber) : stepIndex + 1,
          stepDescription: toSafeString(step.stepDescription, { maxLength: 2000 }),
          expectedResult: toSafeString(step.expectedResult, { maxLength: 2000 })
        };
      }

      const stepDescription = toSafeString(step, { maxLength: 2000 });
      return {
        stepNumber: stepIndex + 1,
        stepDescription,
        expectedResult: ''
      };
    })
    .filter(step => step.stepDescription || step.expectedResult);

  return normalizedSteps.length > 0
    ? normalizedSteps
    : [{ stepNumber: 1, stepDescription: '', expectedResult: '' }];
}

function normalizeTestCase(testCase, state, sectionIndex, index) {
  return {
    testCaseId: toSafeString(testCase?.testCaseId, { maxLength: 100 }) || `TC-S${sectionIndex}-${index + 1}`,
    testCaseName: toSafeString(testCase?.testCaseName, { maxLength: 500 }) || `Test Case ${index + 1}`,
    description: toSafeString(testCase?.description, { maxLength: 4000 }),
    preCondition: toSafeString(testCase?.preCondition, { maxLength: 2000 }),
    requirementIds: toSafeString(testCase?.requirementIds, { maxLength: 1000 }),
    requirements: toSafeString(testCase?.requirements, { maxLength: 3000 }),
    steps: normalizeSteps(testCase?.steps),
    testCaseType: toSafeString(testCase?.testCaseType, { maxLength: 200 }),
    testCaseStatus: toSafeString(testCase?.testCaseStatus, { maxLength: 100 }) || 'Draft',
    testCasePriority: toSafeString(testCase?.testCasePriority, { maxLength: 100 }) || 'Medium',
    testCaseDesignerName: toSafeString(state?.nuid, { maxLength: 200 }) || toSafeString(testCase?.testCaseDesignerName, { maxLength: 200 }),
    testCaseAssignedTo: toSafeString(testCase?.testCaseAssignedTo, { maxLength: 200 }),
    module: toSafeString(testCase?.module, { maxLength: 200 }),
    method: toSafeString(testCase?.method, { maxLength: 200 }),
    market: toSafeString(testCase?.market, { maxLength: 200 }),
    application: toSafeString(testCase?.application, { maxLength: 200 }),
    workstream: toSafeString(testCase?.workstream, { maxLength: 200 }),
    feature: toSafeString(testCase?.feature, { maxLength: 200 }),
    category: toSafeString(testCase?.category, { maxLength: 200 }),
    persona: toSafeString(testCase?.persona, { maxLength: 200 }),
    union: toSafeString(testCase?.union, { maxLength: 200 }),
    isNewlyCreated: true
  };
}

/**
 * Helper: Parse and normalize test cases from AI response
 */
const parseAndNormalizeTestCases = (markdownResponse, state, sectionIndex) => {
  const testCases = [];

  if (!markdownResponse) {
    return testCases;
  }

  try {
    let parsedData = parseJsonTestCaseArray(markdownResponse);

    if (!Array.isArray(parsedData)) {
      const parsedJsonish = parseJsonishTestCaseArray(markdownResponse);
      if (Array.isArray(parsedJsonish) && parsedJsonish.length > 0) {
        parsedData = parsedJsonish;
      }
    }

    if (!Array.isArray(parsedData)) {
      // Fall back to label-based text parsing only when JSON parsing truly fails.
      parsedData = parseStructuredResponse(markdownResponse);
    }

    // Normalize and validate test cases
    if (Array.isArray(parsedData)) {
      parsedData.forEach((testCase, index) => {
        if (!testCase || typeof testCase !== 'object') {
          return;
        }

        const normalizedCase = normalizeTestCase(testCase, state, sectionIndex, index);
        testCases.push(normalizedCase);
      });
    }
  } catch (error) {
    console.error('Error normalizing test cases:', error);
  }

  return testCases;
};

/**
 * Helper: Parse structured response text that might not be in JSON format
 */
function parseStructuredResponse(text) {
  if (typeof text !== 'string' || !text.trim()) {
    return [];
  }

  const testCases = [];
  const testCaseBlocks = text
    .split(/(?=^\s*(?:Test Case ID:|Test Case Name:|ID:))/gim)
    .filter(block => block.trim());

  testCaseBlocks.forEach((block, index) => {
    const testCase = {
      testCaseId: extractValue(block, /Test Case ID:?|ID:?/i) || `TC-${100 + index}`,
      testCaseName: extractValue(block, /Test Case Name:?|Name:?/i) || `Test Case ${index + 1}`,
      description: extractValue(block, /Description:?/i) || '',
      preCondition: extractValue(block, /Pre[- ]condition:?|Precondition:?/i) || '',
      requirementIds: extractValue(block, /Requirement IDs:?|Requirement ID:?/i) || '',
      requirements: extractValue(block, /Requirements:?/i) || '',
      steps: [],
      testCaseType: extractValue(block, /Test Case Type:?|Type:?/i) || '',
      testCaseStatus: extractValue(block, /Test Case Status:?|Status:?/i) || 'Draft',
      testCasePriority: extractValue(block, /Test Case Priority:?|Priority:?/i) || 'Medium',
      testCaseDesignerName: extractValue(block, /Test Case Designer Name:?|Designer Name:?/i) || '',
      testCaseAssignedTo: extractValue(block, /Test Case Assigned To:?|Assigned To:?/i) || '',
      module: extractValue(block, /Module:?/i) || '',
      method: extractValue(block, /Method:?/i) || '',
      market: extractValue(block, /Market:?/i) || '',
      application: extractValue(block, /Application:?/i) || '',
      workstream: extractValue(block, /Workstream:?/i) || '',
      feature: extractValue(block, /Feature:?/i) || '',
      category: extractValue(block, /Category:?/i) || '',
      persona: extractValue(block, /Persona:?/i) || '',
      union: extractValue(block, /Union:?/i) || '',
      isNewlyCreated: true
    };

    // Extract steps
    const stepsMatch = block.match(/Steps?:|Step Description:/i);
    if (stepsMatch) {
      const stepsSection = block.slice(stepsMatch.index);
      const stepMatches = stepsSection.matchAll(
        /(?:Step #:|Step \d+:|Step Description:|Step:?)\s*(.*?)(?:Expected Result:|Expected Outcome:)\s*(.*?)(?=Step #:|Step \d+:|Step Description:|Step:?|$)/gis
      );

      let stepNumber = 1;
      for (const match of stepMatches) {
        if (match.length >= 3) {
          testCase.steps.push({
            stepNumber: stepNumber,
            stepDescription: match[1].trim(),
            expectedResult: match[2].trim()
          });
          stepNumber++;
        }
      }
    }

    // Default step if none found
    if (testCase.steps.length === 0) {
      testCase.steps.push({
        stepNumber: 1,
        stepDescription: '',
        expectedResult: ''
      });
    }

    testCases.push(testCase);
  });

  return testCases;
}

/**
 * Helper: Extract values from structured text
 */
function extractValue(text, pattern) {
  if (typeof text !== 'string' || !text.trim()) {
    return '';
  }

  const lines = text.split(/\r?\n/);
  const fieldRegex = new RegExp(`^\\s*(?:${pattern.source})\\s*(.*)$`, 'i');

  const isNextFieldLine = (line) => {
    if (!line || !line.trim()) {
      return false;
    }
    return /^\s*[A-Za-z][A-Za-z0-9\s\-#]{0,40}:\s*/.test(line) || /^\s*["'][^"']+["']\s*:/.test(line);
  };

  for (let index = 0; index < lines.length; index++) {
    const currentLine = lines[index];
    const match = currentLine.match(fieldRegex);
    if (!match) {
      continue;
    }

    const valueLines = [match[1].trim()];
    for (let nextIndex = index + 1; nextIndex < lines.length; nextIndex++) {
      const nextLine = lines[nextIndex];
      if (isNextFieldLine(nextLine)) {
        break;
      }
      if (nextLine.trim()) {
        valueLines.push(nextLine.trim());
      }
    }

    return valueLines.join(' ').trim();
  }

  return '';
}

/**
 * Helper: Resequence test case IDs globally (not per-section)
 * Converts: TC-S1-1, TC-S1-2, TC-S2-1, ... → TC-001, TC-002, TC-003, ...
 */
function resequenceTestCaseIds(testCases) {
  return testCases.map((testCase, index) => ({
    ...testCase,
    testCaseId: `TC-${String(index + 1).padStart(3, '0')}`
  }));
}

function createFallbackSection(messages) {
  return [{
    start_index: 0,
    end_index: messages.length,
    short_topic: 'Full Context',
    test_case_suggestions: 'Generate comprehensive positive and negative test cases for all identifiable requirements.'
  }];
}

function parseSectionsFromResponse(sectionParsingResponse, messages) {
  if (!sectionParsingResponse || typeof sectionParsingResponse !== 'string') {
    return createFallbackSection(messages);
  }

  let parsed = null;

  const parseCandidates = [];
  const fencedJsonMatch = sectionParsingResponse.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fencedJsonMatch?.[1]) {
    parseCandidates.push(fencedJsonMatch[1].trim());
  }
  parseCandidates.push(sectionParsingResponse);

  const jsonArrayMatch = sectionParsingResponse.match(/\[[\s\S]*\]/);
  if (jsonArrayMatch?.[0]) {
    parseCandidates.push(jsonArrayMatch[0]);
  }

  for (const candidate of parseCandidates) {
    try {
      const maybeParsed = JSON.parse(candidate);
      if (Array.isArray(maybeParsed)) {
        parsed = maybeParsed;
        break;
      }
    } catch (_error) {
      // Try next candidate
    }
  }

  if (!Array.isArray(parsed) || parsed.length === 0) {
    return createFallbackSection(messages);
  }

  const normalizedSections = parsed
    .map(section => ({
      ...section,
      start_index: Number(section.start_index),
      end_index: Number(section.end_index),
      short_topic: section.short_topic || 'Untitled Section',
      test_case_suggestions: section.test_case_suggestions || 'Generate meaningful test cases for this section.'
    }))
    .filter(section => Number.isFinite(section.start_index) && Number.isFinite(section.end_index));

  if (normalizedSections.length === 0) {
    return createFallbackSection(messages);
  }

  return normalizedSections;
}

/**
 * Chat completion node for test case generation using Azure OpenAI SDK
 * This node now performs multi-call approach:
 * 1. First call: Parse document into logical sections using resolved sectioning directions
 * 2. Subsequent calls: For each section, generate test cases using resolved category-analysis directions
 *    (runtime llmDirections override -> state.systemMessage -> default fallback)
 * 
 * @param {Object} state - Current state of the graph
 * @returns {Object} - Updated state with test cases array or error
 */
export const chatCompletionNode = async (state) => {
  if (!state.messages) {
    return {
      testCases: [],
      error: state.error || 'No messages/content available for AI processing'
    };
  }

  try {
    const { sectioningDirections, categoryAnalysisDirections } = resolveDirections(state);

    // ========== PHASE 1: Parse Document into Sections ==========
    const sectionParsingResponse = await makeChatCompletionCall(
      sectioningDirections,
      state.messages,
      4000,
      state?.teamName,
      state?.assistantName
    );

    const sections = parseSectionsFromResponse(sectionParsingResponse, state.messages);

    // ========== PHASE 2: Generate Test Cases for Each Section ==========
    const allTestCases = [];
    const sectionSummary = []; // Track test case count per section

    // Initialize progress tracking
    let progressInitialized = false;
    let testCaseGenerationProgressId = state.testCaseGenerationProgressId || null;
    try {
      if (state.teamName && state.smartNoteId) {
        await initializeTestCaseGenerationProgress(
          state.teamName,
          state.smartNoteId,
          testCaseGenerationProgressId,
          sections
        );
        progressInitialized = true;
      }
    } catch (progressError) {
      console.warn('Failed to initialize progress tracking:', progressError.message);
      // Continue without progress tracking if initialization fails
    }
    for (let sectionIndex = 0; sectionIndex < sections.length; sectionIndex++) {
      const section = sections[sectionIndex];

      try {
        // Validate indices
        if (
          typeof section.start_index !== 'number' ||
          typeof section.end_index !== 'number' ||
          section.start_index < 0 ||
          section.end_index > state.messages.length ||
          section.start_index >= section.end_index
        ) {
          console.warn(`Invalid section indices for "${section.short_topic}", skipping...`);
          sectionSummary.push({
            shortTopic: section.short_topic,
            testCaseCount: 0
          });
          continue;
        }

        // Extract section content
        const sectionContent = state.messages.substring(section.start_index, section.end_index);

        // Construct user message for test case generation
        const sectionUserMessage = `Topic: ${section.short_topic}
Test Case Suggestions: ${section.test_case_suggestions}

Document Section:
${sectionContent}`;

        // Call AI to generate test cases for this section
        const testCaseResponse = await makeChatCompletionCall(
          categoryAnalysisDirections,
          sectionUserMessage,
          4000,
          state?.teamName,
          state?.assistantName
        );

        if (testCaseResponse) {
          // Parse and normalize test cases from this section
          const sectionTestCases = parseAndNormalizeTestCases(
            testCaseResponse,
            state,
            sectionIndex + 1
          );

          allTestCases.push(...sectionTestCases);

          // Track test case count for this section
          sectionSummary.push({
            shortTopic: section.short_topic,
            testCaseCount: sectionTestCases.length
          });

          // Update progress for this section
          if (progressInitialized && state.teamName && state.smartNoteId) {
            try {
              await updateSectionProgress(
                state.teamName,
                state.smartNoteId,
                testCaseGenerationProgressId,
                sectionIndex,
                {
                  status: 'completed',
                  testCaseCount: sectionTestCases.length
                }
              );
            } catch (updateError) {
              console.warn(`Failed to update progress for section ${sectionIndex}:`, updateError.message);
            }
          }
        } else {
          sectionSummary.push({
            shortTopic: section.short_topic,
            testCaseCount: 0
          });

          // Update progress for this section (no test cases generated)
          if (progressInitialized && state.teamName && state.smartNoteId) {
            try {
              await updateSectionProgress(
                state.teamName,
                state.smartNoteId,
                testCaseGenerationProgressId,
                sectionIndex,
                {
                  status: 'completed',
                  testCaseCount: 0
                }
              );
            } catch (updateError) {
              console.warn(`Failed to update progress for section ${sectionIndex}:`, updateError.message);
            }
          }
        }
      } catch (sectionError) {
        console.error(`Error processing section ${sectionIndex + 1}:`, sectionError);
        // Track failure in summary
        sectionSummary.push({
          shortTopic: section.short_topic,
          testCaseCount: 0
        });

        // Update progress for this section (error)
        if (progressInitialized && state.teamName && state.smartNoteId) {
          try {
            await updateSectionProgress(
              state.teamName,
              state.smartNoteId,
              testCaseGenerationProgressId,
              sectionIndex,
              {
                status: 'error',
                testCaseCount: 0,
                error: sectionError.message
              }
            );
          } catch (updateError) {
            console.warn(`Failed to update progress for section ${sectionIndex}:`, updateError.message);
          }
        }

        // Continue to next section on error
        continue;
      }
    }

    if (allTestCases.length === 0) {
      return {
        testCases: [],
        summary: {
          sections: sectionSummary,
          totalTestCasesCount: 0
        },
        error: 'No test cases were generated from any section'
      };
    }

    // Resequence test case IDs globally (not per-section)
    // Convert: TC-S1-1, TC-S1-2, TC-S2-1 → TC-001, TC-002, TC-003
    const resequencedTestCases = resequenceTestCaseIds(allTestCases);

    // Build summary object with section details and total count
    const summary = {
      sections: sectionSummary,
      totalTestCasesCount: resequencedTestCases.length
    };

    // Note: Progress completion is now handled by completeProgressNode after 
    // saveTemplateToBlobStorageNode returns the download link and message

    return {
      testCases: resequencedTestCases,
      summary: summary,
      progressId: testCaseGenerationProgressId
    };
  } catch (error) {
    console.error('Error in multi-call chat completion:', error);

    // Mark progress as failed
    if (state.teamName && state.smartNoteId) {
      try {
        await failTestCaseGeneration(
          state.teamName,
          state.smartNoteId,
          error.message
        );
      } catch (failError) {
        console.warn('Failed to mark failure in progress tracking:', failError.message);
      }
    }

    return {
      testCases: [],
      error: `Error generating test cases: ${error.message}`
    };
  }
};
