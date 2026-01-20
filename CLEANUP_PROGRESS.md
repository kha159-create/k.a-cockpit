# 🔄 Progress: Cleaning up Firestore and connecting SQL

## ✅ Completed

1. **Removed Firestore Listeners**
   - ✅ Removed users listener from MainLayout
   - ✅ Removed pendingEmployees and users listeners from PendingApprovalsPage
   - ✅ All Firestore listeners removed - only SQL and D365 remain

## 🚧 In Progress

2. **Fix Salesman Field**
   - ⏳ Salesman exists in database but not in API response
   - Need to add salesman aggregation in sales-pg.ts

3. **Employee-Store Mapping**
   - ⏳ Started employee-store mapping query
   - Need to create proper mapping table in PostgreSQL

4. **Clean Old Connections**
   - ⏳ Need to review all files for old Firestore connections
   - Need to remove unused imports

## 📋 TODO

5. **Understand orange-dashboard**
   - orange-dashboard reads management_data.json from GitHub
   - Contains: targets, visitors, store_meta
   - We should move this to PostgreSQL

6. **Complete Employee Aggregation**
   - Add byEmployee to sales-pg.ts response
   - Group by employee and store
