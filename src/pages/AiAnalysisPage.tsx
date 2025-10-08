


import React, { useState, useEffect, useRef } from 'react';
import { generateText } from '../services/geminiService';
import type { KPIData, StoreSummary, EmployeeSummary, ProductSummary, SalesTransaction } from '../types';

interface AiAnalysisPageProps {
    kpiData: KPIData;
    storeSummary: StoreSummary[];
    employeeSummary: { [storeName: string]: EmployeeSummary[] };
    productSummary: ProductSummary[];
    salesTransactions: SalesTransaction[];
    kingDuvetSales: SalesTransaction[];
}

const AiAnalysisPage: React.FC<AiAnalysisPageProps> = (props) => {
    const [chatHistory, setChatHistory] = useState([
        { role: 'model', parts: [{ text: "Welcome! I'm your AI Business Advisor. Ask me anything about your performance data." }] }
    ]);
    const [userInput, setUserInput] = useState('');
    const [isThinking, setIsThinking] = useState(false);
    const chatEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [chatHistory]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!userInput.trim() || isThinking) return;

        const newHumanMessage = { role: 'user', parts: [{ text: userInput }] };
        const updatedHistory = [...chatHistory, newHumanMessage];
        setChatHistory(updatedHistory);
        setIsThinking(true);
        const currentInput = userInput;
        setUserInput('');
        
        try {
            const dataContext = `--- DATA SNAPSHOT ---\n${JSON.stringify(props, null, 2)}\n--- END DATA ---\n`;
            const systemPrompt = `You are an expert retail analyst. Your answers must be based strictly on the provided DATA SNAPSHOT. Provide concise, actionable insights. Use markdown for formatting.`;
            
            const responseText = await generateText({
                model: 'gemini-2.5-flash',
                contents: [{ role: 'user', parts: [{ text: `${dataContext}\n\nUser Question: ${currentInput}` }] }],
                config: {
                    systemInstruction: systemPrompt,
                }
            });

            setChatHistory(prev => [...prev, { role: 'model', parts: [{ text: responseText }] }]);
        } catch (error: any) {
            setChatHistory(prev => [...prev, { role: 'model', parts: [{ text: `Sorry, an error occurred: ${error.message}` }] }]);
        } finally {
            setIsThinking(false);
        }
    };

    return (
        <div className="h-[calc(100vh-12rem)] flex flex-col bg-white rounded-xl shadow-sm border border-gray-200">
            <div className="flex-grow p-6 overflow-y-auto">
                <div className="space-y-4">
                    {chatHistory.map((msg, index) => (
                        <div key={index} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                            <div className={`p-3 rounded-lg max-w-lg prose prose-sm ${msg.role === 'user' ? 'bg-blue-500 text-white' : 'bg-gray-200 text-zinc-800'}`} dangerouslySetInnerHTML={{ __html: msg.parts[0].text.replace(/\n/g, '<br />').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }} />
                        </div>
                    ))}
                    {isThinking && <div className="flex justify-start"><div className="p-3 rounded-lg bg-gray-200">...</div></div>}
                    <div ref={chatEndRef} />
                </div>
            </div>
            <div className="p-4 border-t">
                <form onSubmit={handleSubmit} className="flex gap-4">
                    <input type="text" value={userInput} onChange={(e) => setUserInput(e.target.value)} placeholder="Ask about your data..." className="input flex-grow" disabled={isThinking} />
                    <button type="submit" className="btn-primary" disabled={isThinking || !userInput.trim()}>Send</button>
                </form>
            </div>
        </div>
    );
};

export default AiAnalysisPage;