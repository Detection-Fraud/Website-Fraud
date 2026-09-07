<!-- BEGIN:ai-agent-rules -->

Website-Fraud — Codex Multi-Agent Operating Rules

These rules are repository-level operating policy. They are intended to survive new chats, model switches, and lost conversational context.

0. SESSION BOOTSTRAP — MANDATORY

0.1 Do not rely on chat memory

At the start of a new chat, resumed task, named feature task, or when the user says "continue", "start Task N", "lanjut", or equivalent:

DO NOT rely on remembered conversational context as the source of truth.

Recover the working contract from repository evidence first.

0.2 Read order

For any non-trivial repository task, read this file first.

For the Employee / User / Pentaho / PIC / Participation feature family, before inspecting, planning, implementing, reviewing, or classifying a task, read:

AGENTS.md
.codex/context/employee-pentaho-design-lock.md
.codex/context/employee-pentaho-implementation-plan.md
.codex/TASK-STATE-SEMANTICS.md
.codex/TOKEN-EFFICIENT-ASSURANCE.md

If collaboration mode is MANUAL APPLY, also read:

.codex/MANUAL-APPLY-RESPONSE-FORMAT.md

This read is mandatory even if the task sounds familiar from a previous conversation.

0.3 Recover current state before work

Before starting a persistent numbered task:

READ LOCKED DESIGN
→ READ IMPLEMENTATION PLAN
→ INSPECT CURRENT REPOSITORY STATE
→ RESOLVE CURRENT TASK + PREREQUISITES
→ RESOLVE COLLABORATION MODE
→ RESOLVE ASSURANCE MODE
→ ONLY THEN ROUTE / EXPLORE / PLAN / IMPLEMENT

Do not infer that a previous task is incomplete merely because a plan file contains an older status label. Current repository evidence and explicit user-provided completion/checkpoint information may be newer.

Do not silently rewrite historical task state. Report discrepancies between plan status and actual applied repository state when material.

0.4 Current-task gate

Only the current task and already-completed prerequisites are acceptance scope.

Do not inspect, plan, implement, or review the next numbered task unless:

the user explicitly starts it; or

the current locked implementation plan explicitly requires a bounded prerequisite inspection.

Example:

Task 6 complete
Task 7 NOT_STARTED

means Task 7 is not to be explored merely because its code is missing or TypeScript errors are known to belong to it.

0.5 New-chat recovery output

When a task is resumed in a new chat, internally establish at minimum:

CURRENT FEATURE
CURRENT TASK STATE
COMPLETED PREREQUISITES
COLLABORATION MODE
ASSURANCE MODE
DESIGN LOCK STATUS
KNOWN BASELINE / ENVIRONMENT LIMITATIONS

Do not ask the user to repeat information that is already recoverable from repository context files and source.

1. Operating model

For meaningful engineering work:

TRIAGE
→ EXPLORE
→ RE-SCOPE
→ ARCHITECT IF NEEDED
→ PLAN IF NEEDED
→ IMPLEMENT / PROPOSE
→ FOCUSED VALIDATE
→ INTEGRATED ASSURANCE WHEN DUE
→ DEBUG / FIX IF NEEDED
→ FINAL VERIFY

The primary Codex thread is the orchestrator.

Primary owns:

actual subagent spawning;

waiting and coordination;

synthesis;

workflow state;

collaboration-mode enforcement;

assurance-mode enforcement;

final user-facing handoff.

Role ownership:

project_manager: normal scope, routing, dependencies, agent/skill selection, concurrency, planner/architect routing.

deep_project_manager: deep requirement/design discussion.

built-in explorer: repository evidence and blast-radius mapping.

architect: material architecture/design judgment and design-lock status.

implementation_planner: detailed executable implementation planning after design is locked.

implementation specialists: bounded implementation or proposal authoring.

reviewers/tester: independent assurance, not implementation.

debugger: evidence-based root-cause investigation after concrete failures.

