// PDF generation using jsPDF with Hebrew font support + branding + markdown

function hexToRgb(hex) {
  const h = (hex || '#0d9488').replace('#', '');
  return { r: parseInt(h.substring(0, 2), 16) || 13, g: parseInt(h.substring(2, 4), 16) || 148, b: parseInt(h.substring(4, 6), 16) || 136 };
}

let _jspdfLoaded = false;
let _hebrewFontLoaded = false;
let _hebrewFontData = null;

async function ensureJsPDF() {
  if (_jspdfLoaded || window.jspdf) { _jspdfLoaded = true; return; }
  await new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js';
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
  const url = 'https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/notosanshebrew/NotoSansHebrew%5Bwdth%2Cwght%5D.ttf';
  try {
    const resp = await fetch(url);
    if (!resp.ok) throw new Error('Font fetch failed: ' + resp.status);
    _hebrewFontData = await resp.arrayBuffer();
    _hebrewFontLoaded = true;
    console.log('[pdf] Hebrew font loaded:', _hebrewFontData.byteLength, 'bytes');
  } catch (e) {
    console.error('[pdf] Could not load Hebrew font:', e.message);
    try {
      const resp2 = await fetch('https://cdn.jsdelivr.net/gh/nicholasgasior/gfonts-noto-sans-hebrew@master/fonts/NotoSansHebrew-Regular.ttf');
      if (resp2.ok) { _hebrewFontData = await resp2.arrayBuffer(); _hebrewFontLoaded = true; }
    } catch (e2) { console.error('[pdf] Fallback font also failed'); }
  }
}

function registerHebrewFont(doc) {
  if (!_hebrewFontData) return false;
  try {
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

function bidiLine(text) {
  if (!hasHebrew(text)) return text;
  const hebrewChars = (text.match(/[\u0590-\u05FF]/g) || []).length;
  if (hebrewChars > text.replace(/\s/g, '').length * 0.3) {
    return text.split('').reverse().join('');
  }
  return text;
}

// Load logo from Supabase storage as base64 data URL
async function loadLogoImage(logoPath) {
  if (!logoPath) return null;
  try {
    const _supa = window.HUD?._supa;
    if (!_supa) { console.warn('[pdf] No Supabase client for logo'); return null; }
    const { data: urlData, error } = await _supa.storage.from('specialist-storage').createSignedUrl(logoPath, 60);
    if (error || !urlData?.signedUrl) { console.error('[pdf] Logo signed URL error:', error); return null; }
    const resp = await fetch(urlData.signedUrl);
    if (!resp.ok) { console.error('[pdf] Logo fetch failed:', resp.status); return null; }
    const blob = await resp.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => { console.error('[pdf] Logo read error'); resolve(null); };
      reader.readAsDataURL(blob);
    });
  } catch (e) {
    console.error('[pdf] Logo load error:', e);
    return null;
  }
}

