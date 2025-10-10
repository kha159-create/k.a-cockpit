import { db } from '@/services/firebase';

const parseIdFromUnknown = (name?: string): string | null => {
  if (!name) return null;
  const match = String(name).match(/unknown[\s_\-]*(\d{1,10})/i) || String(name).match(/(\d{2,10})$/);
  return match ? match[1] : null;
};

export type FixUnknownResult = {
  employeesUpdated: number;
  metricsUpdated: number;
  salesUpdated?: number;
};

export const fixUnknownEmployeesAndMetrics = async (): Promise<FixUnknownResult> => {
  let employeesUpdated = 0;
  let metricsUpdated = 0;
  let salesUpdated = 0;

  // 1) Fix employees with names like "Unknown 2792" and missing employeeId
  const employeesSnap = await db.collection('employees').get();
  for (const doc of employeesSnap.docs) {
    const data = doc.data() as any;
    const currentId = data?.employeeId;
    const parsed = parseIdFromUnknown(data?.name);
    if (!currentId && parsed) {
      await db.collection('employees').doc(doc.id).set({ employeeId: parsed, name: `Unknown ${parsed}` }, { merge: true });
      employeesUpdated++;
    }
  }

  // 2) Backfill dailyMetrics.employeeId when employee like "unknown 4575"
  const metricsSnap = await db.collection('dailyMetrics').get();
  for (const doc of metricsSnap.docs) {
    const data = doc.data() as any;
    if (data?.employeeId) continue;
    const parsed = parseIdFromUnknown(data?.employee);
    if (parsed) {
      await db.collection('dailyMetrics').doc(doc.id).set({ employeeId: parsed }, { merge: true });
      metricsUpdated++;
    }
  }

  // 3) Backfill employeeId in sales collections from SalesMan Name
  const updateSalesCollection = async (collection: 'salesTransactions' | 'kingDuvetSales') => {
    const snap = await db.collection(collection).get();
    for (const doc of snap.docs) {
      const data = doc.data() as any;
      if (data?.employeeId) continue;
      const parsed = parseIdFromUnknown(data?.['SalesMan Name'] || data?.employee);
      if (parsed) {
        await db.collection(collection).doc(doc.id).set({ employeeId: parsed }, { merge: true });
        salesUpdated++;
      }
    }
  };
  await updateSalesCollection('salesTransactions');
  await updateSalesCollection('kingDuvetSales');

  return { employeesUpdated, metricsUpdated, salesUpdated };
};


