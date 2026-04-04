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
- NAMING: Use the child's FULL NAME on first mention (e.g. "Erez Moriah"). Use FIRST NAME ONLY for all subsequent mentions (e.g. "Erez"). NEVER use "the client", "the patient", or "the child" — always refer to them by name.
- Format with clear section headers in UPPERCASE followed by a blank line.
- Include ALL data provided — do not omit any section.
- Where standardized test scores are provided, include professional interpretation.
- Maintain a professional but accessible tone suitable for clinical records, insurance, and parent communication.
- Do NOT add information not provided. Do NOT invent test scores or findings.
- Include a professional signature block at the end with the specialist's name and credentials.

${styleInstruction}`;

    const sectionList = sections?.length ? '\nSections included: ' + sections.join(', ') + '\n' : '';
    const userPrompt = `Generate a ${reportType || 'clinical'} report:\n\nPatient: ${childInfo.name || 'N/A'}\nDOB: ${childInfo.dob || 'N/A'}\nAge: ${childInfo.age || 'N/A'}\nDate: ${new Date().toISOString().split('T')[0]}\nSpecialist: ${specialistInfo?.name || 'N/A'}${specialistInfo?.credentials ? ', ' + specialistInfo.credentials : ''}\nSpecialty: ${specialistInfo?.specialty || 'N/A'}\n${sectionList}\nForm Data:\n${JSON.stringify(formData, null, 2)}`;

    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: 4000, system: systemPrompt, messages: [{ role: 'user', content: userPrompt }] }),
      });
      if (!response.ok) { const err = await response.json().catch(() => ({})); console.error('API error:', response.status, err); return res.status(500).json({ error: 'AI service error' }); }
      const data = await response.json();
      const reportText = data.content?.[0]?.text || '';
      if (!reportText) return res.status(500).json({ error: 'Empty response from AI' });
      return res.status(200).json({ report: reportText });
    } catch (err) { console.error('Report generation error:', err); return res.status(500).json({ error: 'Failed to generate report' }); }
  }

  // ── IMPORT STEP 1: Extract text from document ──
  if (action === 'import-extract') {
    const { documentBase64, mimeType, fileName } = req.body;
    if (!documentBase64) return res.status(400).json({ error: 'No document provided' });

    const supported = ['application/pdf', 'image/png', 'image/jpeg', 'image/gif', 'image/webp'];
    const docxTypes = ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/msword'];
    const isDocx = docxTypes.includes(mimeType);
    if (!isDocx && !supported.includes(mimeType)) return res.status(400).json({ error: 'Unsupported file type: ' + mimeType + '. Upload PDF, DOCX, or image.' });

    console.log('[import-extract]', fileName, mimeType, 'base64:', documentBase64.length);

    // DOCX: extract text directly from the ZIP/XML (no AI needed)
    if (isDocx) {
      try {
        const { Readable } = await import('stream');
        const { createInflateRaw } = await import('zlib');
        const buf = Buffer.from(documentBase64, 'base64');
        const text = await extractDocxText(buf);
        console.log('[import-extract] DOCX text extracted:', text.length, 'chars');
        if (!text.trim()) return res.status(422).json({ error: 'Could not extract text from DOCX. The file may be empty or corrupted.' });
        return res.status(200).json({ text });
      } catch (err) {
        console.error('[import-extract] DOCX parse error:', err.message);
        return res.status(422).json({ error: 'Could not read DOCX file: ' + err.message });
      }
    }

    // PDF/Image: use AI to extract text
    try {
      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514', max_tokens: 8000,
          system: 'Extract ALL text from this document verbatim. Preserve paragraph breaks and section headers. Return ONLY the plain text content, nothing else.',
          messages: [{ role: 'user', content: [
            { type: 'text', text: 'Extract all text from this document.' },
            { type: mimeType === 'application/pdf' ? 'document' : 'image', source: { type: 'base64', media_type: mimeType, data: documentBase64 } }
          ]}],
        }),
      });
      if (!r.ok) {
        const eb = await r.text().catch(() => '');
        console.error('[import-extract] API error:', r.status, eb);
        let msg = 'AI error (HTTP ' + r.status + ')';
        try { msg = JSON.parse(eb).error?.message || msg; } catch (_) {}
        return res.status(502).json({ error: msg, details: eb.substring(0, 500) });
      }
      const d = await r.json();
      const txt = d.content?.[0]?.text || '';
      console.log('[import-extract] Got', txt.length, 'chars');
      if (!txt) return res.status(502).json({ error: 'Could not extract text from document' });
      return res.status(200).json({ text: txt });
    } catch (err) {
      console.error('[import-extract]', err.message);
      return res.status(500).json({ error: 'Text extraction failed: ' + err.message });
    }
  }

  // ── IMPORT STEP 2: Analyze text into template ──
  if (action === 'import-analyze') {
    const { documentText } = req.body;
    if (!documentText) return res.status(400).json({ error: 'No document text provided' });

    console.log('[import-analyze]', documentText.length, 'chars');
    const sys = `You are a clinical report template analyzer. Given report text, extract its template structure.

