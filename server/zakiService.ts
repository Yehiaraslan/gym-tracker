/**
 * Agent Zaki Service
 * Connects to the openclaw-bridge MCP server to communicate with Agent Zaki.
 * Handles session initialization, message sending, and response parsing.
 */

import https from 'https';

const MCP_URL = 'https://mcp.alibondabo.com/mcp';
const MCP_TOKEN = 'pgVQg9o_Hza_FxvGd5T13xHtCa-XrYDuli3qMFt1fHI';

interface McpResponse {
  data: string;
  sessionId: string | undefined;
  status: number;
}

function mcpRequest(method: string, params: unknown, sessionId?: string): Promise<McpResponse> {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ jsonrpc: '2.0', id: 1, method, params });
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${MCP_TOKEN}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json, text/event-stream',
      'Content-Length': String(Buffer.byteLength(body)),
    };
    if (sessionId) headers['Mcp-Session-Id'] = sessionId;

    const req = https.request({
      hostname: 'mcp.alibondabo.com',
      path: '/mcp',
      method: 'POST',
      headers,
    }, (res) => {
      let data = '';
      const sid = res.headers['mcp-session-id'] as string | undefined;
      res.on('data', (d: Buffer) => data += d.toString());
      res.on('end', () => resolve({ data, sessionId: sid, status: res.statusCode ?? 0 }));
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function parseSSEText(raw: string): string | null {
  const lines = raw.split('\n');
  for (const line of lines) {
    if (line.startsWith('data: ')) {
      try {
        const parsed = JSON.parse(line.slice(6));
        if (parsed?.result?.content?.[0]?.text) return parsed.result.content[0].text;
        if (parsed?.error?.message) throw new Error(parsed.error.message);
      } catch (e) {
        if (e instanceof Error && e.message !== 'Unexpected token') throw e;
      }
    }
  }
  return null;
}

async function initSession(): Promise<string> {
  const init = await mcpRequest('initialize', {
    protocolVersion: '2024-11-05',
    capabilities: {},
    clientInfo: { name: 'gym-tracker', version: '1.0' },
  });

  // Extract session ID — response header may contain multiple values
  let sessionId = init.sessionId;
  if (sessionId?.includes(',')) {
    // Pick the UUID-format value
    sessionId = sessionId.split(',').map((s) => s.trim()).find((s) => /^[0-9a-f-]{36}$/.test(s));
  }
  if (!sessionId) throw new Error('Failed to get MCP session ID from openclaw-bridge');

  // Send initialized notification
  await mcpRequest('notifications/initialized', {}, sessionId);

  return sessionId;
}

/**
 * Ask Agent Zaki a question with full user context.
 * Automatically manages MCP session lifecycle.
 */
export async function askZaki(message: string): Promise<string> {
  const sessionId = await initSession();

  const resp = await mcpRequest('tools/call', {
    name: 'ask_agent',
    arguments: { agent: 'zaki', message },
  }, sessionId);

  const text = parseSSEText(resp.data);
  if (!text) throw new Error('No response from Agent Zaki');
  return text;
}

/**
 * Build a structured coaching prompt from user data and send to Zaki.
 */
export async function getZakiDailyCoaching(context: {
  recoveryScore?: number;
  hrv?: number;
  sleepHours?: number;
  sleepQuality?: number;
  todaySession?: string;
  lastWorkout?: { name: string; volume: number; date: string };
  recentWorkouts?: Array<{ name: string; volume: number; date: string; notes?: string }>;
  todayCalories?: number;
  todayProtein?: number;
  calorieTarget?: number;
  proteinTarget?: number;
  mesocycleWeek?: number;
  totalWeeks?: number;
  isDeloadWeek?: boolean;
}): Promise<string> {
  const lines: string[] = ['**DAILY COACHING REQUEST — GYM TRACKER APP**', ''];

  // Recovery & sleep
  if (context.recoveryScore !== undefined) {
    const status = context.recoveryScore >= 67 ? 'GREEN ✅' : context.recoveryScore >= 34 ? 'YELLOW ⚠️' : 'RED 🔴';
    lines.push(`**Recovery:** ${context.recoveryScore}% (${status})`);
  }
  if (context.hrv !== undefined) lines.push(`**HRV:** ${context.hrv}ms`);
  if (context.sleepHours !== undefined) lines.push(`**Sleep:** ${context.sleepHours.toFixed(1)}h${context.sleepQuality ? ` (quality: ${context.sleepQuality}%)` : ''}`);

  // Today's planned session
  if (context.todaySession) {
    lines.push(`**Today's planned session:** ${context.todaySession}`);
  }
  if (context.isDeloadWeek) lines.push('**⚠️ This is a DELOAD week**');
  if (context.mesocycleWeek) lines.push(`**Mesocycle:** Week ${context.mesocycleWeek}${context.totalWeeks ? ` of ${context.totalWeeks}` : ''}`);

  // Last workout
  if (context.lastWorkout) {
    lines.push(`**Last workout:** ${context.lastWorkout.name} on ${context.lastWorkout.date} — ${context.lastWorkout.volume.toLocaleString()}kg total volume`);
  }

  // Recent workouts with notes
  if (context.recentWorkouts && context.recentWorkouts.length > 0) {
    lines.push('**Recent sessions:**');
    for (const w of context.recentWorkouts.slice(0, 3)) {
      let line = `  - ${w.date}: ${w.name} (${w.volume.toLocaleString()}kg)`;
      if (w.notes) line += ` — Notes: "${w.notes}"`;
      lines.push(line);
    }
  }

  // Nutrition
  if (context.todayCalories !== undefined) {
    lines.push(`**Today's nutrition:** ${context.todayCalories}kcal${context.calorieTarget ? ` / ${context.calorieTarget}kcal target` : ''}, ${context.todayProtein ?? 0}g protein${context.proteinTarget ? ` / ${context.proteinTarget}g target` : ''}`);
  }

  lines.push('');
  lines.push('Give me your coaching decision for today. Be direct and specific — what should I do, how should I train, and what should I focus on nutritionally?');

  return askZaki(lines.join('\n'));
}

/**
 * Ask Zaki for a modified workout when recovery is yellow (34-66%).
 */
export async function getZakiWorkoutModification(context: {
  sessionName: string;
  recoveryScore: number;
  sleepHours?: number;
  exercises: Array<{ name: string; sets: number; reps: string; weight?: number }>;
}): Promise<string> {
  const lines = [
    `**WORKOUT MODIFICATION REQUEST**`,
    ``,
    `Recovery: ${context.recoveryScore}% (YELLOW — suboptimal)`,
    context.sleepHours ? `Sleep: ${context.sleepHours.toFixed(1)}h` : '',
    `Planned session: ${context.sessionName}`,
    ``,
    `Programmed exercises:`,
    ...context.exercises.map((e) => `  - ${e.name}: ${e.sets}×${e.reps}${e.weight ? ` @ ${e.weight}kg` : ''}`),
    ``,
    `Give me a modified version of this session that respects my yellow recovery. Be specific: which exercises to keep, which to cut, what % to reduce load, and target total volume range.`,
  ].filter(Boolean);

  return askZaki(lines.join('\n'));
}