// ── Markdown-aware text parser ──
// Parses report text into structured blocks for PDF rendering
export function parseReportText(text) {
  const blocks = [];
  const lines = (text || '').split('\n');
  let i = 0;

  // Detect and skip duplicate patient info block at the top
  // (AI sometimes includes Patient/DOB/Date which duplicates the header)
  const patientInfoPattern = /^(patient|date of birth|dob|date|specialist|age|מטופל|ת\. לידה|תאריך|גיל|מטפל)/i;
  let skipUntil = 0;
  for (let j = 0; j < Math.min(lines.length, 15); j++) {
    const t = lines[j].trim();
    if (!t) continue;
    if (patientInfoPattern.test(t.replace(/^\*+/, '').replace(/^#+\s*/, ''))) {
      skipUntil = j + 1;
    } else if (skipUntil > 0 && (t === '---' || t === '***' || t === '___')) {
      skipUntil = j + 1;
      break;
    } else if (skipUntil > 0) {
      break;
    }
  }

  i = skipUntil;

  while (i < lines.length) {
    const raw = lines[i];
    const trimmed = raw.trim();

    // Empty line → spacer
    if (!trimmed) { blocks.push({ type: 'spacer' }); i++; continue; }

    // Horizontal rule: --- or *** or ___
    if (/^[-*_]{3,}\s*$/.test(trimmed)) { blocks.push({ type: 'hr' }); i++; continue; }

    // Markdown header: ## Header or ### Header
    const mdHeader = trimmed.match(/^(#{1,4})\s+(.+)$/);
    if (mdHeader) {
      const level = mdHeader[1].length;
      const rawText = mdHeader[2].replace(/:$/, '');
      const title = stripInlineMarkdown(rawText);
      blocks.push({ type: 'header', text: title, rawText, level, format: 'md' });
      i++; continue;
    }

    // UPPERCASE header (existing pattern): "SECTION TITLE" or "SECTION TITLE:"
    if (/^[A-Z][A-Z\s\/&:()]{3,}:?\s*$/.test(trimmed) ||
        (hasHebrew(trimmed) && /^[\u0590-\u05FF][\u0590-\u05FF\s\/&:]+:?\s*$/.test(trimmed) && trimmed.length < 60)) {
      const hText = trimmed.replace(/:$/, '').trim();
      blocks.push({ type: 'header', text: hText, rawText: hText, level: 2, format: 'upper' });
      i++; continue;
    }

    // Bold-only line (acts as sub-header): **Something** or __Something__
    if (/^\*\*[^*]+\*\*:?\s*$/.test(trimmed) || /^__[^_]+__:?\s*$/.test(trimmed)) {
      const text = trimmed.replace(/^\*\*|\*\*:?\s*$|^__|__:?\s*$/g, '').trim();
      blocks.push({ type: 'subheader', text, rawText: text });
      i++; continue;
    }

    // Bullet point: - item or * item or • item (but not ---)
    if (/^[-*•]\s+/.test(trimmed) && !/^[-]{2,}/.test(trimmed)) {
      const bulletText = trimmed.replace(/^[-*•]\s+/, '');
      blocks.push({ type: 'bullet', text: stripInlineMarkdown(bulletText), rawText: bulletText });
      i++; continue;
    }

    // Numbered list: 1. item, 2. item, etc.
    const numMatch = trimmed.match(/^(\d+)[.)]\s+(.+)$/);
    if (numMatch) {
      blocks.push({ type: 'numbered', num: numMatch[1], text: stripInlineMarkdown(numMatch[2]), rawText: numMatch[2] });
      i++; continue;
    }

    // Regular paragraph — strip inline markdown
    blocks.push({ type: 'paragraph', text: stripInlineMarkdown(trimmed), rawText: trimmed });
    i++;
  }

  return blocks;
}

// Strip inline markdown formatting
export function stripInlineMarkdown(text) {
  return text
    .replace(/\*\*(.+?)\*\*/g, '$1')  // **bold**
    .replace(/__(.+?)__/g, '$1')       // __bold__
    .replace(/\*(.+?)\*/g, '$1')       // *italic*
    .replace(/_(.+?)_/g, '$1')         // _italic_
    .replace(/`(.+?)`/g, '$1')         // `code`
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1'); // [link](url)
}

// Parse inline bold segments for mixed-weight rendering
function parseInlineSegments(text) {
  const segments = [];
  const pattern = /\*\*(.+?)\*\*|__(.+?)__/g;
  let last = 0;
  let m;
  while ((m = pattern.exec(text)) !== null) {
    if (m.index > last) segments.push({ text: text.slice(last, m.index), bold: false });
    segments.push({ text: m[1] || m[2], bold: true });
    last = m.index + m[0].length;
  }
  if (last < text.length) segments.push({ text: text.slice(last), bold: false });
  // If no bold found, return single segment with stripped text
  if (segments.length === 0) return [{ text: stripInlineMarkdown(text), bold: false }];
  return segments;
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

  // Load logo if available
  let logoDataUrl = null;
  if (brand.logo_storage_path) {
    logoDataUrl = await loadLogoImage(brand.logo_storage_path);
    console.log('[pdf] Logo loaded:', logoDataUrl ? (logoDataUrl.length + ' chars') : 'failed');
  }

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
    else doc.setFont('helvetica', style || 'normal');
  };
  const textAlign = isHeb ? 'right' : 'left';
  const textX = isHeb ? (pageW - marginR) : marginL;

  const addPage = () => { doc.addPage(); y = marginT; };
  const checkSpace = (needed) => { if (y + needed > pageH - marginB) addPage(); };

  // Helper: render text with inline bold segments
  const renderInline = (rawText, x, yPos, opts) => {
    const segments = parseInlineSegments(rawText);
    if (segments.length === 1 && !segments[0].bold) {
      const txt = isHeb ? bidiLine(segments[0].text) : segments[0].text;
      doc.text(txt, x, yPos, opts);
      return;
    }
    // For mixed bold, render segment by segment (LTR only — Hebrew falls back to simple)
    if (isHeb) {
      const plain = segments.map(s => s.text).join('');
      doc.text(bidiLine(plain), x, yPos, opts);
      return;
    }
    let cx = x;
    segments.forEach(seg => {
      setFont(seg.bold ? 'bold' : 'normal');
      doc.text(seg.text, cx, yPos);
      cx += doc.getTextWidth(seg.text);
    });
  };

  // ── Header with branding ──
  const headerName = brand.practice_name || 'Huddledin';

  // Logo
  if (logoDataUrl) {
    try {
      const logoH = 12; // mm
      // Detect image format from data URL
      const fmt = logoDataUrl.startsWith('data:image/png') ? 'PNG' : 'JPEG';
      // Load image to get aspect ratio
      const img = await new Promise((resolve, reject) => {
        const im = new Image();
        im.onload = () => resolve(im);
        im.onerror = reject;
        im.src = logoDataUrl;
      });
      const aspect = img.naturalWidth / img.naturalHeight;
      const logoW = logoH * aspect;
      const logoX = (pageW - logoW) / 2;
      doc.addImage(logoDataUrl, fmt, logoX, y - 2, logoW, logoH);
      y += logoH + 3;
    } catch (e) {
      console.error('[pdf] Logo render error:', e);
    }
  }

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
    [(isHeb ? 'מטופל: ' : 'Patient: ') + (childInfo?.name || '\u2014'), (isHeb ? 'ת. לידה: ' : 'DOB: ') + (childInfo?.dob || '\u2014')],
    [(isHeb ? 'גיל: ' : 'Age: ') + (childInfo?.age || '\u2014'), (isHeb ? 'תאריך: ' : 'Date: ') + date],
    [(isHeb ? 'מטפל/ת: ' : 'Specialist: ') + (specialistInfo?.name || '\u2014') + (specialistInfo?.credentials ? ', ' + specialistInfo.credentials : ''), (isHeb ? 'התמחות: ' : 'Specialty: ') + (specialistInfo?.specialty || '\u2014')],
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

  // ── Report body (markdown-aware) ──
  const blocks = parseReportText(reportText);
  const bulletIndent = 6;

  blocks.forEach(block => {
    switch (block.type) {
      case 'spacer':
        y += 3;
        break;

      case 'hr':
        checkSpace(6);
        y += 2;
        doc.setDrawColor(200, 200, 200);
        doc.setLineWidth(0.3);
        doc.line(marginL, y, pageW - marginR, y);
        y += 4;
        break;

      case 'header': {
        checkSpace(14);
        y += 5;
        const fontSize = block.level === 1 ? 13 : block.level === 2 ? 11 : 10;
        doc.setFontSize(fontSize);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(headerColor.r, headerColor.g, headerColor.b);
        const htxt = isHeb ? bidiLine(block.text) : block.text;
        doc.text(htxt, textX, y, { align: textAlign });
        y += fontSize * 0.4 + 1;
        // Subtle underline for top-level headers
        if (block.level <= 2) {
          doc.setDrawColor(220, 220, 220);
          doc.setLineWidth(0.15);
          doc.line(marginL, y, pageW - marginR, y);
          y += 3;
        } else {
          y += 2;
        }
        break;
      }

      case 'subheader': {
        checkSpace(10);
        y += 3;
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(50, 60, 75);
        const stxt = isHeb ? bidiLine(block.text) : block.text;
        doc.text(stxt, textX, y, { align: textAlign });
        y += 5;
        break;
      }

      case 'bullet': {
        doc.setFontSize(10);
        setFont('normal');
        doc.setTextColor(30, 41, 59);
        const bx = isHeb ? (pageW - marginR - bulletIndent) : (marginL + bulletIndent);
        const bw = contentW - bulletIndent;
        const btxt = isHeb ? bidiLine(block.text) : block.text;
        const wrapped = doc.splitTextToSize(btxt, bw);
        wrapped.forEach((wl, wi) => {
          checkSpace(5);
          if (wi === 0) {
            // Bullet character
            const dotX = isHeb ? (pageW - marginR - 2) : (marginL + 2);
            doc.text('\u2022', dotX, y, { align: isHeb ? 'right' : 'left' });
          }
          doc.text(wl, bx, y, { align: textAlign });
          y += 4.5;
        });
        y += 0.5;
        break;
      }

      case 'numbered': {
        doc.setFontSize(10);
        setFont('normal');
        doc.setTextColor(30, 41, 59);
        const nx = isHeb ? (pageW - marginR - bulletIndent) : (marginL + bulletIndent);
        const nw = contentW - bulletIndent;
        const ntxt = isHeb ? bidiLine(block.text) : block.text;
        const nwrapped = doc.splitTextToSize(ntxt, nw);
        nwrapped.forEach((wl, wi) => {
          checkSpace(5);
          if (wi === 0) {
            const numX = isHeb ? (pageW - marginR - 1) : (marginL + 1);
            doc.setFont('helvetica', 'normal');
            doc.text(block.num + '.', numX, y, { align: isHeb ? 'right' : 'left' });
          }
          doc.text(wl, nx, y, { align: textAlign });
          y += 4.5;
        });
        y += 0.5;
        break;
      }

      case 'paragraph':
      default: {
        doc.setFontSize(10);
        setFont('normal');
        doc.setTextColor(30, 41, 59);
        const ptxt = isHeb ? bidiLine(block.text) : block.text;
        const wrapped = doc.splitTextToSize(ptxt, contentW);
        wrapped.forEach(wl => {
          checkSpace(5);
          doc.text(wl, textX, y, { align: textAlign });
          y += 4.5;
        });
        y += 1;
        break;
      }
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
  const fText = footerText ? footerText + ' \u00B7 ' + date : 'Generated by Huddledin \u00B7 ' + date;
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
  console.log('[pdf] Generated:', blob.size, 'bytes,', totalPages, 'pages, hebrew:', isHeb, 'logo:', !!logoDataUrl);
  return blob;
}

// ── Editing support: skip prefix + reconstruction ──

export function getSkippedPrefix(text) {
  const lines = (text || '').split('\n');
  const pat = /^(patient|date of birth|dob|date|specialist|age|מטופל|ת\. לידה|תאריך|גיל|מטפל)/i;
  let skipUntil = 0;
  for (let j = 0; j < Math.min(lines.length, 15); j++) {
    const t = lines[j].trim();
    if (!t) continue;
    if (pat.test(t.replace(/^\*+/, '').replace(/^#+\s*/, ''))) {
      skipUntil = j + 1;
    } else if (skipUntil > 0 && (t === '---' || t === '***' || t === '___')) {
      skipUntil = j + 1; break;
    } else if (skipUntil > 0) { break; }
  }
  return skipUntil > 0 ? lines.slice(0, skipUntil).join('\n') : '';
}

export function blockToMarkdown(block) {
  switch (block.type) {
    case 'spacer': return '';
    case 'hr': return '---';
    case 'header':
      if (block.format === 'upper') return block.rawText;
      return '#'.repeat(block.level) + ' ' + block.rawText;
    case 'subheader': return '**' + block.rawText + '**';
    case 'bullet': return '- ' + block.rawText;
    case 'numbered': return block.num + '. ' + block.rawText;
    case 'paragraph': return block.rawText;
    default: return block.rawText || '';
  }
}

export function reconstructMarkdown(blocks, skippedPrefix) {
  const body = blocks.map(b => blockToMarkdown(b)).join('\n');
  return skippedPrefix ? skippedPrefix + '\n' + body : body;
}
