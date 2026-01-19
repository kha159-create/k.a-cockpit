import React, { useEffect, useMemo, useState } from 'react';
import { TrashIcon } from './Icons';
import type { BusinessRule, StoreSummary } from '../types';
import { useLocale } from '../context/LocaleContext';

const STORE_RULE_MARKER = 'STORE_RULE_JSON=';

type StoreRuleValues = {
    atvTarget: string;
    conversionRate: string;
    salesPerVisitor: string;
};

interface CustomBusinessRulesProps {
    rules: BusinessRule[];
    stores?: StoreSummary[];
    onSave: (rule: string, existingId?: string) => void;
    onDelete: (id: string) => void;
    isProcessing: boolean;
    showGeneralRules?: boolean;
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

const buildStoreRuleString = (storeName: string, values: StoreRuleValues, locale: string) => {
    const atv = Number(values.atvTarget) || 0;
    const conversion = Number(values.conversionRate) || 0;
    const spv = Number(values.salesPerVisitor) || 0;
    const friendlyText =
        locale === 'ar'
            ? `متجر ${storeName}: متوسط الفاتورة المستهدف ${Math.round(atv)} ريال، معدل التحويل المطلوب ${Math.round(conversion)}٪، والمبيعات لكل زائر ${Math.round(spv)} ريال. التزم بهذه الحدود عند تقديم التوصيات.`
            : `Store ${storeName}: target ATV ${Math.round(atv)} SAR, required conversion ${Math.round(conversion)}%, and sales per visitor ${Math.round(spv)} SAR. Follow these limits in all insights.`;
    const metadata = JSON.stringify({
        store: storeName,
        atvTarget: atv,
        conversionRate: conversion,
        salesPerVisitor: spv,
    });
    return `${friendlyText} || ${STORE_RULE_MARKER}${metadata}`;
};

const CustomBusinessRules: React.FC<CustomBusinessRulesProps> = ({
    rules,
    stores = [],
    onSave,
    onDelete,
    isProcessing,
    showGeneralRules = true,
}) => {
    const [newRule, setNewRule] = useState('');
    const { locale } = useLocale();

    const strings = useMemo(() => {
        if (locale === 'ar') {
            return {
                cardTitle: 'قواعد الأعمال المخصصة',
                cardSubtitle: 'حدّد أهداف كل معرض ليستخدمها المساعد حسن تلقائياً، ويمكنك إضافة قواعد عامة لتوجيه التحليلات.',
                storeSectionTitle: 'أهداف هذا المعرض (تُستخدم فوراً بواسطة حسن)',
                storeSectionEmpty: 'لم يتم العثور على قائمة المعارض. تأكد من تحميل بياناتها أولاً.',
                storeHint: 'حدّد الأهداف الأساسية لهذا المعرض (ريال سعودي / نسب مئوية).',
                saveStore: 'حفظ الأهداف',
                saving: 'جاري الحفظ...',
                resetStore: 'إعادة التعيين',
                atvLabel: 'ATV Avg (ريال)',
                conversionLabel: 'Conversion Rate (%)',
                spvLabel: 'Sales per Visitor (ريال)',
                atvPlaceholder: 'مثال: 350',
                conversionPlaceholder: 'مثال: 18',
                spvPlaceholder: 'مثال: 95',
                generalTitle: 'قواعد عامة إضافية',
                generalHint: 'أضف تعليمات عامة يريد حسن الالتزام بها دائمًا (مثال: “ركز على المنتجات الموسمية”).',
                generalPlaceholder: 'أدخل قاعدة جديدة...',
                addRule: 'إضافة قاعدة',
                savingRule: 'جاري الحفظ...',
                noGeneralRules: 'لا توجد قواعد عامة محفوظة.',
            } as const;
        }
        return {
            cardTitle: 'Custom Business Rules',
            cardSubtitle:
                'Set store-level targets Hassan will follow automatically. You can still add global reminders for future analyses.',
            storeSectionTitle: 'Store Targets (Hassan follows these instantly)',
            storeSectionEmpty: 'No stores found. Please upload store data first.',
            storeHint: 'Define the key targets for this store (SAR / percentages).',
            saveStore: 'Save Targets',
            saving: 'Saving...',
            resetStore: 'Reset',
            atvLabel: 'ATV Avg (SAR)',
            conversionLabel: 'Conversion Rate (%)',
            spvLabel: 'Sales per Visitor (SAR)',
            atvPlaceholder: 'e.g. 350',
            conversionPlaceholder: 'e.g. 18',
            spvPlaceholder: 'e.g. 95',
            generalTitle: 'Additional Global Rules',
            generalHint:
                'Add global instructions Hassan should always follow (e.g. “Highlight premium bundles during December”).',
            generalPlaceholder: 'Enter a new rule...',
            addRule: 'Add Rule',
            savingRule: 'Saving...',
            noGeneralRules: 'No general rules saved yet.',
        } as const;
    }, [locale]);

    const storeRulesMap = useMemo(() => parseStoreRules(rules), [rules]);
    const generalRules = useMemo(
        () => (showGeneralRules ? rules.filter(rule => !(rule?.rule ?? '').includes(STORE_RULE_MARKER)) : []),
        [rules, showGeneralRules]
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
        const ruleString = buildStoreRuleString(storeName, values, locale);
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
            <h3 className="text-xl font-semibold text-zinc-700 mb-2">{strings.cardTitle}</h3>
            <p className="text-sm text-zinc-500 mb-6">{strings.cardSubtitle}</p>

            <div className="space-y-5">
                <section>
                    <h4 className="font-semibold text-zinc-700 mb-3">{strings.storeSectionTitle}</h4>
                    <div className="space-y-4 max-h-[420px] overflow-y-auto pr-1">
                        {stores.map(store => {
                            const formValues = storeForm[store.name] || { atvTarget: '', conversionRate: '', salesPerVisitor: '' };
                            const hasExistingRule = Boolean(storeRulesMap.get(store.name));
                            return (
                                <div key={store.name} className="border border-zinc-200 rounded-lg p-4 bg-zinc-50">
                                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                                        <div>
                                            <h5 className="font-semibold text-zinc-800 text-lg">{store.name}</h5>
                                            <p className="text-xs text-zinc-500">{strings.storeHint}</p>
                                        </div>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => handleStoreSave(store.name)}
                                                disabled={isProcessing}
                                                className="btn-primary text-sm"
                                            >
                                                {isProcessing ? strings.saving : strings.saveStore}
                                            </button>
                                            {hasExistingRule && (
                                                <button
                                                    onClick={() => handleStoreReset(store.name)}
                                                    disabled={isProcessing}
                                                    className="btn-secondary text-sm"
                                                >
                                                    {strings.resetStore}
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                    <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                                        <div>
                                            <label className="label text-xs uppercase tracking-wide text-zinc-500">
                                                {strings.atvLabel}
                                            </label>
                                            <input
                                                type="number"
                                                min="0"
                                                step="0.01"
                                                value={formValues.atvTarget}
                                                onChange={e => handleStoreFieldChange(store.name, 'atvTarget', e.target.value)}
                                                className="input"
                                                placeholder={strings.atvPlaceholder}
                                            />
                                        </div>
                                        <div>
                                            <label className="label text-xs uppercase tracking-wide text-zinc-500">
                                                {strings.conversionLabel}
                                            </label>
                                            <input
                                                type="number"
                                                min="0"
                                                step="0.01"
                                                value={formValues.conversionRate}
                                                onChange={e => handleStoreFieldChange(store.name, 'conversionRate', e.target.value)}
                                                className="input"
                                                placeholder={strings.conversionPlaceholder}
                                            />
                                        </div>
                                        <div>
                                            <label className="label text-xs uppercase tracking-wide text-zinc-500">
                                                {strings.spvLabel}
                                            </label>
                                            <input
                                                type="number"
                                                min="0"
                                                step="0.01"
                                                value={formValues.salesPerVisitor}
                                                onChange={e => handleStoreFieldChange(store.name, 'salesPerVisitor', e.target.value)}
                                                className="input"
                                                placeholder={strings.spvPlaceholder}
                                            />
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                        {stores.length === 0 && (
                            <p className="text-sm text-zinc-500">{strings.storeSectionEmpty}</p>
                        )}
                    </div>
                </section>

                {showGeneralRules && (
                    <section className="pt-4 border-t border-zinc-200">
                        <h4 className="font-semibold text-zinc-700 mb-3">{strings.generalTitle}</h4>
                        <p className="text-xs text-zinc-500 mb-2">{strings.generalHint}</p>
                        <div className="flex gap-2 mb-4">
                            <input
                                type="text"
                                value={newRule}
                                onChange={(e) => setNewRule(e.target.value)}
                                placeholder={strings.generalPlaceholder}
                                className="input flex-grow"
                            />
                            <button onClick={handleSaveGeneralRule} disabled={isProcessing} className="btn-primary">
                                {isProcessing ? strings.savingRule : strings.addRule}
                            </button>
                        </div>

                        <div className="space-y-2">
                            {generalRules.length === 0 ? (
                                <p className="text-sm text-zinc-400">{strings.noGeneralRules}</p>
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
                )}
            </div>
        </div>
    );
};

export default CustomBusinessRules;
