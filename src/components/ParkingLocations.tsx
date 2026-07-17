'use client';
import React, { useState } from 'react';
import { useSPMS } from '@/lib/SPMSContext';
import { useLang } from '@/lib/LangContext';
import type { ParkingLocation } from '@/lib/types';
import ConfirmDialog from '@/components/ConfirmDialog';

type CreateFormData = {
  name: string;
  prefix: string;
  capacity: number;
  hourlyRate1: number;
  hourlyRate2: number;
  hourlyRate3: number;
};

type EditFormData = CreateFormData & {
  status: 'active' | 'inactive';
};

const emptyCreateForm: CreateFormData = {
  name: '',
  prefix: 'A',
  capacity: 20,
  hourlyRate1: 1000,
  hourlyRate2: 1500,
  hourlyRate3: 2000,
};

export default function ParkingLocations() {
  const { locations, addLocation, updateLocation, deleteLocation, toggleLocationStatus, vehicles } = useSPMS();
  const { t } = useLang();
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [createForm, setCreateForm] = useState<CreateFormData>(emptyCreateForm);
  const [editForm, setEditForm] = useState<EditFormData>({ ...emptyCreateForm, status: 'active' });
  const [toast, setToast] = useState('');
  const [toastType, setToastType] = useState<'success' | 'error'>('success');
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast(msg);
    setToastType(type);
    setTimeout(() => setToast(''), 3500);
  };

  const openAdd = () => {
    setEditId(null);
    setCreateForm(emptyCreateForm);
    setShowForm(true);
  };

  const openEdit = (loc: ParkingLocation) => {
    setEditId(loc.id);
    setEditForm({
      name: loc.name,
      prefix: loc.spacePrefix || 'A',
      capacity: loc.capacity,
      status: loc.status,
      hourlyRate1: loc.hourlyRate1 ?? emptyCreateForm.hourlyRate1,
      hourlyRate2: loc.hourlyRate2 ?? emptyCreateForm.hourlyRate2,
      hourlyRate3: loc.hourlyRate3 ?? emptyCreateForm.hourlyRate3,
    });
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const form = editId ? editForm : createForm;

    if (!form.name.trim() || !form.prefix.trim() || form.capacity < 1) {
      showToast(t('required'), 'error');
      return;
    }

    if (editId) {
      try {
        await updateLocation(editId, {
          name: editForm.name.trim(),
          prefix: editForm.prefix.trim(),
          capacity: editForm.capacity,
          status: editForm.status,
          hourlyRate1: editForm.hourlyRate1,
          hourlyRate2: editForm.hourlyRate2,
          hourlyRate3: editForm.hourlyRate3,
        });
        showToast(t('successSaved'));
        setShowForm(false);
      } catch (err: any) {
        showToast(t(err.message || 'errorGeneral'), 'error');
      }
    } else {
      const result = await addLocation({
        name: createForm.name.trim(),
        address: createForm.name.trim(),
        phoneNumber: '',
        capacity: createForm.capacity,
        spacePrefix: createForm.prefix.trim(),
        status: 'active',
        hourlyRate1: createForm.hourlyRate1,
        hourlyRate2: createForm.hourlyRate2,
        hourlyRate3: createForm.hourlyRate3,
      });
      showToast(t(result.message), result.success ? 'success' : 'error');
      if (result.success) setShowForm(false);
    }
  };

  const handleDelete = async (id: string) => {
    const result = await deleteLocation(id);
    showToast(t(result.message), result.success ? 'success' : 'error');
    setConfirmDelete(null);
  };

  const getActiveVehicleCount = (locationId: string) =>
    vehicles.filter(v => v.locationId === locationId && v.status === 'inside').length;

  const form = editId ? editForm : createForm;

  return (
    <div className="p-4 md:p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-gray-800">{t('parkingLocations')}</h1>
        <button
          onClick={openAdd}
          className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors"
        >
          <span>+</span> {t('addLocation')}
        </button>
      </div>

      {toast && (
        <div className={`mb-4 border rounded-lg px-4 py-3 text-sm ${toastType === 'success' ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
          {toast}
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 text-center">
          <p className="text-3xl font-bold text-blue-600">{locations.length}</p>
          <p className="text-sm text-gray-500 mt-1">{t('totalLocations')}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 text-center">
          <p className="text-3xl font-bold text-green-600">{locations.filter(l => l.status === 'active').length}</p>
          <p className="text-sm text-gray-500 mt-1">{t('activeLocations')}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 text-center">
          <p className="text-3xl font-bold text-purple-600">{locations.reduce((a, l) => a + l.capacity, 0)}</p>
          <p className="text-sm text-gray-500 mt-1">{t('totalCapacity')}</p>
        </div>
      </div>

      {locations.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <div className="text-5xl mb-3">🏢</div>
          <p>{t('noLocations')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {locations.map(loc => {
            const activeVehicles = getActiveVehicleCount(loc.id);
            const prefix = loc.spacePrefix || '?';
            return (
              <div key={loc.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center text-xl">🏢</div>
                    <div>
                      <h3 className="font-semibold text-gray-800">{loc.name}</h3>
                      <p className="text-xs text-gray-500">{prefix}01 – {prefix}{String(loc.capacity).padStart(2, '0')}</p>
                    </div>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${loc.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {loc.status === 'active' ? t('active') : t('inactive')}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div className="text-center p-2 bg-gray-50 rounded-lg">
                    <p className="text-lg font-bold text-gray-700">{loc.capacity}</p>
                    <p className="text-xs text-gray-400">{t('totalCapacity')}</p>
                  </div>
                  <div className="text-center p-2 bg-green-50 rounded-lg">
                    <p className="text-lg font-bold text-green-600">{activeVehicles}</p>
                    <p className="text-xs text-gray-400">{t('inside')}</p>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs bg-blue-50 rounded-lg px-3 py-2 mb-4">
                  <span className="text-gray-500">{t('parkingFeeRates')}</span>
                  <span className="font-semibold text-blue-700">
                    {loc.hourlyRate1.toLocaleString()} / {loc.hourlyRate2.toLocaleString()} / {loc.hourlyRate3.toLocaleString()} {t('iqd')}
                  </span>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => openEdit(loc)}
                    className="flex-1 py-1.5 text-xs border border-blue-200 text-blue-600 rounded-lg hover:bg-blue-50 transition-colors"
                  >
                    {t('edit')}
                  </button>
                  <button
                    onClick={() => toggleLocationStatus(loc.id)}
                    className={`flex-1 py-1.5 text-xs border rounded-lg transition-colors ${loc.status === 'active' ? 'border-orange-200 text-orange-600 hover:bg-orange-50' : 'border-green-200 text-green-600 hover:bg-green-50'}`}
                  >
                    {loc.status === 'active' ? t('deactivateLocation') : t('activateLocation')}
                  </button>
                  <button
                    onClick={() => setConfirmDelete(loc.id)}
                    className="flex-1 py-1.5 text-xs border border-red-200 text-red-600 rounded-lg hover:bg-red-50 transition-colors"
                    disabled={activeVehicles > 0}
                    title={activeVehicles > 0 ? t('cannotDeleteLocationWithVehicles') : ''}
                  >
                    {t('delete')}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl">
            <h3 className="text-lg font-bold text-gray-800 mb-4">
              {editId ? t('editLocation') : t('addLocation')}
            </h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('locationName')} *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => editId
                    ? setEditForm(f => ({ ...f, name: e.target.value }))
                    : setCreateForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="Branch A"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('spacePrefix')} *</label>
                <input
                  type="text"
                  maxLength={1}
                  value={form.prefix}
                  onChange={e => editId
                    ? setEditForm(f => ({ ...f, prefix: e.target.value.toUpperCase() }))
                    : setCreateForm(f => ({ ...f, prefix: e.target.value.toUpperCase() }))}
                  placeholder="A"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 uppercase"
                  required
                />
                <p className="text-xs text-gray-400 mt-1">{t('spacePrefixHint')}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('locationCapacity')} *</label>
                <input
                  type="number"
                  min={1}
                  value={form.capacity}
                  onChange={e => editId
                    ? setEditForm(f => ({ ...f, capacity: parseInt(e.target.value, 10) || 1 }))
                    : setCreateForm(f => ({ ...f, capacity: parseInt(e.target.value, 10) || 1 }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('parkingFeeRates')}</label>
                <p className="text-xs text-gray-400 mb-2">{t('parkingFeeRatesHint')}</p>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-[11px] text-gray-500 mb-1">{t('hour1')}</label>
                    <input
                      type="number" min={0}
                      value={form.hourlyRate1}
                      onChange={e => editId
                        ? setEditForm(f => ({ ...f, hourlyRate1: parseFloat(e.target.value) || 0 }))
                        : setCreateForm(f => ({ ...f, hourlyRate1: parseFloat(e.target.value) || 0 }))}
                      className="w-full border border-gray-200 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-gray-500 mb-1">{t('hour2')}</label>
                    <input
                      type="number" min={0}
                      value={form.hourlyRate2}
                      onChange={e => editId
                        ? setEditForm(f => ({ ...f, hourlyRate2: parseFloat(e.target.value) || 0 }))
                        : setCreateForm(f => ({ ...f, hourlyRate2: parseFloat(e.target.value) || 0 }))}
                      className="w-full border border-gray-200 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-gray-500 mb-1">{t('hour3')}</label>
                    <input
                      type="number" min={0}
                      value={form.hourlyRate3}
                      onChange={e => editId
                        ? setEditForm(f => ({ ...f, hourlyRate3: parseFloat(e.target.value) || 0 }))
                        : setCreateForm(f => ({ ...f, hourlyRate3: parseFloat(e.target.value) || 0 }))}
                      className="w-full border border-gray-200 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                    />
                  </div>
                </div>
              </div>
              {editId && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('locationStatus')}</label>
                  <select
                    value={editForm.status}
                    onChange={e => setEditForm(f => ({ ...f, status: e.target.value as 'active' | 'inactive' }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                  >
                    <option value="active">{t('active')}</option>
                    <option value="inactive">{t('inactive')}</option>
                  </select>
                </div>
              )}
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowForm(false)} className="flex-1 py-2 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 text-sm">{t('cancel')}</button>
                <button type="submit" className="flex-1 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 text-sm font-medium">{editId ? t('update') : t('add')}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {confirmDelete && (
        <ConfirmDialog
          title={t('deleteLocation')}
          message={t('confirmDelete')}
          onCancel={() => setConfirmDelete(null)}
          onConfirm={() => handleDelete(confirmDelete)}
        />
      )}
    </div>
  );
}
