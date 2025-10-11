
import React, { useState, useEffect, useMemo } from 'react';
import { SparklesIcon } from './Icons';
import { getCategory } from '../utils/calculator';
import { generateText, generatePrediction } from '../services/geminiService';
import type { Store, Employee, ProductSummary, AppMessage, StoreSummary, EmployeeSummary, KPIData, UserProfile, UserRole, DailyMetric, PredictionResult } from '../types';
import { useLocale } from '../context/LocaleContext';
import { ChartCard, BarChart } from './DashboardComponents';

// --- Reusable Modal Components ---
interface ModalProps {
  onClose: () => void;
  isProcessing?: boolean;
  // FIX: Added optional profile prop to ModalProps to support RBAC in modals.
  profile?: UserProfile | null;
}

// FIX: Added the missing VisitorsModal component.
export const VisitorsModal: React.FC<ModalProps & { onSave: (data: any) => void; stores: Store[] }> = ({ onSave, onClose, isProcessing, stores, profile }) => {
    const { t } = useLocale();
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const defaultStore = profile?.role === 'store_manager' ? profile.store : stores[0]?.name;
    const [store, setStore] = useState(defaultStore || '');
    const [visitors, setVisitors] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!store || !date || !visitors || Number(visitors) < 0) return;
        onSave({ date, store, visitors: Number(visitors) });
    };

    return (
        <div className="modal-content">
            <h2 className="modal-title">{t('add_visitors')}</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label className="label">{t('store')}</label>
                    <select value={store} onChange={e => setStore(e.target.value)} required className="input">
                        <option value="">{t('select_store')}</option>
                        {stores.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                    </select>
                </div>
                <div>
                    <label className="label">{t('date')}</label>
                    <input type="date" value={date} onChange={e => setDate(e.target.value)} required className="input" />
                </div>
                <div>
                    <label className="label">{t('visitors_count')}</label>
                    <input type="number" value={visitors} onChange={e => setVisitors(e.target.value)} required className="input" placeholder="e.g., 150" min="0" />
                </div>
                <div className="modal-actions">
                    <button type="button" onClick={onClose} disabled={isProcessing} className="btn-secondary">{t('cancel')}</button>
                    <button type="submit" disabled={isProcessing || !store || !visitors} className="btn-primary">
                        {isProcessing ? t('saving') : t('save')}
                    </button>
                </div>
            </form>
        </div>
    );
};

interface EmployeeModalProps extends ModalProps {
  data?: Employee;
  onSave: (data: any) => void;
  stores: Store[];
}
export const EmployeeModal: React.FC<EmployeeModalProps> = ({ data, onSave, onClose, isProcessing, stores, profile }) => {
    const { t } = useLocale();
    const [name, setName] = useState(data?.name || '');
    const [store, setStore] = useState(data?.currentStore || '');
    const [areaManager, setAreaManager] = useState(stores.find(s => s.name === (data?.currentStore || ''))?.areaManager || '');
    const [targetYear, setTargetYear] = useState(new Date().getFullYear());
    const [targetMonth, setTargetMonth] = useState(new Date().getMonth() + 1);
    const [salesTarget, setSalesTarget] = useState(0);
    const [duvetTarget, setDuvetTarget] = useState(0);
    
    const isAreaManager = profile?.role === 'area_manager';

    const availableStores = useMemo(() => {
        return areaManager ? stores.filter(s => s.areaManager === areaManager) : stores;
    }, [areaManager, stores]);

    useEffect(() => {
        const currentSalesTarget = data?.targets?.[targetYear]?.[targetMonth] || 0;
        const currentDuvetTarget = data?.duvetTargets?.[targetYear]?.[targetMonth] || 0;
        setSalesTarget(currentSalesTarget);
        setDuvetTarget(currentDuvetTarget);
    }, [data, targetYear, targetMonth]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const employeeId = String(name).match(/^\d+/)?.[0] || data?.employeeId || null;
        onSave({
            id: data?.id,
            name,
            store,
            employeeId,
            targetUpdate: { year: targetYear, month: targetMonth, salesTarget, duvetTarget }
        });
    };
    
    const areaManagers = [...new Set(stores.map(s => s.areaManager))];
    const years = [new Date().getFullYear() - 1, new Date().getFullYear(), new Date().getFullYear() + 1];
    const months = Array.from({ length: 12 }, (_, i) => i + 1);

    return (
        <div className="modal-content">
            <h2 className="modal-title">{data ? t('edit_employee') : t('add_employee')}</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
                <div><label className="label">{t('employee_name')}</label><input type="text" value={name} onChange={e => setName(e.target.value)} required className="input" disabled={isAreaManager} /></div>
                <div><label className="label">{t('area_manager')}</label><select value={areaManager} onChange={e => { setAreaManager(e.target.value); setStore(''); }} required className="input" disabled={isAreaManager}><option value="">{t('select_area')}</option>{areaManagers.map(am => <option key={am} value={am}>{am}</option>)}</select></div>
                <div><label className="label">{t('store')}</label><select value={store} onChange={e => setStore(e.target.value)} required className="input" disabled={!areaManager || isAreaManager}><option value="">{t('select_store')}</option>{availableStores.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}</select></div>
                <div className="p-4 border rounded-lg space-y-2">
                    <h3 className="font-semibold">{t('monthly_targets')}</h3>
                    <div className="flex gap-2"><select value={targetYear} onChange={e => setTargetYear(Number(e.target.value))} className="input"><option value="">{t('year')}</option>{years.map(y => <option key={y} value={y}>{y}</option>)}</select><select value={targetMonth} onChange={e => setTargetMonth(Number(e.target.value))} className="input"><option value="">{t('month')}</option>{months.map(m => <option key={m} value={m}>{m}</option>)}</select></div>
                    <div><label className="label">{t('sales_target')}</label><input type="number" value={salesTarget} onChange={e => setSalesTarget(Number(e.target.value))} className="input" /></div>
                    <div><label className="label">{t('duvet_unit_target')}</label><input type="number" value={duvetTarget} onChange={e => setDuvetTarget(Number(e.target.value))} className="input" /></div>
                </div>
                <div className="modal-actions"><button type="button" onClick={onClose} disabled={isProcessing} className="btn-secondary">{t('cancel')}</button><button type="submit" disabled={isProcessing} className="btn-primary">{isProcessing ? t('saving') : t('save')}</button></div>
            </form>
        </div>
    );
};

