# إعداد PostgreSQL المحلي للوصول من Vercel

## المتطلبات

1. ✅ جهاز المكتب شغال دائماً ومتصل بالإنترنت
2. ✅ معرفة IP العام (Public IP) لجهاز المكتب
3. ✅ فتح منفذ PostgreSQL (5432) في الـ Firewall
4. ✅ إعداد PostgreSQL للسماح بالاتصالات من الخارج

---

## الخطوات

### 1. معرفة IP العام لجهاز المكتب

**في PowerShell على جهاز المكتب:**
```powershell
# معرفة IP العام
Invoke-RestMethod -Uri "https://api.ipify.org?format=json"
```

**أو من المتصفح:**
- افتح: https://whatismyipaddress.com
- انسخ الـ IP العام

---

### 2. فتح منفذ 5432 في Windows Firewall

**في PowerShell (كـ Administrator):**
```powershell
# فتح منفذ PostgreSQL
New-NetFirewallRule -DisplayName "PostgreSQL" -Direction Inbound -LocalPort 5432 -Protocol TCP -Action Allow
```

**أو يدوياً:**
1. افتح Windows Defender Firewall
2. Advanced Settings
3. Inbound Rules → New Rule
4. Port → TCP → Specific local ports: `5432`
5. Allow the connection
6. Apply to all profiles
7. Name: "PostgreSQL"

---

### 3. إعداد PostgreSQL للسماح بالاتصالات من الخارج

**ملف: `postgresql.conf`**
- المسار: `C:\Program Files\PostgreSQL\18\data\postgresql.conf`
- ابحث عن: `listen_addresses`
- غيّر إلى: `listen_addresses = '*'`

**ملف: `pg_hba.conf`**
- المسار: `C:\Program Files\PostgreSQL\18\data\pg_hba.conf`
- أضف في النهاية:
```
# Allow connections from Vercel
host    all    all    0.0.0.0/0    md5
```

**أعد تشغيل PostgreSQL:**
```powershell
# في PowerShell (كـ Administrator)
Restart-Service postgresql-x64-18
```

---

### 4. تحديث Vercel Environment Variables

**في Vercel Dashboard:**

1. `PG_HOST` = `YOUR_PUBLIC_IP` (مثال: `123.45.67.89`)
2. `PG_DATABASE` = `showroom_sales`
3. `PG_USER` = `postgres`
4. `PG_PASSWORD` = `your_postgres_password`
5. `PG_PORT` = `5432`
6. `PG_SSL` = `false` (أو `true` إذا أردت تشفير الاتصال)

---

## ⚠️ ملاحظات أمنية مهمة

### 1. كلمة المرور القوية
- تأكد أن `PG_PASSWORD` قوية جداً
- لا تشاركها مع أحد

### 2. تحديث IP العام
- إذا تغير IP المكتب (Dynamic IP)، يجب تحديث `PG_HOST` في Vercel
- **الحل**: استخدم Dynamic DNS (مثل No-IP أو DuckDNS)

### 3. حماية إضافية (اختياري)
- استخدم VPN للاتصال
- أو SSH Tunnel
- أو حدد IP Vercel فقط في `pg_hba.conf`

---

## اختبار الاتصال

**من Vercel (بعد الـ Deploy):**
- افتح الموقع
- تحقق من Console في المتصفح
- يجب أن ترى البيانات تظهر

**من جهاز آخر (للتأكد):**
```powershell
# استبدل YOUR_PUBLIC_IP بـ IP جهاز المكتب
& "C:\Program Files\PostgreSQL\18\bin\psql.exe" -U postgres -h YOUR_PUBLIC_IP -d showroom_sales
```

---

## استكشاف الأخطاء

### المشكلة: "Connection refused"
- تأكد أن Firewall مفتوح
- تأكد أن PostgreSQL يستمع على `*` وليس `localhost` فقط

### المشكلة: "Authentication failed"
- تأكد من `pg_hba.conf`
- تأكد من كلمة المرور في Vercel

### المشكلة: "Connection timeout"
- تأكد أن IP العام صحيح
- تأكد أن Router يسمح بالاتصالات الواردة (Port Forwarding)

---

## الخلاصة

✅ جهاز المكتب شغال دائماً = البيانات متاحة دائماً  
✅ IP عام ثابت = الاتصال مستقر  
✅ Firewall مفتوح = Vercel يصل للبيانات  
✅ PostgreSQL معد = جاهز للاستخدام
