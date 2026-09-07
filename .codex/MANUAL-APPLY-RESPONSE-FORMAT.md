# MANUAL APPLY Response Format

Use this format when the active collaboration mode is `MANUAL APPLY`.

The user manually applies every repository change. The response must therefore optimize for **precise, low-risk manual editing**, not for Git-style patch review.

Virtual `.md` documents are response sections only. Do not create them in the repository unless the user explicitly asks.

---

## Default editing representation

### Existing files

Default to **targeted surgical edit instructions**.

Do NOT emit a unified diff by default.

Each change must tell the user exactly:

```text
ACTION
WHERE
FIND ANCHOR
WHAT TO ADD / REPLACE / DELETE
```

Supported actions:

```text
ADD
REPLACE
DELETE
RENAME
MOVE
```

Use the smallest safe edit that is still unambiguous.

### New files

For a new file:

```text
ACTION: CREATE FILE
```

Emit the complete file content.

### Deleted files

For deleting a file:

```text
ACTION: DELETE FILE
```

State the exact repository path and why it is safe to remove.

### Unified diffs

Unified diff output is **opt-in only**.

Do not emit `diff`, `+`, or `-` patch notation unless the user explicitly asks for a diff.

### Full replacement of an existing file

Do not emit the entire existing file by default.

Use a full-file replacement only when:

- the user explicitly requests it, or
- the change is so structurally entangled that surgical instructions would be materially less safe.

If full-file replacement is necessary, explain why targeted edits are unsafe.

---

# Document layout

Always start with:

## 📄 `00-index.md`

Include:

- task/status,
- locked scope,
- proposal status,
- handoff status: `IN_PROGRESS` or `READY`,
- ordered list of virtual documents,
- exact manual application order,
- number of changes per file when useful,
- important dependencies,
- whether proposal validation ran,
- `VALIDATED HANDOFF CONSISTENCY`,
- `APPLIED REPOSITORY VERIFICATION`.

Then create one virtual Markdown document per logical implementation packet:

```text
## 📄 `01-<short-slug>.md`
## 📄 `02-<short-slug>.md`
...
```

Prefer one file or tightly coupled file group per document.

---

# Existing-file packet format

For an existing file:

## 📄 `NN-<slug>.md`

### Goal

What this packet changes.

### Target file

Exact repository path.

### Depends on

Earlier packet(s) or `none`.

### Changes

Use one numbered section per manual edit.

---

## Change 1 — `<short description>`

### Action

One of:

```text
ADD
REPLACE
DELETE
RENAME
MOVE
```

### Scope

Name the containing symbol when useful:

```text
model User
function createUser()
component ProgramForm
export const foo
```

This is mandatory when the same anchor text could occur in multiple places.

### Find anchor

Show the exact existing repository code the user should locate.

The anchor:

- must come from the inspected repository baseline,
- should be short but unique,
- must contain enough surrounding context to avoid ambiguity,
- should not rely on line number alone.

Example:

```ts
const user = await prisma.user.findUnique({
  where: { id },
});
```

Line numbers may be included only as supplemental hints because they can drift.

### Manual instruction

Use an explicit positional instruction.

Examples:

```text
ADD immediately after the anchor.
ADD immediately before the anchor.
REPLACE the exact block below.
DELETE the exact block below.
RENAME this symbol from X to Y.
MOVE this exact block into function X, immediately before Y.
```

### Apply code

For `ADD`, emit only the exact code being added.

For `REPLACE`, use:

#### Find and replace

**Find this exact block:**

```ts
<existing code>
```

**Replace with:**

```ts
<new code>
```

For `DELETE`, use:

**Find and delete this entire block:**

```ts
<existing code>
```

For `RENAME`, state every required occurrence when the rename is not safely repository-global.

Do not use:

```text
...
rest unchanged
same as above
update accordingly
```

Do not hide required imports, relation fields, call-site updates, or inverse-side changes.

### Why

Why this specific edit is required.

### Local checkpoint

What the user should visually confirm before proceeding to the next change.

---

# New-file packet format

For a new file:

### Action

```text
CREATE FILE
```

### Target file

Exact path.

### Final file content

Emit the complete file content in the appropriate code fence.

No placeholders or omitted sections.

---

# Delete-file packet format

For a removed file:

### Action

```text
DELETE FILE
```

### Target file

Exact path.

### Safety evidence

State why no required references remain.

---

# Anchor safety rules

Manual instructions are only useful if the anchor is reliable.

Before handoff:

- verify each existing-file anchor against the current repository baseline;
- prefer symbol scope + anchor instead of line numbers;
- if an anchor occurs more than once, enlarge it or add a containing symbol until the location is unambiguous;
- do not tell the user "put this somewhere in model X";
- do not use stale anchors from an earlier repository state;
- when one earlier manual edit changes the anchor needed by a later edit in the same file, order the changes so the later anchor is still findable, or explicitly anchor it against the post-change state.

