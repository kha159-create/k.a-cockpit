import { useState, Dispatch, SetStateAction } from 'react';
import type { AppMessage } from '../types';

export const useSmartUploader = (
    setAppMessage: Dispatch<SetStateAction<AppMessage>>,
    setIsProcessing: (isProcessing: boolean) => void,
) => {
    const [uploadResult, setUploadResult] = useState<{ successful: any[]; skipped: number } | null>(null);

    const clearUploadResult = () => setUploadResult(null);

    const handleSmartUpload = async (_parsedData: any[], setProgress: (progress: number) => void) => {
        setIsProcessing(true);
        setProgress(0);
        setUploadResult({ successful: [], skipped: 0 });
        setAppMessage({
            isOpen: true,
            text: 'تم تعطيل الرفع الذكي لأن النظام لا يتصل بـ Firestore.',
            type: 'alert',
        });
        setProgress(100);
        setIsProcessing(false);
    };

    return { handleSmartUpload, uploadResult, clearUploadResult };
};
