
import React, { useState } from 'react';
import type { useSmartUploader } from '../hooks/useSmartUploader';

declare var XLSX: any;

interface SmartUploaderPageProps {
  onUpload: (parsedData: any[], setProgress: (progress: number) => void) => void;
  isProcessing: boolean;
  uploadResult: { successful: any[], skipped: number } | null;
  onClearResult: () => void;
}

const downloadTemplate = (fileName: string, headers: string[]) => {
    if (typeof XLSX === 'undefined') { alert("File library is still loading..."); return; }
    const ws = XLSX.utils.json_to_sheet([], { header: headers });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template");
    XLSX.writeFile(wb, `${fileName}.xlsx`);
};

const SmartUploaderPage: React.FC<SmartUploaderPageProps> = ({ onUpload, isProcessing, uploadResult, onClearResult }) => {
    const [file, setFile] = useState<File | null>(null);
    const [uploadProgress, setUploadProgress] = useState(0);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            setFile(e.target.files[0]);
            onClearResult();
            setUploadProgress(0);
        }
    };

    const handleUpload = () => {
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target!.result as ArrayBuffer);
                const workbook = XLSX.read(data, { type: 'array' });
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];
                const jsonData = XLSX.utils.sheet_to_json(worksheet, { raw: false });
                onUpload(jsonData, setUploadProgress);
            } catch (error: any) {
                alert(`File processing failed: ${error.message}`);
            }
        };
        reader.readAsArrayBuffer(file);
    };

    return (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 space-y-6 max-w-3xl mx-auto">
            <div>
                <h3 className="text-xl font-semibold text-zinc-700">Smart Data Uploader</h3>
                <p className="text-sm text-zinc-500 mt-1">Upload an XLSX file. The system will automatically detect the file type and import the data.</p>
            </div>
            
            <div className="p-4 bg-gray-50 rounded-lg border">
                <h4 className="font-semibold text-zinc-600 mb-2">Download Templates</h4>
                <div className="flex flex-wrap gap-2">
                    <button onClick={() => downloadTemplate('Sales_Summary_Template', ['Sales Man Name', 'Outlet Name', 'Bill Date', 'Net Amount', 'Total Sales Bills'])} className="btn-secondary text-sm">Sales Summary</button>
                    <button onClick={() => downloadTemplate('Item_Wise_Sales_Template', ['Outlet Name', 'SalesMan Name', 'Bill Dt.', 'Item Name', 'Item Alias', 'Sold Qty', 'Item Rate'])} className="btn-secondary text-sm">Item-wise Sales</button>
                    <button onClick={() => downloadTemplate('Install_Template', ['Type', 'Store Name', 'Area Manager', 'Employee Name', 'Employee Store', 'Year', 'Month', 'Store Target', 'Employee Sales Target', 'Employee Duvet Target'])} className="btn-secondary text-sm">Install File</button>
                    <button onClick={() => downloadTemplate('Visitors_Template', ['Date', 'Store Name', 'Visitors'])} className="btn-secondary text-sm">Visitors</button>
                </div>
            </div>

            <div>
                <label className="label font-semibold">Upload Your File</label>
                <input type="file" onChange={handleFileChange} accept=".xlsx, .xls" className="input mt-2" />
            </div>

            {file && <button onClick={handleUpload} disabled={isProcessing} className="btn-primary w-full">{isProcessing ? 'Uploading...' : 'Upload Data'}</button>}

            {isProcessing && (
                <div>
                    <div className="w-full bg-gray-200 rounded-full h-2.5 mt-4"><div className="bg-orange-600 h-2.5 rounded-full" style={{ width: `${uploadProgress}%` }}></div></div>
                    <p className="text-center text-sm text-zinc-600 mt-1">{Math.round(uploadProgress)}% Complete</p>
                </div>
            )}

            {uploadResult && (
                <div className="p-4 rounded-lg bg-green-100 text-green-700">
                    <h4 className="font-bold">Upload Complete</h4>
                    <p>Successfully processed {uploadResult.successful.length} records. {uploadResult.skipped} rows skipped.</p>
                    <button onClick={onClearResult} className="btn-secondary mt-2 text-sm">Clear</button>
                </div>
            )}
        </div>
    );
};

export default SmartUploaderPage;