'use client';
import React, { useState } from 'react';
import { useSPMS } from '@/lib/SPMSContext';
import { useLang } from '@/lib/LangContext';
import CustomerProfileModal from '@/components/CustomerProfileModal';
import ParkingReceipt from '@/components/ParkingReceipt';
import type { VehicleRecord } from '@/lib/types';

export default function ParkingHistory() {
  const { vehicles, settings, locations } = useSPMS();
  const { t } = useLang();
  const [search, setSearch] = useState('');
  const [searchField, setSearchField] = useState<'all' | 'plate' | 'driver' | 'space' | 'type' | 'date'>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);
  const [profilePlate, setProfilePlate] = useState<string | null>(null);
  const [receiptVehicle, setReceiptVehicle] = useState<VehicleRecord | null>(null);
  const perPage = 15;

  const history = vehicles
    ?.filter(v => v?.status === 'completed')
    ?.filter(v => {
      if (!search && !dateFrom && !dateTo) return true;
      const q = search.toLowerCase();
      let matches = true;
      if (search) {
        if (searchField === 'plate') matches = v.plateNumber.toLowerCase().includes(q);
        else if (searchField === 'driver') matches = (v.driverName || '').toLowerCase().includes(q);
        else if (searchField === 'space') matches = v.parkingSpaceNumber.toLowerCase().includes(q);
        else if (searchField === 'type') matches = (v.vehicleType || '').toLowerCase().includes(q);
        else if (searchField === 'date') matches = v.entryDate.includes(q);
        else matches = (
          v.plateNumber.toLowerCase().includes(q) ||
          (v.driverName || '').toLowerCase().includes(q) ||
          v.parkingSpaceNumber.toLowerCase().includes(q) ||
          (v.vehicleType || '').toLowerCase().includes(q) ||
          v.entryDate.includes(q)
        );
      }
      if (dateFrom && v.entryDate < dateFrom) matches = false;
      if (dateTo && v.entryDate > dateTo) matches = false;
      return matches;
    })
    ?.sort((a, b) => (b?.exitDate || '')?.localeCompare(a?.exitDate || ''));

  const totalPages = Math.ceil((history?.length || 0) / perPage);
  const paged = history?.slice((page - 1) * perPage, page * perPage);

  const handleExportCSV = () => {
    const headers = ['Plate', 'Driver', 'Space', 'Entry Date', 'Entry Time', 'Exit Date', 'Exit Time', 'Duration', 'Fee'];
    const rows = history?.map(v => [
      v.plateNumber, v.driverName || '', v.parkingSpaceNumber,
      v.entryDate, v.entryTime, v.exitDate || '', v.exitTime || '',
      v.duration || '', v.fee || 0,
    ]) || [];
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `parking_history_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-4 md:p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-gray-800">{t('parkingHistory')}</h1>
        <div className="flex items-center gap-2">
          <span className="bg-gray-100 text-gray-600 text-sm px-3 py-1 rounded-full">{history?.length} {t('total')}</span>
          <button
            onClick={handleExportCSV}
            className="bg-green-500 hover:bg-green-600 text-white text-xs px-3 py-1.5 rounded-lg transition-colors"
          >
            {t('exportExcel')}
          </button>
        </div>
      </div>

      {/* Search & Filter */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-4 space-y-3">
        <div className="flex flex-wrap gap-2">
          <select
            value={searchField}
            onChange={e => { setSearchField(e.target.value as typeof searchField); setPage(1); }}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          >
            <option value="all">{t('all')}</option>
            <option value="plate">{t('plateNumber')}</option>
            <option value="driver">{t('driverName')}</option>
            <option value="space">{t('parkingSpace')}</option>
            <option value="type">{t('vehicleType')}</option>
            <option value="date">{t('entryDate')}</option>
          </select>
          <input
            type="text"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            placeholder={t('searchPlaceholder')}
            className="flex-1 min-w-48 border border-gray-200 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-sm text-gray-500">{t('from')}:</span>
          <input type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setPage(1); }}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
          <span className="text-sm text-gray-500">{t('to')}:</span>
          <input type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); setPage(1); }}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
          {(search || dateFrom || dateTo) && (
            <button onClick={() => { setSearch(''); setDateFrom(''); setDateTo(''); setPage(1); }}
              className="px-3 py-1.5 text-sm text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50">{t('clear')}</button>
          )}
        </div>
      </div>

      {paged?.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <div className="text-5xl mb-3">📋</div>
          <p>{t('noData')}</p>
        </div>
      ) : (
        <>
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
                  <th className="px-4 py-3 text-left font-semibold text-gray-600">{t('exitDate')}</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600">{t('exitTime')}</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600">{t('duration')}</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600">{t('parkingFee')}</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600">{t('status')}</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600">{t('parkingReceipt')}</th>
                </tr>
              </thead>
              <tbody>
                {paged?.map((v, i) => (
                  <tr key={v?.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-400">{(page - 1) * perPage + i + 1}</td>
                    <td className="px-4 py-3 font-mono font-semibold text-gray-800">
                      <button
                        onClick={() => setProfilePlate(v?.plateNumber || '')}
                        className="hover:underline hover:text-blue-600 transition-colors"
                        title={t('customerProfile')}
                      >
                        {v?.plateNumber}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{v?.driverName || '-'}</td>
                    <td className="px-4 py-3"><span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded">{v?.parkingSpaceNumber}</span></td>
                    <td className="px-4 py-3 text-gray-600">{v?.entryDate}</td>
                    <td className="px-4 py-3 text-gray-600">{v?.entryTime}</td>
                    <td className="px-4 py-3 text-gray-600">{v?.exitDate || '-'}</td>
                    <td className="px-4 py-3 text-gray-600">{v?.exitTime || '-'}</td>
                    <td className="px-4 py-3 text-purple-600">{v?.duration || '-'}</td>
                    <td className="px-4 py-3 text-green-600 font-semibold">{v?.fee ? `${v?.fee?.toLocaleString()} ${t('iqd')}` : '-'}</td>
                    <td className="px-4 py-3"><span className="bg-gray-100 text-gray-600 text-xs px-2 py-1 rounded-full">{t('completed')}</span></td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => v && setReceiptVehicle(v)}
                        className="bg-gray-700 hover:bg-gray-800 text-white text-xs px-3 py-1.5 rounded-lg transition-colors"
                      >
                        🧾 {t('viewReceipt')}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 text-sm text-gray-500">
              <span>{t('page')} {page} {t('of')} {totalPages}</span>
              <div className="flex gap-2">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="px-3 py-1 border rounded disabled:opacity-40 hover:bg-gray-50">{t('previous')}</button>
                <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="px-3 py-1 border rounded disabled:opacity-40 hover:bg-gray-50">{t('next')}</button>
              </div>
            </div>
          )}
        </>
      )}

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
