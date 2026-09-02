<!-- BEGIN:ai-agent-rules -->

# Website-Fraud — Codex Multi-Agent Operating Rules

## 1. Core operating model

For meaningful engineering work, follow this lifecycle:

`TRIAGE -> EXPLORE -> RE-SCOPE -> ARCHITECT IF NEEDED -> IMPLEMENT -> SCOPE CHECK -> REVIEW/TEST -> DEBUG/FIX IF NEEDED -> FINAL VERIFY`

The primary Codex thread is the orchestrator. `project_manager` owns scope, routing, dependencies, and spawn decisions. Specialist agents own bounded work only.

Do not spawn the whole roster for every request. Use the smallest set of agents that materially improves correctness, speed, or safety.

## 2. Mandatory orchestration skills

The following project skills define the default workflow and MUST be applied when relevant:

- `.agents/skills/dispatching-parallel-agents/SKILL.md`
- `.agents/skills/subagent-driven-development/SKILL.md`
- `.agents/skills/verification-before-completion/SKILL.md`

`verification-before-completion` is mandatory before ANY claim that code work is complete, fixed, passing, or ready.

## 3. Agent roster and responsibilities

- `project_manager` — READ ONLY. Classify complexity/risk, define exploration, re-scope from evidence, choose agents, build the task graph, define dependencies/file ownership, and decide when temporary specialists are needed.
- built-in `explorer` — READ ONLY. Map existing code, patterns, data flow, components/hooks, routes, schema, auth, and affected files before unfamiliar changes.
- `architect` — READ ONLY. Decide how cross-module or architectural changes fit the existing system; define contracts, reuse, boundaries, risks, and ownership.
- `frontend_engineer` — WRITER. Next.js UI/pages/components/HeroUI/hooks/store/forms/charts/client behavior.
- `backend_engineer` — WRITER. Route handlers/actions/Prisma/Postgres/Zod/auth/server business logic/uploads/imports/external integrations.
- `security_reviewer` — READ ONLY. Auth/authz, role and Unit scope, IDOR/BOLA, SAML/JWT, validation, upload/import, secrets, sensitive data, and external trust boundaries.
- `code_reviewer` — READ ONLY. Correctness, regression, type safety, edge cases, maintainability, reuse, and missing validation/tests.
- `tester` — validation runner. Run focused checks and broader lint/typecheck/build/tests; report evidence, do not fix implementation.
- `debugger` — READ ONLY by default. Investigate concrete failures and identify root cause/owner before fixes are delegated.

## 4. Project-manager routing rules

For non-trivial tasks, `project_manager` SHOULD run in two passes:

### Pass A — initial triage
Classify Small / Medium / Large / Critical and Low / Medium / High risk. Identify unknowns and the minimum exploration required.

### Pass B — evidence-based re-scope
After exploration returns, build the actual task graph from repository evidence. Define:
- affected domains,
- required agents,
- dependencies,
- writer ownership,
- parallel vs sequential work,
- spawn conditions,
- completion gate.

Use `architect` for cross-module architecture, Prisma schema/migrations, auth/authorization architecture, new external integrations, new major data flows, shared abstractions, or major refactors.

Use `security_reviewer` when auth, role/Unit access, APIs with sensitive scoping, SAML/JWT, uploads/imports, secrets, external services, or sensitive data are affected.

Use `debugger` only when there is concrete failure evidence or unexpected runtime behavior.

Temporary specialists may be spawned only when a materially distinct domain is discovered and existing agents are insufficient (for example: database specialist, SAML specialist, performance investigator, accessibility reviewer, integration specialist). Do not create novelty agents for ordinary files/components.

## 5. Explore before editing

Never modify unfamiliar non-trivial code immediately.

Before implementation, inspect the relevant existing code and identify:
- existing architecture and neighboring feature patterns,
- reusable components/hooks/types/stores/helpers,
- frontend data flow,
- API/server data flow,
- Prisma/schema relationships,
- auth/role/Unit scope,
- affected files and shared contracts.

Parallel exploration is encouraged when domains are genuinely independent. Typical split:
- UI/pages/components/hooks/store,
- API/Zod/Prisma/data flow,
- auth/authorization/Unit scoping.

Exploration agents are read-only.

## 6. Parallelism and write ownership

Use `.agents/skills/dispatching-parallel-agents/SKILL.md` for independent work.

Prefer parallel agents for read-heavy exploration, independent triage, code review, security review, testing, and summarization.

