import { Metadata } from "next";
import PicView from "./_components/PicView";

export const metadata: Metadata = {
  title: "Dashboard PIC ",
  description:
    "Status pengajuan laporan kegiatan budaya dan target triwulanan unit kerja Anda.",
};
export default function PagePic() {
  return (
    <div className="w-full ">
      <PicView />
    </div>
  );
}
