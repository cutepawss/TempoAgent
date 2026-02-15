import { NextResponse } from 'next/server';
import { AGENTS, generateTaskId } from '@/lib/agents';

// GET /api/tasks — Return available agents
export async function GET() {
    return NextResponse.json({
        agents: AGENTS.map(a => ({
            id: a.id,
            name: a.name,
            description: a.description,
            icon: a.icon,
            pricePerTask: a.pricePerTask,
            skills: a.skills,
        })),
        taskCount: 0,
    });
}

// POST /api/tasks — Generate a new task ID
export async function POST(request: Request) {
    try {
        const { agentId } = await request.json();
        const agent = AGENTS.find(a => a.id === agentId);
        if (!agent) {
            return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
        }
        return NextResponse.json({
            taskId: generateTaskId(),
            agent: agent.name,
            price: agent.pricePerTask,
        });
    } catch {
        return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }
}