interface StoreModalProps extends ModalProps {
  data?: Store;
  onSave: (data: any) => void;
}
export const StoreModal: React.FC<StoreModalProps> = ({ data, onSave, onClose, isProcessing, profile }) => {
    const { t } = useLocale();
    const [name, setName] = useState(data?.name || '');
    const [areaManager, setAreaManager] = useState(data?.areaManager || '');
    const [targetYear, setTargetYear] = useState(new Date().getFullYear());
    const [targetMonth, setTargetMonth] = useState(new Date().getMonth() + 1);
    const [salesTarget, setSalesTarget] = useState(0);

    const canEdit = profile?.role === 'admin' || profile?.role === 'general_manager';

    useEffect(() => {
        // Sync incoming data when editing existing store
        if (data) {
            setName(data.name || '');
            setAreaManager(data.areaManager || '');
            const currentTarget = data.targets?.[targetYear]?.[targetMonth] || 0;
            setSalesTarget(currentTarget);
        } else {
            setName('');
            setAreaManager('');
            setSalesTarget(0);
        }
    }, [data, targetYear, targetMonth]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave({
            id: data?.id,
            name,
            areaManager,
            targetUpdate: { year: targetYear, month: targetMonth, salesTarget }
        });
    };
    
    const years = [new Date().getFullYear() - 1, new Date().getFullYear(), new Date().getFullYear() + 1];
    const months = Array.from({ length: 12 }, (_, i) => i + 1);

    return (
        <div className="modal-content">
            <h2 className="modal-title">{data ? t('edit_store') : t('add_store')}</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
                <div><label className="label">{t('store_name')}</label><input type="text" value={name} onChange={e => setName(e.target.value)} required className="input" disabled={!canEdit} /></div>
                <div><label className="label">{t('area_manager')}</label><input type="text" value={areaManager} onChange={e => setAreaManager(e.target.value)} required className="input" placeholder="e.g., Central Region" disabled={!canEdit}/></div>
                <div className="p-4 border rounded-lg space-y-2">
                    <h3 className="font-semibold">{t('monthly_sales_target')}</h3>
                    <div className="flex gap-2"><select value={targetYear} onChange={e => setTargetYear(Number(e.target.value))} className="input">{years.map(y => <option key={y} value={y}>{y}</option>)}</select><select value={targetMonth} onChange={e => setTargetMonth(Number(e.target.value))} className="input">{months.map(m => <option key={m} value={m}>{m}</option>)}</select></div>
                    <div><label className="label">{t('sales_target')}</label><input type="number" value={salesTarget} onChange={e => setSalesTarget(Number(e.target.value))} className="input" /></div>
                </div>
                <div className="modal-actions"><button type="button" onClick={onClose} disabled={isProcessing} className="btn-secondary">{t('cancel')}</button><button type="submit" disabled={isProcessing} className="btn-primary">{isProcessing ? t('saving') : t('save')}</button></div>
            </form>
        </div>
    );
};

interface DailyMetricModalProps extends ModalProps {
  data: { mode: 'store' | 'employee', store?: string, employee?: string };
  onSave: (data: any) => void;
  stores: Store[];
}
export const DailyMetricModal: React.FC<DailyMetricModalProps> = ({ data, onSave, onClose, isProcessing, stores }) => {
    const { t } = useLocale();
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [store, setStore] = useState(data.store || '');
    const [totalSales, setTotalSales] = useState('');
    const [visitors, setVisitors] = useState('');
    const [transactionCount, setTransactionCount] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const employeeId = data.employee ? String(data.employee).match(/^\d+/)?.[0] || null : null;
        const metricData: any = { date, store, employeeId, totalSales: Number(totalSales), transactionCount: Number(transactionCount) };
        if (data.mode === 'store') {
          metricData.visitors = Number(visitors);
        } else {
          metricData.employee = data.employee;
        }
        onSave(metricData);
    };

    return (
        <div className="modal-content">
            <h2 className="modal-title">{t('add_daily_kpis')}</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
                <div><label className="label">{t('date')}</label><input type="date" value={date} onChange={e => setDate(e.target.value)} required className="input" /></div>
                {data.mode === 'employee' ? <p>For: <strong>{data.employee}</strong></p> : <div><label className="label">{t('store')}</label><select value={store} onChange={e => setStore(e.target.value)} required className="input"><option value="">{t('select_store')}</option>{stores.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}</select></div>}
                <div><label className="label">{t('total_sales')}</label><input type="number" value={totalSales} onChange={e => setTotalSales(e.target.value)} required className="input" /></div>
                <div><label className="label">{t('number_of_bills')}</label><input type="number" value={transactionCount} onChange={e => setTransactionCount(e.target.value)} required className="input" /></div>
                {data.mode === 'store' && <div><label className="label">{t('total_visitors')}</label><input type="number" value={visitors} onChange={e => setVisitors(e.target.value)} required className="input" /></div>}
                <div className="modal-actions"><button type="button" onClick={onClose} className="btn-secondary">{t('cancel')}</button><button type="submit" disabled={isProcessing} className="btn-primary">{isProcessing ? t('saving') : t('save_kpis')}</button></div>
            </form>
        </div>
    );
};