If an instruction cannot be expressed safely with a stable anchor, use an exact block replacement or, as a last resort, a justified full-file replacement.

---

# Validation and handoff consistency

Scratch validation proves the resulting proposal, not merely individual snippets.

For `PROPOSAL_READY`, all of these must be true:

```text
PROPOSAL VALIDATION: PASS
TARGETED MANUAL EDIT SET: COMPLETE
VALIDATED HANDOFF CONSISTENCY: PASS
APPLIED REPOSITORY VERIFICATION: NOT RUN
```

`VALIDATED HANDOFF CONSISTENCY: PASS` means:

> Applying the emitted ordered ADD / REPLACE / DELETE / RENAME / MOVE instructions to the inspected repository baseline produces the same material code/schema/config state that passed the most recent proposal validation/review.

The agent may internally use diff tooling to derive or verify the edit set, but the user-facing response must remain surgical unless the user requested a diff.

If any emitted code or instruction changes after validation:

```text
previous validation = STALE
```

Re-run the affected proposal validation before claiming `PROPOSAL_READY`.

If the repository baseline changes before the user applies the instructions, the anchors may be stale. Re-inspect before claiming the old handoff is still safe.

---

# Proposal validation section

Each logical packet should include:

### Proposal validation

Report:

- exact command/check,
- exit code/result,
- important evidence,
- scratch evidence when useful.

For migration/schema work also include:

### Data / migration safety

- existing-data assumptions,
- nullable/backfill/order requirements,
- referential actions,
- disposable DB evidence if any,
- anything not yet proven.

---

# Review packet

Finish implementation packets with:

## 📄 `98-review-findings.md`

Include:

- code review result,
- security review result when relevant,
- manual-apply anchor/instruction review,
- unresolved proposal risks,
- whether another correction cycle is needed.

Reviewers should treat an ambiguous or incomplete manual edit instruction as a handoff defect even when the underlying scratch implementation is correct.

---

# Verification packet

Then:

## 📄 `99-verification.md`

### Proposal validation

Checks against proposal/scratch.

### Targeted manual edit set

State:

```text
COMPLETE
```

only when every required repository change is represented as an ordered manual instruction or complete new-file/delete-file operation.

### Validated handoff consistency

Must be:

```text
PASS
```

before `PROPOSAL_READY`.

### Applied repository verification

Must remain:

```text
NOT RUN
```

until the user manually applies the instructions and fresh checks run against the real repository.

---

# Formatting rules

- Do not wrap an entire virtual document in one Markdown code fence.
- Keep instructions next to the exact code they apply to.
- Use exact repository paths.
- Number changes in manual application order.
- Prefer stable symbol/anchor references over line numbers.
- Do not repeat large unchanged code blocks just for context.
- Do not emit a Git-style diff unless explicitly requested.
- Existing file: targeted surgical edits by default.
- New file: complete content.
- Deleted file: explicit delete instruction.
- A status-only response is never a valid `PROPOSAL_READY` handoff.
- Scratch files are temporary validation evidence.
- The ordered user-visible manual edit instructions are the MANUAL APPLY source of truth.


---

# Post-apply verification rule

After the user manually applies a `PROPOSAL_READY` handoff, do NOT automatically repeat the proposal's code review, security review, or tester pass.

The default post-apply response is a lightweight verification packet:

```text
## 📄 `99-applied-verification.md`

### Baseline/handoff checked
<task + handoff identity>

### Applied-state comparison
PASS | FAIL

### Deterministic checks
<smallest relevant commands/checks>

### Unexpected changes
NONE | describe

### Applied repository verification
PASS | FAIL

### Reviewer re-run required
NO | YES — reason
```

Reviewer re-run is `NO` when:

- the applied repository matches the validated handoff materially;
- deterministic checks pass;
- no new risk/evidence appears.

Reviewer re-run is `YES` only for mismatch, failed verification, new risk, milestone integration, or explicit user request.

A successful applied verification may immediately unlock the next dependent task.

Do not spend a full reviewer/security/tester cycle merely to confirm that already-reviewed code was copied correctly.



---

# Task-state reporting rule

Every task handoff/review must report the active task state accurately.

Allowed common states:

```text
NOT_STARTED
PROPOSAL_IN_PROGRESS
PROPOSAL_VALIDATION_FAILED
PROPOSAL_READY
APPLIED_VERIFICATION_FAILED
APPLIED_VERIFIED
BLOCKED
```

Before using `PROPOSAL_VALIDATION_FAILED`, confirm that a concrete proposal for the same task exists and actually failed a gate.

If a future task has not started, report:

```text
Task N: NOT_STARTED
```

and move any useful observations into:

```text
### Future-task constraints
```

Do not put future-task missing implementation under current proposal defects.

For reviews, include when relevant:

```text
### Finding classification
BASELINE GAP | PROPOSAL DEFECT | APPLIED-STATE DEFECT |
FUTURE-TASK CONSTRAINT | GENUINE BLOCKER
```

