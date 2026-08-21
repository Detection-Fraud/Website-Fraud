import { Metadata } from "next";
import ProgramsView from "./_components/ProgramsView";

export const metadata: Metadata = {
  title: "Master Program Budaya",
  description:
    "Kelola daftar program budaya, frekuensi target, dan periode triwulan",
};

export default function ProgramsPage() {
  return <ProgramsView />;
}
