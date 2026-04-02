export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { action } = req.body;
  if (!action) return res.status(400).json({ error: 'Missing action field' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'AI service not configured' });

  // ── GENERATE REPORT ──
  if (action === 'generate') {
    const { reportType, formData, childInfo, specialistInfo, writingStyle, sections } = req.body;
    if (!formData || !childInfo) return res.status(400).json({ error: 'Missing form data or child info' });

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
        headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: 4000, system: systemPrompt, messages: [{ role: 'user', content: userPrompt }] }),
      });
      if (!response.ok) { const err = await response.json().catch(() => ({})); console.error('Anthropic API error:', response.status, err); return res.status(500).json({ error: 'AI service error' }); }
      const data = await response.json();
      const reportText = data.content?.[0]?.text || '';
      if (!reportText) return res.status(500).json({ error: 'Empty response from AI' });
      return res.status(200).json({ report: reportText });
    } catch (err) { console.error('Report generation error:', err); return res.status(500).json({ error: 'Failed to generate report' }); }
  }

  // ── IMPORT TEMPLATE ──
  if (action === 'import') {
    const { documentBase64, mimeType, fileName } = req.body;
    if (!documentBase64) return res.status(400).json({ error: 'No document provided' });

    const systemPrompt = `You are a clinical report template analyzer. Given a clinical/therapy report document, extract:
1. The sections used (title, type: freetext/structured/mixed, and any structured fields with their types)
2. The writing style (formal/conversational, sentence length, use of clinical jargon, first/third person, etc.)
3. Any boilerplate text that appears standard/reusable

Return ONLY valid JSON with this exact structure:
{
  "name": "Template name based on report type",
  "description": "Brief description",
  "original_text": "The full plain-text content of the document, preserving paragraph breaks",
  "sections": [
    {
      "id": "unique_snake_case_id",
      "title": "Section Title",
      "type": "freetext|structured|mixed",
      "source_excerpt": "The exact text from the original document that this section was extracted from (verbatim, 1-3 sentences)",
      "fields": [
        { "id": "field_id", "label": "Field Label", "type": "textarea|text|dropdown|scale|checklist", "placeholder": "...", "options": ["opt1","opt2"] }
      ]
    }
  ],
  "writing_style": {
    "tone": "description of tone",
    "person": "first|third",
    "formality": "formal|semi-formal|conversational",
    "characteristics": ["list", "of", "style", "traits"],
    "sample_phrases": ["example phrases from the document"]
  }
}

Rules:
- Identify ALL distinct sections in the document
- For sections with structured data (scores, ratings, checklists), create appropriate field types
- For narrative/prose sections, use type "freetext" with a single textarea field
- Capture the specialist's unique writing voice in writing_style
- Include "original_text" with the full readable text of the document
- Include "source_excerpt" in each section with the verbatim text that section came from
- Return ONLY the JSON, no markdown fences or explanation`;

    const userContent = [{ type: 'text', text: 'Analyze this clinical report and extract a reusable template structure. Return JSON only.' }];
    const supportedTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/gif', 'image/webp'];
    if (supportedTypes.includes(mimeType)) {
      userContent.push({ type: mimeType === 'application/pdf' ? 'document' : 'image', source: { type: 'base64', media_type: mimeType, data: documentBase64 } });
    } else {
      userContent.push({ type: 'text', text: `[Document: ${fileName}, type: ${mimeType}. Content not directly readable.]\n\nBase64 (first 2000 chars): ${documentBase64.substring(0, 2000)}` });
    }

    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: 4000, system: systemPrompt, messages: [{ role: 'user', content: userContent }] }),
      });
      if (!response.ok) { const err = await response.json().catch(() => ({})); console.error('Import API error:', response.status, err); return res.status(500).json({ error: 'AI service error' }); }
      const data = await response.json();
      const text = data.content?.[0]?.text || '';
      let template;
      try { const jsonStr = text.replace(/^```json?\n?/m, '').replace(/\n?```$/m, '').trim(); template = JSON.parse(jsonStr); }
      catch (e) { console.error('Failed to parse template JSON:', text.substring(0, 500)); return res.status(500).json({ error: 'Could not parse AI response as template' }); }
      return res.status(200).json({ template });
    } catch (err) { console.error('Import template error:', err); return res.status(500).json({ error: 'Failed to analyze document' }); }
  }

  return res.status(400).json({ error: 'Unknown action: ' + action });
}
