// PDF generation using jsPDF with Hebrew font support + branding

function hexToRgb(hex) {
  const h = (hex || '#0d9488').replace('#', '');
  return { r: parseInt(h.substring(0, 2), 16) || 13, g: parseInt(h.substring(2, 4), 16) || 148, b: parseInt(h.substring(4, 6), 16) || 136 };
}

let _jspdfLoaded = false;
let _hebrewFontLoaded = false;
let _hebrewFontData = null; // arraybuffer

async function ensureJsPDF() {
  if (_jspdfLoaded || window.jspdf) { _jspdfLoaded = true; return; }
  await new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
    s.onload = () => { _jspdfLoaded = true; resolve(); };
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

function hasHebrew(text) {
  return /[\u0590-\u05FF]/.test(text || '');
}

async function ensureHebrewFont() {
  if (_hebrewFontLoaded) return;
  // Load Noto Sans Hebrew Regular from Google Fonts static CDN
  const url = 'https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/notosanshebrew/NotoSansHebrew%5Bwdth%2Cwght%5D.ttf';
  try {
    const resp = await fetch(url);
    if (!resp.ok) throw new Error('Font fetch failed: ' + resp.status);
    _hebrewFontData = await resp.arrayBuffer();
    _hebrewFontLoaded = true;
    console.log('[pdf] Hebrew font loaded:', _hebrewFontData.byteLength, 'bytes');
  } catch (e) {
    console.error('[pdf] Could not load Hebrew font:', e.message);
    // Fallback: try a lighter font
    try {
      const resp2 = await fetch('https://cdn.jsdelivr.net/gh/nicholasgasior/gfonts-noto-sans-hebrew@master/fonts/NotoSansHebrew-Regular.ttf');
      if (resp2.ok) { _hebrewFontData = await resp2.arrayBuffer(); _hebrewFontLoaded = true; }
    } catch (e2) { console.error('[pdf] Fallback font also failed'); }
  }
}

function registerHebrewFont(doc) {
  if (!_hebrewFontData) return false;
  try {
    // Convert arraybuffer to base64 string
    const bytes = new Uint8Array(_hebrewFontData);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    const b64 = btoa(binary);
    doc.addFileToVFS('NotoSansHebrew-Regular.ttf', b64);
    doc.addFont('NotoSansHebrew-Regular.ttf', 'NotoSansHebrew', 'normal');
    return true;
  } catch (e) {
    console.error('[pdf] Font registration failed:', e);
    return false;
  }
}

// Reverse Hebrew lines for RTL rendering in jsPDF (which only does LTR)
function bidiLine(text) {
  // jsPDF renders left-to-right. For Hebrew text, we reverse the character order
  // so it appears correctly when rendered LTR.
  if (!hasHebrew(text)) return text;
  // Split into runs of Hebrew vs non-Hebrew, reverse Hebrew runs
  // Simple approach: if mostly Hebrew, reverse the whole line
  const hebrewChars = (text.match(/[\u0590-\u05FF]/g) || []).length;
  if (hebrewChars > text.replace(/\s/g, '').length * 0.3) {
    // Reverse the string but keep numbers/punctuation in correct order
    return text.split('').reverse().join('');
  }
  return text;
}

export async function generatePDFBlob(reportText, reportType, childInfo, specialistInfo, branding) {
  await ensureJsPDF();
  const { jsPDF } = window.jspdf;
  if (!jsPDF) throw new Error('PDF library failed to load');

  const isHeb = hasHebrew(reportText);
  if (isHeb) await ensureHebrewFont();
  const brand = branding || {};
  console.log('[pdf] Branding received:', JSON.stringify({ practice_name: brand.practice_name, header_color: brand.header_color, footer_text: brand.footer_text, logo: !!brand.logo_storage_path }));
  const headerColor = hexToRgb(brand.header_color || '#0d9488');
  const footerText = brand.footer_text !== undefined ? brand.footer_text : 'Confidential — For Clinical Use Only';

  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const marginL = 20, marginR = 20, marginT = 20, marginB = 20;
  const contentW = pageW - marginL - marginR;
  let y = marginT;

  // Register Hebrew font if needed
  let hebrewOK = false;
  if (isHeb) hebrewOK = registerHebrewFont(doc);
  const setFont = (style) => {
    if (isHeb && hebrewOK) doc.setFont('NotoSansHebrew', style || 'normal');
    else doc.setFont(undefined, style || 'normal');
  };
  // For Hebrew, text aligns right
  const textAlign = isHeb ? 'right' : 'left';
  const textX = isHeb ? (pageW - marginR) : marginL;

  const addPage = () => { doc.addPage(); y = marginT; };
  const checkSpace = (needed) => { if (y + needed > pageH - marginB) addPage(); };

  // ── Header with branding ──
  const headerName = brand.practice_name || 'Huddledin';
  console.log('[pdf] Rendering header:', headerName, 'color:', headerColor, 'at y:', y);
  doc.setFontSize(18);
  doc.setTextColor(headerColor.r, headerColor.g, headerColor.b);
  doc.setFont('helvetica', 'bold');
  doc.text(headerName, pageW / 2, y, { align: 'center' });
  y += 7;
  // Practice details line
  const detailParts = [brand.practice_address, brand.practice_phone, brand.practice_email].filter(Boolean);
  if (detailParts.length) {
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.setFont('helvetica', 'normal');
    doc.text(detailParts.join(' \u00B7 '), pageW / 2, y, { align: 'center' });
    y += 5;
  }
  // Report type
  doc.setFontSize(13);
  doc.setTextColor(30, 41, 59);
  doc.setFont('helvetica', 'normal');
  doc.text(reportType || 'Clinical Report', pageW / 2, y, { align: 'center' });
  y += 6;
  doc.setDrawColor(headerColor.r, headerColor.g, headerColor.b);
  doc.setLineWidth(0.5);
  doc.line(marginL, y, pageW - marginR, y);
  y += 8;

  // ── Patient info ──
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);
  doc.setFont('helvetica', 'normal');
  const date = new Date().toLocaleDateString(isHeb ? 'he-IL' : 'en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const infoLines = [
    [(isHeb ? 'מטופל: ' : 'Patient: ') + (childInfo?.name || '—'), (isHeb ? 'ת. לידה: ' : 'DOB: ') + (childInfo?.dob || '—')],
    [(isHeb ? 'גיל: ' : 'Age: ') + (childInfo?.age || '—'), (isHeb ? 'תאריך: ' : 'Date: ') + date],
    [(isHeb ? 'מטפל/ת: ' : 'Specialist: ') + (specialistInfo?.name || '—') + (specialistInfo?.credentials ? ', ' + specialistInfo.credentials : ''), (isHeb ? 'התמחות: ' : 'Specialty: ') + (specialistInfo?.specialty || '—')],
  ];
  infoLines.forEach(([left, right]) => {
    if (isHeb) {
      doc.text(bidiLine(left), pageW - marginR, y, { align: 'right' });
      doc.text(bidiLine(right), pageW / 2 - 5, y, { align: 'right' });
    } else {
      doc.text(left, marginL, y);
      doc.text(right, pageW / 2 + 5, y);
    }
    y += 5;
  });
  y += 4;
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.2);
  doc.line(marginL, y, pageW - marginR, y);
  y += 6;

  // ── Report body ──
  const lines = (reportText || '').split('\n');
  lines.forEach(line => {
    const trimmed = line.trim();
    if (!trimmed) { y += 3; return; }

    // Detect headers: UPPERCASE English or Hebrew section-like patterns
    const isHeader = /^[A-Z][A-Z\s\/&:]+:?\s*$/.test(trimmed) || /^[A-Z\s\/&]{4,}$/.test(trimmed)
      || (isHeb && /^[\u0590-\u05FF][\u0590-\u05FF\s\/&:]+:?\s*$/.test(trimmed) && trimmed.length < 60);

    if (isHeader) {
      checkSpace(12);
      y += 4;
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(headerColor.r, headerColor.g, headerColor.b);
      doc.text(isHeb ? bidiLine(trimmed) : trimmed, textX, y, { align: textAlign });
      y += 5;
      doc.setDrawColor(220, 220, 220);
      doc.setLineWidth(0.1);
      doc.line(marginL, y, pageW - marginR, y);
      y += 4;
    } else {
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(30, 41, 59);
      const processedLine = isHeb ? bidiLine(trimmed) : trimmed;
      const wrapped = doc.splitTextToSize(processedLine, contentW);
      wrapped.forEach(wl => {
        checkSpace(5);
        doc.text(wl, textX, y, { align: textAlign });
        y += 4.5;
      });
      y += 1;
    }
  });

  // ── Footer ──
  checkSpace(15);
  y += 6;
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.2);
  doc.line(marginL, y, pageW - marginR, y);
  y += 5;
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(148, 163, 184);
  const fText = footerText ? footerText + ' · ' + date : 'Generated by Huddledin · ' + date;
  doc.text(fText, pageW / 2, y, { align: 'center' });

  // Page numbers
  const totalPages = doc.internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184);
    doc.setFont('helvetica', 'normal');
    doc.text('Page ' + i + ' of ' + totalPages, pageW - marginR, pageH - 10, { align: 'right' });
  }

  const blob = doc.output('blob');
  console.log('[pdf] Generated:', blob.size, 'bytes,', totalPages, 'pages, hebrew:', isHeb);
  return blob;
}