interface MonthlyMetricModalProps extends ModalProps {
    onSave: (data: any) => void;
    stores: Store[];
}
export const MonthlyStoreMetricModal: React.FC<MonthlyMetricModalProps> = ({ onSave, onClose, isProcessing, stores }) => {
    const { t } = useLocale();
    const [year, setYear] = useState(new Date().getFullYear());
    const [month, setMonth] = useState(new Date().getMonth() + 1);
    const [store, setStore] = useState('');
    const [totalSales, setTotalSales] = useState('');
    const [visitors, setVisitors] = useState('');
    const [transactionCount, setTransactionCount] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const sales = Number(totalSales);
        const trans = Number(transactionCount);
        const v = Number(visitors);
        onSave({ year, month, store, totalSales: sales, visitors: v, transactionCount: trans, atv: trans > 0 ? sales / trans : 0, visitorRate: v > 0 ? (trans / v) * 100 : 0 });
    };

    const years = [new Date().getFullYear() - 2, new Date().getFullYear() - 1, new Date().getFullYear()];
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    return (
        <div className="modal-content"><h2 className="modal-title">{t('add_historical_monthly_data')}</h2><form onSubmit={handleSubmit} className="space-y-4"><div className="grid grid-cols-2 gap-4"><div><label className="label">{t('year')}</label><select value={year} onChange={e => setYear(Number(e.target.value))} className="input">{years.map(y => <option key={y} value={y}>{y}</option>)}</select></div><div><label className="label">{t('month')}</label><select value={month} onChange={e => setMonth(Number(e.target.value))} className="input">{monthNames.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}</select></div></div><div><label className="label">{t('store')}</label><select value={store} onChange={e => setStore(e.target.value)} required className="input"><option value="">{t('select_store')}</option>{stores.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}</select></div><div><label className="label">{t('total_monthly_sales')}</label><input type="number" value={totalSales} onChange={e => setTotalSales(e.target.value)} required className="input" /></div><div><label className="label">{t('total_monthly_bills')}</label><input type="number" value={transactionCount} onChange={e => setTransactionCount(e.target.value)} required className="input" /></div><div><label className="label">{t('total_monthly_visitors')}</label><input type="number" value={visitors} onChange={e => setVisitors(e.target.value)} required className="input" /></div><div className="modal-actions"><button type="button" onClick={onClose} className="btn-secondary">{t('cancel')}</button><button type="submit" disabled={isProcessing} className="btn-primary">{isProcessing ? t('saving') : t('save_data')}</button></div></form></div>
    );
};

