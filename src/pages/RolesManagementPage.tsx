import React from 'react';
import { useLocale } from '../context/LocaleContext';
import RoleBadge from '../components/RoleBadge';
import { Role, ROLE_DISPLAY_NAMES } from '../config/roles';

const RolesManagementPage: React.FC = () => {
  const { t } = useLocale();

  const roleStats = {} as Record<Role, number>;

  return (
    <div className="space-y-6">
      {/* إحصائيات الأدوار */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {Object.entries(ROLE_DISPLAY_NAMES).map(([role, displayName]) => (
          <div key={role} className="bg-white rounded-xl shadow-lg border border-neutral-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">{displayName}</p>
                <p className="text-2xl font-bold text-gray-900">
                  {roleStats[role as Role] || 0}
                </p>
              </div>
              <RoleBadge role={role as Role} size="sm" />
            </div>
          </div>
        ))}
      </div>

      {/* جدول المستخدمين */}
        <div className="bg-white rounded-xl shadow-lg border border-neutral-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">{t('roles_management')}</h2>
            <p className="text-gray-600 mt-1">{t('modify_roles')}</p>
            <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-blue-800 font-medium">🧭 {t('roles_guide')}</p>
              <p className="text-blue-700 text-sm mt-1">{t('roles_description')}</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm text-gray-500">{t('total_users')}</p>
              <p className="text-2xl font-bold text-orange-600">0</p>
            </div>
            <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center">
              <span className="text-orange-600 text-xl">👥</span>
            </div>
          </div>
        </div>

        <div className="text-center py-12">
          <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-orange-600 text-2xl">🚫</span>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">{t('roles_management')}</h3>
          <p className="text-gray-600">تم تعطيل إدارة الصلاحيات لأن النظام لا يتصل بـ Firestore.</p>
        </div>
      </div>

      {/* دليل الصلاحيات */}
      <div className="bg-white rounded-xl shadow-lg border border-neutral-200 p-6">
        <h3 className="text-lg font-bold text-gray-900 mb-4">{t('roles_guide')}</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="border border-gray-200 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <RoleBadge role="employee" size="sm" />
            </div>
            <p className="text-sm text-gray-600">{t('view_own_sales_only')}</p>
          </div>
          <div className="border border-gray-200 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <RoleBadge role="store_manager" size="sm" />
            </div>
            <p className="text-sm text-gray-600">{t('manage_branch_employees')}</p>
          </div>
          <div className="border border-gray-200 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <RoleBadge role="area_manager" size="sm" />
            </div>
            <p className="text-sm text-gray-600">{t('edit_employee_targets')}</p>
          </div>
          <div className="border border-gray-200 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <RoleBadge role="general_manager" size="sm" />
            </div>
            <p className="text-sm text-gray-600">{t('view_all_areas')}</p>
          </div>
          <div className="border border-gray-200 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <RoleBadge role="admin" size="sm" />
            </div>
            <p className="text-sm text-gray-600">{t('full_permissions')}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RolesManagementPage;
