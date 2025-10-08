import React, { useState, useMemo } from 'react';
import type { EmployeeSummary, StoreSummary, SalesTransaction, BusinessRule, UserProfile } from '../types.js';
import DataExporter from '../components/DataExporter.js';
import CustomBusinessRules from '../components/CustomBusinessRules.js';
import UserManagement from '../components/UserManagement.js';
import { useLocale } from '../context/LocaleContext.js';

interface SelectiveDataDeletionProps {
    onSelectiveDelete: (dataType: 'visitors' | 'sales', year: number, month: number) => void;
    isProcessing: boolean;
}

const SelectiveDataDeletion: React.FC<SelectiveDataDeletionProps> = ({ onSelectiveDelete, isProcessing }) => {
    const { t } = useLocale();
    const [dataType, setDataType] = useState<'visitors' | 'sales'>('visitors');
    const [year, setYear] = useState(new Date().getFullYear());
    const [month, setMonth] = useState(new Date().getMonth());

    const years = useMemo(() => Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i), []);
    const months = useMemo(() => Array.from({ length: 12 }, (_, i) => new Date(0, i).toLocaleString('en-US', { month: 'long' })), []);

    const handleDelete = () => {
        onSelectiveDelete(dataType, year, month);
    };

    return (
        <div className="bg-white p-6 rounded-xl shadow-sm border">
            <h3 className="text-xl font-semibold text-zinc-700 mb-2">{t('selective_data_deletion_title')}</h3>
            <p className="text-sm text-zinc-500 mb-4">{t('selective_data_deletion_desc')}</p>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end p-4 border border-red-200 bg-red-50 rounded-lg">
                <div>
                    <label className="label">{t('data_type')}</label>
                    <select value={dataType} onChange={e => setDataType(e.target.value as any)} className="input">
                        <option value="visitors">{t('visitors')}</option>
                        <option value="sales">{t('sales')}</option>
                    </select>
                </div>
                <div>
                    <label className="label">{t('year')}</label>
                    <select value={year} onChange={e => setYear(Number(e.target.value))} className="input">
                        {years.map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                </div>
                <div>
                    <label className="label">{t('month')}</label>
                    <select value={month} onChange={e => setMonth(Number(e.target.value))} className="input">
                        {months.map((m, i) => <option key={i} value={i}>{m}</option>)}
                    </select>
                </div>
                <button onClick={handleDelete} disabled={isProcessing} className="btn-danger w-full">
                    {isProcessing ? t('deleting') : t('delete_data_button')}
                </button>
            </div>
        </div>
    );
};


interface SettingsPageProps {
    employeeSummary: EmployeeSummary[];
    storeSummary: StoreSummary[];
    kingDuvetSales: SalesTransaction[];
    onAddMonthlyData: () => void;
    onDeleteAllData: () => void;
    onSelectiveDelete: (dataType: 'visitors' | 'sales', year: number, month: number) => void;
    isProcessing: boolean;
    businessRules: BusinessRule[];
    onSaveRule: (rule: string) => void;
    onDeleteRule: (id: string) => void;
    profile: UserProfile | null;
    allUsers: (UserProfile & { id: string })[];
    onUpdateUser: (userId: string, data: Partial<UserProfile>) => void;
    onDeleteUser?: (userId: string, userName: string) => void;
    setModalState: (state: any) => void;
}

const SettingsPage: React.FC<SettingsPageProps> = ({ 
    employeeSummary, storeSummary, kingDuvetSales, onAddMonthlyData, onDeleteAllData, onSelectiveDelete, isProcessing,
    businessRules, onSaveRule, onDeleteRule, profile, allUsers, onUpdateUser, onDeleteUser, setModalState
}) => {
    const isAdmin = profile?.role === 'admin';
    const isGM = profile?.role === 'general_manager';

    return (
        <div className="space-y-6 max-w-4xl mx-auto">
            {isAdmin && (
                <div className="bg-white p-6 rounded-xl shadow-sm border">
                    <h3 className="text-xl font-semibold text-zinc-700 mb-4">Administrative Tools</h3>
                    <button onClick={onAddMonthlyData} className="btn-primary">Add Historical Monthly Data</button>
                    <p className="text-xs text-zinc-500 mt-2">Use this to enter aggregated data for a full month retrospectively.</p>
                </div>
            )}
            
            {isAdmin && (
                <CustomBusinessRules
                    rules={businessRules}
                    onSave={onSaveRule}
                    onDelete={onDeleteRule}
                    isProcessing={isProcessing}
                />
            )}

            {isAdmin && (
                 <UserManagement 
                    profile={profile}
                    allUsers={allUsers}
                    setModalState={setModalState}
                    onDeleteUser={onDeleteUser}
                />
            )}

            {(isAdmin || isGM) && (
                <DataExporter 
                    employeeSummary={employeeSummary} 
                    storeSummary={storeSummary} 
                    kingDuvetSales={kingDuvetSales}
                />
            )}

            {isAdmin && (
                <div className="space-y-6">
                    <SelectiveDataDeletion onSelectiveDelete={onSelectiveDelete} isProcessing={isProcessing} />
                    <div className="bg-white p-6 rounded-xl shadow-sm border">
                        <h3 className="text-xl font-semibold text-zinc-700 mb-4">Data Management</h3>
                        <div className="p-4 border border-red-300 rounded-lg bg-red-50">
                            <h4 className="font-bold text-red-800">Danger Zone</h4>
                            <p className="text-red-700 mt-1 text-sm">This action will permanently delete all data in the database. This cannot be undone.</p>
                            <div className="mt-4">
                                <button onClick={onDeleteAllData} disabled={isProcessing} className="btn-danger">
                                    {isProcessing ? 'Deleting...' : 'Delete All Data'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SettingsPage;
