// Script لإصلاح المستخدم Admin وإضافة حقل status
// تشغيل هذا في Firebase Console أو Node.js

// في Firebase Console:
// 1. اذهب إلى Firestore Database
// 2. اختر collection "users"
// 3. اختر document "mII0rBZpa8NHFxrR31bBvsY8XWg2"
// 4. اضغط "Add field"
// 5. اسم الحقل: status
// 6. النوع: string
// 7. القيمة: approved
// 8. اضغط "Save"

// أو استخدم هذا الكود في Node.js:
/*
const admin = require('firebase-admin');

const serviceAccount = require('./path-to-service-account.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://alsani-cockpit-v3.firebaseio.com"
});

const db = admin.firestore();

async function fixAdminUser() {
  try {
    const userId = 'mII0rBZpa8NHFxrR31bBvsY8XWg2';
    
    await db.collection('users').doc(userId).update({
      status: 'approved',
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    console.log('✅ تم تحديث المستخدم Admin بنجاح');
  } catch (error) {
    console.error('❌ خطأ:', error);
  }
}

fixAdminUser();
*/
