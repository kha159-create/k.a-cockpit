
import React, { useState } from 'react';
// FIX: Use namespaced compat API by importing auth and db services.
import { auth, db } from '../services/firebase';
import { useLocale } from '../context/LocaleContext';

interface SignUpPageProps {
  onSwitchToLogin: () => void;
}

const SignUpPage: React.FC<SignUpPageProps> = ({ onSwitchToLogin }) => {
  const { t } = useLocale();
  const [name, setName] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError(t('passwords_no_match'));
      return;
    }
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      // FIX: Use namespaced compat API for authentication.
      const userCredential = await auth.createUserWithEmailAndPassword(email, password);
      const user = userCredential.user;
      if (user) {
        // FIX: Use namespaced compat API for user profile updates.
        await user.updateProfile({ displayName: name });
        // FIX: Use namespaced compat API for Firestore operations.
        await db.collection('users').doc(user.uid).set({
          id: user.uid,
          name,
          employeeId,
          email,
          role: 'employee', // Default role
          status: 'pending', // Await admin approval
        });
        setSuccess(t('sign_up_success'));
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="w-full max-w-md p-8 space-y-6 bg-white rounded-xl shadow-lg">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900">{t('sign_up_title')}</h1>
        </div>
        
        {success ? (
          <div className="text-center p-4 bg-green-100 text-green-800 rounded-lg">
            <p>{success}</p>
            <button onClick={onSwitchToLogin} className="font-medium text-orange-600 hover:underline mt-4">
              {t('back_to_login')}
            </button>
          </div>
        ) : (
          <form className="space-y-4" onSubmit={handleSignUp}>
            <div><label className="label">{t('name')}</label><input type="text" value={name} onChange={(e) => setName(e.target.value)} required className="input" /></div>
            <div><label className="label">{t('employee_id')}</label><input type="text" value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} required className="input" /></div>
            <div><label className="label">{t('email')}</label><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="input" /></div>
            <div><label className="label">{t('password')}</label><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required className="input" /></div>
            <div><label className="label">{t('confirm_password')}</label><input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required className="input" /></div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div><button type="submit" disabled={loading} className="w-full btn-primary">{loading ? t('signing_in') : t('sign_up')}</button></div>
          </form>
        )}
        
        {!success && (
          <div className="text-center mt-4">
            <p className="text-sm text-gray-600">
              {t('already_have_account')}{' '}
              <button onClick={onSwitchToLogin} className="font-medium text-orange-600 hover:underline">{t('sign_in')}</button>
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default SignUpPage;