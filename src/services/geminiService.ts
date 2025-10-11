// FIX: Updated to use the correct @google/generative-ai package
import { GoogleGenerativeAI, GenerationConfig } from "@google/generative-ai";
import type { StoreSummary, DailyMetric, PredictionResult, EmployeeSummary } from '../types.js';


// Use environment variable for API key
const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY || "REDACTED_GEMINI_API_KEY";

if (!GEMINI_API_KEY) {
  throw new Error("Gemini API key (VITE_GEMINI_API_KEY) is not set in environment variables.");
}

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

type StructuredRequest = {
    contents: any[];
    systemInstruction?: string;
    generationConfig?: GenerationConfig;
};

const callGeminiWithRetry = async (
    model: string,
    input: string | StructuredRequest,
    config?: GenerationConfig,
    maxRetries = 3
): Promise<any> => {
    let retries = 0;
    let delay = 1000;

    while (retries < maxRetries) {
        try {
            console.log(`🔍 Gemini API call attempt ${retries + 1}/${maxRetries} with model: ${model}`);
            const generativeModel = genAI.getGenerativeModel({ model });

            let result;
            if (typeof input === 'string') {
                // Simple text prompt; if config is provided, pass it via generationConfig
                if (config) {
                    result = await generativeModel.generateContent({
                        contents: [{ role: 'user', parts: [{ text: input }]}],
                        generationConfig: config,
                    });
                } else {
                    result = await generativeModel.generateContent(input);
                }
            } else {
                // Structured chat-style request
                result = await generativeModel.generateContent({
                    contents: input.contents,
                    systemInstruction: input.systemInstruction,
                    generationConfig: input.generationConfig,
                });
            }
            const response = await result.response;
            console.log("✅ Gemini API call successful");
            return response;
        } catch (error: any) {
            console.error(`❌ Gemini API call failed on attempt ${retries + 1}:`, {
                error: error.message,
                status: error.status || 'Unknown',
                details: error.details || 'No additional details'
            });
            
            if (retries >= maxRetries - 1) {
                throw new Error(`AI analysis failed after ${maxRetries} retries. Last error: ${error.message}`);
            }
            
            console.log(`🔄 Retrying in ${delay}ms...`);
            await new Promise(resolve => setTimeout(resolve, delay));
            delay *= 2; // Exponential backoff
            retries++;
        }
    }
    throw new Error("AI analysis failed after multiple retries.");
};


type GenerateTextParams =
    | string
    | {
        model?: string;
        // Chat-style payload
        contents: any[];
        // Old callers might pass systemInstruction inside config; support both
        systemInstruction?: string;
        config?: GenerationConfig & { systemInstruction?: string };
        generationConfig?: GenerationConfig;
      };

export const generateText = async (params: GenerateTextParams, model = 'gemini-2.5-flash', maxRetries = 3): Promise<string> => {
    if (typeof params === 'string') {
        const response = await callGeminiWithRetry(model, params, undefined, maxRetries);
        return response.text();
    }

    const resolvedModel = params.model || model;

    // Normalize config fields
    const systemInstruction = params.systemInstruction || (params.config as any)?.systemInstruction;
    const generationConfig: GenerationConfig | undefined = params.generationConfig || (params.config
        ? Object.fromEntries(Object.entries(params.config).filter(([k]) => k !== 'systemInstruction')) as GenerationConfig
        : undefined);

    const structured: StructuredRequest = {
        contents: params.contents,
        systemInstruction,
        generationConfig,
    };

    const response = await callGeminiWithRetry(resolvedModel, structured, undefined, maxRetries);
    return response.text();
};

export const generateEmployeeCoachingSummary = async (employee: EmployeeSummary, locale: 'en' | 'ar'): Promise<string> => {
    const languageInstruction = locale === 'ar' 
        ? 'IMPORTANT: The response must be in Arabic, formatted using markdown with bold headings for each section.' 
        : 'Format the response using markdown with bold headings for each section.';
    
    const prompt = `You are an expert retail performance coach named 'Hassan'. Analyze the provided performance data for an employee named ${employee.name}.
    
    Your task is to provide a concise, three-part summary for their manager:
    1.  **Key Strength:** Identify their single most significant strength based on the data.
    2.  **Development Opportunity:** Pinpoint their biggest area for improvement.
    3.  **Actionable Tip:** Provide one specific, practical coaching tip the manager can give them.
    
    Data:
    ${JSON.stringify(employee, null, 2)}
    
    ${languageInstruction}`;

    return await generateText(prompt, 'gemini-2.5-flash');
};


export const generatePrediction = async (store: StoreSummary, historicalMetrics: DailyMetric[], locale: 'en' | 'ar'): Promise<PredictionResult> => {
    const today = new Date();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();

    const salesThisMonth = historicalMetrics
        .filter(m => {
            // FIX: Add a guard to ensure metric has a valid date before processing.
            if (!m.date || typeof m.date.toDate !== 'function') {
                return false;
            }
            const metricDate = m.date.toDate();
            return metricDate.getMonth() === currentMonth && metricDate.getFullYear() === currentYear;
        })
        .map(m => ({ date: m.date.toDate().toISOString().split('T')[0], sales: m.totalSales || 0 }));
    
    const languageInstruction = locale === 'ar' ? 'IMPORTANT: The justification must be in Arabic.' : '';

    const prompt = `You are a predictive retail analyst. Your task is to forecast month-end sales for a store and assess its risk of missing its target.

Store Name: ${store.name}
Monthly Sales Target: ${store.effectiveTarget.toFixed(2)} SAR
Current Sales Data (This Month So Far): ${JSON.stringify(salesThisMonth)}

Based ONLY on this data, provide a JSON object with your analysis.
1.  **predictedSales**: Your realistic forecast for total sales by the end of the month.
2.  **riskScore**: An integer from 0 (no risk) to 100 (certain to miss target). A score > 60 is high risk.
3.  **justification**: A brief, one-sentence explanation for your risk score. ${languageInstruction}`;
    
    const config: GenerationConfig = {
        responseMimeType: "application/json",
        responseSchema: {
            type: "object" as const,
            properties: {
                predictedSales: { type: "number" as const, description: "Forecasted total sales for the month." },
                riskScore: { type: "number" as const, description: "Risk of missing target (0-100)." },
                justification: { type: "string" as const, description: "Brief reason for the risk score." }
            },
            required: ['predictedSales', 'riskScore', 'justification']
        }
    };

    const response = await callGeminiWithRetry('gemini-2.5-flash', prompt, config);
    const jsonString = response.text().trim();
    
    try {
        return JSON.parse(jsonString) as PredictionResult;
    } catch (parseError) {
        console.error("❌ Failed to parse JSON response:", jsonString);
        throw new Error(`Failed to parse AI response as JSON: ${parseError}`);
    }
};