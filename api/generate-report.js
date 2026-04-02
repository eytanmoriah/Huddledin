export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { reportType, formData, childInfo, specialistInfo, writingStyle, sections } = req.body;
  if (!formData || !childInfo) return res.status(400).json({ error: 'Missing form data or child info' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'AI service not configured' });

  const styleInstruction = writingStyle
    ? `WRITING STYLE: Match this specialist's personal writing style:\n${writingStyle}\n`
    : 'WRITING STYLE: Use standard professional clinical report language.\n';

  const systemPrompt = `You are a professional clinical report writer for pediatric therapy.
Generate a comprehensive ${reportType || 'clinical'} report.

CRITICAL RULES:
- Write in the same language as the input data. If Hebrew, write in Hebrew. If English, write in English.
- Use professional clinical language.
- Format with clear section headers in UPPERCASE followed by a blank line.
- Include ALL data provided — do not omit any section.
- Where standardized test scores are provided, include professional interpretation.
- Maintain a professional but accessible tone suitable for clinical records, insurance, and parent communication.
- Do NOT add information not provided. Do NOT invent test scores or findings.
- Include a professional signature block at the end with the specialist's name and credentials.

${styleInstruction}`;

  const sectionList = sections?.length ? '\nSections included: ' + sections.join(', ') + '\n' : '';

  const userPrompt = `Generate a ${reportType || 'clinical'} report:

Patient: ${childInfo.name || 'N/A'}
DOB: ${childInfo.dob || 'N/A'}
Age: ${childInfo.age || 'N/A'}
Date: ${new Date().toISOString().split('T')[0]}
Specialist: ${specialistInfo?.name || 'N/A'}${specialistInfo?.credentials ? ', ' + specialistInfo.credentials : ''}
Specialty: ${specialistInfo?.specialty || 'N/A'}
${sectionList}
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
    if (!reportText) return res.status(500).json({ error: 'Empty response from AI' });
    return res.status(200).json({ report: reportText });
  } catch (err) {
    console.error('Report generation error:', err);
    return res.status(500).json({ error: 'Failed to generate report' });
  }
}