Do not spawn the whole roster.
Do not load every installed skill.
Use the smallest set that materially improves correctness, speed, safety, or clarity.

2. Routing lanes

NORMAL ENGINEERING

Use for:

repository discussion;

implementation planning;

implementation;

MANUAL APPLY proposal authoring;

bug fixes;

review;

verification.

Default:

Primary
→ project_manager
→ explorer if evidence is needed
→ architect only if genuine design judgment is needed
→ implementation_planner only if detailed planning is justified
→ implementation owner

DEEP DISCUSSION

Use when:

user explicitly requests deep discussion;

architecture/flow is materially unknown;

assumptions must be aggressively challenged;

user asks for blind spots/celah;

an early wrong decision would cause substantial rework.

Default:

Primary
→ deep_project_manager
   ├─ reasoning first
   ├─ max 2 read-only explorers when useful
   └─ max 1 architect only if a distinct architecture problem remains

Do not invoke normal project_manager first in DEEP DISCUSSION.

Default delegation budget:

deep_project_manager: 1
explorers: max 2
architect: max 1

Do not invoke implementation/review agents by default during deep discussion.

Once design is locked, exit DEEP DISCUSSION and return to normal engineering.

3. Collaboration modes

The active collaboration mode controls repository-write permission.

The mode MUST be preserved explicitly in every implementation assignment.

If a non-trivial task has no resolvable collaboration mode, do not silently assume AUTO.

AUTO

Use only when the user explicitly wants direct repository implementation.

AUTO may modify repository product files.

AUTO does not automatically authorize:

production deployment;

production/shared DB mutation;

destructive database reset;

force push;

destructive Git operations;

secrets changes;

.env changes.

Those remain explicit-approval actions.

MANUAL APPLY

Use when Codex authors the implementation and the user applies product-code changes manually.

In MANUAL APPLY, primary and ALL subagents MUST NOT:

modify real repository product files;

create real repository product files;

delete/rename/move real repository product files;

format product files;

apply patches to product files;

mutate the real/shared database unless explicitly authorized.

Implementation specialists become proposal authors, not repository writers.

Allowed:

repository inspection;

read-only exploration;

dependency tracing;

design;

exact proposal code;

isolated scratch validation outside the real repository root;

safe deterministic checks against scratch copies.

Do not use a Git worktree as scratch if it mutates real repository Git metadata.

MANUAL APPLY — DEFERRED ASSURANCE

Preferred controlled-build workflow:

LOCKED DESIGN
→ LOCKED IMPLEMENTATION PLAN
→ Task N proposal
→ cheap deterministic proposal validation
→ COMPLETE MANUAL HANDOFF
→ user manually applies
→ light applied verification
→ next task
→ ...
→ milestone
→ INTEGRATED ASSURANCE
→ AUTO REMEDIATION if explicitly requested

Do not automatically run code reviewer + security reviewer + tester after every packet.

Use cheap deterministic validation appropriate to the task:

Prisma schema      → prisma validate
TypeScript         → focused compile / tsc
migration          → static SQL safety validation
pure helper        → focused deterministic test/check
parser/import      → scratch dry-run
frontend contracts → TypeScript compile

Deferred assurance means delayed broad assurance, not permanent skipping.

4. MANUAL APPLY output contract — HARD GATE

This section is a hard completion gate.

4.1 Summary is NOT a handoff

The following are NOT sufficient:

"buat file X berisi service..."
"ubah route agar..."
"tambahkan parser..."
"perbarui test..."
"gunakan transaction..."
"fix Decimal..."

Those are implementation summaries/plans.

They are not a complete MANUAL APPLY edit set.

4.2 Existing files

Default output is surgical.

For every existing-file operation use:

File:
<exact path>

Action:
ADD | REPLACE | DELETE | RENAME | MOVE

Containing symbol:
<symbol when useful>

Find exact anchor:
<stable current source text>

Instruction:
<exact position/action>

Apply code:
<exact final code>

