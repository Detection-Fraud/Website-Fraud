<!-- BEGIN:ai-agent-rules -->

# Website-Fraud — Codex Multi-Agent Operating Rules

## 1. Operating model

For meaningful engineering work, follow this lifecycle:

`TRIAGE -> EXPLORE -> RE-SCOPE -> ARCHITECT IF NEEDED -> IMPLEMENT -> SCOPE CHECK -> REVIEW/TEST -> DEBUG/FIX IF NEEDED -> FINAL VERIFY`

The primary Codex thread is the orchestrator. `project_manager` owns scope, routing, dependencies, agent selection, skill selection, and temporary-specialist spawn decisions. Specialist agents own bounded work only.

Do not spawn the whole roster and do not load every installed skill for every request. Use the smallest set of agents and skills that materially improves correctness, speed, safety, or clarity.

## 2. Mandatory workflow skills

The user-level Codex setup is expected to provide these upstream skills:

- `dispatching-parallel-agents`
- `subagent-driven-development`
- `verification-before-completion`

These are normally installed under the user skill scope (for example `$HOME/.agents/skills`) rather than duplicated inside this repository.

Important: Codex does not merge same-name skills from different scopes. Do not add repo-local copies with the same names unless there is an intentional reason to expose two separate skills.

If one of the mandatory skills is unavailable, follow the equivalent workflow rules in this AGENTS.md, state that the named skill was unavailable, and never claim that it was invoked.

`verification-before-completion` is mandatory before ANY claim that code work is complete, fixed, passing, ready, or safe to hand off.

## 3. Agent roster

- `project_manager` — READ ONLY. Scope/risk classification, evidence-based routing, task graph, skill routing, dependencies, writer ownership, parallelism, and spawn decisions.
- built-in `explorer` — READ ONLY. Map existing code, dependencies, patterns, data flow, components/hooks, routes, schema, auth, and affected files.
- `architect` — READ ONLY. Cross-module design, reuse, contracts, boundaries, migration implications, risks, and ownership.
- `frontend_engineer` — WRITER. Next.js pages/components, HeroUI, hooks, Zustand, forms, charts, client behavior, responsiveness, accessibility.
- `backend_engineer` — WRITER. Route handlers/actions, Prisma/Postgres, Zod, auth/server business logic, uploads/imports, external integrations.
- `security_reviewer` — READ ONLY. Auth/authz, role/Unit scope, IDOR/BOLA, SAML/JWT, validation, upload/import, secrets, sensitive data, trust boundaries.
- `code_reviewer` — READ ONLY. Correctness, regressions, types/contracts, edge cases, maintainability, reuse, missing tests/validation.
- `tester` — validation runner. Fresh focused checks plus broader lint/typecheck/build/tests. Does not fix implementation.
- `debugger` — READ ONLY by default. Concrete-failure root-cause investigation and correct-owner recommendation.

## 4. Project-manager two-pass routing

For non-trivial work, `project_manager` SHOULD run in two passes.

### Pass A — initial triage

Classify:
- Complexity: Small / Medium / Large / Critical
- Risk: Low / Medium / High

Identify:
- knowns,
- unknowns,
- affected domains,
- minimum exploration required,
- whether requirements are clear enough to execute.

### Pass B — evidence-based re-scope

After exploration, build the real task graph from repository evidence. Define:
- affected domains,
- required agents,
- required skills per task/agent,
- overlapping skills that should NOT be loaded,
- dependencies,
- writer ownership,
- parallel vs sequential work,
- spawn conditions,
- completion gate.

The PM output should include `SKILLS TO USE` and, when overlap is likely, `SKILLS NOT TO LOAD`.

## 5. Project-management skill routing

Do not use planning/ideation skills automatically just because they are installed.

- `dispatching-parallel-agents` — use when 2+ domains are genuinely independent; strongest fit is read-heavy exploration, independent review/testing, or unrelated failure investigation.
- `subagent-driven-development` — use after scope is concrete to execute bounded implementation tasks through fresh specialist contexts and review.
- `writing-plans` — Large/Critical multi-stage work only. Skip for routine small/medium changes when the PM task graph is sufficient.
- `brainstorming` — genuinely open-ended product/design ideation or greenfield creative work only. Never use for mechanical implementation.
- `grill-me` — conditional/manual requirements interrogation. Use when the user explicitly requests a stress-test/interview, or when a major product/architecture request is materially ambiguous enough that implementation would otherwise be guesswork. Do NOT use for clear bugs, CRUD, small UI changes, or complete specs.
- `find-skills` — only when a materially distinct capability is genuinely missing from the current roster/skills.

