<!-- BEGIN:ai-agent-rules -->

# CRITICAL DIRECTIVES BEFORE WRITING ANY CODE

1. NEXT.JS CONVENTIONS: This is NOT the Next.js you know. This version
   has breaking changes — APIs, conventions, and file structure may all
   differ from your training data. You MUST read the relevant guide in
   `node_modules/next/dist/docs/` before writing or modifying any
   Next.js code. Heed all deprecation notices.

2. UI COMPONENTS (HEROUI): For any user interface elements, you MUST
   consult the configured HeroUI MCP server (`heroui-react`). Do NOT
   rely on your internal training data for NextUI/HeroUI. You must use
   the available MCP tools (such as `get_component_docs`,
   `list_components`, or `get_component_source_code`) to fetch the
   exact v3 documentation, props, and code examples before writing or
   suggesting any UI code.

3. PROJECT CONTEXT & SKILLS: At the start of every session, you MUST
   read `.agents/skills/SKILL.md` for project overview, tech stack,
   and critical global rules. Then apply the relevant skill based on
   the task:
   - Database queries → always apply `prisma-safe-query`
   - API routes → always apply `api-backend-guard`
   - Dashboard / analytics → apply `dashboard-analytics`
   - Repository / export / user management → apply `repository-dan-export`
   - Kalender kegiatan → apply `calendar-kegiatan` (jika sudah ada)

4. NO DUPLICATE HOOKS OR COMPONENTS: Before creating any new hook or
   component, you MUST scan the entire `hooks/` and `components/`
   directory first. If a hook or component with similar functionality
   already exists, reuse or extend it — do NOT create a duplicate.
   Report what you found before writing any code.

5. CASCADING WILAYAH FILTER RULE: Any page that has a wilayah filter
   MUST follow this pattern — it is used consistently across Reports,
   Repository, and Calendar pages:
   - Kanwil → Kancab is cascading (Kancab options load after Kanwil
     is selected)
   - Divisi and Kanwil/Kancab are MUTUALLY EXCLUSIVE — selecting
     Divisi must clear and disable Kanwil & Kancab, and vice versa
   - This rule applies to both UI state AND API validation

6. COMPLIANCE FORMULA: The compliance calculation used across Reports
   and Calendar pages follows this exact formula — do NOT deviate:
   - Per program per unit:
     `(approved_submissions / program.frekuensi) * 100`
   - Avg per unit (filter = semua):
     `AVG(compliance % across all active programs)`
   - Avg per unit (filter = 1 program):
     `compliance % of that program only`
   - Status threshold: On Track ≥ 50% | Behind 25–49% | At Risk < 25%
   - Over-achieve = submissions > frekuensi (boleh melebihi 100%)

<!-- END:ai-agent-rules -->
