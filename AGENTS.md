<!-- BEGIN:ai-agent-rules -->

Website-Fraud — Codex Multi-Agent Operating Rules

1. Operating model

For meaningful engineering work, follow this lifecycle:

TRIAGE -> EXPLORE -> RE-SCOPE -> ARCHITECT IF NEEDED -> PLAN IF NEEDED -> IMPLEMENT/PROPOSE -> FOCUSED VALIDATE -> INTEGRATED ASSURANCE WHEN DUE -> DEBUG/FIX IF NEEDED -> FINAL VERIFY

The primary Codex thread is the orchestrator.

The primary thread owns:

actual subagent spawning,

waiting and coordination,

result synthesis,

workflow state,

collaboration-mode enforcement,

assurance-mode enforcement.

Role ownership:

project_manager owns normal scope, routing, dependencies, agent selection, skill selection, concurrency planning, and planner/architect routing.

deep_project_manager owns deep requirement/design discussion.

built-in explorer owns repository evidence gathering and dependency/blast-radius mapping.

architect owns material architecture/design judgment and design-lock status.

implementation_planner owns detailed executable implementation planning after design is locked.

implementation specialists own bounded implementation or proposal authoring.

reviewers/tester own independent assurance, not implementation.

debugger owns evidence-based root-cause investigation after concrete failures.

Do not spawn the whole roster.

Do not load every installed skill for every task.

Use the smallest set of agents and skills that materially improves correctness, speed, safety, or clarity.

2. Routing lanes

Repository-aware work has two primary reasoning lanes.

NORMAL ENGINEERING

Use for:

routine repository discussion,

implementation planning,

implementation,

MANUAL APPLY proposals,

bug fixing,

review,

verification.

Default flow:

Primary Codex
↓
project_manager
↓
explorer if repository evidence is needed
↓
architect if design judgment is genuinely needed
↓
implementation_planner if detailed planning is justified
↓
implementation owner

DEEP DISCUSSION

Use when:

the user explicitly requests DEEP DISCUSSION,

the desired architecture/flow is materially unknown,

the user wants assumptions aggressively challenged,

the user asks to identify blind spots/celah,

an early wrong decision would create substantial downstream rework.

Default flow:

Primary Codex
↓
deep_project_manager
├─ reasoning first
├─ max 2 read-only explorers when needed
└─ max 1 architect only if a distinct architecture problem remains

Do not invoke normal project_manager first when entering DEEP DISCUSSION.

Default Deep Discussion delegation budget:

deep_project_manager: 1

explorers: maximum 2

architect: maximum 1

Do NOT invoke by default during DEEP DISCUSSION:

implementation_planner

frontend_engineer

backend_engineer

migration_specialist

code_reviewer

security_reviewer

tester

debugger

Deep PM may use:

grilling

brainstorming

domain-modeling

only when relevant.

Technical questions that can be answered from repository evidence should not be pushed to the user.

Once design is locked, exit DEEP DISCUSSION and return to normal PM orchestration.

3. Collaboration modes

The active collaboration mode controls repository-write permission.

The mode MUST be explicitly preserved in implementation assignments.

If a non-trivial task has no resolvable collaboration mode, do NOT silently assume AUTO.

AUTO

Use when the user explicitly wants Codex to implement changes directly.

Implementation owners may modify repository files.

AUTO does NOT authorize:

production deployment,

production/shared DB mutation,

destructive database reset,

force push,

destructive Git operations,

secrets modification,

.env changes,

unless explicitly requested and authorized.

Review/testing remains relevance-based.

Do not automatically run every reviewer for every small task.

MANUAL APPLY

Use when Codex designs/writes implementation but the user applies product-code changes manually.

In MANUAL APPLY:

Codex and ALL subagents MUST NOT:

modify repository product files,

create repository product files,

delete repository product files,

rename repository product files,

move repository product files,

format repository product files,

apply patches to repository product files.

