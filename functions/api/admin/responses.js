// GET /api/admin/responses    -> list all responses
// DELETE /api/admin/responses -> { key } removes one response
//
// This route does not check a passcode itself. It relies on Cloudflare Access
// being configured to gate /admin/* and /api/admin/* at the edge (see README.md).
// If you deploy before setting up Access, this data is publicly readable —
// set up Access first.

export async function onRequestGet({ env }) {
  const list = await env.RESPONSES.list({ prefix: 'response:' });
  const items = [];

  for (const k of list.keys) {
    const value = await env.RESPONSES.get(k.name);
    if (value) {
      try {
        items.push({ key: k.name, data: JSON.parse(value) });
      } catch {
        // skip unreadable entries
      }
    }
  }

  items.sort((a, b) => new Date(b.data.timestamp) - new Date(a.data.timestamp));

  return new Response(JSON.stringify(items), {
    headers: { 'Content-Type': 'application/json' }
  });
}

export async function onRequestDelete({ request, env }) {
  let body;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400 });
  }

  if (!body?.key) {
    return new Response(JSON.stringify({ error: 'Missing key' }), { status: 400 });
  }

  await env.RESPONSES.delete(body.key);

  return new Response(JSON.stringify({ ok: true }), {
    headers: { 'Content-Type': 'application/json' }
  });
}
