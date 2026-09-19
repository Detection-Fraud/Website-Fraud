import { Pagination, Table } from "@heroui/react";
import { BsFillInboxFill } from "react-icons/bs";
import type * as React from "react";

export interface TableColumn {
  key: string;
  label: string;
}

export interface PaginationInfo {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface DataTableProps<T> {
  column: TableColumn[];
  data: T[];
  ariaLabel?: string;
  renderCell?: (item: T, columnKey: string) => React.ReactNode;
  pagination?: PaginationInfo;
  onPageChange?: (page: number) => void;
  search?: string;
  onSearch?: (search: string) => void;
  onClearSearch?: () => void;
  handleSearch?: () => void;
  filterStatus?: React.ReactNode;
  filterProgram?: React.ReactNode;
  haveSearch?: boolean;
  haveFilter?: boolean;
  className?: string;
  renderEmptyState?: () => React.ReactNode;
  getRowKey?: (item: T, index: number) => React.Key;
  getRowClassName?: (item: T, index: number) => string | undefined;
  isPaginationDisabled?: boolean;
}

export default function DataTable<T>({
  column,
  data,
  ariaLabel,
  renderCell,
  pagination,
  onPageChange,
  className,
  search,
  onSearch,
  onClearSearch,
  handleSearch,
  filterStatus,
  haveFilter,
  haveSearch,
  filterProgram,
  renderEmptyState,
  getRowKey,
  getRowClassName,
  isPaginationDisabled = false,
}: DataTableProps<T>) {
  const showPagination = pagination && pagination.totalPages > 0;

  const getPageNumbers = () => {
    if (!pagination) return [];

    const { page, totalPages } = pagination;
    const pages: (number | "ellipsis")[] = [];

    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i += 1) {
        pages.push(i);
      }
    } else {
      pages.push(1);

      if (page > 3) pages.push("ellipsis");

      for (
        let i = Math.max(2, page - 1);
        i <= Math.min(totalPages - 1, page + 1);
        i += 1
      ) {
        pages.push(i);
      }

      if (page < totalPages - 2) pages.push("ellipsis");

      pages.push(totalPages);
    }

    return pages;
  };

  return (
    <Table className={`rounded-none p-0 ${className ?? ""}`}>
      <Table.ScrollContainer>
        <Table.Content aria-label={ariaLabel || "Tabel Data"}>
          <Table.Header className="sticky top-0 z-10">
            {column.map((col, idx) => (
              <Table.Column
                className="whitespace-nowrap bg-[#f8fafc] px-6 py-3.5"
                key={col.key}
                isRowHeader={idx === 0}
              >
                {col.label}
              </Table.Column>
            ))}
          </Table.Header>

          <Table.Body
            renderEmptyState={
              renderEmptyState ||
              (() => (
                <div className="flex w-full flex-col items-center justify-center px-4 py-14 text-center">
                  <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl border border-slate-200/60 bg-slate-100/80 text-slate-400 shadow-xs">
                    <BsFillInboxFill size={26} />
                  </div>
                  <p className="text-sm font-semibold text-slate-700">
                    Data Tidak Ditemukan
                  </p>
                  <p className="mt-1 max-w-xs text-xs leading-relaxed text-slate-400">
                    Belum ada rekaman data yang sesuai dengan kriteria filter
                    saat ini.
                  </p>
                </div>
              ))
            }
          >
            {data.map((item, idx) => (
              <Table.Row
                key={getRowKey?.(item, idx) ?? idx}
                className={getRowClassName?.(item, idx)}
              >
                {column.map((col) => (
                  <Table.Cell
                    className="whitespace-nowrap rounded-none px-6 text-start"
                    key={col.key}
                  >
                    {renderCell
                      ? renderCell(item, col.key)
                      : (item as Record<string, React.ReactNode>)[col.key]}
                  </Table.Cell>
                ))}
              </Table.Row>
            ))}
          </Table.Body>
        </Table.Content>
      </Table.ScrollContainer>

      {showPagination && (
        <Table.Footer className="bg-white px-4">
          <Pagination>
            <Pagination.Summary className="hidden text-xs tabular-nums sm:block">
              Menampilkan {(pagination.page - 1) * pagination.limit + 1}-
              {Math.min(pagination.page * pagination.limit, pagination.total)}{" "}
              dari {pagination.total} data
            </Pagination.Summary>

            <Pagination.Content>
              <Pagination.Item>
                <Pagination.Previous
                  isDisabled={isPaginationDisabled || pagination.page <= 1}
                  onPress={() => onPageChange?.(pagination.page - 1)}
                >
                  <Pagination.PreviousIcon />
                  <span className="hidden sm:inline">Previous</span>
                </Pagination.Previous>
              </Pagination.Item>

              {getPageNumbers().map((pageNumber, index) =>
                pageNumber === "ellipsis" ? (
                  <Pagination.Item key={`ellipsis-${index}`}>
                    <Pagination.Ellipsis />
                  </Pagination.Item>
                ) : (
                  <Pagination.Item key={pageNumber}>
                    <Pagination.Link
                      isDisabled={isPaginationDisabled}
                      isActive={pageNumber === pagination.page}
                      onPress={() => onPageChange?.(pageNumber)}
                      className={`tabular-nums ${
                        pageNumber === pagination.page
                          ? "bg-linear-to-br from-sky-600 to-sky-500 font-bold text-white"
                          : ""
                      }`}
                    >
                      {pageNumber}
                    </Pagination.Link>
                  </Pagination.Item>
                ),
              )}

              <Pagination.Item>
                <Pagination.Next
                  isDisabled={
                    isPaginationDisabled ||
                    pagination.page >= pagination.totalPages
                  }
                  onPress={() => onPageChange?.(pagination.page + 1)}
                >
                  <span className="hidden sm:inline">Next</span>
                  <Pagination.NextIcon />
                </Pagination.Next>
              </Pagination.Item>
            </Pagination.Content>
          </Pagination>
        </Table.Footer>
      )}
    </Table>
  );
}
