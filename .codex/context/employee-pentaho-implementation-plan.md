# Employee / User / Pentaho / Participation — IMPLEMENTATION PLAN

Status:

```text
PLAN STATUS: READY
DESIGN DEPENDENCY: LOCKED
```

Read with:

```text
.codex/context/employee-pentaho-design-lock.md
```

External Pentaho transport details are intentionally deferred behind an adapter seam.

## MANUAL APPLY behavior

- Never mutate the real repository.
- Use isolated scratch validation where modified files are needed.
- Emit exact final validated targeted manual edit instructions for existing files and complete content for new files.
- Separate PROPOSAL VALIDATION from APPLIED REPOSITORY VERIFICATION.
- `PROPOSAL_READY` requires validation PASS plus a complete validated manual edit set emitted to the user.

# Task 1 — Prisma data model and safe migration proposal

Purpose: establish the internal model without depending on real Pentaho transport.

Includes:

### Employee
Support at minimum:

```text
id
nip unique
name
jenjang
kodeStatpeg
statKepeg
unit relation
isPresentInSource
last-seen Employee sync provenance where useful
timestamps
```

Do not add a generic employment `isActive` that replaces HR status semantics.

### User ↔ Employee

```text
Employee 1 -> 0..1 User
```

Requirements:
- nullable User.employeeId;
- unique one-to-one link;
- bootstrap/local Admin may remain unlinked;
- preserve User.unitId as application/PIC assignment;
- Pentaho never owns User role/account state.

### EmployeeSyncRun

Use one Employee sync-run model for Pentaho provenance and participation headcount provenance.

Do not add `ParticipationSyncRun` or `ParticipationImport` merely for the same lifecycle.

Support RUNNING/SUCCEEDED/FAILED, source metadata, timestamps, counters/error evidence as useful.

### Unit external mapping seam

Provide:

```text
sourceSystem + externalUnitCode -> Unit
```

An explicit `UnitExternalMapping` model is appropriate when it fits the repository.

Exact Pentaho source field names remain deferred.

### Participation snapshot extension

Extend existing participation storage to support:

```text
headcount
participantCount
percentage with 2-decimal precision
employeeSyncRunId nullable for legacy
snapshot/headcount capture time
frozen unit name
frozen parent unit name
historical category label when useful
legacy provenance representation
correction audit relation
```

Locked referential behavior:
- employeeSyncRunId nullable for legacy;
- participation → EmployeeSyncRun historical reference must not cascade-delete; prefer ON DELETE RESTRICT;
- actor/import attribution may use nullable SET NULL relations where history must survive account removal;
- audit should preserve actor display snapshot/name.

### Correction audit

Store old/new participant count, old/new percentage, reason, actor, actor display/name, timestamp, and optional sync provenance where useful.

### Decimal consistency

Percentage/history fields must use one consistent two-decimal Decimal contract.

### Migration safety

Database may already contain data.

Use:

```text
add nullable/default-safe structures
→ backfill/classify legacy safely
→ tighten only when proven safe
```

Rules:
- do not fabricate legacy headcount/participant values;
- do not hard-delete history;
- no destructive CASCADE on participation history;
- no unrelated models outside locked scope.

### Task 1 validation

In MANUAL APPLY:
1. inspect complete current schema + relevant migrations;
2. build proposed complete schema in external scratch;
3. validate inverse relations, relation names, nullability, indexes, unique constraints, Decimal contracts, referential actions;
4. run Prisma validate.

Known Windows direct fallback:

```text
cmd /c .\node_modules\.bin\prisma.cmd validate --schema <scratch>\schema.prisma
```

A PowerShell/npx invocation-policy failure is not a schema failure if the direct Prisma command succeeds.

Before `PROPOSAL_READY`, emit targeted anchored edits for the existing Prisma schema and complete SQL content for the new migration file, matching the validated scratch proposal.

### Task 1 is NOT blocked by

- Pentaho endpoint URL;
- Pentaho auth method;
- transport mechanism;
- final external field names;
- future NOREG/person ID.

# Task 2 — Legacy backfill and one-time reset/seed

Depends on Task 1.

