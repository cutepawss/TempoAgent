import { describe, it, expect } from 'vitest';
import {
    getTier,
    getTierColor,
    needsEscrow,
    verifyQuality,
    generateTaskId,
    generateMemo,
    getMockResponse,
    AGENTS,
} from '../src/lib/agents';

// ── getTier ───────────────────────────────────────
describe('getTier', () => {
    it('returns Platinum for scores >= 850', () => {
        expect(getTier(850)).toBe('Platinum');
        expect(getTier(900)).toBe('Platinum');
    });

    it('returns Gold for scores 700-849', () => {
        expect(getTier(700)).toBe('Gold');
        expect(getTier(849)).toBe('Gold');
    });

    it('returns Silver for scores 500-699', () => {
        expect(getTier(500)).toBe('Silver');
        expect(getTier(699)).toBe('Silver');
    });

    it('returns Bronze for scores below 500', () => {
        expect(getTier(499)).toBe('Bronze');
        expect(getTier(300)).toBe('Bronze');
    });

    it('handles boundary values correctly', () => {
        expect(getTier(850)).toBe('Platinum');
        expect(getTier(849)).toBe('Gold');
        expect(getTier(700)).toBe('Gold');
        expect(getTier(699)).toBe('Silver');
        expect(getTier(500)).toBe('Silver');
        expect(getTier(499)).toBe('Bronze');
    });
});

// ── getTierColor ──────────────────────────────────
describe('getTierColor', () => {
    it('returns correct colors for each tier', () => {
        expect(getTierColor('Platinum')).toBe('#3B82F6');
        expect(getTierColor('Gold')).toBe('#F59E0B');
        expect(getTierColor('Silver')).toBe('#9CA3AF');
        expect(getTierColor('Bronze')).toBe('#CD7F32');
    });
});

// ── needsEscrow ───────────────────────────────────
describe('needsEscrow', () => {
    it('requires escrow for scores below 700', () => {
        expect(needsEscrow(699)).toBe(true);
        expect(needsEscrow(500)).toBe(true);
        expect(needsEscrow(300)).toBe(true);
    });

    it('skips escrow for scores >= 700', () => {
        expect(needsEscrow(700)).toBe(false);
        expect(needsEscrow(850)).toBe(false);
    });

    it('handles boundary at 700', () => {
        expect(needsEscrow(700)).toBe(false);
        expect(needsEscrow(699)).toBe(true);
    });
});

// ── verifyQuality ─────────────────────────────────
describe('verifyQuality', () => {
    it('passes high-confidence outputs for Gold agents', () => {
        const result = verifyQuality('translator', 'translate hello', 'Bonjour!', 90);
        expect(result.pass).toBe(true);
    });

    it('passes high-confidence outputs for Silver agents', () => {
        const result = verifyQuality('data-analyst', 'analyze data', 'Analysis report with findings...', 95);
        expect(result.pass).toBe(true);
    });

    it('fails very short outputs', () => {
        const result = verifyQuality('translator', 'translate this', 'err', 30);
        expect(result.pass).toBe(false);
        expect(result.reason).toContain('too short');
    });

    it('fails low-confidence outputs with error indicators', () => {
        const result = verifyQuality('translator', 'translate this', 'error: translation failed', 40);
        expect(result.pass).toBe(false);
    });

    it('uses stricter threshold for Silver-tier agents', () => {
        // Data analyst primary skill is 650 (Silver), threshold = 90
        const result = verifyQuality('data-analyst', 'analyze data', 'Valid output here', 88);
        expect(result.pass).toBe(false);
    });
});

// ── generateTaskId ────────────────────────────────
describe('generateTaskId', () => {
    it('generates IDs starting with task_', () => {
        const id = generateTaskId();
        expect(id).toMatch(/^task_/);
    });

    it('generates unique IDs', () => {
        const ids = new Set(Array.from({ length: 100 }, () => generateTaskId()));
        expect(ids.size).toBe(100);
    });
});

// ── generateMemo ──────────────────────────────────
describe('generateMemo', () => {
    it('returns hex-prefixed string', () => {
        const memo = generateMemo('task_abc123');
        expect(memo).toMatch(/^0x[0-9a-f]{64}$/);
    });

    it('produces consistent output for same input', () => {
        const memo1 = generateMemo('test_task');
        const memo2 = generateMemo('test_task');
        expect(memo1).toBe(memo2);
    });

    it('produces different output for different inputs', () => {
        const memo1 = generateMemo('task_a');
        const memo2 = generateMemo('task_b');
        expect(memo1).not.toBe(memo2);
    });
});

// ── getMockResponse ───────────────────────────────
describe('getMockResponse', () => {
    it('returns translation for translator agent', () => {
        const result = getMockResponse('translator', 'translate hello to turkish');
        expect(result.output).toContain('Translation');
        expect(result.output).toContain('Merhaba');
        expect(result.confidence).toBe(95);
    });

    it('returns code review for code-reviewer agent', () => {
        const result = getMockResponse('code-reviewer', 'const x = 1;');
        expect(result.output).toContain('Code Review');
        expect(result.confidence).toBe(88);
    });

    it('returns analysis for data-analyst agent', () => {
        const result = getMockResponse('data-analyst', 'analyze sales data');
        expect(result.output).toContain('Analysis Report');
        expect(result.confidence).toBe(82);
    });

    it('returns error for unknown agent', () => {
        const result = getMockResponse('unknown-agent', 'test');
        expect(result.output).toBe('Agent not found');
        expect(result.confidence).toBe(0);
    });

    it('supports multiple languages in translator', () => {
        const langs = ['spanish', 'french', 'german', 'japanese', 'korean'];
        for (const lang of langs) {
            const result = getMockResponse('translator', `translate hello to ${lang}`);
            expect(result.output).toContain('Translation');
            expect(result.confidence).toBeGreaterThan(0);
        }
    });
});

// ── AGENTS data integrity ─────────────────────────
describe('AGENTS', () => {
    it('has exactly 3 agents', () => {
        expect(AGENTS).toHaveLength(3);
    });

    it('all agents have required fields', () => {
        for (const agent of AGENTS) {
            expect(agent.id).toBeTruthy();
            expect(agent.name).toBeTruthy();
            expect(agent.description).toBeTruthy();
            expect(agent.icon).toBeTruthy();
            expect(agent.skills.length).toBeGreaterThan(0);
            expect(agent.pricePerTask).toBeGreaterThan(0);
            expect(agent.address).toMatch(/^0x[0-9a-fA-F]{40}$/);
        }
    });

    it('all agents have valid skill scores in 300-900 range', () => {
        for (const agent of AGENTS) {
            for (const skill of agent.skills) {
                expect(skill.trustScore).toBeGreaterThanOrEqual(300);
                expect(skill.trustScore).toBeLessThanOrEqual(900);
            }
        }
    });

    it('all agents have correct tier assignments', () => {
        for (const agent of AGENTS) {
            for (const skill of agent.skills) {
                expect(skill.tier).toBe(getTier(skill.trustScore));
            }
        }
    });

    it('translator has Gold tier on primary skill', () => {
        const translator = AGENTS.find(a => a.id === 'translator');
        expect(translator?.skills[0].tier).toBe('Gold');
    });

    it('data-analyst has Silver tier on primary skill', () => {
        const analyst = AGENTS.find(a => a.id === 'data-analyst');
        expect(analyst?.skills[0].tier).toBe('Silver');
    });
});