Reason:
<short reason>

Requirements:

exact path;

stable current-code anchor;

exact location;

exact final code;

containing symbol when useful;

enough anchor context to avoid ambiguity.

Do not rely only on line numbers.

Never use placeholders such as:

...
rest unchanged
update accordingly
existing logic here
same as above
etc.
fake function
guessed signature

4.3 New files

For every new file:

CREATE FILE
path/to/file.ts

<COMPLETE FILE CONTENT>

Complete means copy-pasteable from first line to last line with:

all imports;

all types;

all functions;

exports;

error handling;

no omitted blocks;

no placeholders.

4.4 Deleted files

Use:

DELETE FILE
path/to/file.ts

Include evidence why deletion is safe.

4.5 Full existing-file replacement

Do not output full existing-file replacement by default.

Use only when:

user explicitly asks; or

surgical edits would be materially less safe.

4.6 Unified diff

Do not use unified diff by default.

Use only when explicitly requested or when it is materially safer than surgical instructions.

5. PROPOSAL_READY is an output state, not a planning label

This rule is mandatory.

A task may be called:

PROPOSAL_READY

only if the same user-facing delivery actually contains the complete validated manual edit handoff required by Section 4.

The following combination is forbidden:

implementation summary only
+
TARGETED MANUAL EDIT SET: COMPLETE

If the code was not actually emitted, the edit set is not complete.

5.1 Required MANUAL APPLY ready state

Before claiming PROPOSAL_READY, all must be true:

PROPOSAL VALIDATION: PASS
TARGETED MANUAL EDIT SET: COMPLETE
VALIDATED HANDOFF CONSISTENCY: PASS
APPLIED REPOSITORY VERIFICATION: NOT RUN

TARGETED MANUAL EDIT SET: COMPLETE means the user has actually received every required exact edit.

5.2 Output-limit rule

If output size/tool limits prevent emitting the complete handoff:

Task N — PROPOSAL_IN_PROGRESS
TARGETED MANUAL EDIT SET: INCOMPLETE

Do not falsely claim PROPOSAL_READY.

Continue the handoff in the workflow until complete.

5.3 Validation/handoff consistency

Proposal validation and final emitted handoff must represent the same material code.

If emitted code changes after validation:

previous validation → STALE
→ revalidate changed proposal

Do not claim validation for code that was never validated.

5.4 Proposal vs applied verification

Keep distinct:

PROPOSAL VALIDATION
= scratch/proposed code validation before user applies

APPLIED REPOSITORY VERIFICATION
= verification of the real repository after user applies

Never infer applied verification from scratch validation.

6. Task-state semantics

Follow .codex/TASK-STATE-SEMANTICS.md when present.

Canonical states:

NOT_STARTED
PROPOSAL_IN_PROGRESS
PROPOSAL_VALIDATION_FAILED
PROPOSAL_READY
APPLIED_VERIFICATION_FAILED
APPLIED_VERIFIED
BLOCKED

NOT_STARTED

No active concrete proposal exists.

Missing code is expected.

PROPOSAL_IN_PROGRESS

Inspection, authoring, correction, or required validation is still happening.

This is active work, not a normal stopping point when recovery is actionable.

PROPOSAL_VALIDATION_FAILED

Use ONLY when:

a concrete proposal exists for the CURRENT task;

validation/review actually ran;

that proposal materially failed.

PROPOSAL_READY

Use only when all proposal gates pass and complete MANUAL APPLY handoff has been emitted when MANUAL APPLY is active.

APPLIED_VERIFICATION_FAILED

Use when the handoff was applied but:

real repository materially differs; or

deterministic applied validation reveals a real current-task defect.

APPLIED_VERIFIED

Use when:

material repository state matches intended implementation;

required applied checks pass or unavoidable environment failures are correctly separated from implementation defects.

BLOCKED

Use only for genuine blockers such as:

missing current-task business/product decision;

inaccessible required repository evidence;

required external contract unavailable;

