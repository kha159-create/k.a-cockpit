// Script لتحديث جميع الموظفين وإضافة حقل linkedAccount
// تشغيل هذا الـ script في Firebase Functions أو Node.js environment

const admin = require('firebase-admin');

// تهيئة Firebase Admin SDK
const serviceAccount = require('./path-to-your-service-account-key.json'); // تحتاج لتحميل service account key

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://alsani-cockpit-v3.firebaseio.com"
});

const db = admin.firestore();

async function updateAllEmployees() {
  try {
    console.log('🔄 بدء تحديث الموظفين...');
    
    // جلب جميع الموظفين
    const employeesSnapshot = await db.collection('employees').get();
    
    if (employeesSnapshot.empty) {
      console.log('❌ لا يوجد موظفين في قاعدة البيانات');
      return;
    }
    
    console.log(`📊 تم العثور على ${employeesSnapshot.size} موظف`);
    
    const batch = db.batch();
    let updateCount = 0;
    
    employeesSnapshot.forEach((doc) => {
      const employeeData = doc.data();
      
      // التحقق من وجود حقل linkedAccount
      if (!employeeData.hasOwnProperty('linkedAccount')) {
        // إضافة حقل linkedAccount: false
        batch.update(doc.ref, {
          linkedAccount: false,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        updateCount++;
        console.log(`✅ تم تحديث الموظف: ${employeeData.name || doc.id}`);
      } else {
        console.log(`⏭️ الموظف ${employeeData.name || doc.id} محدث مسبقاً`);
      }
    });
    
    if (updateCount > 0) {
      // تطبيق التحديثات
      await batch.commit();
      console.log(`🎉 تم تحديث ${updateCount} موظف بنجاح!`);
    } else {
      console.log('ℹ️ جميع الموظفين محدثين مسبقاً');
    }
    
  } catch (error) {
    console.error('❌ خطأ في تحديث الموظفين:', error);
  } finally {
    // إغلاق الاتصال
    process.exit(0);
  }
}

// تشغيل الدالة
updateAllEmployees();
