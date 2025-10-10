
import React, { useState } from 'react';
// FIX: Use namespaced compat API by importing auth and db services.
import { auth, db } from '../services/firebase';
import { useLocale } from '../context/LocaleContext';
import '../styles/AuthPage.css';
import { UserIcon, EmailIcon, PasswordIcon } from '../components/Icons';

const AuthPage: React.FC = () => {
    const { t } = useLocale();
    const [mode, setMode] = useState<'login' | 'signup'>('login');

    // Form States
    const [loginIdentifier, setLoginIdentifier] = useState('');
    const [loginPassword, setLoginPassword] = useState('');

    const [signUpName, setSignUpName] = useState('');
    const [signUpEmployeeId, setSignUpEmployeeId] = useState('');
    const [signUpEmail, setSignUpEmail] = useState('');
    const [signUpPassword, setSignUpPassword] = useState('');
    const [signUpPasswordConfirm, setSignUpPasswordConfirm] = useState('');

    // UI States
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    
    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        try {
            let userEmail = loginIdentifier;
            if (!loginIdentifier.includes('@')) {
                // FIX: Use namespaced compat API for Firestore queries.
                const usersRef = db.collection('users');
                const q = usersRef.where('employeeId', '==', loginIdentifier).limit(1);
                const snapshot = await q.get();
                if (snapshot.empty) throw new Error(t('error_no_user_id'));
                
                const userData = snapshot.docs[0].data();
                if (!userData?.email) throw new Error(t('error_no_user_email'));
                
                userEmail = userData.email;
            }
            // FIX: Use namespaced compat API for authentication.
            await auth.signInWithEmailAndPassword(userEmail, loginPassword);
        } catch (err: any) {
          setError(err.message || t('error_login_failed'));
        } finally {
          setLoading(false);
        }
    };

    const handleSignUp = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        setSuccess(null);
        try {
            if (signUpPassword !== signUpPasswordConfirm) {
                throw new Error(t('passwords_do_not_match'));
            }
            // FIX: Use namespaced compat API for authentication.
            const userCredential = await auth.createUserWithEmailAndPassword(signUpEmail, signUpPassword);
            const user = userCredential.user;
            if (user) {
                // FIX: Use namespaced compat API for user profile updates.
                await user.updateProfile({ displayName: signUpName });
                // FIX: Use namespaced compat API for Firestore operations.
                await db.collection('users').doc(user.uid).set({
                  id: user.uid,
                  name: signUpName,
                  employeeId: signUpEmployeeId,
                  email: signUpEmail,
                  role: 'employee',
                  status: 'pending',
                });
                setSuccess(t('sign_up_success'));
                setTimeout(() => {
                    setMode('login');
                    setSuccess(null);
                }, 2000);
            }
        } catch (err: any) {
          setError(err.message);
        } finally {
          setLoading(false);
        }
    };
    const LoginCard = (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
            <div className="w-full max-w-lg bg-white rounded-2xl shadow-lg p-8">
                <div className="text-center mb-4">
                    <div className="mx-auto mb-4 w-14 h-14 rounded-xl bg-orange-600 text-white flex items-center justify-center font-bold text-xl">K.A</div>
                    <h1 className="text-3xl font-bold text-gray-900">Cockpit</h1>
                    <p className="mt-1 text-gray-600">{t('please_sign_in')}</p>
                </div>
                <form className="space-y-4" onSubmit={handleLogin}>
                    <div className="auth-input-container">
                        <span className="auth-input-icon"><EmailIcon/></span>
                        <input className="auth-input" type="text" placeholder={t('email_or_id')} value={loginIdentifier} onChange={e => setLoginIdentifier(e.target.value)} required />
                    </div>
                    <div className="auth-input-container">
                        <span className="auth-input-icon"><PasswordIcon/></span>
                        <input className="auth-input" type="password" placeholder={t('password')} value={loginPassword} onChange={e => setLoginPassword(e.target.value)} required />
                    </div>
                    {error && <p className="text-sm text-red-500">{error}</p>}
                    <button className="auth-button w-full" type="submit" disabled={loading}>{loading ? t('signing_in') : t('sign_in')}</button>
                </form>
                <div className="text-center mt-4 text-sm text-gray-600">
                    {t('no_account')} <button onClick={() => { setMode('signup'); setError(null); }} className="font-medium text-orange-600 hover:underline">{t('sign_up')}</button>
                </div>
            </div>
        </div>
    );

    const SignUpCard = (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
            <div className="w-full max-w-2xl bg-white rounded-2xl shadow-lg p-8">
                <h1 className="text-3xl font-bold text-gray-900 text-center mb-6">{t('create_your_account')}</h1>
                <form className="grid grid-cols-1 gap-4" onSubmit={handleSignUp}>
                    <div className="auth-input-container">
                        <span className="auth-input-icon"><UserIcon/></span>
                        <input className="auth-input" type="text" placeholder={t('name')} value={signUpName} onChange={e => setSignUpName(e.target.value)} required />
                    </div>
                    <div className="auth-input-container">
                        <span className="auth-input-icon"><UserIcon/></span>
                        <input className="auth-input" type="text" placeholder={t('employee_id')} value={signUpEmployeeId} onChange={e => setSignUpEmployeeId(e.target.value)} required />
                    </div>
                    <div className="auth-input-container">
                        <span className="auth-input-icon"><EmailIcon/></span>
                        <input className="auth-input" type="email" placeholder={t('email')} value={signUpEmail} onChange={e => setSignUpEmail(e.target.value)} required />
                    </div>
                    <div className="auth-input-container">
                        <span className="auth-input-icon"><PasswordIcon/></span>
                        <input className="auth-input" type="password" placeholder={t('password')} value={signUpPassword} onChange={e => setSignUpPassword(e.target.value)} required />
                    </div>
                    <div className="auth-input-container">
                        <span className="auth-input-icon"><PasswordIcon/></span>
                        <input className="auth-input" type="password" placeholder={t('confirm_password')} value={signUpPasswordConfirm} onChange={e => setSignUpPasswordConfirm(e.target.value)} required />
                    </div>
                    {error && <p className="text-sm text-red-500">{error}</p>}
                    {success && <p className="text-sm text-green-600">{success}</p>}
                    <button className="auth-button w-full mt-2" type="submit" disabled={loading}>{loading ? t('signing_in') : t('sign_up')}</button>
                </form>
                <div className="text-center mt-4 text-sm text-gray-600">
                    {t('already_have_account')} <button onClick={() => { setMode('login'); setError(null); }} className="font-medium text-orange-600 hover:underline">{t('sign_in')}</button>
                </div>
            </div>
        </div>
    );

    return mode === 'login' ? LoginCard : SignUpCard;
};

export default AuthPage;