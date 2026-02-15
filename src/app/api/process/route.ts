import { NextResponse } from 'next/server';
import OpenAI from 'openai';

// ── System prompts for each agent ───────────────────
const SYSTEM_PROMPTS: Record<string, string> = {
    translator: `You are a professional translator. Translate the user's text accurately and naturally. 
Return a structured response with:
- Original text and detected source language
- Translation and target language  
- Confidence level (High/Medium/Low)
Keep formatting clean and professional.`,

    'code-reviewer': `You are an expert senior code reviewer specializing in security, performance, and best practices.
Analyze the provided code thoroughly and return:
1. Detected language
2. Key findings (numbered, with severity emoji: 🔴 critical, ⚠️ warning, ℹ️ info)
3. Security vulnerabilities found
4. Performance concerns
5. Specific recommendations  
6. Overall quality score (1-10)
Be specific, cite exact lines, and explain WHY each issue matters.`,

    'data-analyst': `You are an expert data analyst. Analyze the provided data or query and return:
1. Dataset summary (count, type of data)
2. Key statistical findings with exact numbers
3. Trend analysis
4. Outlier detection
5. Patterns or anomalies
6. Actionable recommendations
Use precise numbers. If numerical data is provided, calculate real statistics.`,
};

// ── Language codes for MyMemory API ──────────────────
const LANG_CODES: Record<string, string> = {
    spanish: 'es', french: 'fr', german: 'de', turkish: 'tr',
    japanese: 'ja', korean: 'ko', italian: 'it', portuguese: 'pt',
    arabic: 'ar', russian: 'ru', chinese: 'zh-CN', dutch: 'nl',
    english: 'en', hindi: 'hi', polish: 'pl', swedish: 'sv',
    norwegian: 'no', danish: 'da', finnish: 'fi', greek: 'el',
    czech: 'cs', romanian: 'ro', hungarian: 'hu', thai: 'th',
    vietnamese: 'vi', indonesian: 'id', hebrew: 'he', ukrainian: 'uk',
};

// ── Detect source and target languages from input ───
function parseTranslationRequest(input: string): { text: string; from: string; to: string } | null {
    const lower = input.toLowerCase().trim();

    // Pattern: "translate X from LANG to LANG"
    const fromToMatch = lower.match(/^translate\s+["""]?(.+?)["""]?\s+from\s+(\w+)\s+to\s+(\w+)\s*$/i);
    if (fromToMatch) {
        return {
            text: fromToMatch[1].trim(),
            from: LANG_CODES[fromToMatch[2]] || fromToMatch[2],
            to: LANG_CODES[fromToMatch[3]] || fromToMatch[3],
        };
    }

    // Pattern: "translate X to LANG"
    const toMatch = lower.match(/^translate\s+["""]?(.+?)["""]?\s+to\s+(\w+)\s*$/i);
    if (toMatch) {
        const targetLang = LANG_CODES[toMatch[2]] || toMatch[2];
        return { text: toMatch[1].trim(), from: 'auto', to: targetLang };
    }

    // Pattern: just "X to LANG"
    const simpleMatch = lower.match(/^(.+?)\s+to\s+(\w+)\s*$/i);
    if (simpleMatch && LANG_CODES[simpleMatch[2]]) {
        return { text: simpleMatch[1].trim(), from: 'auto', to: LANG_CODES[simpleMatch[2]] };
    }

    return null;
}

// ── Free translation via MyMemory API ───────────────
async function translateWithMyMemory(text: string, from: string, to: string): Promise<{
    translation: string;
    detectedLang: string;
    confidence: number;
} | null> {
    try {
        const sourceLang = from === 'auto' ? 'en' : from;
        const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${sourceLang}|${to}`;
        const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
        const data = await res.json();

        if (data.responseStatus === 200 && data.responseData?.translatedText) {
            const translated = data.responseData.translatedText;
            const match = data.responseData.match || 0;

            // If same text returned, retry with auto-detect
            if (translated.toLowerCase() === text.toLowerCase() && sourceLang === 'en') {
                const retryUrl = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=autodetect|${to}`;
                const retryRes = await fetch(retryUrl, { signal: AbortSignal.timeout(5000) });
                const retryData = await retryRes.json();
                if (retryData.responseStatus === 200 && retryData.responseData?.translatedText) {
                    return {
                        translation: retryData.responseData.translatedText,
                        detectedLang: retryData.responseData.detectedLanguage || sourceLang,
                        confidence: Math.round((retryData.responseData.match || 0.85) * 100),
                    };
                }
            }

            return {
                translation: translated,
                detectedLang: sourceLang,
                confidence: Math.round((match || 0.85) * 100),
            };
        }
        return null;
    } catch {
        return null;
    }
}

