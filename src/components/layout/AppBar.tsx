import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import Image from "next/image";
import DropdownUser from "./DropdownUser";


export default async function AppBar() {
  const session = await auth();

  const userDetail = await prisma.user.findUnique({
    where: { id: session?.user?.id },
    include: {
      region: true,
      branch: true,
      division: true,
    },
  });

  return (
    <header className="w-full shadow-sm shadow-gray-200 sticky top-0 z-50 border-b bg-white">
      <div className="max-w-7xl mx-auto flex items-center py-3 md:py-4 justify-between px-4 sm:px-6 lg:px-8 xl:px-20">
        <div className="flex flex-row gap-4">
          <Image
            src={"/assets/images/logo-bulog-full.png"}
            alt="Logo"
            width={100}
            height={100}
            className="md:w-30 w-12 sm:w-16"
          />
          <div className="flex flex-col justify-center">
            <h1 className="text-sm sm:text-md md:text-xl font-bold text-gray-900 leading-tight">
              BULOG Fraud Detection
            </h1>
            <p className="text-xs text-gray-600 hidden md:block">
              Sistem Deteksi Keaslian Foto Kegiatan
            </p>
          </div>
        </div>
        <div>
          <DropdownUser user={userDetail} />
        </div>
      </div>
    </header>
  );
}
