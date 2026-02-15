// ── Types ─────────────────────────────────────────

export type Tier = 'Bronze' | 'Silver' | 'Gold' | 'Platinum';

export type PipelineStage =
    | 'ANALYZE'
    | 'TRUST'
    | 'ROUTE'
    | 'PROCESS'
    | 'VERIFY'
    | 'SETTLE'
    | 'DONE'
    | 'FAILED';

export interface PipelineStep {
    stage: PipelineStage;
    message: string;
    detail?: string;
    timestamp: number;
}

export interface SkillProfile {
    skill: string;
    trustScore: number;
    tier: Tier;
    tasksCompleted: number;
    tasksFailed: number;
}

export interface Agent {
    id: string;
    name: string;
    description: string;
    icon: string;
    skills: SkillProfile[];
    pricePerTask: number;       // in AlphaUSD
    address: string;
}

export interface Task {
    id: string;
    agentId: string;
    input: string;
    output?: string;
    confidence?: number;
    status: 'processing' | 'verified' | 'settled' | 'failed';
    txHash?: string;
    memo?: string;
    pipeline: PipelineStep[];
    timestamp: number;
    settlementType?: 'direct' | 'escrow';
}

// ── Tier logic ────────────────────────────────────

export function getTier(score: number): Tier {
    if (score >= 850) return 'Platinum';
    if (score >= 700) return 'Gold';
    if (score >= 500) return 'Silver';
    return 'Bronze';
}

export function getTierColor(tier: Tier): string {
    switch (tier) {
        case 'Platinum': return '#3B82F6';
        case 'Gold': return '#F59E0B';
        case 'Silver': return '#9CA3AF';
        case 'Bronze': return '#CD7F32';
    }
}

export function needsEscrow(score: number): boolean {
    return score < 700;
}

// ── Agents ────────────────────────────────────────

export const AGENTS: Agent[] = [
    {
        id: 'translator',
        name: 'Translator',
        description: 'Multi-language translation with context awareness',
        icon: '🌐',
        skills: [
            { skill: 'translation', trustScore: 780, tier: 'Gold', tasksCompleted: 142, tasksFailed: 3 },
            { skill: 'localization', trustScore: 720, tier: 'Gold', tasksCompleted: 58, tasksFailed: 2 },
        ],
        pricePerTask: 0.05,
        address: '0x031891A61200FedDd622EbACC10734BC90093B2A',
    },
    {
        id: 'code-reviewer',
        name: 'Code Reviewer',
        description: 'Security-focused code analysis and best practices',
        icon: '🔍',
        skills: [
            { skill: 'code-review', trustScore: 720, tier: 'Gold', tasksCompleted: 89, tasksFailed: 5 },
            { skill: 'security-audit', trustScore: 680, tier: 'Silver', tasksCompleted: 34, tasksFailed: 4 },
        ],
        pricePerTask: 0.10,
        address: '0xAcF8dBD0352a9D47135DA146EA5DbEfAD58340C4',
    },
    {
        id: 'data-analyst',
        name: 'Data Analyst',
        description: 'Statistical analysis, pattern recognition, insights',
        icon: '📊',
        skills: [
            { skill: 'data-analysis', trustScore: 650, tier: 'Silver', tasksCompleted: 67, tasksFailed: 8 },
            { skill: 'reporting', trustScore: 610, tier: 'Silver', tasksCompleted: 41, tasksFailed: 6 },
        ],
        pricePerTask: 0.15,
        address: '0x031891A61200FedDd622EbACC10734BC90093B2A',
    },
];

// ── Mock Responses (when no OpenAI key) ───────────

