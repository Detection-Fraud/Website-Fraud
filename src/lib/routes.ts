/**
 * Maps a user role to their corresponding dashboard path.
 */
export function getDashboardByRole(role: string): string {
  switch (role) {
    case "ADMIN":
      return "/admin/approval";
    case "PIC":
      return "/pic/dashboard";
    case "VIEWER":
      return "/viewer/dashboard";
    default:
      return "/login";
  }
}