required infrastructure/tool unavailable with no safe fallback;

required explicit approval for a risky/destructive action.

Do not use BLOCKED for:

normal proposal bugs;

future-task missing code;

recoverable compile errors;

deferred details irrelevant to current task.

Hard rule:

missing implementation for NOT_STARTED task
!=
PROPOSAL_VALIDATION_FAILED

7. Finding classification

Use:

BASELINE GAP
PROPOSAL DEFECT
APPLIED-STATE DEFECT
FUTURE-TASK CONSTRAINT
GENUINE BLOCKER
ENVIRONMENT_FAILURE

Default review scope:

CURRENT TASK
+ already-applied prerequisites

Do not audit untouched future tasks as if they are implemented.

Environment failures must be separated from implementation defects when evidence supports it.

Examples:

uv_os_get_passwd returned ENOMEM
external font/network fetch failure

are environment failures only when the failing behavior is independently shown not to be a current-task code defect.

8. Recoverable work and bounded retry

First substantial concrete proposal failure:

same owner
→ one targeted evidence-based correction

If the corrected concrete proposal is actually produced and materially fails the same failure class again:

STOP equivalent retries
→ debugger
→ root cause

Then route:

Prisma/migration/existing-data issue → migration_specialist
genuine architecture decision        → architect

An interrupted/incomplete correction does not count as the second same-class failure.

PROPOSAL_IN_PROGRESS is not a normal stop condition when remaining work is actionable.

Continue when no user decision/approval/external blocker is required:

proposal
→ recoverable defect
→ owner correction
→ targeted validation
→ handoff consistency
→ PROPOSAL_READY

9. Mandatory workflow skills

Expected workflow skills when relevant:

dispatching-parallel-agents
subagent-driven-development
verification-before-completion

Conditional:

grilling
writing-plans
tdd
diagnosing-bugs
domain-modeling
codebase-design
code-review-graph

Do not load all skills automatically.

writing-plans belongs to implementation_planner.

If a skill is unavailable:

follow equivalent operating rules;

do not claim it was used.

10. Agent roster

Recommended allocation:

Primary Codex             Luna medium
project_manager           Terra medium
deep_project_manager      Sol high
built-in explorer         Luna medium
architect                 Sol high
implementation_planner    Luna high
frontend_engineer         Luna medium
backend_engineer          Luna medium
migration_specialist      Luna high
code_reviewer             Luna medium
security_reviewer         Terra high
tester                    Luna medium
debugger                  Terra high

The concurrency setting is a maximum, not a target.

project_manager

READ ONLY.

Owns:

scope;

current task;

risk;

routing;

high-level dependency graph;

agent/skill selection;

concurrency;

assurance strategy.

deep_project_manager

READ ONLY.

Owns deep requirements/design reasoning.

explorer

READ ONLY.

Owns repository understanding, dependency evidence, callers/consumers, and blast radius.

architect

READ ONLY.

Owns:

architecture;

contracts;

invariants;

boundaries;

design gaps;

design lock.

implementation_planner

READ ONLY.

Owns:

executable task ordering;

ownership;

interfaces;

dependencies;

validation;

assurance classification;

MANUAL APPLY order.

frontend_engineer

WRITER in AUTO.

Proposal author in MANUAL APPLY.

backend_engineer

WRITER in AUTO.

Proposal author in MANUAL APPLY.

migration_specialist

Use for materially complex:

Prisma relations/inverse relations;

referential actions;

migration ordering;

nullable → backfill → required;

existing-data preservation;

unique/index rollout;

Decimal schema conversions;

SQL migration safety;

repeated migration failures.

Do not invoke for routine Prisma queries.

code_reviewer

READ ONLY.

security_reviewer

READ ONLY.

tester

Validation runner. Does not fix implementation.

debugger

READ ONLY by default. Owns root-cause investigation.

11. Project-manager routing

For non-trivial work:

Pass A → triage
Explorer → source evidence
Pass B → evidence-based re-scope

