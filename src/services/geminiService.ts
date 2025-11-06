// FIX: Updated to use the correct @google/generative-ai package
import { GoogleGenerativeAI, GenerationConfig } from "@google/generative-ai";
import type { StoreSummary, DailyMetric, PredictionResult, EmployeeSummary } from '../types.js';


// Read Gemini API key strictly from env (GitHub Secrets at build time)
// Vite automatically loads .env.local in development mode and injects env vars at build time
const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY as string | undefined;

// Better error handling with more context
if (!GEMINI_API_KEY || GEMINI_API_KEY.trim() === '') {
    const availableVars = Object.keys(import.meta.env).filter(k => k.startsWith('VITE_'));
    const isProduction = import.meta.env.PROD;
    const errorMsg = isProduction 
        ? 'Missing VITE_GEMINI_API_KEY in GitHub Secrets. Please add it in Repository Settings → Secrets → Actions.'
        : 'Missing VITE_GEMINI_API_KEY. Please set it in .env.local for local development.';
    
    console.error('❌ VITE_GEMINI_API_KEY is missing or empty');
    console.error('Environment:', isProduction ? 'Production' : 'Development');
    console.error('Available VITE_ env vars:', availableVars);
    throw new Error(errorMsg);
}

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

// Helper function to reduce data size for Gemini API
const reduceDataSize = (data: any, maxLength = 5000): string => {
    let jsonString = JSON.stringify(data);
    
    if (jsonString.length > maxLength) {
        // If data is too large, create a summary
        if (Array.isArray(data)) {
            const summary = {
                type: 'array',
                length: data.length,
                sample: data.slice(0, 3), // Only first 3 items
                summary: `Array with ${data.length} items`
            };
            jsonString = JSON.stringify(summary);
        } else if (typeof data === 'object') {
            // For objects, keep only essential fields
            const essential = {
                name: data.name || 'Unknown',
                type: typeof data,
                keys: Object.keys(data).slice(0, 10) // Only first 10 keys
            };
            jsonString = JSON.stringify(essential);
        }
    }
    
    return jsonString;
};

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
            
            // Don't retry on token limit errors (400 with specific message)
            if (error.status === 400 && (error.message?.includes('token') || error.message?.includes('maximum number of tokens'))) {
                console.error('❌ Token limit exceeded. Data too large for Gemini API.');
                throw new Error('Data size exceeds Gemini API limits. Please reduce the amount of data being analyzed.');
            }
            
            if (retries >= maxRetries - 1) {
                throw new Error(`AI analysis failed after ${maxRetries} retries. Last error: ${error.message}`);
            }
            
            // Check if it's a rate limit error (429)
            if (error.status === 429) {
                console.log(`🔄 Rate limit hit, waiting ${delay}ms before retry...`);
                await new Promise(resolve => setTimeout(resolve, delay));
                delay *= 2; // Exponential backoff
            } else {
                console.log(`🔄 Retrying in ${delay}ms...`);
            }
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
    
    // Reduce data size to avoid token limits
    const reducedData = reduceDataSize(employee, 3000);
    
    const prompt = `You are an expert retail performance coach named 'Hassan'. Analyze the provided performance data for an employee named ${employee.name}.
    
    Your task is to provide a concise, three-part summary for their manager:
    1.  **Key Strength:** Identify their single most significant strength based on the data.
    2.  **Development Opportunity:** Pinpoint their biggest area for improvement.
    3.  **Actionable Tip:** Provide one specific, practical coaching tip the manager can give them.
    
    Data:
    ${reducedData}
    
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
Current Sales Data (This Month So Far): ${reduceDataSize(salesThisMonth, 2000)}

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