
import React, { useState } from 'react';
import { auth } from '../services/firebase';
import { useLocale } from '../context/LocaleContext';

interface LoginPageProps {
  onSwitchToSignUp: () => void;
}

const LoginPage: React.FC<LoginPageProps> = ({ onSwitchToSignUp }) => {
  const { t } = useLocale();
  const [identifier, setIdentifier] = useState('kha.als@outlook.com');
  const [password, setPassword] = useState(''); // Empty password for security
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
        if (!identifier.includes('@')) {
            throw new Error(t('error_invalid_email'));
        }
        await auth.signInWithEmailAndPassword(identifier, password);
    } catch (err: any) {
      let errorMessage = err.message || t('error_login_failed');
      
      // رسائل خطأ مخصصة
      if (err.code === 'auth/user-not-found') {
        errorMessage = 'المستخدم غير موجود، تحقق من البريد الإلكتروني';
      } else if (err.code === 'auth/wrong-password') {
        errorMessage = 'كلمة المرور غير صحيحة';
      } else if (err.code === 'auth/invalid-email') {
        errorMessage = 'البريد الإلكتروني غير صحيح';
      } else if (err.code === 'auth/too-many-requests') {
        errorMessage = 'محاولات تسجيل دخول كثيرة، حاول لاحقاً';
      } else if (err.code === 'auth/invalid-login-credentials') {
        errorMessage = 'بيانات تسجيل الدخول غير صحيحة';
      }
      
      setError(errorMessage);
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
            <label className="label">{t('email')}</label>
            <input
              type="text"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              required
              className="input"
              placeholder={t('email')}
            />
          </div>
          
          <div>
            <label className="label">{t('password')}</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required className="input" placeholder="أدخل كلمة المرور"/>
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
