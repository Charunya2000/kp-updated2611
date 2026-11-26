# Initial Intent Config V2

This file is the external snapshot of the runtime hardcoded config used by Compliance AI2 initial intent flow.

Supported lines of business:
- Medicare
- Medicaid
- CHIP
- Commercial
- Marketplace
- NCQA

Behavior:
- Primary audience is LOB compliance officers; default framing should be regulatory/compliance-focused.
- Prefer language around policy requirements, controls, audits, implementation obligations, and compliance risk.
- Avoid member/citizen-support framing unless user explicitly asks from that perspective.
- LOB intent should be inferred using concept-level distinctions and PA context, not only keyword matching.
- LOB reference anchors used for intent grounding:
  - CHIP: https://www.pa.gov/agencies/dhs/resources/chip
  - Marketplace (Pennie): https://pennie.com/
  - Medicare: https://www.pa.gov/agencies/aging/aging-programs-and-services/pa-medi-medicare-counseling
  - Medicaid: https://www.pa.gov/agencies/dhs/resources/medicaid
  - Commercial: https://www.geisinger.org/health-plan/employers/small-business
  - NCQA: https://healthinsuranceratings.ncqa.org/2019/search/Commercial/PA
- Interaction intent is two-stage after LOB inference:
  - `Comparison` only when explicit compare intent is present (compare/versus/vs/differences/side-by-side/contrast/between two options).
  - Otherwise default to `Conversation`.
- If user prompt is outside supported lines of business, return exactly:
  `I'm happy to answer questions related to the following lines of business: Medicare, Medicaid, CHIP, Commercial, Marketplace, NCQA.`
- Normalize `ACA` to `Marketplace`.
- Do not include SharePoint guidance or links.
- Document preparation is handled by admin workflows.

Runtime source:
- `app/services/langgraphs/compliance/initialIntentConfig.js`

Documents included in runtime config:
1. Background prompt (`purpose=Background`)
2. User intent schema prompt (`purpose=UserIntent`, title `Initial User Intent`)
3. Chat completion config (`purpose=ChatCompletionConfig`, title `Initial User Intent Chat Completion Config`)
4. Response format (`purpose=FormatConfig`, title `Initial User Intent Format Response`)
