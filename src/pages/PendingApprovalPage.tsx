import React from 'react';
import { useLocale } from '../context/LocaleContext';
import { LogoutIcon } from '../components/Icons';

interface PendingApprovalPageProps {
  onLogout: () => void;
}

const PendingApprovalPage: React.FC<PendingApprovalPageProps> = ({ onLogout }) => {
  const { t } = useLocale();

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="w-full max-w-lg p-8 text-center bg-white rounded-xl shadow-lg">
        <div className="mx-auto w-16 h-16 mb-4 flex items-center justify-center rounded-full bg-orange-100 text-orange-600">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-gray-900">{t('pending_approval_title')}</h1>
        <p className="mt-2 text-gray-600">{t('pending_approval_message')}</p>
        <button onClick={onLogout} className="mt-6 btn-secondary flex items-center gap-2 mx-auto">
            <LogoutIcon /> {t('logout')}
        </button>
      </div>
    </div>
  );
};

export default PendingApprovalPage;
