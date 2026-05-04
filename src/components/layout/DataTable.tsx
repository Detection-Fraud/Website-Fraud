import {
  Pagination,
  SearchField,
  SearchFieldGroup,
  Table
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
  search: string;
  onSearch: (search: string) => void;
  onClearSearch: () => void;
  handleSearch: () => void;
  filterStatus?: React.ReactNode;
  filterProgram?: React.ReactNode;
}

export default function DataTable<T>({
  column,
  data,
  ariaLabel,
  renderCell,
  pagination,
  onPageChange,
  search,
  onSearch,
  onClearSearch,
  handleSearch,
  filterStatus,
  filterProgram,
}: DataTableProps<T>) {
  const showPagination = pagination && pagination.totalPages > 0;

  return (
    <Table>
      {/* Container untuk filter & pencarian dibikin sejajar dengan gap */}
      <div className="flex w-full flex-row items-center justify-start gap-3 p-4">
        {filterStatus}
        {filterProgram}
        <SearchField className="w-64">
          <SearchFieldGroup>
            <SearchField.SearchIcon />
            <SearchField.Input
              placeholder="Cari Laporan..."
              value={search}
              onChange={(e) => onSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleSearch();
                }
              }}
            />
            <SearchField.ClearButton onClick={onClearSearch} />
          </SearchFieldGroup>
        </SearchField>
      </div>
      <Table.ScrollContainer>
        <Table.Content aria-label={ariaLabel || "Tabel Data"}>
          <Table.Header>
            {column.map((col, idx) => (
              <Table.Column key={col.key} isRowHeader={idx === 0}>
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
                  <Table.Cell key={col.key}>
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
        <Table.Footer>
          <Pagination>
            <Pagination.Summary>
              Menampilkan {(pagination.page - 1) * pagination.limit + 1}-
              {Math.min(pagination.page * pagination.limit, pagination.total)}{" "}
              dari {pagination.total} data
            </Pagination.Summary>
            <Pagination.Content>
              <Pagination.Item>
                <Pagination.Previous
                  isDisabled={pagination.page <= 1}
                  onClick={() => onPageChange?.(pagination.page - 1)}
                >
                  <Pagination.PreviousIcon />
                  <span>Previous</span>
                </Pagination.Previous>
              </Pagination.Item>

              <Pagination.Item>
                <Pagination.Link isActive>{pagination.page}</Pagination.Link>
              </Pagination.Item>

              {pagination.page < pagination.totalPages && (
                <Pagination.Item>
                  <Pagination.Ellipsis />
                </Pagination.Item>
              )}

              <Pagination.Item>
                <Pagination.Next
                  isDisabled={pagination.page >= pagination.totalPages}
                  onClick={() => onPageChange?.(pagination.page + 1)}
                >
                  <span>Next</span>
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
