// Script لإنشاء مستخدم Admin في Firebase
// تشغيل هذا في Firebase Console أو Node.js

// الطريقة الأولى: من Firebase Console
/*
1. اذهب إلى Firebase Console
2. اختر "Authentication"
3. اضغط "Add user"
4. Email: kha.als@outlook.com
5. Password: [كلمة مرور قوية]
6. اضغط "Add user"
*/

// الطريقة الثانية: من Node.js (إذا كان لديك service account)
/*
const admin = require('firebase-admin');

const serviceAccount = require('./path-to-service-account.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://alsani-cockpit-v3.firebaseio.com"
});

async function createAdminUser() {
  try {
    // إنشاء المستخدم في Authentication
    const userRecord = await admin.auth().createUser({
      email: 'kha.als@outlook.com',
      password: 'YourStrongPassword123!', // غيّر هذا
      displayName: 'Admin User'
    });

    console.log('✅ تم إنشاء المستخدم في Authentication:', userRecord.uid);

    // إنشاء سجل في Firestore
    await admin.firestore().collection('users').doc(userRecord.uid).set({
      id: userRecord.uid,
      name: 'Admin User',
      email: 'kha.als@outlook.com',
      role: 'admin',
      status: 'approved',
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    console.log('✅ تم إنشاء سجل المستخدم في Firestore');
  } catch (error) {
    console.error('❌ خطأ:', error);
  }
}

createAdminUser();
*/
