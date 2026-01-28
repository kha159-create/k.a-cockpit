
import React, { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useLocale } from '@/context/LocaleContext';

interface LoginPageProps {
  onSwitchToSignUp: () => void;
}


const AVAILABLE_USERS = [
  "Sales Manager",
  "المنطقة الغربية",
  "اماني عسيري",
  "جهاد ايوبي",
  "خليل الصانع",
  "رضوان عطيوي",
  "شريفة العمري",
  "عبد الجليل الحبال",
  "عبدالله السرداح",
  "عبيدة السباعي",
  "محمدكلو",
  "منطقة الطائف"
];

const LoginPage: React.FC<LoginPageProps> = ({ onSwitchToSignUp }) => {
  const { t } = useLocale();
  const { login } = useAuth();
  const [identifier, setIdentifier] = useState(AVAILABLE_USERS[0]);
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await login(identifier, password);
    } catch (err: any) {
      setError(err.message || t('error_login_failed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="w-full max-w-md p-8 space-y-6 bg-white rounded-xl shadow-lg">
        <div className="text-center">
          <div className="flex items-center justify-center mb-4">
            <div className="bg-orange-600 text-white rounded-lg flex items-center justify-center w-16 h-16">
              <span className="text-3xl font-bold">K.A</span>
            </div>
          </div>
          <h1 className="text-3xl font-bold text-gray-900">Cockpit</h1>
          <p className="mt-2 text-gray-600">{t('please_sign_in')}</p>
        </div>

        <form className="space-y-6" onSubmit={handleLogin}>
          <div>
            <label className="label">اسم المستخدم</label>
            <select
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              required
              className="input"
              dir="auto"
            >
              {AVAILABLE_USERS.map(user => (
                <option key={user} value={user}>{user}</option>
              ))}
            </select>
          </div>


          <div>
            <label className="label">{t('password')}</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required className="input" placeholder="أدخل كلمة المرور" />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div>
            <button type="submit" disabled={loading} className="w-full btn-primary">
              {loading ? t('signing_in') : t('sign_in')}
            </button>
          </div>
        </form>

        <div className="text-center mt-4">
          <p className="text-sm text-gray-600">
            {t('no_account')}{' '}
            <button onClick={onSwitchToSignUp} className="font-medium text-orange-600 hover:underline">
              {t('sign_up')}
            </button>
          </p>
        </div>

      </div>
    </div>
  );
};

export default LoginPage;