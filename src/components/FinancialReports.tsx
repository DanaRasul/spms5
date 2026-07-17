'use client';
import React from 'react';
import { useSPMS } from '@/lib/SPMSContext';
import { useLang } from '@/lib/LangContext';
import ReportShell from '@/components/reports/ReportShell';
import ReportTable, { ReportColumn } from '@/components/reports/ReportTable';

export default function FinancialReports() {
  const { vehicles } = useSPMS();
  const { t } = useLang();

  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
  const weekAgo = new Date(now.getTime() - 7 * 86400000).toISOString().split('T')[0];
  const monthAgo = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  const yearAgo = new Date(now.getFullYear(), 0, 1).toISOString().split('T')[0];

  const completed = vehicles.filter(v => v.status === 'completed' && v.exitDate);

  const calc = (start: string, end: string) =>
    completed.filter(v => v.exitDate! >= start && v.exitDate! <= end).reduce((a, v) => a + (v.fee || 0), 0);

  const todayRev = calc(todayStr, todayStr);
  const weeklyRev = calc(weekAgo, todayStr);
  const monthlyRev = calc(monthAgo, todayStr);
  const annualRev = calc(yearAgo, todayStr);
  const totalRev = completed.reduce((a, v) => a + (v.fee || 0), 0);

  const fmtIQD = (n: number) => n.toLocaleString() + ' ' + t('iqd');

  // Monthly breakdown
  const monthlyBreakdown: Record<string, number> = {};
  completed.forEach(v => {
    if (!v.exitDate) return;
    const key = v.exitDate.slice(0, 7);
    monthlyBreakdown[key] = (monthlyBreakdown[key] || 0) + (v.fee || 0);
  });
  const monthRows = Object.entries(monthlyBreakdown).sort((a, b) => b[0].localeCompare(a[0]));

  type MonthRow = { month: string; count: number; revenue: number; avg: number };
  const tableRows: MonthRow[] = monthRows.map(([month, rev]) => {
    const monthVehicles = completed.filter(v => v.exitDate?.startsWith(month));
    return { month, count: monthVehicles.length, revenue: rev, avg: monthVehicles.length > 0 ? Math.round(rev / monthVehicles.length) : 0 };
  });

  const columns: ReportColumn<MonthRow>[] = [
    { key: 'month', label: t('month'), render: r => <span className="font-medium text-gray-700">{r.month}</span> },
    { key: 'count', label: t('count'), render: r => <span className="text-blue-600">{r.count}</span> },
    { key: 'revenue', label: t('revenue'), render: r => <span className="text-green-600 font-semibold">{r.revenue.toLocaleString()} {t('iqd')}</span> },
    { key: 'avg', label: t('avgDuration'), render: r => <span className="text-gray-500">{r.count > 0 ? `${r.avg.toLocaleString()} ${t('iqd')}` : '-'}</span> },
  ];

  return (
    <div className="p-4 md:p-6">
      <ReportShell
        title={t('financialReports')}
        filename={`revenue_report_${new Date().toISOString().split('T')[0]}`}
        summary={
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {[
              { label: t('todayRevenue'), value: todayRev },
              { label: t('weeklyRevenue'), value: weeklyRev },
              { label: t('monthlyRevenue'), value: monthlyRev },
              { label: t('annualRevenue'), value: annualRev },
              { label: t('totalRevenue'), value: totalRev },
            ].map(item => (
              <div key={item.label} className="bg-gray-50 border border-gray-100 rounded-xl p-4 text-center">
                <p className="text-xl font-bold text-gray-800">{item.value.toLocaleString()}</p>
                <p className="text-xs text-gray-500 mt-1">{t('iqd')}</p>
                <p className="text-sm text-gray-600 mt-1">{item.label}</p>
              </div>
            ))}
          </div>
        }
      >
        <h3 className="text-sm font-semibold text-gray-700 mb-3">{t('monthly')} {t('revenue')} {t('summary')}</h3>
        <ReportTable columns={columns} rows={tableRows} rowKey={r => r.month} emptyLabel={t('noData')} />
      </ReportShell>
    </div>
  );
}