interface UserEditModalProps extends ModalProps {
  data: UserProfile;
  onSave: (userId: string, data: Partial<UserProfile>) => void;
  stores: Store[];
  allEmployees: Employee[];
}
export const UserEditModal: React.FC<UserEditModalProps> = ({ data, onSave, onClose, isProcessing, stores, allEmployees }) => {
    const { t } = useLocale();
    const [role, setRole] = useState<UserRole>(data.role || 'employee');
    const [areaManager, setAreaManager] = useState('');
    const [store, setStore] = useState('');

    useEffect(() => {
        if (data.status === 'pending' && data.employeeId) {
            const matchingEmployee = allEmployees.find(emp => emp.employeeId === data.employeeId);
            if (matchingEmployee?.currentStore) {
                const employeeStore = matchingEmployee.currentStore;
                setStore(employeeStore);
                const storeDetails = stores.find(s => s.name === employeeStore);
                if (storeDetails?.areaManager) {
                    setAreaManager(storeDetails.areaManager);
                }
            }
        } else {
            setStore(data.store || '');
            setAreaManager(data.areaManager || stores.find(s => s.name === data.store)?.areaManager || '');
        }
    }, [data, allEmployees, stores]);

    const areaManagers = useMemo(() => [...new Set(stores.map(s => s.areaManager))], [stores]);
    const availableStores = useMemo(() => areaManager ? stores.filter(s => s.areaManager === areaManager) : stores, [areaManager, stores]);
    
    const userRoles: UserRole[] = ['admin', 'general_manager', 'area_manager', 'store_manager', 'employee'];

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const updatedData: Partial<UserProfile> = { role, status: 'active' };
        if (role === 'area_manager') {
            updatedData.areaManager = areaManager;
            updatedData.store = '';
        } else if (role === 'store_manager' || role === 'employee') {
            updatedData.areaManager = areaManager;
            updatedData.store = store;
        }
        onSave(data.id, updatedData);
    };
    
    const buttonText = data.status === 'pending' ? t('approve_and_save') : t('save_changes');

    return (
        <div className="modal-content">
            <h2 className="modal-title">{t('edit_user')}: {data.name}</h2>
            <p className="text-sm text-gray-500 -mt-2 mb-4">{data.email} ({t('employee_id')}: {data.employeeId})</p>
            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label className="label">{t('role')}</label>
                    <select value={role} onChange={e => setRole(e.target.value as UserRole)} className="input">
                        {userRoles.map(r => <option key={r} value={r}>{r.replace(/_/g, ' ')}</option>)}
                    </select>
                </div>
                {(role === 'area_manager' || role === 'store_manager' || role === 'employee') && (
                    <div>
                        <label className="label">{t('area_manager')}</label>
                        <select value={areaManager} onChange={e => { setAreaManager(e.target.value); setStore(''); }} required className="input">
                            <option value="">{t('select_area')}</option>
                            {areaManagers.map(am => <option key={am} value={am}>{am}</option>)}
                        </select>
                    </div>
                )}
                {(role === 'store_manager' || role === 'employee') && (
                     <div>
                        <label className="label">{t('store')}</label>
                        <select value={store} onChange={e => setStore(e.target.value)} required disabled={!areaManager} className="input">
                            <option value="">{t('select_store')}</option>
                            {availableStores.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                        </select>
                    </div>
                )}
                <div className="modal-actions">
                    <button type="button" onClick={onClose} className="btn-secondary">{t('cancel')}</button>
                    <button type="submit" disabled={isProcessing} className="btn-primary">{isProcessing ? t('saving') : buttonText}</button>
                </div>
            </form>
        </div>
    );
};


interface AppMessageModalProps {
  message: AppMessage;
  onClose: () => void;
}
export const AppMessageModal: React.FC<AppMessageModalProps> = ({ message, onClose }) => {
    const { t } = useLocale();
    return (
        <div className="modal-backdrop">
            <div className="modal-content text-center">
                <h3 className="modal-title">{message.type === 'confirm' ? t('confirmation') : t('alert')}</h3>
                <p>{message.text}</p>
                <div className="modal-actions justify-center">
                    {message.type === 'confirm' && message.onConfirm && (
                        <button onClick={() => { message.onConfirm!(); onClose(); }} className="btn-danger">{t('confirm')}</button>
                    )}
                    <button onClick={onClose} className="btn-secondary">{t('close')}</button>
                </div>
            </div>
        </div>
    );
};

interface TaskModalProps extends ModalProps {
    data: EmployeeSummary; // Recipient employee
    onSave: (data: { recipientId: string, recipientName: string, title: string, message: string }) => void;
}
export const TaskModal: React.FC<TaskModalProps> = ({ data, onSave, onClose, isProcessing }) => {
    const { t } = useLocale();
    const [title, setTitle] = useState('');
    const [message, setMessage] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!title.trim() || !message.trim()) return;
        onSave({
            recipientId: data.employeeId || '',
            recipientName: data.name,
            title,
            message,
        });
    };

    return (
        <div className="modal-content">
            <h2 className="modal-title">{t('send_task_alert_to', { name: data.name })}</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label className="label">{t('title')}</label>
                    <input type="text" value={title} onChange={e => setTitle(e.target.value)} required className="input" placeholder="e.g., Follow up on VIP customer" />
                </div>
                <div>
                    <label className="label">{t('message_instructions')}</label>
                    <textarea value={message} onChange={e => setMessage(e.target.value)} required className="input h-32" placeholder="Provide details about the task..."></textarea>
                </div>
                <div className="modal-actions">
                    <button type="button" onClick={onClose} disabled={isProcessing} className="btn-secondary">{t('cancel')}</button>
                    <button type="submit" disabled={isProcessing} className="btn-primary">{isProcessing ? t('sending') : t('send_task')}</button>
                </div>
            </form>
        </div>
    );
};


// --- AI Modals ---

const AiModal: React.FC<{ title: string; children: React.ReactNode; onClose: () => void; isLoading: boolean }> = ({ title, children, onClose, isLoading }) => {
    const { t } = useLocale();
    return (
        <div className="modal-content max-w-2xl">
            <h2 className="modal-title flex items-center gap-2"><SparklesIcon /> {title}</h2>
            <div className="max-h-[60vh] overflow-y-auto pr-2">
                {isLoading ? (
                    <div className="text-center p-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600 mx-auto"></div><p className="mt-2 text-zinc-600">{t('generating_insights')}</p></div>
                ) : (
                    <div className="prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: String(children).replace(/\n/g, '<br />').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\*(.*?)\*/g, '<em>$1</em>') }}></div>
                )}
            </div>
            <div className="modal-actions"><button onClick={onClose} className="btn-secondary">{t('close')}</button></div>
        </div>
    );
};

