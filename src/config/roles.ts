export type Role = 'employee' | 'store_manager' | 'area_manager' | 'general_manager' | 'admin';

export interface RolePermissions {
  canViewOwnSales?: boolean;
  canEdit?: boolean;
  canAdd?: boolean;
  canDelete?: boolean;
  canViewBranch?: boolean;
  canViewOthers?: boolean;
  canSendTasks?: boolean;
  canEditTargets?: boolean;
  canViewRegion?: boolean;
  canViewEmployeeDetails?: boolean;
  canEditEmployeeTargets?: boolean;
  canEditBranchTargets?: boolean;
  canViewAll?: boolean;
  canImportReports?: boolean;
  canEditRoles?: boolean;
  canDoEverything?: boolean;
}

export const ROLE_PERMISSIONS: Record<Role, RolePermissions> = {
  employee: {
    canViewOwnSales: true,
    canEdit: false,
    canAdd: false,
    canDelete: false,
    canViewBranch: true,
    canViewOthers: false,
  },
  store_manager: {
    canViewOwnSales: true,
    canViewBranch: true,
    canSendTasks: true,
    canEditTargets: false,
    canAdd: false,
    canDelete: false,
    canViewRegion: true,
    canViewEmployeeDetails: false,
  },
  area_manager: {
    canViewRegion: true,
    canEditEmployeeTargets: true,
    canEditBranchTargets: false,
    canAdd: false,
    canDelete: false,
  },
  general_manager: {
    canViewAll: true,
    canEditBranchTargets: true,
    canEditEmployeeTargets: true,
    canImportReports: true,
    canEditRoles: false,
  },
  admin: {
    canDoEverything: true,
  },
};

export const ROLE_DISPLAY_NAMES: Record<Role, string> = {
  employee: 'موظف',
  store_manager: 'مدير معرض',
  area_manager: 'مدير منطقة',
  general_manager: 'مدير عام',
  admin: 'مدير النظام',
};

export const ROLE_COLORS: Record<Role, string> = {
  employee: 'bg-blue-100 text-blue-800',
  store_manager: 'bg-green-100 text-green-800',
  area_manager: 'bg-purple-100 text-purple-800',
  general_manager: 'bg-orange-100 text-orange-800',
  admin: 'bg-red-100 text-red-800',
};
