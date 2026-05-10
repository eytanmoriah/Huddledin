import { createClient } from '@supabase/supabase-js';
// NOTE: lib/rate-limit.mjs is ESM and this file is CommonJS (.js, no
// "type":"module" in package.json). Static import compiles to require()
// which can't load .mjs in Vercel's Node runtime → ERR_REQUIRE_ESM.
// Use dynamic import() inside the async handler instead — see below.

async function verifyAuth(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.split(' ')[1];
  const url = process.env.SUPABASE_URL || 'https://smgbojgrdezasxciloll.supabase.co';
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) return null;
  const supa = createClient(url, serviceKey);
  const { data: { user }, error } = await supa.auth.getUser(token);
  return (error || !user) ? null : user;
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ALLOWED_INVITE_HOSTS = new Set(['huddledin.com', 'www.huddledin.com']);

export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') return res.status(405).end();

  // Auth — verify caller is authenticated (any role; current callers are all parents)
  let user;
  try {
    user = await verifyAuth(req);
  } catch (e) {
    console.error('❌ send-invite auth:', e);
    return res.status(500).json({ error: 'Auth verification failed' });
  }
  if (!user) return res.status(401).json({ error: 'Authentication required' });

  const { to, childName, inviteLink, fromName, specialistRole } = req.body || {};

  // Validation in order: recipient, names, link, self-invite check.
  // All failures collapse to a single "Invalid input" 400 to avoid leaking
  // which field tripped — defensive against probing.
  if (typeof to !== 'string' || to.length === 0 || to.length > 320 || !EMAIL_RE.test(to)) {
    return res.status(400).json({ error: 'Invalid input' });
  }
  if (typeof childName !== 'string' || childName.length === 0 || childName.length > 100) {
    return res.status(400).json({ error: 'Invalid input' });
  }
  if (typeof fromName !== 'string' || fromName.length === 0 || fromName.length > 100) {
    return res.status(400).json({ error: 'Invalid input' });
  }
  if (specialistRole != null && (typeof specialistRole !== 'string' || specialistRole.length > 100)) {
    return res.status(400).json({ error: 'Invalid input' });
  }
  if (typeof inviteLink !== 'string') {
    return res.status(400).json({ error: 'Invalid input' });
  }
  let parsedInviteUrl;
  try { parsedInviteUrl = new URL(inviteLink); }
  catch { return res.status(400).json({ error: 'Invalid input' }); }
  if (parsedInviteUrl.protocol !== 'https:') {
    return res.status(400).json({ error: 'Invalid input' });
  }
  if (!ALLOWED_INVITE_HOSTS.has(parsedInviteUrl.hostname)) {
    return res.status(400).json({ error: 'Invalid input' });
  }
  if (to.toLowerCase() === (user.email || '').toLowerCase()) {
    return res.status(400).json({ error: 'Invalid input' });
  }

  // Rate limit — 20/hr per authenticated user. Failure mode: fail closed.
  // Dynamic import: see top-of-file note. lib/rate-limit.mjs is ESM-only.
  const { checkRateLimit, RATE_WINDOW_SECONDS } = await import('../lib/rate-limit.mjs');
  const rl = await checkRateLimit(user.id, 'send-invite', 20);
  if (!rl.ok) {
    const retry = rl.retryAfter || RATE_WINDOW_SECONDS;
    res.setHeader('Retry-After', String(retry));
    return res.status(429).json({
      error: 'Too many invites. Please try again later.',
      retryAfter: retry,
    });
  }

  // HTML-escape user-controlled text for the email body.
  // Subject uses unescaped childName (plaintext context); 100-char cap already enforced.
  // inviteLink is escaped too — defense in depth on top of the prefix allowlist,
  // since URLs after the prefix can contain `&` which must become `&amp;` in HTML.
  const sChildName = escapeHtml(childName);
  const sFromName = escapeHtml(fromName);
  const sSpecialistRole = specialistRole ? escapeHtml(specialistRole) : '';
  const sInviteLink = escapeHtml(inviteLink);

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: 'Huddledin <admin@huddledin.com>',
        to: [to],
        subject: `🤝 You've been invited to join ${childName}'s care team on Huddledin`,
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8"/>
            <meta name="viewport" content="width=device-width"/>
          </head>
          <body style="margin:0;padding:0;background:#f0fdf9;font-family:'Helvetica Neue',sans-serif">
            <div style="max-width:520px;margin:40px auto;background:#fff;border-radius:24px;
                        overflow:hidden;box-shadow:0 8px 32px rgba(0,0,0,.08);
                        border:1px solid #a7f3d0">

              <!-- Header -->
              <div style="background:linear-gradient(135deg,#0f766e,#0d9488,#2dd4bf);
                          padding:36px 32px;text-align:center">
                <div style="width:64px;height:64px;border-radius:20px;
                            background:rgba(255,255,255,.2);
                            border:2px solid rgba(255,255,255,.4);
                            display:inline-flex;align-items:center;justify-content:center;
                            font-size:2rem;margin-bottom:14px">🤝</div>
                <h1 style="font-family:Georgia,serif;color:#fff;margin:0;
                           font-size:1.8rem;font-weight:800">Huddledin</h1>
                <p style="color:rgba(255,255,255,.8);margin:6px 0 0;font-size:.9rem">
                  Collaborative care for children
                </p>
              </div>

              <!-- Body -->
              <div style="padding:36px 32px">
                <h2 style="color:#0f172a;font-size:1.3rem;margin:0 0 16px">
                  You've been invited! 🎉
                </h2>
                <p style="color:#64748b;line-height:1.7;margin:0 0 12px">
                  <strong style="color:#0f172a">${sFromName}</strong> has invited you to join
                  <strong style="color:#0f172a">${sChildName}</strong>'s care team on Huddledin
                  ${sSpecialistRole ? `as a <strong style="color:#0f172a">${sSpecialistRole}</strong>` : ''}.
                </p>
                <p style="color:#64748b;line-height:1.7;margin:0 0 32px">
                  Huddledin is a secure collaborative platform where families and specialists
                  work together to support children.
                </p>

                <!-- CTA Button -->
                <div style="text-align:center;margin:0 0 32px">
                  <a href="${sInviteLink}"
                     style="display:inline-block;background:linear-gradient(135deg,#0d9488,#2dd4bf);
                            color:#fff;padding:16px 40px;border-radius:999px;
                            text-decoration:none;font-weight:700;font-size:1rem;
                            box-shadow:0 4px 16px rgba(13,148,136,.35)">
                    Accept Invitation ✨
                  </a>
                </div>

                <!-- Info box -->
                <div style="background:#f0fdf9;border:1px solid #a7f3d0;
                            border-radius:16px;padding:18px 20px;margin-bottom:24px">
                  <p style="color:#0f766e;font-size:.85rem;font-weight:700;margin:0 0 6px">
                    What happens next?
                  </p>
                  <p style="color:#64748b;font-size:.84rem;line-height:1.6;margin:0">
                    Click the button above to create your free Huddledin account
                    (or sign in if you already have one). You'll automatically be
                    added to ${sChildName}'s care team.
                  </p>
                </div>

                <p style="color:#94a3b8;font-size:.78rem;text-align:center;margin:0">
                  This invitation expires in 7 days.<br/>
                  If you weren't expecting this email you can safely ignore it.
                </p>
              </div>

              <!-- Footer -->
              <div style="background:#f8fafc;padding:20px 32px;text-align:center;
                          border-top:1px solid #e2e8f0">
                <p style="color:#94a3b8;font-size:.76rem;margin:0">
                  Sent by Huddledin ·
                  <a href="https://huddledin.com" style="color:#0d9488;text-decoration:none">
                    huddledin.com
                  </a>
                </p>
              </div>

            </div>
          </body>
          </html>
        `
      })
    });

    const data = await response.json();
    console.log('Resend response:', response.status, JSON.stringify(data));

    if (!response.ok) {
      console.error('Resend error:', data);
      return res.status(500).json({ error: data.message || 'Email send failed' });
    }

    res.status(200).json({ ok: true, id: data.id });

  } catch (err) {
    console.error('send-invite exception:', err);
    res.status(500).json({ error: err.message });
  }
}
