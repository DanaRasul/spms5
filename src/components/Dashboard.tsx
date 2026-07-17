'use client';
import React, { useEffect, useState } from 'react';
import { useSPMS, getUserBranchId, getParkingAvailability } from '@/lib/SPMSContext';
import { useLang } from '@/lib/LangContext';
import type { DashboardStats } from '@/lib/types';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';

interface StatCardProps {
  label: string;
  value: string | number;
  icon: string;
  color: string;
  sub?: string;
}

function StatCard({ label, value, icon, color, sub }: StatCardProps) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 flex items-start gap-4">
      <div className={`w-12 h-12 ${color} rounded-xl flex items-center justify-center text-2xl flex-shrink-0`}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-2xl font-bold text-gray-800">{value}</p>
        <p className="text-sm text-gray-500 mt-0.5">{label}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

interface ExtendedDashboardStats extends DashboardStats {
  loyaltyMembers?: number;
  returningCustomers?: number;
  rewardsEarnedToday?: number;
  rewardsRedeemedToday?: number;
  freeParkingToday?: number;
}

export default function Dashboard() {
  const { getDashboardStats, settings, vehicles, locations, spaces, selectedLocationId, setSelectedLocationId, loading, dataLoaded, currentUser } = useSPMS();
  const { t } = useLang();
  const [stats, setStats] = useState<ExtendedDashboardStats | null>(null);
  const [chartPeriod, setChartPeriod] = useState<'daily' | 'weekly' | 'monthly' | 'yearly'>('daily');

  const branchId = getUserBranchId(currentUser);
  const parkingStatus = getParkingAvailability(spaces, {
    branchId,
    selectedLocationId,
  });

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const locParam = selectedLocationId !== 'all' ? `?locationId=${selectedLocationId}` : '';
        const res = await fetch(`/api/dashboard${locParam}`);
        if (res.ok) {
          const data = await res.json();
          setStats(data);
        } else if (!loading) {
          const fallback = getDashboardStats(selectedLocationId === 'all' ? undefined : selectedLocationId);
          if (fallback.totalSpaces > 0) {
            setStats(fallback as ExtendedDashboardStats);
          }
        }
      } catch {
        if (!loading) {
          const fallback = getDashboardStats(selectedLocationId === 'all' ? undefined : selectedLocationId);
          if (fallback.totalSpaces > 0) {
            setStats(fallback as ExtendedDashboardStats);
          }
        }
      }
    };
    fetchStats();
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, [getDashboardStats, selectedLocationId, loading, dataLoaded]);

  if (!stats) return <div className="p-6 text-gray-500">{t('loading')}</div>;

  const isFull = dataLoaded && !loading && parkingStatus.isFull;
  const occupancyPct = stats.occupancyPercentage;
  const fmtIQD = (n: number) => n.toLocaleString() + ' ' + t('iqd');

  // Chart data
  const getChartData = () => {
    const filteredVehicles = selectedLocationId === 'all' ? vehicles : vehicles.filter(v => v.locationId === selectedLocationId);
    if (chartPeriod === 'daily') {
      return Array.from({ length: 7 }, (_, i) => {
        const d = new Date(Date.now() - (6 - i) * 86400000);
        const dateStr = d.toISOString().split('T')[0];
        const dayVehicles = filteredVehicles.filter(v => v.entryDate === dateStr);
        const dayRevenue = filteredVehicles.filter(v => v.status === 'completed' && v.exitDate === dateStr).reduce((a, v) => a + (v.fee || 0), 0);
        return { label: d.toLocaleDateString('en', { weekday: 'short', day: 'numeric' }), vehicles: dayVehicles.length, revenue: dayRevenue };
      });
    }
    if (chartPeriod === 'weekly') {
      return Array.from({ length: 8 }, (_, i) => {
        const weekStart = new Date(Date.now() - (7 - i) * 7 * 86400000);
        const weekEnd = new Date(weekStart.getTime() + 7 * 86400000);
        const ws = weekStart.toISOString().split('T')[0];
        const we = weekEnd.toISOString().split('T')[0];
        const wVehicles = filteredVehicles.filter(v => v.entryDate >= ws && v.entryDate < we);
        const wRevenue = filteredVehicles.filter(v => v.status === 'completed' && v.exitDate && v.exitDate >= ws && v.exitDate < we).reduce((a, v) => a + (v.fee || 0), 0);
        return { label: `W${i + 1}`, vehicles: wVehicles.length, revenue: wRevenue };
      });
    }
    if (chartPeriod === 'monthly') {
      return Array.from({ length: 6 }, (_, i) => {
        const d = new Date();
        d.setMonth(d.getMonth() - (5 - i));
        const monthStr = d.toISOString().slice(0, 7);
        const mVehicles = filteredVehicles.filter(v => v.entryDate.startsWith(monthStr));
        const mRevenue = filteredVehicles.filter(v => v.status === 'completed' && v.exitDate?.startsWith(monthStr)).reduce((a, v) => a + (v.fee || 0), 0);
        return { label: d.toLocaleDateString('en', { month: 'short', year: '2-digit' }), vehicles: mVehicles.length, revenue: mRevenue };
      });
    }
    // yearly
    return Array.from({ length: 3 }, (_, i) => {
      const year = new Date().getFullYear() - (2 - i);
      const yStr = String(year);
      const yVehicles = filteredVehicles.filter(v => v.entryDate.startsWith(yStr));
      const yRevenue = filteredVehicles.filter(v => v.status === 'completed' && v.exitDate?.startsWith(yStr)).reduce((a, v) => a + (v.fee || 0), 0);
      return { label: yStr, vehicles: yVehicles.length, revenue: yRevenue };
    });
  };

  const chartData = getChartData();

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-gray-800">{t('dashboard')}</h1>
        <div className="flex items-center gap-3">
          <select
            value={selectedLocationId}
            onChange={e => setSelectedLocationId(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          >
            <option value="all">{t('allLocations')}</option>
            {locations.map(loc => (
              <option key={loc.id} value={loc.id}>{loc.name}</option>
            ))}
          </select>
          <span className="text-sm text-gray-400">{new Date().toLocaleDateString()}</span>
        </div>
      </div>

      {/* Parking Full Warning */}
      {isFull && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3">
          <span className="text-2xl">🚫</span>
          <div>
            <p className="font-semibold text-red-700">{t('parkingFull')}</p>
            <p className="text-sm text-red-500">{t('parkingFullMsg')}</p>
          </div>
        </div>
      )}

      {/* Occupancy Bar */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
        <div className="flex items-center justify-between mb-3">
          <span className="font-semibold text-gray-700">{t('occupancyRate')}</span>
          <div className="flex items-center gap-3">
            <span className={`text-lg font-bold ${occupancyPct >= 90 ? 'text-red-500' : occupancyPct >= 70 ? 'text-yellow-500' : 'text-green-500'}`}>{occupancyPct}%</span>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${occupancyPct >= 90 ? 'bg-red-100 text-red-700' : occupancyPct >= 70 ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'}`}>
              {occupancyPct >= 90 ? '🔴 Critical' : occupancyPct >= 70 ? '🟡 High' : '🟢 Normal'}
            </span>
          </div>
        </div>
        <div className="w-full bg-gray-100 rounded-full h-3">
          <div
            className={`h-3 rounded-full transition-all duration-500 ${occupancyPct >= 90 ? 'bg-red-500' : occupancyPct >= 70 ? 'bg-yellow-500' : 'bg-green-500'}`}
            style={{ width: `${occupancyPct}%` }}
          />
        </div>
        <div className="flex justify-between mt-2 text-xs text-gray-400">
          <span>{stats.occupiedSpaces} {t('occupied')}</span>
          <span>{stats.availableSpaces} {t('available')}</span>
          <span>{stats.totalSpaces} {t('total')}</span>
        </div>
      </div>

      {/* Vehicle Stats */}
      <div>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">{t('vehicles')}</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          <StatCard label={t('vehiclesInside')} value={stats.vehiclesInside} icon="🚗" color="bg-blue-50" />
          <StatCard label={t('todayVehicles')} value={stats.todayVehicles} icon="📅" color="bg-green-50" />
          <StatCard label={t('weeklyVehicles')} value={stats.weeklyVehicles} icon="📆" color="bg-purple-50" />
          <StatCard label={t('monthlyVehicles')} value={stats.monthlyVehicles} icon="🗓️" color="bg-orange-50" />
          <StatCard label={t('annualVehicles')} value={stats.annualVehicles} icon="📊" color="bg-pink-50" />
        </div>
      </div>

      {/* Revenue Stats */}
      <div>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">{t('revenue')}</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          <StatCard label={t('todayRevenue')} value={fmtIQD(stats.todayRevenue)} icon="💵" color="bg-emerald-50" />
          <StatCard label={t('weeklyRevenue')} value={fmtIQD(stats.weeklyRevenue)} icon="💴" color="bg-teal-50" />
          <StatCard label={t('monthlyRevenue')} value={fmtIQD(stats.monthlyRevenue)} icon="💶" color="bg-cyan-50" />
          <StatCard label={t('annualRevenue')} value={fmtIQD(stats.annualRevenue)} icon="💷" color="bg-sky-50" />
          <StatCard label={t('totalRevenue')} value={fmtIQD(stats.totalRevenue)} icon="🏦" color="bg-indigo-50" />
        </div>
      </div>

      {/* Spaces & Subscribers */}
      <div>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">{t('spaces')} & {t('subscribers')}</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label={t('totalSpaces')} value={stats.totalSpaces} icon="🅿️" color="bg-slate-50" />
          <StatCard label={t('availableSpaces')} value={stats.availableSpaces} icon="✅" color="bg-green-50" />
          <StatCard label={t('occupiedSpaces')} value={stats.occupiedSpaces} icon="🔴" color="bg-red-50" />
          <StatCard label={t('monthlySubscribersCount')} value={stats.monthlySubscribers} icon="👤" color="bg-violet-50" />
        </div>
      </div>

      {/* Loyalty Program Stats */}
      <div>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">⭐ Loyalty Program</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          <StatCard label="Loyalty Members" value={stats.loyaltyMembers ?? 0} icon="⭐" color="bg-yellow-50" />
          <StatCard label="Returning Customers" value={stats.returningCustomers ?? 0} icon="🔄" color="bg-amber-50" />
          <StatCard label="Rewards Earned Today" value={stats.rewardsEarnedToday ?? 0} icon="🏆" color="bg-orange-50" />
          <StatCard label="Rewards Redeemed Today" value={stats.rewardsRedeemedToday ?? 0} icon="🎁" color="bg-rose-50" />
          <StatCard label="Free Parking Today" value={stats.freeParkingToday ?? 0} icon="🆓" color="bg-green-50" />
        </div>
      </div>

      {/* Charts */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h2 className="font-semibold text-gray-700">{t('analytics')}</h2>
          <div className="flex gap-1">
            {(['daily', 'weekly', 'monthly', 'yearly'] as const).map(p => (
              <button key={p} onClick={() => setChartPeriod(p)}
                className={`px-3 py-1 text-xs rounded-lg transition-colors ${chartPeriod === p ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                {t(p === 'yearly' ? 'annual' : p)}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div>
            <h3 className="text-sm text-gray-500 mb-3">{t('vehicles')}</h3>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Bar dataKey="vehicles" fill="#3b82f6" radius={[4, 4, 0, 0]} name={t('vehicles')} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div>
            <h3 className="text-sm text-gray-500 mb-3">{t('revenue')}</h3>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip formatter={(v: number) => [`${v.toLocaleString()} IQD`, t('revenue')]} />
                <Line type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} name={t('revenue')} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Fee Info */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
        <h2 className="font-semibold text-gray-700 mb-3">{t('feeCalculation')}</h2>
        <div className="grid grid-cols-3 gap-3">
          <div className="text-center p-3 bg-blue-50 rounded-lg">
            <p className="text-xs text-gray-500">{t('hour1')}</p>
            <p className="font-bold text-blue-600">{settings.hourlyRate1.toLocaleString()}</p>
            <p className="text-xs text-gray-400">{t('iqd')}</p>
          </div>
          <div className="text-center p-3 bg-orange-50 rounded-lg">
            <p className="text-xs text-gray-500">{t('hour2')}</p>
            <p className="font-bold text-orange-600">{settings.hourlyRate2.toLocaleString()}</p>
            <p className="text-xs text-gray-400">{t('iqd')}</p>
          </div>
          <div className="text-center p-3 bg-red-50 rounded-lg">
            <p className="text-xs text-gray-500">{t('hour3')}</p>
            <p className="font-bold text-red-600">{settings.hourlyRate3.toLocaleString()}</p>
            <p className="text-xs text-gray-400">{t('iqd')}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
