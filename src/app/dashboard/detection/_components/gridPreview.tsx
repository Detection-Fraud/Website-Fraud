"use client";

import { useReportStore } from "@/store/useReportStore";
import { Card, Button, Chip } from "@heroui/react";
import { IoMdClose } from "react-icons/io";

export default function GridPreview() {
  const { images, removeImage } = useReportStore();

  if (images.length === 0) return null;

  return (
    <div className="w-full mt-8">
      <h3 className="text-lg font-semibold mb-4 text-gray-700">
        Preview Gambar ({images.length})
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {images.map((item) => (
          <Card
            key={item.id}
            variant="default"
            className={`w-full overflow-hidden transition-colors duration-300 ${
              item.status === "FRAUD"
                ? "border-2 border-danger bg-danger-50"
                : item.status === "LULUS"
                  ? "border-2 border-success"
                  : "border-2 border-transparent"
            }`}
          >
            <Button
              isIconOnly
              variant="danger"
              size="sm"
              className="absolute top-2 right-2 z-20 rounded-full"
              onClick={() => removeImage(item.id)}
              aria-label="Hapus gambar"
            >
              <IoMdClose />
            </Button>

            <Card.Content className="p-0 relative">
              {item.status === "FRAUD" ? (
                <div className="flex flex-row w-full h-48 bg-gray-100">
                  <div className="w-1/2 relative h-full border-r-2 border-danger border-dashed">
                    <p className="absolute top-1 left-2 z-10 text-[10px] font-bold text-white bg-black/60 px-2 py-0.5 rounded">
                      Upload Kamu
                    </p>
                    <img
                      alt="Gambar Upload"
                      className="w-full h-full object-cover"
                      src={item.previewUrl}
                    />
                  </div>
                  <div className="w-1/2 relative h-full">
                    <p className="absolute top-1 left-2 z-10 text-[10px] font-bold text-white bg-danger/80 px-2 py-0.5 rounded">
                      Reference Image
                    </p>
                    <img
                      alt="Gambar Referensi"
                      className="w-full h-full object-cover"
                      src={
                        item.fraudRefUrl ||
                        "https://via.placeholder.com/300?text=Gambar+Referensi"
                      }
                    />
                  </div>
                </div>
              ) : (
                /* Tampilan Normal */
                <div className="relative w-full h-48 bg-gray-100 flex justify-center items-center">
                  <img
                    alt="Preview Gambar"
                    className={`w-full h-full object-cover transition-all duration-300 ${item.status === "LOADING" ? "blur-sm grayscale" : ""}`}
                    src={item.previewUrl}
                  />

                  {/* Animasi Loading Spinner di tengah gambar */}
                  {item.status === "LOADING" && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 z-10">
                      <div className="w-8 h-8 border-4 border-white border-t-transparent rounded-full animate-spin mb-2"></div>
                      <p className="text-white text-xs font-semibold tracking-wider">
                        MEMERIKSA...
                      </p>
                    </div>
                  )}
                </div>
              )}
            </Card.Content>

            {/* AREA FOOTER DENGAN DOT NOTATION HEROUI V3 */}
            <Card.Footer className="flex justify-between items-center py-3 border-t">
              <div className="flex flex-col truncate pr-2">
                <p className="text-sm font-semibold text-foreground truncate w-32 md:w-40">
                  {item.file.name}
                </p>
                <p className="text-xs text-muted">
                  {(item.file.size / 1024 / 1024).toFixed(2)} MB
                </p>
              </div>

              {/* Status Chip */}
              <Chip
                size="sm"
                variant={item.status === "IDLE" ? "primary" : "secondary"}
                color={
                  item.status === "LULUS"
                    ? "success"
                    : item.status === "FRAUD"
                      ? "danger"
                      : item.status === "LOADING"
                        ? "warning"
                        : "default"
                }
              >
                {item.status === "IDLE"
                  ? "Menunggu"
                  : item.status === "LOADING"
                    ? "Analisis AI"
                    : item.status === "LULUS"
                      ? "Aman"
                      : "Duplikat!"}
              </Chip>
            </Card.Footer>
          </Card>
        ))}
      </div>
    </div>
  );
}
