import React, { useState, useEffect } from 'react';
import { db } from '../services/firebase';
import { useLocale } from '../context/LocaleContext';
import { Table } from '../components/Table';
import RoleBadge from '../components/RoleBadge';
import { Role, ROLE_DISPLAY_NAMES, ROLE_COLORS } from '../config/roles';

interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  status: string;
  employeeId?: string;
  approvedAt?: any;
}

const RolesManagementPage: React.FC = () => {
  const { t } = useLocale();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      // جلب جميع المستخدمين المعتمدين (approved أو admin بدون status)
      const snapshot = await db.collection('users')
        .get();
      
      const allUsers = snapshot.docs.map(doc => ({
        id: doc.id,
        name: doc.data().name || 'غير محدد',
        email: doc.data().email || '',
        employeeId: doc.data().employeeId || '',
        role: doc.data().role || 'employee',
        status: doc.data().status || 'pending',
        ...doc.data()
      })) as User[];
      
      // تصفية المستخدمين المعتمدين
      const approvedUsers = allUsers.filter(user => 
        user.status === 'approved' || 
        user.status === 'active' ||
        (user.role === 'admin' && !user.status)
      );
      
      setUsers(approvedUsers);
    } catch (error) {
      console.error('Error loading users:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRoleChange = async (userId: string, newRole: Role) => {
    setUpdating(userId);
    
    try {
      // تحديث دور المستخدم في users
      await db.collection('users').doc(userId).update({
        role: newRole,
        updatedAt: new Date(),
        updatedBy: 'admin' // يمكن تحسين هذا لاحقاً
      });

      // تحديث دور الموظف في employees إذا كان موجوداً
      const user = users.find(u => u.id === userId);
      if (user?.employeeId) {
        await db.collection('employees').doc(user.employeeId).update({
          role: newRole,
          updatedAt: new Date()
        });
      }

      // تحديث القائمة المحلية
      setUsers(prev => prev.map(u => 
        u.id === userId ? { ...u, role: newRole } : u
      ));
      
      alert(t('role_updated_successfully'));
    } catch (error) {
      console.error('Error updating role:', error);
      alert(t('failed_to_update_role'));
    } finally {
      setUpdating(null);
    }
  };

  const columns = [
    {
      key: 'name',
      label: t('user_name_new'),
      render: (value: string, record: User) => (
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center">
            <span className="text-orange-600 font-bold text-lg">
              {value?.charAt(0)?.toUpperCase() || 'U'}
            </span>
          </div>
          <div>
            <p className="font-medium text-gray-900">{value || 'غير محدد'}</p>
            <p className="text-sm text-gray-500">{record.email}</p>
          </div>
        </div>
      )
    },
    {
      key: 'employeeId',
      label: t('employee_id_new'),
      render: (value: string) => (
        <span className="font-mono font-semibold text-blue-600">
          {value || t('undefined')}
        </span>
      )
    },
    {
      key: 'role',
      label: t('current_role_new'),
      render: (value: Role) => (
        <RoleBadge role={value} size="md" />
      )
    },
    {
      key: 'status',
      label: t('status'),
      render: (value: string) => (
        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
          value === 'approved' || value === 'active'
            ? 'bg-green-100 text-green-800' 
            : 'bg-yellow-100 text-yellow-800'
        }`}>
          {value === 'approved' || value === 'active' ? t('approved') : t('pending')}
        </span>
      )
    },
    {
      key: 'actions',
      label: t('change_role_new'),
      render: (_: any, record: User) => (
        <div className="flex gap-2">
          <select
            value={record.role}
            onChange={(e) => handleRoleChange(record.id, e.target.value as Role)}
            disabled={updating === record.id}
            className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 disabled:opacity-50"
          >
            <option value="employee">👤 {t('employee')}</option>
            <option value="store_manager">🏬 {t('store_manager')}</option>
            <option value="area_manager">📍 {t('area_manager')}</option>
            <option value="general_manager">🎯 {t('general_manager')}</option>
            <option value="admin">👑 {t('admin')}</option>
          </select>
          {updating === record.id && (
            <div className="w-4 h-4 border-2 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
          )}
        </div>
      )
    }
  ];

  const roleStats = users.reduce((acc, user) => {
    acc[user.role] = (acc[user.role] || 0) + 1;
    return acc;
  }, {} as Record<Role, number>);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">جاري تحميل المستخدمين...</p>
        </div>
      </div>
    );
  }

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
            <h2 className="text-2xl font-bold text-gray-900">{t('manage_user_roles_new')}</h2>
            <p className="text-gray-600 mt-1">{t('modify_roles_for_approved_users_new')}</p>
            <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-blue-800 font-medium">🧭 {t('roles_guide_header')}</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm text-gray-500">{t('total_users')}</p>
              <p className="text-2xl font-bold text-orange-600">{users.length}</p>
            </div>
            <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center">
              <span className="text-orange-600 text-xl">👥</span>
            </div>
          </div>
        </div>

        {users.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-gray-400 text-2xl">👥</span>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">لا يوجد مستخدمين</h3>
            <p className="text-gray-600">لم يتم العثور على أي مستخدمين معتمدين</p>
          </div>
        ) : (
          <div className="overflow-hidden">
            <Table
              data={users}
              columns={columns}
              getRowClassName={(record, index) => 
                index % 2 === 0 ? 'bg-white' : 'bg-gray-50'
              }
            />
          </div>
        )}
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
