import { Role, RolePermissions, ROLE_PERMISSIONS } from '../config/roles';

export type Permission = keyof RolePermissions;

/**
 * تحقق من صلاحية المستخدم لأداء عمل معين
 * @param userRole - دور المستخدم
 * @param action - العمل المطلوب التحقق من صلاحية المستخدم لأدائه
 * @returns true إذا كان المستخدم لديه الصلاحية، false إذا لم يكن
 */
export const checkPermission = (userRole: Role, action: Permission): boolean => {
  const permissions = ROLE_PERMISSIONS[userRole];
  
  // إذا كان المستخدم admin، فلديه كل الصلاحيات
  if (permissions.canDoEverything) {
    return true;
  }
  
  // تحقق من الصلاحية المحددة
  return permissions[action] === true;
};

/**
 * تحقق من عدة صلاحيات في نفس الوقت
 * @param userRole - دور المستخدم
 * @param actions - قائمة الأعمال المطلوب التحقق من صلاحية المستخدم لأدائها
 * @returns true إذا كان المستخدم لديه كل الصلاحيات المطلوبة
 */
export const checkMultiplePermissions = (userRole: Role, actions: Permission[]): boolean => {
  return actions.every(action => checkPermission(userRole, action));
};

/**
 * تحقق من صلاحية واحدة على الأقل من عدة صلاحيات
 * @param userRole - دور المستخدم
 * @param actions - قائمة الأعمال
 * @returns true إذا كان المستخدم لديه صلاحية واحدة على الأقل
 */
export const checkAnyPermission = (userRole: Role, actions: Permission[]): boolean => {
  return actions.some(action => checkPermission(userRole, action));
};

/**
 * الحصول على قائمة الصلاحيات المتاحة للمستخدم
 * @param userRole - دور المستخدم
 * @returns قائمة الصلاحيات المتاحة
 */
export const getUserPermissions = (userRole: Role): Permission[] => {
  const permissions = ROLE_PERMISSIONS[userRole];
  const availablePermissions: Permission[] = [];
  
  if (permissions.canDoEverything) {
    return Object.keys(ROLE_PERMISSIONS.employee) as Permission[];
  }
  
  Object.keys(permissions).forEach(key => {
    if (permissions[key as Permission] === true) {
      availablePermissions.push(key as Permission);
    }
  });
  
  return availablePermissions;
};

/**
 * تحقق من صلاحية عرض بيانات فرع معين
 * @param userRole - دور المستخدم
 * @param userStoreId - معرف فرع المستخدم
 * @param targetStoreId - معرف الفرع المستهدف
 * @returns true إذا كان المستخدم يمكنه عرض بيانات الفرع
 */
export const canViewStoreData = (userRole: Role, userStoreId?: string, targetStoreId?: string): boolean => {
  // Admin يمكنه عرض كل شيء
  if (checkPermission(userRole, 'canDoEverything')) {
    return true;
  }
  
  // General Manager يمكنه عرض كل شيء
  if (checkPermission(userRole, 'canViewAll')) {
    return true;
  }
  
  // Area Manager يمكنه عرض منطقته
  if (checkPermission(userRole, 'canViewRegion')) {
    return true;
  }
  
  // Store Manager و Employee يمكنهم عرض فرعهم فقط
  if (checkPermission(userRole, 'canViewBranch')) {
    return userStoreId === targetStoreId;
  }
  
  return false;
};

/**
 * تحقق من صلاحية تعديل بيانات فرع معين
 * @param userRole - دور المستخدم
 * @param userStoreId - معرف فرع المستخدم
 * @param targetStoreId - معرف الفرع المستهدف
 * @returns true إذا كان المستخدم يمكنه تعديل بيانات الفرع
 */
export const canEditStoreData = (userRole: Role, userStoreId?: string, targetStoreId?: string): boolean => {
  // Admin يمكنه تعديل كل شيء
  if (checkPermission(userRole, 'canDoEverything')) {
    return true;
  }
  
  // General Manager يمكنه تعديل أهداف الفروع
  if (checkPermission(userRole, 'canEditBranchTargets')) {
    return true;
  }
  
  // Area Manager يمكنه تعديل أهداف الموظفين في منطقته
  if (checkPermission(userRole, 'canEditEmployeeTargets')) {
    return userStoreId === targetStoreId;
  }
  
  return false;
};
