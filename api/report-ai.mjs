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

  // Fire-and-forget storage cleanup for report imports
  const _cleanup = (path) => {
    if (!path) return;
    const s = createClient(process.env.SUPABASE_URL || 'https://smgbojgrdezasxciloll.supabase.co', process.env.SUPABASE_SERVICE_ROLE_KEY);
    s.storage.from('specialist-storage').remove([path]).catch(err => console.error('⚠️ cleanup failed:', path, err));
  };

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
    const { storagePath, documentBase64, mimeType, fileName } = req.body;

    // Legacy base64 fallback for cached PWA bundles mid-deploy
    let buf;
    let _storagePath = storagePath || null;
    if (documentBase64) {
      console.warn('⚠️ legacy base64 import-extract path — remove after bundle cache clears');
      buf = Buffer.from(documentBase64, 'base64');
    } else if (_storagePath) {
      console.log('[import-extract] downloading from storage:', _storagePath);
      const dlSupa = createClient(process.env.SUPABASE_URL || 'https://smgbojgrdezasxciloll.supabase.co', process.env.SUPABASE_SERVICE_ROLE_KEY);
      const { data: dlData, error: dlErr } = await dlSupa.storage.from('specialist-storage').download(_storagePath);
      if (dlErr || !dlData) {
        console.error('[import-extract] storage download failed:', dlErr);
        return res.status(404).json({ error: 'File not found in storage' });
      }
      buf = Buffer.from(await dlData.arrayBuffer());
    } else {
      return res.status(400).json({ error: 'No document provided' });
    }

    const supported = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp'];
    const isDocx = mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    const isLegacyDoc = mimeType === 'application/msword';
    if (isLegacyDoc) { _cleanup(_storagePath); return res.status(400).json({ error: 'Legacy .doc format is not supported. Please save as .docx in Microsoft Word and try again.' }); }
    if (!isDocx && !supported.includes(mimeType)) { _cleanup(_storagePath); return res.status(400).json({ error: 'Unsupported file type: ' + mimeType + '. Upload PDF, DOCX, or image.' }); }

    console.log('[import-extract]', fileName, mimeType, buf.length, 'bytes');

    // DOCX: extract text directly from the ZIP/XML (no AI needed)
    if (isDocx) {
      try {
        const text = await extractDocxText(buf);
        console.log('[import-extract] DOCX text extracted:', text.length, 'chars');
        if (!text.trim()) { _cleanup(_storagePath); return res.status(422).json({ error: 'Could not extract text from DOCX. The file may be empty or corrupted.' }); }
        _cleanup(_storagePath);
        return res.status(200).json({ text });
      } catch (err) {
        console.error('[import-extract] DOCX parse error:', err.message);
        _cleanup(_storagePath);
        return res.status(422).json({ error: 'Could not read DOCX file: ' + err.message });
      }
    }

    // PDF/Image: use AI to extract text
    try {
      const docBase64 = buf.toString('base64');
      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514', max_tokens: 8000,
          system: 'Extract ALL text from this document verbatim. Preserve paragraph breaks and section headers. Return ONLY the plain text content, nothing else.',
          messages: [{ role: 'user', content: [
            { type: 'text', text: 'Extract all text from this document.' },
            { type: mimeType === 'application/pdf' ? 'document' : 'image', source: { type: 'base64', media_type: mimeType, data: docBase64 } }
          ]}],
        }),
      });
      if (!r.ok) {
        const eb = await r.text().catch(() => '');
        console.error('[import-extract] API error:', r.status, eb);
        let msg = 'AI error (HTTP ' + r.status + ')';
        try { msg = JSON.parse(eb).error?.message || msg; } catch (_) {}
        _cleanup(_storagePath);
        return res.status(502).json({ error: msg, details: eb.substring(0, 500) });
      }
      const d = await r.json();
      const txt = d.content?.[0]?.text || '';
      console.log('[import-extract] Got', txt.length, 'chars');
      if (!txt) { _cleanup(_storagePath); return res.status(502).json({ error: 'Could not extract text from document' }); }
      _cleanup(_storagePath);
      return res.status(200).json({ text: txt });
    } catch (err) {
      console.error('[import-extract]', err.message);
      _cleanup(_storagePath);
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

  // ── IMPORT TO TIPTAP: Extract sections for new editor ──
  if (action === 'import-to-tiptap') {
    const { text, specialty, fileName } = req.body;
    if (!text || typeof text !== 'string') return res.status(400).json({ error: 'Missing text' });
    if (text.length < 200) return res.status(400).json({ error: 'Document too short to extract as template (needs at least a few paragraphs)' });
    if (text.length > 40000) return res.status(400).json({ error: 'Document too long (maximum 40,000 characters)' });
    if (specialty !== undefined && specialty !== null && typeof specialty !== 'string') return res.status(400).json({ error: 'Invalid specialty' });

    console.log('[import-to-tiptap]', fileName || '(no name)', text.length, 'chars, specialty:', specialty || 'unspecified');

    const specLabel = specialty || 'unspecified';
    const sys = `You are helping a ${specLabel} specialist convert one of their existing reports or templates into a reusable template. The specialist will upload a document — it could be:

  Case A: A past report with real patient data filled in.
  Case B: An existing template with placeholder conventions (XX, XXX, [NAME], ___, etc.).
  Case C: A hybrid — partially a template, partially with real patient data.

Your job is to extract the STRUCTURE and PHRASING of the document and return a normalized template where patient-specific content is replaced with standardized placeholders.

CRITICAL PRINCIPLES:

1. PRESERVE THE SPECIALIST'S VOICE. Do not rewrite, paraphrase, or "improve" their prose. The specialist has developed their phrasing over years of practice. Copy their words exactly except where you are replacing patient-specific content with a placeholder.

2. ONLY REPLACE PATIENT-SPECIFIC CONTENT. Generic clinical phrases, section introductions, explanatory text, boilerplate — all of this stays EXACTLY as written. When in doubt, leave text alone rather than risk stripping generic content.

3. EVERY HEADER IS ITS OWN SECTION — NEVER FLATTEN.

   Documents often have headers at multiple visual levels (e.g. ALL CAPS headers AND Title Case headers). The output sections array is FLAT — there is no concept of "subsections" in our template system.

   Rule: Every line that looks like a header in the source becomes its own top-level section in your output. Do not merge visually-subordinate headers into their visual parent.

   A line is a "header" if it:
   - Appears alone on its line (not mid-sentence)
   - Is not a normal prose sentence or bullet point
   - Is followed by content (prose, list, or labeled fields) that applies to it
   - Uses any visual distinction (ALL CAPS, Title Case, bold, etc.) to separate itself from body text

   If the source has 12 header lines, your output has 12 sections. If it has 4, your output has 4. Match the source's header count exactly.

4. DO NOT TREAT THE DOCUMENT TITLE AS A SECTION. The VERY FIRST line of a document is often the document's overall title (e.g. "Summary Orofacial Myofunctional Therapy Evaluation", "Speech-Language Assessment Report"). This is the document's NAME, not a section. Skip it. Start your sections array from the first real section header (the second header-like line in the document, usually).

   To distinguish: a document title typically has no content directly below it (the first real section starts after a blank line). A section header has content directly below it.

PLACEHOLDER VOCABULARY:

Use these standardized placeholders for common patient-specific fields:

  [NAME]                — patient's first name, last name, or full name
  [PRONOUN_SUBJECT]     — he/she/they (when referring to the patient)
  [PRONOUN_OBJECT]      — him/her/them
  [PRONOUN_POSSESSIVE]  — his/her/their
  [AGE]                 — patient's current age
  [AGE_AT_MILESTONE]    — age at a specific past event (e.g. "sucked thumb until age [AGE_AT_MILESTONE]")
  [DOB]                 — date of birth
  [DATE]                — evaluation date, appointment date, or other specific dates
  [REFERRER]            — person or entity who referred the patient
  [CONCERN]             — primary reason for referral (one sentence or less)
  [DIAGNOSIS]           — medical or clinical diagnosis
  [SCHOOL]              — school name
  [GRADE]               — grade level or year in school (e.g. "year 2", "3rd grade", "kindergarten")
  [CAREGIVER]           — parent, mother, father, guardian (use specific term when given)
  [CLINICIAN_NAME]      — name of a referenced clinician, doctor, or therapist (NOT the author of the report)

For patient-specific content that doesn't fit the above, use descriptive free-form placeholders in the same bracket format:

  Example: [SPECIFIC_ASSESSMENT_OBSERVATION]
  Example: [MEASUREMENT_VALUE]
  Example: [PREVIOUS_THERAPY_DETAILS]
  Example: [FEEDING_DETAILS]

Use UPPERCASE_WITH_UNDERSCORES for placeholder names. Keep them short and descriptive.

INPUT RECOGNITION — EXISTING TEMPLATE CONVENTIONS:

If the source document already uses placeholder conventions, normalize them to our vocabulary. Watch for:

  - XX or XXX or X (as standalone tokens or mid-sentence) → usually [NAME]; determine from context if it's something else
  - Blank lines _____ → replace with the most fitting placeholder from our vocabulary
  - [NAME] [DATE] or similar bracketed tokens → keep or normalize to our vocabulary
  - "Dr. ..." or "Dr. ……" (doctor's name with trailing ellipsis) → [CLINICIAN_NAME]
  - "Ms. ..." or similar honorific + ellipsis → [CLINICIAN_NAME] or [CAREGIVER] from context
  - Trailing ellipses inside sentences (e.g. "Speech errors include…..") → descriptive free-form placeholder (e.g. [SPEECH_ERRORS])
  - Sentences that END with a transition word ("for", "with", "such as", "including") and then stop — the patient-specific detail was omitted. Add a descriptive free-form placeholder at the end (e.g. "previous speech therapy intervention for [PREVIOUS_THERAPY_DETAILS]")

HANDLING CLINICAL MEASUREMENTS:

Numeric values in a clinical exam structure (labeled fields like "Lip meter reading: 2.5 RU", "Maximum opening: 40mm") are typically patient-specific. Replace the number with [MEASUREMENT] while preserving the unit. Qualitative findings (e.g. "Normal", "slight lip incompetence", "Upright and well aligned") are generally written as clinical boilerplate and should be preserved as-is UNLESS the context strongly suggests they describe this specific patient.

If a measurement is embedded in prose (e.g. "The client achieved a score of 85 on the CELF"), replace with a placeholder: "The client achieved a score of [SCORE] on the CELF".

HANDLING DEVELOPMENTAL MILESTONE AGES:

When a report mentions ages at specific developmental events (e.g. "breastfed until age 1", "transitioned to solids at 5 months"), these are patient-specific and should be stripped. Use [AGE_AT_MILESTONE] for these references, not [AGE] (which is reserved for the patient's current age).

THE REPORT AUTHOR IS NOT A PLACEHOLDER:

The specialist who wrote the report (often named at the bottom in a signature block) is authoring the template. Their name and credentials are NOT patient data. Preserve them exactly.

OUTPUT FORMAT:

Return a structured set of sections using the return_template tool. Each section has a title (matching the source's section header) and body (the section's content with placeholders applied). Within section bodies:

  - Preserve paragraph breaks (use \\n\\n between paragraphs)
  - Preserve bullet lists or numbered lists as markdown lists
  - Preserve line breaks within lists
  - Do NOT add any content that wasn't in the source
  - Do NOT add explanatory notes or meta-commentary`;

    const tools = [{
      name: 'return_template',
      description: 'Returns the extracted template as a list of sections. Each section has a title and body.',
      input_schema: {
        type: 'object',
        properties: {
          sections: {
            type: 'array',
            description: 'Ordered list of sections extracted from the source document.',
            items: {
              type: 'object',
              properties: {
                title: { type: 'string', description: 'The section heading.' },
                body:  { type: 'string', description: 'The section body with [PLACEHOLDERS].' }
              },
              required: ['title', 'body']
            },
            minItems: 1
          }
        },
        required: ['sections']
      }
    }];

    try {
      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514', max_tokens: 6000, temperature: 0.3,
          system: sys,
          tools,
          tool_choice: { type: 'tool', name: 'return_template' },
          messages: [{ role: 'user', content: text }],
        }),
      });
      if (!r.ok) {
        const eb = await r.text().catch(() => '');
        console.error('[import-to-tiptap] API error:', r.status, eb);
        let msg = 'AI error (HTTP ' + r.status + ')';
        try { msg = JSON.parse(eb).error?.message || msg; } catch (_) {}
        return res.status(502).json({ error: msg, details: eb.substring(0, 500) });
      }
      const d = await r.json();
      const toolBlock = d.content?.find(b => b.type === 'tool_use' && b.name === 'return_template');
      if (!toolBlock?.input?.sections?.length) {
        console.error('[import-to-tiptap] No tool_use block or empty sections:', JSON.stringify(d.content).substring(0, 500));
        return res.status(502).json({ error: 'AI did not return expected structured output, please try again' });
      }
      console.log('[import-to-tiptap] OK:', toolBlock.input.sections.length, 'sections');
      return res.status(200).json({ sections: toolBlock.input.sections });
    } catch (err) {
      console.error('[import-to-tiptap]', err.message);
      return res.status(500).json({ error: 'Template extraction failed: ' + err.message });
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
