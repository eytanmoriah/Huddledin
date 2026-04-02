// AI Report Generator — calls /api/generate-report.js

export async function generateReport(reportType, specialtyTemplate, formData, childInfo, specialistInfo) {
  const response = await fetch('/api/generate-report', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reportType, specialtyTemplate, formData, childInfo, specialistInfo }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to generate report');
  }

  const data = await response.json();
  return data.report;
}
