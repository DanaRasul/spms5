'use client';
import React, { useState } from 'react';
import { useSPMS } from '@/lib/SPMSContext';
import { useLang } from '@/lib/LangContext';
import Sidebar from './Sidebar';
import Dashboard from './Dashboard';
import CurrentVehicles from './CurrentVehicles';
import VehicleEntry from './VehicleEntry';
import ParkingHistory from './ParkingHistory';
import MonthlySubscribers from './MonthlySubscribers';
import Reports from './Reports';
import FinancialReports from './FinancialReports';
import Analytics from './Analytics';
import ParkingLocations from './ParkingLocations';
import ParkingSpaces from './ParkingSpaces';
import UserManagement from './UserManagement';
import SystemSettings from './SystemSettings';
import BackupRestore from './BackupRestore';
import SearchPage from './SearchPage';
import ActivityLog from './ActivityLog';
import LoyaltyManagement from './LoyaltyManagement';
import LoyaltyReports from './LoyaltyReports';

function AccessDenied({ t }: { t: (k: string) => string }) {
  return (
    <div className="flex flex-col items-center justify-center h-64 text-center p-6">
      <div className="text-5xl mb-4">🔒</div>
      <h2 className="text-xl font-bold text-gray-700 mb-2">{t('accessDenied')}</h2>
      <p className="text-gray-500 text-sm">{t('accessDeniedMsg')}</p>
    </div>
  );
}

function getRoleDisplayName(role: string, t: (k: string) => string): string {
  if (role === 'system_admin') return t('roleSystemAdmin');
  if (role === 'branch_admin') return t('roleBranchAdmin');
  return t('roleUserAdmin');
}

export default function AppShell() {
  const { currentUser } = useSPMS();
  const { t, dir } = useLang();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const role = currentUser?.role;
  const isSystemAdmin = role === 'system_admin';
  const isBranchAdmin = role === 'branch_admin';
  const isUserAdmin = role === 'user_admin';

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <Dashboard />;

      // Operational tabs – branch_admin and user_admin only
      case 'currentVehicles':
        return (isSystemAdmin) ? <AccessDenied t={t} /> : <CurrentVehicles />;
      case 'vehicleEntry':
        return (isSystemAdmin) ? <AccessDenied t={t} /> : <VehicleEntry />;
      case 'parkingHistory':
        return (isSystemAdmin) ? <AccessDenied t={t} /> : <ParkingHistory />;
      case 'monthlySubscribers':
        return (isSystemAdmin) ? <AccessDenied t={t} /> : <MonthlySubscribers />;
      case 'search':
        return (isSystemAdmin) ? <AccessDenied t={t} /> : <SearchPage />;

      // Branch Admin only
      case 'reports':
        return isBranchAdmin ? <Reports /> : <AccessDenied t={t} />;
      case 'financialReports':
        return isBranchAdmin ? <FinancialReports /> : <AccessDenied t={t} />;
      case 'analytics':
        return isBranchAdmin ? <Analytics /> : <AccessDenied t={t} />;
      case 'parkingSpaces':
        return isBranchAdmin ? <ParkingSpaces /> : <AccessDenied t={t} />;

      case 'loyaltyManagement':
        return (isSystemAdmin || isBranchAdmin) ? <LoyaltyManagement /> : <AccessDenied t={t} />;
      case 'loyaltyReports':
        return (isSystemAdmin || isBranchAdmin) ? <LoyaltyReports /> : <AccessDenied t={t} />;

      // User Management: system_admin manages branch/user admins; branch_admin manages their operators
      case 'userManagement':
        return (isSystemAdmin || isBranchAdmin) ? <UserManagement /> : <AccessDenied t={t} />;

      // Activity Log: system_admin (global) and branch_admin (branch-scoped)
      case 'activityLog':
        return (isSystemAdmin || isBranchAdmin) ? <ActivityLog /> : <AccessDenied t={t} />;

      // System Admin only
      case 'parkingLocations':
        return isSystemAdmin ? <ParkingLocations /> : <AccessDenied t={t} />;
      case 'systemSettings':
        return isSystemAdmin ? <SystemSettings /> : <AccessDenied t={t} />;
      case 'backupRestore':
        return isSystemAdmin ? <BackupRestore /> : <AccessDenied t={t} />;

      default:
        return <Dashboard />;
    }
  };

  return (
    <div dir={dir} className="min-h-screen bg-gray-50 flex">
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />

      <div className={`flex-1 flex flex-col min-h-screen ${dir === 'rtl' ? 'md:mr-64' : 'md:ml-64'}`}>
        {/* Top Bar */}
        <header className="bg-white border-b border-gray-100 px-4 py-3 flex items-center justify-between sticky top-0 z-10 shadow-sm">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="md:hidden p-2 rounded-lg hover:bg-gray-100 text-gray-600"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <h2 className="font-semibold text-gray-700 text-sm md:text-base">{t(activeTab)}</h2>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 text-sm text-gray-500">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              <span>{t('online')}</span>
            </div>
            <div className="text-sm text-gray-600 hidden md:block">
              <span className="font-medium">{currentUser?.fullName}</span>
              <span className="text-gray-400 mx-1">·</span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium
                ${role === 'system_admin' ? 'bg-purple-100 text-purple-700' :
                  role === 'branch_admin'? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}`}>
                {getRoleDisplayName(role || '', t)}
              </span>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-auto">
          {renderContent()}
        </main>

        <footer className="bg-white border-t border-gray-100 px-4 py-2 text-center text-xs text-gray-400">
          {t('copyright')} · {t('version')} 1.0.0
        </footer>
      </div>
    </div>
  );
}
