
import React, { useState } from 'react';
// Firebase removed - using PostgreSQL
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

    // التحقق من Employee ID
    if (!employeeId || employeeId.length !== 4) {
      setError('رقم الموظف يجب أن يكون 4 خانات');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      // التحقق من وجود Employee ID في مجموعة employees
      const employeeDoc = await db.collection('employees').doc(employeeId).get();

      if (!employeeDoc.exists) {
        setError('رقم الموظف غير مسجل، تواصل مع الإدارة');
        setLoading(false);
        return;
      }

      const employeeData = employeeDoc.data();

      // التحقق من أن الموظف غير مربوط بحساب آخر
      if (employeeData?.linkedAccount) {
        setError('رقم الموظف مربوط بحساب آخر بالفعل');
        setLoading(false);
        return;
      }

      // إنشاء حساب المستخدم
      const userCredential = await auth.createUserWithEmailAndPassword(email, password);
      const user = userCredential.user;

      if (user) {
        // تحديث معلومات المستخدم
        await user.updateProfile({ displayName: name });

        // إنشاء سجل في pendingEmployees
        await db.collection('pendingEmployees').doc(user.uid).set({
          employeeId: employeeId,
          email: email,
          name: name,
          role: 'employee',
          status: 'pending',
          createdAt: firebase.firestore.FieldValue.serverTimestamp(),
          userId: user.uid
        });

        // تسجيل الخروج فوراً (المستخدم لا يستطيع تسجيل الدخول حتى موافقة الإدارة)
        await auth.signOut();

        setSuccess('تم إرسال طلب التسجيل بنجاح، يرجى انتظار موافقة الإدارة');
      }
    } catch (err: any) {
      let errorMessage = err.message;

      // رسائل خطأ مخصصة
      if (err.code === 'auth/email-already-in-use') {
        errorMessage = 'البريد الإلكتروني مستخدم بالفعل';
      } else if (err.code === 'auth/weak-password') {
        errorMessage = 'كلمة المرور ضعيفة جداً';
      } else if (err.code === 'auth/invalid-email') {
        errorMessage = 'البريد الإلكتروني غير صحيح';
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
            <div>
              <label className="label">رقم الموظف (4 خانات)</label>
              <input
                type="text"
                value={employeeId}
                onChange={(e) => setEmployeeId(e.target.value.replace(/\D/g, '').slice(0, 4))}
                required
                className="input"
                placeholder="مثال: 2156"
                maxLength={4}
              />
            </div>
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