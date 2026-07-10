export const ROLE_DISPLAY_LABELS: Record<string, string> = {
  ADMIN: "Administrator",
  PIC: "Culture Catalyst",
  VIEWER: "Viewer",
};

export const ROLE_SHORT_LABELS: Record<string, string> = {
  ADMIN: "Admin",
  PIC: "CC",
  VIEWER: "Viewer",
};

export function getRoleLabel(role: string, short = false): string {
  const map = short ? ROLE_SHORT_LABELS : ROLE_DISPLAY_LABELS;
  return map[role] ?? role;
}


