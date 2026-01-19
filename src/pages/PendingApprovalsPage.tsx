import React from 'react';
import { useLocale } from '../context/LocaleContext';

const PendingApprovalsPage: React.FC = () => {
  const { t } = useLocale();

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
              <p className="text-2xl font-bold text-orange-600">0</p>
            </div>
            <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center">
              <span className="text-orange-600 text-xl">⏳</span>
            </div>
          </div>
        </div>

        <div className="text-center py-12">
          <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-orange-600 text-2xl">🚫</span>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">{t('pending_approvals')}</h3>
          <p className="text-gray-600">تم تعطيل الموافقات لأن النظام لا يتصل بـ Firestore.</p>
        </div>
      </div>
    </div>
  );
};

export default PendingApprovalsPage;
