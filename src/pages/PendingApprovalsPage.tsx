import React, { useState, useEffect } from 'react';
import { db } from '../services/firebase';
import { useLocale } from '../context/LocaleContext';
import firebase from 'firebase/app';
import { Table } from '../components/Table';
import { ROLE_DISPLAY_NAMES, ROLE_COLORS } from '../config/roles';

interface PendingEmployee {
  id: string;
  employeeId: string;
  name: string;
  email: string;
  role: string;
  status: string;
  createdAt: any;
  userId: string;
  source?: 'pendingEmployees' | 'users';
}

const PendingApprovalsPage: React.FC = () => {
  const { t } = useLocale();
  const [pendingEmployees, setPendingEmployees] = useState<PendingEmployee[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);

  useEffect(() => {
    const unsub1 = db
      .collection('pendingEmployees')
      .where('status', '==', 'pending')
      .onSnapshot((snapshot) => {
        const list = snapshot.docs.map((doc) => {
          const d = doc.data();
          return {
            id: doc.id,
            employeeId: d.employeeId ?? '',
            email: d.email ?? '',
            name: d.name ?? '',
            role: d.role ?? 'employee',
            status: d.status ?? 'pending',
            createdAt: d.createdAt,
            userId: d.userId ?? '',
            source: 'pendingEmployees' as const,
            ...d,
          } as PendingEmployee;
        });

        setPendingEmployees((prev) => {
          // سنُدمج لاحقاً مع users في الاشتراك الآخر؛ هنا نُحدّث جزئية المصدر هذا فقط
          const others = prev.filter((p) => p.source === 'users');
          const combined = [...list, ...others];
          combined.sort((a, b) => {
            const aTime = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt);
            const bTime = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt);
            return bTime.getTime() - aTime.getTime();
          });
          return combined;
        });
        setLoading(false);
      });

    const unsub2 = db
      .collection('users')
      .where('status', '==', 'pending')
      .onSnapshot((snapshot) => {
        const list = snapshot.docs.map((doc) => {
          const d = doc.data() as any;
          return {
            id: doc.id,
            employeeId: d.employeeId ?? '',
            email: d.email ?? '',
            name: d.name ?? '',
            role: d.role ?? 'employee',
            status: d.status ?? 'pending',
            createdAt: d.createdAt || d.approvedAt || new Date(),
            userId: doc.id,
            source: 'users' as const,
            ...d,
          } as PendingEmployee;
        });

        setPendingEmployees((prev) => {
          const others = prev.filter((p) => p.source === 'pendingEmployees');
          const combined = [...others, ...list];
          combined.sort((a, b) => {
            const aTime = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt);
            const bTime = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt);
            return bTime.getTime() - aTime.getTime();
          });
          return combined;
        });
        setLoading(false);
      });

    return () => {
      unsub1();
      unsub2();
    };
  }, []);

  const handleApprove = async (pendingEmployee: PendingEmployee) => {
    setProcessing(pendingEmployee.id);
    
    try {
      const updateOrCreateEmployee = async () => {
        if (!pendingEmployee.employeeId) return;
        const empId = String(pendingEmployee.employeeId).trim();
        const employeesRef = db.collection('employees');
        const directRef = employeesRef.doc(empId);
        const directSnap = await directRef.get();

        if (!directSnap.exists) {
          // Try to find by the employeeId field
          const q = await employeesRef.where('employeeId', '==', empId).limit(1).get();
          if (!q.empty) {
            await q.docs[0].ref.update({
              linkedAccount: true,
              userEmail: pendingEmployee.email,
              userId: pendingEmployee.userId,
              role: pendingEmployee.role,
              approvedAt: firebase.firestore.FieldValue.serverTimestamp(),
              status: 'active',
            });
            return;
          }
          // Create a new employee doc with this employeeId
          await directRef.set({
            employeeId: empId,
            name: pendingEmployee.name,
            userEmail: pendingEmployee.email,
            userId: pendingEmployee.userId,
            role: pendingEmployee.role,
            linkedAccount: true,
            approvedAt: firebase.firestore.FieldValue.serverTimestamp(),
            status: 'active',
          }, { merge: true });
          return;
        }

        // Update existing doc
        await directRef.update({
          linkedAccount: true,
          userEmail: pendingEmployee.email,
          userId: pendingEmployee.userId,
          role: pendingEmployee.role,
          approvedAt: firebase.firestore.FieldValue.serverTimestamp(),
          status: 'active',
        });
      };

      if (pendingEmployee.source === 'users') {
        // تحديث حالة المستخدم الموجود بالفعل
        await db.collection('users').doc(pendingEmployee.userId).update({
          status: 'approved',
          approvedAt: firebase.firestore.FieldValue.serverTimestamp(),
          approvedBy: 'admin',
        });
        await updateOrCreateEmployee();
      } else {
        // نقل السجل من pendingEmployees إلى users
        await db.collection('users').doc(pendingEmployee.userId).set({
          id: pendingEmployee.userId,
          name: pendingEmployee.name,
          email: pendingEmployee.email,
          employeeId: pendingEmployee.employeeId,
          role: pendingEmployee.role,
          status: 'approved',
          approvedAt: firebase.firestore.FieldValue.serverTimestamp(),
          approvedBy: 'admin'
        });
        await updateOrCreateEmployee();
        await db.collection('pendingEmployees').doc(pendingEmployee.id).delete();
      }
      
      alert('تم قبول الطلب بنجاح');
    } catch (error) {
      console.error('Error approving employee:', error);
      alert('حدث خطأ أثناء قبول الطلب');
    } finally {
      setProcessing(null);
    }
  };

  const handleReject = async (pendingEmployee: PendingEmployee) => {
    if (!confirm('هل أنت متأكد من رفض هذا الطلب؟')) {
      return;
    }

    setProcessing(pendingEmployee.id);
    
    try {
      if (pendingEmployee.source === 'users') {
        // غيّر الحالة لتخرج من قائمة الانتظار
        await db.collection('users').doc(pendingEmployee.userId).update({ status: 'rejected' });
      } else {
        await db.collection('pendingEmployees').doc(pendingEmployee.id).delete();
      }

      
      alert('تم رفض الطلب');
    } catch (error) {
      console.error('Error rejecting employee:', error);
      alert('حدث خطأ أثناء رفض الطلب');
    } finally {
      setProcessing(null);
    }
  };

  const columns = [
    {
      key: 'employeeId',
      label: 'رقم الموظف',
      render: (value: string) => (
        <span className="font-mono font-semibold text-blue-600">{value}</span>
      )
    },
    {
      key: 'name',
      label: 'اسم الموظف',
      render: (value: string) => (
        <span className="font-medium text-gray-900">{value}</span>
      )
    },
    {
      key: 'email',
      label: 'البريد الإلكتروني',
      render: (value: string) => (
        <span className="text-gray-600">{value}</span>
      )
    },
    {
      key: 'role',
      label: 'الدور',
      render: (value: string) => (
        <span className={`px-2 py-1 rounded-full text-xs font-medium ${ROLE_COLORS[value as keyof typeof ROLE_COLORS] || 'bg-gray-100 text-gray-800'}`}>
          {ROLE_DISPLAY_NAMES[value as keyof typeof ROLE_DISPLAY_NAMES] || value}
        </span>
      )
    },
    {
      key: 'createdAt',
      label: 'تاريخ الطلب',
      render: (value: any) => (
        <span className="text-sm text-gray-500">
          {value?.toDate?.()?.toLocaleDateString('ar-SA') || 'غير محدد'}
        </span>
      )
    },
    {
      key: 'actions',
      label: 'الإجراءات',
      render: (_: any, record: PendingEmployee) => (
        <div className="flex gap-2">
          <button
            onClick={() => handleApprove(record)}
            disabled={processing === record.id}
            className="px-3 py-1 bg-green-500 text-white rounded-md hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed text-sm flex items-center gap-1"
          >
            {processing === record.id ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                جاري...
              </>
            ) : (
              <>
                ✅ قبول
              </>
            )}
          </button>
          <button
            onClick={() => handleReject(record)}
            disabled={processing === record.id}
            className="px-3 py-1 bg-red-500 text-white rounded-md hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed text-sm flex items-center gap-1"
          >
            ❌ رفض
          </button>
        </div>
      )
    }
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">جاري تحميل الطلبات...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
        <div className="bg-white rounded-xl shadow-lg border border-neutral-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">{t('pending_approvals')}</h2>
            <p className="text-gray-600 mt-1">{t('manage_new_registration_requests')}</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm text-gray-500">{t('total_requests')}</p>
              <p className="text-2xl font-bold text-orange-600">{pendingEmployees.length}</p>
            </div>
            <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center">
              <span className="text-orange-600 text-xl">⏳</span>
            </div>
          </div>
        </div>

        {pendingEmployees.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-green-600 text-2xl">✅</span>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">{t('no_pending_requests')}</h3>
            <p className="text-gray-600">{t('all_requests_processed')}</p>
          </div>
        ) : (
          <div className="overflow-hidden">
            <Table
              data={pendingEmployees}
              columns={columns}
              getRowClassName={(record, index) => 
                index % 2 === 0 ? 'bg-white' : 'bg-gray-50'
              }
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default PendingApprovalsPage;
