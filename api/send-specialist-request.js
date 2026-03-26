export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { to, specialistName, specialistRole, childNameHint, requestId } = req.body;

  if (!to || !specialistName || !requestId) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error('RESEND_API_KEY not set');
    return res.status(500).json({ error: 'Email service not configured' });
  }

  const appUrl = process.env.APP_URL || 'https://huddledin.com';
  const link = `${appUrl}?specialist_request=${requestId}`;

  const subject = `${specialistName} wants to join your child's care team on Huddledin`;

  const html = `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:480px;margin:0 auto;padding:24px">
      <div style="text-align:center;margin-bottom:24px">
        <div style="display:inline-block;width:48px;height:48px;background:#0d9488;border-radius:12px;line-height:48px;font-size:24px">&#129309;</div>
        <h2 style="color:#0f1a18;margin:12px 0 0;font-size:20px">Care Team Request</h2>
      </div>
      <p style="color:#333;font-size:15px;line-height:1.6">Hi,</p>
      <p style="color:#333;font-size:15px;line-height:1.6">
        <strong>${specialistName}</strong> (${specialistRole || 'Specialist'}) has sent a request to join
        <strong>${childNameHint || "your child"}'s</strong> care team on Huddledin.
      </p>
      <p style="color:#333;font-size:15px;line-height:1.6">
        Huddledin is a care coordination platform that connects families with their children's therapists and specialists.
      </p>
      <p style="text-align:center;margin:28px 0">
        <a href="${link}" style="background:#0d9488;color:white;padding:14px 32px;border-radius:10px;text-decoration:none;font-weight:600;font-size:15px;display:inline-block">
          Review Request
        </a>
      </p>
      <p style="color:#888;font-size:13px;line-height:1.5">
        If you don't have a Huddledin account yet, you'll be guided to create one for free.
      </p>
      <p style="color:#888;font-size:13px;line-height:1.5">
        If you weren't expecting this request, you can safely ignore this email.
      </p>
      <hr style="border:none;border-top:1px solid #e8f4f2;margin:24px 0">
      <p style="color:#aaa;font-size:11px;text-align:center">
        Huddledin &mdash; Care coordination for families
      </p>
    </div>
  `;

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Huddledin <noreply@huddledin.com>',
        to,
        subject,
        html,
      }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      console.error('Resend API error:', response.status, err);
      return res.status(500).json({ error: 'Failed to send email' });
    }

    res.status(200).json({ ok: true });
  } catch (err) {
    console.error('Email error:', err);
    res.status(500).json({ error: 'Failed to send email' });
  }
}
