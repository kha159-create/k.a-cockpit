# 🔥 Firebase Security Rules Setup

## 🚨 Current Issue
The deployed site shows "Missing or insufficient permissions" because Firebase Security Rules are blocking access to the database.

## ✅ Solution Steps

### 1. **Access Firebase Console**
Go to: https://console.firebase.google.com/project/alsani-cockpit-v3

### 2. **Navigate to Firestore Database**
- Click on "Firestore Database" in the left sidebar
- Click on "Rules" tab

### 3. **Update Security Rules**
Replace the current rules with these rules that allow authenticated users to read/write:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Allow read/write access to authenticated users
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
    
    // Specific rules for collections (optional - more secure)
    match /salesTransactions/{document} {
      allow read, write: if request.auth != null;
    }
    
    match /stores/{document} {
      allow read, write: if request.auth != null;
    }
    
    match /employees/{document} {
      allow read, write: if request.auth != null;
    }
    
    match /dailyMetrics/{document} {
      allow read, write: if request.auth != null;
    }
    
    match /visitors/{document} {
      allow read, write: if request.auth != null;
    }
    
    match /kingDuvetSales/{document} {
      allow read, write: if request.auth != null;
    }
  }
}
```

### 4. **Alternative: Temporary Open Rules (For Testing)**
If you want to test quickly, you can temporarily use open rules (⚠️ NOT recommended for production):

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true;
    }
  }
}
```

### 5. **Publish Rules**
- Click "Publish" button after updating the rules
- Wait for the rules to be deployed (usually takes a few minutes)

## 🔍 **Verify Setup**

### **Check Authentication**
1. Go to Firebase Console → Authentication
2. Make sure your user account exists
3. Check if the user has the correct email/password

### **Test Database Access**
1. Go to Firestore Database → Data
2. Verify that collections exist:
   - `salesTransactions`
   - `stores` 
   - `employees`
   - `dailyMetrics`
   - `visitors`
   - `kingDuvetSales`

## 🚀 **Expected Result**
After updating the rules:
- ✅ No more "Missing or insufficient permissions" errors
- ✅ Dashboard loads with data
- ✅ All features work properly

---

**⏱️ This should take 2-3 minutes to fix the permission issue.**

## 📞 **If Still Having Issues**
1. Check Firebase Console → Authentication → Users
2. Verify your email is listed as a user
3. Try logging out and logging back in
4. Clear browser cache and cookies
