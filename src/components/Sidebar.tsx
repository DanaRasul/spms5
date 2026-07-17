'use client';
import React, { useState } from 'react';
import { useSPMS } from '@/lib/SPMSContext';
import { useLang } from '@/lib/LangContext';
import { SUPPORTED_LANGUAGES } from '@/lib/i18n';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
}

// System Admin – global view, manages branches and users
const systemAdminTabs = [
  { id: 'dashboard', icon: '📊' },
  { id: 'parkingLocations', icon: '🏢' },
  { id: 'userManagement', icon: '👥' },
  { id: 'loyaltyManagement', icon: '⭐' },
  { id: 'loyaltyReports', icon: '🏆' },
  { id: 'activityLog', icon: '📝' },
  { id: 'systemSettings', icon: '⚙️' },
  { id: 'backupRestore', icon: '💾' },
];

// Branch Admin – manages their own branch
const branchAdminTabs = [
  { id: 'dashboard', icon: '📊' },
  { id: 'currentVehicles', icon: '🚗' },
  { id: 'vehicleEntry', icon: '🔑' },
  { id: 'parkingHistory', icon: '📋' },
  { id: 'monthlySubscribers', icon: '📅' },
  { id: 'reports', icon: '📈' },
  { id: 'financialReports', icon: '💰' },
  { id: 'analytics', icon: '📉' },
  { id: 'parkingSpaces', icon: '🅿️' },
  { id: 'userManagement', icon: '👥' },
  { id: 'loyaltyManagement', icon: '⭐' },
  { id: 'loyaltyReports', icon: '🏆' },
  { id: 'search', icon: '🔍' },
  { id: 'activityLog', icon: '📝' },
];

// User Admin (Operator) – entry/exit/search only
const userAdminTabs = [
  { id: 'dashboard', icon: '📊' },
  { id: 'currentVehicles', icon: '🚗' },
  { id: 'vehicleEntry', icon: '🔑' },
  { id: 'parkingHistory', icon: '📋' },
  { id: 'monthlySubscribers', icon: '📅' },
  { id: 'search', icon: '🔍' },
];

function getRoleLabel(role: string, t: (k: string) => string): string {
  if (role === 'system_admin') return t('roleSystemAdmin');
  if (role === 'branch_admin') return t('roleBranchAdmin');
  return t('roleUserAdmin');
}

export default function Sidebar({ activeTab, setActiveTab, sidebarOpen, setSidebarOpen }: SidebarProps) {
  const { currentUser, logout, locations } = useSPMS();
  const { t, language, setLanguage, dir } = useLang();

  const tabs =
    currentUser?.role === 'system_admin' ? systemAdminTabs :
    currentUser?.role === 'branch_admin' ? branchAdminTabs :
    userAdminTabs;

  const branchName = currentUser?.branchId
    ? locations.find(l => l.id === currentUser.branchId)?.name
    : null;

  return (
    <>
      {/* Overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-20 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`fixed top-0 ${dir === 'rtl' ? 'right-0' : 'left-0'} h-full w-64 bg-slate-900 text-white z-30 transform transition-transform duration-300 flex flex-col
        ${sidebarOpen ? 'translate-x-0' : dir === 'rtl' ? 'translate-x-full' : '-translate-x-full'} md:translate-x-0`}>
        
        {/* Logo */}
        <div className="p-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-500 rounded-xl flex items-center justify-center flex-shrink-0">
              <span className="text-lg">🅿️</span>
            </div>
            <div className="min-w-0">
              <p className="font-bold text-sm leading-tight">{t('appShort')}</p>
              <p className="text-xs text-blue-300 truncate">{t('appName')}</p>
            </div>
          </div>
        </div>

        {/* User Info */}
        <div className="p-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold
              ${currentUser?.role === 'system_admin' ? 'bg-purple-600' : currentUser?.role === 'branch_admin' ? 'bg-blue-600' : 'bg-green-600'}`}>
              {currentUser?.fullName?.charAt(0) || 'U'}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">{currentUser?.fullName}</p>
              <p className="text-xs text-blue-300">{getRoleLabel(currentUser?.role || '', t)}</p>
              {branchName && <p className="text-xs text-white/40 truncate">{branchName}</p>}
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-2">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => { setActiveTab(tab.id); setSidebarOpen(false); }}
              className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${activeTab === tab.id ? 'bg-blue-600 text-white' : 'text-white/70 hover:bg-white/10 hover:text-white'}`}
            >
              <span className="text-base">{tab.icon}</span>
              <span>{t(tab.id)}</span>
            </button>
          ))}
        </nav>

        {/* Language + Logout */}
        <div className="p-4 border-t border-white/10 space-y-3">
          <div className="flex gap-1">
            {SUPPORTED_LANGUAGES.map(lang => (
              <button
                key={lang.code}
                onClick={() => setLanguage(lang.code)}
                className={`flex-1 py-1 rounded text-xs font-medium transition-colors ${language === lang.code ? 'bg-blue-500 text-white' : 'bg-white/10 text-white/60 hover:bg-white/20'}`}
              >
                {lang.name}
              </button>
            ))}
          </div>
          <button
            onClick={logout}
            className="w-full flex items-center gap-2 px-3 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-300 rounded-lg text-sm transition-colors"
          >
            <span>🚪</span>
            <span>{t('logout')}</span>
          </button>
        </div>
      </aside>
    </>
  );
}
