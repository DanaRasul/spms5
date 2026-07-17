'use client';
import React, { useState, useEffect } from 'react';
import { useSPMS, getUserBranchId } from '@/lib/SPMSContext';
import { useLang } from '@/lib/LangContext';
import type { ParkingSpace } from '@/lib/types';
import ConfirmDialog from '@/components/ConfirmDialog';

export default function ParkingSpaces() {
  const { spaces, addSpace, updateSpace, deleteSpace, locations, updateLocation, currentUser } = useSPMS();
  const { t } = useLang();
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ spaceNumber: '', status: 'available' as 'available' | 'occupied' });
  const [search, setSearch] = useState('');
  const [toast, setToast] = useState('');
  const [confirmDel, setConfirmDel] = useState<string | null>(null);

  const branchId = getUserBranchId(currentUser);
  const myLocation = locations.find(l => l.id === branchId);
  const DEFAULT_RATES = { hourlyRate1: 1000, hourlyRate2: 1500, hourlyRate3: 2000 };
  const [rateForm, setRateForm] = useState(DEFAULT_RATES);
  const [savingRates, setSavingRates] = useState(false);

  useEffect(() => {
    if (myLocation) {
      // Safe defaults: if the API response is ever missing one of these fields
      // (e.g. a row from before the per-branch rate migration was applied),
      // fall back to the same defaults used on first render instead of undefined,
      // so these inputs always stay controlled.
      setRateForm({
        hourlyRate1: myLocation.hourlyRate1 ?? DEFAULT_RATES.hourlyRate1,
        hourlyRate2: myLocation.hourlyRate2 ?? DEFAULT_RATES.hourlyRate2,
        hourlyRate3: myLocation.hourlyRate3 ?? DEFAULT_RATES.hourlyRate3,
      });
    }
  }, [myLocation?.id, myLocation?.hourlyRate1, myLocation?.hourlyRate2, myLocation?.hourlyRate3]);

  const handleSaveRates = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!branchId || savingRates) return;
    setSavingRates(true);
    try {
      await updateLocation(branchId, rateForm);
      showToast(t('successSaved'));
    } catch {
      showToast(t('errorGeneral'));
    } finally {
      setSavingRates(false);
    }
  };

  const filtered = spaces.filter(s => !search || s.spaceNumber.toLowerCase().includes(search.toLowerCase()));
  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  const openAdd = () => { setForm({ spaceNumber: '', status: 'available' }); setEditId(null); setShowForm(true); };
  const openEdit = (s: ParkingSpace) => { setForm({ spaceNumber: s.spaceNumber, status: s.status }); setEditId(s.id); setShowForm(true); };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editId) updateSpace(editId, form);
    else addSpace(form);
    setShowForm(false);
    showToast(t('successSaved'));
  };

  const handleDelete = (id: string) => {
    const s = spaces.find(x => x.id === id);
    if (s?.status === 'occupied') { showToast(t('spaceNotAvailable')); setConfirmDel(null); return; }
    deleteSpace(id);
    setConfirmDel(null);
    showToast(t('successDeleted'));
  };

  const available = spaces.filter(s => s.status === 'available').length;
  const occupied = spaces.filter(s => s.status === 'occupied').length;

  return (
    <div className="p-4 md:p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-gray-800">{t('parkingSpaces')}</h1>
        <button onClick={openAdd} className="bg-blue-500 hover:bg-blue-600 text-white text-sm px-4 py-2 rounded-lg flex items-center gap-2">
          <span>+</span> {t('addSpace')}
        </button>
      </div>

      {toast && <div className="mb-4 bg-green-50 border border-green-200 text-green-700 rounded-lg px-4 py-3 text-sm">{toast}</div>}

      {branchId && (
        <form onSubmit={handleSaveRates} className="mb-6 bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <h2 className="font-semibold text-gray-700 mb-1 flex items-center gap-2">
            <span>💰</span> {t('parkingFeeRates')}
          </h2>
          <p className="text-xs text-gray-400 mb-3">{t('parkingFeeRatesHint')}</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 items-end">
            <div>
              <label className="block text-[11px] text-gray-500 mb-1">{t('hour1')}</label>
              <input
                type="number" min={0}
                value={rateForm.hourlyRate1}
                onChange={e => setRateForm(f => ({ ...f, hourlyRate1: parseFloat(e.target.value) || 0 }))}
                className="w-full border border-gray-200 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>
            <div>
              <label className="block text-[11px] text-gray-500 mb-1">{t('hour2')}</label>
              <input
                type="number" min={0}
                value={rateForm.hourlyRate2}
                onChange={e => setRateForm(f => ({ ...f, hourlyRate2: parseFloat(e.target.value) || 0 }))}
                className="w-full border border-gray-200 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>
            <div>
              <label className="block text-[11px] text-gray-500 mb-1">{t('hour3')}</label>
              <input
                type="number" min={0}
                value={rateForm.hourlyRate3}
                onChange={e => setRateForm(f => ({ ...f, hourlyRate3: parseFloat(e.target.value) || 0 }))}
                className="w-full border border-gray-200 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>
            <button
              type="submit"
              disabled={savingRates}
              className="bg-blue-500 hover:bg-blue-600 disabled:opacity-60 text-white text-sm font-medium px-4 py-2 rounded-lg"
            >
              {savingRates ? t('loading') : t('update')}
            </button>
          </div>
        </form>
      )}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-gray-100 p-4 text-center shadow-sm">
          <p className="text-2xl font-bold text-gray-700">{spaces.length}</p>
          <p className="text-sm text-gray-500">{t('totalSpaces')}</p>
        </div>
        <div className="bg-green-50 rounded-xl border border-green-100 p-4 text-center">
          <p className="text-2xl font-bold text-green-600">{available}</p>
          <p className="text-sm text-green-600">{t('availableSpaces')}</p>
        </div>
        <div className="bg-red-50 rounded-xl border border-red-100 p-4 text-center">
          <p className="text-2xl font-bold text-red-600">{occupied}</p>
          <p className="text-sm text-red-600">{t('occupiedSpaces')}</p>
        </div>
      </div>

      <div className="mb-4">
        <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder={t('search')}
          className="w-full max-w-sm border border-gray-200 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
      </div>

      {/* Grid View */}
      <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-2 mb-6">
        {filtered.map(s => (
          <div
            key={s.id}
            className={`relative p-2 rounded-lg border-2 text-center cursor-pointer transition-all ${s.status === 'available' ? 'bg-green-50 border-green-300 hover:border-green-500' : 'bg-red-50 border-red-300'}`}
            onClick={() => openEdit(s)}
          >
            <p className="text-xs font-bold text-gray-700">{s.spaceNumber}</p>
            <div className={`w-2 h-2 rounded-full mx-auto mt-1 ${s.status === 'available' ? 'bg-green-500' : 'bg-red-500'}`} />
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="overflow-x-auto bg-white rounded-xl shadow-sm border border-gray-100">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100">
              <th className="px-4 py-3 text-left font-semibold text-gray-600">#</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">{t('spaceNumber')}</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">{t('spaceStatus')}</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">{t('actions')}</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((s, i) => (
              <tr key={s.id} className="border-b border-gray-50 hover:bg-gray-50">
                <td className="px-4 py-3 text-gray-400">{i + 1}</td>
                <td className="px-4 py-3 font-semibold text-gray-800">{s.spaceNumber}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-1 rounded-full ${s.status === 'available' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    {t(s.status)}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    <button onClick={() => openEdit(s)} className="text-blue-500 hover:text-blue-700 text-xs border border-blue-200 px-2 py-1 rounded">{t('edit')}</button>
                    <button onClick={() => setConfirmDel(s.id)} disabled={s.status === 'occupied'} className="text-red-500 hover:text-red-700 text-xs border border-red-200 px-2 py-1 rounded disabled:opacity-40">{t('delete')}</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl">
            <h3 className="text-lg font-bold text-gray-800 mb-4">{editId ? t('editSpace') : t('addSpace')}</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('spaceNumber')}</label>
                <input type="text" value={form.spaceNumber} onChange={e => setForm(p => ({ ...p, spaceNumber: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('spaceStatus')}</label>
                <select value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value as 'available' | 'occupied' }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400">
                  <option value="available">{t('available')}</option>
                  <option value="occupied">{t('occupied')}</option>
                </select>
              </div>
              <div className="flex gap-3">
                <button type="button" onClick={() => setShowForm(false)} className="flex-1 py-2 border border-gray-200 rounded-lg text-gray-600">{t('cancel')}</button>
                <button type="submit" className="flex-1 py-2 bg-blue-500 text-white rounded-lg">{t('save')}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {confirmDel && (
        <ConfirmDialog
          title={t('confirmDeleteTitle')}
          message={t('confirmDelete')}
          onCancel={() => setConfirmDel(null)}
          onConfirm={() => handleDelete(confirmDel)}
        />
      )}
    </div>
  );
}
