/**
 * Agent Zaki Service
 * Connects to the openclaw-bridge MCP server to communicate with Agent Zaki.
 * Handles session initialization, message sending, and response parsing.
 * Supports conversation continuity via Zaki session_id.
 */

import https from 'https';

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
        if (e instanceof Error && !e.message.startsWith('Unexpected token')) throw e;
        // JSON parse failure on SSE chunk — skip to next line
      }
    }
  }
  return null;
}

async function initMcpSession(): Promise<string> {
  const init = await mcpRequest('initialize', {
    protocolVersion: '2024-11-05',
    capabilities: {},
    clientInfo: { name: 'gym-tracker', version: '1.0' },
  });

  // Extract session ID — response header may contain multiple values
  let sessionId = init.sessionId;
  if (sessionId?.includes(',')) {
    sessionId = sessionId.split(',').map((s) => s.trim()).find((s) => /^[0-9a-f-]{36}$/.test(s));
  }
  if (!sessionId) throw new Error('Failed to get MCP session ID from openclaw-bridge');

  // Send initialized notification
  await mcpRequest('notifications/initialized', {}, sessionId);

  return sessionId;
}

/**
 * Ask Agent Zaki a question.
 *
 * @param message - The message to send to Zaki
 * @param zakiSessionId - Optional Zaki conversation session ID for continuity.
 *   Pass the same ID across calls to maintain context within a conversation.
 * @returns { response, zakiSessionId } — response text and session ID to reuse
 */
export async function askZaki(
  message: string,
  zakiSessionId?: string,
): Promise<{ response: string; zakiSessionId: string }> {
  const mcpSessionId = await initMcpSession();

  const resp = await mcpRequest('tools/call', {
    name: 'ask_agent',
    arguments: {
      agent: 'zaki',
      message,
      ...(zakiSessionId ? { session_id: zakiSessionId } : {}),
    },
  }, mcpSessionId);

  const rawText = parseSSEText(resp.data);
  if (!rawText) throw new Error('No response from Agent Zaki');

  // Try to extract session_id from response metadata
  let returnedSessionId = zakiSessionId ?? '';
  try {
    const lines = resp.data.split('\n');
    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const parsed = JSON.parse(line.slice(6));
        const sid =
          parsed?.result?.session_id ??
          parsed?.result?.metadata?.session_id ??
          parsed?.session_id;
        if (sid) { returnedSessionId = sid; break; }
      }
    }
  } catch {}

  // Fallback: generate a stable session ID for this conversation
  if (!returnedSessionId) returnedSessionId = `gym-zaki-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

  return { response: rawText, zakiSessionId: returnedSessionId };
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

  if (context.recoveryScore !== undefined) {
    const status = context.recoveryScore >= 67 ? 'GREEN ✅' : context.recoveryScore >= 34 ? 'YELLOW ⚠️' : 'RED 🔴';
    lines.push(`**Recovery:** ${context.recoveryScore}% (${status})`);
  }
  if (context.hrv !== undefined) lines.push(`**HRV:** ${context.hrv}ms`);
  if (context.sleepHours !== undefined) lines.push(`**Sleep:** ${context.sleepHours.toFixed(1)}h${context.sleepQuality ? ` (quality: ${context.sleepQuality}%)` : ''}`);

  if (context.todaySession) lines.push(`**Today's planned session:** ${context.todaySession}`);
  if (context.isDeloadWeek) lines.push('**⚠️ This is a DELOAD week**');
  if (context.mesocycleWeek) lines.push(`**Mesocycle:** Week ${context.mesocycleWeek}${context.totalWeeks ? ` of ${context.totalWeeks}` : ''}`);

  if (context.lastWorkout) {
    lines.push(`**Last workout:** ${context.lastWorkout.name} on ${context.lastWorkout.date} — ${context.lastWorkout.volume.toLocaleString()}kg total volume`);
  }

  if (context.recentWorkouts && context.recentWorkouts.length > 0) {
    lines.push('**Recent sessions:**');
    for (const w of context.recentWorkouts.slice(0, 3)) {
      let line = `  - ${w.date}: ${w.name} (${w.volume.toLocaleString()}kg)`;
      if (w.notes) line += ` — Notes: "${w.notes}"`;
      lines.push(line);
    }
  }

  // Nutrition excluded from Zaki coaching context (per user request)

  lines.push('');
  lines.push('Give me your coaching decision for today. Be direct and specific:');
  lines.push('1. Should I train today or rest? If training, confirm the session type.');
  lines.push('2. Based on my recovery score, should I adjust my working weights? If recovery <50%, suggest specific % reductions for compound lifts.');
  lines.push('3. What should I focus on nutritionally today? Reference my actual intake vs targets.');
  lines.push('4. Any specific exercise modifications based on my recent performance trends?');
  lines.push('Be data-driven — reference my actual numbers, not generic advice.');

  const result = await askZaki(lines.join('\n'));
  return result.response;
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
      `Give me a modified version of this session that respects my yellow recovery. Be specific:`,
      `1. Which exercises to keep and which to cut or swap`,
      `2. Exact weight reductions in kg (not just %) for each exercise based on my recent numbers`,
      `3. Adjusted rep ranges and total set count`,
      `4. Target total volume range for this modified session`,
      `5. Any warm-up or mobility additions to compensate for low recovery`,
  ].filter(Boolean);

  const result = await askZaki(lines.join('\n'));
  return result.response;
}

/**
 * Call a vision-capable LLM model with an optional base64 image.
 * Used for: nutrition photo logging, form review, equipment verification.
 */
export async function callVisionModel(
  prompt: string,
  imageBase64?: string,
  mimeType: string = 'image/jpeg',
): Promise<{ response: string }> {
  const { invokeLLM } = await import('./_core/llm.js');
  const content: Array<{ type: string; text?: string; image_url?: { url: string } }> = [
    { type: 'text', text: prompt },
  ];
  if (imageBase64) {
    content.push({
      type: 'image_url',
      image_url: { url: `data:${mimeType};base64,${imageBase64}` },
    });
  }
  const result = await invokeLLM({
    messages: [{ role: 'user', content: content as any }],
  });
  const response = result.choices?.[0]?.message?.content ?? '';
  return { response: typeof response === 'string' ? response : JSON.stringify(response) };
}
