'use client';
import React, { useEffect, useState } from 'react';
import { useLang } from '@/lib/LangContext';

interface ProfileData {
  customer: {
    plateNumber: string;
    driverName: string | null;
    phoneNumber: string | null;
    vehicleType: string | null;
    vehicleColor: string | null;
  };
  loyalty: {
    enabled: boolean;
    totalVisits: number;
    availableRewards: number;
    totalRewardsEarned: number;
    totalRewardsRedeemed: number;
    remainingVisits: number;
    visitsRequired: number;
    lastVisit: string | null;
  };
  stats: {
    totalVisits: number;
    totalRevenue: number;
    totalParkingMinutes: number;
    totalParkingHoursLabel: string;
    avgDurationMinutes: number;
    avgDurationLabel: string;
  };
  history: {
    entryDate: string;
    entryTime: string;
    exitDate: string | null;
    exitTime: string | null;
    duration: string | null;
    fee: number | null;
    status: string;
    parkingSpaceNumber: string;
    locationName: string | null;
  }[];
  loyaltyActivity: {
    eventType: string;
    description: string;
    visitsBefore: number;
    visitsAfter: number;
    rewardsBefore: number;
    rewardsAfter: number;
    timestamp: string;
  }[];
  loyaltySummary: { earnedVisits: number; redeemedRewards: number };
  currency: string;
}

