'use client';
import React, { useState } from 'react';
import { useSPMS } from '@/lib/SPMSContext';
import { useLang } from '@/lib/LangContext';
import type { ArchiveOptions } from '@/lib/SPMSContext';
import ConfirmDialog from '@/components/ConfirmDialog';

export default function BackupRestore() {
  const { backups, createBackup, downloadBackup, deleteBackup, restoreBackup, archiveData, vehicles, activityLogs } = useSPMS();
  const { t } = useLang();
  const [toast, setToast] = useState('');
  const [toastType, setToastType] = useState<'success' | 'error'>('success');
  const [restoring, setRestoring] = useState(false);
  const [activeTab, setActiveTab] = useState<'backup' | 'archive'>('backup');
  const [confirmDeleteBackupId, setConfirmDeleteBackupId] = useState<string | null>(null);
  const [archiveType, setArchiveType] = useState<ArchiveOptions['type']>('dateRange');
  const [archiveDateFrom, setArchiveDateFrom] = useState('');
  const [archiveDateTo, setArchiveDateTo] = useState('');
  const [archiveMonth, setArchiveMonth] = useState('');
  const [archiveYear, setArchiveYear] = useState('');
  const [includeActivityLogs, setIncludeActivityLogs] = useState(false);
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [archivePreview, setArchivePreview] = useState<number>(0);

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast(msg);
    setToastType(type);
    setTimeout(() => setToast(''), 4000);
  };

  const handleCreate = () => {
    createBackup();
    showToast(t('successSaved'));
  };

  const handleRestore = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setRestoring(true);
    const result = await restoreBackup(file);
    setRestoring(false);
    showToast(t(result.message), result.success ? 'success' : 'error');
    e.target.value = '';
  };

  const computeArchivePreview = () => {
    const completed = vehicles.filter(v => v.status === 'completed');
    let count = 0;
    if (archiveType === 'all') count = completed.length;
    else if (archiveType === 'dateRange' && archiveDateFrom && archiveDateTo)
      count = completed.filter(v => v.exitDate && v.exitDate >= archiveDateFrom && v.exitDate <= archiveDateTo).length;
    else if (archiveType === 'month' && archiveMonth)
      count = completed.filter(v => v.exitDate?.startsWith(archiveMonth)).length;
    else if (archiveType === 'year' && archiveYear)
      count = completed.filter(v => v.exitDate?.startsWith(archiveYear)).length;
    if (includeActivityLogs) {
      if (archiveType === 'all') count += activityLogs.length;
      else if (archiveType === 'dateRange' && archiveDateFrom && archiveDateTo)
        count += activityLogs.filter(l => l.timestamp.split('T')[0] >= archiveDateFrom && l.timestamp.split('T')[0] <= archiveDateTo).length;
      else if (archiveType === 'month' && archiveMonth)
        count += activityLogs.filter(l => l.timestamp.startsWith(archiveMonth)).length;
      else if (archiveType === 'year' && archiveYear)
        count += activityLogs.filter(l => l.timestamp.startsWith(archiveYear)).length;
    }
    setArchivePreview(count);
    setConfirmArchive(true);
  };

  const handleArchive = () => {
    const options: ArchiveOptions = {
      type: archiveType,
      startDate: archiveDateFrom || undefined,
      endDate: archiveDateTo || undefined,
      month: archiveMonth || undefined,
      year: archiveYear || undefined,
      includeActivityLogs,
    };
    const result = archiveData(options);
    setConfirmArchive(false);
    showToast(`${t(result.message)}: ${result.count} records removed`, result.success ? 'success' : 'error');
  };

  return (
    <div className="p-4 md:p-6">
      <h1 className="text-xl font-bold text-gray-800 mb-6">{t('backupRestore')}</h1>

      {toast && (
        <div className={`mb-4 border rounded-lg px-4 py-3 text-sm ${toastType === 'success' ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
          {toast}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        {(['backup', 'archive'] as const).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === tab ? 'bg-blue-500 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
            {tab === 'backup' ? t('backupRestore') : t('archiveCleanup')}
          </button>
        ))}
      </div>

      {activeTab === 'backup' && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            {/* Create Backup */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <div className="text-4xl mb-3">💾</div>
              <h2 className="font-semibold text-gray-700 mb-2">{t('createBackup')}</h2>
              <p className="text-sm text-gray-500 mb-4">Create a full backup of all system data including vehicles, subscribers, users, and settings. A checksum is generated for integrity verification.</p>
              <button onClick={handleCreate} className="w-full bg-blue-500 hover:bg-blue-600 text-white py-3 rounded-lg font-medium transition-colors">
                {t('createBackup')}
              </button>
            </div>

            {/* Restore */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <div className="text-4xl mb-3">🔄</div>
              <h2 className="font-semibold text-gray-700 mb-2">{t('restoreBackup')}</h2>
              <p className="text-sm text-gray-500 mb-2">Restore system data from a previously created backup file. The system will verify backup integrity before restoring.</p>
              <div className="flex items-center gap-2 mb-4 p-2 bg-blue-50 rounded-lg">
                <span className="text-blue-500">🔒</span>
                <span className="text-xs text-blue-600">{t('backupIntegrity')}: {t('checksumVerified')}</span>
              </div>
              <label className="w-full block">
                <input type="file" accept=".json" onChange={handleRestore} className="hidden" />
                <span className={`w-full block text-center py-3 rounded-lg font-medium cursor-pointer transition-colors ${restoring ? 'bg-gray-300 text-gray-500' : 'bg-orange-500 hover:bg-orange-600 text-white'}`}>
                  {restoring ? t('loading') : t('restoreBackup')}
                </span>
              </label>
            </div>
          </div>

          {/* Backup List */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100">
            <div className="p-4 border-b border-gray-100">
              <h2 className="font-semibold text-gray-700">{t('backup')} {t('history')}</h2>
            </div>
            {backups.length === 0 ? (
              <div className="text-center py-12 text-gray-400">{t('noData')}</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100">
                      <th className="px-4 py-3 text-left font-semibold text-gray-600">{t('backupDate')}</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-600">{t('name')}</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-600">{t('backupSize')}</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-600">{t('backupIntegrity')}</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-600">{t('actions')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {backups.map(b => (
                      <tr key={b.id} className="border-b border-gray-50 hover:bg-gray-50">
                        <td className="px-4 py-3 text-gray-600">{b.date}</td>
                        <td className="px-4 py-3 font-mono text-xs text-gray-500">{b.filename}</td>
                        <td className="px-4 py-3 text-gray-500">{b.size}</td>
                        <td className="px-4 py-3">
                          {b.checksum ? (
                            <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">✓ {t('checksumVerified')}</span>
                          ) : (
                            <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">N/A</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-2">
                            <button onClick={() => downloadBackup(b.id)} className="text-blue-500 hover:text-blue-700 text-xs border border-blue-200 px-3 py-1 rounded hover:bg-blue-50">
                              {t('downloadBackup')}
                            </button>
                            <button onClick={() => setConfirmDeleteBackupId(b.id)} className="text-red-500 hover:text-red-700 text-xs border border-red-200 px-3 py-1 rounded hover:bg-red-50">
                              {t('delete')}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {activeTab === 'archive' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center gap-3 mb-4">
            <span className="text-3xl">🗄️</span>
            <div>
              <h2 className="font-semibold text-gray-700">{t('archiveCleanup')}</h2>
              <p className="text-sm text-gray-500">Remove old operational data. Users, roles, locations, spaces, subscribers, and settings are never deleted.</p>
            </div>
          </div>

          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-6 text-sm text-yellow-700">
            ⚠️ This action permanently removes completed parking history records. Create a backup first!
          </div>

          {/* Archive Type */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">{t('archiveData')}</label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {([
                  { value: 'dateRange', label: t('archiveByDateRange') },
                  { value: 'month', label: t('archiveByMonth') },
                  { value: 'year', label: t('archiveByYear') },
                  { value: 'all', label: t('archiveAll') },
                ] as const).map(opt => (
                  <button key={opt.value} onClick={() => setArchiveType(opt.value)}
                    className={`py-2 px-3 text-sm rounded-lg border transition-colors ${archiveType === opt.value ? 'bg-red-500 text-white border-red-500' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {archiveType === 'dateRange' && (
              <div className="flex flex-wrap gap-3 items-center">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">{t('from')}</label>
                  <input type="date" value={archiveDateFrom} onChange={e => setArchiveDateFrom(e.target.value)}
                    className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">{t('to')}</label>
                  <input type="date" value={archiveDateTo} onChange={e => setArchiveDateTo(e.target.value)}
                    className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                </div>
              </div>
            )}

            {archiveType === 'month' && (
              <div>
                <label className="block text-xs text-gray-500 mb-1">{t('month')}</label>
                <input type="month" value={archiveMonth} onChange={e => setArchiveMonth(e.target.value)}
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
              </div>
            )}

            {archiveType === 'year' && (
              <div>
                <label className="block text-xs text-gray-500 mb-1">{t('year')}</label>
                <input type="number" min={2020} max={2030} value={archiveYear} onChange={e => setArchiveYear(e.target.value)}
                  placeholder="e.g. 2024"
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 w-32" />
              </div>
            )}

            <div className="flex items-center gap-2">
              <input type="checkbox" id="includeActivityLogs" checked={includeActivityLogs} onChange={e => setIncludeActivityLogs(e.target.checked)}
                className="w-4 h-4 text-blue-500 rounded" />
              <label htmlFor="includeActivityLogs" className="text-sm text-gray-600">{t('includeActivityLogs')}</label>
            </div>

            <button
              onClick={computeArchivePreview}
              className="bg-red-500 hover:bg-red-600 text-white px-6 py-2.5 rounded-lg font-medium text-sm transition-colors"
            >
              {t('archiveData')}
            </button>
          </div>
        </div>
      )}

      {/* Archive Confirm Modal */}
      {confirmArchive && (
        <ConfirmDialog
          title={t('archiveCleanup')}
          message={
            <>
              <p className="mb-2">{t('archiveConfirm')}</p>
              <p className="text-red-600 font-semibold">{archivePreview} records will be permanently removed.</p>
            </>
          }
          confirmLabel={t('confirm')}
          onCancel={() => setConfirmArchive(false)}
          onConfirm={handleArchive}
        />
      )}

      {/* Backup Delete Confirm Modal */}
      {confirmDeleteBackupId && (
        <ConfirmDialog
          title={t('confirmDeleteTitle')}
          message={t('confirmDeleteBackup')}
          onCancel={() => setConfirmDeleteBackupId(null)}
          onConfirm={() => {
            deleteBackup(confirmDeleteBackupId);
            setConfirmDeleteBackupId(null);
            showToast(t('successDeleted'));
          }}
        />
      )}
    </div>
  );
}
