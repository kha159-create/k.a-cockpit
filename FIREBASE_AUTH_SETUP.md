# 🔐 Firebase Authentication Setup

## 🚨 Current Issue
The app shows "Missing or insufficient permissions" which means either:
1. Firebase Security Rules are too restrictive, OR
2. User authentication is not working properly

## ✅ Quick Fix Steps

### **Step 1: Check Firebase Console**
Go to: https://console.firebase.google.com/project/alsani-cockpit-v3

### **Step 2: Enable Authentication (If Not Enabled)**
1. Click "Authentication" in left sidebar
2. Click "Get started" if not already enabled
3. Go to "Sign-in method" tab
4. Enable "Email/Password" provider
5. Click "Save"

### **Step 3: Create Admin User (If Needed)**
1. Go to "Authentication" → "Users" tab
2. Click "Add user"
3. Email: `kha.als@outlook.com`
4. Password: (use your preferred password)
5. Click "Add user"

### **Step 4: Update Security Rules**
1. Go to "Firestore Database" → "Rules" tab
2. Replace with this rule:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

3. Click "Publish"

### **Step 5: Test Login**
1. Go to your deployed site: https://kha159-create.github.io/k.a-cockpit/
2. Try logging in with:
   - Email: `kha.als@outlook.com`
   - Password: (the password you set)

## 🎯 **Expected Result**
- ✅ Login works without errors
- ✅ Dashboard loads with data
- ✅ No more permission errors in console

---

**Total time: 5 minutes** ⏱️
