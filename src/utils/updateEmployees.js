// Firestore utilities disabled (auth-only mode).

export const updateAllEmployeesWithLinkedAccount = async () => {
  console.warn('Firestore disabled: updateAllEmployeesWithLinkedAccount skipped.');
  return {
    success: false,
    message: 'تم تعطيل تحديث الموظفين لأن النظام لا يتصل بـ Firestore.',
    updatedCount: 0,
  };
};
