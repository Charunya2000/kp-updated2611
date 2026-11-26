# Material Deltas Adjudication Rubric (v1)

## Purpose
Use this rubric to consistently review rows from `*.material-deltas.adjudication.csv`.
The goal is to determine whether each row represents a compliance-relevant, actionable change.

## Required Fields to Populate
For every reviewed row, fill these columns:
- `reviewerDisposition`
- `reviewerMateriality`
- `reviewerNotes`
- `reviewerName`

## Disposition Values
Use one of the following exact values in `reviewerDisposition`:
- `material`
- `non-material`
- `false-positive`
- `needs-review`

Definitions:
- `material`: Meaningful compliance impact likely requiring policy/process/control attention.
- `non-material`: Real wording/structure variation, but no meaningful compliance impact.
- `false-positive`: Matching/scoring artifact; row should not have been flagged as a delta.
- `needs-review`: Insufficient context or uncertain interpretation; route to second reviewer.

## Materiality Levels
Use one value in `reviewerMateriality`:
- `high`
- `medium`
- `low`
- `none`

Guidance:
- `high`: obligation direction, rights/access, timelines, approval authority, or audit/reporting duties changed.
- `medium`: process details changed with plausible operational risk.
- `low`: language clarity/format changes with low likely impact.
- `none`: no substantive delta.

## Review Order
Review in this sequence:
1. `classification=conflict`
2. High-score `classification=partial`
3. High-score `gap-left` and `gap-right`

## Decision Heuristics
Mark as likely `material` when one or more apply:
- Modality shift changes obligation force (`must` vs `may`, `shall_not` vs `shall`).
- Timeline/deadline requirements change (day/hour windows, escalation timeframes).
- Required actor/owner changes (MCO, Department, provider, enrollee representative).
- Documentation, notification, or record-retention requirements change.
- Access/rights protections are added, removed, or constrained.

Mark as likely `non-material` when:
- The requirement meaning is preserved with stylistic or formatting differences.
- The row is a superset/subset chunk artifact already represented by another aligned row.

Mark as likely `false-positive` when:
- Pairing is clearly cross-topic due to greedy one-to-one matching residue.
- OCR noise or chunk boundaries created an artificial mismatch.

## Notes Convention
In `reviewerNotes`, include short reason tags when possible:
- `modality_shift`
- `timeline_shift`
- `actor_shift`
- `scope_change`
- `chunking_artifact`
- `ocr_artifact`
- `duplicate_of_rank_<n>`

Example note:
`timeline_shift; actor_shift; update notice deadline from 30 to 45 days`

## Two-Pass Workflow
1. Primary reviewer adjudicates rows.
2. Secondary reviewer checks all `high` and all `needs-review` rows.
3. Resolve disagreements and keep final disposition in place.

## Calibration Loop
After adjudication completes:
1. Run summary script:
   `npm run run-first-principles-adjudication-summary -- --input <adjudication.csv> --min-reviewed 20 --target-precision 0.8`
2. Review recommended threshold in generated summary JSON.
3. Update scoring thresholds/weights only after reviewer agreement.

## Exit Criteria for Pilot Candidate
Target before Section G rollout:
- At least 200 adjudicated rows.
- Top-100 precision >= 80% for `material` at chosen threshold.
- Citation acceptance (reviewer says evidence supports claim) >= 90% on sampled rows.
