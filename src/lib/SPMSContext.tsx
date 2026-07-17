'use client';
import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import type { User, ParkingLocation, ParkingSpace, VehicleRecord, MonthlySubscriber, SystemSettings, ActivityLog, BackupRecord, DashboardStats, UserRole } from './types';

// ─── Fee Calculation ──────────────────────────────────────────────────────────

export interface FeeRateSettings {
  hourlyRate1: number;
  hourlyRate2: number;
  hourlyRate3: number;
}

export function calculateFee(entryDate: string, entryTime: string, settings: FeeRateSettings): { fee: number; duration: string } {
  const entry = new Date(`${entryDate}T${entryTime}`);
  const now = new Date();
  const diffMs = now.getTime() - entry.getTime();
  const diffMins = Math.max(0, Math.floor(diffMs / 60000));
  const hours = Math.floor(diffMins / 60);
  const mins = diffMins % 60;

  let fee = 0;
  if (diffMins <= 60) {
    fee = settings.hourlyRate1;
  } else if (diffMins <= 120) {
    fee = settings.hourlyRate1 + settings.hourlyRate2;
  } else {
    const extraHours = Math.ceil((diffMins - 120) / 60);
    fee = settings.hourlyRate1 + settings.hourlyRate2 + extraHours * settings.hourlyRate3;
  }

  const days = Math.floor(hours / 24);
  const remHours = hours % 24;
  let duration = '';
  if (days > 0) duration += `${days}d `;
  if (remHours > 0) duration += `${remHours}h `;
  duration += `${mins}m`;

  return { fee, duration: duration.trim() };
}

function simpleChecksum(data: string): string {
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return `crc32:${Math.abs(hash).toString(16).padStart(8, '0')}`;
}

// ─── Role helpers ─────────────────────────────────────────────────────────────

export function isSystemAdmin(user: User | null): boolean {
  return user?.role === 'system_admin';
}

export function isBranchAdmin(user: User | null): boolean {
  return user?.role === 'branch_admin';
}

export function isUserAdmin(user: User | null): boolean {
  return user?.role === 'user_admin';
}

/** Returns the branch ID the current user is restricted to (null = global) */
export function getUserBranchId(user: User | null): string | null {
  if (!user) return null;
  if (user.role === 'system_admin') return null;
  return user.branchId || null;
}

/** Returns the effective location ID for forms and writes. */
export function getEffectiveLocationId(
  branchId: string | null,
  selectedLocationId: string,
  locations: { id: string }[]
): string | null {
  if (branchId) return branchId;
  if (selectedLocationId && selectedLocationId !== 'all') return selectedLocationId;
  return locations[0]?.id ?? null;
}

/** Shared parking availability — used by Dashboard and Vehicle Entry. */
export function getParkingAvailability(
  spaces: ParkingSpace[],
  options: {
    branchId: string | null;
    selectedLocationId: string;
    entryLocationId?: string | null;
  }
): {
  scopedSpaces: ParkingSpace[];
  availableSpaces: ParkingSpace[];
  totalSpaces: number;
  isFull: boolean;
} {
  const { branchId, selectedLocationId, entryLocationId } = options;

  let scopedSpaces: ParkingSpace[];

  if (entryLocationId) {
    scopedSpaces = spaces.filter((s) => s.locationId === entryLocationId);
  } else if (branchId) {
    scopedSpaces = spaces.filter((s) => s.locationId === branchId);
  } else if (selectedLocationId && selectedLocationId !== 'all') {
    scopedSpaces = spaces.filter((s) => s.locationId === selectedLocationId);
  } else {
    scopedSpaces = spaces;
  }

  const availableSpaces = scopedSpaces.filter((s) => s.status === 'available');
  const totalSpaces = scopedSpaces.length;

  return {
    scopedSpaces,
    availableSpaces,
    totalSpaces,
    isFull: totalSpaces > 0 && availableSpaces.length === 0,
  };
}

// ─── API helpers ──────────────────────────────────────────────────────────────

async function apiFetch(url: string, options?: RequestInit) {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(err.message || err.error || 'Request failed');
  }
  return res.json();
}

// ─── Context ──────────────────────────────────────────────────────────────────

