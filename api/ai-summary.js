export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { notes, childName } = req.body;

  if (!notes || !notes.trim()) {
    return res.status(400).json({ error: 'No notes provided' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error('ANTHROPIC_API_KEY not set');
    return res.status(500).json({ error: 'AI service not configured' });
  }

  const systemPrompt = `You are a specialist writing a brief parent-friendly summary of a therapy/clinical session.
Write 2-4 sentences that are warm, encouraging, and free of clinical jargon.
Focus on what the child worked on, any progress observed, and what parents can do at home.
Use the child's name naturally. Do not include greetings, sign-offs, or bullet points — just the summary paragraph.`;

  const userPrompt = `Here are the session notes for ${childName || 'the child'}. Write a parent-friendly summary:\n\n${notes}`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 300,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      console.error('Anthropic API error:', response.status, err);
      return res.status(500).json({ error: 'AI service error' });
    }

    const data = await response.json();
    const summary = data.content?.[0]?.text || '';

    if (!summary) {
      return res.status(500).json({ error: 'Empty response from AI' });
    }

    res.status(200).json({ summary });
  } catch (err) {
    console.error('AI summary error:', err);
    res.status(500).json({ error: 'Failed to generate summary' });
  }
}