Implementation agents become proposal authors.

Their normal WRITER role does not grant repository write permission.

Allowed:

repository inspection,

read-only exploration,

dependency tracing,

design work,

exact proposal code,

isolated scratch proposal validation,

safe deterministic checks against scratch copies.

Scratch MUST live outside the real repository root.

Do not use a Git worktree as scratch if that would mutate real repository Git metadata.

Never mutate the real/shared database during MANUAL APPLY unless explicitly authorized.

MANUAL APPLY — DEFERRED ASSURANCE

This is the preferred controlled-build workflow when the user wants to inspect implementation code before allowing broad automatic fixing.

Purpose:

LOCKED DESIGN
↓
LOCKED IMPLEMENTATION PLAN
↓
Task N proposal
↓
cheap deterministic validation
↓
user manually applies
↓
next task
↓
...
↓
all implementation present
↓
INTEGRATED ASSURANCE
↓
AUTO REMEDIATION if findings exist

During each implementation task:

Use only agents required to understand and author the implementation.

Do NOT automatically invoke:

code_reviewer

security_reviewer

tester

for every task.

Use cheap deterministic validation instead.

Examples:

Prisma schema
→ prisma validate

TypeScript
→ focused compile / tsc

migration
→ static SQL safety scan

pure business helper
→ focused deterministic test/check

parser/import
→ scratch dry-run

frontend contracts
→ TypeScript compile

Cheap validation exists to prevent implementation errors from compounding across later tasks.

Deferred assurance does NOT mean permanent assurance skipping.

Security/code/test review MUST be performed during the appropriate integrated assurance phase.

INTEGRATED ASSURANCE

Use after a meaningful implementation set has been manually applied.

Integrated assurance evaluates the REAL repository.

Primary comparison:

LOCKED DESIGN

- IMPLEMENTATION PLAN
  ↓
  vs
  ↓
  ACTUAL REPOSITORY

Review two dimensions.

Implementation conformance

Verify:

every planned requirement exists,

implementation order/contracts match the plan,

no material requirement was skipped,

ownership boundaries are preserved,

business invariants remain correct,

architecture did not drift unnecessarily.

Engineering assurance

Verify:

correctness,

regression risk,

security,

authorization,

data integrity,

migration safety,

race/concurrency behavior where relevant,

integration behavior,

tests,

lint/typecheck/build.

Integrated findings should explain:

EXPECTED FROM PLAN/DESIGN:
<expected behavior>

ACTUAL CODE:
<actual behavior>

WHY THIS MATTERS:
<impact>

REQUIRED CORRECTION:
<fix direction>

EVIDENCE:
<file/symbol/test>

Do NOT mark missing implementation of a future/unstarted task as a defect.

AUTO REMEDIATION

Use after integrated assurance when the user explicitly wants Codex to fix concrete findings automatically.

AUTO REMEDIATION is narrower than greenfield AUTO implementation.

Expected inputs:

locked design

- implementation plan
- actual repository
- concrete findings

Flow:

collect findings
↓
group by dependency/owner
↓
fix concrete findings
↓
run affected checks
↓
re-review affected surfaces
↓
final integrated verification

AUTO REMEDIATION must not silently redesign locked product behavior.

If remediation exposes a genuine unresolved product/business decision, return that bounded decision to PM/architect/user.

Real/shared database mutation remains approval-gated.

REVIEW

Read-only repository inspection.

Do not modify product files.

Report findings.

Do not fix findings unless collaboration mode changes.

4. MANUAL APPLY output contract

Default output is SURGICAL.

Existing files

Use:

ADD

REPLACE

DELETE

RENAME

MOVE

For every operation provide:

exact path,

containing symbol when useful,

exact stable current-code anchor,

exact position,

exact replacement/addition code,

reason.

Example:

File:
src/example.ts

Action:
ADD

Containing symbol:
function example()

Find exact anchor:
const value = getValue();

