<!-- BEGIN:ai-agent-rules -->

# Website-Fraud — Repository Operating Rules

These are repository-specific rules for `Detection-Fraud/Website-Fraud`.

Cross-repository behavior such as general subagent orchestration, global skill
routing, agent registration, and reusable engineering workflow belongs to the
user-level Codex configuration.

This file adds only the rules required specifically by this repository.

---

## 0. Source of truth and session bootstrap

Do not rely on chat memory as the source of truth for repository work.

For any non-trivial repository task:

1. read this `AGENTS.md`;
2. inspect the relevant repository state;
3. recover the current task and collaboration mode;
4. read only the context files relevant to that task.

For the Employee / User / Pentaho / PIC / Participation feature family, also
read:

```text
.codex/context/employee-pentaho-design-lock.md
.codex/context/employee-pentaho-implementation-plan.md
.codex/TASK-STATE-SEMANTICS.md
.codex/TOKEN-EFFICIENT-ASSURANCE.md

When collaboration mode is MANUAL APPLY, also read:

.codex/MANUAL-APPLY-RESPONSE-FORMAT.md

If a required context file is missing, report the exact missing file instead of
inventing its contents.

Use this precedence when task-state evidence disagrees:

current applied repository state
→ explicit current user checkpoint / verification evidence
→ current task-state/context files
→ older plan status labels
→ chat memory

Do not ask the user to repeat information that can be recovered from repository
evidence.

1. Current-task boundary

Only these are acceptance scope:

CURRENT TASK
+ already-completed prerequisites

Do not classify missing future-task implementation as a defect.

Do not start, implement, or substantially review the next numbered task unless:

the user explicitly starts it; or
the current task requires a bounded compatibility/dependency inspection.

A bounded inspection does not authorize implementation of the future task.

When design is marked LOCKED, do not reopen settled business/domain decisions
unless concrete repository evidence contradicts the lock.

If a genuine contradiction exists:

report exact conflict
→ stop the conflicting lane
→ do not silently invent a new design
2. Collaboration modes

The explicit mode in the current user request wins.

AUTO

Codex may modify repository files within the current task scope through the
appropriate implementation owner.

Normal focused verification and relevant review apply.

MANUAL APPLY

Repository product files are read-only.

Codex and delegated agents MUST NOT:

modify;
create;
delete;
rename;
format;
patch

real repository product files.

Agents may inspect the repository, design the implementation, produce exact
proposal code, use isolated scratch validation when safe, and review the
proposal.

Keep these states separate:

PROPOSAL VALIDATION
!=
APPLIED REPOSITORY VERIFICATION

A proposal may become:

PROPOSAL_READY

only after its proposal validation and handoff are complete.

It becomes:

APPLIED_VERIFIED

only after the user applies it and verification runs against the actual
repository state.

REVIEW

Read-only inspection of already-applied work.

Report findings. Do not silently fix them unless the collaboration mode changes.

Destructive Git operations, deployment, production/shared database mutations,
secrets, infrastructure, or other consequential actions require explicit
authorization regardless of mode.

3. Delegation discipline

Use the smallest useful set of agents.

Do NOT require the entire agent roster for every non-trivial task.

Do NOT require this fixed chain:

project_manager
→ explorer
→ implementation_planner
→ implementation owner

unless the specific task genuinely requires those roles.

Route by actual scope.

Typical implementation ownership:

frontend work  → frontend_engineer
backend work   → backend_engineer
migration work → migration_specialist

Use additional roles when materially relevant:

code_reviewer
→ independent correctness/integration review

tester
→ focused behavioral verification

security_reviewer
→ auth/authz, trust boundary, sensitive data, upload/import,
  security-relevant role/scope changes

debugger
→ concrete repeated or hard-to-explain failures

architect
→ genuinely new architecture or unresolved cross-module design decisions

If the current user request, locked plan, or primary assignment explicitly
requires a named role, the primary MUST actually delegate to that registered
role.

Do not self-substitute for an explicitly mandatory role.

If that role is unavailable in the current runtime, report the tooling
limitation and stop that mandatory lane.

Never claim an agent or skill was used unless it actually ran.

4. Non-trivial change assurance

For non-trivial shared/backend/auth/parser/database/API/migration/integration
changes, prefer:

repository inspection
→ impact map / CRG when useful and available
→ bounded acceptance matrix
→ implementation or proposal
→ simplicity pass
→ focused verification
→ impact/CRG delta check
→ relevant review
→ targeted correction if needed
→ final verification

Use code-review-graph as a hard gate when available for changes where missing
a caller/consumer could materially affect correctness, especially:

shared backend contracts;
auth/authz;
parsers/imports;
persistence;
APIs;
migrations;
cross-module types;
milestone integration.

Every materially affected caller/consumer should have either:

focused coverage; or
explicit evidence that it remains unaffected.

Green tests prove only the tested cases. They do not prove requirement
completeness.

Before finalizing a non-trivial implementation, apply a simplicity/YAGNI pass
such as ponytail when available.

Do not simplify away:

locked business behavior;
authorization;
validation;
transactions;
concurrency guarantees;
audit/history;
domain ownership boundaries.
5. Failure and correction discipline

Classify findings before fixing them:

implementation defect
acceptance gap
integration gap
security-boundary gap
test defect
baseline issue
environment failure

For the first substantial implementation/proposal defect:

return to the owning implementation agent
→ targeted correction
→ rerun affected checks

Use debugger when:

the same material failure class persists after a reasonable correction; or
root cause is genuinely unclear.

Do not invoke debugger merely to satisfy workflow ceremony.

Known ENOMEM environment failure

If a Node/tsx/test command fails specifically with:

uv_os_get_passwd returned ENOMEM

classify it as:

ENVIRONMENT_FAILURE

Then:

do not repeatedly retry;
do not invoke debugger for ENOMEM alone;
record the exact failed command;
continue independent checks;
give the exact command to the user for manual execution.

Do not mark that test lane PASS until successful execution evidence exists.

User-provided successful terminal output is valid verification evidence.

6. MANUAL APPLY handoff

A successful MANUAL APPLY proposal must emit the complete validated edit set.

For existing files include:

exact path
action: ADD / REPLACE / DELETE / RENAME / MOVE
containing symbol or stable anchor when useful
exact final code

For new files include:

CREATE FILE
exact path
complete final content

No placeholders.

Do not silently omit dependent edits.

The final emitted handoff must match the proposal that was validated.

If the handoff changes materially after validation, revalidate it.

Do not claim applied runtime/test behavior before the user applies the changes.

7. Repository stack and reuse rules

Current repository stack includes:

Next.js 16.2.x
React 19
HeroUI v3
Tailwind CSS 4
Prisma 6.19 / PostgreSQL
NextAuth v5 beta
Zod
React Hook Form
Zustand
Recharts
ExcelJS / XLSX

Before changing version-specific Next.js behavior, inspect current installed
Next.js documentation under node_modules when available and follow existing
repository patterns.

For HeroUI work:

use HeroUI v3 APIs;
use the configured HeroUI skill/docs when relevant;
do not assume legacy NextUI APIs.

Before creating a reusable hook/component/helper, inspect existing equivalents,
including where relevant:

src/hooks/
src/components/
page-local _components/
src/lib/

Reuse or extend existing abstractions before creating duplicates.

Avoid unrelated refactors.

8. Authorization and Unit hierarchy

Application roles include:

ADMIN
PIC
VIEWER

Unit hierarchy includes:

DIVISI
KANTOR_WILAYAH
KANTOR_CABANG

Authorization MUST be enforced server-side.

Client-supplied IDs, filters, role values, or Unit IDs are never proof of
authorization.

When changing scoped APIs or queries, verify that restricted users cannot escape
their authorized Unit scope through request parameters.

For the Employee/Pentaho feature family, the locked context documents are
authoritative for:

Employee.unitId
User.unitId
Employee/User ownership
PIC eligibility
source presence
account state
role/provider behavior
ManagementUserView ownership
Employee/User Admin UI ownership
participation snapshot/correction/workbook semantics

Do not duplicate or reinterpret those contracts here.

9. Wilayah filter invariant

Unless an approved design explicitly changes it:

Kanwil → Kancab

is cascading.

Kancab options depend on the selected Kanwil.

Divisi and Kanwil/Kancab are mutually exclusive.

Selecting Divisi clears/disables Kanwil and Kancab.

Selecting Kanwil/Kancab clears/disables Divisi as appropriate.

This rule applies to both UI state and server/API validation.

10. Compliance formula

Across Reports and Calendar, preserve:

per program per unit
= (approved_submissions / program.frequency) * 100

When filter = all programs:

average percentage across active programs

When filter = one program:

that program's percentage only

Status:

On Track >= 50%
Behind   = 25–49%
At Risk  < 25%

Over-achievement is allowed.

Do not clamp percentages to 100%.

11. Backend safety

For API/server/database work:

authenticate and authorize before protected data access/mutation;
validate external/user input using established Zod patterns;
validate IDs against authorized scope;
use bounded pagination/batching;
prefer explicit Prisma select / include;
use transactions for multi-write invariants;
preserve audit/history where required;
treat uploads/imports/external services as trust boundaries;
do not expose secrets or unnecessary internal errors;
do not add competing mutation paths around locked domain services.

Pentaho synchronization must not silently become application authorization.

12. Verification

Discover relevant scripts before validation.

Repository baseline checks:

npm run lint
npx tsc --noEmit
npm run build

There is no assumption that a generic npm test or npm run typecheck script
exists.

Also run the smallest relevant focused tests for the changed behavior.

Separate:

CHANGE-SPECIFIC FAILURE
BASELINE FAILURE
ENVIRONMENT FAILURE

Do not attribute an existing repository baseline failure to the current task
without evidence.

Do not claim completion from:

stale test output;
lint alone;
reviewer approval alone;
an implementation agent saying DONE;
scratch validation in MANUAL APPLY.

Verification evidence must match the final applied/proposed state being claimed.

13. Completion and task transition

Before claiming a code task complete:

requirements covered
→ affected consumers accounted for
→ relevant focused checks pass
→ required review lanes pass
→ known failures correctly classified

Report only agents, skills, and verification that actually ran.

When the current numbered task reaches its requested boundary:

STOP

Do not opportunistically start the next task.

<!-- END:ai-agent-rules -->
```