export const AiCoachingModal: React.FC<{ data: Employee; onClose: () => void; }> = ({ data, onClose }) => {
    const { t, locale } = useLocale();
    const [analysis, setAnalysis] = useState('');
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const generate = async () => {
            const languageInstruction = locale === 'ar' ? 'Provide the response in Arabic.' : '';
            const prompt = `Generate a short, motivational coaching message for a retail employee named ${data.name}. Their current performance data is provided. Focus on one key area for improvement and provide two practical tips. Keep it positive and encouraging. ${languageInstruction} Data: ${JSON.stringify(data)}`;
            try {
                const result = await generateText({ model: 'gemini-2.5-flash', contents: [{ parts: [{ text: prompt }] }] });
                setAnalysis(result);
            } catch (e: any) { setAnalysis(`Error: ${e.message}`); }
            finally { setIsLoading(false); }
        };
        generate();
    }, [data, locale]);

    return <AiModal title={t('coaching_for', { name: data.name })} onClose={onClose} isLoading={isLoading}>{analysis}</AiModal>;
};

export const SalesForecastModal: React.FC<{ salesData: { date: string, sales: number }[]; onClose: () => void; }> = ({ salesData, onClose }) => {
    const { t, locale } = useLocale();
    const [forecast, setForecast] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    useEffect(() => {
        const generate = async () => {
            const languageInstruction = locale === 'ar' ? 'Provide the response in Arabic.' : '';
            const prompt = `Based on the following daily sales data, provide a brief trend analysis and a simple sales forecast for the next 7 days. ${languageInstruction} Data: ${JSON.stringify(salesData.slice(-30))}`;
             try {
                const result = await generateText({ model: 'gemini-2.5-flash', contents: [{ parts: [{ text: prompt }] }] });
                setForecast(result);
            } catch (e: any) { setForecast(`Error: ${e.message}`); }
            finally { setIsLoading(false); }
        };
        generate();
    }, [salesData, locale]);
    return <AiModal title={t('sales_forecast_analysis')} onClose={onClose} isLoading={isLoading}>{forecast}</AiModal>;
};

export const SalesPitchModal: React.FC<{ product: ProductSummary; onClose: () => void; }> = ({ product, onClose }) => {
    const { t, locale } = useLocale();
    const [pitch, setPitch] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    useEffect(() => {
        const generate = async () => {
            const languageInstruction = locale === 'ar' ? 'Provide the response in Arabic.' : '';
            const prompt = `Create a short, compelling sales pitch for a retail salesperson to sell the following product. Focus on 2 key benefits. ${languageInstruction} Product Name: ${product.name}, Category: ${getCategory(product)}, Price: ${product.price} SAR.`;
             try {
                const result = await generateText({ model: 'gemini-2.5-flash', contents: [{ parts: [{ text: prompt }] }] });
                setPitch(result);
            } catch (e: any) { setPitch(`Error: ${e.message}`); }
            finally { setIsLoading(false); }
        };
        generate();
    }, [product, locale]);
    return <AiModal title={t('sales_pitch_for', { name: product.name })} onClose={onClose} isLoading={isLoading}>{pitch}</AiModal>;
};

interface FullData {
    kpiData: KPIData;
    storeSummary: StoreSummary[];
    employeeSummary: { [storeName: string]: EmployeeSummary[] };
    productSummary: ProductSummary[];
}
export const NaturalLanguageSearchModal: React.FC<{ query: string; fullData: FullData; onClose: () => void; }> = ({ query, fullData, onClose }) => {
    const { t, locale } = useLocale();
    const [result, setResult] = useState('');
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const generate = async () => {
            const languageInstruction = locale === 'ar' ? 'All responses must be in Arabic.' : '';
            const dataContext = `--- DATA SNAPSHOT ---\n${JSON.stringify(fullData, null, 2)}\n--- END DATA ---`;
            const systemPrompt = `You are an expert retail analyst. Your answers must be based strictly on the provided DATA SNAPSHOT. Provide concise, actionable insights in response to the user's query. Use markdown for formatting. ${languageInstruction}`;
            const userQuery = `User Query: "${query}"`;
            
            try {
                const responseText = await generateText({
                    model: 'gemini-2.5-flash',
                    contents: [{ role: 'user', parts: [{ text: `${dataContext}\n\n${userQuery}` }] }],
                    config: { systemInstruction: systemPrompt }
                });
                setResult(responseText);
            } catch (e: any) {
                setResult(`Sorry, an error occurred: ${e.message}`);
            } finally {
                setIsLoading(false);
            }
        };
        generate();
    }, [query, fullData, locale]);

    return <AiModal title={t('results_for', { query })} onClose={onClose} isLoading={isLoading}>{result}</AiModal>;
};

