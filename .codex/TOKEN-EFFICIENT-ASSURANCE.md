# Token-Efficient Assurance Policy

This policy prevents redundant reviewer/tester execution while preserving MANUAL APPLY safety.

## Core rule

```text
Review the proposal once.
Verify the manual application cheaply.
Review integration at meaningful milestones.
```

## Phase 1 — Proposal assurance

Use scratch/proposal validation and only materially relevant specialists.

Possible gates:

```text
code review
security review
tester / focused tests
migration specialist
```

Do not run all gates automatically.

## Phase 2 — Applied handoff verification

After manual application:

```text
inspect real repo
→ compare against validated handoff
→ run smallest deterministic check
→ PASS / FAIL
```

Do not repeat the same reviewer/security/tester cycle if the repository matches the reviewed proposal.

Escalate only for:

- mismatch,
- verification failure,
- unreviewed extra edits,
- new risk,
- integration milestone,
- explicit user request.

## Phase 3 — Milestone assurance

Batch broad review/testing around integrated behavior.

Examples:

- schema + domain helper foundation;
- sync + User/PIC + SSO;
- snapshot + correction + workbook;
- frontend/backend integration;
- final release verification.

## Reviewer relevance

| Change | Code review | Security review | Tester |
|---|---|---|---|
| Copy/text/style | Usually no | No | Usually no |
| Local UI behavior | Optional | No | Optional |
| Business-rule helper | Usually yes | Usually no | Focused yes |
| Complex schema/migration | Yes | Only if relevant | Data-integrity checks |
| Auth/SSO/authorization | Yes | Yes | Yes |
| File import / external input | Yes | Often yes | Yes |

## Post-apply evidence reuse

If the proposal already recorded:

```text
PROPOSAL VALIDATION: PASS
RELEVANT REVIEWS: PASS
VALIDATED HANDOFF CONSISTENCY: PASS
```

and real-repository verification confirms material identity, those proposal review results remain valid evidence.

Moving validated code from scratch into the repository does not, by itself, create a reason to re-run expensive reviewers.


## Task-state guard

Do not spend reviewer/tester tokens validating implementation for a task that has not started.

Before dispatching assurance agents:

```text
Does a concrete proposal for this task exist?
```

If NO:

```text
task = NOT_STARTED or PROPOSAL_IN_PROGRESS
do not run proposal-failure review against missing future implementation
```

Use current baseline findings as planning evidence/carry-forward constraints.

This prevents both false failures and unnecessary reviewer token usage.
