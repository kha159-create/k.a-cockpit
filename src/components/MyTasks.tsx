import React from 'react';
import { parseDateValue } from '../utils/date';
import type { Task } from '../types.js';
import { useLocale } from '../context/LocaleContext.js';

interface MyTasksProps {
    tasks: Task[];
    onUpdateStatus: (taskId: string, status: 'completed') => void;
    isProcessing: boolean;
}

const TaskItem: React.FC<{ task: Task; onUpdateStatus: (taskId: string, status: 'completed') => void; isProcessing: boolean; }> = ({ task, onUpdateStatus, isProcessing }) => {
    const { t, locale } = useLocale();
    const createdAt = parseDateValue(task.createdAt);
    const dateOptions: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'short', day: 'numeric' };

    return (
        <div className="p-4 bg-gray-50 rounded-lg border shadow-sm transition-all hover:shadow-md">
            <div className="flex justify-between items-start">
                <div>
                    <p className="font-bold text-zinc-800">{task.title}</p>
                    <p className="text-xs text-zinc-500">{t('from')}: {task.senderName} • {createdAt ? createdAt.toLocaleDateString(locale, dateOptions) : ''}</p>
                </div>
                {task.status === 'pending' && (
                    <button 
                        onClick={() => onUpdateStatus(task.id, 'completed')} 
                        disabled={isProcessing}
                        className="btn-secondary text-xs py-1 px-2"
                    >
                        {t('mark_complete')}
                    </button>
                )}
            </div>
            <p className="mt-2 text-sm text-zinc-700">{task.message}</p>
        </div>
    );
};

const MyTasks: React.FC<MyTasksProps> = ({ tasks, onUpdateStatus, isProcessing }) => {
    const { t } = useLocale();

    const pendingTasks = tasks.filter(t => t.status === 'pending');
    const completedTasks = tasks.filter(t => t.status === 'completed').slice(0, 5); // Show last 5 completed

    return (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <h3 className="text-xl font-semibold text-zinc-800 mb-4">{t('my_tasks_and_alerts')}</h3>
            
            {tasks.length === 0 ? (
                <p className="text-center text-zinc-500 py-4">{t('no_tasks')}</p>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <h4 className="font-semibold text-zinc-700 mb-2">{t('pending_tasks')} ({pendingTasks.length})</h4>
                        <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
                            {pendingTasks.length > 0 ? (
                                pendingTasks.map(task => <TaskItem key={task.id} task={task} onUpdateStatus={onUpdateStatus} isProcessing={isProcessing} />)
                            ) : (
                                <p className="text-sm text-zinc-500">{t('all_tasks_completed')}</p>
                            )}
                        </div>
                    </div>
                    <div>
                        <h4 className="font-semibold text-zinc-700 mb-2">{t('recently_completed')}</h4>
                        <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
                            {completedTasks.length > 0 ? (
                                 completedTasks.map(task => <TaskItem key={task.id} task={task} onUpdateStatus={onUpdateStatus} isProcessing={isProcessing} />)
                            ) : (
                                <p className="text-sm text-zinc-500">{t('no_tasks_completed')}</p>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default MyTasks;
