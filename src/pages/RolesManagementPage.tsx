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
      const snapshot = await db.collection('users')
        .where('status', '==', 'approved')
        .orderBy('name')
        .get();
      
      const usersData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as User[];
      
      setUsers(usersData);
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
      
      alert('تم تحديث الدور بنجاح');
    } catch (error) {
      console.error('Error updating role:', error);
      alert('حدث خطأ أثناء تحديث الدور');
    } finally {
      setUpdating(null);
    }
  };

  const columns = [
    {
      key: 'name',
      label: 'اسم المستخدم',
      render: (value: string, record: User) => (
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center">
            <span className="text-orange-600 font-bold text-lg">
              {value.charAt(0).toUpperCase()}
            </span>
          </div>
          <div>
            <p className="font-medium text-gray-900">{value}</p>
            <p className="text-sm text-gray-500">{record.email}</p>
          </div>
        </div>
      )
    },
    {
      key: 'employeeId',
      label: 'رقم الموظف',
      render: (value: string) => (
        <span className="font-mono font-semibold text-blue-600">
          {value || 'غير محدد'}
        </span>
      )
    },
    {
      key: 'role',
      label: 'الدور الحالي',
      render: (value: Role) => (
        <RoleBadge role={value} size="md" />
      )
    },
    {
      key: 'status',
      label: 'الحالة',
      render: (value: string) => (
        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
          value === 'approved' 
            ? 'bg-green-100 text-green-800' 
            : 'bg-yellow-100 text-yellow-800'
        }`}>
          {value === 'approved' ? 'معتمد' : 'معلق'}
        </span>
      )
    },
    {
      key: 'actions',
      label: 'تغيير الدور',
      render: (_: any, record: User) => (
        <div className="flex gap-2">
          <select
            value={record.role}
            onChange={(e) => handleRoleChange(record.id, e.target.value as Role)}
            disabled={updating === record.id}
            className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 disabled:opacity-50"
          >
            <option value="employee">موظف</option>
            <option value="store_manager">مدير معرض</option>
            <option value="area_manager">مدير منطقة</option>
            <option value="general_manager">مدير عام</option>
            <option value="admin">مدير النظام</option>
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
            <h2 className="text-2xl font-bold text-gray-900">إدارة أدوار المستخدمين</h2>
            <p className="text-gray-600 mt-1">تعديل أدوار المستخدمين المعتمدين</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm text-gray-500">إجمالي المستخدمين</p>
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
        <h3 className="text-lg font-bold text-gray-900 mb-4">دليل الصلاحيات</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="border border-gray-200 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <RoleBadge role="employee" size="sm" />
            </div>
            <p className="text-sm text-gray-600">عرض مبيعاته الشخصية فقط</p>
          </div>
          <div className="border border-gray-200 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <RoleBadge role="store_manager" size="sm" />
            </div>
            <p className="text-sm text-gray-600">إدارة موظفي فرعه وإرسال مهام</p>
          </div>
          <div className="border border-gray-200 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <RoleBadge role="area_manager" size="sm" />
            </div>
            <p className="text-sm text-gray-600">تعديل أهداف الموظفين في منطقته</p>
          </div>
          <div className="border border-gray-200 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <RoleBadge role="general_manager" size="sm" />
            </div>
            <p className="text-sm text-gray-600">عرض كل المناطق وتعديل الأهداف</p>
          </div>
          <div className="border border-gray-200 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <RoleBadge role="admin" size="sm" />
            </div>
            <p className="text-sm text-gray-600">جميع الصلاحيات والتحكم الكامل</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RolesManagementPage;
