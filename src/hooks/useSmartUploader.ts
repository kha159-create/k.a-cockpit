
import { useState, Dispatch, SetStateAction } from 'react';
// Firebase removed - using local API
import { generateText } from '../services/geminiService';
import { normalizeDate, parseNumber } from '../utils/calculator';
import type { AppMessage, Employee, Store } from '../types';

export const useSmartUploader = (
    _dbInstance: any,
    setAppMessage: Dispatch<SetStateAction<AppMessage>>,
    setIsProcessing: (isProcessing: boolean) => void,
    _allEmployees: Employee[],
    _allStores: Store[]
) => {
    const [uploadResult, setUploadResult] = useState<{ successful: any[], skipped: number } | null>(null);

    const clearUploadResult = () => setUploadResult(null);

    const normalizeKey = (k: string) => k.toLowerCase().trim().replace(/[\s_.-]+/g, '');
    const parseEmployeeIdFromName = (name: any): string | null => {
        if (!name) return null;
        const s = String(name).trim();
        // leading 3-4 digits e.g., 4325-Maryam
        let m = s.match(/^(\d{3,4})\b/);
        if (m) return m[1];
        // Unknown 262 or Unknown_2792
        m = s.match(/unknown[\s_\-]*(\d{3,4})/i);
        if (m) return m[1];
        // trailing 3-4 digits e.g., Amal 2792
        m = s.match(/(\d{3,4})\s*$/);
        if (m) return m[1];
        return null;
    };
    const findValueByKeyVariations = (row: any, keys: string[]) => {
        const normalizedRowKeys: Record<string, string> = {};
        for (const rowKey in row) normalizedRowKeys[normalizeKey(rowKey)] = rowKey;
        for (const key of keys) {
            if (!key) continue;
            const nk = normalizeKey(String(key));
            const actualKey = normalizedRowKeys[nk];
            if (actualKey !== undefined) {
                const value = row[actualKey];
                if (value !== undefined && value !== null) return value;
            }
        }
        return undefined;
    };

    const handleSmartUpload = async (parsedData: any[], setProgress: (progress: number) => void) => {
        if (!_dbInstance) return;
        setIsProcessing(true);
        setProgress(0);
        setUploadResult(null);
        setAppMessage({ isOpen: true, text: 'AI is analyzing your file structure...', type: 'alert' });

        let fileType, headerMap, format;

        try {
            const headers = Object.keys(parsedData[0]).join(', ');
            const preview = `Headers: ${headers}\nSample rows:\n${parsedData.slice(0, 3).map(r => Object.values(r).join(', ')).join('\n')}`;
            const prompt = `You are an expert data import specialist for a retail company. Analyze the provided file preview. Your task is to identify the file type, its format, and map its columns to our system's required columns.

The possible file types are: 'employee_sales', 'item_wise_sales', 'install', 'visitors'.

Our system's columns for each type are:
- 'employee_sales': ['Sales Man Name', 'Outlet Name', 'Bill Date', 'Net Amount', 'Total Sales Bills']
- 'item_wise_sales': ['Outlet Name', 'SalesMan Name', 'Bill Dt.', 'Item Name', 'Item Alias', 'Sold Qty', 'Item Rate']
- 'install': ['Type', 'Store Name', 'Area Manager', 'Employee Name', 'Employee Store', 'Year', 'Month', 'Store Target', 'Employee Sales Target', 'Employee Duvet Target', 'Employee Email']
- 'visitors': ['Date', 'Store Name', 'Visitors']

**Analysis Rules:**
1.  **Partial 'install' Files:** The 'install' file type is special. It can be a partial file. For example, it might ONLY contain employee targets ('Type', 'Employee Name', 'Year', 'Month', 'Employee Sales Target') or ONLY store targets. You must still identify it as 'install' if it contains a valid subset of the 'install' columns. The 'Type' column is a strong indicator.
2.  **File Formats:** 'employee_sales' can have a "flat" format (one employee per row) or a "grouped" format (employee name in one row, their data in subsequent rows). Your JSON response must include a "format" key for this file type.
3.  **Flexible Column Names:** Match headers intelligently (e.g., 'Net Amount' could be 'Net Sales', 'Sales Man Name' could be 'Employee').

**IMPORTANT EXAMPLE:** If the user uploads a file with headers \`Type, Employee Name, Employee Store, Year, Month, Employee Sales Target\`, you MUST correctly identify it as 'install' and return a headerMap for the columns present.
{
  "fileType": "install",
  "headerMap": {
    "Type": "Type",
    "Employee Name": "Employee Name",
    "Employee Store": "Employee Store",
    "Year": "Year",
    "Month": "Month",
    "Employee Sales Target": "Employee Sales Target"
  }
}

Return ONLY a valid JSON object with "fileType", "headerMap", and a "format" key (null if not 'employee_sales').

File Preview:
${preview}`;

            const responseText = await generateText({ model: 'gemini-2.5-flash', contents: [{ parts: [{ text: prompt }] }] });
            const cleanedResponse = responseText.match(/\{.*\}/s)?.[0];
            if (!cleanedResponse) throw new Error("AI response was not valid JSON.");

            const analysis = JSON.parse(cleanedResponse);
            fileType = analysis.fileType;
            headerMap = analysis.headerMap;
            format = analysis.format;

            if (!fileType || !headerMap) throw new Error("AI could not determine file structure.");

            // Ensure bill number header mapping exists for item_wise_sales
            if (fileType === 'item_wise_sales') {
                const billCandidates = ['Bill_No', 'bill_no', 'Bill No', 'Invoice', 'Invoice No', 'Transaction_ID', 'Bill Number'];
                const found = billCandidates.find(k => Object.keys(headerMap).some(h => h.toLowerCase().trim() === k.toLowerCase().trim()));
                if (!found) {
                    // Add a soft mapping if source file has a near match
                    const firstRowKeys = Object.keys(parsedData[0] || {});
                    const near = firstRowKeys.find(k => billCandidates.some(c => k.toLowerCase().trim() === c.toLowerCase().trim()));
                    if (near) {
                        (headerMap as any)['Bill_No'] = near;
                    } else {
                        console.warn('Bill number not found, sold-with analysis may be limited');
                    }
                }
            }
            setAppMessage({ isOpen: true, text: `AI identified file as: ${fileType}. Starting upload...`, type: 'alert' });

        } catch (error: any) {
            setAppMessage({ isOpen: true, text: `AI analysis failed: ${error.message}. Please use a template.`, type: 'alert' });
            setIsProcessing(false);
            return;
        }

        const CHUNK_SIZE = 400;
        let successfulRecords: any[] = [];
        let skippedCount = 0;
        const employeeNamesInFile = new Set<string>();
        let installYearMonth: { year: number, month: number } | null = null;


        for (let i = 0; i < parsedData.length; i += CHUNK_SIZE) {
            const chunk = parsedData.slice(i, i + CHUNK_SIZE);
            let currentSalesmanName: string | null = null;

            for (const row of chunk) {
                try {
                    switch (fileType) {
                        case 'employee_sales': {
                            if (format === 'flat') {
                                const salesmanName = findValueByKeyVariations(row, [headerMap['Sales Man Name']]);
                                const outletName = findValueByKeyVariations(row, [headerMap['Outlet Name']]);
                                const dateString = normalizeDate(findValueByKeyVariations(row, [headerMap['Bill Date']]));
                                const totalSales = parseNumber(findValueByKeyVariations(row, [headerMap['Net Amount']]));
                                const transactionCount = parseNumber(findValueByKeyVariations(row, [headerMap['Total Sales Bills']]));

                                if (dateString && outletName && salesmanName) {
                                    successfulRecords.push({ dataType: 'Employee Sale', name: salesmanName, value: `Sales: ${totalSales}` });
                                } else { skippedCount++; }
                            } else {
                                const salesmanName = findValueByKeyVariations(row, [headerMap['Sales Man Name']]);
                                const outletName = findValueByKeyVariations(row, [headerMap['Outlet Name']]);

                                if (salesmanName && String(salesmanName).trim() && !String(salesmanName).toLowerCase().includes('total')) {
                                    currentSalesmanName = String(salesmanName).trim();
                                    continue;
                                }

                                if (!salesmanName && outletName && currentSalesmanName) {
                                    const dateString = normalizeDate(findValueByKeyVariations(row, [headerMap['Bill Date']]));
                                    const totalSales = parseNumber(findValueByKeyVariations(row, [headerMap['Net Amount']]));
                                    const transactionCount = parseNumber(findValueByKeyVariations(row, [headerMap['Total Sales Bills']]));
                                    if (dateString) {
                                        successfulRecords.push({ dataType: 'Employee Sale', name: currentSalesmanName, value: `Sales: ${totalSales}` });
                                    } else { skippedCount++; }
                                } else { skippedCount++; }
                            }
                            break;
                        }
                        case 'item_wise_sales': {
                            const dateString = normalizeDate(findValueByKeyVariations(row, [headerMap['Bill Dt.']]));
                            const store = findValueByKeyVariations(row, [headerMap['Outlet Name']]);
                            const employee = findValueByKeyVariations(row, [headerMap['SalesMan Name']]);
                            const itemName = findValueByKeyVariations(row, [headerMap['Item Name']]);
                            const alias = findValueByKeyVariations(row, [headerMap['Item Alias']]);
                            const qty = parseNumber(findValueByKeyVariations(row, [headerMap['Sold Qty']]));

                            if (dateString && store && employee && itemName && alias) {
                                successfulRecords.push({ dataType: 'Item Sale', name: itemName, value: `Qty: ${qty}` });
                            } else { skippedCount++; }
                            break;
                        }
                        case 'install': {
                            const type = findValueByKeyVariations(row, [headerMap['Type']])?.toLowerCase();
                            const year = parseNumber(findValueByKeyVariations(row, [headerMap['Year']]));
                            const month = parseNumber(findValueByKeyVariations(row, [headerMap['Month']]));
                            if (!type || !year || !month) { skippedCount++; continue; }

                            if (!installYearMonth) installYearMonth = { year, month };

                            if (type === 'store') {
                                const storeName = findValueByKeyVariations(row, [headerMap['Store Name']]);
                                if (storeName) {
                                    successfulRecords.push({ dataType: 'Store Install', name: storeName, value: `Data recognized` });
                                } else { skippedCount++; }
                            } else if (type === 'employee') {
                                const empName = findValueByKeyVariations(row, [headerMap['Employee Name']]);
                                if (empName) {
                                    employeeNamesInFile.add(empName);
                                    successfulRecords.push({ dataType: 'Employee Install', name: empName, value: `Data recognized` });
                                } else { skippedCount++; }
                            } else { skippedCount++; }
                            break;
                        }
                        case 'visitors': {
                            const dateString = normalizeDate(findValueByKeyVariations(row, [headerMap['Date']]));
                            const store = findValueByKeyVariations(row, [headerMap['Store Name']]);
                            const visitors = parseNumber(findValueByKeyVariations(row, [headerMap['Visitors']]));
                            if (dateString && store) {
                                successfulRecords.push({ dataType: 'Visitors', name: store, value: `${visitors} visitors` });
                            } else { skippedCount++; }
                            break;
                        }
                        default:
                            skippedCount++;
                    }
                } catch (e) {
                    console.error("Error processing row:", row, e);
                    skippedCount++;
                }
            }
            setProgress(((i + chunk.length) / parsedData.length) * 100);
        }

        setUploadResult({ successful: successfulRecords, skipped: skippedCount });
        setAppMessage({ isOpen: true, text: `Upload complete (Backend skipped)! Processed ${successfulRecords.length} records.`, type: 'alert' });
        setIsProcessing(false);
    };

    return { handleSmartUpload, uploadResult, clearUploadResult };
};