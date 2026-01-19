export type FixUnknownResult = {
  employeesUpdated: number;
  metricsUpdated: number;
  salesUpdated?: number;
};

export const fixUnknownEmployeesAndMetrics = async (): Promise<FixUnknownResult> => {
  console.warn('Firestore disabled: fixUnknownEmployeesAndMetrics skipped.');
  return { employeesUpdated: 0, metricsUpdated: 0, salesUpdated: 0 };
};
