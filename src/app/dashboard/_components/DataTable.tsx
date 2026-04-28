import { Table } from "@heroui/react";

export interface TableColumn {
  key: string;
  label: string;
}

interface DataTableProps<T> {
  column: TableColumn[];
  data: T[];
  ariaLabel?: string;
  renderCell?: (item: T, columnKey: string) => React.ReactNode;
}
export default function DataTable<T>({
  column,
  data,
  ariaLabel,
  renderCell,
}: DataTableProps<T>) {
  return (
    <Table >
      <Table.ScrollContainer>
        <Table.Content aria-label={ariaLabel || "Tabel Data"}>
          <Table.Header>
            {column.map((col, idx) => (
              <Table.Column key={col.key} isRowHeader={idx === 0}>
                {col.label}
              </Table.Column>
            ))}
          </Table.Header>
          <Table.Body>
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
    </Table>
  );
}
