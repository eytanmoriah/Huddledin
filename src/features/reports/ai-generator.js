// AI Report Generation + Two-Step Template Import

async function _getAuthHeaders() {
  const _supa = window.HUD?._supa;
  if (!_supa) throw new Error('Not authenticated');
  const { data: { session } } = await _supa.auth.getSession();
  if (!session?.access_token) throw new Error('Session expired — please sign in again');
  return { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + session.access_token };
}

export async function generateReport({ reportType, formData, childInfo, specialistInfo, writingStyle, sections }) {
  const headers = await _getAuthHeaders();
  const response = await fetch('/api/report-ai', {
    method: 'POST',
    headers,
    body: JSON.stringify({ action: 'generate', reportType, formData, childInfo, specialistInfo, writingStyle, sections }),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to generate report');
  }
  const data = await response.json();
  return data.report;
}

// Validate file extension (primary) — MIME is unreliable on some systems
function _validateImportFile(file) {
  const MAX_SIZE = 20 * 1024 * 1024; // 20MB raw bytes
  if (file.size > MAX_SIZE) {
    throw new Error('Files over 20MB aren\'t supported. Try compressing or splitting the document.');
  }
  const ext = (file.name || '').split('.').pop().toLowerCase();
  const allowedExts = ['pdf', 'docx', 'png', 'jpg', 'jpeg'];
  const allowedMimes = [
    'application/pdf', 'image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ];
  if (ext === 'doc') {
    throw new Error('Legacy .doc format is not supported. Please save as .docx in Microsoft Word and try again.');
  }
  if (!allowedExts.includes(ext) && !allowedMimes.includes(file.type)) {
    throw new Error('Unsupported file type. Upload a PDF, DOCX, or image file.');
  }
  // Resolve mimeType from extension if browser reports empty/generic
  let mimeType = file.type;
  if (!mimeType || mimeType === 'application/octet-stream') {
    const mimeMap = { pdf: 'application/pdf', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg' };
    mimeType = mimeMap[ext] || file.type || 'application/octet-stream';
  }
  return mimeType;
}

// Two-step import: upload to Storage → extract text → analyze into template
export async function importTemplate(file, onStatus) {
  const mimeType = _validateImportFile(file);
  const _supa = window.HUD?._supa;
  if (!_supa) throw new Error('Not authenticated');

  const { data: { session } } = await _supa.auth.getSession();
  if (!session?.user?.id) throw new Error('Session expired — please sign in again');
  const userId = session.user.id;

  // Build safe storage path
  const safeName = (file.name || 'document').replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80);
  const rand = Math.random().toString(36).slice(2, 8);
  const storagePath = `${userId}/report-imports/${Date.now()}_${rand}_${safeName}`;

  // Step 0: Upload to Supabase Storage
  if (onStatus) onStatus('uploading');
  console.log('[import] Uploading to storage:', storagePath, file.size, 'bytes');
  const { error: uploadErr } = await _supa.storage.from('specialist-storage').upload(storagePath, file, { contentType: mimeType, upsert: false });
  if (uploadErr) {
    console.error('[import] Upload failed:', uploadErr);
    throw new Error('Upload failed: ' + (uploadErr.message || 'please try again'));
  }

  const headers = await _getAuthHeaders();

  // Step 1: Extract text from document
  if (onStatus) onStatus('extracting');
  console.log('[import] Step 1: Extracting text...');
  const extractRes = await fetch('/api/report-ai', {
    method: 'POST',
    headers,
    body: JSON.stringify({ action: 'import-extract', storagePath, mimeType, fileName: file.name }),
  });
  if (!extractRes.ok) {
    const err = await extractRes.json().catch(() => ({}));
    console.error('[import] Extract failed:', err);
    throw new Error('Couldn\'t read document: ' + (err.error || 'unknown error'));
  }
  const { text: originalText } = await extractRes.json();
  console.log('[import] Extracted', originalText.length, 'chars');

  // Step 2: Analyze text into template structure
  if (onStatus) onStatus('analyzing');
  console.log('[import] Step 2: Analyzing template...');
  const analyzeRes = await fetch('/api/report-ai', {
    method: 'POST',
    headers,
    body: JSON.stringify({ action: 'import-analyze', documentText: originalText }),
  });
  if (!analyzeRes.ok) {
    const err = await analyzeRes.json().catch(() => ({}));
    console.error('[import] Analyze failed:', err);
    throw new Error('Analysis failed: ' + (err.error || 'unknown error'));
  }
  const { template } = await analyzeRes.json();
  console.log('[import] Template:', template.name, template.sections?.length, 'sections');

  // Return template + original text (kept separate, not in AI response)
  return { template, originalText };
}