Pass A identifies:

complexity;

risk;

current task state;

collaboration mode;

assurance mode;

affected domains;

unknowns;

exploration need;

architecture need;

planner need.

Pass B identifies:

actual files/domains;

required agents;

required skills;

skills not to load;

ownership;

dependencies;

parallelism;

validation;

assurance relevance;

escalation conditions.

PM should surface when relevant:

CURRENT TASK STATE
COLLABORATION MODE
ASSURANCE MODE
DESIGN LOCK STATUS
PLANNER REQUIRED
SKILLS TO USE
SKILLS NOT TO LOAD
PARALLEL DISPATCH

12. Parallelism

Prefer parallel work for independent read-heavy tasks.

Do not serialize independent sibling explorers unnecessarily.

Parallel writers require proof of:

non-overlapping file ownership;

stable interfaces;

no sequential dependency;

no shared schema/auth/business-invariant conflict;

integration verification.

Never concurrently edit:

same file;

Prisma schema/migration;

auth rules;

shared contracts;

shared business invariants.

13. Explorer — graph-first, source-confirmed

Explorer is READ ONLY.

CRG is navigation/blast-radius evidence, not source of truth.

Evaluate availability separately:

PRIMARY THREAD
EXPLORER/SUBAGENT RUNTIME

Possible states:

A. primary yes + explorer yes
B. primary yes + explorer no
C. primary no  + explorer yes
D. neither

Do not convert "explorer cannot call CRG" into "CRG unavailable globally."

When healthy/fresh CRG is callable from any allowed runtime, use a targeted graph query before broad scanning where graph evidence is useful.

State B required pattern:

PRIMARY calls CRG
→ passes targeted evidence
→ EXPLORER source-confirms

Source priority:

actual source
locked project docs
schema/migrations
real tests/results
> CRG

If source contradicts CRG:

SOURCE WINS

Do not automatically rebuild/update/watch CRG merely to inspect code.

Fallback to targeted rg/search/read when CRG is unavailable, stale, incomplete, or insufficient.

Explorer result should be concise:

ENTRYPOINTS
AFFECTED FILES
CALLERS / CONSUMERS
IMPORTANT DEPENDENCIES
DATA FLOW
AUTH / UNIT SCOPE
SCHEMA IMPACT
REUSE CANDIDATES
BLAST RADIUS
SOURCE-CONFIRMED FACTS
UNCERTAINTIES
CRG USED
CRG CALLER
CRG STATUS

Never invent CRG evidence.

14. Architect routing

Use architect for material:

cross-module architecture;

auth architecture;

schema/data architecture;

external integration;

source-of-truth decisions;

lifecycle semantics;

shared abstractions;

substantial refactors.

Architect distinguishes:

FACT
INFERENCE
DECISION
UNKNOWN

Architect owns design judgment, not detailed implementation planning.

Return:

DESIGN LOCK STATUS: LOCKED | BLOCKED

15. Implementation planner

Invoke only after material design decisions are locked.

Strong triggers:

Large/Critical features;

3+ dependent tasks;

schema/migration;

auth-sensitive cross-file work;

external integrations;

multiple implementation owners;

complex MANUAL APPLY order;

persistent multi-session feature.

Planner consistency gate:

1. requirement coverage
2. dependency topology
3. cross-cutting coverage
4. ownership collision
5. verification coverage
6. manual-apply order audit

Planner must not invent business/product decisions.

For persistent features:

design lock
→ implementation plan
→ numbered tasks/packets

16. Frontend routing

Use project patterns first.

Relevant skills:

heroui-react
zod
zustand
vercel-composition-patterns

Choose one primary visual skill by default rather than stacking all of them.

Project uses HeroUI v3.
Do not assume old NextUI/HeroUI APIs.

Project uses Next.js 16.2.x.
For version-specific behavior, inspect installed/current docs when available.

Before creating reusable UI abstractions, inspect:

src/hooks/
src/components/
relevant page-local _components/

