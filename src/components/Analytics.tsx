'use client';
import React, { useState } from 'react';
import { useSPMS } from '@/lib/SPMSContext';
import { useLang } from '@/lib/LangContext';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

export default function Analytics() {
  const { vehicles, subscribers, spaces } = useSPMS();
  const { t } = useLang();
  const [tab, setTab] = useState<'vehicles' | 'revenue' | 'occupancy' | 'subscribers'>('vehicles');

  // Last 7 days data
  const last7 = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(Date.now() - (6 - i) * 86400000);
    const dateStr = d.toISOString().split('T')[0];
    const dayVehicles = vehicles.filter(v => v.entryDate === dateStr);
    const dayRevenue = vehicles.filter(v => v.status === 'completed' && v.exitDate === dateStr).reduce((a, v) => a + (v.fee || 0), 0);
    return {
      date: d.toLocaleDateString('en', { weekday: 'short', month: 'short', day: 'numeric' }),
      vehicles: dayVehicles.length,
      revenue: dayRevenue,
      inside: dayVehicles.filter(v => v.status === 'inside').length,
    };
  });

  // Monthly data (last 6 months)
  const last6Months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date();
    d.setMonth(d.getMonth() - (5 - i));
    const monthStr = d.toISOString().slice(0, 7);
    const monthVehicles = vehicles.filter(v => v.entryDate.startsWith(monthStr));
    const monthRevenue = vehicles.filter(v => v.status === 'completed' && v.exitDate?.startsWith(monthStr)).reduce((a, v) => a + (v.fee || 0), 0);
    return {
      month: d.toLocaleDateString('en', { month: 'short', year: '2-digit' }),
      vehicles: monthVehicles.length,
      revenue: monthRevenue,
    };
  });

  // Occupancy pie
  const occupancyData = [
    { name: t('occupied'), value: spaces.filter(s => s.status === 'occupied').length },
    { name: t('available'), value: spaces.filter(s => s.status === 'available').length },
  ];

  // Subscriber status pie
  const subData = [
    { name: t('active'), value: subscribers.filter(s => s.remainingDays > 7).length },
    { name: t('expired'), value: subscribers.filter(s => s.remainingDays <= 0).length },
    { name: 'Expiring Soon', value: subscribers.filter(s => s.remainingDays > 0 && s.remainingDays <= 7).length },
  ];

  const tabs = [
    { id: 'vehicles', label: t('vehicles') },
    { id: 'revenue', label: t('revenue') },
    { id: 'occupancy', label: t('occupancyRate') },
    { id: 'subscribers', label: t('subscribers') },
  ] as const;

  return (
    <div className="p-4 md:p-6">
      <h1 className="text-xl font-bold text-gray-800 mb-6">{t('analytics')}</h1>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 mb-6">
        {tabs.map(tb => (
          <button key={tb.id} onClick={() => setTab(tb.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === tb.id ? 'bg-blue-500 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
            {tb.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {tab === 'vehicles' && (
          <>
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
              <h2 className="font-semibold text-gray-700 mb-4">{t('vehiclesByDay')} (Last 7 Days)</h2>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={last7}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="vehicles" fill="#3b82f6" radius={[4, 4, 0, 0]} name={t('vehicles')} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
              <h2 className="font-semibold text-gray-700 mb-4">{t('vehiclesByDay')} (Last 6 Months)</h2>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={last6Months}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Line type="monotone" dataKey="vehicles" stroke="#3b82f6" strokeWidth={2} dot={{ r: 4 }} name={t('vehicles')} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </>
        )}

        {tab === 'revenue' && (
          <>
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
              <h2 className="font-semibold text-gray-700 mb-4">{t('revenueByDay')} (Last 7 Days)</h2>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={last7}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v: number) => [`${v.toLocaleString()} IQD`, t('revenue')]} />
                  <Bar dataKey="revenue" fill="#10b981" radius={[4, 4, 0, 0]} name={t('revenue')} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
              <h2 className="font-semibold text-gray-700 mb-4">{t('revenueByDay')} (Last 6 Months)</h2>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={last6Months}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v: number) => [`${v.toLocaleString()} IQD`, t('revenue')]} />
                  <Line type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={2} dot={{ r: 4 }} name={t('revenue')} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </>
        )}

        {tab === 'occupancy' && (
          <>
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
              <h2 className="font-semibold text-gray-700 mb-4">{t('occupancyTrend')}</h2>
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie data={occupancyData} cx="50%" cy="50%" outerRadius={90} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                    {occupancyData.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
              <h2 className="font-semibold text-gray-700 mb-4">{t('occupancyTrend')} (Last 7 Days)</h2>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={last7}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Line type="monotone" dataKey="inside" stroke="#f59e0b" strokeWidth={2} dot={{ r: 4 }} name={t('vehiclesInside')} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </>
        )}

        {tab === 'subscribers' && (
          <>
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
              <h2 className="font-semibold text-gray-700 mb-4">{t('subscriberStats')}</h2>
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie data={subData} cx="50%" cy="50%" outerRadius={90} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                    {subData.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
              <h2 className="font-semibold text-gray-700 mb-4">{t('subscribers')} {t('overview')}</h2>
              <div className="space-y-3">
                {[
                  { label: t('total'), value: subscribers.length, color: 'text-blue-600' },
                  { label: t('active'), value: subscribers.filter(s => s.remainingDays > 0).length, color: 'text-green-600' },
                  { label: t('expired'), value: subscribers.filter(s => s.remainingDays <= 0).length, color: 'text-red-600' },
                  { label: t('paid'), value: subscribers.filter(s => s.paymentStatus === 'paid').length, color: 'text-emerald-600' },
                  { label: t('unpaid'), value: subscribers.filter(s => s.paymentStatus === 'unpaid').length, color: 'text-orange-600' },
                ].map(item => (
                  <div key={item.label} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <span className="text-sm text-gray-600">{item.label}</span>
                    <span className={`font-bold text-lg ${item.color}`}>{item.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
