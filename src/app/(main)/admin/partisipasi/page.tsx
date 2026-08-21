import { Metadata } from "next";
import ImportPartisipasiView from "./_components/ImportPartisipasiView";

export const metadata: Metadata = {
  title: "Import Persentase Partisipasi",
  description: "Upload data persentase partisipasi per unit kerja untuk program budaya tipe partisipasi",
};

export default function ImportPartisipasiPage() {
  return <ImportPartisipasiView />;
}