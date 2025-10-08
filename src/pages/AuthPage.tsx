
import React, { useState } from 'react';
// FIX: Use namespaced compat API by importing auth and db services.
import { auth, db } from '../services/firebase';
import { useLocale } from '../context/LocaleContext';
import '../styles/AuthPage.css';
import { UserIcon, EmailIcon, PasswordIcon } from '../components/Icons';

const AuthPage: React.FC = () => {
    const { t } = useLocale();
    const [isRightPanelActive, setIsRightPanelActive] = useState(false);
    
    // Form States
    const [loginIdentifier, setLoginIdentifier] = useState('admin@alsani.com');
    const [loginPassword, setLoginPassword] = useState('password123');
    
    const [signUpName, setSignUpName] = useState('');
    const [signUpEmployeeId, setSignUpEmployeeId] = useState('');
    const [signUpEmail, setSignUpEmail] = useState('');
    const [signUpPassword, setSignUpPassword] = useState('');

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
                    setIsRightPanelActive(false);
                    setSuccess(null);
                }, 3000);
            }
        } catch (err: any) {
          setError(err.message);
        } finally {
          setLoading(false);
        }
    };


    return (
        <div className="auth-page-body">
            <div className={`auth-container ${isRightPanelActive ? 'right-panel-active' : ''}`} id="container">
                <div className="form-container sign-up-container">
                    <form className="auth-form" onSubmit={handleSignUp}>
                        <h1 className="auth-title">{t('sign_up_title')}</h1>
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
                        <button className="auth-button mt-4" type="submit" disabled={loading}>{loading ? t('signing_in') : t('sign_up')}</button>
                        {error && isRightPanelActive && <p className="text-sm text-red-400 mt-2">{error}</p>}
                        {success && <p className="text-sm text-green-400 mt-2">{success}</p>}
                    </form>
                </div>
                <div className="form-container sign-in-container">
                    <form className="auth-form" onSubmit={handleLogin}>
                        <h1 className="auth-title">Sign in</h1>
                        <div className="auth-input-container">
                           <span className="auth-input-icon"><EmailIcon/></span>
                           <input className="auth-input" type="text" placeholder={t('email_or_id')} value={loginIdentifier} onChange={e => setLoginIdentifier(e.target.value)} required />
                        </div>
                        <div className="auth-input-container">
                            <span className="auth-input-icon"><PasswordIcon/></span>
                            <input className="auth-input" type="password" placeholder={t('password')} value={loginPassword} onChange={e => setLoginPassword(e.target.value)} required />
                        </div>
                        <a className="auth-link" href="#">Forgot your password?</a>
                        <button className="auth-button" type="submit" disabled={loading}>{loading ? t('signing_in') : t('sign_in')}</button>
                        {error && !isRightPanelActive && <p className="text-sm text-red-400 mt-2">{error}</p>}
                    </form>
                </div>
                <div className="overlay-container">
                    <div className="overlay">
                        <div className="overlay-panel overlay-left">
                            <h1 className="auth-title">Welcome Back!</h1>
                            <p className="auth-text">To keep connected with us please login with your personal info</p>
                            <button className="auth-button ghost" onClick={() => {setIsRightPanelActive(false); setError(null);}}>Sign In</button>
                        </div>
                        <div className="overlay-panel overlay-right">
                            <h1 className="auth-title">Hello, Friend!</h1>
                            <p className="auth-text">Enter your personal details and start your journey with us</p>
                            <button className="auth-button ghost" onClick={() => {setIsRightPanelActive(true); setError(null);}}>Sign Up</button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AuthPage;