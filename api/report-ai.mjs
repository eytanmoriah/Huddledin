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