const MOCK_RESPONSES: Record<string, (input: string) => { output: string; confidence: number }> = {
    translator: (input: string) => {
        // Detect target language from input
        const lower = input.toLowerCase();
        const langMatch = lower.match(/to\s+(spanish|french|german|turkish|japanese|korean|italian|portuguese|arabic|russian|chinese|dutch)/i);
        const targetLang = langMatch ? langMatch[1].toLowerCase() : 'spanish';

        // Extract the text to translate
        const textToTranslate = lower
            .replace(/translate\s+/i, '')
            .replace(/\s+to\s+\w+$/i, '')
            .replace(/['"]/g, '')
            .trim();

        // Multi-language translation dictionary
        const dictionaries: Record<string, Record<string, string>> = {
            spanish: { 'hello': 'Hola', 'goodbye': 'Adiós', 'thank you': 'Gracias', 'good morning': 'Buenos días', 'how are you': 'Cómo estás', 'world': 'Mundo', 'hello world': 'Hola Mundo', 'yes': 'Sí', 'no': 'No', 'please': 'Por favor' },
            french: { 'hello': 'Bonjour', 'goodbye': 'Au revoir', 'thank you': 'Merci', 'good morning': 'Bonjour', 'how are you': 'Comment allez-vous', 'world': 'Monde', 'hello world': 'Bonjour le Monde', 'yes': 'Oui', 'no': 'Non', 'please': 'S\'il vous plaît' },
            german: { 'hello': 'Hallo', 'goodbye': 'Auf Wiedersehen', 'thank you': 'Danke', 'good morning': 'Guten Morgen', 'how are you': 'Wie geht es Ihnen', 'world': 'Welt', 'hello world': 'Hallo Welt', 'yes': 'Ja', 'no': 'Nein', 'please': 'Bitte' },
            turkish: { 'hello': 'Merhaba', 'goodbye': 'Hoşça kal', 'thank you': 'Teşekkür ederim', 'good morning': 'Günaydın', 'how are you': 'Nasılsınız', 'world': 'Dünya', 'hello world': 'Merhaba Dünya', 'yes': 'Evet', 'no': 'Hayır', 'please': 'Lütfen' },
            japanese: { 'hello': 'こんにちは', 'goodbye': 'さようなら', 'thank you': 'ありがとう', 'good morning': 'おはようございます', 'how are you': 'お元気ですか', 'world': '世界', 'hello world': 'こんにちは世界', 'yes': 'はい', 'no': 'いいえ', 'please': 'お願いします' },
            korean: { 'hello': '안녕하세요', 'goodbye': '안녕히 가세요', 'thank you': '감사합니다', 'good morning': '좋은 아침', 'how are you': '어떻게 지내세요', 'world': '세계', 'hello world': '안녕 세계', 'yes': '네', 'no': '아니요', 'please': '부탁합니다' },
            italian: { 'hello': 'Ciao', 'goodbye': 'Arrivederci', 'thank you': 'Grazie', 'good morning': 'Buongiorno', 'how are you': 'Come stai', 'world': 'Mondo', 'hello world': 'Ciao Mondo', 'yes': 'Sì', 'no': 'No', 'please': 'Per favore' },
            portuguese: { 'hello': 'Olá', 'goodbye': 'Adeus', 'thank you': 'Obrigado', 'good morning': 'Bom dia', 'how are you': 'Como vai', 'world': 'Mundo', 'hello world': 'Olá Mundo' },
            arabic: { 'hello': 'مرحبا', 'goodbye': 'مع السلامة', 'thank you': 'شكرا', 'good morning': 'صباح الخير', 'world': 'العالم', 'hello world': 'مرحبا بالعالم' },
            russian: { 'hello': 'Привет', 'goodbye': 'До свидания', 'thank you': 'Спасибо', 'good morning': 'Доброе утро', 'world': 'Мир', 'hello world': 'Привет мир' },
            chinese: { 'hello': '你好', 'goodbye': '再见', 'thank you': '谢谢', 'good morning': '早上好', 'world': '世界', 'hello world': '你好世界' },
            dutch: { 'hello': 'Hallo', 'goodbye': 'Tot ziens', 'thank you': 'Dank u', 'good morning': 'Goedemorgen', 'world': 'Wereld', 'hello world': 'Hallo Wereld' },
        };

        const dict = dictionaries[targetLang] || dictionaries['spanish'];
        const langName = targetLang.charAt(0).toUpperCase() + targetLang.slice(1);
        const translated = dict[textToTranslate] || `[${langName}] ${textToTranslate}`;

        return {
            output: `**Translation (English → ${langName})**\n\nOriginal: "${textToTranslate}"\nTranslation: "${translated}"\n\nConfidence: High\nMethod: Neural MT`,
            confidence: 95,
        };
    },
    'code-reviewer': (input: string) => ({
        output: `**Code Review Report**\n\n📋 **Input analyzed:**\n\`\`\`\n${input.slice(0, 200)}\n\`\`\`\n\n✅ **Findings:**\n1. Structure follows standard patterns\n2. No critical vulnerabilities detected\n3. Consider adding input validation\n4. Error handling could be more specific\n\n⚠️ **Recommendations:**\n- Add type guards for runtime safety\n- Use parameterized queries for data access\n- Implement rate limiting on exposed endpoints\n\n**Severity:** Low\n**Quality Score:** 7.5/10`,
        confidence: 88,
    }),
    'data-analyst': (input: string) => ({
        output: `**Analysis Report**\n\n📊 **Query:** ${input}\n\n**Key Findings:**\n1. Data pattern indicates upward trend (+12.3% MoM)\n2. Three significant clusters identified in dataset\n3. Correlation coefficient: 0.847 (strong positive)\n4. Outlier detection: 2 anomalies flagged\n\n**Statistical Summary:**\n- Mean: 4,521.33\n- Median: 4,180.00\n- Std Dev: 892.15\n- P-value: 0.003 (significant)\n\n**Recommendation:** Results are statistically significant. Proceed with hypothesis.`,
        confidence: 82,
    }),
};

export function getMockResponse(agentId: string, input: string) {
    const handler = MOCK_RESPONSES[agentId];
    if (!handler) return { output: 'Agent not found', confidence: 0 };
    return handler(input);
}

// ── Quality Verification ──────────────────────────

export function verifyQuality(
    agentId: string,
    input: string,
    output: string,
    confidence: number
): { pass: boolean; reason: string } {
    // Threshold based on agent tier
    const agent = AGENTS.find(a => a.id === agentId);
    const primarySkill = agent?.skills[0];
    const threshold = primarySkill && needsEscrow(primarySkill.trustScore) ? 90 : 85;

    if (confidence >= threshold) {
        return { pass: true, reason: `Confidence ${confidence}% exceeds ${threshold}% threshold` };
    }

    // Basic coherence checks
    if (output.length < 10) {
        return { pass: false, reason: 'Output too short — possible hallucination' };
    }

    if (output.toLowerCase().includes('error') && confidence < 50) {
        return { pass: false, reason: 'Low confidence with error indicators' };
    }

    return { pass: confidence >= threshold, reason: `Confidence ${confidence}% vs threshold ${threshold}%` };
}

// ── Utilities ─────────────────────────────────────

export function generateTaskId(): string {
    const ts = Date.now().toString(36);
    const rand = Math.random().toString(36).substring(2, 6);
    return `task_${ts}_${rand}`;
}

export function generateMemo(taskId: string): `0x${string}` {
    const hex = Array.from(taskId)
        .map((c) => c.charCodeAt(0).toString(16).padStart(2, '0'))
        .join('');
    return `0x${hex.padEnd(64, '0').slice(0, 64)}` as `0x${string}`;
}