- link compatible existing SSO Users to Employees by NIP where evidence supports it;
- preserve/classify historical participation as legacy;
- preserve bootstrap/local Admin;
- one-time development/setup dummy cleanup only;
- never put reset/delete-all into normal Employee sync.

# Task 3 — Central Employee/PIC helpers

Depends on Task 1.

Create centralized:

```text
isEmploymentActive(employee)
isPicEligible(employee)
```

Eligibility:

```text
jenjang in {4,5}
AND kodeStatpeg = "01"
AND statKepeg = "02"
AND isPresentInSource = true
```

This task must precede sync/PIC/auth consumers.

# Task 4 — Pentaho full-snapshot backend

Depends on Tasks 1 and 3.

```text
normalized full batch
→ validate whole batch
→ reconcile/upsert Employee
→ reconcile stable Unit mapping
→ mark present/missing
→ detect mutation
→ deactivate linked User when required
→ finalize EmployeeSyncRun
```

No missing-marking on failed/partial run. No hard delete. No automatic role/User.unitId changes. Reappearing Employee does not auto-reactivate User.

External adapter maps real Pentaho fields later.

# Task 5 — User / PIC / VIEWER management

Depends on Tasks 1 and 3.

Admin-only create/link/assign/reassign/activate, one User max per Employee, VIEWER retained, eligibility enforced server-side.

Carry-forward requirements for Task 5:
- Employee ADMIN + SSO compatibility support;
- LOCAL debug PIC excluded from normal operational PIC listings.

# Task 6 — Authentication & SSO Security Hardening

Depends on Tasks 1, 3, and 5.

Task 6 is an umbrella task. Its packets are independently completable; Task 6 may remain `IN_PROGRESS` while individual packets reach `PROPOSAL_READY` and `APPLIED_VERIFIED`.

Locked authentication matrix:

```text
ADMIN + SSO   = valid employee Admin
PIC   + SSO   = valid employee PIC
VIEWER + SSO  = rejected

ADMIN + LOCAL = valid debug/breakglass Admin
PIC   + LOCAL = valid scoped debug PIC
VIEWER + LOCAL = rejected
```

For `PIC + LOCAL`, `User.unitId` is mandatory and authorization scope must never be bypassed. Employee production accounts use SSO. LOCAL accounts are explicit debug/breakglass accounts.

## Task 6A — Auth Policy Foundation

Status: `APPLIED_VERIFIED`

Define and implement one canonical server-side policy layer that evaluates the locked role/provider matrix and can be reused by later provider and guard code.

Required semantics:
- `ADMIN + SSO`: active User, Employee required, source-present, employment-active; PIC eligibility is not required;
- `PIC + SSO`: active User, Employee required, source-present, `isPicEligible()`, required `User.unitId`, and `User.unitId === Employee.unitId`;
- `ADMIN + LOCAL`: active User, Employee optional;
- `PIC + LOCAL`: active User, required `User.unitId`, Employee optional, no employment/PIC eligibility requirement;
- `VIEWER`: authentication rejected;
- provider mismatch fails closed;
- canonical policy must not use `NODE_ENV` role bypass or `ALLOW_PIC_LOGIN`.

Use the canonical `isEmploymentActive()` and `isPicEligible()` helpers. Focused deterministic policy-matrix tests are required.

6A excludes login UI, SAML routes, RelayState, callback, replay storage, and `auth.config` changes.

## Task 6B — Login Surface + Local Debug Authentication

Status: `PROPOSAL_READY`

Apply the canonical policy to the credentials login surface and preserve explicit LOCAL debug/breakglass behavior. Keep login UI and local credential flow changes isolated from the policy foundation.

Login-surface requirements:
- `/login` presents SSO-only UI;
- `/login/admin` presents LOCAL credential UI;
- `/login/admin` is a public route;
- `/login` contains no visible link to `/login/admin`.

## Task 6C — SSO Account Authorization

Apply the canonical policy to SSO account lookup/linking and current Employee/User state validation for production Admin and PIC accounts. VIEWER SSO remains rejected.

## Task 6D — Current-State API Authorization

Audit and migrate protected API authorization to current-state server-side checks, including active account, provider/role policy, Employee state, and mandatory PIC unit scope where applicable.

## Task 6E — SAML Transport Security