interface SPMSContextType {
  currentUser: User | null;
  login: (username: string, password: string) => Promise<{ success: boolean; message?: string }>;
  logout: () => void;
  users: User[];
  allUsers: User[];
  locations: ParkingLocation[];
  spaces: ParkingSpace[];
  vehicles: VehicleRecord[];
  subscribers: MonthlySubscriber[];
  settings: SystemSettings;
  activityLogs: ActivityLog[];
  backups: BackupRecord[];
  selectedLocationId: string;
  setSelectedLocationId: (id: string) => void;
  loading: boolean;
  dataLoaded: boolean;
  refreshData: () => Promise<void>;
  addUser: (u: Omit<User, 'id' | 'createdAt'> & { password: string }) => Promise<void>;
  updateUser: (id: string, u: Partial<User> & { password?: string }) => Promise<void>;
  deleteUser: (id: string) => Promise<void>;
  resetUserPassword: (id: string, newPass: string) => Promise<void>;
  addLocation: (l: Omit<ParkingLocation, 'id' | 'createdAt'>) => Promise<{ success: boolean; message: string }>;
  updateLocation: (id: string, l: Partial<ParkingLocation>) => Promise<void>;
  deleteLocation: (id: string) => Promise<{ success: boolean; message: string }>;
  toggleLocationStatus: (id: string) => Promise<void>;
  addSpace: (s: Omit<ParkingSpace, 'id'>) => Promise<void>;
  updateSpace: (id: string, s: Partial<ParkingSpace>) => Promise<void>;
  deleteSpace: (id: string) => Promise<void>;
  registerEntry: (plateNumber: string, spaceNumber: string, locationId?: string, extra?: { driverName?: string; vehicleType?: string; vehicleColor?: string }) => Promise<{ success: boolean; message: string; vehicle?: VehicleRecord }>;
  registerExit: (vehicleId: string) => Promise<{ success: boolean; message: string; vehicle?: VehicleRecord }>;
  updateVehicle: (id: string, fields: Partial<Pick<VehicleRecord, 'plateNumber' | 'parkingSpaceNumber' | 'vehicleType' | 'vehicleColor' | 'driverName'>>) => Promise<{ success: boolean; message: string }>;
  addSubscriber: (s: Omit<MonthlySubscriber, 'id' | 'expirationDate' | 'remainingDays'>) => Promise<void>;
  updateSubscriber: (id: string, s: Partial<MonthlySubscriber>) => Promise<void>;
  deleteSubscriber: (id: string) => Promise<void>;
  updateSettings: (s: Partial<SystemSettings>) => Promise<void>;
  createBackup: () => BackupRecord;
  downloadBackup: (backupId: string) => void;
  deleteBackup: (backupId: string) => void;
  restoreBackup: (file: File) => Promise<{ success: boolean; message: string }>;
  archiveData: (options: ArchiveOptions) => { success: boolean; message: string; count: number };
  getDashboardStats: (locationId?: string) => DashboardStats;
}

export interface ArchiveOptions {
  type: 'dateRange' | 'month' | 'year' | 'all';
  startDate?: string;
  endDate?: string;
  month?: string;
  year?: string;
  includeActivityLogs?: boolean;
}

const DEFAULT_SETTINGS: SystemSettings = {
  totalCapacity: 50,
  hourlyRate1: 1000,
  hourlyRate2: 1500,
  hourlyRate3: 2000,
  currency: 'IQD',
  timezone: 'Asia/Baghdad',
};

const SPMSContext = createContext<SPMSContextType | null>(null);

