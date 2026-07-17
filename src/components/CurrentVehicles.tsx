'use client';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useSPMS, calculateFee, getEffectiveLocationId, getUserBranchId } from '@/lib/SPMSContext';
import { useLang } from '@/lib/LangContext';
import ParkingTicket from '@/components/ParkingTicket';
import CustomerProfileModal from '@/components/CustomerProfileModal';
import ParkingReceipt from '@/components/ParkingReceipt';
import type { VehicleRecord } from '@/lib/types';

interface EditModalProps {
  vehicle: VehicleRecord;
  onClose: () => void;
  onSave: (id: string, fields: Partial<Pick<VehicleRecord, 'plateNumber' | 'parkingSpaceNumber' | 'vehicleType' | 'vehicleColor' | 'driverName'>>) => Promise<void>;
  availableSpaces: string[];
  t: (k: string) => string;
}

function EditModal({ vehicle, onClose, onSave, availableSpaces, t }: EditModalProps) {
  const [form, setForm] = useState({
    plateNumber: vehicle.plateNumber,
    parkingSpaceNumber: vehicle.parkingSpaceNumber,
    vehicleType: vehicle.vehicleType || '',
    vehicleColor: vehicle.vehicleColor || '',
    driverName: vehicle.driverName || '',
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    try {
      await onSave(vehicle.id, form);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl">
        <h3 className="text-lg font-bold text-gray-800 mb-1">{t('editVehicleInfo')}</h3>
        <p className="text-sm text-gray-500 mb-4">{t('plateNumber')}: <span className="font-mono font-semibold">{vehicle.plateNumber}</span></p>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">{t('plateNumber')}</label>
            <input type="text" value={form.plateNumber} onChange={e => setForm(f => ({ ...f, plateNumber: e.target.value }))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" required disabled={saving} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">{t('parkingSpace')}</label>
            <select value={form.parkingSpaceNumber} onChange={e => setForm(f => ({ ...f, parkingSpaceNumber: e.target.value }))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" disabled={saving}>
              <option value={vehicle.parkingSpaceNumber}>{vehicle.parkingSpaceNumber} ({t('current')})</option>
              {availableSpaces.filter(s => s !== vehicle.parkingSpaceNumber).map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">{t('driverName')}</label>
            <input type="text" value={form.driverName} onChange={e => setForm(f => ({ ...f, driverName: e.target.value }))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" disabled={saving} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">{t('vehicleType')}</label>
            <input type="text" value={form.vehicleType} onChange={e => setForm(f => ({ ...f, vehicleType: e.target.value }))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" disabled={saving} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">{t('vehicleColor')}</label>
            <input type="text" value={form.vehicleColor} onChange={e => setForm(f => ({ ...f, vehicleColor: e.target.value }))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" disabled={saving} />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} disabled={saving} className="flex-1 py-2 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 text-sm disabled:opacity-50">{t('cancel')}</button>
            <button type="submit" disabled={saving} className="flex-1 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 text-sm font-medium disabled:opacity-50">{saving ? '...' : t('save')}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function CurrentVehicles() {
  const { vehicles, registerExit, updateVehicle, settings, spaces, selectedLocationId, locations, currentUser } = useSPMS();
  const { t } = useLang();
  const [liveVehicles, setLiveVehicles] = useState<(VehicleRecord & { liveFee: number; liveDuration: string })[]>([]);
  const [confirmExit, setConfirmExit] = useState<string | null>(null);
  const [editVehicle, setEditVehicle] = useState<VehicleRecord | null>(null);
  const [qrVehicle, setQrVehicle] = useState<VehicleRecord | null>(null);
  const [profilePlate, setProfilePlate] = useState<string | null>(null);
  const [receiptVehicle, setReceiptVehicle] = useState<VehicleRecord | null>(null);
  const [toast, setToast] = useState('');
  const [toastType, setToastType] = useState<'success' | 'error'>('success');
  const [search, setSearch] = useState('');
  const [searchField, setSearchField] = useState<'all' | 'plate' | 'driver' | 'space' | 'type'>('all');
  const [exitingId, setExitingId] = useState<string | null>(null);
  const exitInFlight = useRef(false);

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast(msg);
    setToastType(type);
    setTimeout(() => setToast(''), 3000);
  };

  const computeLive = useCallback(() => {
    const inside = vehicles.filter(v => v.status === 'inside');
    return inside.map(v => {
      const loc = locations.find(l => l.id === v.locationId);
      const rates = {
        hourlyRate1: loc?.hourlyRate1 ?? settings.hourlyRate1,
        hourlyRate2: loc?.hourlyRate2 ?? settings.hourlyRate2,
        hourlyRate3: loc?.hourlyRate3 ?? settings.hourlyRate3,
      };
      const { fee, duration } = calculateFee(v.entryDate, v.entryTime, rates);
      return { ...v, liveFee: fee, liveDuration: duration };
    });
  }, [vehicles, settings, locations]);

  useEffect(() => {
    setLiveVehicles(computeLive());
    const interval = setInterval(() => setLiveVehicles(computeLive()), 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [computeLive]);

  const handleExit = async (id: string) => {
    if (exitInFlight.current) return;
    exitInFlight.current = true;
    setExitingId(id);
    try {
      const result = await registerExit(id);
      setConfirmExit(null);
      showToast(t(result.message), result.success ? 'success' : 'error');
      if (result.success && result.vehicle) setReceiptVehicle(result.vehicle);
    } finally {
      exitInFlight.current = false;
      setExitingId(null);
    }
  };

  const handleSaveEdit = async (
    id: string,
    fields: Partial<Pick<VehicleRecord, 'plateNumber' | 'parkingSpaceNumber' | 'vehicleType' | 'vehicleColor' | 'driverName'>>
  ) => {
    const result = await updateVehicle(id, fields);
    if (result.success) {
      setEditVehicle(null);
    }
    showToast(t(result.message), result.success ? 'success' : 'error');
  };

  const branchId = getUserBranchId(currentUser);
  const effectiveLocationId = getEffectiveLocationId(branchId, selectedLocationId, locations) ?? '';

  const availableSpaceNumbers = spaces
    .filter(s => s.status === 'available' && (!effectiveLocationId || s.locationId === effectiveLocationId))
    .map(s => s.spaceNumber);

  const filtered = liveVehicles.filter(v => {
    if (!search) return true;
    const q = search.toLowerCase();
    if (searchField === 'plate') return v.plateNumber.toLowerCase().includes(q);
    if (searchField === 'driver') return (v.driverName || '').toLowerCase().includes(q);
    if (searchField === 'space') return v.parkingSpaceNumber.toLowerCase().includes(q);
    if (searchField === 'type') return (v.vehicleType || '').toLowerCase().includes(q);
    return (
      v.plateNumber.toLowerCase().includes(q) ||
      (v.driverName || '').toLowerCase().includes(q) ||
      v.parkingSpaceNumber.toLowerCase().includes(q) ||
      (v.vehicleType || '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="p-4 md:p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-gray-800">{t('currentVehicles')}</h1>
        <span className="bg-blue-100 text-blue-700 text-sm font-medium px-3 py-1 rounded-full">{liveVehicles.length} {t('inside')}</span>
      </div>

      {toast && (
        <div className={`mb-4 border rounded-lg px-4 py-3 text-sm ${toastType === 'success' ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'}`}>{toast}</div>
      )}

      {/* Search Bar */}
      <div className="flex flex-wrap gap-2 mb-4">
        <select
          value={searchField}
          onChange={e => setSearchField(e.target.value as typeof searchField)}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
        >
          <option value="all">{t('all')}</option>
          <option value="plate">{t('plateNumber')}</option>
          <option value="driver">{t('driverName')}</option>
          <option value="space">{t('parkingSpace')}</option>
          <option value="type">{t('vehicleType')}</option>
        </select>
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder={t('searchPlaceholder')}
          className="flex-1 min-w-48 border border-gray-200 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
        />
        {search && (
          <button onClick={() => setSearch('')} className="px-3 py-2 text-sm text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50">{t('clear')}</button>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <div className="text-5xl mb-3">🚗</div>
          <p>{t('noData')}</p>
        </div>
      ) : (
        <div className="overflow-x-auto bg-white rounded-xl shadow-sm border border-gray-100">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="px-4 py-3 text-left font-semibold text-gray-600">#</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600">{t('plateNumber')}</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600">{t('driverName')}</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600">{t('parkingSpace')}</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600">{t('entryDate')}</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600">{t('entryTime')}</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600">{t('duration')}</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600">{t('parkingFee')}</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600">{t('actions')}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((v, i) => (
                <tr key={v.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 text-gray-400">{i + 1}</td>
                  <td className="px-4 py-3 font-mono font-semibold text-gray-800">
                    <button
                      onClick={() => setProfilePlate(v.plateNumber)}
                      className="hover:underline hover:text-blue-600 transition-colors"
                      title={t('customerProfile')}
                    >
                      {v.plateNumber}
                    </button>
                    {v.editHistory && v.editHistory.length > 0 && (
                      <span className="ml-1 text-xs bg-yellow-100 text-yellow-700 px-1 rounded" title={`${v.editHistory.length} edit(s)`}>✏️</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{v.driverName || '-'}</td>
                  <td className="px-4 py-3">
                    <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded font-medium">{v.parkingSpaceNumber}</span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{v.entryDate}</td>
                  <td className="px-4 py-3 text-gray-600">{v.entryTime}</td>
                  <td className="px-4 py-3 text-purple-600 font-medium">{v.liveDuration}</td>
                  <td className="px-4 py-3 text-green-600 font-semibold">{v.liveFee.toLocaleString()} {t('iqd')}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      <button
                        onClick={() => setQrVehicle(v)}
                        disabled={exitingId === v.id}
                        className="bg-gray-700 hover:bg-gray-800 text-white text-xs px-2 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                        title={t('viewQrCode')}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <rect x="3" y="3" width="7" height="7" rx="1"/>
                          <rect x="14" y="3" width="7" height="7" rx="1"/>
                          <rect x="3" y="14" width="7" height="7" rx="1"/>
                          <path d="M14 14h3v3h-3zM20 14v3M17 20h3M14 20h.01"/>
                        </svg>
                      </button>
                      <button
                        onClick={() => setEditVehicle(v)}
                        disabled={exitingId === v.id}
                        className="bg-blue-500 hover:bg-blue-600 text-white text-xs px-2 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                        title={t('editVehicle')}
                      >
                        ✏️
                      </button>
                      <button
                        onClick={() => setConfirmExit(v.id)}
                        disabled={exitingId === v.id}
                        className="bg-red-500 hover:bg-red-600 text-white text-xs px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                      >
                        {t('exitVehicle')}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Confirm Exit Modal */}
      {confirmExit && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl">
            <div className="text-center mb-4">
              <div className="text-4xl mb-2">🚗</div>
              <h3 className="text-lg font-bold text-gray-800">{t('registerExit')}</h3>
              <p className="text-gray-500 text-sm mt-1">{t('confirmDelete')}</p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setConfirmExit(null)} disabled={!!exitingId} className="flex-1 py-2 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 disabled:opacity-50">{t('cancel')}</button>
              <button onClick={() => handleExit(confirmExit)} disabled={!!exitingId} className="flex-1 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50">{exitingId ? '...' : t('confirm')}</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Vehicle Modal */}
      {editVehicle && (
        <EditModal
          vehicle={editVehicle}
          onClose={() => setEditVehicle(null)}
          onSave={handleSaveEdit}
          availableSpaces={availableSpaceNumbers}
          t={t}
        />
      )}

      {/* QR Ticket Modal */}
      {qrVehicle && (() => {
        const qrLocation = locations.find(l => l.id === qrVehicle.locationId);
        return (
          <ParkingTicket
            vehicle={qrVehicle}
            locationName={qrLocation?.name || ''}
            locationAddress={qrLocation?.address}
            locationPhone={qrLocation?.phoneNumber}
            onClose={() => setQrVehicle(null)}
          />
        );
      })()}

      {profilePlate && (
        <CustomerProfileModal plateNumber={profilePlate} onClose={() => setProfilePlate(null)} />
      )}

      {receiptVehicle && (() => {
        const receiptLocation = locations.find(l => l.id === receiptVehicle.locationId);
        return (
          <ParkingReceipt
            vehicle={receiptVehicle}
            locationName={receiptLocation?.name || settings.parkingName || ''}
            locationAddress={receiptLocation?.address || settings.address}
            locationPhone={receiptLocation?.phoneNumber || settings.phoneNumber}
            companyLogo={settings.companyLogo}
            companyWebsite={settings.companyWebsite}
            currency={settings.currency}
            onClose={() => setReceiptVehicle(null)}
          />
        );
      })()}
    </div>
  );
}