type ComparisonItem = StoreSummary | EmployeeSummary;
interface AiComparisonModalProps {
    data: ComparisonItem;
    allItems: ComparisonItem[];
    type: 'store' | 'employee';
    onClose: () => void;
}
export const AiComparisonModal: React.FC<AiComparisonModalProps> = ({ data, allItems, type, onClose }) => {
    const { t, locale } = useLocale();
    const [comparisonId, setComparisonId] = useState<string>('');
    const [analysis, setAnalysis] = useState<string>('');
    const [isLoading, setIsLoading] = useState(false);

    const comparisonList = useMemo(() => allItems.filter(item => item.id !== data.id), [allItems, data.id]);

    const handleCompare = async () => {
        if (!comparisonId) return;
        const itemToCompare = allItems.find(item => item.id === comparisonId);
        if (!itemToCompare) return;

        setIsLoading(true);
        setAnalysis('');
        const languageInstruction = locale === 'ar' ? 'Provide the response in Arabic.' : '';
        const prompt = `You are a retail performance analyst. Provide a detailed comparison between these two ${type}s. Analyze their key metrics, identify the main differences in performance, and suggest reasons for these differences. Conclude with a specific recommendation for each. Use markdown formatting. ${languageInstruction}
        
        **${type === 'store' ? 'Store 1' : 'Employee 1'}:**
        ${JSON.stringify(data, null, 2)}

        **${type === 'store' ? 'Store 2' : 'Employee 2'}:**
        ${JSON.stringify(itemToCompare, null, 2)}`;
        
        try {
            const result = await generateText({ model: 'gemini-2.5-flash', contents: [{ parts: [{ text: prompt }] }] });
            setAnalysis(result);
        } catch (e: any) {
            setAnalysis(`Error generating comparison: ${e.message}`);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="modal-content max-w-2xl">
            <h2 className="modal-title flex items-center gap-2"><SparklesIcon /> {t('ai_comparison')}</h2>
            <div className="space-y-4">
                <div>
                    <label className="label">{t('comparing')}</label>
                    <p className="font-bold text-lg">{data.name}</p>
                </div>
                <div>
                    <label className="label">{t('with')}</label>
                    <div className="flex gap-2">
                        <select value={comparisonId} onChange={e => setComparisonId(e.target.value)} className="input flex-grow">
                            <option value="">{t(type === 'store' ? 'select_store' : 'add_employee')}</option>
                            {comparisonList.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
                        </select>
                        <button onClick={handleCompare} disabled={!comparisonId || isLoading} className="btn-primary">{t('compare')}</button>
                    </div>
                </div>
                
                {(isLoading || analysis) && (
                    <div className="mt-4 border-t pt-4">
                        {isLoading ? (
                            <div className="text-center p-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600 mx-auto"></div><p className="mt-2 text-zinc-600">{t('generating_comparison')}</p></div>
                        ) : (
                            <div className="max-h-[40vh] overflow-y-auto pr-2 prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: analysis.replace(/\n/g, '<br />').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }}></div>
                        )}
                    </div>
                )}
            </div>
            <div className="modal-actions">
                <button onClick={onClose} className="btn-secondary">{t('close')}</button>
            </div>
        </div>
    );
};

interface AiPredictionModalProps extends ModalProps {
    data: { store: StoreSummary; allMetrics: DailyMetric[] };
}
export const AiPredictionModal: React.FC<AiPredictionModalProps> = ({ data, onClose }) => {
    const { t, locale } = useLocale();
    const { store, allMetrics } = data;
    const [result, setResult] = useState<PredictionResult | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const predict = async () => {
            setIsLoading(true);
            setError(null);
            try {
                // generatePrediction internally calls Gemini, so it needs to be made locale-aware.
                // For simplicity here, I will assume generatePrediction is updated or I update the prompt inside it.
                // Let's modify the prompt inside generatePrediction in geminiService.ts instead.
                const prediction = await generatePrediction(store, allMetrics, locale);
                setResult(prediction);
            } catch (e: any) {
                setError(e.message || "An unknown error occurred during prediction.");
                console.error(e);
            } finally {
                setIsLoading(false);
            }
        };
        predict();
    }, [store, allMetrics, locale]);

    const getRiskColor = (score: number) => {
        if (score > 60) return 'text-red-600';
        if (score > 30) return 'text-yellow-600';
        return 'text-green-600';
    };

    return (
        <div className="modal-content max-w-lg">
            <h2 className="modal-title flex items-center gap-2"><SparklesIcon /> {t('predictive_analysis_for')} {store.name}</h2>
            {isLoading ? (
                <div className="text-center p-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600 mx-auto"></div>
                    <p className="mt-2 text-zinc-600">{t('generating_prediction')}</p>
                </div>
            ) : error ? (
                 <div className="p-4 bg-red-100 text-red-700 rounded-lg">
                    <h4 className="font-bold">{t('error')}</h4>
                    <p>{error}</p>
                </div>
            ) : result && (
                <div className="space-y-4">
                    <div className="text-center p-4 bg-gray-50 rounded-lg">
                        <p className="text-sm font-semibold text-zinc-500">{t('risk_score_target')}</p>
                        <p className={`text-6xl font-bold ${getRiskColor(result.riskScore)}`}>{result.riskScore}<span className="text-2xl">%</span></p>
                    </div>
                    <div className="space-y-2 text-sm">
                        <div className="flex justify-between p-2 rounded bg-gray-50">
                            <span className="font-semibold text-zinc-600">{t('ai_predicted_sales')}</span>
                            <span className="font-bold">{result.predictedSales.toLocaleString('en-US', { style: 'currency', currency: 'SAR', maximumFractionDigits: 0 })}</span>
                        </div>
                        <div className="flex justify-between p-2 rounded bg-gray-50">
                            <span className="font-semibold text-zinc-600">{t('current_month_target')}</span>
                            <span className="font-bold">{store.effectiveTarget.toLocaleString('en-US', { style: 'currency', currency: 'SAR', maximumFractionDigits: 0 })}</span>
                        </div>
                    </div>
                    <div>
                        <p className="text-sm font-semibold text-zinc-600 mb-1">{t('ai_justification')}</p>
                        <p className="p-3 bg-blue-50 text-blue-800 rounded-lg text-sm">{result.justification}</p>
                    </div>
                </div>
            )}
            <div className="modal-actions"><button onClick={onClose} className="btn-secondary">{t('close')}</button></div>
        </div>
    );
};

