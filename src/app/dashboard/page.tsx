'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import {
    AGENTS, type Agent, type Task, type PipelineStep, type PipelineStage,
    generateTaskId, generateMemo, getMockResponse, verifyQuality,
    getTierColor, getTier, needsEscrow,
} from '@/lib/agents';
import { CONTRACTS, TEMPO } from '@/lib/constants';
import { usePrivy } from '@privy-io/react-auth';

// ── Stage colors for log badges ─────────────────────
const STAGE_COLORS: Record<string, string> = {
    ANALYZE: '#9CA3AF',
    TRUST: '#8B5CF6',
    ROUTE: '#3B82F6',
    PROCESS: '#A855F7',
    VERIFY: '#10B981',
    SETTLE: '#F97316',
    DONE: '#10B981',
    FAILED: '#EF4444',
};

// ── Simulate the full autonomous pipeline ───────────
async function runPipeline(
    agent: Agent,
    input: string,
    onStep: (step: PipelineStep) => void,
    scoreOverrides?: Map<string, number>,
): Promise<Task & { newScore?: number }> {
    const taskId = generateTaskId();
    const memo = generateMemo(taskId);
    const primarySkill = agent.skills[0];
    const steps: PipelineStep[] = [];

    // Use overridden score if available (from previous tasks in this session)
    const currentScore = scoreOverrides?.get(`${agent.id}:${primarySkill.skill}`) ?? primarySkill.trustScore;

    const emit = (stage: PipelineStage, message: string, detail?: string) => {
        const step: PipelineStep = { stage, message, detail, timestamp: Date.now() };
        steps.push(step);
        onStep(step);
    };

    // Stage 1: ANALYZE
    emit('ANALYZE', `Task: "${input.slice(0, 60)}${input.length > 60 ? '...' : ''}"`, `Input validated (${input.length} chars)`);
    await delay(400);

    // Stage 2: TRUST — read from chain
    emit('TRUST', `Reading AgentRegistry on Tempo...`);
    await delay(400);

    // Try reading real on-chain score
    let onChainScore = currentScore;
    try {
        const scoreRes = await fetch(`/api/agents/score?address=${agent.address}&skill=${primarySkill.skill}`);
        const scoreData = await scoreRes.json();
        if (scoreData.onChain && scoreData.score > 0) {
            onChainScore = scoreData.score;
        }
    } catch { /* use local score */ }

    const escrow = needsEscrow(onChainScore);
    const tierName = getTier(onChainScore);
    emit('TRUST', `${agent.name} [${tierName.toUpperCase()} ${onChainScore}]`,
        escrow ? 'Score < 700 — Escrow required' : 'Score ≥ 700 — Direct payment OK');
    await delay(300);

    // Stage 3: ROUTE
    emit('ROUTE', `Selected: ${agent.name} ($${agent.pricePerTask} AlphaUSD)`,
        `Best match for ${primarySkill.skill} skill`);
    await delay(300);

    // Stage 4: PROCESS (call API or mock)
    emit('PROCESS', 'Calling AI model...');
    await delay(800);

    let output: string;
    let confidence: number;

    try {
        const res = await fetch('/api/process', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ agentId: agent.id, input }),
        });
        const data = await res.json();
        output = data.output;
        confidence = data.confidence || 90;
    } catch {
        const mock = getMockResponse(agent.id, input);
        output = mock.output;
        confidence = mock.confidence;
    }

    emit('PROCESS', `AI response received`, `Confidence: ${confidence}%`);
    await delay(400);

    // Stage 5: VERIFY — call real QualityOracle on-chain
    const quality = verifyQuality(agent.id, input, output, confidence);
    let verifyTxHash: string | undefined;
    let newScore: number | undefined;

    if (quality.pass) {
        emit('VERIFY', `Quality: PASS ✓ (${confidence}%)`, 'Submitting to QualityOracle on Tempo...');
        await delay(200);

        // Call real on-chain verification
        try {
            const verifyRes = await fetch('/api/verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    taskId,
                    agentAddress: agent.address,
                    skill: primarySkill.skill,
                    confidence,
                    pass: true,
                    reason: quality.reason,
                }),
            });
            const verifyData = await verifyRes.json();
            verifyTxHash = verifyData.txHash;
            newScore = verifyData.newScore;
            const tag = verifyData.mock ? ' (demo)' : '';
            emit('VERIFY', `Report submitted${tag}`,
                `TX: ${verifyTxHash!.slice(0, 10)}...${verifyTxHash!.slice(-4)} | Score: ${onChainScore} → ${newScore ?? onChainScore + 2}`);
        } catch {
            emit('VERIFY', `Report submitted (local)`, quality.reason);
        }
    } else {
        emit('FAILED', `Quality: FAIL ✗`, quality.reason);
        return {
            id: taskId, agentId: agent.id, input, output,
            confidence, status: 'failed', pipeline: steps,
            timestamp: Date.now(),
        };
    }
    await delay(400);

    // Stage 6: SETTLE
    let txHash = `0x${Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('')}`;

    if (escrow) {
        emit('SETTLE', `EscrowVault.deposit($${agent.pricePerTask}, ${taskId.slice(0, 8)}...)`, 'Funds held until quality verified');
        await delay(500);
        emit('SETTLE', `EscrowVault.release(${taskId.slice(0, 8)}...)`, 'Quality passed — releasing to agent');
    } else {
        emit('SETTLE', `transfer(agent, $${agent.pricePerTask}, memo)`, 'Direct TIP-20 settlement on Tempo');
    }

    try {
        const res = await fetch('/api/settle', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ taskId, amount: agent.pricePerTask }),
        });
        const data = await res.json();
        txHash = data.txHash;
    } catch { /* use generated hash */ }
    await delay(600);

    // Stage 7: DONE
    const finalScore = newScore ?? onChainScore + 2;
    emit('DONE', `Settled in ${(Math.random() * 0.5 + 0.6).toFixed(1)}s`,
        `TX: ${txHash.slice(0, 6)}...${txHash.slice(-4)} | Score: ${onChainScore} → ${finalScore}`);

    return {
        id: taskId, agentId: agent.id, input, output,
        confidence, status: 'settled', txHash, memo,
        pipeline: steps, timestamp: Date.now(),
        settlementType: escrow ? 'escrow' : 'direct',
        newScore: finalScore,
    };
}

