// AI Report Generation + Template Import

export async function generateReport({ reportType, formData, childInfo, specialistInfo, writingStyle, sections }) {
  const response = await fetch('/api/generate-report', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reportType, formData, childInfo, specialistInfo, writingStyle, sections }),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to generate report');
  }
  const data = await response.json();
  return data.report;
}

export async function importTemplate(file) {
  // Read file as base64
  const base64 = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(',')[1]); // strip data:... prefix
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  const response = await fetch('/api/import-template', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ documentBase64: base64, mimeType: file.type, fileName: file.name }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to analyze document');
  }
  const data = await response.json();
  return data.template;
}
