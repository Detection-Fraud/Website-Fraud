<!-- BEGIN:ai-agent-rules -->

# CRITICAL DIRECTIVES BEFORE WRITING ANY CODE

1. NEXT.JS CONVENTIONS: This is NOT the Next.js you know. This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. You MUST read the relevant guide in `node_modules/next/dist/docs/` before writing or modifying any Next.js code. Heed all deprecation notices.

2. UI COMPONENTS (HEROUI): For any user interface elements, you MUST consult the configured HeroUI MCP server (`heroui-react`). Do NOT rely on your internal training data for NextUI/HeroUI. You must use the available MCP tools (such as `get_component_docs`, `list_components`, or `get_component_source_code`) to fetch the exact v3 documentation, props, and code examples before writing or suggesting any UI code.
<!-- END:ai-agent-rules -->