// ── Call LLM (Groq free → OpenAI fallback) ──────────
async function callLLM(systemPrompt: string, userInput: string): Promise<{
    output: string; model: string;
} | null> {
    // Priority 1: Groq (free, no credit card, Llama 3.3 70B)
    const groqKey = process.env.GROQ_API_KEY;
    if (groqKey) {
        try {
            const groq = new OpenAI({
                apiKey: groqKey,
                baseURL: 'https://api.groq.com/openai/v1',
            });
            const completion = await groq.chat.completions.create({
                model: 'llama-3.3-70b-versatile',
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userInput },
                ],
                max_tokens: 600,
                temperature: 0.3,
            });
            const output = completion.choices[0]?.message?.content;
            if (output) return { output, model: 'llama-3.3-70b (Groq)' };
        } catch (e) {
            console.error('Groq error:', e);
        }
    }

    // Priority 2: OpenAI (if key exists)
    const openaiKey = process.env.OPENAI_API_KEY;
    if (openaiKey) {
        try {
            const openai = new OpenAI({ apiKey: openaiKey });
            const completion = await openai.chat.completions.create({
                model: 'gpt-4o-mini',
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userInput },
                ],
                max_tokens: 500,
                temperature: 0.3,
            });
            const output = completion.choices[0]?.message?.content;
            if (output) return { output, model: 'gpt-4o-mini' };
        } catch (e) {
            console.error('OpenAI error:', e);
        }
    }

    return null;
}

export async function POST(request: Request) {
    try {
        const { agentId, input } = await request.json();

        if (!agentId || !input) {
            return NextResponse.json(
                { error: 'Missing agentId or input' },
                { status: 400 }
            );
        }

        // ── Translator: MyMemory API (free) + LLM fallback
        if (agentId === 'translator') {
            const parsed = parseTranslationRequest(input);

            if (parsed) {
                const result = await translateWithMyMemory(parsed.text, parsed.from, parsed.to);
                if (result) {
                    const langName = Object.entries(LANG_CODES).find(([, v]) => v === parsed.to)?.[0] || parsed.to;
                    const fromName = Object.entries(LANG_CODES).find(([, v]) => v === result.detectedLang)?.[0] || result.detectedLang;
                    const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

                    return NextResponse.json({
                        output: `**Translation (${cap(fromName)} → ${cap(langName)})**\n\nOriginal: "${parsed.text}"\nTranslation: "${result.translation}"\n\nConfidence: ${result.confidence}%\nMethod: MyMemory Neural MT`,
                        confidence: result.confidence,
                        model: 'mymemory',
                        mock: false,
                    });
                }
            }
        }

        // ── All agents: try LLM (Groq free → OpenAI) ────
        const systemPrompt = SYSTEM_PROMPTS[agentId] || SYSTEM_PROMPTS.translator;
        const llmResult = await callLLM(systemPrompt, input);

        if (llmResult) {
            return NextResponse.json({
                output: llmResult.output,
                confidence: 92,
                model: llmResult.model,
                mock: false,
            });
        }

        // ── Fallback: mock responses ────────────────────
        const { getMockResponse } = await import('@/lib/agents');
        const mock = getMockResponse(agentId, input);

        return NextResponse.json({
            output: mock.output,
            confidence: mock.confidence,
            model: 'demo',
            mock: true,
        });
    } catch (error) {
        console.error('Process error:', error);
        return NextResponse.json(
            { error: 'Processing failed', detail: String(error) },
            { status: 500 }
        );
    }
}
