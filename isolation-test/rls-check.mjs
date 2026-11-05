// RLS isolation test — CHECK. Dependency-free, Node 18+ (fetch built in).
//
// Usage (run on your own computer, with test-only credentials):
//   node rls-check.mjs <SUPABASE_URL> <ANON_KEY> <EMAIL_A> <PASS_A> <EMAIL_B> <PASS_B>
//
// SUPABASE_URL and ANON_KEY come from Dashboard -> Settings -> API.
// The anon key is publishable; keep it in your own terminal, never send
// it (or the passwords) to anyone. The script prints only business names,
// receipt vendors and PASS/FAIL lines.
//
// What it proves, per test user:
//   - sees exactly their own TEST business, not the other's;
//   - sees exactly their own TEST receipt, not the other's;
//   - sees only membership rows of their own business.
// A broken (leaking) policy makes a user see 2 businesses or 2 receipts,
// which fails the check. Exit code 0 = all PASS, 1 = any FAIL.

const [url, anonKey, emailA, passA, emailB, passB] = process.argv.slice(2);
if (!url || !anonKey || !emailA || !passA || !emailB || !passB) {
  console.error('Usage: node rls-check.mjs <SUPABASE_URL> <ANON_KEY> <EMAIL_A> <PASS_A> <EMAIL_B> <PASS_B>');
  process.exit(2);
}
const base = url.replace(/\/$/, '');

async function signIn(email, password) {
  const res = await fetch(`${base}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: anonKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error(`sign-in failed for ${email}: ${res.status} ${await res.text()}`);
  return (await res.json()).access_token;
}

async function query(token, table, select) {
  const res = await fetch(`${base}/rest/v1/${table}?select=${select}`, {
    headers: { apikey: anonKey, Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`query ${table} failed: ${res.status} ${await res.text()}`);
  return res.json();
}

let failures = 0;
function check(label, ok, detail) {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${label}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures++;
}

for (const [who, email, pass, wantBiz, wantVendor] of [
  ['A', emailA, passA, 'TEST-A', 'TEST-A receipt'],
  ['B', emailB, passB, 'TEST-B', 'TEST-B receipt'],
]) {
  const token = await signIn(email, pass);
  const businesses = await query(token, 'businesses', 'id,name');
  const receipts = await query(token, 'receipts', 'id,business_id,vendor');
  const memberships = await query(token, 'memberships', 'business_id,user_id');

  const bizNames = businesses.map((b) => b.name).sort();
  check(`user ${who} sees only business ${wantBiz}`, bizNames.length === 1 && bizNames[0] === wantBiz, `saw: ${bizNames.join(', ') || '(none)'}`);

  const vendors = receipts.map((r) => r.vendor).sort();
  check(`user ${who} sees only receipt ${wantVendor}`, vendors.length === 1 && vendors[0] === wantVendor, `saw: ${vendors.join(', ') || '(none)'}`);

  const ownBizIds = new Set(businesses.map((b) => b.id));
  const leakReceipts = receipts.filter((r) => !ownBizIds.has(r.business_id));
  check(`user ${who} has no receipts outside own business`, leakReceipts.length === 0, leakReceipts.length ? `leaked: ${leakReceipts.length}` : '');

  const leakMemberships = memberships.filter((m) => !ownBizIds.has(m.business_id));
  check(`user ${who} has no memberships outside own business`, leakMemberships.length === 0, leakMemberships.length ? `leaked: ${leakMemberships.length}` : '');
}

console.log(failures === 0 ? 'ALL PASS' : `${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