Default implementation writers to controlled/sequential execution. Parallel writers are allowed only when `project_manager` has explicitly established non-overlapping file ownership, stable interfaces, no sequential dependency, and a clear integration verification step.

Never allow two writer agents to concurrently edit the same file, Prisma schema/migration, auth rule, shared type/contract, or business invariant.

## 7. Subagent-driven implementation

Use `.agents/skills/subagent-driven-development/SKILL.md` once scope is understood.

Each implementation task must have:
- one clear owner,
- bounded scope,
- relevant existing patterns to reuse,
- files/interfaces it owns,
- files/interfaces it must not change,
- expected behavior,
- focused validation.

Reviewers and debugger must not opportunistically fix product code. Findings go back to the appropriate implementation owner unless the parent explicitly reassigns ownership.

## 8. Next.js conventions

This project uses Next.js `16.2.x`. Version-specific APIs and conventions may differ from older training knowledge.

Before changing Next.js behavior, inspect the relevant installed documentation under `node_modules/next/dist/docs/` when available. Follow current deprecations and repository patterns rather than assuming older App Router behavior.

## 9. HeroUI conventions

This project uses HeroUI v3.

For HeroUI components, consult the configured HeroUI MCP/documentation when available. Do not assume legacy NextUI/HeroUI APIs. Reuse existing project HeroUI patterns first.

## 10. No duplicate hooks/components

Before creating a new hook or reusable component, scan `src/hooks/`, `src/components/`, and the relevant page-local `_components/` directory.

If similar functionality exists, reuse or extend it. Do not create a duplicate abstraction merely to complete the task. Implementation reports should mention important reuse decisions.

## 11. Authorization and Unit hierarchy

The application uses roles `ADMIN`, `PIC`, and `VIEWER`, with Unit hierarchy semantics including `DIVISI`, `KANTOR_WILAYAH`, and `KANTOR_CABANG`.

Authorization MUST be enforced server-side. Client-supplied IDs/filters must never be treated as proof that a user may access another Unit's data.

When changing queries or filters, explicitly verify that PIC/VIEWER cannot escape their authorized Unit scope through request parameters.

## 12. Cascading wilayah filter rule

Any page/API that uses wilayah filters must preserve this behavior unless an approved architecture change explicitly replaces it:

- Kanwil -> Kancab is cascading; Kancab options depend on selected Kanwil.
- Divisi and Kanwil/Kancab are mutually exclusive.
- Selecting Divisi clears/disables Kanwil and Kancab.
- Selecting Kanwil/Kancab clears/disables Divisi as appropriate.
- The rule applies to UI state AND server/API validation.

## 13. Compliance formula

The compliance calculation used across Reports and Calendar follows this exact rule unless requirements explicitly change it:

- Per program per unit: `(approved_submissions / program.frequency) * 100`
- Average per unit when filter = all: average compliance percentage across all active programs.
- Average per unit when filter = one program: that program's compliance percentage only.
- Status threshold: On Track >= 50%; Behind = 25–49%; At Risk < 25%.
- Over-achievement is allowed; submissions may produce compliance > 100%.

Do not silently change this formula or clamp percentages to 100%.

## 14. Backend safety rules

For API/server/database work:
- authenticate and authorize before data access/mutation,
- validate inputs using existing Zod patterns,
- validate IDs against authorized scope,
- use bounded pagination,
- prefer explicit Prisma select/include,
- use transactions for multi-write invariants,
- preserve audit logging when the feature records actions,
- treat uploads/imports and the external Python fraud API as trust boundaries,
- never expose API keys/secrets or unnecessary internal error details.

## 15. Review and validation phase

After implementation, independent validation SHOULD run in parallel where relevant:
- `code_reviewer`,
- `security_reviewer`,
- `tester`.

If a failure is reported, delegate root-cause analysis to `debugger`, then route the fix to the appropriate implementation owner. Re-run affected review/verification after the fix.

## 16. Final completion gate

Apply `.agents/skills/verification-before-completion/SKILL.md` before completion claims.

For code changes, discover available scripts first. The normal repository baseline is:

```bash
npm run lint
npx tsc --noEmit
npm run build
```

Also run relevant focused tests/regression checks when available or added.

A reviewer saying "LGTM", an implementation agent reporting "DONE", or lint passing alone is not completion evidence. If a required check cannot be run, report that limitation explicitly and do not imply full verification.

<!-- END:ai-agent-rules -->
