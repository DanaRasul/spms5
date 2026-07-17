'use client';
import React, { useState } from 'react';
import { useSPMS } from '@/lib/SPMSContext';
import { useLang } from '@/lib/LangContext';

export default function SystemSettings() {
  const { settings, updateSettings, currentUser } = useSPMS();
  const { t } = useLang();
  const [form, setForm] = useState({ ...settings } as any);
  const [toast, setToast] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateSettings(form);
    setToast(t('successSaved'));
    setTimeout(() => setToast(''), 3000);
  };

  return (
    <div className="p-4 md:p-6">
      <h1 className="text-xl font-bold text-gray-800 mb-6">{t('settings')}</h1>

      {toast && <div className="mb-4 bg-green-50 border border-green-200 text-green-700 rounded-lg px-4 py-3 text-sm">{toast}</div>}

      <div className="max-w-lg">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Capacity */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <h2 className="font-semibold text-gray-700 mb-4">🅿️ {t('parkingSpaces')}</h2>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('totalCapacity')}</label>
              <input type="number" min={1} value={form.totalCapacity} onChange={e => setForm((p: any) => ({ ...p, totalCapacity: +e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-400" />
            </div>
          </div>

          {/* Rates */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <h2 className="font-semibold text-gray-700 mb-1">💰 {t('feeCalculation')}</h2>
            <p className="text-xs text-gray-400 mb-4">{t('globalRateHint')}</p>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('hourlyRate1')}</label>
                <input type="number" min={0} value={form.hourlyRate1} onChange={e => setForm((p: any) => ({ ...p, hourlyRate1: +e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-400" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('hourlyRate2')}</label>
                <input type="number" min={0} value={form.hourlyRate2} onChange={e => setForm((p: any) => ({ ...p, hourlyRate2: +e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-400" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('hourlyRate3')}</label>
                <input type="number" min={0} value={form.hourlyRate3} onChange={e => setForm((p: any) => ({ ...p, hourlyRate3: +e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-400" />
              </div>
            </div>
          </div>

          {/* Currency & Timezone */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <h2 className="font-semibold text-gray-700 mb-4">🌍 {t('settings')}</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('currency')}</label>
                <input type="text" value={form.currency} onChange={e => setForm((p: any) => ({ ...p, currency: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-400" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('timezone')}</label>
                <select value={form.timezone} onChange={e => setForm((p: any) => ({ ...p, timezone: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-400">
                  <option value="Asia/Baghdad">Asia/Baghdad (UTC+3)</option>
                  <option value="Asia/Erbil">Asia/Erbil (UTC+3)</option>
                  <option value="UTC">UTC</option>
                </select>
              </div>
            </div>
          </div>

          {/* Loyalty Program Settings */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <h2 className="font-semibold text-gray-700 mb-4">⭐ Loyalty Program</h2>
            <div className="space-y-4">
              {/* Enable/Disable */}
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-sm font-medium text-gray-700">Enable Loyalty Program</label>
                  <p className="text-xs text-gray-400">Track visits and reward returning customers</p>
                </div>
                <button type="button"
                  onClick={() => setForm((p: any) => ({ ...p, loyaltyEnabled: !p.loyaltyEnabled }))}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${form.loyaltyEnabled ? 'bg-yellow-500' : 'bg-gray-200'}`}>
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${form.loyaltyEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
              </div>

              {form.loyaltyEnabled && (
                <>
                  {/* Visits Required */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Visits Required for Reward</label>
                    <input type="number" min={1} max={100} value={form.loyaltyVisitsRequired ?? 10}
                      onChange={e => setForm((p: any) => ({ ...p, loyaltyVisitsRequired: +e.target.value }))}
                      className="w-full border border-gray-200 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-yellow-400" />
                    <p className="text-xs text-gray-400 mt-1">Default: 10 visits = 1 free reward</p>
                  </div>

                  {/* Reward Type */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Reward Type</label>
                    <select value={form.loyaltyRewardType ?? 'free_parking'}
                      onChange={e => setForm((p: any) => ({ ...p, loyaltyRewardType: e.target.value }))}
                      className="w-full border border-gray-200 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-yellow-400">
                      <option value="free_parking">🆓 Free Parking (100% off)</option>
                      <option value="percent_discount">% Percentage Discount</option>
                      <option value="fixed_discount">💰 Fixed Amount Discount</option>
                    </select>
                  </div>

                  {/* Discount Percent (shown only for percent_discount) */}
                  {form.loyaltyRewardType === 'percent_discount' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Discount Percentage (%)</label>
                      <input type="number" min={1} max={100} value={form.loyaltyDiscountPercent ?? 50}
                        onChange={e => setForm((p: any) => ({ ...p, loyaltyDiscountPercent: +e.target.value }))}
                        className="w-full border border-gray-200 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-yellow-400" />
                    </div>
                  )}

                  {/* Fixed Discount (shown only for fixed_discount) */}
                  {form.loyaltyRewardType === 'fixed_discount' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Fixed Discount Amount (IQD)</label>
                      <input type="number" min={0} value={form.loyaltyFixedDiscount ?? 0}
                        onChange={e => setForm((p: any) => ({ ...p, loyaltyFixedDiscount: +e.target.value }))}
                        className="w-full border border-gray-200 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-yellow-400" />
                    </div>
                  )}

                  {/* Reward Expiration */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Reward Expiration (days)</label>
                    <input type="number" min={0} value={form.loyaltyRewardExpireDays ?? 0}
                      onChange={e => setForm((p: any) => ({ ...p, loyaltyRewardExpireDays: +e.target.value }))}
                      className="w-full border border-gray-200 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-yellow-400" />
                    <p className="text-xs text-gray-400 mt-1">Set to 0 for no expiration</p>
                  </div>

                  {/* Include Monthly Subscribers */}
                  <div className="flex items-center justify-between">
                    <div>
                      <label className="text-sm font-medium text-gray-700">Include Monthly Subscribers</label>
                      <p className="text-xs text-gray-400">Count subscriber visits toward loyalty rewards</p>
                    </div>
                    <button type="button"
                      onClick={() => setForm((p: any) => ({ ...p, loyaltyIncludeSubscribers: !p.loyaltyIncludeSubscribers }))}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${form.loyaltyIncludeSubscribers ? 'bg-yellow-500' : 'bg-gray-200'}`}>
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${form.loyaltyIncludeSubscribers ? 'translate-x-6' : 'translate-x-1'}`} />
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>

          <button type="submit" className="w-full bg-blue-500 hover:bg-blue-600 text-white font-semibold py-3 rounded-xl transition-colors">
            {t('saveSettings')}
          </button>
        </form>
      </div>
    </div>
  );
}
