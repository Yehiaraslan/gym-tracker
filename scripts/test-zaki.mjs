import https from 'https';

function mcpRequest(method, params, sessionId) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ jsonrpc: '2.0', id: 1, method, params });
    const headers = {
      'Authorization': 'Bearer pgVQg9o_Hza_FxvGd5T13xHtCa-XrYDuli3qMFt1fHI',
      'Content-Type': 'application/json',
      'Accept': 'application/json, text/event-stream',
      'Content-Length': Buffer.byteLength(body),
    };
    if (sessionId) headers['Mcp-Session-Id'] = sessionId;

    const req = https.request({
      hostname: 'mcp.alibondabo.com',
      path: '/mcp',
      method: 'POST',
      headers,
    }, (res) => {
      let data = '';
      const sid = res.headers['mcp-session-id'];
      res.on('data', (d) => data += d);
      res.on('end', () => resolve({ data, sessionId: sid, status: res.statusCode }));
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function parseSSE(raw) {
  const lines = raw.split('\n');
  for (const line of lines) {
    if (line.startsWith('data: ')) {
      try { return JSON.parse(line.slice(6)); } catch {}
    }
  }
  return null;
}

async function askZaki(message, sessionId) {
  const resp = await mcpRequest('tools/call', {
    name: 'ask_agent',
    arguments: { agent: 'zaki', message },
  }, sessionId);
  const parsed = parseSSE(resp.data);
  if (parsed?.result?.content?.[0]?.text) return parsed.result.content[0].text;
  if (parsed?.error) throw new Error(parsed.error.message);
  return resp.data;
}

async function main() {
  // Initialize session
  const init = await mcpRequest('initialize', {
    protocolVersion: '2024-11-05',
    capabilities: {},
    clientInfo: { name: 'gym-tracker', version: '1.0' },
  });
  
  // Extract session ID from response headers
  const rawHeaders = init.data;
  const sessionId = init.sessionId?.includes(',') 
    ? init.sessionId.split(',').map(s => s.trim()).find(s => s.includes('-'))
    : init.sessionId;
  
  console.log('Session ID:', sessionId);
  
  // Send notification initialized
  await mcpRequest('notifications/initialized', {}, sessionId);
  
  // Test ask_agent
  console.log('Asking Zaki...');
  const response = await askZaki(
    'Recovery score: 45% (yellow). Last workout: Upper A, 4200kg volume. Sleep: 6.5h. What do I do today?',
    sessionId
  );
  console.log('Zaki says:', response);
}

main().catch(console.error);