Harden SAML request/callback transport, RelayState handling, replay protection, and related trust-chain boundaries without changing the locked authentication matrix.

## Task 6F — Operational Account Isolation / Compatibility

Separate LOCAL debug/breakglass accounts from normal Employee operational account management and preserve compatibility seams while preventing LOCAL debug PIC accounts from normal operational PIC listings.

## Task 6G — Integrated Task 6 Verification

Run integrated Task 6 conformance, code, security, and focused integration assurance across the complete provider/role matrix, API authorization, and SAML trust chain.

# Task 7 — Participation first-snapshot commit

Depends on Tasks 1, 3, and 4.

On first successful commit for unit/category/year/quarter:
- use latest successful EmployeeSyncRun;
- reread active direct Employees;
- freeze headcount + historical labels + sync provenance atomically;
- validate participant count;
- calculate Decimal percentage.

```text
participantCount < 0 -> reject
participantCount > headcount -> reject
headcount = 0 and participantCount = 0 -> allow, 0.00, warning
```

Preview never freezes denominator.

# Task 8 — Participation correction + audit

Depends on Task 7.

Same-period import is correction. Preserve denominator + sync provenance, require overwrite confirmation + reason, persist audit.

# Task 9 — Workbook import/export

Depends on Tasks 7 and 8.

Sheets: Summary, Kanwil, Kancab, Divisi, Instructions/Reference.

Columns: No, Kode Unit, Unit Kerja, Induk Unit Kerja, Jumlah Karyawan, Jumlah Partisipasi, Persentase.

# Task 10 — Frontend types/hooks/contracts

Depends on stable backend contracts.

Frontend contracts must support `ADMIN`/`PIC` × `SSO`/`LOCAL`.

# Task 11 — Employee/User/PIC Admin UI

Clearly separate source presence, employment status, eligibility, account status, role, and assignment.

Include:
- Employee ADMIN assignment;
- Employee PIC assignment;
- LOCAL debug/system accounts separated from normal Employee management.

# Task 12 — Participation UI

Import/preview, zero-headcount warning, conflict marker, overwrite confirmation, correction reason, snapshot/workbook flow.

# Task 13 — Compatibility seam

Old employee Excel import may remain temporarily while Pentaho integration stabilizes, but must not become a competing source of truth.

Compatibility work includes:
- legacy direct `auth()` authorization compatibility cleanup;
- future shared replay-store concern for multi-instance deployment.

# Task 14 — Review / security / proposal validation

Proposal defect:
```text
first substantial failure -> targeted correction
second same-class failure -> debugger
complex Prisma/migration -> migration_specialist
architect only for genuinely new architecture decision
```

Do not call ordinary implementation failures business blockers.

Include integrated security assurance for the full role/provider auth matrix.

# Task 15 — Final applied verification

Only after manual application:

```text
npm run lint
npx tsc --noEmit
npm run build
```

plus focused checks/tests.

Include final verification of the SSO trust chain and LOCAL debug/breakglass paths.

# Preferred order

```text
1. Prisma schema + migration
2. Legacy backfill + one-time reset/seed
3. Employee/PIC helpers
4. Pentaho full-snapshot backend
5. User/PIC/VIEWER management
6. Authentication & SSO Security Hardening
   6A. Auth Policy Foundation
   6B. Login Surface + Local Debug Authentication
   6C. SSO Account Authorization
   6D. Current-State API Authorization
   6E. SAML Transport Security
   6F. Operational Account Isolation / Compatibility
   6G. Integrated Task 6 Verification
7. Participation first snapshot
8. Participation correction + audit
9. Workbook import/export
10. Frontend types/hooks
11. Employee/User/PIC UI
12. Participation UI
13. Compatibility cleanup when safe
14. Review/security/proposal validation per packet
15. Final verification after manual apply
```

Do not place eligibility helpers after their consumers.
Do not omit Auth/SSO.
Do not treat reset as sync behavior.

# Deferred external adapter

Core logic may consume a normalized Employee input:

```text
NIP/external identity
name
jenjang
kodeStatpeg
statKepeg
externalUnitCode
source metadata
```

The real Pentaho adapter later maps actual external field names/transport into this internal contract.

