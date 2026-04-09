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

// Two-step import: extract text first, then analyze into template
export async function importTemplate(file) {
  // Validate file type
  const supported = ['application/pdf', 'image/png', 'image/jpeg', 'image/gif', 'image/webp',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/msword'];
  if (!supported.includes(file.type)) {
    throw new Error('Please upload a PDF, DOCX, or image file.');
  }

  const base64 = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  const headers = await _getAuthHeaders();

  // Step 1: Extract text from document
  console.log('[import] Step 1: Extracting text...');
  const extractRes = await fetch('/api/report-ai', {
    method: 'POST',
    headers,
    body: JSON.stringify({ action: 'import-extract', documentBase64: base64, mimeType: file.type, fileName: file.name }),
  });
  if (!extractRes.ok) {
    const err = await extractRes.json().catch(() => ({}));
    console.error('[import] Extract failed:', err);
    throw new Error(err.error || 'Failed to read document');
  }
  const { text: originalText } = await extractRes.json();
  console.log('[import] Extracted', originalText.length, 'chars');

  // Step 2: Analyze text into template structure
  console.log('[import] Step 2: Analyzing template...');
  const analyzeRes = await fetch('/api/report-ai', {
    method: 'POST',
    headers,
    body: JSON.stringify({ action: 'import-analyze', documentText: originalText }),
  });
  if (!analyzeRes.ok) {
    const err = await analyzeRes.json().catch(() => ({}));
    console.error('[import] Analyze failed:', err);
    throw new Error(err.error || 'Failed to analyze document');
  }
  const { template } = await analyzeRes.json();
  console.log('[import] Template:', template.name, template.sections?.length, 'sections');

  // Return template + original text (kept separate, not in AI response)
  return { template, originalText };
}
