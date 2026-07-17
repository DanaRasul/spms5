'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { useSPMS } from '@/lib/SPMSContext';
import { useLang } from '@/lib/LangContext';
import type { MonthlySubscriber } from '@/lib/types';
import CustomerProfileModal from '@/components/CustomerProfileModal';
import ReportShell from '@/components/reports/ReportShell';
import ConfirmDialog from '@/components/ConfirmDialog';

const emptyForm = {
  plateNumber: '', driverName: '', phoneNumber: '', vehicleType: '', vehicleColor: '',
  startDate: new Date().toISOString().split('T')[0], subscriptionPeriod: 1,
  paymentAmount: 60000, notes: '', paymentStatus: 'paid' as 'paid' | 'unpaid',
};

interface PlateStats { today: number; thisWeek: number; thisMonth: number; thisYear: number; overall: number }
const EMPTY_STATS: PlateStats = { today: 0, thisWeek: 0, thisMonth: 0, thisYear: 0, overall: 0 };

export default function MonthlySubscribers() {
  const { subscribers, addSubscriber, updateSubscriber, deleteSubscriber } = useSPMS();
  const { t } = useLang();
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [search, setSearch] = useState('');
  const [profilePlate, setProfilePlate] = useState<string | null>(null);
  const [visitStats, setVisitStats] = useState<Record<string, PlateStats>>({});

  const loadStats = useCallback(async () => {
    try {
      const res = await fetch('/api/subscribers/stats');
      if (!res.ok) return;
      const json = await res.json();
      setVisitStats(json.data || {});
    } catch {
      // Non-fatal: the table still works without live stats.
    }
  }, []);

  useEffect(() => {
    loadStats();
    const interval = setInterval(loadStats, 60000);
    return () => clearInterval(interval);
  }, [loadStats, subscribers.length]);
  const [toast, setToast] = useState('');
  const [confirmDel, setConfirmDel] = useState<string | null>(null);

  const filtered = subscribers.filter(s =>
    !search || s.plateNumber.toLowerCase().includes(search.toLowerCase()) ||
    s.driverName.toLowerCase().includes(search.toLowerCase()) ||
    s.phoneNumber.includes(search)
  );

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  const openAdd = () => { setForm(emptyForm); setEditId(null); setShowForm(true); };
  const openEdit = (s: MonthlySubscriber) => {
    setForm({ plateNumber: s.plateNumber, driverName: s.driverName, phoneNumber: s.phoneNumber, vehicleType: s.vehicleType, vehicleColor: s.vehicleColor, startDate: s.startDate, subscriptionPeriod: s.subscriptionPeriod, paymentAmount: s.paymentAmount, notes: s.notes || '', paymentStatus: s.paymentStatus });
    setEditId(s.id);
    setShowForm(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editId) {
      updateSubscriber(editId, form);
    } else {
      addSubscriber(form);
    }
    setShowForm(false);
    showToast(t('successSaved'));
  };

  const handleDelete = (id: string) => {
    deleteSubscriber(id);
    setConfirmDel(null);
    showToast(t('successDeleted'));
  };

  const statusBadge = (s: MonthlySubscriber) => {
    if (s.remainingDays <= 0) return <span className="bg-red-100 text-red-600 text-xs px-2 py-0.5 rounded-full">{t('expired')}</span>;
    if (s.remainingDays <= 7) return <span className="bg-yellow-100 text-yellow-600 text-xs px-2 py-0.5 rounded-full">{s.remainingDays}d</span>;
    return <span className="bg-green-100 text-green-600 text-xs px-2 py-0.5 rounded-full">{t('active')} {s.remainingDays}d</span>;
  };

  return (
    <div className="p-4 md:p-6">
      <div className="flex items-center justify-between mb-6 print:hidden">
        <h1 className="text-xl font-bold text-gray-800">{t('monthlySubscribers')}</h1>
        <button onClick={openAdd} className="bg-blue-500 hover:bg-blue-600 text-white text-sm px-4 py-2 rounded-lg flex items-center gap-2">
          <span>+</span> {t('addSubscriber')}
        </button>
      </div>

      {toast && <div className="mb-4 bg-green-50 border border-green-200 text-green-700 rounded-lg px-4 py-3 text-sm print:hidden">{toast}</div>}

      <div className="mb-4 print:hidden">
        <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder={t('searchPlaceholder')}
          className="w-full max-w-sm border border-gray-200 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
      </div>

      <ReportShell
        title={t('monthlySubscribers')}
        filename={`subscribers_report_${new Date().toISOString().split('T')[0]}`}
        summary={
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div className="bg-gray-50 rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-blue-600">{subscribers.length}</p>
              <p className="text-sm text-gray-500 mt-1">{t('totalSubscribers')}</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-green-600">{subscribers.filter(s => s.paymentStatus === 'paid').length}</p>
              <p className="text-sm text-gray-500 mt-1">{t('paid')}</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-purple-600">{subscribers.reduce((a, s) => a + (s.paymentAmount || 0), 0).toLocaleString()} {t('iqd')}</p>
              <p className="text-sm text-gray-500 mt-1">{t('totalRevenue')}</p>
            </div>
          </div>
        }
      >
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400"><div className="text-5xl mb-3">📅</div><p>{t('noData')}</p></div>
      ) : (
        <div className="overflow-x-auto bg-white rounded-xl border border-gray-100">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                {[t('plateNumber'), t('driverName'), t('phoneNumber'), t('vehicleType'), t('vehicleColor'), t('startDate'), t('expirationDate'), t('remainingDays'), t('paymentAmount'), t('paymentStatus'), t('subscriberStats')].map(h => (
                  <th key={h} className="px-4 py-3 text-left font-semibold text-gray-600 whitespace-nowrap">{h}</th>
                ))}
                <th className="px-4 py-3 text-left font-semibold text-gray-600 whitespace-nowrap print:hidden">{t('actions')}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(s => (
                <tr key={s.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono font-semibold text-gray-800">
                    <button
                      onClick={() => setProfilePlate(s.plateNumber)}
                      className="hover:underline hover:text-blue-600 transition-colors"
                      title={t('customerProfile')}
                    >
                      {s.plateNumber}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-gray-700">{s.driverName}</td>
                  <td className="px-4 py-3 text-gray-600">{s.phoneNumber}</td>
                  <td className="px-4 py-3 text-gray-600">{s.vehicleType}</td>
                  <td className="px-4 py-3 text-gray-600">{s.vehicleColor}</td>
                  <td className="px-4 py-3 text-gray-600">{s.startDate}</td>
                  <td className="px-4 py-3 text-gray-600">{s.expirationDate}</td>
                  <td className="px-4 py-3">{statusBadge(s)}</td>
                  <td className="px-4 py-3 text-green-600 font-semibold">{s.paymentAmount.toLocaleString()} {t('iqd')}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${s.paymentStatus === 'paid' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                      {t(s.paymentStatus)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {(() => {
                      const st = visitStats[s.plateNumber] || EMPTY_STATS;
                      return (
                        <div className="flex flex-col gap-0.5 text-[11px] text-gray-500 whitespace-nowrap">
                          <span>{t('visitsToday')}: <b className="text-gray-700">{st.today}</b> · {t('visitsThisWeek')}: <b className="text-gray-700">{st.thisWeek}</b></span>
                          <span>{t('visitsThisMonth')}: <b className="text-gray-700">{st.thisMonth}</b> · {t('visitsThisYear')}: <b className="text-gray-700">{st.thisYear}</b></span>
                          <span>{t('visitsOverall')}: <b className="text-blue-600">{st.overall}</b></span>
                        </div>
                      );
                    })()}
                  </td>
                  <td className="px-4 py-3 print:hidden">
                    <div className="flex gap-2">
                      <button onClick={() => openEdit(s)} className="text-blue-500 hover:text-blue-700 text-xs border border-blue-200 px-2 py-1 rounded">{t('edit')}</button>
                      <button onClick={() => setConfirmDel(s.id)} className="text-red-500 hover:text-red-700 text-xs border border-red-200 px-2 py-1 rounded">{t('delete')}</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      </ReportShell>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-lg w-full shadow-2xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-gray-800 mb-4">{editId ? t('editSubscriber') : t('addSubscriber')}</h3>
            <form onSubmit={handleSubmit} className="space-y-3">
              {[
                { key: 'plateNumber', label: t('plateNumber') },
                { key: 'driverName', label: t('driverName') },
                { key: 'phoneNumber', label: t('phoneNumber') },
                { key: 'vehicleType', label: t('vehicleType') },
                { key: 'vehicleColor', label: t('vehicleColor') },
              ].map(f => (
                <div key={f.key}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{f.label}</label>
                  <input type="text" value={(form as any)[f.key]} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" required />
                </div>
              ))}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('startDate')}</label>
                  <input type="date" value={form.startDate} onChange={e => setForm(p => ({ ...p, startDate: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('subscriptionPeriod')}</label>
                  <input type="number" min={1} max={24} value={form.subscriptionPeriod} onChange={e => setForm(p => ({ ...p, subscriptionPeriod: +e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" required />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('paymentAmount')}</label>
                  <input type="number" min={0} value={form.paymentAmount} onChange={e => setForm(p => ({ ...p, paymentAmount: +e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('paymentStatus')}</label>
                  <select value={form.paymentStatus} onChange={e => setForm(p => ({ ...p, paymentStatus: e.target.value as 'paid' | 'unpaid' }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
                    <option value="paid">{t('paid')}</option>
                    <option value="unpaid">{t('unpaid')}</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('notes')}</label>
                <textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} rows={2}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowForm(false)} className="flex-1 py-2 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50">{t('cancel')}</button>
                <button type="submit" className="flex-1 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600">{t('save')}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirm Delete */}
      {confirmDel && (
        <ConfirmDialog
          title={t('confirmDeleteTitle')}
          message={t('confirmDelete')}
          onCancel={() => setConfirmDel(null)}
          onConfirm={() => handleDelete(confirmDel)}
        />
      )}

      {profilePlate && (
        <CustomerProfileModal plateNumber={profilePlate} onClose={() => setProfilePlate(null)} />
      )}
    </div>
  );
}
