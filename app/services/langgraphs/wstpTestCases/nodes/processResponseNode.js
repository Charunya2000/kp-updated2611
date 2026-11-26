'use server';

export const processResponseNode = async (state) => {
  const { markdownResponse } = state;

  if (!markdownResponse) {
    return {
      testCases: [],
      error: state.error || 'No response received from AI'
    };
  }

  try {
    // Try to parse the response as JSON directly
    let testCases = [];

    // If direct parsing fails, try to extract JSON from a markdown code block
    try {
      const jsonMatch = markdownResponse.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch && jsonMatch[1]) {
        testCases = JSON.parse(jsonMatch[1].trim());
      } else {
        // If still not JSON, try to parse a structured response
        testCases = parseStructuredResponse(markdownResponse);
      }
    } catch (innerError) {
      console.error('Error parsing markdown response:', innerError);
      return {
        testCases: [],
        error: `Error parsing AI response: ${innerError.message}`
      };
    }

    // Validate and enhance test cases
    if (Array.isArray(testCases)) {
      testCases = testCases.map((testCase, index) => {
        // Ensure each test case has required fields
        return {
          // No ID generation here - will be added in saveTestCasesNode
          testCaseId: testCase.testCaseId || `TC-${100 + index}`,
          testCaseName: testCase.testCaseName || `Test Case ${index + 1}`,
          description: testCase.description || '',
          preCondition: testCase.preCondition || '',
          requirementIds: testCase.requirementIds || '',
          requirements: testCase.requirements || '',
          steps: Array.isArray(testCase.steps) ? testCase.steps.map((step, stepIndex) => ({
            stepNumber: step.stepNumber || stepIndex + 1,
            stepDescription: step.stepDescription || '',
            expectedResult: step.expectedResult || ''
          })) : [{ stepNumber: 1, stepDescription: '', expectedResult: '' }],
          testCaseType: testCase.testCaseType || '',
          testCaseStatus: testCase.testCaseStatus || 'Draft',
          testCasePriority: testCase.testCasePriority || 'Medium',
          testCaseDesignerName: state.nuid || testCase.testCaseDesignerName || '',
          testCaseAssignedTo: testCase.testCaseAssignedTo || '',
          module: testCase.module || '',
          method: testCase.method || '',
          market: testCase.market || '',
          application: testCase.application || '',
          workstream: testCase.workstream || '',
          feature: testCase.feature || '',
          category: testCase.category || '',
          persona: testCase.persona || '',
          union: testCase.union || '',
          isNewlyCreated: true // Mark as newly created
        };
      });
    } else {
      throw new Error('Response did not contain an array of test cases');
    }

    return { testCases };
  } catch (error) {
    console.error('Error processing AI response:', error);
    return {
      testCases: [],
      error: `Error processing AI response: ${error.message}`
    };
  }
};

// Helper function to parse a structured response that might not be in JSON format
function parseStructuredResponse(text) {
  const testCases = [];

  // Try to identify test case blocks in the text
  const testCaseBlocks = text.split(/(?=Test Case ID:|Test Case Name:|ID:)/i).filter(block => block.trim());

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

    // Extract steps - look for numbered steps or steps with headers
    const stepsMatch = block.match(/Steps?:|Step Description:/i);
    if (stepsMatch) {
      const stepsSection = block.slice(stepsMatch.index);
      const stepMatches = stepsSection.matchAll(/(?:Step #:|Step \d+:|Step Description:|Step:?)\s*(.*?)(?:Expected Result:|Expected Outcome:)\s*(.*?)(?=Step #:|Step \d+:|Step Description:|Step:?|$)/gis);

      let stepNumber = 1;
      for (const match of stepMatches) {
        if (match.length >= 3) {
          testCase.steps.push({
            id: Date.now() + stepNumber,
            data: '',
            stepNumber: stepNumber,
            stepDescription: match[1].trim(),
            expectedResult: match[2].trim()
          });
          stepNumber++;
        }
      }
    }

    // If no steps were found, create a default step
    if (testCase.steps.length === 0) {
      testCase.steps.push({
        id: Date.now(),
        data: '',
        stepNumber: 1,
        stepDescription: '',
        expectedResult: ''
      });
    }

    testCases.push(testCase);
  });

  return testCases;
}

// Helper function to extract values from structured text
function extractValue(text, pattern) {
  const match = text.match(new RegExp(`${pattern.source}\\s*(.+?)(?=\\n\\s*[A-Za-z][-A-Za-z]*:?|$)`, 'is'));
  return match ? match[1].trim() : '';
}
