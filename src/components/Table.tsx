import React from 'react';

interface TableColumn<T> {
  key: keyof T | string;
  label: string;
  render?: (value: any, item: T) => React.ReactNode;
  width?: string;
}

interface TableProps<T> {
  columns: TableColumn<T>[];
  data: T[];
  rowKey: keyof T;
  onRowClick?: (item: T) => void;
  loading?: boolean;
  emptyMessage?: string;
}

export function Table<T>({
  columns,
  data,
  rowKey,
  onRowClick,
  loading = false,
  emptyMessage = 'No data found',
}: TableProps<T>) {
  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6 text-center">
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-6 text-center">
        <p className="text-gray-500">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <table className="w-full">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            {columns.map((column) => (
              <th
                key={String(column.key)}
                className="px-6 py-3 text-left text-sm font-semibold text-gray-900"
                style={{ width: column.width }}
              >
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {data.map((item) => (
            <tr
              key={String(item[rowKey])}
              onClick={() => onRowClick?.(item)}
              className={`hover:bg-gray-50 ${onRowClick ? 'cursor-pointer' : ''}`}
            >
              {columns.map((column) => (
                <td
                  key={`${String(item[rowKey])}-${String(column.key)}`}
                  className="px-6 py-4 text-sm text-gray-700"
                >
                  {column.render
                    ? column.render((item as any)[column.key as string], item)
                    : (item as any)[column.key as string]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
