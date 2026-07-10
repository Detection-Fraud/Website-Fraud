import { CgFileDocument } from "react-icons/cg";
import { MdOutlinePendingActions, MdOutlineShowChart } from "react-icons/md";
import { PiCalendar, PiFile, PiNotebookLight } from "react-icons/pi";
import { RxDashboard } from "react-icons/rx";

import { AiOutlineScan } from "react-icons/ai";
import { FaRegUser } from "react-icons/fa6";

export interface SidebarMenuItem {
  key: string;
  label: string;
  href: string;
  icon: React.ReactNode;
  hasBadge?: boolean;
}
export const SidebarMenuAdmin: SidebarMenuItem[] = [
  {
    key: "dashboard",
    label: "Dashboard",
    href: "/admin/dashboard",
    icon: <RxDashboard />,
  },
  {
    key: "analytics",
    label: "Analytics",
    href: "/admin/analytics",
    icon: <MdOutlineShowChart />,
  },
  {
    key: "approved",
    label: "Approve",
    href: "/admin/approval",
    icon: <MdOutlinePendingActions />,
  },
  {
    key: "reports",
    label: "Laporan",
    href: "/admin/reports",
    icon: <PiNotebookLight />,
  },
  {
    key: "import",
    label: "Import Karyawan",
    href: "/admin/import",
    icon: <PiFile />,
  },
  {
    key: "management",
    label: "Management",
    href: "/admin/management",
    icon: <FaRegUser />,
  },
  {
    key: "program-budaya",
    label: "Program Budaya",
    href: "/admin/programs",
    icon: <PiNotebookLight />,
  },
  {
    key: "kalendar",
    label: "Kalendar",
    href: "/admin/kalendar",
    icon: <PiCalendar />,
  },
];

export const SidebarMenuPIC: SidebarMenuItem[] = [
  {
    key: "dashboard",
    label: "Dashboard",
    href: "/pic/dashboard",
    icon: <RxDashboard />,
  },
  {
    key: "approval",
    label: "Approval",
    href: "/pic/approval",
    icon: <CgFileDocument />,
    hasBadge: true,
  },
  {
    key: "detection",
    label: "Deteksi",
    href: "/pic/detection",
    icon: <AiOutlineScan />,
  },
  {
    key: "reports",
    label: "Laporan",
    href: "/pic/reports",
    icon: <PiNotebookLight />,
  },
  {
    key: "kalendar",
    label: "Kalendar",
    href: "/pic/kalendar",
    icon: <PiCalendar />,
  },
];
