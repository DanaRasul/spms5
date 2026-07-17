'use client';
import React, { useState } from 'react';
import { useSPMS, getEffectiveLocationId, getUserBranchId, getParkingAvailability } from '@/lib/SPMSContext';
import { useLang } from '@/lib/LangContext';
import ParkingTicket from '@/components/ParkingTicket';
import type { VehicleRecord } from '@/lib/types';

export default function VehicleEntry() {
  const { registerEntry, spaces, settings, locations, selectedLocationId, setSelectedLocationId, currentUser, loading: dataLoading, dataLoaded } = useSPMS();
  const { t } = useLang();
  const [plateNumber, setPlateNumber] = useState('');
  const [spaceNumber, setSpaceNumber] = useState('');
  const [driverName, setDriverName] = useState('');
  const [vehicleType, setVehicleType] = useState('');
  const [vehicleColor, setVehicleColor] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [showExtra, setShowExtra] = useState(false);
  const [ticketVehicle, setTicketVehicle] = useState<VehicleRecord | null>(null);

  const branchId = getUserBranchId(currentUser);
  const effectiveLocationId = getEffectiveLocationId(branchId, selectedLocationId, locations) ?? '';
  const activeLocations = locations.filter(l => l.status === 'active');
  const effectiveLocation = locations.find(l => l.id === effectiveLocationId);
  const rates = {
    hourlyRate1: effectiveLocation?.hourlyRate1 ?? settings.hourlyRate1,
    hourlyRate2: effectiveLocation?.hourlyRate2 ?? settings.hourlyRate2,
    hourlyRate3: effectiveLocation?.hourlyRate3 ?? settings.hourlyRate3,
  };

  const parkingStatus = getParkingAvailability(spaces, {
    branchId,
    selectedLocationId,
    entryLocationId: effectiveLocationId || null,
  });
  const locationSpaces = parkingStatus.availableSpaces;
  const isFull = dataLoaded && !dataLoading && parkingStatus.isFull;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setSuccess('');
    if (!plateNumber.trim()) { setError(t('required')); return; }
    if (!spaceNumber.trim()) { setError(t('required')); return; }
    setLoading(true);
    try {
      const result = await registerEntry(
        plateNumber.trim(),
        spaceNumber.trim(),
        effectiveLocationId,
        { driverName: driverName.trim() || undefined, vehicleType: vehicleType.trim() || undefined, vehicleColor: vehicleColor.trim() || undefined }
      );
      if (result.success) {
        setSuccess(t(result.message));
        setPlateNumber('');
        setSpaceNumber('');
        setDriverName('');
        setVehicleType('');
        setVehicleColor('');
        if (result.vehicle) setTicketVehicle(result.vehicle);
      } else {
        setError(t(result.message));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 md:p-6">
      <h1 className="text-xl font-bold text-gray-800 mb-6">{t('vehicleEntry')}</h1>

      {isFull && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3 mb-6">
          <span className="text-2xl">🚫</span>
          <div>
            <p className="font-semibold text-red-700">{t('parkingFull')}</p>
            <p className="text-sm text-red-500">{t('parkingFullMsg')}</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Entry Form */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="font-semibold text-gray-700 mb-4 flex items-center gap-2">
            <span>🔑</span> {t('registerEntry')}
          </h2>

          {error && <div className="bg-red-50 border border-red-200 text-red-600 rounded-lg px-4 py-3 mb-4 text-sm">{error}</div>}
          {success && <div className="bg-green-50 border border-green-200 text-green-600 rounded-lg px-4 py-3 mb-4 text-sm">{success}</div>}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Location Selector */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('parkingLocations')}</label>
              <select
                value={effectiveLocationId}
                onChange={e => { setSelectedLocationId(e.target.value); setSpaceNumber(''); }}
                className="w-full border border-gray-200 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-400 text-gray-800"
              >
                {activeLocations.map(loc => (
                  <option key={loc.id} value={loc.id}>{loc.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('plateNumber')} *</label>
              <input
                type="text"
                value={plateNumber}
                onChange={e => setPlateNumber(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-400 text-gray-800"
                placeholder="e.g. هەولێر١٢٣٤٥ or ABC-1234"
                disabled={!dataLoaded || dataLoading || isFull}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('parkingSpace')} *</label>
              <select
                value={spaceNumber}
                onChange={e => setSpaceNumber(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-400 text-gray-800"
                disabled={!dataLoaded || dataLoading || isFull}
              >
                <option value="">{t('selectSpace')}</option>
                {locationSpaces.map(s => (
                  <option key={s.id} value={s.spaceNumber}>{s.spaceNumber}</option>
                ))}
              </select>
              <p className="text-xs text-gray-400 mt-1">{locationSpaces.length} {t('availableSpaces')}</p>
            </div>

            {/* Optional Details Toggle */}
            <button type="button" onClick={() => setShowExtra(!showExtra)}
              className="text-sm text-blue-500 hover:text-blue-700 flex items-center gap-1">
              {showExtra ? '▲' : '▼'} {t('details')} ({t('driverName')}, {t('vehicleType')}, {t('vehicleColor')})
            </button>

            {showExtra && (
              <div className="space-y-3 border border-gray-100 rounded-lg p-3 bg-gray-50">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">{t('driverName')}</label>
                  <input type="text" value={driverName} onChange={e => setDriverName(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">{t('vehicleType')}</label>
                  <input type="text" value={vehicleType} onChange={e => setVehicleType(e.target.value)}
                    placeholder="e.g. Toyota Corolla"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">{t('vehicleColor')}</label>
                  <input type="text" value={vehicleColor} onChange={e => setVehicleColor(e.target.value)}
                    placeholder="e.g. White"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !dataLoaded || dataLoading || isFull}
              className="w-full bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 text-white font-semibold py-3 rounded-lg transition-colors"
            >
              {loading ? t('loading') : t('registerEntry')}
            </button>
          </form>
        </div>

        {/* Fee Info */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="font-semibold text-gray-700 mb-4 flex items-center gap-2">
            <span>💰</span> {t('feeCalculation')}
          </h2>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
              <span className="text-sm text-gray-600">{t('hour1')} (≤ 60 min)</span>
              <span className="font-bold text-blue-600">{rates.hourlyRate1.toLocaleString()} {t('iqd')}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-orange-50 rounded-lg">
              <span className="text-sm text-gray-600">{t('hour2')} (61-120 min)</span>
              <span className="font-bold text-orange-600">{(rates.hourlyRate1 + rates.hourlyRate2).toLocaleString()} {t('iqd')}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
              <span className="text-sm text-gray-600">{t('hour3')} (per extra hour)</span>
              <span className="font-bold text-red-600">+{rates.hourlyRate3.toLocaleString()} {t('iqd')}</span>
            </div>
          </div>

          <div className="mt-4 p-3 bg-gray-50 rounded-lg">
            <h3 className="text-sm font-medium text-gray-600 mb-2">{t('availableSpaces')}</h3>
            <div className="flex flex-wrap gap-1 max-h-32 overflow-y-auto">
              {locationSpaces.slice(0, 30).map(s => (
                <button
                  key={s.id}
                  onClick={() => setSpaceNumber(s.spaceNumber)}
                  className={`text-xs px-2 py-1 rounded border transition-colors ${spaceNumber === s.spaceNumber ? 'bg-blue-500 text-white border-blue-500' : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300'}`}
                >
                  {s.spaceNumber}
                </button>
              ))}
              {locationSpaces.length > 30 && <span className="text-xs text-gray-400 self-center">+{locationSpaces.length - 30} more</span>}
            </div>
          </div>
        </div>
      </div>

      {ticketVehicle && (() => {
        const ticketLocation = locations.find(l => l.id === ticketVehicle.locationId);
        return (
          <ParkingTicket
            vehicle={ticketVehicle}
            locationName={ticketLocation?.name || ''}
            locationAddress={ticketLocation?.address}
            locationPhone={ticketLocation?.phoneNumber}
            onClose={() => setTicketVehicle(null)}
          />
        );
      })()}
    </div>
  );
}
