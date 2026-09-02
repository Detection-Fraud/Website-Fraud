---
name: dispatching-parallel-agents
description: Use when 2 or more independent tasks can be investigated, reviewed, tested, or summarized without shared mutable state or sequential dependencies.
---

# Dispatching Parallel Agents

Project-local adaptation of obra/superpowers `dispatching-parallel-agents` for Website-Fraud.

## Core principle

Dispatch one agent per independent problem domain and let them work concurrently. Do not parallelize merely because multiple agents exist.

## Preferred uses

Use parallel agents for read-heavy or non-conflicting work such as:
- codebase exploration across independent domains,
- frontend/API/auth mapping,
- independent failure triage,
- code review + security review + testing,
- documentation or dependency verification,
- independent log/test analysis.

## Do not parallelize when

- one task depends on another task's result,
- agents need shared mutable state,
- two writers may edit the same file or shared contract,
- a single root cause may explain multiple failures,
- architecture or scope is still unclear enough that parallel work would duplicate effort.

## Workflow

1. Identify independent domains.
2. Give each subagent a self-contained scope, relevant evidence, constraints, and expected output.
3. Dispatch independent agents concurrently.
4. Wait for all required results.
5. Reconcile findings and check for conflicts before implementation or integration.
6. Run integrated verification after changes are combined.

## Website-Fraud defaults

For non-trivial unfamiliar features, prefer parallel exploration such as:
- explorer: relevant pages/components/hooks/store,
- explorer: API/routes/Zod/Prisma/data flow,
- explorer: auth/role/Unit scope when relevant.

After implementation, code_reviewer, security_reviewer when relevant, and tester may run in parallel because they are non-writing validation roles.

Parallel write-heavy implementation is NOT the default. project_manager may permit it only when ownership is explicit, contracts are stable, and files/interfaces do not overlap.

## Prompt contract

Every parallel subagent prompt should state:
- one bounded problem domain,
- files/areas to inspect when known,
- whether editing is forbidden,
- relevant constraints/business rules,
- expected concise output,
- whether the main agent must wait for sibling agents before continuing.
