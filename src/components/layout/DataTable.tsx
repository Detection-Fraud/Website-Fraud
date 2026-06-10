import {
  Pagination,
  SearchField,
  SearchFieldGroup,
  Table,
} from "@heroui/react";
import { BsFillInboxFill } from "react-icons/bs";

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
}: DataTableProps<T>) {
  const showPagination = pagination && pagination.totalPages > 0;

  const getPageNumbers = () => {
    if (!pagination) return [];
    const { page, totalPages } = pagination;
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
    <Table className={`p-0 rounded-none ${className}`}>
      {/* Container untuk filter & pencarian dibikin sejajar dengan gap */}
      {/* {haveSearch && (
        <div className="flex w-full flex-row items-center justify-start gap-3 p-4">
          {haveFilter && filterStatus}
          {haveFilter && filterProgram}
          <SearchField className="w-64">
            <SearchFieldGroup>
              <SearchField.SearchIcon />
              <SearchField.Input
                placeholder="Cari Laporan..."
                value={search}
                onChange={(e) => onSearch?.(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleSearch?.();
                  }
                }}
              />
              <SearchField.ClearButton onClick={onClearSearch} />
            </SearchFieldGroup>
          </SearchField>
        </div>
      )} */}
      <Table.ScrollContainer>
        <Table.Content aria-label={ariaLabel || "Tabel Data"}>
          <Table.Header className={"sticky z-10 top-0"}>
            {column.map((col, idx) => (
              <Table.Column
                className={"px-6 py-3.5 bg-[#f8fafc]"}
                key={col.key}
                isRowHeader={idx === 0}
              >
                {col.label}
              </Table.Column>
            ))}
          </Table.Header>
          <Table.Body
            renderEmptyState={() => (
              <div className="w-full text-center text-gray-500 p-4 h-90 flex flex-col items-center justify-center">
                <BsFillInboxFill size={50} className="text-gray-400" />
                <p className="text-gray-500 mt-4">Tidak ada data</p>
              </div>
            )}
          >
            {data.map((item, idx) => (
              <Table.Row key={idx}>
                {column.map((col) => (
                  <Table.Cell
                    key={col.key}
                    className={"rounded-none px-6 text-start"}
                  >
                    {renderCell
                      ? renderCell(item, col.key)
                      : (item as any)[col.key]}
                  </Table.Cell>
                ))}
              </Table.Row>
            ))}
          </Table.Body>
        </Table.Content>
      </Table.ScrollContainer>

      {showPagination && (
        <Table.Footer className="bg-white px-w sm:px-4">
          <Pagination>
            <Pagination.Summary className="text-xs hidden sm:block">
              Menampilkan {(pagination.page - 1) * pagination.limit + 1}-
              {Math.min(pagination.page * pagination.limit, pagination.total)}{" "}
              dari {pagination.total} data
            </Pagination.Summary>
            <Pagination.Content>
              <Pagination.Item>
                <Pagination.Previous
                  isDisabled={pagination.page <= 1}
                  onPress={() => onPageChange?.(pagination.page - 1)}
                >
                  <Pagination.PreviousIcon />
                  <span className="hidden sm:inline">Previous</span>
                </Pagination.Previous>
              </Pagination.Item>

              {getPageNumbers().map((p, i) =>
                p === "ellipsis" ? (
                  <Pagination.Item key={`ellipsis-${i}`}>
                    <Pagination.Ellipsis />
                  </Pagination.Item>
                ) : (
                  <Pagination.Item key={p}>
                    <Pagination.Link
                      isActive={p === pagination.page}
                      onPress={() => onPageChange?.(p)}
                      className={
                        p === pagination.page
                          ? "bg-linear-to-br from-sky-600  to-sky-500 font-bold text-white"
                          : ""
                      }
                    >
                      {p}
                    </Pagination.Link>
                  </Pagination.Item>
                ),
              )}

              <Pagination.Item>
                <Pagination.Next
                  isDisabled={pagination.page >= pagination.totalPages}
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