export default function CustomerProfileModal({ plateNumber, onClose }: { plateNumber: string; onClose: () => void }) {
  const { t, dir } = useLang();
  const [data, setData] = useState<ProfileData | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'overview' | 'history' | 'loyalty'>('overview');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setNotFound(false);
    setError(false);
    (async () => {
      try {
        const res = await fetch(`/api/loyalty/profile?plate=${encodeURIComponent(plateNumber)}`);
        if (cancelled) return;
        if (res.status === 404) {
          setNotFound(true);
          return;
        }
        if (!res.ok) {
          setError(true);
          return;
        }
        setData(await res.json());
      } catch {
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [plateNumber]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        dir={dir}
        onClick={e => e.stopPropagation()}
        className="w-full max-w-2xl max-h-[90vh] bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-500 text-white px-6 py-4 flex items-center justify-between flex-shrink-0">
          <div>
            <p className="text-xs text-blue-100">{t('customerProfile')}</p>
            <p className="text-xl font-extrabold tracking-wider font-mono">{plateNumber}</p>
          </div>
          <button onClick={onClose} className="text-white/80 hover:text-white text-2xl leading-none">&times;</button>
        </div>

        {loading && (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 py-16">
            <div className="w-10 h-10 border-4 border-blue-200 border-t-blue-500 rounded-full animate-spin" />
            <p className="text-sm text-gray-400">{t('loading')}</p>
          </div>
        )}

        {!loading && notFound && (
          <div className="flex-1 flex flex-col items-center justify-center gap-2 py-16 text-center px-6">
            <div className="text-4xl mb-2">🚗</div>
            <p className="text-gray-500 text-sm">{t('customerNotFound')}</p>
          </div>
        )}

        {!loading && error && !data && (
          <div className="flex-1 flex flex-col items-center justify-center gap-2 py-16 text-center px-6">
            <div className="text-4xl mb-2">⚠️</div>
            <p className="text-gray-500 text-sm">{t('errorGeneral')}</p>
          </div>
        )}

        {!loading && data && (
          <>
            {/* Tabs */}
            <div className="flex border-b border-gray-100 px-4 flex-shrink-0">
              {(['overview', 'history', 'loyalty'] as const).map(tb => (
                <button
                  key={tb}
                  onClick={() => setTab(tb)}
                  className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                    tab === tb ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {tb === 'overview' ? t('profileOverview') : tb === 'history' ? t('parkingHistoryTab') : t('loyaltyHistoryTab')}
                </button>
              ))}
            </div>

            <div className="overflow-y-auto flex-1 px-6 py-5">
              {/* Overview tab: driver info + statistics */}
              {tab === 'overview' && (
                <div className="space-y-5">
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <ProfileField label={t('driverName')} value={data.customer.driverName || '-'} />
                    <ProfileField label={t('phoneNumber')} value={data.customer.phoneNumber || '-'} />
                    <ProfileField label={t('vehicleType')} value={data.customer.vehicleType || '-'} />
                    <ProfileField label={t('vehicleColor')} value={data.customer.vehicleColor || '-'} />
                    <ProfileField
                      label={t('lastVisit')}
                      value={data.loyalty.lastVisit ? new Date(data.loyalty.lastVisit).toLocaleDateString() : t('never')}
                    />
                    <ProfileField
                      label={t('availableRewards')}
                      value={String(data.loyalty.availableRewards)}
                      highlight={data.loyalty.availableRewards > 0}
                    />
                  </div>

                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 mb-2">{t('statistics')}</h3>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <StatCard label={t('totalVisits')} value={String(data.stats.totalVisits)} color="blue" />
                      <StatCard label={t('totalRevenue')} value={`${data.stats.totalRevenue.toLocaleString()} ${data.currency}`} color="green" />
                      <StatCard label={t('totalParkingHours')} value={data.stats.totalParkingHoursLabel} color="purple" />
                      <StatCard label={t('averageParkingDuration')} value={data.stats.avgDurationLabel} color="orange" />
                    </div>
                  </div>

                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 mb-2">{t('loyaltyProgram')}</h3>
                    <div className="grid grid-cols-2 gap-3">
                      <StatCard label={t('remainingRewardVisits')} value={String(Math.max(0, data.loyalty.remainingVisits))} color="yellow" />
                      <StatCard label={t('status')} value={data.loyalty.availableRewards > 0 ? t('rewardAvailable') : '-'} color="gray" />
                    </div>
                  </div>
                </div>
              )}

              {/* Parking history tab */}
              {tab === 'history' && (
                data.history.length === 0 ? (
                  <p className="text-center text-gray-400 text-sm py-10">{t('noRecordsFound')}</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-100 text-gray-500">
                          <th className="text-start py-2 pe-3 font-medium">{t('parkingSpace')}</th>
                          <th className="text-start py-2 pe-3 font-medium">{t('entryDate')}</th>
                          <th className="text-start py-2 pe-3 font-medium">{t('exitDate')}</th>
                          <th className="text-start py-2 pe-3 font-medium">{t('duration')}</th>
                          <th className="text-start py-2 pe-3 font-medium">{t('parkingFee')}</th>
                          <th className="text-start py-2 pe-3 font-medium">{t('status')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.history.map((h, i) => (
                          <tr key={i} className="border-b border-gray-50">
                            <td className="py-2 pe-3">
                              <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded text-xs">{h.parkingSpaceNumber}</span>
                              {h.locationName && <div className="text-[11px] text-gray-400 mt-0.5">{h.locationName}</div>}
                            </td>
                            <td className="py-2 pe-3 text-gray-600">{h.entryDate} <span className="text-gray-400">{h.entryTime}</span></td>
                            <td className="py-2 pe-3 text-gray-600">{h.exitDate ? <>{h.exitDate} <span className="text-gray-400">{h.exitTime}</span></> : '-'}</td>
                            <td className="py-2 pe-3 text-purple-600">{h.duration || '-'}</td>
                            <td className="py-2 pe-3 text-green-600 font-semibold">{h.fee ? `${h.fee.toLocaleString()} ${data.currency}` : '-'}</td>
                            <td className="py-2 pe-3">
                              <span className={`text-xs px-2 py-0.5 rounded-full ${h.status === 'inside' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                                {h.status === 'inside' ? t('inside') : t('completed')}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )
              )}

              {/* Loyalty history tab */}
              {tab === 'loyalty' && (
                <div className="space-y-5">
                  <div className="grid grid-cols-2 gap-3">
                    <StatCard label={t('earnedVisits')} value={String(data.loyaltySummary.earnedVisits)} color="blue" />
                    <StatCard label={t('redeemedRewards')} value={String(data.loyaltySummary.redeemedRewards)} color="green" />
                  </div>

                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 mb-2">{t('loyaltyActivityLog')}</h3>
                    {data.loyaltyActivity.length === 0 ? (
                      <p className="text-center text-gray-400 text-sm py-6">{t('noRecordsFound')}</p>
                    ) : (
                      <ul className="space-y-2">
                        {data.loyaltyActivity.map((l, i) => (
                          <li key={i} className="bg-gray-50 rounded-lg px-3 py-2 text-sm flex items-center justify-between gap-3">
                            <span className="text-gray-700">{l.description}</span>
                            <span className="text-[11px] text-gray-400 whitespace-nowrap">{new Date(l.timestamp).toLocaleString()}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function ProfileField({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="bg-gray-50 rounded-lg p-2.5">
      <p className="text-[11px] text-gray-400">{label}</p>
      <p className={`font-semibold ${highlight ? 'text-green-600' : 'text-gray-800'}`}>{value}</p>
    </div>
  );
}

const COLOR_MAP: Record<string, string> = {
  blue: 'bg-blue-50 text-blue-700',
  green: 'bg-green-50 text-green-700',
  purple: 'bg-purple-50 text-purple-700',
  orange: 'bg-orange-50 text-orange-700',
  yellow: 'bg-yellow-50 text-yellow-700',
  gray: 'bg-gray-100 text-gray-600',
};

function StatCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className={`rounded-lg p-3 text-center ${COLOR_MAP[color] || COLOR_MAP.gray}`}>
      <p className="text-base font-bold">{value}</p>
      <p className="text-[11px] opacity-70">{label}</p>
    </div>
  );
}
