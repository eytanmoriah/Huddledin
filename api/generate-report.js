export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { reportType, specialtyTemplate, formData, childInfo, specialistInfo } = req.body;

  if (!formData || !childInfo) {
    return res.status(400).json({ error: 'Missing form data or child info' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error('ANTHROPIC_API_KEY not set');
    return res.status(500).json({ error: 'AI service not configured' });
  }

  const systemPrompt = `You are a professional clinical report writer for pediatric therapy.
Generate a comprehensive ${reportType || 'session'} report for a ${specialtyTemplate || 'therapy'} specialist.

CRITICAL RULES:
- Write in the same language as the input data. If inputs are in Hebrew, write the entire report in Hebrew. If in English, write in English.
- Use professional clinical language appropriate for ${specialtyTemplate || 'therapy'}.
- Format with clear section headers using UPPERCASE.
- Include ALL data provided — do not omit any section.
- Where standardized test scores are provided, include professional interpretation.
- Maintain a professional but accessible tone.
- The report should be suitable for clinical records, insurance documentation, and parent communication.
- Do NOT add information that wasn't provided in the form data.
- Do NOT make up test scores or clinical findings.

Output the report as plain text with section headers in UPPERCASE followed by a blank line.`;

  const userPrompt = `Generate a ${reportType || 'session'} report with the following information:

Patient: ${childInfo.name || 'N/A'}
Date of Birth: ${childInfo.dob || 'N/A'}
Age: ${childInfo.age || 'N/A'}
Date of Report: ${new Date().toISOString().split('T')[0]}
Specialist: ${specialistInfo?.name || 'N/A'}${specialistInfo?.credentials ? ', ' + specialistInfo.credentials : ''}
Specialty: ${specialistInfo?.specialty || 'N/A'}

Form Data:
${JSON.stringify(formData, null, 2)}`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4000,
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
    const reportText = data.content?.[0]?.text || '';

    if (!reportText) {
      return res.status(500).json({ error: 'Empty response from AI' });
    }

    return res.status(200).json({ report: reportText });
  } catch (err) {
    console.error('Report generation error:', err);
    return res.status(500).json({ error: 'Failed to generate report' });
  }
}