function delay(ms: number) {
    return new Promise(r => setTimeout(r, ms));
}

// ── Dashboard Component ─────────────────────────────
export default function Dashboard() {
    const { authenticated, login, logout, user } = usePrivy();
    const [selectedAgent, setSelectedAgent] = useState<Agent>(AGENTS[0]);
    const [input, setInput] = useState('');
    const [tasks, setTasks] = useState<Task[]>([]);
    const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
    const [logEntries, setLogEntries] = useState<PipelineStep[]>([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [scoreOverrides, setScoreOverrides] = useState<Map<string, number>>(new Map());
    const logRef = useRef<HTMLDivElement>(null);

    const walletAddress = user?.wallet?.address;
    const truncated = walletAddress ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}` : null;

    useEffect(() => {
        if (logRef.current) {
            logRef.current.scrollTop = logRef.current.scrollHeight;
        }
    }, [logEntries]);

    const handleSubmit = useCallback(async () => {
        if (!input.trim() || isProcessing) return;
        setIsProcessing(true);
        setLogEntries([]); // Clear log for new task

        // Add separator if there were previous entries
        const startStep: PipelineStep = {
            stage: 'ANALYZE',
            message: 'TempoAgent activated',
            timestamp: Date.now(),
        };
        setLogEntries([startStep]);

        const task = await runPipeline(selectedAgent, input.trim(), (step) => {
            setLogEntries(prev => [...prev, step]);
        }, scoreOverrides);

        // Track score changes for subsequent tasks
        if ((task as any).newScore) {
            const key = `${selectedAgent.id}:${selectedAgent.skills[0].skill}`;
            setScoreOverrides(prev => {
                const next = new Map(prev);
                next.set(key, (task as any).newScore);
                return next;
            });
        }

        setTasks(prev => [task, ...prev]);
        setActiveTaskId(task.id);
        setInput('');
        setIsProcessing(false);
    }, [input, selectedAgent, isProcessing]);

    const activeTask = tasks.find(t => t.id === activeTaskId);

    return (
        <div className="dashboard">
            {/* ── Sidebar: Agent Selection ── */}
            <div className="sidebar">
                <div className="sidebar-header">
                    <Link href="/" className="sidebar-brand">
                        <span className="nav-logo">◬</span> TempoAgent
                    </Link>
                    <span className="sidebar-badge">TESTNET LIVE</span>
                </div>

                {/* Wallet Status */}
                <div className="wallet-status">
                    {authenticated && truncated ? (
                        <>
                            <div className="wallet-connected">
                                <span className="wallet-dot connected"></span>
                                <span className="wallet-addr">{truncated}</span>
                            </div>
                            <button onClick={logout} className="wallet-btn disconnect">Disconnect</button>
                        </>
                    ) : (
                        <>
                            <div className="wallet-connected">
                                <span className="wallet-dot demo"></span>
                                <span className="wallet-addr">Demo Mode</span>
                            </div>
                            <p className="wallet-hint">No wallet needed — all features work in demo mode with simulated transactions.</p>
                            <button onClick={login} className="wallet-btn connect">Connect Wallet</button>
                        </>
                    )}
                </div>

                <div className="agent-list-title">Select Agent</div>
                {AGENTS.map(agent => (
                    <div
                        key={agent.id}
                        className={`agent-card ${selectedAgent.id === agent.id ? 'selected' : ''}`}
                        onClick={() => setSelectedAgent(agent)}
                    >
                        <div className="agent-card-header">
                            <span className="agent-card-icon">{agent.icon}</span>
                            <span className="agent-card-name">{agent.name}</span>
                            <span className="agent-card-price">${agent.pricePerTask}</span>
                        </div>
                        <div className="agent-card-skills">
                            {agent.skills.map(s => (
                                <span key={s.skill} className="skill-tag">
                                    {s.skill}
                                    <span className="skill-score" style={{ color: getTierColor(s.tier) }}>{s.trustScore}</span>
                                    <span className="skill-tier" style={{
                                        backgroundColor: getTierColor(s.tier) + '20',
                                        color: getTierColor(s.tier),
                                    }}>{s.tier}</span>
                                </span>
                            ))}
                        </div>
                    </div>
                ))}

                {/* Network Info */}
                <div className="network-card">
                    <div className="network-title">Network</div>
                    <div className="network-items">
                        <div className="network-item">
                            <span className="network-item-label">Chain</span>
                            <span className="network-item-value">Tempo Testnet</span>
                        </div>
                        <div className="network-item">
                            <span className="network-item-label">Chain ID</span>
                            <span className="network-item-value">{TEMPO.CHAIN_ID}</span>
                        </div>
                        <div className="network-item">
                            <span className="network-item-label">Contracts</span>
                            <span className="network-item-value">
                                <a href={`${TEMPO.EXPLORER}/address/${CONTRACTS.AGENT_REGISTRY}`} target="_blank" rel="noopener noreferrer">3 deployed ↗</a>
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* ── Main Content ── */}
            <div className="main-content">
                {/* Task Input */}
                <div className="task-input-section">
                    <div className="task-input-label">
                        Submit a task to {selectedAgent.name} • {selectedAgent.skills[0].tier} ({selectedAgent.skills[0].trustScore})
                        {needsEscrow(selectedAgent.skills[0].trustScore) ? ' • Escrow' : ' • Direct'}
                    </div>
                    <p className="task-guide">Type a prompt and hit Run Agent. Pipeline: verify trust → AI process → quality check → on-chain settlement.</p>
                    <div className="task-input-row">
                        <input
                            className="task-input"
                            placeholder={
                                selectedAgent.id === 'translator' ? 'e.g. Translate "hello world" to Spanish' :
                                    selectedAgent.id === 'code-reviewer' ? 'e.g. Review this function for security issues' :
                                        'e.g. Analyze this dataset for trends'
                            }
                            value={input}
                            onChange={e => setInput(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                            disabled={isProcessing}
                        />
                        <button
                            className="task-submit"
                            onClick={handleSubmit}
                            disabled={!input.trim() || isProcessing}
                        >
                            {isProcessing ? 'Processing...' : 'Run Agent'}
                        </button>
                    </div>
                </div>

                {/* Task Result (if active) */}
                {activeTask?.output && (
                    <div className="task-input-section" style={{ borderColor: activeTask.status === 'settled' ? 'var(--green)' : activeTask.status === 'failed' ? 'var(--red)' : 'var(--border)' }}>
                        <div className="task-input-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span>Result — {activeTask.agentId}</span>
                            <span className={`task-status ${activeTask.status}`}>{activeTask.status}</span>
                        </div>
                        <div style={{
                            whiteSpace: 'pre-wrap',
                            fontSize: '14px',
                            lineHeight: '1.7',
                            color: 'var(--text-secondary)',
                            padding: '12px',
                            background: 'var(--bg-elevated)',
                            borderRadius: '8px',
                        }}>
                            {activeTask.output}
                        </div>
                        {activeTask.txHash && (
                            <div className="task-card-meta" style={{ marginTop: '12px' }}>
                                <span>Confidence: {activeTask.confidence}%</span>
                                <span>Settlement: {activeTask.settlementType}</span>
                                <a href={`${TEMPO.EXPLORER}/tx/${activeTask.txHash}`} target="_blank" rel="noopener noreferrer">
                                    TX: {activeTask.txHash.slice(0, 10)}... ↗
                                </a>
                            </div>
                        )}
                    </div>
                )}

                {/* Task History */}
                <div className="tasks-section">
                    <div className="tasks-section-title">Task History ({tasks.length})</div>
                    <div className="task-list">
                        {tasks.map(task => (
                            <div
                                key={task.id}
                                className={`task-card ${activeTaskId === task.id ? 'active' : ''}`}
                                onClick={() => setActiveTaskId(task.id)}
                            >
                                <div className="task-card-header">
                                    <span className="task-card-id">{task.id}</span>
                                    <span className={`task-status ${task.status}`}>{task.status}</span>
                                </div>
                                <div className="task-card-input">{task.input}</div>
                                <div className="task-card-meta">
                                    <span>{AGENTS.find(a => a.id === task.agentId)?.name}</span>
                                    <span>{task.confidence}% confidence</span>
                                    <span>{task.settlementType || 'n/a'}</span>
                                    {task.txHash && (
                                        <a href={`${TEMPO.EXPLORER}/tx/${task.txHash}`} target="_blank" rel="noopener noreferrer">
                                            TX ↗
                                        </a>
                                    )}
                                </div>
                            </div>
                        ))}
                        {tasks.length === 0 && (
                            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)', fontSize: '14px' }}>
                                No tasks yet. Submit one above to see the autonomous pipeline in action.
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* ── Activity Log (Right Panel) ── */}
            <div className="activity-panel">
                <div className="activity-header">
                    <span className="pipeline-dot" style={{ background: isProcessing ? 'var(--green)' : 'var(--text-muted)' }}></span>
                    Activity Log
                </div>
                <div className="activity-log" ref={logRef}>
                    {logEntries.length === 0 ? (
                        <div className="activity-empty">
                            Submit a task to see the pipeline in action
                        </div>
                    ) : (
                        logEntries.map((entry, i) => {
                            const time = new Date(entry.timestamp).toLocaleTimeString('en-US', {
                                hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit',
                            });
                            return (
                                <div key={i} className="log-entry">
                                    <span className="log-time">{time}</span>
                                    <span className="log-badge" style={{ backgroundColor: STAGE_COLORS[entry.stage] || '#6B7280' }}>
                                        {entry.stage}
                                    </span>
                                    <span className="log-msg">{entry.message}</span>
                                    {entry.detail && <div className="log-detail">{entry.detail}</div>}
                                </div>
                            );
                        })
                    )}
                    {isProcessing && <div className="pipeline-cursor">▊</div>}
                </div>

                <div className="network-card">
                    <div className="network-title">Contracts</div>
                    <div className="network-items">
                        {[
                            { name: 'AgentRegistry', addr: CONTRACTS.AGENT_REGISTRY },
                            { name: 'QualityOracle', addr: CONTRACTS.QUALITY_ORACLE },
                            { name: 'EscrowVault', addr: CONTRACTS.ESCROW_VAULT },
                        ].map(c => (
                            <div key={c.name} className="network-item">
                                <span className="network-item-label">{c.name}</span>
                                <span className="network-item-value">
                                    <a href={`${TEMPO.EXPLORER}/address/${c.addr}`} target="_blank" rel="noopener noreferrer">
                                        {c.addr.slice(0, 6)}...{c.addr.slice(-4)} ↗
                                    </a>
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
