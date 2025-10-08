import React from 'react';
import type { EmployeeSummary, StoreSummary, SalesTransaction } from '../types';

declare var XLSX: any;

interface DataExporterProps {
    employeeSummary: EmployeeSummary[];
    storeSummary: StoreSummary[];
    kingDuvetSales: SalesTransaction[];
}

const DataExporter: React.FC<DataExporterProps> = ({ employeeSummary, storeSummary, kingDuvetSales }) => {
    const exportData = (data: any[], fileName: string) => {
        if (typeof XLSX === 'undefined') { alert("File library is still loading..."); return; }
        const worksheet = XLSX.utils.json_to_sheet(data);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Report");
        XLSX.writeFile(workbook, `${fileName}.xlsx`);
    };

    const handleExportEmployees = () => {
        const data = employeeSummary.map(emp => ({
            'Name': emp.name,
            'Store': emp.store,
            'Total Sales': emp.totalSales,
            'Target': emp.effectiveTarget,
            'Achievement %': emp.achievement.toFixed(2),
        }));
        exportData(data, "Employees_Report");
    };

    const handleExportStores = () => {
        const data = storeSummary.map(store => ({
            'Name': store.name,
            'Area Manager': store.areaManager,
            'Total Sales': store.totalSales,
            'Target': store.effectiveTarget,
            'Achievement %': store.targetAchievement.toFixed(2),
            'Visitors': store.visitors,
            'Transactions': store.transactionCount,
        }));
        exportData(data, "Stores_Report");
    };

    return (
        <div className="bg-white p-6 rounded-xl shadow-sm border">
            <h3 className="text-xl font-semibold text-zinc-700 mb-4">Data Export</h3>
            <div className="flex flex-col sm:flex-row gap-4">
                <button onClick={handleExportEmployees} className="btn-secondary flex-1">Export Employees Report</button>
                <button onClick={handleExportStores} className="btn-secondary flex-1">Export Stores Report</button>
            </div>
        </div>
    );
};

export default DataExporter;
