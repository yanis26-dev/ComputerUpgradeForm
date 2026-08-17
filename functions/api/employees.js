// GET /api/employees
//
// Public, read-only. Serves whatever the last HiBob sync stored in KV
// under 'directory:employees'. Returns an empty array (not an error) if
// no sync has run yet, so the form still works — just without autofill.

export async function onRequestGet({ env }) {
  try {
    const stored = await env.RESPONSES.get('directory:employees');
    return new Response(stored ?? '[]', {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err) {
    return new Response('[]', {
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
