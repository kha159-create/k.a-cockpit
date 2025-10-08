import React, { useState, useEffect, useRef } from 'react';
import { generateText } from '@/services/geminiService';
import { SparklesIcon, XIcon } from '@/components/Icons';
import type { BusinessRule } from '@/types';

interface AiChatAssistantProps {
  fullData: any;
  currentPage: string;
  businessRules: BusinessRule[];
}

const AiChatAssistant: React.FC<AiChatAssistantProps> = ({ fullData, currentPage, businessRules }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [history, setHistory] = useState([
    { role: 'model', parts: [{ text: "أهلاً بك! أنا حسن مساعدك الذكي. كيف يمكنني مساعدتك اليوم؟" }] }
  ]);
  const [input, setInput] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [history]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isThinking) return;

    const newHumanMessage = { role: 'user', parts: [{ text: input }] };
    setHistory(prev => [...prev, newHumanMessage]);
    const currentInput = input;
    setInput('');
    setIsThinking(true);

    try {
      const rulesContext = businessRules.length > 0 
        ? `--- IMPORTANT BUSINESS RULES (Follow these in all answers) ---\n${businessRules.map(r => `- ${r.rule}`).join('\n')}\n--- END RULES ---`
        : '';

      const dataContext = `--- REAL-TIME DATA SNAPSHOT ---\n${JSON.stringify(fullData, null, 2)}\n--- END DATA ---`;
      
      const systemPrompt = `You are 'Hassan', an expert retail analyst and business advisor. Your answers must be based strictly on the provided REAL-TIME DATA SNAPSHOT and you must always follow the IMPORTANT BUSINESS RULES. The user is currently on the '${currentPage}' page; use this context for more relevant answers. Be concise, actionable, and use markdown for formatting. All responses must be in Arabic.`;
      
      const userQuery = `User Query: "${currentInput}"`;

      const responseText = await generateText({
        model: 'gemini-2.5-flash',
        contents: [...history, { role: 'user', parts: [{ text: `${rulesContext}\n\n${dataContext}\n\n${userQuery}` }] }],
        config: { systemInstruction: systemPrompt }
      });

      setHistory(prev => [...prev, { role: 'model', parts: [{ text: responseText }] }]);
    } catch (error: any) {
      setHistory(prev => [...prev, { role: 'model', parts: [{ text: `عذراً، حدث خطأ: ${error.message}` }] }]);
    } finally {
      setIsThinking(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-6 right-6 bg-orange-600 text-white rounded-full p-4 shadow-lg hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 transition-transform transform hover:scale-110 z-40"
        aria-label="Open AI Assistant"
      >
        <SparklesIcon />
      </button>
      
      {isOpen && (
        <div className="fixed bottom-20 right-6 w-96 h-[60vh] bg-white rounded-2xl shadow-2xl flex flex-col z-40">
          <header className="flex items-center justify-between p-4 border-b bg-gray-50 rounded-t-2xl">
            <h3 className="font-bold text-lg text-gray-800">المساعد الذكي: حسن</h3>
            <button onClick={() => setIsOpen(false)} className="text-gray-500 hover:text-gray-800">
              <XIcon />
            </button>
          </header>

          <div className="flex-grow p-4 overflow-y-auto">
            <div className="space-y-4">
              {history.map((msg, index) => (
                <div key={index} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`p-3 rounded-lg max-w-xs prose prose-sm ${msg.role === 'user' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-zinc-800'}`} dangerouslySetInnerHTML={{ __html: msg.parts[0].text.replace(/\n/g, '<br />').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }} />
                </div>
              ))}
              {isThinking && <div className="flex justify-start"><div className="p-3 rounded-lg bg-gray-100 text-sm">حسن يفكر...</div></div>}
              <div ref={chatEndRef} />
            </div>
          </div>
          
          <div className="p-4 border-t">
            <form onSubmit={handleSubmit} className="flex gap-2">
              <input type="text" value={input} onChange={(e) => setInput(e.target.value)} placeholder="اسأل حسن..." className="input flex-grow" disabled={isThinking} />
              <button type="submit" className="btn-primary" disabled={isThinking || !input.trim()}>إرسال</button>
            </form>
          </div>
        </div>
      )}
    </>
  );
};

export default AiChatAssistant;