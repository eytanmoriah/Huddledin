export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { documentBase64, mimeType, fileName } = req.body;
  if (!documentBase64) return res.status(400).json({ error: 'No document provided' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'AI service not configured' });

  const systemPrompt = `You are a clinical report template analyzer. Given a clinical/therapy report document, extract:
1. The sections used (title, type: freetext/structured/mixed, and any structured fields with their types)
2. The writing style (formal/conversational, sentence length, use of clinical jargon, first/third person, etc.)
3. Any boilerplate text that appears standard/reusable

Return ONLY valid JSON with this exact structure:
{
  "name": "Template name based on report type",
  "description": "Brief description",
  "sections": [
    {
      "id": "unique_snake_case_id",
      "title": "Section Title",
      "type": "freetext|structured|mixed",
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
- Return ONLY the JSON, no markdown fences or explanation`;

  const userContent = [
    { type: 'text', text: 'Analyze this clinical report and extract a reusable template structure. Return JSON only.' }
  ];

  // Send document as base64 - Claude supports PDF and images natively
  const supportedTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/gif', 'image/webp'];
  if (supportedTypes.includes(mimeType)) {
    userContent.push({
      type: mimeType === 'application/pdf' ? 'document' : 'image',
      source: { type: 'base64', media_type: mimeType, data: documentBase64 }
    });
  } else {
    // For unsupported types (docx etc), send as text description
    userContent.push({
      type: 'text',
      text: `[Document: ${fileName}, type: ${mimeType}. The document content was provided as base64 but this format is not directly readable. Please analyze based on any extracted text below.]\n\nBase64 content (first 2000 chars for context): ${documentBase64.substring(0, 2000)}`
    });
  }

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
        messages: [{ role: 'user', content: userContent }],
      }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      console.error('Import template API error:', response.status, err);
      return res.status(500).json({ error: 'AI service error' });
    }

    const data = await response.json();
    const text = data.content?.[0]?.text || '';

    // Parse JSON from response (may have markdown fences)
    let template;
    try {
      const jsonStr = text.replace(/^```json?\n?/m, '').replace(/\n?```$/m, '').trim();
      template = JSON.parse(jsonStr);
    } catch (e) {
      console.error('Failed to parse template JSON:', text.substring(0, 500));
      return res.status(500).json({ error: 'Could not parse AI response as template' });
    }

    return res.status(200).json({ template });
  } catch (err) {
    console.error('Import template error:', err);
    return res.status(500).json({ error: 'Failed to analyze document' });
  }
}
