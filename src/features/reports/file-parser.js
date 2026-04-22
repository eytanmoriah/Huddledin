// File parsing utilities for template import — PDF and DOCX text extraction.
// Built as a separate bundle (file-parser.bundle.js), loaded on-demand via <script>.

import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import * as mammoth from 'mammoth';

const MAX_FILE_SIZE = 10 * 1024 * 1024;

export async function parsePdf(file) {
  // pdfjs-dist requires a worker. Pin version to match package.json — update if pdfjs-dist is upgraded.
  pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/legacy/build/pdf.worker.mjs';

  const buf = await file.arrayBuffer();
  console.log('[PDF_PARSE_DEBUG]', 'bufferSize=', buf.byteLength, 'getDocument=', typeof pdfjsLib.getDocument, 'version=', pdfjsLib.version || 'unknown');
  let doc;
  try {
    doc = await pdfjsLib.getDocument({ data: new Uint8Array(buf) }).promise;
  } catch (e) {
    console.error('[PDF_PARSE_DEBUG]', 'name=', e.name, 'message=', e.message, 'stack=', e.stack);
    if (e.name === 'PasswordException') throw new Error('Password-protected PDFs are not supported');
    if (e.name === 'InvalidPDFException') throw new Error('This file does not appear to be a valid PDF');
    const msg = e.message || e.name || 'unknown error';
    if (/worker/i.test(msg)) {
      console.warn('[PDF_PARSE_DEBUG] Worker setup may be broken');
      throw new Error('PDF parser could not initialize \u2014 please reload and try again');
    }
    throw new Error('PDF parse failed: ' + msg);
  }

  if (doc.numPages === 0) throw new Error('This PDF has no extractable text \u2014 it may be a scan that needs OCR');

  const paragraphs = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const tc = await page.getTextContent();
    if (!tc.items.length) continue;

    let currentLine = [];
    let lastY = null;
    const LINE_THRESHOLD = 3;

    for (const item of tc.items) {
      if (!item.str) continue;
      const y = Math.round(item.transform[5]);
      if (lastY !== null && Math.abs(y - lastY) > LINE_THRESHOLD) {
        const gap = Math.abs(y - lastY);
        const lineText = currentLine.join(' ').trim();
        if (lineText) paragraphs.push(lineText);
        if (gap > 14) paragraphs.push('');
        currentLine = [];
      }
      currentLine.push(item.str);
      lastY = y;
    }
    const trailing = currentLine.join(' ').trim();
    if (trailing) paragraphs.push(trailing);
    paragraphs.push('');
  }

  const text = paragraphs.join('\n').replace(/\n{3,}/g, '\n\n').trim();
  if (!text) throw new Error('This PDF has no extractable text \u2014 it may be a scan that needs OCR');
  return text;
}

export async function parseDocx(file) {
  const buf = await file.arrayBuffer();
  let result;
  try {
    result = await mammoth.extractRawText({ arrayBuffer: buf });
  } catch (e) {
    throw new Error('This Word document could not be read \u2014 it may be corrupted or encrypted');
  }

  if (result.messages?.length) {
    result.messages.forEach(m => console.log('[docx]', m.type + ':', m.message));
  }

  const text = (result.value || '').trim();
  if (!text) throw new Error('This Word document has no extractable text');
  return text;
}

export async function parseUploadedFile(file) {
  if (!file) throw new Error('No file provided');
  if (file.size > MAX_FILE_SIZE) throw new Error('File too large. Maximum 10MB.');

  const name = (file.name || '').toLowerCase();
  const type = file.type || '';

  let text, fileType;
  if (name.endsWith('.pdf') || type === 'application/pdf') {
    text = await parsePdf(file);
    fileType = 'pdf';
  } else if (name.endsWith('.docx') || type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    text = await parseDocx(file);
    fileType = 'docx';
  } else {
    throw new Error('Unsupported file type. Upload a PDF or Word (.docx) file.');
  }

  return { text, fileName: file.name, fileSize: file.size, fileType };
}

async function _getAccessToken() {
  const supa = window.HUD?._supa;
  if (!supa?.auth?.getSession) throw new Error('Not authenticated');
  const { data, error } = await supa.auth.getSession();
  if (error || !data?.session?.access_token) throw new Error('Not authenticated');
  return data.session.access_token;
}

export async function extractTemplate({ text, specialty, fileName }) {
  const token = await _getAccessToken();

  const resp = await fetch('/api/report-ai', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
    body: JSON.stringify({ action: 'import-to-tiptap', text, specialty: specialty || null, fileName }),
  });

  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) throw new Error(data.error || 'Template extraction failed (HTTP ' + resp.status + ')');
  if (!data.sections?.length) throw new Error('No sections returned');
  return { sections: data.sections };
}

if (typeof window !== 'undefined') {
  window.HUD_PARSE_FILE = parseUploadedFile;
  window.HUD_EXTRACT_TEMPLATE = extractTemplate;
}
