import { Card, Pagination } from "@heroui/react";

interface PaginationFooterProps {
  page: number;
  totalPages: number;
  totalItems: number;
  itemsPerPage: number;
  itemLabel?: string;
  onPageChange: (page: number) => void;
}

export default function PaginationFooter({
  page,
  totalPages,
  totalItems,
  itemsPerPage,
  itemLabel = "data",
  onPageChange,
}: PaginationFooterProps) {
  if (totalPages <= 1) return null;

  const startItem = (page - 1) * itemsPerPage + 1;
  const endItem = Math.min(page * itemsPerPage, totalItems);
  const pages: (number | "ellipsis")[] = [];

  if (totalPages <= 7) {
    for (let value = 1; value <= totalPages; value++) pages.push(value);
  } else {
    pages.push(1);
    if (page > 3) pages.push("ellipsis");
    for (
      let value = Math.max(2, page - 1);
      value <= Math.min(totalPages - 1, page + 1);
      value++
    ) {
      pages.push(value);
    }
    if (page < totalPages - 2) pages.push("ellipsis");
    pages.push(totalPages);
  }

  return (
    <Card className="rounded-2xl border border-slate-200/60 bg-white shadow-sm">
      <Pagination className="flex w-full flex-col items-center justify-between gap-4 sm:flex-row">
        <Pagination.Summary className="text-center text-xs text-slate-500 sm:text-left sm:text-sm">
          Menampilkan{" "}
          <span className="font-semibold text-slate-700">
            {startItem}-{endItem}
          </span>{" "}
          dari{" "}
          <span className="font-semibold text-slate-700">{totalItems}</span>{" "}
          {itemLabel}
        </Pagination.Summary>
        <Pagination.Content className="flex items-center gap-1 overflow-x-auto">
          <Pagination.Item>
            <Pagination.Previous
              isDisabled={page === 1}
              onPress={() => onPageChange(page - 1)}
            >
              <Pagination.PreviousIcon />
              <span className="hidden sm:inline">Sebelumnya</span>
            </Pagination.Previous>
          </Pagination.Item>
          {pages.map((value, index) =>
            value === "ellipsis" ? (
              <Pagination.Item key={`ellipsis-${index}`}>
                <Pagination.Ellipsis />
              </Pagination.Item>
            ) : (
              <Pagination.Item key={value}>
                <Pagination.Link
                  isActive={value === page}
                  onPress={() => onPageChange(value)}
                  className={
                    value === page ? "bg-blue-600 font-semibold text-white" : ""
                  }
                >
                  {value}
                </Pagination.Link>
              </Pagination.Item>
            ),
          )}
          <Pagination.Item>
            <Pagination.Next
              isDisabled={page === totalPages}
              onPress={() => onPageChange(page + 1)}
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
