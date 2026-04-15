import { createClient } from '@supabase/supabase-js';
import { checkRateLimit, RATE_LIMIT, RATE_WINDOW_SECONDS } from '../lib/rate-limit.mjs';

async function verifySpecAiAccess(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return { ok: false, error: 'Missing auth token', status: 401 };
  const token = authHeader.split(' ')[1];
  const url = process.env.SUPABASE_URL || 'https://smgbojgrdezasxciloll.supabase.co';
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) { console.error('SUPABASE_SERVICE_ROLE_KEY not set'); return { ok: false, error: 'Server misconfigured', status: 500 }; }
  const supa = createClient(url, serviceKey);
  const { data: { user }, error } = await supa.auth.getUser(token);
  if (error || !user) return { ok: false, error: 'Invalid or expired auth token', status: 401 };
  const { data: subs } = await supa.from('subscriptions').select('status,exempt,trial_ends_at').eq('user_id', user.id).eq('plan', 'specialist_ai').limit(1);
  const sub = subs?.[0];
  if (!sub) return { ok: false, error: 'No AI subscription found', status: 403 };
  if (sub.exempt) return { ok: true, user };
  if (sub.status === 'active') return { ok: true, user };
  if (sub.status === 'trial' && sub.trial_ends_at && new Date(sub.trial_ends_at) > new Date()) return { ok: true, user };
  return { ok: false, error: 'AI subscription expired', status: 403 };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  // Verify auth + subscription
  let auth;
  try { auth = await verifySpecAiAccess(req); } catch (e) { console.error('Auth check failed:', e); return res.status(500).json({ error: 'Auth verification failed' }); }
  if (!auth.ok) return res.status(auth.status).json({ error: auth.error });

  const rl = await checkRateLimit(auth.user.id, 'report-ai');
  if (!rl.ok) {
    return res.status(429).json({
      error: `Too many AI requests. Limit is ${RATE_LIMIT}/hour. Try again shortly.`,
      retryAfter: RATE_WINDOW_SECONDS
    });
  }

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
    const isDocx = mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    const isLegacyDoc = mimeType === 'application/msword';
    if (isLegacyDoc) return res.status(400).json({ error: 'Legacy .doc format is not supported. Please save as .docx in Microsoft Word and try again.' });
    if (!isDocx && !supported.includes(mimeType)) return res.status(400).json({ error: 'Unsupported file type: ' + mimeType + '. Upload PDF, DOCX, or image.' });

    console.log('[import-extract]', fileName, mimeType, 'base64:', documentBase64.length);

    // DOCX: extract text directly from the ZIP/XML (no AI needed)
    if (isDocx) {
      try {
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
// Uses the Central Directory (at end of ZIP) for reliable entry parsing.
// Local file headers can have size=0 when data descriptors are used,
// but the Central Directory always has correct sizes.
async function extractDocxText(buf) {
  const { inflateRawSync } = await import('zlib');

  // ── Locate End of Central Directory record (EOCD) ──
  // EOCD signature: PK\x05\x06 — scan backwards from end of file
  let eocdOff = -1;
  for (let i = buf.length - 22; i >= 0 && i >= buf.length - 65557; i--) {
    if (buf[i] === 0x50 && buf[i+1] === 0x4b && buf[i+2] === 0x05 && buf[i+3] === 0x06) {
      eocdOff = i; break;
    }
  }
  if (eocdOff === -1) throw new Error('Not a valid ZIP file (no EOCD record)');

  const cdEntries = buf.readUInt16LE(eocdOff + 10); // total entries in central directory
  const cdSize = buf.readUInt32LE(eocdOff + 12);     // size of central directory
  const cdOff = buf.readUInt32LE(eocdOff + 16);      // offset of central directory

  // ── Parse Central Directory entries ──
  // CD entry signature: PK\x01\x02
  const entries = [];
  let pos = cdOff;
  for (let n = 0; n < cdEntries && pos < buf.length - 4; n++) {
    if (buf[pos] !== 0x50 || buf[pos+1] !== 0x4b || buf[pos+2] !== 0x01 || buf[pos+3] !== 0x02) break;
    const method = buf.readUInt16LE(pos + 10);
    const compSize = buf.readUInt32LE(pos + 20);
    const nameLen = buf.readUInt16LE(pos + 28);
    const extraLen = buf.readUInt16LE(pos + 30);
    const commentLen = buf.readUInt16LE(pos + 32);
    const localHeaderOff = buf.readUInt32LE(pos + 42);
    const name = buf.toString('utf8', pos + 46, pos + 46 + nameLen);
    // Compute data offset from the local file header (skip past it to the actual data)
    const lfNameLen = buf.readUInt16LE(localHeaderOff + 26);
    const lfExtraLen = buf.readUInt16LE(localHeaderOff + 28);
    const dataStart = localHeaderOff + 30 + lfNameLen + lfExtraLen;
    entries.push({ name, method, compSize, dataStart });
    pos += 46 + nameLen + extraLen + commentLen;
  }

  // ── Find and decompress word/document.xml ──
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

  // ── Extract text from XML — get content of all <w:t> tags ──
  const parts = [];
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
