// Three user types:
// system_admin  – global access, manages branch admins and user admins
// branch_admin  – manages their own branch only (spaces, vehicles, subscribers, reports)
// user_admin    – operator within a branch (entry/exit/search only)
export type UserRole = 'system_admin' | 'branch_admin' | 'user_admin';

export interface User {
  id: string;
  username: string;
  fullName: string;
  email: string;
  role: UserRole;
  enabled: boolean;
  createdAt: string;
  lastLogin?: string;
  /** branchId is required for branch_admin and user_admin; null for system_admin */
  branchId?: string;
}

export interface ParkingLocation {
  id: string;
  name: string;
  address: string;
  phoneNumber: string;
  capacity: number;
  spacePrefix?: string;
  status: 'active' | 'inactive';
  hourlyRate1: number;
  hourlyRate2: number;
  hourlyRate3: number;
  createdAt: string;
}

export interface ParkingSpace {
  id: string;
  spaceNumber: string;
  status: 'available' | 'occupied';
  locationId: string;
}

export interface VehicleEditRecord {
  editedBy: string;
  editedByRole: UserRole;
  editedAt: string;
  field: string;
  oldValue: string;
  newValue: string;
}

export interface VehicleRecord {
  id: string;
  plateNumber: string;
  parkingSpaceId: string;
  parkingSpaceNumber: string;
  locationId: string;
  entryDate: string;
  entryTime: string;
  exitDate?: string;
  exitTime?: string;
  duration?: string;
  fee?: number;
  status: 'inside' | 'completed';
  driverName?: string;
  vehicleType?: string;
  vehicleColor?: string;
  editHistory?: VehicleEditRecord[];
  qrToken?: string;
  receiptNumber?: string | null;
  receiptGeneratedAt?: string | null;
}

export interface MonthlySubscriber {
  id: string;
  plateNumber: string;
  driverName: string;
  phoneNumber: string;
  vehicleType: string;
  vehicleColor: string;
  startDate: string;
  subscriptionPeriod: number;
  paymentAmount: number;
  notes?: string;
  expirationDate: string;
  remainingDays: number;
  paymentStatus: 'paid' | 'unpaid';
  locationId: string;
}

export interface SystemSettings {
  totalCapacity: number;
  hourlyRate1: number;
  hourlyRate2: number;
  hourlyRate3: number;
  currency: string;
  timezone: string;
  defaultLocationId?: string;
  parkingName?: string;
  address?: string;
  phoneNumber?: string;
  companyLogo?: string;
  companyWebsite?: string;
}

export interface ActivityLog {
  id: string;
  userId: string | null;
  username: string;
  userRole: UserRole;
  action: string;
  category: string;
  oldValue?: string;
  newValue?: string;
  timestamp: string;
  ipAddress: string;
  locationId?: string;
}

export interface BackupRecord {
  id: string;
  date: string;
  size: string;
  filename: string;
  checksum?: string;
}

export interface DashboardStats {
  vehiclesInside: number;
  todayVehicles: number;
  weeklyVehicles: number;
  monthlyVehicles: number;
  annualVehicles: number;
  todayRevenue: number;
  weeklyRevenue: number;
  monthlyRevenue: number;
  annualRevenue: number;
  totalRevenue: number;
  monthlySubscribers: number;
  totalSpaces: number;
  availableSpaces: number;
  occupiedSpaces: number;
  occupancyPercentage: number;
}
