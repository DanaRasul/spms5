'use client';
import React, { useState } from 'react';
import { useSPMS } from '@/lib/SPMSContext';
import { useLang } from '@/lib/LangContext';
import ReportShell from '@/components/reports/ReportShell';
import ReportTable, { ReportColumn } from '@/components/reports/ReportTable';
import type { ActivityLog as ActivityLogEntry } from '@/lib/types';

export default function ActivityLog() {
  const { activityLogs } = useSPMS();
  const { t } = useLang();
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);
  const perPage = 20;

  const categories = ['all', 'auth', 'vehicle', 'parking_management', 'user_management', 'subscriber_management', 'settings', 'backup', 'restore', 'archive'];

  const filtered = activityLogs?.filter(log => {
    const q = search.toLowerCase();
    const matchSearch = !search || log.username.toLowerCase().includes(q) || log.action.toLowerCase().includes(q) || (log.oldValue || '').toLowerCase().includes(q) || (log.newValue || '').toLowerCase().includes(q);
    const matchCategory = categoryFilter === 'all' || log.category === categoryFilter;
    const logDate = log.timestamp.split('T')[0];
    const matchFrom = !dateFrom || logDate >= dateFrom;
    const matchTo = !dateTo || logDate <= dateTo;
    return matchSearch && matchCategory && matchFrom && matchTo;
  });

  const totalPages = Math.ceil((filtered?.length || 0) / perPage);
  const paged = filtered?.slice((page - 1) * perPage, page * perPage);

  const getCategoryColor = (cat: string) => {
    const map: Record<string, string> = {
      auth: 'bg-blue-100 text-blue-700',
      vehicle: 'bg-green-100 text-green-700',
      parking_management: 'bg-purple-100 text-purple-700',
      user_management: 'bg-orange-100 text-orange-700',
      subscriber_management: 'bg-teal-100 text-teal-700',
      settings: 'bg-gray-100 text-gray-700',
      backup: 'bg-indigo-100 text-indigo-700',
      restore: 'bg-yellow-100 text-yellow-700',
      archive: 'bg-red-100 text-red-700',
    };
    return map[cat] || 'bg-gray-100 text-gray-600';
  };

  const columns: ReportColumn<ActivityLogEntry>[] = [
    { key: 'timestamp', label: t('timestamp'), render: log => <span className="text-gray-500 text-xs whitespace-nowrap">{new Date(log.timestamp)?.toLocaleString()}</span> },
    { key: 'username', label: t('user'), render: log => <span className="font-medium text-gray-700">{log?.username}</span> },
    {
      key: 'userRole', label: t('userRole'), render: log => (
        <span className={`text-xs px-2 py-0.5 rounded-full ${log.userRole === 'system_admin' ? 'bg-purple-100 text-purple-700' : log.userRole === 'branch_admin' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}`}>
          {log.userRole === 'system_admin' ? t('roleSystemAdmin') : log.userRole === 'branch_admin' ? t('roleBranchAdmin') : t('roleUserAdmin')}
        </span>
      ),
    },
    {
      key: 'category', label: t('category'), render: log => (
        <span className={`text-xs px-2 py-0.5 rounded-full ${getCategoryColor(log.category)}`}>{log.category.replace('_', ' ')}</span>
      ),
    },
    { key: 'action', label: t('action'), render: log => <span className="text-gray-600 max-w-xs truncate block" title={log?.action}>{log?.action}</span> },
    { key: 'oldValue', label: t('oldValue'), render: log => <span className="text-red-500 text-xs max-w-xs truncate block" title={log?.oldValue || ''}>{log?.oldValue || '-'}</span> },
    { key: 'newValue', label: t('newValue'), render: log => <span className="text-green-600 text-xs max-w-xs truncate block" title={log?.newValue || ''}>{log?.newValue || '-'}</span> },
    { key: 'ipAddress', label: t('ipAddress'), render: log => <span className="font-mono text-xs text-gray-400">{log?.ipAddress}</span> },
  ];

  return (
    <div className="p-4 md:p-6">
      <div className="flex items-center justify-between mb-4 print:hidden">
        <span className="bg-gray-100 text-gray-600 text-sm px-3 py-1 rounded-full">{filtered?.length} {t('total')}</span>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-4 space-y-3 print:hidden">
        <div className="flex flex-wrap gap-2">
          <input
            type="text"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            placeholder={`${t('search')}...`}
            className="flex-1 min-w-48 border border-gray-200 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
          <select
            value={categoryFilter}
            onChange={e => { setCategoryFilter(e.target.value); setPage(1); }}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          >
            {categories.map(c => (
              <option key={c} value={c}>{c === 'all' ? t('all') : c.replace('_', ' ')}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-sm text-gray-500">{t('from')}:</span>
          <input type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setPage(1); }}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
          <span className="text-sm text-gray-500">{t('to')}:</span>
          <input type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); setPage(1); }}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
          {(search || categoryFilter !== 'all' || dateFrom || dateTo) && (
            <button onClick={() => { setSearch(''); setCategoryFilter('all'); setDateFrom(''); setDateTo(''); setPage(1); }}
              className="px-3 py-1.5 text-sm text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50">{t('clear')}</button>
          )}
        </div>
      </div>

      <ReportShell title={t('activityLog')} filename={`activity_log_${new Date().toISOString().split('T')[0]}`}>
        <ReportTable columns={columns} rows={paged || []} rowKey={log => log.id} emptyLabel={t('noData')} />

        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-4 text-sm text-gray-500 print:hidden">
            <span>{t('page')} {page} {t('of')} {totalPages}</span>
            <div className="flex gap-2">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="px-3 py-1 border rounded disabled:opacity-40 hover:bg-gray-50">{t('previous')}</button>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="px-3 py-1 border rounded disabled:opacity-40 hover:bg-gray-50">{t('next')}</button>
            </div>
          </div>
        )}
      </ReportShell>
    </div>
  );
}