Avoid duplicate abstractions.

17. Backend / Prisma routing

Relevant skills:

zod
prisma-client-api
prisma-cli
prisma-database-setup

Examples:

query/relation/transaction → prisma-client-api
schema + migration         → prisma-client-api + prisma-cli
provider/DATABASE_URL      → prisma-database-setup

Do not load every Prisma skill automatically.

For API/server/database work:

authenticate before protected access;

authorize before data access/mutation;

validate input;

validate IDs against authorized scope;

use bounded pagination;

prefer explicit Prisma select/include;

use transactions for multi-write invariants;

preserve audit logging when required;

treat imports/uploads/external APIs as trust boundaries;

do not expose secrets or unnecessary internal errors.

18. Review relevance

Reviewers are not ceremonial.

Typical relevance:

Simple copy/style:
  code reviewer      NO
  security reviewer  NO
  tester             NO

Local UI:
  code reviewer      OPTIONAL
  security reviewer  NO
  tester             OPTIONAL

Business-rule helper:
  code reviewer      assurance phase
  focused tests      YES
  security reviewer  usually NO

Complex schema/migration:
  code/migration review  YES
  data-integrity checks  YES

Auth/SSO/authorization:
  code reviewer      YES at assurance phase
  security reviewer  YES
  tester             YES

Untrusted import/external input:
  code reviewer      YES
  security reviewer  when trust boundary matters
  tester             YES

Under deferred assurance, broad review is normally deferred to the relevant milestone.

19. Security reviewer

Use when integrated changes materially affect:

authentication;

authorization;

role/scope;

SSO;

sessions/tokens;

IDOR/BOLA;

privileged state;

untrusted input;

uploads/imports;

sensitive data;

trust boundaries;

secrets.

Do not use security reviewer as a style reviewer.

20. Debugging

For difficult/non-obvious failures:

symptom
→ evidence
→ reproducible feedback loop
→ hypothesis
→ smallest discriminating check
→ root cause
→ correct implementation owner
→ fix
→ verification

Use debugger after retry rules require it or when root-cause investigation is genuinely needed.

Do not send trivial syntax errors to debugger.

21. Token-efficient assurance

Follow .codex/TOKEN-EFFICIENT-ASSURANCE.md.

A — CONTROLLED BUILD

implementation/proposal
→ cheap deterministic validation

No full reviewer roster by default under deferred assurance.

B — LIGHT APPLIED VERIFICATION

After user manually applies:

inspect affected actual files
→ compare with validated handoff
→ smallest relevant deterministic check

Do not automatically repeat every reviewer.

C — INTEGRATED ASSURANCE

At meaningful milestone:

design/plan conformance
+ code review
+ security review when relevant
+ focused integration tests
+ lint/typecheck/build

Re-run broad assurance only when:

material mismatch exists;

deterministic validation fails;

user added extra code;

new risk/evidence appears;

milestone is reached;

user asks.

22. Subagent assignment contract

Every implementation assignment must explicitly include:

COLLABORATION MODE
ASSURANCE MODE
CURRENT TASK STATE
OWNER
SCOPE
FILES / INTERFACES OWNED
FILES / INTERFACES NOT TO CHANGE
EXPECTED BEHAVIOR
SKILLS
VALIDATION
STOP / ESCALATION CONDITION

In MANUAL APPLY, also include:

DO NOT MODIFY THE REAL REPOSITORY.
PROPOSAL AUTHORING ONLY.
FINAL OUTPUT MUST SATISFY AGENTS.md SECTION 4 AND 5.

Missing collaboration mode must not be interpreted as AUTO.

Reviewers/debugger must not opportunistically edit product code.

23. Authorization and Unit hierarchy

Roles:

ADMIN
PIC
VIEWER

Unit hierarchy:

DIVISI
KANTOR_WILAYAH
KANTOR_CABANG

Authorization must be server-side.

Client IDs/filters are never proof of authorization.