Instruction:
ADD immediately after the anchor.

Apply code:
<exact code>

Do not rely only on line numbers.

If an anchor is ambiguous, expand it.

Never use:

...

rest unchanged

update accordingly

fake functions

guessed signatures.

New file

Use:

CREATE FILE
path/to/file.ts

Then provide COMPLETE file content.

Delete file

Use:

DELETE FILE
path/to/file.ts

Include evidence explaining why deletion is safe.

Unified diff

Do NOT use unified diff by default.

Use only when:

explicitly requested,

or surgical instructions would be materially less safe.

Full existing file

Do NOT output a full existing-file replacement by default.

Use only when:

explicitly requested,

or surgical editing would be materially less safe.

5. Proposal validation

Distinguish:

PROPOSAL VALIDATION
= validation performed against proposal/scratch before user applies

APPLIED REPOSITORY VERIFICATION
= validation performed against the real repository after manual application

Never claim applied verification from proposal/scratch validation.

A validated handoff must reconstruct the material proposal that was actually validated.

If emitted code changes after validation:

previous validation
→ STALE
→ revalidation required

Normal ready-state fields:

PROPOSAL VALIDATION: PASS
TARGETED MANUAL EDIT SET: COMPLETE
VALIDATED HANDOFF CONSISTENCY: PASS
APPLIED REPOSITORY VERIFICATION: NOT RUN

In MANUAL APPLY — DEFERRED ASSURANCE, this does NOT require code/security/tester subagent passes per task.

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

Hard rule:

Missing implementation for a NOT_STARTED task
≠
PROPOSAL_VALIDATION_FAILED

NOT_STARTED

No concrete implementation proposal exists yet.

Missing code is expected.

PROPOSAL_IN_PROGRESS

Inspection, authoring, or correction is currently happening.

A concrete corrected proposal may not exist yet.

PROPOSAL_VALIDATION_FAILED

Use ONLY when:

a concrete proposal exists for the CURRENT task,

validation/review actually ran,

that proposal materially failed.

PROPOSAL_READY

Use when required current proposal gates pass.

APPLIED_VERIFICATION_FAILED

Use when user applied a handoff but:

real repository materially differs,

or deterministic applied validation fails.

APPLIED_VERIFIED

Use when:

material repository state matches intended implementation,

required applied checks pass.

BLOCKED

Use only for genuine blockers such as:

missing current-task business decision,

inaccessible required repository evidence,

required external contract unavailable,

required infrastructure/tool unavailable with no safe fallback.

Do NOT use BLOCKED for:

normal proposal bugs,

future-task missing code,

deferred details irrelevant to current task.

7. Finding classification

Use:

BASELINE GAP
PROPOSAL DEFECT
APPLIED-STATE DEFECT
FUTURE-TASK CONSTRAINT
GENUINE BLOCKER

Default review scope:

active task

- already-applied prerequisites

Do NOT audit untouched future tasks as if they are already implemented.

8. Bounded retry

First substantial concrete proposal failure:

same owner
↓
ONE targeted evidence-based correction

If the corrected concrete proposal is actually produced and materially fails the SAME failure class again:

STOP equivalent retries
↓
debugger
↓
root cause

Then route:

Prisma/migration/existing-data issue
→ migration_specialist

genuine architecture/contract decision
→ architect

Do NOT count an interrupted/incomplete correction as the second failure if no corrected concrete proposal was produced and validated.

## 8A. Recoverable work must continue

`PROPOSAL_IN_PROGRESS` is an active workflow state, not a normal stopping condition.

For the CURRENT task, do not stop merely because:

- the proposal is not yet `PROPOSAL_READY`;
- a required validation step still needs to run;
- a recoverable proposal defect was found;
- a debugger/reviewer identified a root cause;
- a correction still needs to be returned to the implementation owner;
- handoff consistency has not yet been proven.

If the remaining work is actionable and does NOT require:

