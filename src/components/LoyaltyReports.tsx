'use client';
import React, { useState, useEffect, useCallback } from 'react';
import ReportShell from '@/components/reports/ReportShell';

interface LoyaltyLog {
  id: string;
  eventType: string;
  description: string;
  visitsBefore: number;
  visitsAfter: number;
  rewardsBefore: number;
  rewardsAfter: number;
  performedBy: string | null;
  timestamp: string;
  loyalty?: {
    licensePlate: string;
    customerName: string | null;
    phoneNumber: string | null;
  };
}

interface LoyaltyRecord {
  id: string;
  licensePlate: string;
  customerName: string | null;
  totalVisits: number;
  availableRewards: number;
  totalRewardsEarned: number;
  totalRewardsRedeemed: number;
  lastVisit: string | null;
}

interface ReportSummary {
  visitsAdded: number;
  rewardsEarned: number;
  rewardsRedeemed: number;
  manualAdjustments: number;
}

export default function LoyaltyReports() {
  const [period, setPeriod] = useState<'daily' | 'weekly' | 'monthly' | 'yearly'>('daily');
  const [reportType, setReportType] = useState<'activity' | 'top50' | 'near_reward' | 'rewards_issued' | 'rewards_redeemed'>('activity');
  const [data, setData] = useState<any[]>([]);
  const [summary, setSummary] = useState<ReportSummary | null>(null);
  const [visitsRequired, setVisitsRequired] = useState(10);
  const [loading, setLoading] = useState(false);

  const fetchReport = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/loyalty/reports?period=${period}&type=${reportType}`);
      if (!res.ok) throw new Error('Failed to fetch');
      const result = await res.json();
      setData(result.data || []);
      setSummary(result.summary || null);
      setVisitsRequired(result.visitsRequired || 10);
    } catch {
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [period, reportType]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  const exportCSV = () => {
    if (data.length === 0) return;
    let headers: string[] = [];
    let rows: string[][] = [];

    if (reportType === 'top50' || reportType === 'near_reward') {
      headers = ['License Plate', 'Customer Name', 'Phone', 'Total Visits', 'Available Rewards', 'Total Earned', 'Total Redeemed', 'Last Visit'];
      rows = data.map((r: LoyaltyRecord) => [
        r.licensePlate, r.customerName || '', '', String(r.totalVisits),
        String(r.availableRewards), String(r.totalRewardsEarned), String(r.totalRewardsRedeemed),
        r.lastVisit ? new Date(r.lastVisit).toLocaleDateString() : '',
      ]);
    } else {
      headers = ['Timestamp', 'License Plate', 'Customer', 'Event Type', 'Description', 'Visits Before', 'Visits After', 'Rewards Before', 'Rewards After', 'Performed By'];
      rows = data.map((l: LoyaltyLog) => [
        new Date(l.timestamp).toLocaleString(),
        l.loyalty?.licensePlate || '',
        l.loyalty?.customerName || '',
        l.eventType,
        l.description,
        String(l.visitsBefore),
        String(l.visitsAfter),
        String(l.rewardsBefore),
        String(l.rewardsAfter),
        l.performedBy || '',
      ]);
    }

    const csvContent = [headers, ...rows].map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `loyalty_${reportType}_${period}_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const periodOptions = [
    { value: 'daily', label: 'Daily' },
    { value: 'weekly', label: 'Weekly' },
    { value: 'monthly', label: 'Monthly' },
    { value: 'yearly', label: 'Yearly' },
  ] as const;

  const reportTypeOptions = [
    { value: 'activity', label: '📋 Activity' },
    { value: 'top50', label: '🏆 Top 50' },
    { value: 'near_reward', label: '🔥 Near Reward' },
    { value: 'rewards_issued', label: '🎁 Issued' },
    { value: 'rewards_redeemed', label: '✅ Redeemed' },
  ] as const;

  const typeLabel = {
    activity: 'Activity Report',
    top50: 'Top 50 Returning Customers',
    near_reward: 'Customers Near Reward',
    rewards_issued: 'Rewards Issued',
    rewards_redeemed: 'Rewards Redeemed',
  }[reportType];

  return (
    <div className="p-4 md:p-6">
      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4 print:hidden">
        <div className="flex gap-1 bg-white border border-gray-200 rounded-lg p-1">
          {periodOptions.map(p => (
            <button key={p.value} onClick={() => setPeriod(p.value)}
              className={`px-3 py-1.5 text-sm rounded-md font-medium transition-colors ${period === p.value ? 'bg-blue-500 text-white' : 'text-gray-600 hover:bg-gray-100'}`}>
              {p.label}
            </button>
          ))}
        </div>
        <div className="flex gap-1 bg-white border border-gray-200 rounded-lg p-1 flex-wrap">
          {reportTypeOptions.map(r => (
            <button key={r.value} onClick={() => setReportType(r.value)}
              className={`px-3 py-1.5 text-sm rounded-md font-medium transition-colors ${reportType === r.value ? 'bg-yellow-500 text-white' : 'text-gray-600 hover:bg-gray-100'}`}>
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <ReportShell
        title={`${typeLabel} (${period})`}
        subtitle="Analyze loyalty program performance"
        filename={`loyalty_${reportType}_${period}_${new Date().toISOString().split('T')[0]}`}
        actions={
          <button onClick={exportCSV} disabled={data.length === 0}
            className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-40">
            📊 Export CSV
          </button>
        }
        summary={summary && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-blue-50 rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-blue-600">{summary.visitsAdded}</p>
              <p className="text-xs text-gray-500">Visits Added</p>
            </div>
            <div className="bg-yellow-50 rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-yellow-600">{summary.rewardsEarned}</p>
              <p className="text-xs text-gray-500">Rewards Earned</p>
            </div>
            <div className="bg-green-50 rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-green-600">{summary.rewardsRedeemed}</p>
              <p className="text-xs text-gray-500">Rewards Redeemed</p>
            </div>
            <div className="bg-purple-50 rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-purple-600">{summary.manualAdjustments}</p>
              <p className="text-xs text-gray-500">Manual Adjustments</p>
            </div>
          </div>
        )}
      >
      {/* Data Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-400">Loading report...</div>
        ) : data.length === 0 ? (
          <div className="p-8 text-center text-gray-400">
            <div className="text-4xl mb-2">📊</div>
            <p>No data for this period</p>
          </div>
        ) : (reportType === 'top50' || reportType === 'near_reward') ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="px-4 py-3 text-left font-semibold text-gray-600">#</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600">License Plate</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600">Customer</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600">Total Visits</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600">Progress</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600">Available Rewards</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600">Total Earned</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600">Last Visit</th>
                </tr>
              </thead>
              <tbody>
                {data.map((r: LoyaltyRecord, i: number) => (
                  <tr key={r.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-400 font-medium">{i + 1}</td>
                    <td className="px-4 py-3 font-mono font-bold text-gray-800">{r.licensePlate}</td>
                    <td className="px-4 py-3 text-gray-700">{r.customerName || '—'}</td>
                    <td className="px-4 py-3 font-bold text-blue-600">{r.totalVisits}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-20 bg-gray-100 rounded-full h-2">
                          <div className="h-2 rounded-full bg-yellow-500"
                            style={{ width: `${Math.min(100, (r.totalVisits / visitsRequired) * 100)}%` }} />
                        </div>
                        <span className="text-xs text-gray-500">{r.totalVisits}/{visitsRequired}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`font-bold ${r.availableRewards > 0 ? 'text-green-600' : 'text-gray-400'}`}>{r.availableRewards}</span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{r.totalRewardsEarned}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {r.lastVisit ? new Date(r.lastVisit).toLocaleDateString() : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="px-4 py-3 text-left font-semibold text-gray-600">Timestamp</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600">License Plate</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600">Event</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600">Description</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600">Visits</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600">Rewards</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600">By</th>
                </tr>
              </thead>
              <tbody>
                {data.map((l: LoyaltyLog) => {
                  const eventColors: Record<string, string> = {
                    visit_added: 'bg-blue-100 text-blue-700',
                    reward_earned: 'bg-yellow-100 text-yellow-700',
                    reward_redeemed: 'bg-green-100 text-green-700',
                    manual_adjustment: 'bg-purple-100 text-purple-700',
                    reset_by_admin: 'bg-red-100 text-red-700',
                    points_added: 'bg-emerald-100 text-emerald-700',
                    points_removed: 'bg-orange-100 text-orange-700',
                  };
                  return (
                    <tr key={l.id} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">{new Date(l.timestamp).toLocaleString()}</td>
                      <td className="px-4 py-3 font-mono font-bold text-gray-800">{l.loyalty?.licensePlate || '—'}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${eventColors[l.eventType] || 'bg-gray-100 text-gray-600'}`}>
                          {l.eventType.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-600 max-w-xs truncate">{l.description}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{l.visitsBefore} → {l.visitsAfter}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{l.rewardsBefore} → {l.rewardsAfter}</td>
                      <td className="px-4 py-3 text-gray-400 text-xs">{l.performedBy || '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      </ReportShell>
    </div>
  );
}