Do not invent external endpoint/auth/column names, and do not block earlier internal tasks because they are deferred.

# Task-state gate for this feature

Tasks 1–5 and 7–15 retain their existing numbering and prerequisite relationships. Task 6 is packetized: packets 6A–6F may be proposed and applied independently after their prerequisites are satisfied, while 6G is the integrated verification packet. Task 6 overall may remain `IN_PROGRESS` while individual packets become `PROPOSAL_READY` and `APPLIED_VERIFIED`.

At any point, only completed prerequisites plus the CURRENT active task are acceptance scope.

Examples:

```text
After Task 1 is applied:
Task 2 = NOT_STARTED until its proposal begins
Task 3 = NOT_STARTED
...
```

Do not classify these as failures merely because current repository behavior still reflects the legacy implementation they are intended to replace.

Specific carry-forward examples:

- Legacy `users/import` creating/updating Users directly is baseline evidence for Task 2/4 planning.
- Partial import deactivation behavior is a future sync/import constraint until its owning task proposal exists.
- `User.unitId` overwrite behavior is a future Employee/PIC lifecycle constraint until the owning proposal is authored.
- Missing `isEmploymentActive()` / `isPicEligible()` helpers before Task 3 begins means `Task 3: NOT_STARTED`, not validation failure.
- Current seed/reset behavior is baseline evidence Task 2 must safely redesign; it is not a failed Task 2 proposal before Task 2 has a proposal.

A task may be `PROPOSAL_VALIDATION_FAILED` only after its concrete proposal exists and fails validation/review.

After each task or independently completable packet:

```text
PROPOSAL_READY
→ user applies
→ lightweight APPLIED_VERIFICATION
→ APPLIED_VERIFIED
→ start next dependent task or packet
```


# Assurance milestones for this feature

Use task-local proposal assurance plus lightweight post-apply verification.

Do not run full code-review + security-review + tester after every manual apply.

## Per-task applied verification

After each task or independently completable packet is manually applied:

```text
inspect applied state
→ compare with validated handoff
→ smallest deterministic verification
→ PASS
→ next task
```

No reviewer rerun unless mismatch/failure/new risk.

## Milestone A — Data foundation

After Tasks 1–3:

```text
Task 1 schema/migration
Task 2 legacy/reset
Task 3 eligibility helpers
```

Run focused integration/data-contract checks.

Security reviewer is not automatically required unless implementation introduced a security-relevant change.

## Milestone B — Employee sync + account authorization

After Tasks 4–6:

```text
Task 4 Pentaho full-snapshot backend
Task 5 User/PIC/VIEWER management
Task 6 Authentication & SSO Security Hardening (6A–6G)
```

This is a SECURITY-RELEVANT milestone.

Run:

```text
code review
security review
focused integration tests
```

Focus on:
- PIC eligibility consistency;
- source presence;
- Employee.unitId vs User.unitId;
- mutation deactivation;
- SSO/API authorization;
- role/unit scope;
- failed/full snapshot behavior.

## Milestone C — Participation integrity

After Tasks 7–9:

```text
Task 7 first snapshot
Task 8 correction/audit
Task 9 workbook import/export
```

Run:

```text
code/data-integrity review
focused integration tests
security review only where import/API trust boundary makes it relevant
```

Focus on:
- frozen denominator;
- sync provenance;
- correction audit;
- overwrite confirmation;
- zero-headcount rule;
- workbook input validation.

## Milestone D — UI integration

After Tasks 10–12:

```text
frontend contracts
Employee/User/PIC UI
participation UI
```

Run focused frontend/backend contract verification and relevant UI tests.

Security reviewer only if UI changes alter auth/access assumptions.

## Final milestone

After all implementation tasks are applied:

```text
npm run lint
npx tsc --noEmit
npm run build
focused integration suite
final security pass for the integrated auth/import surface
```

Do not repeat every earlier task-local review individually.


# Plan consistency gate

Before ready handoff:

```text
requirement coverage             PASS
dependency topology             PASS
cross-cutting coverage           PASS
ownership collision              PASS
verification coverage            PASS
manual-apply order               PASS / N/A
validated handoff consistency    PASS when PROPOSAL_READY
```
