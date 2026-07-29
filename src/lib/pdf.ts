import jsPDF from 'jspdf';
import type { AuditResult, Lead } from './types';

const BRAND_NAME = 'Dean Da Dev';
const BRAND_CONTACT = 'dean@dean-da-dev.co.uk  ·  dean-da-dev.co.uk';
const CONSULTATION_URL = 'https://www.dean-da-dev.co.uk/DiscoveryCall';
const PAGE_MARGIN = 40;
const PAGE_WIDTH = 595.28; // A4 pt
const CONTENT_WIDTH = PAGE_WIDTH - PAGE_MARGIN * 2;

function scoreRgb(score: number): [number, number, number] {
  if (score >= 80) return [34, 197, 94];
  if (score >= 60) return [234, 179, 8];
  if (score >= 40) return [249, 115, 22];
  return [239, 68, 68];
}

export function generateAuditPdf(audit: AuditResult, lead: Lead): void {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  let y = PAGE_MARGIN;

  function ensureSpace(needed: number) {
    if (y + needed > 792 - PAGE_MARGIN) {
      doc.addPage();
      y = PAGE_MARGIN;
    }
  }

  // Header band
  doc.setFillColor(74, 99, 255);
  doc.rect(0, 0, PAGE_WIDTH, 90, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text(BRAND_NAME, PAGE_MARGIN, 40);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(BRAND_CONTACT, PAGE_MARGIN, 60);
  doc.setFontSize(13);
  doc.text('Website Growth Audit Report', PAGE_MARGIN, 80);
  y = 120;

  doc.setTextColor(30, 30, 40);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('Executive Summary', PAGE_MARGIN, y);
  y += 20;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  const summaryLines = doc.splitTextToSize(
    `Prepared for ${lead.business} (${lead.website}) on ${new Date(audit.scannedAt).toLocaleDateString('en-GB')}. ` +
      `This report identifies ${audit.recommendations.length} opportunities to improve enquiries, Google visibility and conversion rate, based on a full technical, SEO, accessibility, trust and conversion audit.`,
    CONTENT_WIDTH,
  );
  doc.text(summaryLines, PAGE_MARGIN, y);
  y += summaryLines.length * 14 + 20;

  // Overall score
  const [r, g, b] = scoreRgb(audit.overallScore);
  doc.setFillColor(r, g, b);
  doc.circle(PAGE_MARGIN + 30, y + 25, 30, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text(String(audit.overallScore), PAGE_MARGIN + 30, y + 30, { align: 'center' });
  doc.setTextColor(30, 30, 40);
  doc.setFontSize(13);
  doc.text('Overall Website Score', PAGE_MARGIN + 75, y + 20);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text('Out of 100, weighted across all audit categories', PAGE_MARGIN + 75, y + 36);
  y += 80;

  // Category scores
  ensureSpace(30);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('Category Scores', PAGE_MARGIN, y);
  y += 20;

  audit.categories.forEach((cat) => {
    ensureSpace(24);
    const [cr, cg, cb] = scoreRgb(cat.score);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.setTextColor(30, 30, 40);
    doc.text(cat.label, PAGE_MARGIN, y);

    const barX = PAGE_MARGIN + 160;
    const barWidth = CONTENT_WIDTH - 160 - 40;
    doc.setFillColor(230, 230, 235);
    doc.roundedRect(barX, y - 9, barWidth, 10, 4, 4, 'F');
    doc.setFillColor(cr, cg, cb);
    doc.roundedRect(barX, y - 9, Math.max(6, (barWidth * cat.score) / 100), 10, 4, 4, 'F');

    doc.setFont('helvetica', 'bold');
    doc.text(String(cat.score), barX + barWidth + 10, y);
    y += 22;
  });
  y += 10;

  // Growth estimate
  ensureSpace(90);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(30, 30, 40);
  doc.text('Estimated Growth Potential (not guaranteed)', PAGE_MARGIN, y);
  y += 20;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  const g1 = audit.growthEstimate;
  const growthLines = [
    `Additional enquiries per month: +${g1.additionalEnquiriesPerMonth[0]}-${g1.additionalEnquiriesPerMonth[1]}`,
    `Google visibility improvement: +${g1.visibilityImprovementPct}%`,
    `Conversion rate improvement: +${g1.conversionImprovementPct}%`,
    `Site speed improvement: +${g1.speedImprovementPct}%`,
    `Accessibility improvement: +${g1.accessibilityImprovementPct}%`,
  ];
  growthLines.forEach((line) => {
    ensureSpace(16);
    doc.text(`•  ${line}`, PAGE_MARGIN, y);
    y += 16;
  });
  y += 10;

  // Priority recommendations
  ensureSpace(30);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('Priority Recommendations', PAGE_MARGIN, y);
  y += 22;

  audit.recommendations.slice(0, 15).forEach((rec, i) => {
    ensureSpace(60);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(30, 30, 40);
    doc.text(`${i + 1}. ${rec.title}`, PAGE_MARGIN, y);
    y += 15;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(80, 80, 90);
    const descLines = doc.splitTextToSize(rec.description, CONTENT_WIDTH);
    doc.text(descLines, PAGE_MARGIN, y);
    y += descLines.length * 12 + 4;

    doc.setFontSize(8.5);
    doc.setTextColor(120, 120, 130);
    doc.text(
      `Severity: ${rec.severity}   ·   Impact: ${rec.impact}   ·   Difficulty: ${rec.difficulty}   ·   Est. time: ${rec.estimatedTime}`,
      PAGE_MARGIN,
      y,
    );
    y += 20;
  });

  // Footer CTA
  ensureSpace(70);
  y += 10;
  doc.setFillColor(74, 99, 255);
  doc.roundedRect(PAGE_MARGIN, y, CONTENT_WIDTH, 60, 10, 10, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('We can fix everything in this report for you.', PAGE_MARGIN + 16, y + 26);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(BRAND_CONTACT, PAGE_MARGIN + 16, y + 44);
  doc.setFont('helvetica', 'bold');
  doc.textWithLink('Book a free discovery call ->', PAGE_MARGIN + 340, y + 44, { url: CONSULTATION_URL });

  const filenameSafe = lead.business.replace(/[^a-z0-9]+/gi, '-').toLowerCase();
  doc.save(`website-growth-audit-${filenameSafe || 'report'}.pdf`);
}
