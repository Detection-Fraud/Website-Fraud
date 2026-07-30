/**
 * Maps a user role to their corresponding dashboard path.
 */
export function getDashboardByRole(role: string): string {
  switch (role) {
    case "ADMIN":
      return "/admin/dashboard";
    case "PIC":
      return "/pic/halaman-utama";
    case "VIEWER":
      return "/viewer/dashboard";
    default:
      return "/login";
  }
}