## 6. Explore before editing

Never modify unfamiliar non-trivial code immediately.

Before implementation identify:
- existing architecture and neighboring feature patterns,
- reusable components/hooks/types/stores/helpers,
- frontend data flow,
- API/server data flow,
- Prisma/schema relationships,
- auth/role/Unit scope,
- affected files and shared contracts.

Parallel exploration is encouraged only for genuinely independent domains, for example:
- UI/pages/components/hooks/store,
- API/Zod/Prisma/data flow,
- auth/authorization/Unit scoping.

The built-in `explorer` is preferred. When `code-review-graph` tooling is actually installed/available, route it to explorer for dependency/blast-radius mapping when that will reduce broad scans. A downloaded SKILL.md alone does not prove its CLI/MCP/graph backend is operational.

Exploration agents are read-only.

## 7. Architect skill routing

Use `architect` when work involves cross-module architecture, major schema/migration design impact, auth/authorization architecture, new external integrations, major data flows, shared abstractions, or major refactors.

Architect skill selection:
- `code-review-graph` — dependency/blast-radius evidence when graph tooling is available.
- `vercel-composition-patterns` — React component API/composition architecture.
- `improve-codebase-architecture` — explicit architecture audits or substantial refactors only; not routine features.
- `ponytail` — optional simplicity/YAGNI lens. It may challenge needless abstraction but must not override real business/product requirements.

Architect must explicitly state when no architecture change is needed.

## 8. Frontend skill routing

Base rules:
- Use `heroui-react` when modifying HeroUI components/APIs.
- Use `zod` when frontend validation or shared schema contracts are affected.
- Use `zustand` when client/global state architecture is affected.
- Use `vercel-composition-patterns` when component API/composition is the actual design problem.

### Visual-design routing — choose ONE primary visual skill by default

- New UI / new visual direction -> `design-taste-frontend`
- Existing UI redesign/improvement -> `redesign-existing-projects`
- UX/information architecture/accessibility/dashboard/chart design research -> `ui-ux-pro-max`
- Design tokens/Tailwind systemization/shared visual primitives -> `tailwind-design-system`

Do not automatically stack `design-taste-frontend`, `redesign-existing-projects`, `ui-ux-pro-max`, and `tailwind-design-system` on one normal frontend task.

Framework/domain skills such as `heroui-react`, `zod`, or `zustand` may accompany the selected visual skill when genuinely relevant.

## 9. Backend and Prisma skill routing

Use:
- `zod` — validation and schema contracts.
- `prisma-client-api` — normal Prisma Client queries, relations, transactions, select/include, type-safe data access.
- `prisma-cli` — migrations, generate, db push/pull, migration/status, other Prisma CLI workflows.
- `prisma-database-setup` — database provider, DATABASE_URL, connection/setup/troubleshooting only.

Do not load every Prisma skill for every backend task.

Examples:
- Change a `findMany` query -> `prisma-client-api`
- Add a Prisma field + migration -> `prisma-client-api` + `prisma-cli` (+ `zod` if API contracts change)
- Fix DATABASE_URL/provider connectivity -> `prisma-database-setup`

## 10. Review and diagnostic skill routing

- `security_reviewer` -> `security-review` as primary rubric; optionally `code-review-graph` if dependency evidence helps.
- `code_reviewer` -> `code-review` as primary rubric; optionally `code-review-graph` for blast radius and `ponytail` for unnecessary complexity.
- `tester` -> `verification-before-completion` plus repository validation commands.
- `debugger` -> start evidence-first; use `code-review-graph` only when useful, then a domain skill specifically routed by PM.
- Performance issue -> PM may spawn a temporary `performance_investigator` and route `performance` to it.

Do not make `security_reviewer` a generic style reviewer. Do not let `code_reviewer` substitute for a dedicated security review when the task is security-sensitive.

## 11. Temporary specialists

PM may spawn an additional temporary specialist only when a materially distinct domain is discovered and existing agents would become too broad.

Examples:
- SAML specialist,
- performance investigator,
- accessibility reviewer,
- migration specialist,
- integration specialist.

Do not create novelty agents for ordinary files/components such as a button agent, modal agent, table agent, or pagination agent.

## 12. Parallelism and writer ownership

Prefer parallel agents for:
- independent read-heavy exploration,
- independent triage,
- code review,
- security review,
- testing,
- unrelated failure investigation.

