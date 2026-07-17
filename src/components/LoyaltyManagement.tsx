'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { useSPMS } from '@/lib/SPMSContext';
import CustomerProfileModal from '@/components/CustomerProfileModal';

interface LoyaltyRecord {
  id: string;
  licensePlate: string;
  customerName: string | null;
  phoneNumber: string | null;
  notes: string | null;
  totalVisits: number;
  availableRewards: number;
  totalRewardsEarned: number;
  totalRewardsRedeemed: number;
  lastVisit: string | null;
  createdAt: string;
  loyaltyLogs?: LoyaltyLog[];
}

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
}

interface Pagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

const EVENT_LABELS: Record<string, { label: string; color: string; icon: string }> = {
  visit_added: { label: 'Visit Added', color: 'bg-blue-100 text-blue-700', icon: '✅' },
  reward_earned: { label: 'Reward Earned', color: 'bg-yellow-100 text-yellow-700', icon: '🏆' },
  reward_redeemed: { label: 'Reward Redeemed', color: 'bg-green-100 text-green-700', icon: '🎁' },
  manual_adjustment: { label: 'Manual Adjustment', color: 'bg-purple-100 text-purple-700', icon: '✏️' },
  reset_by_admin: { label: 'Reset by Admin', color: 'bg-red-100 text-red-700', icon: '🔄' },
  points_added: { label: 'Points Added', color: 'bg-emerald-100 text-emerald-700', icon: '➕' },
  points_removed: { label: 'Points Removed', color: 'bg-orange-100 text-orange-700', icon: '➖' },
};