interface KPIBreakdownModalProps extends ModalProps {
  data: {
    title: string;
    kpi: string;
    data: any[];
  };
}
export const KPIBreakdownModal: React.FC<KPIBreakdownModalProps> = ({ data: modalData, onClose }) => {
    const { t } = useLocale();
    const { title, kpi, data: chartData } = modalData;

    // Simple breakdown for sales by store
    if (kpi === 'totalSales' && chartData[0]?.areaManager) { // check if it's store data
        return (
            <div className="modal-content max-w-2xl">
                <h2 className="modal-title">{title} Breakdown</h2>
                <div className="h-96">
                    <ChartCard title={t('sales_by_store')}>
                         <BarChart data={chartData} dataKey="totalSales" nameKey="name" format={val => val.toLocaleString('en-US', { style: 'currency', currency: 'SAR', maximumFractionDigits: 0 })} />
                    </ChartCard>
                </div>
                <div className="modal-actions"><button onClick={onClose} className="btn-secondary">{t('close')}</button></div>
            </div>
        );
    }

    // Default view for other KPIs
    return (
        <div className="modal-content">
             <h2 className="modal-title">{title}</h2>
             <p>Detailed breakdown for this KPI is not yet available.</p>
             <div className="modal-actions"><button onClick={onClose} className="btn-secondary">{t('close')}</button></div>
        </div>
    );
};

// === Product Details Modal ===
interface ProductDetailsModalProps extends ModalProps {
  data: {
    product: ProductSummary;
    allData: any[]; // filtered sales data in scope
    stores: Store[];
  };
}

