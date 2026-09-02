---
name: subagent-driven-development
description: Use when executing a scoped implementation plan through specialized subagents with clear ownership, review, and verification.
---

# Subagent-Driven Development

Project-local adaptation of obra/superpowers `subagent-driven-development` for the Website-Fraud agent roster.

## Core principle

Fresh focused implementation context + explicit ownership + review + verification beats one giant all-purpose coding thread.

## Entry requirements

Use this skill only after project_manager has a concrete scope. For non-trivial unfamiliar work, exploration must already have mapped the relevant code. If the work changes architecture, architect must provide the approved design boundaries first.

## Implementation loop

For each planned implementation task:

1. Select the correct owner:
   - frontend_engineer for pages/components/hooks/store/HeroUI/client behavior.
   - backend_engineer for route handlers/actions/Prisma/Zod/auth/server logic/integrations.
   - another temporary specialist only when project_manager has justified one.
2. Give the owner a self-contained brief containing scope, relevant existing patterns, contracts, business rules, files it owns, files it must not touch, and expected verification.
3. The implementation agent reads the assigned area before editing, makes the smallest defensible change, runs focused validation, and returns a concise report.
4. Review the task result before moving on when the next task depends on its contract or behavior.
5. If findings require fixes, return them to the appropriate implementation owner rather than allowing reviewers/debuggers to edit opportunistically.
6. After all implementation tasks, run broad validation with code_reviewer, security_reviewer when relevant, and tester.

## Writer concurrency rule

Default to controlled/sequential implementation. Do not dispatch multiple implementation writers in parallel when they may touch the same file, shared type, API contract, schema, auth rule, or business invariant.

Parallel writers are allowed only when project_manager explicitly establishes that:
- tasks are independent,
- file ownership does not overlap,
- shared contracts are already stable,
- neither writer depends on the other's output,
- integration can be verified afterward.

## Scope discipline

Implementation agents must not:
- redesign unrelated areas,
- introduce duplicate hooks/components/services/types,
- change shared architecture without architect approval,
- silently broaden permissions or data scope,
- fix unrelated failures unless project_manager re-scopes the task.

## Escalation

- Concrete runtime/build/test failure -> debugger first for root cause.
- Unexpected architecture/schema/auth requirement -> project_manager re-scope, then architect if needed.
- Security-sensitive discovery -> security_reviewer and project_manager.
- New materially distinct domain -> project_manager may spawn a temporary specialist.

## Completion

An implementation agent saying DONE is not completion. The parent must apply `verification-before-completion` with fresh evidence before claiming the overall work is complete.