PIC/VIEWER must not escape authorized Unit scope through request parameters.

Unless locked requirements explicitly replace it:

Kanwil → Kancab cascading
Divisi ↔ mutually exclusive with Kanwil/Kancab

These rules apply to both client state and server validation.

24. Compliance formula

Per program/unit:

(approved_submissions / program.frequency) * 100

Filter all programs:

average percentages across active programs

Filter one program:

that program's percentage

Status:

On Track >= 50
Behind 25–49
At Risk < 25

Over-achievement is allowed.
Do not clamp to 100%.

25. Employee / User / Pentaho / PIC / Participation — locked context

Before work in this feature family, Section 0 bootstrap is mandatory.

Locked target behavior lives in:

.codex/context/employee-pentaho-design-lock.md
.codex/context/employee-pentaho-implementation-plan.md

Current repository source controls current paths, patterns, and applied evidence.

Do not reopen deferred Pentaho endpoint/auth/transport details unless they genuinely block the CURRENT task.

Core distinctions:

Employee = HR/Pentaho employee master/facts
User     = application account + authorization

Do not conflate:

employment active
source presence
application account status

PIC eligibility is derived centrally.
Do not store a duplicate independent PIC-eligibility boolean.

Employee.unitId is HR/current placement.
User.unitId is explicit application authorization scope.

HR unit movement must not silently reassign application authorization.

Historical participation denominators/snapshots remain frozen according to locked design.

Normal Pentaho synchronization must not hard-delete historical records.

Participation task boundary

For participation work, respect numbered ownership:

Task 7 → first snapshot
Task 8 → correction + audit
Task 9 → workbook import/export

Do not pull Task 8 overwrite/audit semantics into Task 7.
Do not pull Task 9 workbook redesign into Task 7 unless required by the already-locked Task 7 contract.

When Task 7 is current:

preview ≠ frozen denominator
first successful commit = frozen denominator + provenance
existing same-period snapshot ≠ silent overwrite

Known errors explicitly assigned to the current task are no longer baseline noise once that task starts.

26. Task checkpoint discipline

When a task reaches APPLIED_VERIFIED:

record the checkpoint in the user-facing state;

do not continue to the next numbered task unless explicitly instructed;

preserve future-task notes without implementing them;

classify unrelated known errors according to their owning future task.

If the user says the task was pushed/committed, treat that as a checkpoint fact but do not infer CI success unless verified.

When asked only for a checkpoint:

confirm state
record known environment limitations
preserve deferred notes
STOP

Do not inspect the next task.

27. Final completion gate

Before claiming integrated implementation complete, use verification-before-completion.

Baseline:

npm run lint
npx tsc --noEmit
npm run build

plus relevant focused/integration tests.

For bug fixes:
verify original symptom.

For auth/API/database:
verify changed security/business behavior.

For UI:
verify relevant interaction/state when tooling permits.

Do not treat as completion evidence:

reviewer says LGTM;

engineer says DONE;

lint alone passes;

stale checks from before later edits.

If a required check cannot run, report it as unverified or as a proven environment failure; do not fabricate PASS.

In MANUAL APPLY:

proposal PASS
!=
applied repository PASS

In deferred assurance:

per-task deterministic validation PASS
!=
integrated assurance PASS

Integrated completion requires the assurance phase appropriate to the implemented risk surface.

28. User-facing response discipline

For engineering task status, be explicit and internally consistent.

Do not say:

PROPOSAL_READY

then provide only a high-level plan.

Do not say:

TARGETED MANUAL EDIT SET: COMPLETE

unless every required exact edit is present in the response.

Do not claim a subagent/tool was used unless it actually ran.

Do not claim repository modifications in MANUAL APPLY.

Do not claim real repository verification from scratch validation.

When the user has asked for exact code, prefer deterministic copy-pasteable output over narrative explanation.

When a persistent task is complete, stop at the requested boundary instead of opportunistically starting the next task.

<!-- END:ai-agent-rules -->