export const ProductDetailsModal: React.FC<ProductDetailsModalProps> = ({ data, onClose }) => {
  const { product, allData, stores } = data;
  const [branch, setBranch] = useState<string>('All');
  const [ai, setAi] = useState<string>('');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const normalize = (v: any) => String(v ?? '').trim().toUpperCase();
  useEffect(() => { console.log('✅ Stage 4 Completed — Ready for Next Step'); }, []);

  const filteredSales = useMemo(() => {
    const set = new Set(stores.filter(s => branch === 'All' || s.name === branch).map(s => s.name));
    const targetAlias = normalize(product.alias);
    const targetName = normalize(product.name);
    return (allData as any[]).filter(s => {
      if (!s || !set.has(s['Outlet Name'])) return false;
      const alias = normalize(s['Item Alias']);
      const name = normalize(s['Item Name']);
      return alias === targetAlias || name === targetName;
    });
  }, [allData, product.alias, product.name, stores, branch]);

  const monthlyTrend = useMemo(() => {
    const arr = Array.from({ length: 12 }, (_, i) => ({ name: new Date(0, i).toLocaleString('en-US', { month: 'short' }), Sales: 0, Target: 0 }));
    const activeYear = filteredSales[0]?.['Bill Dt.']?.toDate?.()?.getUTCFullYear?.() ?? new Date().getUTCFullYear();
    filteredSales.forEach(s => {
      const d = s['Bill Dt.'].toDate();
      if (d.getUTCFullYear() !== activeYear) return;
      const val = Number(s['Sold Qty'] || 0) * Number(s['Item Rate'] || 0);
      arr[d.getUTCMonth()].Sales += val;
    });
    return arr;
  }, [filteredSales]);

  const totals = useMemo(() => {
    const qty = filteredSales.reduce((sum, s) => sum + Number(s['Sold Qty'] || 0), 0);
    const value = filteredSales.reduce((sum, s) => sum + Number(s['Sold Qty'] || 0) * Number(s['Item Rate'] || 0), 0);
    return { qty, value };
  }, [filteredSales]);

  const coSelling = useMemo(() => {
    // collect by bill_no (fallback warns) with strict equality on alias/name
    const byTxn = new Map<string, { key: string; aliasRaw: string; nameRaw: string }[]>();
    const details = new Map<string, { alias: string; name: string }>();
    (allData as any[]).forEach(s => {
      const d = s['Bill Dt.']?.toDate?.();
      if (!d) return;
      const billNo = (s.bill_no || s['Bill_No'] || s['Invoice'] || s['Transaction_ID'] || s['Bill Number'] || s['Invoice No'] || '').toString();
      const groupKey = billNo
        ? String(billNo)
        : `${d.getUTCFullYear()}-${d.getUTCMonth()}-${d.getUTCDate()}|${s['Outlet Name']}|${s['SalesMan Name'] || ''}`;
      if (!billNo) console.warn('⚠ Missing Bill_No, using fallback mode');
      const aliasRaw = String(s['Item Alias'] || '').trim();
      const nameRaw = String(s['Item Name'] || '').trim();
      const aliasNorm = normalize(aliasRaw);
      const nameNorm = normalize(nameRaw);
      const key = aliasNorm || nameNorm;
      if (key) {
        if (!details.has(key)) details.set(key, { alias: aliasRaw, name: nameRaw });
        const arr = byTxn.get(groupKey) || [];
        arr.push({ key, aliasRaw, nameRaw });
        byTxn.set(groupKey, arr);
      }
    });
    const targetAlias = normalize(product.alias);
    const targetName = normalize(product.name);
    const counts = new Map<string, number>();
    let invoicesWithTarget = 0;
    byTxn.forEach(items => {
      const uniqKeys = Array.from(new Set(items.map(i => i.key)));
      const hasTarget = uniqKeys.includes(targetAlias) || uniqKeys.includes(targetName);
      if (!hasTarget) return;
      invoicesWithTarget++;
      uniqKeys.forEach(k => {
        if (k === targetAlias || k === targetName) return;
        counts.set(k, (counts.get(k) || 0) + 1);
      });
    });
    const top = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([key, count]) => ({ key, count, alias: details.get(key)?.alias || '', name: details.get(key)?.name || '' }));
    return { top, invoicesWithTarget };
  }, [allData, product]);

  const runAi = async () => {
    setIsAiLoading(true);
    try {
      const { top, invoicesWithTarget } = coSelling;
      if (!invoicesWithTarget || invoicesWithTarget < 3 || top.length === 0) {
        setAi('لا توجد بيانات كافية لإصدار توصية دقيقة.');
      } else {
        const withPerc = top.map(t => ({ key: t.key, count: t.count, pct: Math.round((t.count / invoicesWithTarget) * 100) }));
        const context = `يعتمد هذا التحليل على bill_no فقط. عدد الفواتير التي ظهر فيها المنتج: ${invoicesWithTarget}.\nأفضل ارتباطات: ${withPerc.map(w => `${w.key}: ${w.count} (${w.pct}%)`).join(', ')}`;
        const prompt = `أنت نظام توصية يعتمد بالكامل على رقم الفاتورة bill_no.
المنتج: ${product.name} (الكود ${product.alias}).
${context}
اكتب 2-3 توصيات عملية ومباشرة بالعربية، مثل: "ينباع عادةً مع X بناءً على بيانات الفواتير"، واذكر النِسَب %. تجنب أي استدلالات لا تعتمد على bill_no.`;
        const txt = await generateText({ model: 'gemini-2.5-flash', contents: [{ parts: [{ text: prompt }] }] });
        setAi(txt);
      }
    } catch (e: any) { setAi(`تعذر توليد التوصية: ${e?.message || e}`); }
    finally { setIsAiLoading(false); }
  };

  const exportCsv = () => {
    const rows = [
      ['Product', product.name],
      ['Code', product.alias],
      ['Unit Price', String(product.price)],
      [],
      ['Month', 'Sales Value'],
      ...monthlyTrend.map(m => [m.name, String(m.Sales)])
    ];
    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${product.alias}_insights.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="modal-content max-w-3xl">
      <h2 className="modal-title flex items-center gap-2">Product Details — {product.name}</h2>
      <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
        {/* Overview */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-gray-50 p-4 rounded-lg border">
          <div><div className="text-xs text-zinc-500">Code</div><div className="font-semibold">{product.alias}</div></div>
          <div><div className="text-xs text-zinc-500">Unit Price</div><div className="font-semibold">{product.price.toLocaleString('en-US', { style: 'currency', currency: 'SAR', maximumFractionDigits: 0 })}</div></div>
          <div><div className="text-xs text-zinc-500">Total Qty</div><div className="font-semibold">{totals.qty.toLocaleString('en-US')}</div></div>
          <div><div className="text-xs text-zinc-500">Total Value</div><div className="font-semibold">{totals.value.toLocaleString('en-US', { style: 'currency', currency: 'SAR', maximumFractionDigits: 0 })}</div></div>
        </div>

        {/* Branch Filter */}
        <div className="flex items-center gap-2">
          <label className="label">Branch</label>
          <select value={branch} onChange={e => setBranch(e.target.value)} className="input w-56">
            <option value="All">All</option>
            {stores.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
          </select>
        </div>

        {/* Sales Performance */}
        <ChartCard title="Monthly Trend (This Year)">
          <BarChart data={monthlyTrend} dataKey="Sales" nameKey="name" format={v => v.toLocaleString('en-US', { style: 'currency', currency: 'SAR', maximumFractionDigits: 0 })} />
        </ChartCard>

        {/* Cross-selling */}
        <div className="bg-white p-4 rounded-xl shadow-sm border">
          <h3 className="font-semibold mb-2">Sold With (Top 3)</h3>
          <ul className="list-disc ms-5 text-sm text-zinc-700">
            {coSelling.top.length === 0 && <li>لا يوجد بيانات كافية</li>}
            {coSelling.top.map(c => <li key={c.key}>{c.alias || c.key} — {c.name} ({c.count})</li>)}
          </ul>
        </div>

        {/* AI Recommendation */}
        <div className="bg-blue-50 p-4 rounded-xl border border-blue-200 text-blue-900">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">AI Recommendation</h3>
            <button onClick={runAi} className="btn-primary text-sm" disabled={isAiLoading}>{isAiLoading ? 'Generating...' : 'Generate'}</button>
          </div>
          {ai && <div className="mt-2 whitespace-pre-wrap text-sm">{ai}</div>}
        </div>

        {/* Export */}
        <div className="flex justify-end">
          <button onClick={exportCsv} className="btn-secondary">📤 Export Insights</button>
        </div>
      </div>
      <div className="modal-actions"><button onClick={onClose} className="btn-secondary">Close</button></div>
    </div>
  );
};
