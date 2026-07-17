'use client';
import React from 'react';

export interface ReportColumn<T> {
  key: string;
  label: string;
  align?: 'start' | 'end' | 'center';
  render: (row: T) => React.ReactNode;
  /** Shown as a small label above the value in the mobile card view. */
  mobileLabel?: string;
}

interface ReportTableProps<T> {
  columns: ReportColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  totals?: React.ReactNode; // rendered as the final <tr> on desktop, and a card on mobile
  emptyLabel: string;
}

const alignClass = (a?: 'start' | 'end' | 'center') =>
  a === 'end' ? 'text-end' : a === 'center' ? 'text-center' : 'text-start';

/**
 * Renders `rows` as a proper table on desktop and as stacked cards on
 * mobile, from one shared column definition — used by every report so the
 * responsive behavior only needs to be built once.
 */
export default function ReportTable<T>({ columns, rows, rowKey, totals, emptyLabel }: ReportTableProps<T>) {
  if (rows.length === 0) {
    return <p className="text-center text-gray-400 text-sm py-10">{emptyLabel}</p>;
  }

  return (
    <>
      {/* Desktop / print table */}
      <div className="hidden sm:block overflow-x-auto bg-white rounded-xl border border-gray-100">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100">
              {columns.map(col => (
                <th key={col.key} className={`px-4 py-3 font-semibold text-gray-600 ${alignClass(col.align)}`}>
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(row => (
              <tr key={rowKey(row)} className="border-b border-gray-50 hover:bg-gray-50">
                {columns.map(col => (
                  <td key={col.key} className={`px-4 py-3 ${alignClass(col.align)}`}>
                    {col.render(row)}
                  </td>
                ))}
              </tr>
            ))}
            {totals && <tr className="bg-gray-50 font-semibold">{totals}</tr>}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="sm:hidden space-y-3">
        {rows.map(row => (
          <div key={rowKey(row)} className="bg-white rounded-xl border border-gray-100 p-3 space-y-1.5">
            {columns.map(col => (
              <div key={col.key} className="flex items-center justify-between gap-3 text-sm">
                <span className="text-[11px] text-gray-400">{col.mobileLabel ?? col.label}</span>
                <span className="text-gray-800 text-end">{col.render(row)}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </>
  );
}
