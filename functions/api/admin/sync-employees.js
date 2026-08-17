// POST /api/admin/sync-employees
//
// Pulls the current active roster from HiBob's People API, reconciles it
// against this form's DEPARTMENTS structure (same one in index.html —
// keep both in sync if you edit either), and stores the result in KV
// under 'directory:employees'. The public /api/employees route (and the
// form itself) reads from that same KV entry.
//
// Requires two Cloudflare secrets: HIBOB_SERVICE_USER_ID, HIBOB_SERVICE_USER_TOKEN.
// Sits behind the same Cloudflare Access application as the rest of /api/admin/*.

// Keep this in sync with the DEPARTMENTS object in index.html.
const DEPARTMENTS = {
  'Cardo Ride': [],
  'Crew': [],
  'Finance, IT & Legal': ['F&A', 'Finance', 'IT', 'Legal'],
  'HR & Admin': [],
  'Management': [],
  'Marketing': ['Cardo Ride', 'Digital & Social Media', 'Studio'],
  'Operations': ['ATE', 'China OPS', 'Customer Support', 'EDM', 'Engineering', 'NPI', 'Quality', 'Sourcing & Procurement', 'Supply Chain'],
  'Outdoor': [],
  'Product Management': ['Product', 'Project'],
  'R&D': ['CSL', 'Hardware', 'Mechanics', 'N-iX', 'QA', 'R&D Projects', 'Software'],
  'Sales': ['APAC', 'EMEA', 'OPS', 'USA'],
  'Other': []
};

// Raw HiBob Department value -> canonical DEPARTMENTS key.
const DEPARTMENT_ALIASES = {
  'HR': 'HR & Admin'
};

// One-off, confirmed-by-name overrides — not general aliases.
const MANUAL_TEAM_OVERRIDES = {
  'Guy Heimann': 'Software',
  'Ivan Ygerev': 'QA',
  'Michael Sobolev': 'QA',
  'Timur Rajabov': 'QA',
  'Yuval Zinger': 'R&D Projects'
};

export async function onRequestPost({ env }) {
  const serviceUserId = env.HIBOB_SERVICE_USER_ID;
  const serviceUserToken = env.HIBOB_SERVICE_USER_TOKEN;

  if (!serviceUserId || !serviceUserToken) {
    return json({ error: 'HiBob credentials are not configured (missing HIBOB_SERVICE_USER_ID / HIBOB_SERVICE_USER_TOKEN secrets).' }, 500);
  }

  const authHeader = 'Basic ' + btoa(`${serviceUserId}:${serviceUserToken}`);

  let hibobRes;
  try {
    hibobRes = await fetch('https://api.hibob.com/v1/people/search', {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        fields: [
          'root.id',
          'root.email',
          'root.displayName',
          'work.title',
          'work.department',
          'work.customColumns.Team'
        ],
        showInactive: false,
        humanReadable: 'REPLACE'
      })
    });
  } catch (err) {
    return json({ error: 'Could not reach HiBob\u2019s API.' }, 502);
  }

  if (!hibobRes.ok) {
    let detail = '';
    try { detail = (await hibobRes.text()).slice(0, 500); } catch {}
    return json({ error: `HiBob API returned ${hibobRes.status}`, detail }, 502);
  }

  let payload;
  try {
    payload = await hibobRes.json();
  } catch {
    return json({ error: 'HiBob returned an unreadable response.' }, 502);
  }

  const employees = Array.isArray(payload.employees) ? payload.employees : [];

  let mapped = 0;
  let unmappedDept = 0;
  let unmappedTeam = 0;
  const records = [];

  for (const emp of employees) {
    const name = String(emp['/root/displayName'] ?? '').trim();
    const email = String(emp['/root/email'] ?? '').trim();
    const title = String(emp['/work/title'] ?? '').trim();
    const rawDept = String(emp['/work/department'] ?? '').trim();
    const rawTeam = String(emp['/work/customColumns/Team'] ?? '').trim();

    if (!name || !email) continue;

    const deptCandidate = DEPARTMENT_ALIASES[rawDept] || rawDept;
    const department = Object.prototype.hasOwnProperty.call(DEPARTMENTS, deptCandidate) ? deptCandidate : null;
    if (rawDept && !department) unmappedDept++;

    let subDepartment = null;
    if (department) {
      mapped++;
      const teamValue = MANUAL_TEAM_OVERRIDES[name] || rawTeam;
      if (teamValue && DEPARTMENTS[department].includes(teamValue)) {
        subDepartment = teamValue;
      } else if (teamValue) {
        unmappedTeam++;
      }
    }

    records.push({ name, email, title, department, subDepartment });
  }

  try {
    await env.RESPONSES.put('directory:employees', JSON.stringify(records));
    await env.RESPONSES.put('directory:lastSynced', new Date().toISOString());
  } catch (err) {
    return json({ error: 'Fetched HiBob data but failed to save it to KV.' }, 500);
  }

  return json({
    ok: true,
    total: records.length,
    mapped,
    unmappedDept,
    unmappedTeam,
    syncedAt: new Date().toISOString()
  });
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}
