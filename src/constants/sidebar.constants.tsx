import { CgFileDocument } from "react-icons/cg";
import { MdOutlinePendingActions, MdOutlineShowChart } from "react-icons/md";
import { PiCalendar, PiImage, PiNotebookLight } from "react-icons/pi";
import { RxDashboard } from "react-icons/rx";

import { AiOutlineScan } from "react-icons/ai";
import { BiCategory } from "react-icons/bi";
import { FaRegUser } from "react-icons/fa6";

export interface SidebarMenuItem {
  key: string;
  label: string;
  href?: string;
  icon: React.ReactNode;
  hasBadge?: boolean;
  children?: SidebarMenuChild[];
}

export interface SidebarMenuChild {
  key: string;
  label: string;
  href: string;
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
    key: "user-management",
    label: "Manajemen User",
    icon: <FaRegUser />,
    children: [
      {
        key: "management",
        label: "Daftar Culture Catalyst",
        href: "/admin/management",
      },
      {
        key: "import",
        label: "Import Karyawan",
        href: "/admin/import",
      },
    ],
  },
  {
    key: "manage-program",
    label: "Manajemen Program",
    icon: <BiCategory />,
    children: [
      {
        key: "categories",
        label: "Daftar Category",
        href: "/admin/categories",
      },
      {
        key: "program-budaya",
        label: "Program Budaya",
        href: "/admin/programs",
      },
    ],
  },

  {
    key: "kalendar",
    label: "Kalendar",
    href: "/admin/kalendar",
    icon: <PiCalendar />,
  },
  {
    key: "banners",
    label: "Banner Login",
    href: "/admin/banners",
    icon: <PiImage />,
  },
];

export const SidebarMenuPIC: SidebarMenuItem[] = [
  {
    key: "halaman-utama",
    label: "Halaman Utama",
    href: "/pic/halaman-utama",
    icon: <RxDashboard />,
  },
  {
    key: "dashboard",
    label: "Dashboard",
    href: "/pic/dashboard",
    icon: <CgFileDocument />,
    hasBadge: true,
  },
  {
    key: "submit",
    label: "Submit (Cek AI)",
    href: "/pic/submit",
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