Default implementation writers to controlled/sequential execution.

Parallel writers are allowed only when `project_manager` explicitly proves:
- non-overlapping file ownership,
- stable interfaces/contracts,
- no sequential dependency,
- no shared schema/auth/business invariant conflict,
- an integration verification step exists.

Never let two writer agents concurrently edit the same file, Prisma schema/migration, auth rule, shared type/contract, or business invariant.

## 13. Subagent-driven implementation

Use `subagent-driven-development` once scope is understood.

Each implementation assignment must provide:
- one clear owner,
- bounded scope,
- relevant existing patterns to reuse,
- selected skills,
- files/interfaces owned,
- files/interfaces that must not change,
- expected behavior,
- focused validation.

Reviewers and debugger must not opportunistically modify product code. Findings go back to the correct implementation owner unless the parent explicitly reassigns ownership.

If implementation, review, or debugging reveals a new architecture/security/domain requirement, return to `project_manager` for re-scope rather than silently broadening the task.

## 14. Next.js conventions

This project uses Next.js `16.2.x`. Version-specific APIs and conventions may differ from older training knowledge.

Before changing version-specific Next.js behavior, inspect the relevant installed docs under `node_modules/next/dist/docs/` when available and follow repository patterns/current deprecations.

## 15. HeroUI conventions

This project uses HeroUI v3.

For HeroUI components, use `heroui-react` and configured HeroUI documentation/MCP when available. Do not assume legacy NextUI/HeroUI APIs. Reuse existing project HeroUI patterns first.

## 16. No duplicate hooks/components

Before creating a hook or reusable component, scan:
- `src/hooks/`,
- `src/components/`,
- relevant page-local `_components/`.

If similar functionality exists, reuse or extend it. Do not create duplicate abstractions merely to finish the task.

## 17. Authorization and Unit hierarchy

The application uses roles `ADMIN`, `PIC`, and `VIEWER`, with Unit hierarchy including `DIVISI`, `KANTOR_WILAYAH`, and `KANTOR_CABANG`.

Authorization MUST be enforced server-side. Client-supplied IDs/filters are never proof of access.

When changing queries or filters, explicitly verify that PIC/VIEWER cannot escape their authorized Unit scope through request parameters.

## 18. Cascading wilayah filter rule

Any page/API that uses wilayah filters must preserve this behavior unless an approved architecture change replaces it:
- Kanwil -> Kancab is cascading; Kancab options depend on selected Kanwil.
- Divisi and Kanwil/Kancab are mutually exclusive.
- Selecting Divisi clears/disables Kanwil and Kancab.
- Selecting Kanwil/Kancab clears/disables Divisi as appropriate.
- The rule applies to UI state AND server/API validation.

## 19. Compliance formula

The compliance calculation used across Reports and Calendar follows this exact rule unless requirements explicitly change it:
- Per program per unit: `(approved_submissions / program.frequency) * 100`
- Average per unit when filter = all: average compliance percentage across all active programs.
- Average per unit when filter = one program: that program's compliance percentage only.
- Status threshold: On Track >= 50%; Behind = 25–49%; At Risk < 25%.
- Over-achievement is allowed; submissions may produce compliance > 100%.

Do not silently change this formula or clamp percentages to 100%.

## 20. Backend safety rules

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

## 21. Review and validation phase

After meaningful implementation, independent validation SHOULD run in parallel where relevant:
- `code_reviewer`,
- `security_reviewer` when risk warrants it,
- `tester`.

If a failure is reported:
1. route concrete failure evidence to `debugger`,
2. identify root cause and correct owner,
3. route fix to `frontend_engineer`, `backend_engineer`, or another justified owner,
4. re-run affected review/verification.

## 22. Final completion gate

Apply `verification-before-completion` before completion claims.

For code changes, discover available scripts first. Normal repository baseline:

```bash
npm run lint
npx tsc --noEmit
npm run build
```

Also run relevant focused tests/regression checks when available or added.

For bug fixes, verify the original symptom. For API/auth/database changes, verify changed authorization/business behavior where tooling permits. For UI behavior, verify the changed interaction/state when runtime/browser tooling is available.

A reviewer saying `LGTM`, an implementation agent reporting `DONE`, lint passing alone, or a previous command from before the last edit is not completion evidence.

If a required check cannot be run, explicitly report what remains unverified and do not imply full verification.

<!-- END:ai-agent-rules -->
