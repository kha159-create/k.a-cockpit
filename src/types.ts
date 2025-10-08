
// FIX: Use firebase compat types to resolve module export errors.
import firebase from 'firebase/app';
import 'firebase/auth';
import 'firebase/firestore';

export type User = firebase.User;
export type Timestamp = firebase.firestore.Timestamp;


export type UserRole = 'admin' | 'general_manager' | 'area_manager' | 'store_manager' | 'employee';

export interface UserProfile {
    id: string; // Will be the user's UID
    name: string;
    role: UserRole;
    email: string;
    employeeId?: string;
    phone?: string;
    areaManager?: string; // For area_manager role
    store?: string; // For store_manager and employee roles
    status?: 'pending' | 'active';
}


export interface BaseDocument {
  id: string;
}

export interface Store extends BaseDocument {
  name: string;
  areaManager: string;
  targets?: { [year: string]: { [month: string]: number } };
}

export interface Employee extends BaseDocument {
  name: string;
  currentStore: string;
  assignments?: { [key: string]: string; }; // e.g., { "2024-10": "Riyadh Gallery", "2024-11": "Nakheel Mall" }
  status?: 'active' | 'inactive';
  employeeId?: string;
  phone?: string;
  targets?: { [year: string]: { [month: string]: number } };
  duvetTargets?: { [year: string]: { [month: string]: number } };
}

export interface DailyMetric extends BaseDocument {
  date: Timestamp;
  store: string;
  employee?: string;
  employeeId?: string;
  totalSales?: number;
  transactionCount?: number;
  visitors?: number;
  isMonthlySummary?: boolean;
}

export interface SalesTransaction extends BaseDocument {
  'Bill Dt.': Timestamp;
  'Outlet Name': string;
  'SalesMan Name': string;
  employeeId?: string;
  'Item Name': string;
  'Item Alias': string;
  'Sold Qty': number;
  'Item Rate': number;
}

export interface DateFilter {
  year: number | 'all';
  month: number | 'all';
  day: number | 'all';
}

export interface AreaStoreFilterState {
  areaManager: string; // 'All' or manager name
  store: string;       // 'All' or store name
}

export interface ModalState {
  type: string | null;
  data?: any;
}

export interface AppMessage {
  isOpen: boolean;
  text: string;
  type: 'alert' | 'confirm';
  onConfirm?: () => void;
}

export interface BusinessRule extends BaseDocument {
    rule: string;
}

export interface Notification {
  id: string; // Based on the user's UID
  userName: string;
  message: string;
  type: 'newUser';
  timestamp: Timestamp;
  read: boolean;
}

export interface PredictionResult {
    predictedSales: number;
    riskScore: number; // A score from 0 to 100
    justification: string;
}

export interface Task extends BaseDocument {
  senderId: string;
  senderName: string;
  recipientId: string; // Corresponds to employeeId
  recipientName: string;
  title: string;
  message: string;
  status: 'pending' | 'completed';
  createdAt: Timestamp;
  completedAt?: Timestamp;
}


// --- Processed Data Types ---

export interface KPIData {
  totalSales: number;
  totalTransactions: number;
  averageTransactionValue: number;
  conversionRate: number;
  salesPerVisitor: number;
}

export interface StoreSummary extends Store {
  totalSales: number;
  transactionCount: number;
  visitors: number;
  atv: number;
  visitorRate: number;
  effectiveTarget: number;
  targetAchievement: number;
  salesPerVisitor: number;
}

export interface EmployeeSummary extends Employee {
    store: string; // The store for the reporting period
    totalSales: number;
    totalTransactions: number;
    atv: number;
    effectiveTarget: number;
    achievement: number;
}

export interface ProductSummary {
    id: string;
    name: string;
    alias: string;
    price: number;
    soldQty: number;
    totalValue: number;
}

export interface DuvetSummary {
    [storeName: string]: {
        name: string;
        'Low Value (199-399)': number;
        'Medium Value (495-695)': number;
        'High Value (795-999)': number;
        total: number;
    };
}

export interface CommissionStoreData {
    name: string;
    achievement: number;
    commissionRate: number; // as percentage
    employees: (EmployeeSummary & {
        finalCommissionRate: number; // as percentage
        commissionAmount: number;
    })[];
}

export type FilterableData = DailyMetric | SalesTransaction;