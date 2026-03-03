export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') return res.status(405).end();

  const { to, childName, inviteLink, fromName, specialistRole } = req.body;

  // Validate required fields
  if (!to || !childName || !inviteLink) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: 'Huddledin <hello@huddledin.com>',
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
                <strong style="color:#0f172a">${fromName}</strong> has invited you to join 
                <strong style="color:#0f172a">${childName}</strong>'s care team on Huddledin
                ${specialistRole ? `as a <strong style="color:#0f172a">${specialistRole}</strong>` : ''}.
              </p>
              <p style="color:#64748b;line-height:1.7;margin:0 0 32px">
                Huddledin is a secure collaborative platform where families and specialists 
                work together to support children with special needs.
              </p>

              <!-- CTA Button -->
              <div style="text-align:center;margin:0 0 32px">
                <a href="${inviteLink}"
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
                  added to ${childName}'s care team.
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
  if (!response.ok) return res.status(500).json({ error: data });
  res.status(200).json({ ok: true });
}
