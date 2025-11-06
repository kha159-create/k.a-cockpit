import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenerativeAI } from '@google/generative-ai';

const key = process.env.GEMINI_API_KEY;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    if (!key) return res.status(500).json({ error: 'Server misconfigured: GEMINI_API_KEY missing' });

    const { prompt, model = 'gemini-2.5-flash', generationConfig } = (req.body || {}) as any;
    if (!prompt || typeof prompt !== 'string') return res.status(400).json({ error: 'Missing prompt' });

    const genai = new GoogleGenerativeAI(key);
    const m = genai.getGenerativeModel({ model });

    const rsp = generationConfig
      ? await m.generateContent({ contents: [{ role: 'user', parts: [{ text: prompt }]}], generationConfig })
      : await m.generateContent(prompt);

    return res.status(200).json({ text: rsp.response.text() });
  } catch (err: any) {
    console.error('Gemini error:', err?.message || err);
    return res.status(err?.status || 500).json({ error: err?.message || 'Gemini failure' });
  }
}



