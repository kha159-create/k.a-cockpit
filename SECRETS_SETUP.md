# 🔐 إعداد المفاتيح والبيئة - Secrets Setup

## 📋 **المفاتيح المطلوبة**

### **1. Firebase Configuration**
```bash
VITE_FIREBASE_API_KEY=your_firebase_api_key_here
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id_here
VITE_FIREBASE_STORAGE_BUCKET=your_project.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id_here
VITE_FIREBASE_APP_ID=your_app_id_here
```

### **2. Gemini AI API Key**
```bash
VITE_GEMINI_API_KEY=your_gemini_api_key_here
```

## 🚀 **للنشر على GitHub Pages**

### **إضافة المفاتيح في GitHub Secrets:**

1. **اذهب إلى المشروع على GitHub**
2. **Settings → Secrets and variables → Actions**
3. **اضغط "New repository secret"**
4. **أضف كل مفتاح بالاسم والقيمة التالية:**

| Name | Value |
|------|-------|
| `VITE_FIREBASE_API_KEY` | `REDACTED_FIREBASE_API_KEY` |
| `VITE_FIREBASE_AUTH_DOMAIN` | `REDACTED_FIREBASE_DOMAIN` |
| `VITE_FIREBASE_PROJECT_ID` | `alsani-cockpit-v3` |
| `VITE_FIREBASE_STORAGE_BUCKET` | `alsani-cockpit-v3.firebasestorage.app` |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | `REDACTED_SENDER_ID` |
| `VITE_FIREBASE_APP_ID` | `1:REDACTED_SENDER_ID:web:64428acfb48922fbc76898` |
| `VITE_GEMINI_API_KEY` | `REDACTED_GEMINI_API_KEY` |

## 💻 **للتطوير المحلي**

### **إنشاء ملف البيئة:**
```bash
# أنشئ ملف .env.local في المجلد الرئيسي
cp env-template.txt .env.local

# أو أنشئ الملف يدوياً وأضف المفاتيح
```

### **مثال على محتوى .env.local:**
```bash
# Firebase Configuration
VITE_FIREBASE_API_KEY=REDACTED_FIREBASE_API_KEY
VITE_FIREBASE_AUTH_DOMAIN=REDACTED_FIREBASE_DOMAIN
VITE_FIREBASE_PROJECT_ID=alsani-cockpit-v3
VITE_FIREBASE_STORAGE_BUCKET=alsani-cockpit-v3.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=REDACTED_SENDER_ID
VITE_FIREBASE_APP_ID=1:REDACTED_SENDER_ID:web:64428acfb48922fbc76898

# Gemini AI API Key
VITE_GEMINI_API_KEY=REDACTED_GEMINI_API_KEY
```

## ✅ **تأكيد أن النظام يعمل**

### **الميزات التي يجب أن تعمل:**
- ✅ **تسجيل الدخول والخروج**
- ✅ **عرض البيانات من Firestore**
- ✅ **الذكاء الاصطناعي (Gemini)**
- ✅ **تحليلات المنتجات والمبيعات**
- ✅ **فلاتر الفئات (Toppers, Duvets Full)**
- ✅ **ربط المنتجات بالـ Bill_No**
- ✅ **حسابات العمولات والمقارنات**

### **فحص سريع:**
1. **تأكد من أن الصفحة تحمل بدون أخطاء**
2. **جرب تسجيل الدخول**
3. **تحقق من صفحة Products والفلاتر**
4. **اختبر ميزة AI Insights**

## 🔒 **الأمان**

- ✅ **لا توجد مفاتيح مكشوفة في الكود**
- ✅ **استخدام متغيرات البيئة**
- ✅ **ملفات .env مستبعدة من Git**
- ✅ **GitHub Secrets للنشر**

## 📞 **الدعم**

إذا واجهت أي مشاكل:
1. **تأكد من إضافة جميع المفاتيح في GitHub Secrets**
2. **تحقق من أن المشروع يبني بدون أخطاء**
3. **راجع console المتصفح للأخطاء**

---
**تاريخ آخر تحديث:** ${new Date().toLocaleDateString('ar-SA')}
**حالة النظام:** ✅ جاهز للنشر
