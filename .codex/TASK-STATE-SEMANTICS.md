# Task State Semantics

This policy prevents future-task absence from being misclassified as an implementation or validation failure.

## Core rule

```text
Missing implementation for a task that has NOT STARTED
≠
PROPOSAL_VALIDATION_FAILED
```

A task can fail proposal validation only after a concrete proposal for THAT task exists.

---

## Canonical task states

### `NOT_STARTED`

Use when:

- the task has not begun;
- no concrete proposal for the task exists yet;
- the current repository still reflects the expected pre-task baseline.

Expected missing code is not a defect.

Example:

```text
Task 3 requires isPicEligible()
Task 3 has not started
helper is absent
→ Task 3 = NOT_STARTED
→ NOT a validation failure
```

---

### `PROPOSAL_IN_PROGRESS`

Use when:

- repository/context inspection has begun;
- proposal is being authored or corrected;
- proposal validation is not complete.

A proposal may still be incomplete.

---

### `PROPOSAL_VALIDATION_FAILED`

Use ONLY when all are true:

1. a concrete proposal for the current task exists;
2. that proposal was actually subjected to validation/review;
3. the proposal itself failed a technical, safety, contract, test, review, or migration gate.

Examples:

```text
Task 2 proposal exists
→ scratch typecheck fails
→ PROPOSAL_VALIDATION_FAILED
```

```text
Task 2 proposal exists
→ reviewer finds the proposal overwrites User.unitId incorrectly
→ PROPOSAL_VALIDATION_FAILED
```

Not valid:

```text
Task 2 has not been implemented
→ current baseline route still uses old behavior
→ PROPOSAL_VALIDATION_FAILED   ❌
```

That is a baseline gap expected to be solved by Task 2.

---

### `PROPOSAL_READY`

Use when:

```text
required proposal validation PASS
+ required relevant review(s) PASS
+ targeted manual edit set COMPLETE
+ VALIDATED HANDOFF CONSISTENCY PASS
```

No applied-repository success is implied.

---

### `APPLIED_VERIFICATION_FAILED`

Use when:

- the user manually applied a `PROPOSAL_READY` handoff;
- the real repository does not materially match the handoff, or
- the smallest relevant deterministic applied verification fails.

This is different from proposal failure.

Example:

```text
validated proposal had @unique
manual application omitted @unique
→ APPLIED_VERIFICATION_FAILED
```

Do not reclassify the original proposal as invalid unless new evidence proves the proposal itself was defective.

---

### `APPLIED_VERIFIED`

Use when:

- the applied repository materially matches the validated handoff;
- deterministic verification passes;
- no unexpected material changes are found.

After this state, the next dependent task may begin.

---

### `BLOCKED`

Reserve for genuine dependency/evidence constraints such as:

- missing business/product decision;
- inaccessible required repository evidence;
- unavailable external contract that the CURRENT task truly needs;
- required credential/infrastructure unavailable;
- tooling/capability genuinely necessary to proceed and no safe fallback exists.

Do NOT use `BLOCKED` for:

- future task not implemented yet;
- ordinary proposal defects;
- ordinary validation failure;
- reviewer findings against an active proposal;
- missing deferred Pentaho endpoint/auth details for internal Task 1/2/3 work.

---

## Review scope rule

A reviewer must know the active task.

Default review scope:

```text
current task proposal
+ already-applied prerequisite contracts
```

Do NOT evaluate the untouched repository as though all future tasks should already be implemented.

Future-task requirements may be surfaced only as:

```text
FUTURE TASK CONSTRAINT
CARRY-FORWARD REQUIREMENT
DEPENDENCY NOTE
```

They must not be counted as defects of the current task unless the current task explicitly owns them.

---

## Baseline gap vs proposal defect

Always classify a finding as one of:

```text
BASELINE GAP
PROPOSAL DEFECT
APPLIED-STATE DEFECT
FUTURE-TASK CONSTRAINT
GENUINE BLOCKER
```

### Baseline gap

Old/current behavior that is intentionally replaced by a future task.

Example:

```text
legacy import creates Users directly
Task 2/4 will replace/reconcile that behavior
Task 2 not yet proposed
→ BASELINE GAP
```

### Proposal defect

The active task proposal itself violates its locked requirements.

### Applied-state defect

Manual application differs from the validated handoff.

### Future-task constraint

A finding that must be carried into a later task but is not owned by the current task.

### Genuine blocker

A missing decision/evidence/tool that prevents the CURRENT task from being safely proposed.

---

## Cross-task review rule

Cross-task review is allowed only when one of these applies:

- a milestone integration review is due;
- the active task changes a shared contract that directly affects an already-applied prerequisite;
- the user explicitly asks for broad review.

Even then:

- distinguish future missing implementation from regressions;
- do not fail a task merely because later tasks are not present yet.

---

## Sequential MANUAL APPLY flow

```text
Task N
→ proposal
→ proposal validation/relevant review
→ PROPOSAL_READY
→ user manual apply
→ lightweight applied verification
→ APPLIED_VERIFIED
→ Task N+1 begins
```

Do not validate Task N+1 implementation before Task N+1 has a proposal.

---

## Reviewer wording

Bad:

```text
Task 3 failed because isPicEligible() is not in the repository.
```

Correct:

```text
Task 3: NOT_STARTED.
The helper is absent in the current baseline as expected.
Carry forward requirement: Task 3 must introduce centralized
isEmploymentActive() and isPicEligible() helpers before downstream consumers.
```

Bad:

```text
Task 2 blocked for acceptance because old import behavior is still present.
```

Correct:

```text
Task 2: NOT_STARTED / PROPOSAL_IN_PROGRESS.
The old import behavior is baseline evidence and defines requirements
the Task 2 proposal must replace or constrain.
```
