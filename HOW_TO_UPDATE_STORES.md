# 🚀 كيفية تحديث المعارض من orange-dashboard

## الطريقة الأسهل (GET request - للاختبار):

### 1️⃣ افتح Developer Console:
- في المتصفح: اضغط `F12` أو `Ctrl+Shift+I` (Windows) أو `Cmd+Option+I` (Mac)
- أو: انقر بالزر الأيمن → "Inspect" أو "فحص العنصر"

### 2️⃣ اذهب إلى تبويب "Console" (كونسول)

### 3️⃣ انسخ والصق هذا الكود واضغط Enter:

```javascript
fetch('https://k-a-cockpit.vercel.app/api/update-stores-from-orange?method=POST', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' }
})
.then(r => r.json())
.then(data => {
  console.log('✅ النتيجة:', data);
  if (data.success) {
    alert('تم التحديث بنجاح! سيتم إعادة تحميل الصفحة...');
    setTimeout(() => location.reload(), 2000);
  } else {
    alert('خطأ: ' + (data.error || 'Unknown error'));
  }
})
.catch(err => {
  console.error('❌ خطأ:', err);
  alert('خطأ في الاتصال: ' + err.message);
});
```

---

## الطريقة الثانية (إذا كان API_SECRET موجود في Vercel):

### أين تجد API_SECRET؟
1. اذهب إلى [Vercel Dashboard](https://vercel.com/dashboard)
2. اختر المشروع `k.a-cockpit`
3. اذهب إلى Settings → Environment Variables
4. ابحث عن `API_SECRET` (إذا كان موجوداً)

### إذا كان API_SECRET موجوداً، استخدم هذا الكود:

```javascript
fetch('https://k-a-cockpit.vercel.app/api/update-stores-from-orange', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-secret': 'ضع_قيمة_API_SECRET_هنا'
  }
})
.then(r => r.json())
.then(data => {
  console.log('✅ النتيجة:', data);
  if (data.success) {
    alert('تم التحديث بنجاح!');
    location.reload();
  }
})
.catch(err => console.error('❌ خطأ:', err));
```

---

## 📝 ملاحظات:
- الطريقة الأولى (GET/POST بدون secret) تعمل إذا لم يكن `API_SECRET` محدداً في Vercel
- إذا كان `API_SECRET` موجوداً، يجب استخدام الطريقة الثانية
- بعد التحديث، ستظهر أسماء المدراء والمدن الجديدة في النظام
