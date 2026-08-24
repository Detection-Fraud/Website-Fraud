"use client";

import AppBar from "@/components/layout/Appbar";
import PaginationFooter from "@/components/ui/PaginationFooter";
import SafeImage from "@/components/ui/SafeImage";
import {
  useDownloadPicCollage,
  usePicCollageGallery,
  usePicCollageOptions,
} from "@/hooks/usePicCollage";
import type { CollagePhotoItem } from "@/types/collage.types";
import {
  Button,
  Card,
  Label,
  ListBox,
  Modal,
  Select,
  Skeleton,
  Spinner,
} from "@heroui/react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  FiAlertCircle,
  FiChevronLeft,
  FiChevronRight,
  FiDownload,
  FiImage,
  FiMapPin,
} from "react-icons/fi";

const dateFormatter = new Intl.DateTimeFormat("id-ID", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

function parsePage(value: string | null) {
  const page = Number(value);
  return Number.isInteger(page) && page > 0 ? page : 1;
}

function GallerySkeleton() {
  return (
    <div
      className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3"
      aria-label="Memuat foto"
    >
      {Array.from({ length: 12 }, (_, index) => (
        <Card
          key={index}
          className="overflow-hidden rounded-2xl border border-slate-200/60 bg-white p-0"
        >
          <Skeleton className="aspect-4/3 w-full rounded-none" />
          <Card.Content className="space-y-3 p-4">
            <Skeleton className="h-4 w-4/5 rounded-lg" />
            <Skeleton className="h-3 w-3/5 rounded-lg" />
          </Card.Content>
        </Card>
      ))}
    </div>
  );
}

function PhotoLightbox({
  photos,
  index,
  onChange,
  onClose,
}: {
  photos: CollagePhotoItem[];
  index: number | null;
  onChange: (index: number) => void;
  onClose: () => void;
}) {
  const photo = index === null ? null : photos[index];

  useEffect(() => {
    if (!photo || index === null) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "ArrowLeft" && index > 0) onChange(index - 1);
      if (event.key === "ArrowRight" && index < photos.length - 1)
        onChange(index + 1);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [index, onChange, photo, photos.length]);

  return (
    <Modal>
      <Modal.Backdrop
        variant="blur"
        isOpen={Boolean(photo)}
        onOpenChange={(open) => !open && onClose()}
      >
        <Modal.Container size="cover">
          <Modal.Dialog className="overflow-hidden rounded-2xl bg-slate-950 p-0 text-white">
            <Modal.CloseTrigger className="z-20 bg-slate-900/80 text-white" />
            {photo && (
              <>
                <Modal.Body className="p-0">
                  <div className="relative aspect-video w-full bg-slate-950">
                    <SafeImage
                      fill
                      src={photo.imageUrl}
                      alt={`Foto ${photo.report.activityName}`}
                      sizes="(max-width: 1280px) 100vw, 1280px"
                      className="object-contain"
                      fallbackIconClassName="size-12 text-slate-500"
                    />
                    <Button
                      isIconOnly
                      aria-label="Foto sebelumnya"
                      variant="secondary"
                      isDisabled={index === 0}
                      onPress={() => onChange(index! - 1)}
                      className="absolute left-3 top-1/2 min-h-11 min-w-11 -translate-y-1/2"
                    >
                      <FiChevronLeft aria-hidden="true" />
                    </Button>
                    <Button
                      isIconOnly
                      aria-label="Foto berikutnya"
                      variant="secondary"
                      isDisabled={index === photos.length - 1}
                      onPress={() => onChange(index! + 1)}
                      className="absolute right-3 top-1/2 min-h-11 min-w-11 -translate-y-1/2"
                    >
                      <FiChevronRight aria-hidden="true" />
                    </Button>
                  </div>
                </Modal.Body>
                <Modal.Footer className="flex-col items-start gap-1 border-t border-white/10 px-5 py-4">
                  <p className="font-semibold text-white">
                    {photo.report.activityName}
                  </p>
                  <p className="text-sm text-slate-300">
                    {dateFormatter.format(
                      new Date(photo.report.tanggalKegiatan),
                    )}{" "}
                    | {photo.report.lokasi}
                  </p>
                </Modal.Footer>
              </>
            )}
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}

export default function PicCollageView() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const categoryId = searchParams.get("categoryId") || "";
  const programId = searchParams.get("programId") || "";
  const page = parsePage(searchParams.get("page"));
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const optionsQuery = usePicCollageOptions();
  const galleryQuery = usePicCollageGallery(programId, page);
  const downloadMutation = useDownloadPicCollage();
  const programs = useMemo(
    () =>
      optionsQuery.data?.programs.filter(
        (program: any) => program.category.id === categoryId,
      ) ?? [],
    [categoryId, optionsQuery.data?.programs],
  );
  const selectedProgram = optionsQuery.data?.programs.find(
    (program: any) => program.id === programId,
  );

  const replaceParams = (changes: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString());
    Object.entries(changes).forEach(([key, value]) => {
      if (value) params.set(key, value);
      else params.delete(key);
    });
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, {
      scroll: false,
    });
  };

  const handlePageChange = (nextPage: number) => {
    replaceParams({ page: String(nextPage) });
    document.getElementById("collage-grid")?.scrollIntoView({ block: "start" });
  };

  const photos = galleryQuery.data?.items ?? [];
  const pagination = galleryQuery.data?.pagination;

  return (
    <div className="mb-10 space-y-6">
      <AppBar
        showAddButton={false}
        title="Kolase Foto"
        description="Foto kegiatan budaya yang sudah disetujui untuk unit kerja Anda"
      />

      <Card className="rounded-2xl border border-slate-200/60 bg-white shadow-sm">
        <Card.Header>
          <Card.Title className="text-base font-semibold text-slate-900">
            Pilih program
          </Card.Title>
          <Card.Description className="text-sm text-slate-500">
            Program hanya tersedia jika unit Anda mempunyai foto approved.
          </Card.Description>
        </Card.Header>
        <Card.Content className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] md:items-end">
          <Select
            aria-label="Pilih kategori"
            placeholder="Pilih kategori"
            value={categoryId}
            isDisabled={optionsQuery.isLoading || optionsQuery.isError}
            onChange={(value) =>
              replaceParams({
                categoryId: String(value || ""),
                programId: null,
                page: "1",
              })
            }
          >
            <Label>Kategori</Label>
            <Select.Trigger>
              <Select.Value />
              <Select.Indicator />
            </Select.Trigger>
            <Select.Popover>
              <ListBox>
                {(optionsQuery.data?.categories ?? []).map((category: any) => (
                  <ListBox.Item
                    key={category.id}
                    id={category.id}
                    textValue={category.name}
                  >
                    {category.name}
                    <ListBox.ItemIndicator />
                  </ListBox.Item>
                ))}
              </ListBox>
            </Select.Popover>
          </Select>

          <Select
            aria-label="Pilih program budaya"
            placeholder={categoryId ? "Pilih program" : "Pilih kategori dahulu"}
            value={programId}
            isDisabled={!categoryId || programs.length === 0}
            onChange={(value) =>
              replaceParams({ programId: String(value || ""), page: "1" })
            }
          >
            <Label>Program Budaya</Label>
            <Select.Trigger>
              <Select.Value />
              <Select.Indicator />
            </Select.Trigger>
            <Select.Popover>
              <ListBox>
                {programs.map((program: any) => (
                  <ListBox.Item
                    key={program.id}
                    id={program.id}
                    textValue={program.name}
                  >
                    {program.name}
                    <ListBox.ItemIndicator />
                  </ListBox.Item>
                ))}
              </ListBox>
            </Select.Popover>
          </Select>

          <Button
            variant="primary"
            isDisabled={!programId}
            isPending={downloadMutation.isPending}
            onPress={() => downloadMutation.mutate(programId)}
            className="min-h-11 whitespace-nowrap"
          >
            {({ isPending }) => (
              <>
                {isPending ? (
                  <Spinner color="current" size="sm" />
                ) : (
                  <FiDownload />
                )}{" "}
                {isPending ? "Menyiapkan PDF" : "Download PDF"}
              </>
            )}
          </Button>
        </Card.Content>
      </Card>

      {optionsQuery.isError && (
        <Card className="rounded-2xl border border-red-200 bg-red-50">
          <Card.Content className="flex items-center justify-between gap-4 text-red-800">
            <div className="flex items-center gap-3">
              <FiAlertCircle />
              <span>Gagal memuat pilihan program.</span>
            </div>
            <Button variant="outline" onPress={() => optionsQuery.refetch()}>
              Coba lagi
            </Button>
          </Card.Content>
        </Card>
      )}

      {downloadMutation.isError && (
        <p role="alert" className="text-sm font-medium text-red-700">
          PDF gagal dibuat. Silakan coba lagi.
        </p>
      )}

      {selectedProgram && pagination && (
        <Card className="rounded-2xl border border-blue-100 bg-blue-50/70 shadow-none">
          <Card.Content className="grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <p className="text-xs text-slate-500">Program</p>
              <p className="font-semibold text-slate-900">
                {selectedProgram.name}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Triwulan</p>
              <p className="font-semibold text-slate-900">
                TW {selectedProgram.tw ?? "-"}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Periode</p>
              <p className="font-semibold text-slate-900">
                {dateFormatter.format(new Date(selectedProgram.startDate))} -{" "}
                {dateFormatter.format(new Date(selectedProgram.endDate))}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Foto approved</p>
              <p className="font-semibold text-slate-900">
                {pagination.total} foto
              </p>
            </div>
          </Card.Content>
        </Card>
      )}

      {!programId && !optionsQuery.isError && (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
          <FiImage className="mx-auto mb-3 size-8 text-slate-400" />
          <p className="font-semibold text-slate-800">
            Pilih kategori dan program
          </p>
          <p className="mt-1 text-sm text-slate-500">
            Foto approved akan ditampilkan setelah program dipilih.
          </p>
        </div>
      )}

      {programId && galleryQuery.isLoading && <GallerySkeleton />}

      {programId && galleryQuery.isError && (
        <div
          role="alert"
          className="rounded-2xl border border-red-200 bg-red-50 px-6 py-12 text-center"
        >
          <FiAlertCircle className="mx-auto mb-3 size-8 text-red-500" />
          <p className="font-semibold text-red-900">Galeri gagal dimuat</p>
          <Button
            className="mt-4"
            variant="outline"
            onPress={() => galleryQuery.refetch()}
          >
            Coba lagi
          </Button>
        </div>
      )}

      {programId && galleryQuery.isSuccess && photos.length === 0 && (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
          <FiImage className="mx-auto mb-3 size-8 text-slate-400" />
          <p className="font-semibold text-slate-800">
            Belum ada foto approved
          </p>
          <p className="mt-1 text-sm text-slate-500">
            Foto akan muncul setelah laporan disetujui Admin.
          </p>
        </div>
      )}

      {photos.length > 0 && (
        <>
          <div
            id="collage-grid"
            className="scroll-mt-24 grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3"
          >
            {photos.map((photo: any, index: number) => (
              <Card
                key={photo.id}
                className="overflow-hidden rounded-2xl border border-slate-200/60 bg-white p-0 shadow-sm"
              >
                <button
                  type="button"
                  onClick={() => setLightboxIndex(index)}
                  className="group relative aspect-4/3 w-full cursor-zoom-in overflow-hidden bg-slate-100 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                  aria-label={`Buka foto ${photo.report.activityName}`}
                >
                  <SafeImage
                    fill
                    src={photo.imageUrl}
                    alt={`Kegiatan ${photo.report.activityName}`}
                    sizes="(max-width: 767px) 100vw, (max-width: 1279px) 50vw, 33vw"
                    className="object-cover transition-transform duration-200 group-hover:scale-[1.02]"
                    fallbackIconClassName="size-9 text-slate-400"
                  />
                </button>
                <Card.Content className="space-y-2 p-4">
                  <p className="line-clamp-2 font-semibold text-slate-900">
                    {photo.report.activityName}
                  </p>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                    <span>
                      {dateFormatter.format(
                        new Date(photo.report.tanggalKegiatan),
                      )}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <FiMapPin />
                      {photo.report.lokasi}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">
                    PIC: {photo.report.picName}
                  </p>
                </Card.Content>
              </Card>
            ))}
          </div>

          {pagination && (
            <PaginationFooter
              page={pagination.page}
              totalPages={pagination.totalPages}
              totalItems={pagination.total}
              itemsPerPage={pagination.limit}
              itemLabel="foto"
              onPageChange={handlePageChange}
            />
          )}
        </>
      )}

      <PhotoLightbox
        photos={photos}
        index={lightboxIndex}
        onChange={setLightboxIndex}
        onClose={() => setLightboxIndex(null)}
      />
    </div>
  );
}
