# ⏰ إعداد التحديث التلقائي كل 15 دقيقة (مثل المشروع المرجعي)

## 🎯 الهدف
نفس آلية المشروع المرجعي `C:\Users\Orange1\Desktop\orangedata`:
- **Task Scheduler** يعمل كل 15 دقيقة
- يولد JSON من PostgreSQL المحلي
- يرفع التغييرات إلى GitHub تلقائياً

---

## 📋 الخطوات

### 1️⃣ تشغيل Setup Script

**كـ Administrator:**
1. اذهب إلى: `scripts\setup-schedule-15m.bat`
2. **Right-click** → **Run as administrator**
3. اتبع التعليمات

أو من PowerShell (كـ Administrator):
```powershell
cd C:\Users\Orange1\.cursor\worktrees\cockpit\vmb\scripts
.\setup-schedule-15m.ps1
```

### 2️⃣ التحقق من Task

1. افتح **Task Scheduler** (Windows + R → `taskschd.msc`)
2. ابحث عن: `CockpitJSONUpdate15m`
3. تحقق من:
   - ✅ **Trigger**: كل 15 دقيقة
   - ✅ **Action**: `update-json-15m.bat`
   - ✅ **Status**: Ready

### 3️⃣ اختبار يدوي

```bash
cd C:\Users\Orange1\.cursor\worktrees\cockpit\vmb
scripts\update-json-15m.bat
```

---

## 📊 الملفات

- `scripts\update-json-15m.bat` - السكربت الرئيسي (يعمل كل 15 دقيقة)
- `scripts\setup-schedule-15m.ps1` - إعداد Task Scheduler
- `scripts\setup-schedule-15m.bat` - Wrapper للـ PowerShell script
- `update_15m_log.txt` - ملف السجلات

---

## 🔍 التحقق من العمل

### 1. تحقق من Logs:
```bash
type update_15m_log.txt
```

### 2. تحقق من GitHub:
- اذهب إلى: `https://github.com/kha159-create/k.a-cockpit/commits/main`
- يجب أن ترى commits كل 15 دقيقة:
  ```
  Auto Update 15m: Wed 01/28/2026 17:15:55.50
  ```

### 3. تحقق من Task Scheduler:
- افتح Task Scheduler
- ابحث عن `CockpitJSONUpdate15m`
- انقر **Run** لاختبار يدوي

---

## ⚙️ التخصيص

### تغيير التوقيت:
عدّل `setup-schedule-15m.ps1`:
```powershell
-RepetitionInterval (New-TimeSpan -Minutes 15)  # كل 15 دقيقة
-RepetitionInterval (New-TimeSpan -Minutes 30)  # كل 30 دقيقة
-RepetitionInterval (New-TimeSpan -Hours 1)     # كل ساعة
```

### تغيير المسار:
عدّل `update-json-15m.bat`:
```batch
cd /d "C:\Users\Orange1\.cursor\worktrees\cockpit\vmb"
```

---

## 🐛 استكشاف الأخطاء

### Task لا يعمل:
1. تحقق من أن Task موجود في Task Scheduler
2. تحقق من **Last Run Result** (يجب أن يكون `0x0`)
3. تحقق من `update_15m_log.txt` للأخطاء

### لا يوجد commits على GitHub:
1. تحقق من Git credentials
2. تحقق من أن الملفات تتغير
3. تحقق من Logs

### قاعدة البيانات لا تتصل:
1. تحقق من أن PostgreSQL يعمل
2. تحقق من `PG_PASSWORD` في السكربت
3. تحقق من Logs

---

## ✅ Checklist

- [ ] تشغيل `setup-schedule-15m.bat` كـ Administrator
- [ ] التحقق من Task في Task Scheduler
- [ ] اختبار يدوي (`update-json-15m.bat`)
- [ ] التحقق من أول commit على GitHub
- [ ] التحقق من Logs (`update_15m_log.txt`)

---

## 📝 ملاحظات

- ✅ يعمل فقط على Windows (Task Scheduler)
- ✅ يحتاج PostgreSQL محلي
- ✅ يحتاج Git configured
- ✅ نفس آلية المشروع المرجعي تماماً

---

🎉 **بعد الإعداد، النظام سيعمل تلقائياً كل 15 دقيقة تماماً مثل المشروع المرجعي!**
