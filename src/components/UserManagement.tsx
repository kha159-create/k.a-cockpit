import React, { useMemo } from 'react';
import { useLocale } from '../context/LocaleContext';
import { Table, Column } from './Table';
import type { UserProfile, ModalState } from '../types';
import { PencilIcon } from './Icons';

interface UserManagementProps {
    profile: UserProfile | null;
    allUsers: (UserProfile & { id: string })[];
    setModalState: React.Dispatch<React.SetStateAction<ModalState>>;
    onDeleteUser?: (userId: string, userName: string) => void;
}

const UserManagement: React.FC<UserManagementProps> = ({ profile, allUsers, setModalState, onDeleteUser }) => {
    const { t } = useLocale();

    const { pendingUsers, activeUsers } = useMemo(() => {
        const pending: (UserProfile & { id: string })[] = [];
        const active: (UserProfile & { id: string })[] = [];
        allUsers.forEach(user => {
            if (user.status === 'pending') {
                pending.push(user);
            } else {
                active.push(user);
            }
        });
        return { pendingUsers: pending, activeUsers: active };
    }, [allUsers]);

    if (profile?.role !== 'admin' && profile?.role !== 'general_manager') {
        return null;
    }

    const handleEditUser = (user: UserProfile & { id: string }) => {
        setModalState({ type: 'userEdit', data: user });
    };

    const handleDeleteUser = (user: UserProfile & { id: string }) => {
        if (onDeleteUser && user.id !== profile?.id) { // Prevent self-deletion
            onDeleteUser(user.id, user.name);
        }
    };

    const baseColumns: Column<UserProfile & { id: string }>[] = [
        { key: 'name', label: t('name'), sortable: true },
        { key: 'email', label: t('email_or_id'), sortable: true },
        { key: 'employeeId', label: t('employee_id'), sortable: true },
    ];
    
    const pendingColumns: Column<UserProfile & { id: string }>[] = [
        ...baseColumns,
        {
            key: 'actions',
            label: 'Actions',
            render: (item) => (
                <button onClick={() => handleEditUser(item)} className="btn-primary text-sm py-1 px-3">
                    {t('approve')}
                </button>
            )
        }
    ];

    const activeColumns: Column<UserProfile & { id: string }>[] = [
        ...baseColumns,
        { key: 'role', label: t('role'), sortable: true },
        { key: 'store', label: t('store'), sortable: true },
        {
            key: 'actions',
            label: 'Actions',
            render: (item) => (
                <div className="flex items-center gap-2">
                    <button onClick={() => handleEditUser(item)} className="text-blue-600 hover:text-blue-800 p-1" title="Edit">
                        <PencilIcon />
                    </button>
                    {onDeleteUser && item.id !== profile?.id && (
                        <button 
                            onClick={() => handleDeleteUser(item)} 
                            className="text-red-600 hover:text-red-800 p-1" 
                            title="Delete User"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                        </button>
                    )}
                </div>
            )
        }
    ];


    return (
        <div className="bg-white p-6 rounded-xl shadow-sm border space-y-8">
            <h3 className="text-xl font-semibold text-zinc-700">{t('user_management')}</h3>

            <div>
                <h4 className="font-semibold text-zinc-600 mb-2">{t('pending_approvals')}</h4>
                {pendingUsers.length > 0 ? (
                    <Table columns={pendingColumns} data={pendingUsers} />
                ) : (
                    <p className="text-sm text-gray-500 bg-gray-50 p-4 rounded-md">No users are currently awaiting approval.</p>
                )}
            </div>

            <div>
                <h4 className="font-semibold text-zinc-600 mb-2">{t('all_users')}</h4>
                <Table columns={activeColumns} data={activeUsers} initialSortKey="name"/>
            </div>
        </div>
    );
};
export default UserManagement;
