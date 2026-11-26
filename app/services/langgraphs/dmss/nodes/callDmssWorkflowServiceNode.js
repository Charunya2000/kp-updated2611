export const callDmssWorkflowServiceNode = async (state) => {
  try {
    const blankIfNone = (value) => value === 'None' ? '' : value || '';
    const body = {
      smartnote_id: { smartnote_id: state.smartNoteId },
      letters: state.letters && state.letters.length > 0 ? state.letters.map(letter => letter.fileName) : [""],
      test_case_templates: state.testCaseTemplates && state.testCaseTemplates.length > 0 ? state.testCaseTemplates.map(template => template.fileName) : [""],
      uploaded_notes: state.uploadedNotes && state.uploadedNotes.length > 0 ? state.uploadedNotes.map(note => note.fileName) : [""],
      messages: state?.totalMessages && state.totalMessages.length > 0 ? state.totalMessages : [{ "role": "assistant", "content": "" }],
      affects_versions: state.formData.affectsVersions || "",
      created_by: state.formData.createdBy || "",
      epic_number: state.formData.epicNumber || "",
      planned_executed_date: state.formData.plannedExecutedDate || "",
      requirement_id: state.formData.requirementId || "",
      test_case_phase: blankIfNone(state.formData.testCasePhase) || blankIfNone(state.formData.testCasePhaseIfOther),
      test_case_components: state.formData.testCaseComponents || [],
      test_case_status: state.formData.testCaseStatus || "",
      test_cases_names: state.formData.testCaseComponents && state.formData.testCaseComponents.length > 0 ? state.formData.testCaseComponents.map(tc => tc.test_case_name) : [""],
      test_case_type: blankIfNone(state.formData.testCaseType) || blankIfNone(state.formData.testCaseTypeIfOther),
      is_workflow: state.isWorkflow,
      // saved_notes: state.savedNotesContent ? state.savedNotesContent : [""],
      // saved_responses: state.savedResponsesContent ? state.savedResponsesContent : [""],
    };

    // Make the POST request to the External Completions service using fetch
    const ORCHESTRATION_APP_URL = process.env['ORCHESTRATION_APP_URL'];
    const response = await fetch(`${ORCHESTRATION_APP_URL}/api/dmss/rag_workflow`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(body),
    });

    let table = "";
    let json = sample;
    json = await response.json();

    if (!response.ok) {
      state.sendEvent({ type: 'data', data: json.message || "I was unable to reach the workflow end point, or the request was invalid. Please try again. If this issue persists, contact HPAISVC@kp.org." });
      return;
    }

    if (json.response) {

      if (!json.response.test_case_content || json.response.test_case_content.length === 0) {
        state.sendEvent({ type: 'data', data: "The workflow completed successfully but the response format was unexpected. If this issue persists, contact HPAISVC@kp.org. Raw response below" });
        state.sendEvent({ type: 'data', data: json.response });
        return;
      }
      // Epic #, Requirement Ids, Component/s, Affects/Versions, Test Case Created By, Description, Step Description, Detailed Step Description, Expected Result, Test Case Type, Test Case Status, Test Case Priority, Test Phase, Planned Execution Date
      table = `| Epic # | Requirement Ids | Component/s | Affects/Versions | Test Case Created By | Test Case Name | Description | Step Description | Expected Result | Test Case Type | Test Case Status | Test Case Priority | Test Phase | Planned Execution Date |\n`;
      table += `|--------|-----------------|-------------|------------------|----------------------|----------------|-------------|------------------|-----------------|----------------|------------------|--------------------|------------|------------------------|\n`;
      json.response.test_case_content?.forEach((testCase, index) => {
        const firstStep = testCase.steps && testCase.steps.length > 0 ? testCase.steps[0] : { step_description: "", expected_result: "" };

        table += `| ${body.epic_number} | ${body.requirement_id} | ${testCase.component} | ${body.affects_versions} | ${body.created_by} | ${testCase.test_case_name} | ${firstStep.description} | ${firstStep.step_description} | ${firstStep.expected_result} | ${body.test_case_type} | ${body.test_case_status} | ${testCase.test_case_priority} | ${body.test_case_phase} | ${body.planned_executed_date} |\n`;

        testCase?.steps?.forEach((step, stepIndex) => {
          if (stepIndex === 0) {
            // Skip, already added above
          } else {
            table += `|  |  |  |  |  |  | ${step.description} | ${step.step_description} | ${step.expected_result} |  |  |  |  |  |\n`;
          }
        });
      });

      state.sendEvent({ type: 'data', data: table });

    } else {
      throw new Error("DMSS API Error: No response received from the service");
    }

    return;
  } catch (error) {
    console.error('Error:', error.response ? error.response.data : error.message);
    state.sendEvent({ type: 'data', data: "Something went wrong while I was processing your request. Please try again. If this issue persists, contact HPAISVC@kp.org." });
  }
};



const sample = {
  "response": {
    "test_case_content": [
      {
        "test_case_name": "Nara's test case output",
        "component": "Component A",
        "test_case_priority": "High",
        "steps": [
          {
            "description": "Ensure the PDF is successfully generated and viewable",
            "step_description": [
              "Step 1: Generate the PDF from the document.",
              "Step 2: Open the PDF to confirm it is viewable and free of errors."
            ],
            "expected_result": [
              "Step 1: PDF is generated successfully.",
              "Step 2: PDF is viewable and free of errors."
            ]
          },
          {
            "description": "Check all static text in PDF, HTML, and Excel outputs.",
            "step_description": [
              "Step 1: Open the generated PDF, HTML, and Excel outputs for Letter ID MACL5506.",
              "Step 2: Obtain the latest approved business template/source document for MACL5506, including all static text (e.g., ...",
              "Step 3: Compare each static paragraph in the PDF against the approved template, including sections such as...",
              "Step 4: Verify that static address block labels, table labels (e.g., 'Regarding: Health...",
              "Step 5: Repeat the comparison for the HTML output, ensuring all static text...",
              "Step 6: Repeat the comparison for the Excel output (if applicable)...",
              "Step 7: Confirm that no unintended template tags (e.g., '<bold/url>', '<italic/font 12pt/variable>'..."
            ],
            "expected_result": [
              "Step 1: PDF, HTML, and Excel outputs for MACL5506 are opened successfully.",
              "Step 2: Approved business template with all static text is available for reference.",
              "Step 3: All static paragraphs in the PDF match the approved template exactly in wording, capitalization, and punctuation.",
              "Step 4: Static labels, table headings, and enclosure titles in the PDF match the approved template with no discrepancies.",
              "Step 5: HTML output static text matches the approved template with no missing, extra, or altered sentences.",
              "Step 6: Excel output static labels and descriptions match the approved template with no differences.",
              "Step 7: No template tags or markup placeholders are visible as text in any output format."
            ]
          }
        ]
      }
    ]
  }
}