---
name: verification-before-completion
description: Mandatory before any claim that work is complete, fixed, passing, ready, or safe to hand off; requires fresh evidence from relevant verification commands.
---

# Verification Before Completion

Project-local adaptation of obra/superpowers `verification-before-completion`.

## Iron rule

NO COMPLETION CLAIMS WITHOUT FRESH VERIFICATION EVIDENCE.

Do not trust confidence, code review approval, or another agent's success report as proof.

## Gate

Before saying work is complete/fixed/passing/ready:

1. IDENTIFY what evidence proves each claim.
2. RUN the full relevant verification commands fresh.
3. READ the complete result and exit status; count failures/errors.
4. COMPARE the result against the requested scope and requirements.
5. If evidence fails, state the actual status and route the failure through project_manager/debugger as appropriate.
6. Only if evidence passes, make the completion claim and cite the commands/results in the handoff summary.

## Website-Fraud baseline

Discover available scripts first. Unless the task clearly warrants a narrower gate, final code changes should normally verify:

```bash
npm run lint
npx tsc --noEmit
npm run build
```

Also run relevant focused tests or regression checks when a test suite exists or the task adds tests.

For bug fixes, reproduce or test the original symptom, not merely compilation.
For API/auth/database changes, verify the relevant authorization/business behavior in addition to generic build checks where tooling permits.
For UI behavior, verify the changed state/flow where runtime/browser tooling is available.

## Not sufficient

- "The code looks right."
- "Reviewer approved."
- "Tester probably covers it."
- A previous command from before the last edit.
- Lint passing as proof that build succeeds.
- Build passing as proof that the original bug is fixed.
- An implementation agent reporting DONE.

If verification cannot be run because of environment/tooling limitations, explicitly state what was not verified and do not imply full completion.