- a user/business/product decision;
- explicit approval for a risky/destructive action;
- unavailable external credentials/contracts/infrastructure;
- inaccessible required repository evidence;
- a required tool with no safe fallback;

then continue the same task in the same workflow.

Preferred continuation:

```text
proposal / validation
↓
recoverable defect
↓
correct implementation owner
↓
targeted correction
↓
required deterministic validation
↓
handoff consistency validation
↓
PROPOSAL_READY

9. Mandatory workflow skills

Expected workflow skills:

dispatching-parallel-agents

subagent-driven-development

verification-before-completion

Conditional skills include:

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

follow equivalent rules,

do not claim it was used.

10. Agent roster

Recommended allocation:

Primary Codex Luna medium

project_manager Terra medium
deep_project_manager Sol high
built-in explorer Luna medium
architect Sol high
implementation_planner Luna high

frontend_engineer Luna medium
backend_engineer Luna medium
migration_specialist Luna high

code_reviewer Luna medium
security_reviewer Terra high
tester Luna medium
debugger Terra high

project_manager

READ ONLY.

Owns:

scope,

risk classification,

routing,

high-level task graph,

skills,

ownership,

dependency planning,

assurance strategy,

concurrency planning.

deep_project_manager

READ ONLY.

Owns deep design/requirement reasoning.

built-in explorer

READ ONLY.

Owns repository understanding.

architect

READ ONLY.

Owns:

architecture,

contracts,

invariants,

boundaries,

design gaps,

design lock.

implementation_planner

READ ONLY.

Owns:

executable task ordering,

ownership,

dependencies,

interfaces,

validation,

assurance classification,

MANUAL APPLY order.

frontend_engineer

WRITER in AUTO.

Proposal author in MANUAL APPLY.

backend_engineer

WRITER in AUTO.

Proposal author in MANUAL APPLY.

migration_specialist

Dedicated DB/migration specialist.

Use for materially complex:

Prisma relations,

inverse relations,

referential actions,

migration ordering,

nullable → backfill → required,

preserving existing data,

unique/index rollout,

Decimal conversions,

SQL migration safety,

repeated migration failures.

Do not use for ordinary Prisma queries or trivial fields.

code_reviewer

READ ONLY.

security_reviewer

READ ONLY.

tester

Validation runner.

Does not fix implementation.

debugger

READ ONLY by default.

Owns root-cause investigation.

11. Project-manager routing

For non-trivial work PM should generally use:

Pass A
→ triage

Explorer
→ evidence

Pass B
→ evidence-based re-scope

Pass A identifies:

complexity,

risk,

current task state,

active collaboration mode,

assurance mode,

affected domains,

unknowns,

exploration requirement,

architecture requirement,

planner requirement.

Pass B identifies:

actual affected files/domains,

required agents,

required skills,

skills NOT to use,

ownership,

dependencies,

parallelism,

validation,

assurance relevance,

escalation conditions.

PM output should include when relevant:

CURRENT TASK STATE
COLLABORATION MODE
ASSURANCE MODE
DESIGN LOCK STATUS
PLANNER REQUIRED
SKILLS TO USE
SKILLS NOT TO LOAD
PARALLEL DISPATCH

12. Parallelism

Prefer parallel work for independent READ-heavy work.

Examples:

explorer frontend

- explorer backend
- explorer auth

when genuinely independent.

PM plans concurrency.

Primary thread performs actual spawning.

Do not serialize independent sibling agents unnecessarily.

Parallel writers require explicit proof of:

non-overlapping file ownership,

stable interfaces,

no sequential dependency,

no shared schema/auth invariant conflict,

integration verification.

Never concurrently edit:

the same file,

Prisma schema/migration,

auth rules,

shared contracts,

shared business invariants.

Concurrency limit is a limit, not a target.

13. Explorer — graph-first, source-confirmed

Explorer is READ ONLY.

The built-in Codex explorer is preferred for repository evidence gathering.

The graph-first policy is an ORCHESTRATION rule, not an assumption that every subagent runtime can directly call every MCP tool.

Before implementation, explorer should identify as relevant:

entrypoints,

architecture,

neighboring patterns,

reusable code,

callers,

consumers,

dependencies,

shared modules,

frontend data flow,

backend/API flow,

Prisma/schema relationships,

authorization flow,

shared contracts,

regression/blast-radius surface.

code-review-graph availability

The existence of:

.code-review-graphignore
SKILL.md
AGENTS.md rules
MCP listed as Enabled in UI

does NOT by itself prove that every current subagent runtime can directly call CRG.

CRG availability must be evaluated separately for:

PRIMARY THREAD
EXPLORER / SUBAGENT RUNTIME

Possible states:

A. Primary callable + Explorer callable
B. Primary callable + Explorer NOT callable
C. Primary NOT callable + Explorer callable
D. Neither callable

Do not collapse these states into a single global available/unavailable assumption.

Graph-first ownership

For non-trivial unfamiliar code where dependency/blast-radius evidence is useful, CRG should be used before broad recursive repository scanning whenever it is callable from ANY active allowed runtime.

State A — Primary callable + Explorer callable

Preferred flow:

primary thread
↓
decide CRG is useful
↓
explorer may call CRG directly
↓
targeted graph evidence
↓
minimal source reads
↓
source confirmation

The primary thread does not need to duplicate the same CRG query unless it needs separate orchestration evidence.

State B — Primary callable + Explorer NOT callable

This state is explicitly supported.

Explorer reporting:

CRG not callable from explorer runtime

MUST NOT be interpreted as:

CRG unavailable globally

Required flow:

PRIMARY THREAD
↓
call CRG first
↓
obtain targeted minimal context / callers / consumers / blast radius
↓
pass relevant graph evidence to explorer
↓
EXPLORER
↓
inspect actual source
↓
confirm / correct graph evidence
↓
return source-confirmed report

In this state, do NOT allow explorer to jump directly to a broad rg/recursive scan before the primary thread has attempted CRG.

The primary thread owns CRG MCP invocation when MCP access is only exposed there.

The explorer owns source confirmation.

State C — Primary NOT callable + Explorer callable

Explorer may call CRG directly.

Flow:

explorer
↓
targeted CRG query
↓
minimal source reads
↓
source confirmation

State D — Neither callable

Only in this state should normal fallback exploration be used immediately:

rg
targeted search
file reads
source tracing

Do not claim CRG was used.

CRG health / freshness

Being callable is not enough.

Before materially relying on CRG, use the available read-only CRG status/context evidence to determine whether the graph is healthy/fresh enough for the current repository state.

Useful evidence may include:

graph status is ok,

graph has non-empty nodes/edges/files,

graph build SHA matches current HEAD,

head_matches_build or equivalent is true,

current branch/HEAD corresponds to the graph being queried.

Do NOT hard-code expected graph counts or SHAs in repository rules.

If the graph is callable but materially stale for the current task:

CRG STATUS: STALE

Then use source-confirmed fallback as needed.

A normal code-inspection request does NOT automatically authorize graph rebuild/update.

Graph-first requirement

When CRG is callable from primary and/or explorer AND the graph is healthy/fresh enough:

Use a TARGETED graph query before broad repository scanning.

Preferred evidence:

minimal context around the requested symbol/file/route,

callers,

consumers,

dependencies,

relevant flows,

changed-file blast radius,

shared contracts/modules.

Avoid dumping the entire graph into model context.

The purpose of CRG is:

reduce search surface
NOT
replace source inspection

Graph output is not source of truth

Priority:

actual source code

- locked project docs
- schema/migrations
- real tests/results
  > CRG graph

Treat graph results as navigation/blast-radius evidence.

A missing graph edge does NOT prove no dependency exists.

Potential incomplete areas include:

dynamic dispatch,

generated code,

reflection,

runtime imports,

framework conventions,

external integrations,

shell/scripts.

Always confirm material conclusions against actual source.

Source-confirmation discipline

After CRG narrows the surface:

read the relevant real source files,

inspect important callers/consumers,

inspect relevant types/contracts/schema,

inspect tests when they materially clarify behavior,

reconcile graph evidence with repository reality.

If source contradicts CRG:

SOURCE WINS

Report the discrepancy when it affects planning or blast radius.

Missing/stale graph

A normal request to inspect code does NOT automatically authorize CRG graph maintenance.

Do NOT automatically run:

code-review-graph build

code-review-graph update

code-review-graph watch

graph post-processing,

semantic/cloud embedding jobs,

merely because explorer wants context.

Graph maintenance requires explicit permission or an established environment policy that authorizes it.

Do not automatically enable cloud/semantic embeddings because they may transmit source-derived text or incur external cost.

Fallback discipline

Fallback to rg/search/read is allowed when:

neither primary nor explorer can call CRG,

CRG is stale/unhealthy and maintenance is not authorized,

CRG does not cover the relevant dynamic/runtime behavior,

targeted graph evidence is insufficient and source inspection must expand.

Fallback should remain targeted.

Do not turn a CRG limitation into an unnecessary whole-repository scan.

Evidence handoff between primary and explorer

When the primary thread calls CRG on behalf of explorer, pass only the relevant evidence needed to narrow inspection.

Example handoff:

CRG EVIDENCE FROM PRIMARY

Entry point:
<file/symbol>

Likely affected files:
<files>

Callers / consumers:
<symbols/files>

Important dependencies:
<symbols/files>

Blast-radius notes:
<notes>

Graph status:
<healthy/stale evidence>

Explorer must independently confirm material conclusions from source.

Do NOT tell explorer to pretend it invoked CRG itself.

Explorer result format

Return concise evidence such as:

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

CRG USED: YES | NO

CRG CALLER:
PRIMARY | EXPLORER | BOTH | NONE

CRG STATUS:
HEALTHY | STALE | MISSING | UNAVAILABLE | NOT_NEEDED

Meaning:

CRG USED: YES

is allowed when CRG evidence was actually used by primary and/or explorer.

But CRG CALLER MUST identify who actually invoked it.

Never claim:

Explorer used CRG

when only the primary thread invoked the MCP tool.

Never invent CRG evidence.

14. Architect routing

Use architect for material:

cross-module architecture,

auth architecture,

schema/data architecture,

external integration,

source-of-truth decisions,

lifecycle semantics,

shared abstractions,

substantial refactors.

Skill selection may include:

code-review-graph
→ dependency/blast-radius evidence

codebase-design
→ module/interface/seam design

domain-modeling
→ domain semantics/invariants

grilling
→ genuine user decisions

vercel-composition-patterns
→ React composition architecture

Do not stack architecture skills unnecessarily.

Architect must distinguish:

FACT
INFERENCE
DECISION
UNKNOWN

Architect owns design judgment, not the detailed implementation plan.

Return:

DESIGN LOCK STATUS: LOCKED | BLOCKED

15. Implementation planner

Invoke only AFTER material design decisions are locked.

Strong triggers:

Large/Critical features,

3+ dependent tasks,

schema/migration work,

auth-sensitive cross-file work,

external integration,

multiple implementation owners,

complex MANUAL APPLY order,

persistent multi-session features.

Planner must perform:

PLAN CONSISTENCY GATE

1. requirement coverage
2. dependency topology
3. cross-cutting coverage
4. ownership collision
5. verification coverage
6. manual-apply order audit

Planner responsibilities:

preserve design lock,

order tasks,

assign owners,

identify files/interfaces,

define dependencies,

define validation,

define assurance relevance,

define milestone/final assurance,

define manual application order.

Planner MUST NOT invent product/business decisions.

If a design decision is missing:

return to PM / architect

For persistent features:

Deep PM / Architect
→ feature-design-lock.md

Implementation Planner
→ feature-implementation-plan.md

16. Frontend routing

Use:

heroui-react
→ HeroUI

zod
→ validation/contracts

zustand
→ client/global state

vercel-composition-patterns
→ component API/composition

Choose ONE primary visual skill by default:

new UI
→ design-taste-frontend

existing redesign
→ redesign-existing-projects

UX / accessibility / dashboard design
→ ui-ux-pro-max

Tailwind design system
→ tailwind-design-system

Do not stack every visual-design skill.

17. Backend / Prisma routing

Use:

zod
→ validation/contracts

prisma-client-api
→ queries, relations, transactions

prisma-cli
→ migration/schema/generate/status

prisma-database-setup
→ provider/connection/setup

Examples:

findMany change
→ prisma-client-api

schema + migration
→ prisma-client-api + prisma-cli

DATABASE_URL/provider problem
→ prisma-database-setup

Do not load every Prisma skill automatically.

18. Review relevance

Reviewers are NOT ceremonial.

Simple text/copy/style

Usually:

code reviewer: NO
security reviewer: NO
tester: NO

Local UI

Usually:

code reviewer: OPTIONAL
security reviewer: NO
tester: OPTIONAL

Business-rule helper

Usually:

code reviewer: YES at assurance phase
focused tests: YES
security reviewer: usually NO

Complex schema/migration

Usually:

code/migration review: YES
data-integrity checks: YES
security review: only when relevant

Auth / SSO / authorization

Required at assurance phase:

code reviewer: YES
security reviewer: YES
tester: YES

Imports / external untrusted input

Usually:

code reviewer: YES
security reviewer: YES when trust boundary matters
tester: YES

Under MANUAL APPLY — DEFERRED ASSURANCE, these are normally DEFERRED until integrated assurance.

19. Security reviewer

Security review is required when integrated changes materially affect:

authentication,

authorization,

role/scope,

SSO,

sessions/tokens,

IDOR/BOLA,

privileged state,

untrusted input,

uploads/imports,

sensitive data,

trust boundaries,

secrets.

Do not use security reviewer as a style reviewer.

20. Debugging

Use diagnosing-bugs for difficult/non-obvious failures.

Preferred flow:

symptom
↓
evidence
↓
reproducible feedback loop
↓
hypothesis
↓
smallest discriminating check
↓
root cause
↓
correct implementation owner
↓
fix
↓
verification

Use CRG only when dependency evidence helps.

Do not send every trivial syntax error to debugger.

21. Token-efficient assurance

Follow .codex/TOKEN-EFFICIENT-ASSURANCE.md when present.

Do not repeat expensive assurance without new evidence.

Normal phases:

A — CONTROLLED BUILD

implementation/proposal
↓
cheap deterministic validation

No full reviewer roster by default under deferred assurance.

B — LIGHT APPLIED VERIFICATION

After user manually applies:

inspect relevant actual files
↓
compare material handoff
↓
smallest relevant deterministic check

Do NOT automatically repeat:

code_reviewer

- security_reviewer
- tester

after every copied task.

C — INTEGRATED ASSURANCE

At implementation completion or meaningful milestone:

plan/design conformance

- code review
- security review when relevant
- integration tests
- lint/typecheck/build

Re-run broader assurance only when:

material mismatch exists,

deterministic verification fails,

user added extra code,

new evidence/risk appears,

milestone is reached,

user asks explicitly.

22. Subagent-driven implementation

Every implementation assignment must explicitly contain:

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

In MANUAL APPLY, the assignment MUST explicitly state:

DO NOT MODIFY THE REAL REPOSITORY.
PROPOSAL AUTHORING ONLY.

Missing mode must NOT be interpreted as AUTO.

Reviewers/debugger must not opportunistically modify product code.

23. Next.js

This project uses Next.js 16.2.x.

For version-specific behavior:

inspect installed Next.js docs when available,

follow current repository patterns,

do not rely on outdated Next.js training-memory behavior.

24. HeroUI

This project uses HeroUI v3.

When modifying HeroUI:

use heroui-react,

use configured documentation/MCP when operational,

do not assume old NextUI/HeroUI APIs,

reuse existing project patterns first.

25. No duplicate abstractions

Before creating reusable hooks/components scan:

src/hooks/
src/components/
relevant page-local \_components/

Reuse/extend existing patterns when suitable.

Do not create duplicate abstractions just to finish a task.

26. Authorization and Unit hierarchy

Roles:

ADMIN
PIC
VIEWER

Unit hierarchy includes:

DIVISI
KANTOR_WILAYAH
KANTOR_CABANG

Authorization MUST be enforced server-side.

Client IDs/filters are never proof of authorization.

Verify PIC/VIEWER cannot escape their authorized Unit scope through request parameters.

27. Cascading wilayah filters

Unless locked requirements explicitly replace the behavior:

Kanwil
→ Kancab cascading

Divisi
↔ mutually exclusive with Kanwil/Kancab

Selecting Divisi clears/disables Kanwil and Kancab.

Selecting Kanwil/Kancab clears/disables Divisi appropriately.

Rules apply to BOTH:

client UI state,

server validation.

28. Compliance formula

Per program/unit:

(approved_submissions / program.frequency) \* 100

Filter = all:

average percentages across active programs

Filter = one program:

that program's percentage

Status:

On Track >= 50
Behind = 25–49
At Risk < 25

Over-achievement is allowed.

Do NOT clamp percentage to 100%.

29. Backend safety

For API/server/database work:

authenticate before protected access,

authorize before data access/mutation,

validate input,

validate IDs against authorized scope,

use bounded pagination,

prefer explicit Prisma select/include,

use transactions for multi-write invariants,

preserve audit logging when required,

treat imports/uploads/external APIs as trust boundaries,

never expose secrets/unnecessary internal errors.

30. Locked Employee/User/Pentaho/PIC/Participation feature context

When present, read:

.codex/context/employee-pentaho-design-lock.md
.codex/context/employee-pentaho-implementation-plan.md
.codex/TASK-STATE-SEMANTICS.md
.codex/TOKEN-EFFICIENT-ASSURANCE.md
.codex/MANUAL-APPLY-RESPONSE-FORMAT.md

before re-opening design decisions or implementation planning.

Locked context controls TARGET behavior.

Current repository controls CURRENT paths/patterns/evidence.

Do not reopen deferred Pentaho endpoint/auth/transport details unless they genuinely block the CURRENT task.

Core distinction:

Employee
= HR/Pentaho employee master

User
= application account

Do not conflate:

employment active
source presence
application authorization

PIC eligibility must be derived centrally.

Do not store an independent PIC-eligibility boolean.

HR Unit movement must not silently reassign application authorization scope.

Historical participation denominators/snapshots must remain frozen according to locked design.

Normal Pentaho sync must not hard-delete historical records.

31. Final completion gate

Before claiming integrated implementation complete, use verification-before-completion.

Normal baseline:

npm run lint
npx tsc --noEmit
npm run build

Also run relevant focused/integration tests.

For bug fixes:

verify original symptom

For auth/API/database:

verify changed security/business behavior

For UI:

verify relevant interaction/state when tooling permits

Do NOT treat as completion evidence:

reviewer says LGTM,

engineer says DONE,

lint alone passes,

an old check from before later edits.

If a required check cannot run, report it as unverified.

In MANUAL APPLY:

proposal PASS
≠
applied repository PASS

In MANUAL APPLY — DEFERRED ASSURANCE:

per-task deterministic validation PASS
≠
integrated assurance PASS

Integrated completion requires the final assurance phase appropriate to the implemented risk surface.

<!-- END:ai-agent-rules -->
```