Return ONLY valid JSON:
{
  "name": "Template name",
  "description": "Brief description",
  "sections": [
    {"id": "snake_case_id", "title": "Section Title", "type": "freetext|structured|mixed", "fields": [
      {"id": "field_id", "label": "Label", "type": "textarea|text|dropdown|scale|checklist", "placeholder": "...", "options": ["a","b"]}
    ]}
  ],
  "writing_style": {
    "tone": "...", "person": "first|third", "formality": "formal|semi-formal|conversational",
    "characteristics": ["trait1", "trait2"], "sample_phrases": ["phrase1", "phrase2"]
  }
}

Rules: identify ALL sections, use appropriate field types, capture writing voice. Do NOT include document text in response. Return ONLY JSON.`;

    try {
      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514', max_tokens: 4000, system: sys,
          messages: [{ role: 'user', content: 'Analyze this report and return a template structure as JSON:\n\n' + documentText }],
        }),
      });
      if (!r.ok) {
        const eb = await r.text().catch(() => '');
        console.error('[import-analyze] API error:', r.status, eb);
        let msg = 'AI error (HTTP ' + r.status + ')';
        try { msg = JSON.parse(eb).error?.message || msg; } catch (_) {}
        return res.status(502).json({ error: msg, details: eb.substring(0, 500) });
      }
      const d = await r.json();
      const txt = d.content?.[0]?.text || '';
      console.log('[import-analyze] Response:', txt.length, 'chars');
      if (!txt) return res.status(502).json({ error: 'Empty AI response' });

      let template;
      try {
        template = JSON.parse(txt.replace(/^```json?\s*\n?/gm, '').replace(/\n?\s*```\s*$/gm, '').trim());
      } catch (e) {
        console.error('[import-analyze] Parse failed:', txt.substring(0, 500));
        return res.status(422).json({ error: 'AI response was not valid JSON — try again.', details: txt.substring(0, 1000) });
      }
      console.log('[import-analyze] OK:', template.name, template.sections?.length, 'sections');
      return res.status(200).json({ template });
    } catch (err) {
      console.error('[import-analyze]', err.message);
      return res.status(500).json({ error: 'Analysis failed: ' + err.message });
    }
  }

  return res.status(400).json({ error: 'Unknown action: ' + action });
}

// Extract text from DOCX (ZIP of XML) — no external dependencies
async function extractDocxText(buf) {
  const { inflateRawSync } = await import('zlib');

  // Minimal ZIP parser — find entries, locate word/document.xml
  const entries = [];
  let i = 0;
  while (i < buf.length - 4) {
    // Local file header signature: PK\x03\x04
    if (buf[i] === 0x50 && buf[i+1] === 0x4b && buf[i+2] === 0x03 && buf[i+3] === 0x04) {
      const method = buf.readUInt16LE(i + 8);
      const compSize = buf.readUInt32LE(i + 18);
      const uncompSize = buf.readUInt32LE(i + 22);
      const nameLen = buf.readUInt16LE(i + 26);
      const extraLen = buf.readUInt16LE(i + 28);
      const name = buf.toString('utf8', i + 30, i + 30 + nameLen);
      const dataStart = i + 30 + nameLen + extraLen;
      entries.push({ name, method, compSize, uncompSize, dataStart });
      i = dataStart + compSize;
    } else {
      i++;
    }
  }

  // Find word/document.xml
  const docEntry = entries.find(e => e.name === 'word/document.xml');
  if (!docEntry) throw new Error('No word/document.xml found in DOCX');

  let xml;
  const raw = buf.slice(docEntry.dataStart, docEntry.dataStart + docEntry.compSize);
  if (docEntry.method === 0) {
    xml = raw.toString('utf8'); // stored (no compression)
  } else if (docEntry.method === 8) {
    xml = inflateRawSync(raw).toString('utf8'); // deflated
  } else {
    throw new Error('Unsupported compression method: ' + docEntry.method);
  }

  // Extract text from XML — get content of all <w:t> tags
  const parts = [];
  let inParagraph = false;
  // Split by paragraph boundaries
  const paragraphs = xml.split(/<\/w:p>/);
  for (const para of paragraphs) {
    const texts = [];
    const re = /<w:t[^>]*>([^<]*)<\/w:t>/g;
    let m;
    while ((m = re.exec(para)) !== null) {
      texts.push(m[1]);
    }
    if (texts.length) parts.push(texts.join(''));
  }

  return parts.join('\n').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").trim();
}
