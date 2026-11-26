# InfoSource Assistant — End-to-End Testing Walkthrough

This guide is written for first-time testing. Follow in order.

## 1) Goal of this test pass
Validate that the InfoSource Assistant experience works end-to-end:
- Correct layout loads for `info-source-assistant`
- Agent Skills generation works (polling job flow)
- Citations render and open correctly
- Memory CRUD + extraction works
- Memory on/off toggle changes generation context
- Calibration suite runs and exports JSON
- Light mode and dark mode both render correctly

## 2) Prerequisites
- App runs locally with expected env variables set.
- You can access a team + assistant route.
- You have permission to create/open Smart Notes.

If starting locally from scratch:
1. Run environment bootstrap script.
2. Start dev server.
3. Open app in browser.

## 3) Navigate to the correct assistant
Use:
- Team: `kpit-ai-portal-members`
- Assistant: `info-source-assistant`

Create a new Smart Note under this assistant and open it.

Expected:
- InfoSource-specific layout is loaded (not the generic assistant layout).
- Top hero panel appears (InfoSource Assistant header).
- Right rail includes:
  - Agent Skills
  - What I Remember
  - Insight Rail (citations)
  - Deal Canvas

## 4) Visual sanity checks (Light + Dark mode)
Switch theme from header and verify both modes.

### Light mode expected
- Top hero panel uses light surface/background, readable dark text.
- Agent Skills, What I Remember, Insight Rail, Deal Canvas all appear light-themed.
- Buttons/labels are readable and not clipped.

### Dark mode expected
- Same components switch to dark styling.
- Contrast remains readable.

## 5) Agent Skills happy-path test
In Agent Skills panel:
1. Keep defaults or set:
   - Role: Seller
   - Market: National
   - Industry: Manufacturing
2. Click **Generate agent skills**.

Expected:
- Status transitions (queued/processing/complete).
- Role output appears when complete.
- No polling timeout/error.

## 6) Citations behavior test
From Agent Skills output:
1. Switch to **Buckets + citations** view.
2. Click one or more citation footnote buttons.

Expected:
- Citation modal opens.
- Modal shows source, region, owner, last updated.
- Source link opens document in new tab (if URL exists).

## 7) Copy/export behavior in Agent Skills
From Role output view:
1. Click **Copy markdown**.
2. Paste into a text editor.
3. Click **Copy plain text** and paste.

Expected in both copies:
- Run context header present:
  - Role
  - Memory mode (On/Off)
  - Generated at timestamp

## 8) Memory panel test (What I Remember)
In What I Remember panel:
1. Add a memory item manually (key + value + type), click **Save memory**.
2. Confirm it appears in saved list.
3. Toggle pin on that item.
4. Delete one item.

Expected:
- Success messages shown.
- List updates immediately.

## 9) Memory extraction test
1. Ensure there is at least one chat interaction.
2. Click **Extract from latest interaction**.
3. Approve at least one candidate.

Expected:
- Candidate list appears (or clear “none found” message).
- Approved candidate moves into saved memory list.

## 10) Memory on/off generation test
In Agent Skills panel:
1. Run once with **Use pinned memory for this run = On**.
2. Run same query again with toggle **Off**.

Expected:
- Role output header badge shows `Memory: On` vs `Memory: Off` per run.
- Returned content may differ when memory is included.

## 11) Calibration suite test page
Open:
- `/test/agent-skills`

Steps:
1. Confirm team and assistant defaults are correct.
2. Use default calibration queries or enter your own (one per line).
3. Click **Run Calibration Suite**.
4. Wait for all runs to complete.

Expected:
- Run cards appear with profile, coverage, avg score, status.
- Recommendation banner appears.

## 12) Calibration JSON export
On same test page:
1. Click **Export Calibration JSON** after runs complete.

Expected:
- JSON file downloads successfully.
- Contains context, queries, profiles, recommendation, and run results.

## 13) Regression checks (quick)
- Open a non-InfoSource assistant Smart Note and confirm generic layout still works.
- Confirm no compile/runtime errors in console during above tests.

## 14) Pass/fail checklist
Mark pass only when all are true:
- [ ] InfoSource layout loads for `info-source-assistant`
- [ ] Light mode and dark mode both look correct
- [ ] Agent Skills generates successfully
- [ ] Citation modal and links work
- [ ] Copy markdown/plain text include run context + timestamp
- [ ] Memory CRUD works
- [ ] Memory extraction + approve works
- [ ] Memory on/off toggle is honored in output
- [ ] Calibration suite runs to completion
- [ ] Calibration JSON export works

## 15) If something fails
Capture:
- URL + assistant/team/smartNote id
- Exact action taken
- Screenshot/video
- Browser console error
- Network response payload (if API related)
- Whether issue reproduces in both light and dark mode
