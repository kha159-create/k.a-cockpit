import React, { useState } from 'react';
import { TrashIcon } from './Icons';
import type { BusinessRule } from '../types';

interface CustomBusinessRulesProps {
    rules: BusinessRule[];
    onSave: (rule: string) => void;
    onDelete: (id: string) => void;
    isProcessing: boolean;
}

const CustomBusinessRules: React.FC<CustomBusinessRulesProps> = ({ rules, onSave, onDelete, isProcessing }) => {
    const [newRule, setNewRule] = useState('');

    const handleSave = () => {
        if (!newRule.trim()) return;
        onSave(newRule);
        setNewRule('');
    };

    return (
        <div className="bg-white p-6 rounded-xl shadow-sm border">
            <h3 className="text-xl font-semibold text-zinc-700 mb-2">Custom Business Rules</h3>
            <p className="text-sm text-zinc-500 mb-4">Add rules for the AI assistant 'Hassan' to remember across all conversations. (e.g., "The ATV target for Al-Noor Mall is 300 SAR")</p>
            
            <div className="flex gap-2 mb-4">
                <input 
                    type="text" 
                    value={newRule}
                    onChange={(e) => setNewRule(e.target.value)}
                    placeholder="Enter a new business rule..."
                    className="input flex-grow"
                />
                <button onClick={handleSave} disabled={isProcessing} className="btn-primary">
                    {isProcessing ? 'Saving...' : 'Save Rule'}
                </button>
            </div>

            <div className="space-y-2">
                <h4 className="font-semibold text-zinc-600">Saved Rules:</h4>
                {rules.length === 0 ? (
                    <p className="text-sm text-zinc-400">No custom rules saved yet.</p>
                ) : (
                    <ul className="divide-y divide-gray-200">
                        {rules.map(rule => (
                            <li key={rule.id} className="py-2 flex justify-between items-center">
                                <span className="text-sm text-zinc-800">{rule.rule}</span>
                                <button onClick={() => onDelete(rule.id)} className="text-red-500 hover:text-red-700">
                                    <TrashIcon />
                                </button>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </div>
    );
};

export default CustomBusinessRules;
