// دالة لتحديث جميع الموظفين في التطبيق
// يمكن استدعاؤها من صفحة الإعدادات (للـ admin فقط)

import { db } from '../services/firebase';
import firebase from 'firebase/app';

export const updateAllEmployeesWithLinkedAccount = async () => {
  try {
    console.log('🔄 بدء تحديث الموظفين...');
    
    // جلب جميع الموظفين
    const employeesSnapshot = await db.collection('employees').get();
    
    if (employeesSnapshot.empty) {
      console.log('❌ لا يوجد موظفين في قاعدة البيانات');
      return { success: false, message: 'لا يوجد موظفين في قاعدة البيانات' };
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
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
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
      return { 
        success: true, 
        message: `تم تحديث ${updateCount} موظف بنجاح!`,
        updatedCount: updateCount
      };
    } else {
      console.log('ℹ️ جميع الموظفين محدثين مسبقاً');
      return { 
        success: true, 
        message: 'جميع الموظفين محدثين مسبقاً',
        updatedCount: 0
      };
    }
    
  } catch (error) {
    console.error('❌ خطأ في تحديث الموظفين:', error);
    return { 
      success: false, 
      message: `خطأ في تحديث الموظفين: ${error.message}`,
      error: error
    };
  }
};
