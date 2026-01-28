import React, { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useLocale } from '../context/LocaleContext';
import '../styles/AuthPage.css';
import { UserIcon, EmailIcon, PasswordIcon } from '../components/Icons';

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

const AuthPage: React.FC = () => {
    const { t } = useLocale();
    const { login } = useAuth();
    const [mode, setMode] = useState<'login' | 'signup'>('login');

    // Form States
    const [loginIdentifier, setLoginIdentifier] = useState(AVAILABLE_USERS[0]);
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
            await login(loginIdentifier, loginPassword);
        } catch (err: any) {
            setError(err.message || t('error_login_failed'));
        } finally {
            setLoading(false);
        }
    };

    const handleSignUp = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setSuccess('Sign-up is currently disabled. Please contact the administrator.');
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
                    <div>
                        <label className="text-sm font-medium text-gray-700 mb-1 block">اسم المستخدم</label>
                        <div className="auth-input-container">
                            <span className="auth-input-icon"><UserIcon /></span>
                            <select
                                className="auth-input"
                                value={loginIdentifier}
                                onChange={e => setLoginIdentifier(e.target.value)}
                                required
                                style={{ background: 'white' }}
                            >
                                {AVAILABLE_USERS.map(user => (
                                    <option key={user} value={user}>{user}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                    <div className="auth-input-container">
                        <span className="auth-input-icon"><PasswordIcon /></span>
                        <input 
                            className="auth-input" 
                            type="password" 
                            placeholder={t('password')} 
                            value={loginPassword} 
                            onChange={e => setLoginPassword(e.target.value)} 
                            autoComplete="current-password"
                            required 
                        />
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
                        <span className="auth-input-icon"><UserIcon /></span>
                        <input className="auth-input" type="text" placeholder={t('name')} value={signUpName} onChange={e => setSignUpName(e.target.value)} required />
                    </div>
                    <div className="auth-input-container">
                        <span className="auth-input-icon"><UserIcon /></span>
                        <input className="auth-input" type="text" placeholder={t('employee_id')} value={signUpEmployeeId} onChange={e => setSignUpEmployeeId(e.target.value)} required />
                    </div>
                    <div className="auth-input-container">
                        <span className="auth-input-icon"><EmailIcon /></span>
                        <input className="auth-input" type="email" placeholder={t('email')} value={signUpEmail} onChange={e => setSignUpEmail(e.target.value)} required />
                    </div>
                    <div className="auth-input-container">
                        <span className="auth-input-icon"><PasswordIcon /></span>
                        <input 
                            className="auth-input" 
                            type="password" 
                            placeholder={t('password')} 
                            value={signUpPassword} 
                            onChange={e => setSignUpPassword(e.target.value)} 
                            autoComplete="new-password"
                            required 
                        />
                    </div>
                    <div className="auth-input-container">
                        <span className="auth-input-icon"><PasswordIcon /></span>
                        <input 
                            className="auth-input" 
                            type="password" 
                            placeholder={t('confirm_password')} 
                            value={signUpPasswordConfirm} 
                            onChange={e => setSignUpPasswordConfirm(e.target.value)} 
                            autoComplete="new-password"
                            required 
                        />
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