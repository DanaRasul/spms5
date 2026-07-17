'use client';
import React, { useState, useEffect } from 'react';
import { useSPMS } from '@/lib/SPMSContext';
import { useLang } from '@/lib/LangContext';

interface LoyaltyInfo {
  id: string;
  licensePlate: string;
  customerName: string | null;
  totalVisits: number;
  availableRewards: number;
  totalRewardsEarned: number;
  lastVisit: string | null;
}

export default function SearchPage() {
  const { vehicles, subscribers } = useSPMS();
  const { t } = useLang();
  const [query, setQuery] = useState('');
  const [type, setType] = useState<'all' | 'vehicles' | 'subscribers'>('all');
  const [loyaltyMap, setLoyaltyMap] = useState<Record<string, LoyaltyInfo>>({});
  const [visitsRequired, setVisitsRequired] = useState(10);
  const [loyaltyEnabled, setLoyaltyEnabled] = useState(true);

  const q = query.toLowerCase().trim();

  const vehicleResults = q ? vehicles.filter(v =>
    v.plateNumber.toLowerCase().includes(q) ||
    v.entryDate.includes(q) ||
    v.parkingSpaceNumber.toLowerCase().includes(q)
  ) : [];

  const subscriberResults = q ? subscribers.filter(s =>
    s.plateNumber.toLowerCase().includes(q) ||
    s.driverName.toLowerCase().includes(q) ||
    (s.phoneNumber || '').includes(q)
  ) : [];

  // Fetch loyalty info for found plates
  useEffect(() => {
    if (!q) return;
    const plates = new Set<string>();
    vehicleResults.forEach(v => plates.add(v.plateNumber));
    subscriberResults.forEach(s => plates.add(s.plateNumber));

    plates.forEach(async (plate) => {
      if (loyaltyMap[plate]) return;
      try {
        const res = await fetch(`/api/loyalty/lookup?plate=${encodeURIComponent(plate)}`);
        if (res.ok) {
          const data = await res.json();
          setLoyaltyEnabled(data.enabled);
          setVisitsRequired(data.visitsRequired || 10);
          if (data.loyalty) {
            setLoyaltyMap(prev => ({ ...prev, [plate]: data.loyalty }));
          }
        }
      } catch {}
    });
  }, [q]);

  const showVehicles = type === 'all' || type === 'vehicles';
  const showSubs = type === 'all' || type === 'subscribers';

  const LoyaltyBadge = ({ plate }: { plate: string }) => {
    if (!loyaltyEnabled) return null;
    const loyalty = loyaltyMap[plate];
    if (!loyalty) return null;

    if (loyalty.availableRewards > 0) {
      return (
        <span className="inline-flex items-center gap-1 text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium ml-1">
          🎁 Free Parking Available
        </span>
      );
    }

    const pct = Math.min(100, Math.round((loyalty.totalVisits / visitsRequired) * 100));
    const isNear = loyalty.totalVisits >= visitsRequired - 2;

    return (
      <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ml-1 ${isNear ? 'bg-yellow-100 text-yellow-700' : 'bg-blue-100 text-blue-700'}`}>
        ⭐ Loyalty: {loyalty.totalVisits} / {visitsRequired}
      </span>
    );
  };

  return (
    <div className="p-4 md:p-6">
      <h1 className="text-xl font-bold text-gray-800 mb-6">{t('search')}</h1>

      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder={t('searchPlaceholder')}
          className="flex-1 border border-gray-200 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-400"
          autoFocus
        />
        <div className="flex gap-2">
          {(['all', 'vehicles', 'subscribers'] as const).map(tp => (
            <button key={tp} onClick={() => setType(tp)}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${type === tp ? 'bg-blue-500 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
              {t(tp === 'all' ? 'all' : tp === 'vehicles' ? 'vehicles' : 'subscribers')}
            </button>
          ))}
        </div>
      </div>

      {!q && (
        <div className="text-center py-16 text-gray-400">
          <div className="text-5xl mb-3">🔍</div>
          <p>{t('searchPlaceholder')}</p>
        </div>
      )}

      {q && vehicleResults.length === 0 && subscriberResults.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          <div className="text-5xl mb-3">😕</div>
          <p>{t('noData')}</p>
        </div>
      )}

      {/* Vehicle Results */}
      {showVehicles && vehicleResults.length > 0 && (
        <div className="mb-6">
          <h2 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <span>🚗</span> {t('vehicles')} ({vehicleResults.length})
          </h2>
          <div className="overflow-x-auto bg-white rounded-xl shadow-sm border border-gray-100">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="px-4 py-3 text-left font-semibold text-gray-600">{t('plateNumber')}</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600">{t('parkingSpace')}</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600">{t('entryDate')}</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600">{t('entryTime')}</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600">{t('status')}</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600">{t('parkingFee')}</th>
                </tr>
              </thead>
              <tbody>
                {vehicleResults.map(v => (
                  <tr key={v.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap items-center gap-1">
                        <span className="font-mono font-semibold text-gray-800">{v.plateNumber}</span>
                        <LoyaltyBadge plate={v.plateNumber} />
                      </div>
                      {loyaltyEnabled && loyaltyMap[v.plateNumber] && (
                        <div className="mt-1 flex items-center gap-2">
                          <div className="w-20 bg-gray-100 rounded-full h-1.5">
                            <div className="h-1.5 rounded-full bg-yellow-400"
                              style={{ width: `${Math.min(100, (loyaltyMap[v.plateNumber].totalVisits / visitsRequired) * 100)}%` }} />
                          </div>
                          <span className="text-xs text-gray-400">
                            {loyaltyMap[v.plateNumber].availableRewards > 0
                              ? `🎁 ${loyaltyMap[v.plateNumber].availableRewards} reward(s)`
                              : `${loyaltyMap[v.plateNumber].totalVisits}/${visitsRequired} visits`}
                          </span>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3"><span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded">{v.parkingSpaceNumber}</span></td>
                    <td className="px-4 py-3 text-gray-600">{v.entryDate}</td>
                    <td className="px-4 py-3 text-gray-600">{v.entryTime}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-1 rounded-full ${v.status === 'inside' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                        {t(v.status)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-green-600">{v.fee ? `${v.fee.toLocaleString()} ${t('iqd')}` : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Subscriber Results */}
      {showSubs && subscriberResults.length > 0 && (
        <div>
          <h2 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <span>📅</span> {t('subscribers')} ({subscriberResults.length})
          </h2>
          <div className="overflow-x-auto bg-white rounded-xl shadow-sm border border-gray-100">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="px-4 py-3 text-left font-semibold text-gray-600">{t('plateNumber')}</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600">{t('driverName')}</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600">{t('phoneNumber')}</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600">{t('expirationDate')}</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600">{t('remainingDays')}</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600">{t('paymentStatus')}</th>
                </tr>
              </thead>
              <tbody>
                {subscriberResults.map(s => (
                  <tr key={s.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap items-center gap-1">
                        <span className="font-mono font-semibold text-gray-800">{s.plateNumber}</span>
                        <LoyaltyBadge plate={s.plateNumber} />
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-700">{s.driverName}</td>
                    <td className="px-4 py-3 text-gray-600">{s.phoneNumber}</td>
                    <td className="px-4 py-3 text-gray-600">{s.expirationDate}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-1 rounded-full ${s.remainingDays <= 0 ? 'bg-red-100 text-red-600' : s.remainingDays <= 7 ? 'bg-yellow-100 text-yellow-600' : 'bg-green-100 text-green-600'}`}>
                        {s.remainingDays}d
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-1 rounded-full ${s.paymentStatus === 'paid' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                        {t(s.paymentStatus)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
