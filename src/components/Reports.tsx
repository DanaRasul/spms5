'use client';
import React, { useState, useEffect } from 'react';
import { useSPMS, getUserBranchId } from '@/lib/SPMSContext';
import { useLang } from '@/lib/LangContext';
import ReportShell from '@/components/reports/ReportShell';
import ReportTable, { ReportColumn } from '@/components/reports/ReportTable';

type Period = 'daily' | 'weekly' | 'monthly' | 'annual';

export default function Reports() {
  const { vehicles, locations, currentUser } = useSPMS();
  const { t } = useLang();
  const branchId = getUserBranchId(currentUser);
  const [period, setPeriod] = useState<Period>('daily');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [locationFilter, setLocationFilter] = useState(branchId ?? 'all');

  useEffect(() => {
    if (branchId) setLocationFilter(branchId);
  }, [branchId]);

  const now = new Date();
  const getRange = (): { start: string; end: string } => {
    const end = now.toISOString().split('T')[0];
    if (period === 'daily') return { start: selectedDate, end: selectedDate };
    if (period === 'weekly') {
      const s = new Date(now.getTime() - 7 * 86400000);
      return { start: s.toISOString().split('T')[0], end };
    }
    if (period === 'monthly') {
      const s = new Date(now.getFullYear(), now.getMonth(), 1);
      return { start: s.toISOString().split('T')[0], end };
    }
    const s = new Date(now.getFullYear(), 0, 1);
    return { start: s.toISOString().split('T')[0], end };
  };

  const { start, end } = getRange();
  const filtered = vehicles.filter(v => {
    const inRange = v.entryDate >= start && v.entryDate <= end;
    const inLocation = locationFilter === 'all' || v.locationId === locationFilter;
    return inRange && inLocation;
  });
  const inside = filtered.filter(v => v.status === 'inside');
  const completed = filtered.filter(v => v.status === 'completed');
  const revenue = completed.reduce((a, v) => a + (v.fee || 0), 0);

  const byDate: Record<string, { entries: number; exits: number; revenue: number; inside: number }> = {};
  filtered.forEach(v => {
    if (!byDate[v.entryDate]) byDate[v.entryDate] = { entries: 0, exits: 0, revenue: 0, inside: 0 };
    byDate[v.entryDate].entries++;
    if (v.status === 'completed') { byDate[v.entryDate].exits++; byDate[v.entryDate].revenue += v.fee || 0; }
    else byDate[v.entryDate].inside++;
  });
  const rows = Object.entries(byDate).sort((a, b) => b[0].localeCompare(a[0]));

  const handleExportCSV = () => {
    const headers = ['Date', 'Entries', 'Exits', 'Inside', 'Revenue (IQD)'];
    const dataRows = rows.map(([date, data]) => [date, data.entries, data.exits, data.inside, data.revenue]);
    const totalsRow = ['TOTAL', filtered.length, completed.length, inside.length, revenue];
    const csv = [headers, ...dataRows, totalsRow].map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `report_${period}_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  type DateRow = { date: string; entries: number; exits: number; inside: number; revenue: number };
  const dateRows: DateRow[] = rows.map(([date, data]) => ({ date, ...data }));

  const columns: ReportColumn<DateRow>[] = [
    { key: 'date', label: t('date'), render: r => <span className="font-medium text-gray-700">{r.date}</span> },
    { key: 'entries', label: t('totalEntries'), render: r => <span className="text-blue-600">{r.entries}</span> },
    { key: 'exits', label: t('totalExits'), render: r => <span className="text-orange-600">{r.exits}</span> },
    { key: 'inside', label: t('vehiclesInside'), render: r => <span className="text-green-600">{r.inside}</span> },
    { key: 'revenue', label: t('revenue'), render: r => <span className="text-purple-600 font-semibold">{r.revenue.toLocaleString()} {t('iqd')}</span> },
  ];

  return (
    <div className="p-4 md:p-6">
      {/* Filters (print:hidden) */}
      <div className="flex flex-wrap gap-2 mb-6 print:hidden">
        {(['daily', 'weekly', 'monthly', 'annual'] as Period[]).map(p => (
          <button key={p} onClick={() => setPeriod(p)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${period === p ? 'bg-blue-500 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
            {t(p)}
          </button>
        ))}
        {period === 'daily' && (
          <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
        )}
        <select value={locationFilter} onChange={e => setLocationFilter(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
          {!branchId && <option value="all">{t('allLocations')}</option>}
          {locations.map(loc => (
            <option key={loc.id} value={loc.id}>{loc.name}</option>
          ))}
        </select>
      </div>

      <ReportShell
        title={`${t('reports')} — ${t(period)}`}
        filename={`report_${period}_${new Date().toISOString().split('T')[0]}`}
        actions={
          <button onClick={handleExportCSV} className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg text-sm font-medium transition-colors">
            {t('exportExcel')}
          </button>
        }
        summary={
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-gray-50 rounded-xl p-4 text-center">
              <p className="text-3xl font-bold text-blue-600">{filtered.length}</p>
              <p className="text-sm text-gray-500 mt-1">{t('totalVehicles')}</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-4 text-center">
              <p className="text-3xl font-bold text-green-600">{filtered.length}</p>
              <p className="text-sm text-gray-500 mt-1">{t('totalEntries')}</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-4 text-center">
              <p className="text-3xl font-bold text-orange-600">{completed.length}</p>
              <p className="text-sm text-gray-500 mt-1">{t('totalExits')}</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-purple-600">{revenue.toLocaleString()}</p>
              <p className="text-sm text-gray-500 mt-1">{t('revenue')} ({t('iqd')})</p>
            </div>
          </div>
        }
      >
        <ReportTable
          columns={columns}
          rows={dateRows}
          rowKey={r => r.date}
          emptyLabel={t('noData')}
          totals={
            <>
              <td className="px-4 py-3 text-gray-700">{t('total')}</td>
              <td className="px-4 py-3 text-blue-700">{filtered.length}</td>
              <td className="px-4 py-3 text-orange-700">{completed.length}</td>
              <td className="px-4 py-3 text-green-700">{inside.length}</td>
              <td className="px-4 py-3 text-purple-700">{revenue.toLocaleString()} {t('iqd')}</td>
            </>
          }
        />
      </ReportShell>
    </div>
  );
}
