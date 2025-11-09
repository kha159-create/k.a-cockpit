import React, { useEffect, useMemo, useState } from 'react';
import { TrashIcon } from './Icons';
import type { BusinessRule, StoreSummary } from '../types';

const STORE_RULE_MARKER = 'STORE_RULE_JSON=';

type StoreRuleValues = {
    atvTarget: string;
    conversionRate: string;
    salesPerVisitor: string;
};

interface CustomBusinessRulesProps {
    rules: BusinessRule[];
    stores: StoreSummary[];
    onSave: (rule: string, existingId?: string) => void;
    onDelete: (id: string) => void;
    isProcessing: boolean;
}

const parseStoreRules = (rules: BusinessRule[]) => {
    const map = new Map<string, { id: string; values: StoreRuleValues }>();
    rules.forEach(rule => {
        const text = rule?.rule ?? '';
        if (!text) return;
        const markerIndex = text.indexOf(STORE_RULE_MARKER);
        if (markerIndex === -1) return;
        const jsonString = text.slice(markerIndex + STORE_RULE_MARKER.length).trim();
        try {
            const parsed = JSON.parse(jsonString);
            if (parsed && typeof parsed === 'object' && parsed.store) {
                map.set(parsed.store, {
                    id: rule.id,
                    values: {
                        atvTarget: parsed.atvTarget !== undefined ? String(parsed.atvTarget) : '',
                        conversionRate: parsed.conversionRate !== undefined ? String(parsed.conversionRate) : '',
                        salesPerVisitor: parsed.salesPerVisitor !== undefined ? String(parsed.salesPerVisitor) : '',
                    },
                });
            }
        } catch (error) {
            console.warn('Failed to parse store business rule JSON', error);
        }
    });
    return map;
};

const buildStoreRuleString = (storeName: string, values: StoreRuleValues) => {
    const atv = Number(values.atvTarget) || 0;
    const conversion = Number(values.conversionRate) || 0;
    const spv = Number(values.salesPerVisitor) || 0;
    const friendlyText = `متجر ${storeName}: متوسط الفاتورة المستهدف ${atv.toFixed(2)} ريال، معدل التحويل المطلوب ${conversion.toFixed(2)}٪، والمبيعات لكل زائر ${spv.toFixed(2)} ريال. التزم بهذه الحدود عند تقديم التوصيات.`;
    const metadata = JSON.stringify({
        store: storeName,
        atvTarget: atv,
        conversionRate: conversion,
        salesPerVisitor: spv,
    });
    return `${friendlyText} || ${STORE_RULE_MARKER}${metadata}`;
};

