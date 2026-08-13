// POST /api/submit
// Expects env.RESPONSES to be bound to a KV namespace in the Pages project settings.

export async function onRequestPost({ request, env }) {
  let payload;
  try {
    payload = await request.json();
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }

  if (!payload || typeof payload.name !== 'string' || !payload.name.trim() || !payload.device) {
    return json({ error: 'Missing required fields' }, 400);
  }

  const record = {
    timestamp: new Date().toISOString(),
    name: payload.name.trim().slice(0, 200),
    team: payload.team ?? null,
    priorityERP: payload.priorityERP ?? null,
    usbDevices: payload.usbDevices ?? null,
    solidworks: payload.solidworks ?? null,
    device: payload.device,
    macExperience: payload.macExperience ?? null,
    ackWarning: !!payload.ackWarning
  };

  const key = `response:${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  try {
    await env.RESPONSES.put(key, JSON.stringify(record));
  } catch (err) {
    return json({ error: 'Storage error' }, 500);
  }

  return json({ ok: true });
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}
