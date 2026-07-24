import { Card, Pagination } from "@heroui/react";

interface PaginationFooterProps {
  page: number;
  totalPages: number;
  totalItems: number;
  itemsPerPage: number;
  onPageChange: (page: number) => void;
}
export default function PaginationFooter({
  page,
  totalPages,
  totalItems,
  itemsPerPage,
  onPageChange,
}: PaginationFooterProps) {
  if (totalPages <= 1) return null;

  const startItem = (page - 1) * itemsPerPage + 1;
  const endItem = Math.min(page * itemsPerPage, totalItems);

  const getPageNumbers = () => {
    const pages: (number | "ellipsis")[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      pages.push(1);
      if (page > 3) {
        pages.push("ellipsis");
      }

      const start = Math.max(2, page - 1);
      const end = Math.min(totalPages - 1, page + 1);

      for (let i = start; i <= end; i++) {
        pages.push(i);
      }

      if (page < totalPages - 2) {
        pages.push("ellipsis");
      }
      pages.push(totalPages);
    }

    return pages;
  };
  return (
    <Card className="shadow-sm border border-slate-100 rounded-2xl">
      <Pagination className="w-full flex flex-col sm:flex-row justify-between items-center gap-4">
        <Pagination.Summary className="text-xs sm:text-sm text-slate-500 text-center sm:text-left">
          Menampilkan{" "}
          <span className="font-semibold text-slate-700">
            {startItem}-{endItem}
          </span>{" "}
          dari{" "}
          <span className="font-semibold text-slate-700">{totalItems}</span>{" "}
          laporan
        </Pagination.Summary>

        <Pagination.Content className="order-1 sm:order-2 flex gap-1 items-center overflow-x-auto">
          <Pagination.Item>
            <Pagination.Previous
              isDisabled={page === 1}
              onPress={() => onPageChange(page - 1)}
              className="rounded-xl border border-slate-100 bg-slate-50 hover:bg-slate-100/50 transition-colors duration-200"
            >
              <Pagination.PreviousIcon />
              <span className="hidden sm:inline">Sebelumnya</span>
            </Pagination.Previous>
          </Pagination.Item>

          {getPageNumbers().map((p, i) =>
            p === "ellipsis" ? (
              <Pagination.Item key={`ellipsis-${i}`}>
                <Pagination.Ellipsis className="text-slate-400" />
              </Pagination.Item>
            ) : (
              <Pagination.Item key={p}>
                <Pagination.Link
                  isActive={p === page}
                  onPress={() => onPageChange(p)}
                  className={`rounded-xl transition-all duration-200 font-medium ${p === page ? "bg-blue-600 text-white font-semibold" : "text-slate-600 hover:bg-slate-50"}`}
                >
                  {p}
                </Pagination.Link>
              </Pagination.Item>
            ),
          )}

          <Pagination.Item>
            <Pagination.Next
              isDisabled={page === totalPages}
              onPress={() => onPageChange(page + 1)}
              className="rounded-xl border border-slate-100 bg-slate-50 hover:bg-slate-100/50 text-slate-600 transition-colors duration-200"
            >
              <span className="hidden sm:inline">Berikutnya</span>
              <Pagination.NextIcon />
            </Pagination.Next>
          </Pagination.Item>
        </Pagination.Content>
      </Pagination>
    </Card>
  );
}