const CustomBusinessRules: React.FC<CustomBusinessRulesProps> = ({ rules, stores, onSave, onDelete, isProcessing }) => {
    const [newRule, setNewRule] = useState('');

    const storeRulesMap = useMemo(() => parseStoreRules(rules), [rules]);
    const generalRules = useMemo(
        () => rules.filter(rule => !(rule?.rule ?? '').includes(STORE_RULE_MARKER)),
        [rules]
    );

    const initialStoreState = useMemo(() => {
        const base: Record<string, StoreRuleValues> = {};
        stores.forEach(store => {
            const existing = storeRulesMap.get(store.name);
            base[store.name] = existing
                ? existing.values
                : { atvTarget: '', conversionRate: '', salesPerVisitor: '' };
        });
        return base;
    }, [stores, storeRulesMap]);

    const [storeForm, setStoreForm] = useState<Record<string, StoreRuleValues>>(initialStoreState);

    useEffect(() => {
        setStoreForm(initialStoreState);
    }, [initialStoreState]);

    const handleStoreFieldChange = (storeName: string, field: keyof StoreRuleValues, value: string) => {
        setStoreForm(prev => ({
            ...prev,
            [storeName]: {
                ...prev[storeName],
                [field]: value,
            },
        }));
    };

    const handleStoreSave = (storeName: string) => {
        const values = storeForm[storeName] || { atvTarget: '', conversionRate: '', salesPerVisitor: '' };
        const isEmpty = !values.atvTarget.trim() && !values.conversionRate.trim() && !values.salesPerVisitor.trim();
        const existing = storeRulesMap.get(storeName);
        if (isEmpty) {
            if (existing) {
                onSave('', existing.id);
            }
            return;
        }
        const ruleString = buildStoreRuleString(storeName, values);
        onSave(ruleString, existing?.id);
    };

    const handleStoreReset = (storeName: string) => {
        setStoreForm(prev => ({
            ...prev,
            [storeName]: { atvTarget: '', conversionRate: '', salesPerVisitor: '' },
        }));
        const existing = storeRulesMap.get(storeName);
        if (existing) {
            onSave('', existing.id);
        }
    };

    const handleSaveGeneralRule = () => {
        if (!newRule.trim()) return;
        onSave(newRule.trim());
        setNewRule('');
    };

    return (
        <div className="bg-white p-6 rounded-xl shadow-sm border">
            <h3 className="text-xl font-semibold text-zinc-700 mb-2">Custom Business Rules</h3>
            <p className="text-sm text-zinc-500 mb-6">
                حدّد الأهداف الذكية لكل معرض ليستخدمها المساعد حسن تلقائياً، ويمكنك إضافة قواعد عامة أيضاً لتوجيه التحليلات المستقبلية.
            </p>

            <div className="space-y-5">
                <section>
                    <h4 className="font-semibold text-zinc-700 mb-3">أهداف كل معرض (تقرأها الذكاء لحظة التحليل)</h4>
                    <div className="space-y-4 max-h-[420px] overflow-y-auto pr-1">
                        {stores.map(store => {
                            const formValues = storeForm[store.name] || { atvTarget: '', conversionRate: '', salesPerVisitor: '' };
                            const hasExistingRule = Boolean(storeRulesMap.get(store.name));
                            return (
                                <div key={store.name} className="border border-zinc-200 rounded-lg p-4 bg-zinc-50">
                                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                                        <div>
                                            <h5 className="font-semibold text-zinc-800 text-lg">{store.name}</h5>
                                            <p className="text-xs text-zinc-500">
                                                حدّد أهداف هذا المعرض ليتم تطبيقها في استنتاجات حسن (ريال سعودي / نسب مئوية).
                                            </p>
                                        </div>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => handleStoreSave(store.name)}
                                                disabled={isProcessing}
                                                className="btn-primary text-sm"
                                            >
                                                {isProcessing ? 'جاري الحفظ...' : 'حفظ الأهداف'}
                                            </button>
                                            {hasExistingRule && (
                                                <button
                                                    onClick={() => handleStoreReset(store.name)}
                                                    disabled={isProcessing}
                                                    className="btn-secondary text-sm"
                                                >
                                                    إعادة التعيين
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                    <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                                        <div>
                                            <label className="label text-xs uppercase tracking-wide text-zinc-500">
                                                ATV Target (SAR)
                                            </label>
                                            <input
                                                type="number"
                                                min="0"
                                                step="0.01"
                                                value={formValues.atvTarget}
                                                onChange={e => handleStoreFieldChange(store.name, 'atvTarget', e.target.value)}
                                                className="input"
                                                placeholder="مثال: 350"
                                            />
                                        </div>
                                        <div>
                                            <label className="label text-xs uppercase tracking-wide text-zinc-500">
                                                Conversion Rate (%)
                                            </label>
                                            <input
                                                type="number"
                                                min="0"
                                                step="0.01"
                                                value={formValues.conversionRate}
                                                onChange={e => handleStoreFieldChange(store.name, 'conversionRate', e.target.value)}
                                                className="input"
                                                placeholder="مثال: 18"
                                            />
                                        </div>
                                        <div>
                                            <label className="label text-xs uppercase tracking-wide text-zinc-500">
                                                Sales per Visitor (SAR)
                                            </label>
                                            <input
                                                type="number"
                                                min="0"
                                                step="0.01"
                                                value={formValues.salesPerVisitor}
                                                onChange={e => handleStoreFieldChange(store.name, 'salesPerVisitor', e.target.value)}
                                                className="input"
                                                placeholder="مثال: 95"
                                            />
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                        {stores.length === 0 && (
                            <p className="text-sm text-zinc-500">لم يتم العثور على قائمة المعارض. تأكد من تحميل بياناتها أولاً.</p>
                        )}
                    </div>
                </section>

                <section className="pt-4 border-t border-zinc-200">
                    <h4 className="font-semibold text-zinc-700 mb-3">قواعد عامة إضافية</h4>
                    <p className="text-xs text-zinc-500 mb-2">
                        استخدم هذه المساحة لإضافة تعليمات عامة يريد حسن اتباعها دائماً (مثال: “الترويج للألحفة الفاخرة له أولوية في ديسمبر”).
                    </p>
                    <div className="flex gap-2 mb-4">
                        <input
                            type="text"
                            value={newRule}
                            onChange={(e) => setNewRule(e.target.value)}
                            placeholder="أدخل قاعدة جديدة..."
                            className="input flex-grow"
                        />
                        <button onClick={handleSaveGeneralRule} disabled={isProcessing} className="btn-primary">
                            {isProcessing ? 'جاري الحفظ...' : 'إضافة قاعدة'}
                        </button>
                    </div>

                    <div className="space-y-2">
                        {generalRules.length === 0 ? (
                            <p className="text-sm text-zinc-400">لا توجد قواعد عامة محفوظة.</p>
                        ) : (
                            <ul className="divide-y divide-gray-200">
                                {generalRules.map(rule => (
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
                </section>
            </div>
        </div>
    );
};

export default CustomBusinessRules;