export function SPMSProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [allUsersState, setAllUsersState] = useState<User[]>([]);
  const [locations, setLocations] = useState<ParkingLocation[]>([]);
  const [allSpaces, setAllSpaces] = useState<ParkingSpace[]>([]);
  const [allVehicles, setAllVehicles] = useState<VehicleRecord[]>([]);
  const [allSubscribers, setAllSubscribers] = useState<MonthlySubscriber[]>([]);
  const [settings, setSettings] = useState<SystemSettings>(DEFAULT_SETTINGS);
  const [allActivityLogs, setAllActivityLogs] = useState<ActivityLog[]>([]);
  const [backups, setBackups] = useState<BackupRecord[]>([]);
  const [selectedLocationId, setSelectedLocationId] = useState<string>('all');
  const [loading, setLoading] = useState(false);
  const [dataLoaded, setDataLoaded] = useState(false);
  const refreshRequestRef = useRef(0);
  const skipRefreshEffectRef = useRef(false);

  const branchId = getUserBranchId(currentUser);

  // ─── Load data from API ────────────────────────────────────────────────────

  const refreshData = useCallback(async (userOverride?: User) => {
    const user = userOverride ?? currentUser;
    if (!user) return;
    const requestId = ++refreshRequestRef.current;
    const userBranchId = getUserBranchId(user);
    setLoading(true);
    try {
      const locParam = userBranchId ? `?locationId=${userBranchId}` : '';
      const pageParam = locParam ? '&pageSize=500' : '?pageSize=500';

      const [locsR, spacesR, vehiclesR, subscribersR, settingsR, logsR] = await Promise.allSettled([
        apiFetch('/api/locations'),
        apiFetch(`/api/spaces${locParam}${pageParam}`),
        apiFetch(`/api/vehicles${locParam}${pageParam}`),
        apiFetch(`/api/subscribers${locParam}${pageParam}`),
        apiFetch('/api/settings'),
        apiFetch(`/api/activity-logs${locParam}${pageParam}`),
      ]);

      if (requestId !== refreshRequestRef.current) return;

      const locs = locsR.status === 'fulfilled' ? locsR.value : null;
      const spaces = spacesR.status === 'fulfilled' ? spacesR.value : null;
      const vehicles = vehiclesR.status === 'fulfilled' ? vehiclesR.value : null;
      const subscribers = subscribersR.status === 'fulfilled' ? subscribersR.value : null;
      const settingsData = settingsR.status === 'fulfilled' ? settingsR.value : null;
      const logs = logsR.status === 'fulfilled' ? logsR.value : null;

      if (vehiclesR.status === 'rejected') console.error('Failed to load vehicles:', vehiclesR.reason);
      if (subscribersR.status === 'rejected') console.error('Failed to load subscribers:', subscribersR.reason);
      if (settingsR.status === 'rejected') console.error('Failed to load settings:', settingsR.reason);
      if (logsR.status === 'rejected') console.error('Failed to load activity logs:', logsR.reason);

      let users: User[] = [];
      if (user.role === 'system_admin') {
        try {
          users = await apiFetch('/api/users');
        } catch (err) {
          console.error('Failed to load users:', err);
        }
      } else if (user.role === 'branch_admin' && userBranchId) {
        try {
          users = await apiFetch(`/api/users?branchId=${userBranchId}`);
        } catch (err) {
          console.error('Failed to load users:', err);
        }
      }

      if (requestId !== refreshRequestRef.current) return;

      const spacesList = Array.isArray(spaces?.data)
        ? spaces.data
        : Array.isArray(spaces)
          ? spaces
          : [];

      if (locs) setLocations(locs.data || locs);
      if (spaces) setAllSpaces(spacesList);
      if (vehicles) setAllVehicles(vehicles.data || []);
      if (subscribers) setAllSubscribers(subscribers.data || subscribers);
      if (settingsData) setSettings({ ...DEFAULT_SETTINGS, ...settingsData });
      if (logs) setAllActivityLogs(logs.data || logs);
      setAllUsersState(users.data || users);

      if (locs && spaces) {
        setDataLoaded(true);
      }
    } catch (err) {
      console.error('Failed to load data:', err);
    } finally {
      if (requestId === refreshRequestRef.current) {
        setLoading(false);
      }
    }
  }, [currentUser]);

  useEffect(() => {
    if (skipRefreshEffectRef.current) {
      skipRefreshEffectRef.current = false;
      return;
    }
    if (currentUser) {
      refreshData();
    }
  }, [currentUser?.id]);

  useEffect(() => {
    if (branchId) {
      setSelectedLocationId(branchId);
    } else {
      setSelectedLocationId('all');
    }
  }, [branchId]);

  // ─── Branch-scoped data derivation ────────────────────────────────────────

  const locations_visible = branchId
    ? locations.filter(l => l.id === branchId)
    : locations;

  const users_visible = currentUser?.role === 'system_admin'
    ? allUsersState
    : currentUser?.role === 'branch_admin'
      ? allUsersState.filter(u => u.branchId === branchId || u.id === currentUser?.id)
      : [];

  const spaces = branchId ? allSpaces.filter(s => s.locationId === branchId) : allSpaces;
  const vehicles = branchId ? allVehicles.filter(v => v.locationId === branchId) : allVehicles;
  const subscribers = branchId ? allSubscribers.filter(s => s.locationId === branchId) : allSubscribers;
  const activityLogs = branchId ? allActivityLogs.filter(l => !l.locationId || l.locationId === branchId) : allActivityLogs;

  // ─── Auth ─────────────────────────────────────────────────────────────────

  const login = useCallback(async (username: string, password: string): Promise<{ success: boolean; message?: string }> => {
    try {
      const { signIn } = await import('next-auth/react');
      const result = await signIn('credentials', {
        username,
        password,
        redirect: false,
      });

      if (result?.error) {
        if (result.error === 'ACCOUNT_LOCKED') {
          return { success: false, message: 'accountLocked' };
        }
        return { success: false, message: 'loginError' };
      }

      if (result?.ok) {
        // Fetch session to get user data
        const { getSession } = await import('next-auth/react');
        const session = await getSession();
        if (session?.user) {
          const u = session.user as any;
          const userData: User = {
            id: u.id,
            username: u.username,
            fullName: u.fullName,
            email: u.email || '',
            role: u.role as UserRole,
            branchId: u.branchId,
            enabled: true,
            createdAt: new Date().toISOString().split('T')[0],
          };
          await refreshData(userData);
          skipRefreshEffectRef.current = true;
          setCurrentUser(userData);
          if (userData.branchId) {
            setSelectedLocationId(userData.branchId);
          }
          return { success: true };
        }
      }

      return { success: false, message: 'loginError' };
    } catch (err: any) {
      return { success: false, message: 'loginError' };
    }
  }, [refreshData]);

  const logout = useCallback(async () => {
    if (currentUser) {
      try {
        await apiFetch('/api/activity-logs', {
          method: 'POST',
          body: JSON.stringify({
            userId: currentUser.id,
            username: currentUser.username,
            userRole: currentUser.role,
            action: 'User logged out',
            category: 'auth',
            locationId: currentUser.branchId,
          }),
        });
      } catch {}
    }
    const { signOut } = await import('next-auth/react');
    await signOut({ redirect: false });
    refreshRequestRef.current += 1;
    skipRefreshEffectRef.current = false;
    setCurrentUser(null);
    setAllUsersState([]);
    setLocations([]);
    setAllSpaces([]);
    setAllVehicles([]);
    setAllSubscribers([]);
    setAllActivityLogs([]);
    setDataLoaded(false);
    setLoading(false);
  }, [currentUser]);

  // ─── User Actions ─────────────────────────────────────────────────────────

  const addUser = useCallback(async (u: Omit<User, 'id' | 'createdAt'> & { password: string }) => {
    const newUser = await apiFetch('/api/users', {
      method: 'POST',
      body: JSON.stringify({
        ...u,
        actorId: currentUser?.id,
        actorUsername: currentUser?.username,
        actorRole: currentUser?.role,
      }),
    });
    setAllUsersState(prev => [...prev, newUser]);
  }, [currentUser]);

  const updateUser = useCallback(async (id: string, u: Partial<User> & { password?: string }) => {
    const updated = await apiFetch(`/api/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify({
        ...u,
        actorId: currentUser?.id,
        actorUsername: currentUser?.username,
        actorRole: currentUser?.role,
      }),
    });
    setAllUsersState(prev => prev.map(x => x.id === id ? { ...x, ...updated } : x));
  }, [currentUser]);

  const deleteUser = useCallback(async (id: string) => {
    await apiFetch(`/api/users/${id}`, {
      method: 'DELETE',
      body: JSON.stringify({
        actorId: currentUser?.id,
        actorUsername: currentUser?.username,
        actorRole: currentUser?.role,
      }),
    });
    setAllUsersState(prev => prev.filter(x => x.id !== id));
  }, [currentUser]);

  const resetUserPassword = useCallback(async (id: string, newPass: string) => {
    await apiFetch(`/api/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify({
        password: newPass,
        actorId: currentUser?.id,
        actorUsername: currentUser?.username,
        actorRole: currentUser?.role,
      }),
    });
  }, [currentUser]);

  // ─── Location Actions ─────────────────────────────────────────────────────

  const addLocation = useCallback(async (l: Omit<ParkingLocation, 'id' | 'createdAt'>): Promise<{ success: boolean; message: string }> => {
    try {
      const newLoc = await apiFetch('/api/locations', {
        method: 'POST',
        body: JSON.stringify({ ...l, userId: currentUser?.id, username: currentUser?.username, userRole: currentUser?.role }),
      });
      setLocations(prev => [...prev, newLoc]);
      await refreshData();
      return { success: true, message: 'successSaved' };
    } catch (err: any) {
      return { success: false, message: err.message || 'errorGeneral' };
    }
  }, [currentUser, refreshData]);

  const updateLocation = useCallback(async (id: string, l: Partial<ParkingLocation>) => {
    const updated = await apiFetch(`/api/locations/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ ...l, userId: currentUser?.id, username: currentUser?.username, userRole: currentUser?.role }),
    });
    setLocations(prev => prev.map(x => x.id === id ? { ...x, ...updated } : x));
  }, [currentUser]);

  const deleteLocation = useCallback(async (id: string): Promise<{ success: boolean; message: string }> => {
    try {
      await apiFetch(`/api/locations/${id}`, {
        method: 'DELETE',
        body: JSON.stringify({ userId: currentUser?.id, username: currentUser?.username, userRole: currentUser?.role }),
      });
      setLocations(prev => prev.filter(x => x.id !== id));
      return { success: true, message: 'successDeleted' };
    } catch (err: any) {
      return { success: false, message: err.message || 'errorGeneral' };
    }
  }, [currentUser]);

  const toggleLocationStatus = useCallback(async (id: string) => {
    const loc = locations.find(x => x.id === id);
    if (!loc) return;
    const newStatus = loc.status === 'active' ? 'inactive' : 'active';
    await updateLocation(id, { status: newStatus });
  }, [locations, updateLocation]);

  // ─── Space Actions ────────────────────────────────────────────────────────

  const addSpace = useCallback(async (s: Omit<ParkingSpace, 'id'>) => {
    const locId = s.locationId || getEffectiveLocationId(branchId, selectedLocationId, locations);
    if (!locId) throw new Error('No location selected');
    const newSpace = await apiFetch('/api/spaces', {
      method: 'POST',
      body: JSON.stringify({ ...s, locationId: locId }),
    });
    setAllSpaces(prev => [...prev, newSpace]);
  }, [branchId, selectedLocationId, locations]);

  const updateSpace = useCallback(async (id: string, s: Partial<ParkingSpace>) => {
    const updated = await apiFetch(`/api/spaces/${id}`, {
      method: 'PUT',
      body: JSON.stringify(s),
    });
    setAllSpaces(prev => prev.map(x => x.id === id ? { ...x, ...updated } : x));
  }, []);

  const deleteSpace = useCallback(async (id: string) => {
    await apiFetch(`/api/spaces/${id}`, { method: 'DELETE' });
    setAllSpaces(prev => prev.filter(x => x.id !== id));
  }, []);

  // ─── Vehicle Actions ──────────────────────────────────────────────────────

  const registerEntry = useCallback(async (
    plateNumber: string,
    spaceNumber: string,
    locationId?: string,
    extra?: { driverName?: string; vehicleType?: string; vehicleColor?: string }
  ): Promise<{ success: boolean; message: string; vehicle?: VehicleRecord }> => {
    const locId = branchId
      ? branchId
      : (locationId && locationId !== 'all')
        ? locationId
        : getEffectiveLocationId(branchId, selectedLocationId, locations);

    if (!locId) return { success: false, message: 'spaceNotFound' };

    const space = allSpaces.find(s => s.spaceNumber === spaceNumber && s.locationId === locId);
    if (!space) return { success: false, message: 'spaceNotFound' };

    const now = new Date();
    try {
      const vehicle = await apiFetch('/api/vehicles', {
        method: 'POST',
        body: JSON.stringify({
          plateNumber,
          parkingSpaceId: space.id,
          parkingSpaceNumber: spaceNumber,
          locationId: locId,
          entryDate: now.toISOString().split('T')[0],
          entryTime: now.toTimeString().slice(0, 5),
          ...extra,
          userId: currentUser?.id,
          username: currentUser?.username,
          userRole: currentUser?.role,
        }),
      });
      setAllVehicles(prev => [vehicle, ...prev]);
      setAllSpaces(prev => prev.map(s => s.id === space.id ? { ...s, status: 'occupied' } : s));
      return { success: true, message: 'successEntry', vehicle };
    } catch (err: any) {
      return { success: false, message: err.message || 'errorGeneral' };
    }
  }, [allSpaces, currentUser, selectedLocationId, branchId, locations]);

  const registerExit = useCallback(async (vehicleId: string): Promise<{ success: boolean; message: string; vehicle?: VehicleRecord }> => {
    try {
      const updated = await apiFetch(`/api/vehicles/${vehicleId}`, {
        method: 'PUT',
        body: JSON.stringify({
          action: 'exit',
          userId: currentUser?.id,
          username: currentUser?.username,
          userRole: currentUser?.role,
        }),
      });
      setAllVehicles(prev => prev.map(v => v.id === vehicleId ? { ...v, ...updated } : v));
      setAllSpaces(prev => prev.map(s => s.id === updated.parkingSpaceId ? { ...s, status: 'available' } : s));
      return { success: true, message: 'successExit', vehicle: updated };
    } catch (err: any) {
      return { success: false, message: err.message || 'errorGeneral' };
    }
  }, [currentUser]);

  const updateVehicle = useCallback(async (
    id: string,
    fields: Partial<Pick<VehicleRecord, 'plateNumber' | 'parkingSpaceNumber' | 'vehicleType' | 'vehicleColor' | 'driverName'>>
  ): Promise<{ success: boolean; message: string }> => {
    const previousVehicle = allVehicles.find(v => v.id === id);
    try {
      const updated = await apiFetch(`/api/vehicles/${id}`, {
        method: 'PUT',
        body: JSON.stringify({
          ...fields,
          userId: currentUser?.id,
          username: currentUser?.username,
          userRole: currentUser?.role,
        }),
      });
      setAllVehicles(prev => prev.map(v => v.id === id ? { ...v, ...updated } : v));
      if (updated.parkingSpaceId && previousVehicle) {
        const oldSpaceId = updated.previousParkingSpaceId ?? previousVehicle.parkingSpaceId;
        setAllSpaces(prev => prev.map(s => {
          if (s.id === updated.parkingSpaceId) return { ...s, status: 'occupied' };
          if (s.id === oldSpaceId) return { ...s, status: 'available' };
          return s;
        }));
      }
      return { success: true, message: 'successSaved' };
    } catch (err: any) {
      return { success: false, message: err.message || 'errorGeneral' };
    }
  }, [currentUser, allVehicles]);

  // ─── Subscriber Actions ───────────────────────────────────────────────────

  const addSubscriber = useCallback(async (s: Omit<MonthlySubscriber, 'id' | 'expirationDate' | 'remainingDays'>) => {
    const locId = s.locationId || getEffectiveLocationId(branchId, selectedLocationId, locations);
    if (!locId) throw new Error('No location selected');
    const newSub = await apiFetch('/api/subscribers', {
      method: 'POST',
      body: JSON.stringify({ ...s, locationId: locId, userId: currentUser?.id, username: currentUser?.username, userRole: currentUser?.role }),
    });
    setAllSubscribers(prev => [...prev, newSub]);
  }, [currentUser, branchId, selectedLocationId, locations]);

  const updateSubscriber = useCallback(async (id: string, s: Partial<MonthlySubscriber>) => {
    const updated = await apiFetch(`/api/subscribers/${id}`, {
      method: 'PUT',
      body: JSON.stringify(s),
    });
    setAllSubscribers(prev => prev.map(x => x.id === id ? { ...x, ...updated } : x));
  }, []);

  const deleteSubscriber = useCallback(async (id: string) => {
    await apiFetch(`/api/subscribers/${id}`, {
      method: 'DELETE',
      body: JSON.stringify({ userId: currentUser?.id, username: currentUser?.username, userRole: currentUser?.role }),
    });
    setAllSubscribers(prev => prev.filter(x => x.id !== id));
  }, [currentUser]);

  // ─── Settings ─────────────────────────────────────────────────────────────

  const updateSettings = useCallback(async (s: Partial<SystemSettings>) => {
    const updated = await apiFetch('/api/settings', {
      method: 'PUT',
      body: JSON.stringify({ ...s, userId: currentUser?.id, username: currentUser?.username, userRole: currentUser?.role }),
    });
    setSettings(prev => ({ ...prev, ...updated }));
  }, [currentUser]);

  // ─── Backup (client-side JSON export) ────────────────────────────────────

  const createBackup = useCallback((): BackupRecord => {
    const backupData = { version: '1.0', timestamp: new Date().toISOString(), users: allUsersState, locations, spaces: allSpaces, vehicles: allVehicles, subscribers: allSubscribers, settings, activityLogs: allActivityLogs };
    const dataStr = JSON.stringify(backupData);
    const checksum = simpleChecksum(dataStr);
    const backup: BackupRecord = {
      id: `b${Date.now()}`,
      date: new Date().toLocaleString(),
      size: `${(dataStr.length / 1024).toFixed(1)} KB`,
      filename: `spms_backup_${new Date().toISOString().split('T')[0].replace(/-/g, '')}_${Date.now()}.json`,
      checksum,
    };
    setBackups(prev => [backup, ...prev]);
    return backup;
  }, [allUsersState, locations, allSpaces, allVehicles, allSubscribers, settings, allActivityLogs]);

  const downloadBackup = useCallback((backupId: string) => {
    const backup = backups.find(b => b.id === backupId);
    if (!backup) return;
    const backupData = { version: '1.0', timestamp: new Date().toISOString(), checksum: backup.checksum, users: allUsersState, locations, spaces: allSpaces, vehicles: allVehicles, subscribers: allSubscribers, settings };
    const dataStr = JSON.stringify(backupData, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = backup.filename; a.click();
    URL.revokeObjectURL(url);
  }, [backups, allUsersState, locations, allSpaces, allVehicles, allSubscribers, settings]);

  const deleteBackup = useCallback((backupId: string) => {
    setBackups(prev => prev.filter(b => b.id !== backupId));
  }, []);

  const restoreBackup = useCallback(async (file: File): Promise<{ success: boolean; message: string }> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const content = e.target?.result as string;
          const data = JSON.parse(content);
          if (!data.version || !data.timestamp) { resolve({ success: false, message: 'invalidBackupFile' }); return; }
          resolve({ success: true, message: 'restoreSuccess' });
        } catch { resolve({ success: false, message: 'invalidBackupFile' }); }
      };
      reader.readAsText(file);
    });
  }, []);

  // ─── Archive / Cleanup ────────────────────────────────────────────────────

  const archiveData = useCallback((options: ArchiveOptions): { success: boolean; message: string; count: number } => {
    let vehiclesToRemove: string[] = [];
    let logsToRemove: string[] = [];
    const completedVehicles = allVehicles.filter(v => v.status === 'completed');

    if (options.type === 'all') {
      vehiclesToRemove = completedVehicles.map(v => v.id);
      if (options.includeActivityLogs) logsToRemove = allActivityLogs.map(l => l.id);
    } else if (options.type === 'dateRange' && options.startDate && options.endDate) {
      vehiclesToRemove = completedVehicles.filter(v => v.exitDate && v.exitDate >= options.startDate! && v.exitDate <= options.endDate!).map(v => v.id);
      if (options.includeActivityLogs) logsToRemove = allActivityLogs.filter(l => l.timestamp.split('T')[0] >= options.startDate! && l.timestamp.split('T')[0] <= options.endDate!).map(l => l.id);
    } else if (options.type === 'month' && options.month) {
      vehiclesToRemove = completedVehicles.filter(v => v.exitDate?.startsWith(options.month!)).map(v => v.id);
      if (options.includeActivityLogs) logsToRemove = allActivityLogs.filter(l => l.timestamp.startsWith(options.month!)).map(l => l.id);
    } else if (options.type === 'year' && options.year) {
      vehiclesToRemove = completedVehicles.filter(v => v.exitDate?.startsWith(options.year!)).map(v => v.id);
      if (options.includeActivityLogs) logsToRemove = allActivityLogs.filter(l => l.timestamp.startsWith(options.year!)).map(l => l.id);
    }

    const count = vehiclesToRemove.length + logsToRemove.length;
    setAllVehicles(prev => prev.filter(v => !vehiclesToRemove.includes(v.id)));
    if (logsToRemove.length > 0) setAllActivityLogs(prev => prev.filter(l => !logsToRemove.includes(l.id)));
    return { success: true, message: 'archiveSuccess', count };
  }, [allVehicles, allActivityLogs]);

  // ─── Dashboard ────────────────────────────────────────────────────────────

  const getDashboardStats = useCallback((locationId?: string): DashboardStats => {
    const todayStr = new Date().toISOString().split('T')[0];
    const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];
    const monthAgo = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
    const yearAgo = new Date(Date.now() - 365 * 86400000).toISOString().split('T')[0];

    const effectiveLocId = branchId || locationId;
    const filteredVehicles = effectiveLocId ? allVehicles.filter(v => v.locationId === effectiveLocId) : allVehicles;
    const filteredSpaces = effectiveLocId ? allSpaces.filter(s => s.locationId === effectiveLocId) : allSpaces;
    const filteredSubscribers = effectiveLocId ? allSubscribers.filter(s => s.locationId === effectiveLocId) : allSubscribers;

    const inside = filteredVehicles.filter(v => v.status === 'inside');
    const completed = filteredVehicles.filter(v => v.status === 'completed');

    const todayRev = completed.filter(v => v.exitDate === todayStr).reduce((a, v) => a + (v.fee || 0), 0);
    const weeklyRev = completed.filter(v => v.exitDate && v.exitDate >= weekAgo).reduce((a, v) => a + (v.fee || 0), 0);
    const monthlyRev = completed.filter(v => v.exitDate && v.exitDate >= monthAgo).reduce((a, v) => a + (v.fee || 0), 0);
    const annualRev = completed.filter(v => v.exitDate && v.exitDate >= yearAgo).reduce((a, v) => a + (v.fee || 0), 0);
    const totalRev = completed.reduce((a, v) => a + (v.fee || 0), 0);

    const totalSpaces = filteredSpaces.length;
    const occupiedSpaces = filteredSpaces.filter(s => s.status === 'occupied').length;
    const availableSpaces = filteredSpaces.filter(s => s.status === 'available').length;
    const occupancyPercentage = totalSpaces > 0 ? Math.round((occupiedSpaces / totalSpaces) * 100) : 0;

    return {
      vehiclesInside: inside.length,
      todayVehicles: filteredVehicles.filter(v => v.entryDate === todayStr).length,
      weeklyVehicles: filteredVehicles.filter(v => v.entryDate >= weekAgo).length,
      monthlyVehicles: filteredVehicles.filter(v => v.entryDate >= monthAgo).length,
      annualVehicles: filteredVehicles.filter(v => v.entryDate >= yearAgo).length,
      todayRevenue: todayRev,
      weeklyRevenue: weeklyRev,
      monthlyRevenue: monthlyRev,
      annualRevenue: annualRev,
      totalRevenue: totalRev,
      monthlySubscribers: filteredSubscribers.length,
      totalSpaces,
      availableSpaces,
      occupiedSpaces,
      occupancyPercentage,
    };
  }, [allVehicles, allSubscribers, allSpaces, branchId]);

  return (
    <SPMSContext.Provider value={{
      currentUser, login, logout,
      users: users_visible,
      allUsers: allUsersState,
      locations: locations_visible,
      spaces, vehicles, subscribers, settings, activityLogs, backups,
      selectedLocationId, setSelectedLocationId,
      loading, dataLoaded,
      refreshData,
      addUser, updateUser, deleteUser, resetUserPassword,
      addLocation, updateLocation, deleteLocation, toggleLocationStatus,
      addSpace, updateSpace, deleteSpace,
      registerEntry, registerExit, updateVehicle,
      addSubscriber, updateSubscriber, deleteSubscriber,
      updateSettings,
      createBackup, downloadBackup, deleteBackup, restoreBackup,
      archiveData,
      getDashboardStats,
    }}>
      {children}
    </SPMSContext.Provider>
  );
}

export function useSPMS() {
  const ctx = useContext(SPMSContext);
  if (!ctx) throw new Error('useSPMS must be used within SPMSProvider');
  return ctx;
}