export default function LoyaltyManagement() {
  const { currentUser } = useSPMS();
  const isSystemAdmin = currentUser?.role === 'system_admin';
  const canManage = currentUser?.role === 'system_admin' || currentUser?.role === 'branch_admin';

  const [records, setRecords] = useState<LoyaltyRecord[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, pageSize: 20, total: 0, totalPages: 0 });
  const [visitsRequired, setVisitsRequired] = useState(10);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [selectedRecord, setSelectedRecord] = useState<LoyaltyRecord | null>(null);
  const [showDetail, setShowDetail] = useState(false);
  const [showAdjust, setShowAdjust] = useState(false);
  const [adjustType, setAdjustType] = useState<'visits' | 'rewards'>('visits');
  const [profilePlate, setProfilePlate] = useState<string | null>(null);
  const [adjustValue, setAdjustValue] = useState(0);
  const [adjustReason, setAdjustReason] = useState('');
  const [toast, setToast] = useState('');
  const [toastType, setToastType] = useState<'success' | 'error'>('success');

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast(msg);
    setToastType(type);
    setTimeout(() => setToast(''), 3500);
  };

  const fetchRecords = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: '20',
        search,
        filter,
        sortBy: 'totalVisits',
        sortOrder: 'desc',
      });
      const res = await fetch(`/api/loyalty?${params}`);
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setRecords(data.data);
      setPagination(data.pagination);
      setVisitsRequired(data.visitsRequired);
    } catch {
      showToast('Failed to load loyalty data.', 'error');
    } finally {
      setLoading(false);
    }
  }, [search, filter]);

  useEffect(() => {
    fetchRecords(1);
  }, [fetchRecords]);

  const openDetail = async (record: LoyaltyRecord) => {
    try {
      const res = await fetch(`/api/loyalty/${record.id}`);
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setSelectedRecord(data);
      setShowDetail(true);
    } catch {
      showToast('Failed to load loyalty details.', 'error');
    }
  };

  const handleReset = async (record: LoyaltyRecord) => {
    if (!isSystemAdmin) return;
    if (!confirm(`Reset loyalty for ${record.licensePlate}? This will clear all visits and rewards.`)) return;
    try {
      const res = await fetch(`/api/loyalty/${record.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reset', reason: 'Manual reset by admin' }),
      });
      if (!res.ok) throw new Error('Failed to reset');
      showToast(`Loyalty reset for ${record.licensePlate}`);
      fetchRecords(pagination.page);
      if (showDetail) {
        const updated = await res.json();
        setSelectedRecord(prev => prev ? { ...prev, ...updated } : null);
      }
    } catch {
      showToast('Failed to reset loyalty.', 'error');
    }
  };

  const handleAdjust = async () => {
    if (!selectedRecord || !isSystemAdmin) return;
    try {
      const res = await fetch(`/api/loyalty/${selectedRecord.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: adjustType === 'visits' ? 'adjust_visits' : 'adjust_rewards',
          adjustment: adjustValue,
          reason: adjustReason,
        }),
      });
      if (!res.ok) throw new Error('Failed to adjust');
      const updated = await res.json();
      showToast(`Loyalty adjusted successfully`);
      setShowAdjust(false);
      setAdjustValue(0);
      setAdjustReason('');
      fetchRecords(pagination.page);
      // Refresh detail
      const detailRes = await fetch(`/api/loyalty/${selectedRecord.id}`);
      if (detailRes.ok) setSelectedRecord(await detailRes.json());
    } catch {
      showToast('Failed to adjust loyalty.', 'error');
    }
  };

  const getProgressBar = (visits: number) => {
    const pct = Math.min(100, Math.round((visits / visitsRequired) * 100));
    return pct;
  };

  return (
    <div className="p-4 md:p-6">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg text-sm font-medium ${toastType === 'success' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'}`}>
          {toast}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-800">⭐ Loyalty Management</h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage customer loyalty records and rewards</p>
        </div>
        <div className="text-sm text-gray-500 bg-yellow-50 border border-yellow-200 px-3 py-1.5 rounded-lg">
          🏆 {visitsRequired} visits = 1 free reward
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by plate, name, or phone..."
          className="flex-1 border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
        />
        <div className="flex gap-2">
          {[
            { value: 'all', label: 'All' },
            { value: 'has_rewards', label: '🎁 Has Rewards' },
            { value: 'near_reward', label: '🔥 Near Reward' },
          ].map(f => (
            <button key={f.value} onClick={() => setFilter(f.value)}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${filter === f.value ? 'bg-yellow-500 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-400">Loading...</div>
        ) : records.length === 0 ? (
          <div className="p-8 text-center text-gray-400">
            <div className="text-4xl mb-2">⭐</div>
            <p>No loyalty records found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="px-4 py-3 text-left font-semibold text-gray-600">License Plate</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600">Customer</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600">Progress</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600">Rewards</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600">Total Earned</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600">Last Visit</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody>
                {records.map(r => {
                  const pct = getProgressBar(r.totalVisits);
                  const hasReward = r.availableRewards > 0;
                  return (
                    <tr key={r.id} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setProfilePlate(r.licensePlate)}
                            className="font-mono font-bold text-gray-800 hover:underline hover:text-blue-600 transition-colors"
                          >
                            {r.licensePlate}
                          </button>
                          {hasReward && (
                            <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full font-medium">🎁 Free</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-gray-700">{r.customerName || <span className="text-gray-400 italic">—</span>}</div>
                        {r.phoneNumber && <div className="text-xs text-gray-400">{r.phoneNumber}</div>}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-24 bg-gray-100 rounded-full h-2">
                            <div className={`h-2 rounded-full ${hasReward ? 'bg-green-500' : pct >= 80 ? 'bg-yellow-500' : 'bg-blue-500'}`}
                              style={{ width: `${pct}%` }} />
                          </div>
                          <span className="text-xs text-gray-600 whitespace-nowrap">
                            {hasReward ? '✅ Complete' : `${r.totalVisits} / ${visitsRequired}`}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-sm font-bold ${r.availableRewards > 0 ? 'text-green-600' : 'text-gray-400'}`}>
                          {r.availableRewards}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-600">{r.totalRewardsEarned}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs">
                        {r.lastVisit ? new Date(r.lastVisit).toLocaleDateString() : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1">
                          <button onClick={() => openDetail(r)}
                            className="px-2 py-1 text-xs bg-blue-50 text-blue-600 rounded hover:bg-blue-100 transition-colors">
                            View
                          </button>
                          {isSystemAdmin && (
                            <>
                              <button onClick={() => { setSelectedRecord(r); setShowAdjust(true); }}
                                className="px-2 py-1 text-xs bg-purple-50 text-purple-600 rounded hover:bg-purple-100 transition-colors">
                                Adjust
                              </button>
                              <button onClick={() => handleReset(r)}
                                className="px-2 py-1 text-xs bg-red-50 text-red-600 rounded hover:bg-red-100 transition-colors">
                                Reset
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
            <span className="text-sm text-gray-500">
              {pagination.total} records · Page {pagination.page} of {pagination.totalPages}
            </span>
            <div className="flex gap-2">
              <button disabled={pagination.page <= 1} onClick={() => fetchRecords(pagination.page - 1)}
                className="px-3 py-1 text-sm border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50">
                ← Prev
              </button>
              <button disabled={pagination.page >= pagination.totalPages} onClick={() => fetchRecords(pagination.page + 1)}
                className="px-3 py-1 text-sm border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50">
                Next →
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {showDetail && selectedRecord && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-gray-800">⭐ {selectedRecord.licensePlate}</h2>
                <p className="text-sm text-gray-500">{selectedRecord.customerName || 'Unknown Customer'}</p>
              </div>
              <button onClick={() => setShowDetail(false)} className="text-gray-400 hover:text-gray-600 text-2xl">×</button>
            </div>
            <div className="p-6 space-y-4">
              {/* Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-blue-50 rounded-xl p-3 text-center">
                  <p className="text-2xl font-bold text-blue-600">{selectedRecord.totalVisits}</p>
                  <p className="text-xs text-gray-500">Current Visits</p>
                </div>
                <div className="bg-green-50 rounded-xl p-3 text-center">
                  <p className="text-2xl font-bold text-green-600">{selectedRecord.availableRewards}</p>
                  <p className="text-xs text-gray-500">Available Rewards</p>
                </div>
                <div className="bg-yellow-50 rounded-xl p-3 text-center">
                  <p className="text-2xl font-bold text-yellow-600">{selectedRecord.totalRewardsEarned}</p>
                  <p className="text-xs text-gray-500">Total Earned</p>
                </div>
                <div className="bg-purple-50 rounded-xl p-3 text-center">
                  <p className="text-2xl font-bold text-purple-600">{selectedRecord.totalRewardsRedeemed}</p>
                  <p className="text-xs text-gray-500">Total Redeemed</p>
                </div>
              </div>

              {/* Progress */}
              <div className="bg-gray-50 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700">Visit Progress</span>
                  <span className="text-sm text-gray-500">{selectedRecord.totalVisits} / {visitsRequired}</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div className="h-3 rounded-full bg-yellow-500 transition-all"
                    style={{ width: `${Math.min(100, (selectedRecord.totalVisits / visitsRequired) * 100)}%` }} />
                </div>
                {selectedRecord.availableRewards > 0 && (
                  <p className="text-sm text-green-600 font-medium mt-2">🎁 Free parking reward available!</p>
                )}
              </div>

              {/* Contact Info */}
              {(selectedRecord.phoneNumber || selectedRecord.notes) && (
                <div className="bg-gray-50 rounded-xl p-4 space-y-1">
                  {selectedRecord.phoneNumber && <p className="text-sm text-gray-600">📞 {selectedRecord.phoneNumber}</p>}
                  {selectedRecord.notes && <p className="text-sm text-gray-600">📝 {selectedRecord.notes}</p>}
                </div>
              )}

              {/* Activity Log */}
              {selectedRecord.loyaltyLogs && selectedRecord.loyaltyLogs.length > 0 && (
                <div>
                  <h3 className="font-semibold text-gray-700 mb-3">Activity History</h3>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {selectedRecord.loyaltyLogs.map(log => {
                      const meta = EVENT_LABELS[log.eventType] || { label: log.eventType, color: 'bg-gray-100 text-gray-600', icon: '📋' };
                      return (
                        <div key={log.id} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                          <span className="text-lg">{meta.icon}</span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${meta.color}`}>{meta.label}</span>
                              <span className="text-xs text-gray-400">{new Date(log.timestamp).toLocaleString()}</span>
                            </div>
                            <p className="text-sm text-gray-600 mt-0.5">{log.description}</p>
                            {log.performedBy && <p className="text-xs text-gray-400">By: {log.performedBy}</p>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Admin Actions */}
              {isSystemAdmin && (
                <div className="flex gap-2 pt-2 border-t border-gray-100">
                  <button onClick={() => { setShowAdjust(true); }}
                    className="flex-1 py-2 bg-purple-500 hover:bg-purple-600 text-white rounded-lg text-sm font-medium transition-colors">
                    ✏️ Adjust Points
                  </button>
                  <button onClick={() => handleReset(selectedRecord)}
                    className="flex-1 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm font-medium transition-colors">
                    🔄 Reset Loyalty
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Adjust Modal */}
      {showAdjust && selectedRecord && isSystemAdmin && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-800">Adjust Loyalty — {selectedRecord.licensePlate}</h2>
              <button onClick={() => setShowAdjust(false)} className="text-gray-400 hover:text-gray-600 text-2xl">×</button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Adjustment Type</label>
                <div className="flex gap-2">
                  <button onClick={() => setAdjustType('visits')}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${adjustType === 'visits' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-600'}`}>
                    Visits
                  </button>
                  <button onClick={() => setAdjustType('rewards')}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${adjustType === 'rewards' ? 'bg-yellow-500 text-white' : 'bg-gray-100 text-gray-600'}`}>
                    Rewards
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Adjustment Value (use negative to remove)
                </label>
                <input type="number" value={adjustValue} onChange={e => setAdjustValue(parseInt(e.target.value) || 0)}
                  className="w-full border border-gray-200 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-400" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Reason (optional)</label>
                <input type="text" value={adjustReason} onChange={e => setAdjustReason(e.target.value)}
                  placeholder="Reason for adjustment..."
                  className="w-full border border-gray-200 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-400" />
              </div>
              <div className="flex gap-3">
                <button onClick={() => setShowAdjust(false)}
                  className="flex-1 py-2.5 border border-gray-200 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-50">
                  Cancel
                </button>
                <button onClick={handleAdjust}
                  className="flex-1 py-2.5 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm font-medium transition-colors">
                  Apply Adjustment
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {profilePlate && (
        <CustomerProfileModal plateNumber={profilePlate} onClose={() => setProfilePlate(null)} />
      )}
    </div>
  );
}
