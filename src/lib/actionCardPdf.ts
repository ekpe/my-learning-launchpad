/**
 * One-page PDF of a learner's AI Leadership Action Card (client-side; nothing is uploaded anywhere).
 * jsPDF is loaded on demand so it never adds weight to the main bundle.
 *
 * Standard PDF fonts only cover Latin-1/WinAnsi text, so anything outside it is transliterated or replaced
 * rather than printed as garbage. Layout shrinks the type (never below 7 pt) and, only as a last resort,
 * truncates the longest answer, so the card always stays on exactly one A4 page.
 */

export interface ActionCardPdfInput {
  learnerName: string;
  courseTitle: string;
  /** Section prompts, e.g. [{ module: 'Module 1 — Understand', prompt: 'My chosen workflow…' }] */
  sections: { module: string; prompt: string; answer: string }[];
  /** Pre-formatted, e.g. "14 October 2026". */
  dateLabel: string;
}

const WIN_ANSI_EXTRA = new Set('€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ'.split(''));

/** Replace characters the built-in PDF fonts cannot draw. Keeps accents where WinAnsi has them. */
export function toPdfSafeText(input: string): string {
  let out = '';
  for (const ch of (input ?? '').normalize('NFC')) {
    const c = ch.codePointAt(0)!;
    if (ch === '\n' || ch === '\t' || (c >= 0x20 && c <= 0x7e) || (c >= 0xa0 && c <= 0xff) || WIN_ANSI_EXTRA.has(ch)) {
      out += ch === '\t' ? ' ' : ch;
      continue;
    }
    if (ch === '→') { out += '->'; continue; }
    const base = ch.normalize('NFD').replace(/[̀-ͯ]/g, '');
    if (base !== ch && /^[\x20-\x7e]+$/.test(base)) { out += base; continue; }
    if (c === 0x200b || c === 0xfe0f || c === 0x200d) continue; // zero-width / emoji joiners
    out += '?';
  }
  return out;
}

export const PDF_FILE_NAME = 'AI-Leadership-Action-Card.pdf';

const NAVY: [number, number, number] = [10, 27, 61];
const GOLD: [number, number, number] = [244, 185, 66];
const INK: [number, number, number] = [30, 41, 59];
const MUTED: [number, number, number] = [100, 116, 139];

const PAGE_W = 210;
const PAGE_H = 297;
const MARGIN = 16;
const HEADER_H = 34;
const FOOTER_H = 12;

/** Builds the document (does not save it). Exposed separately so tests can inspect the result. */
export async function buildActionCardPdf(input: ActionCardPdfInput) {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const width = PAGE_W - MARGIN * 2;

  const sections = input.sections.map((s) => ({
    module: toPdfSafeText(s.module),
    prompt: toPdfSafeText(s.prompt),
    answer: toPdfSafeText(s.answer).trim(),
  }));
  const EMPTY = '(not completed yet)';

  const top = HEADER_H + 8;
  const bottom = PAGE_H - FOOTER_H - 4;
  const available = bottom - top;

  const measure = (size: number, answers: string[]) => {
    const lh = (pt: number) => pt * 0.3528 * 1.28;
    let h = 0;
    sections.forEach((s, i) => {
      doc.setFont('helvetica', 'bold').setFontSize(size - 1);
      h += lh(size - 1) + 0.8; // module label
      doc.setFont('helvetica', 'italic').setFontSize(size - 1.5);
      h += doc.splitTextToSize(s.prompt, width).length * lh(size - 1.5) + 0.8;
      doc.setFont('helvetica', 'normal').setFontSize(size);
      h += doc.splitTextToSize(answers[i] || EMPTY, width).length * lh(size) + 4.2; // answer + gap
    });
    return h;
  };

  let answers = sections.map((s) => s.answer);
  let size = 10.5;
  while (size > 7 && measure(size, answers) > available) size -= 0.5;

  // Last resort: trim the longest answer until it fits at the minimum size.
  let guard = 0;
  while (measure(size, answers) > available && guard++ < 400) {
    let longest = 0;
    answers.forEach((a, i) => { if (a.length > answers[longest].length) longest = i; });
    if (answers[longest].length < 40) break;
    answers[longest] = answers[longest].slice(0, Math.floor(answers[longest].length * 0.9)).replace(/\s+\S*$/, '') + '...';
  }

  // ── header band ──
  doc.setFillColor(...NAVY).rect(0, 0, PAGE_W, HEADER_H, 'F');
  doc.setFillColor(...GOLD).rect(0, HEADER_H, PAGE_W, 1.4, 'F');
  doc.setTextColor(255, 255, 255).setFont('helvetica', 'bold').setFontSize(19);
  doc.text('My AI Leadership Action Card', MARGIN, 16);
  doc.setFont('helvetica', 'normal').setFontSize(10).setTextColor(...GOLD);
  doc.text(toPdfSafeText(input.courseTitle), MARGIN, 23);
  doc.setTextColor(226, 232, 240).setFontSize(9);
  const who = input.learnerName ? `Prepared by ${toPdfSafeText(input.learnerName)}  |  ${input.dateLabel}` : input.dateLabel;
  doc.text(who, MARGIN, 29.5);

  // ── sections ──
  const lh = (pt: number) => pt * 0.3528 * 1.28;
  let y = top;
  sections.forEach((s, i) => {
    doc.setFont('helvetica', 'bold').setFontSize(size - 1).setTextColor(...NAVY);
    doc.setFillColor(...GOLD).rect(MARGIN, y - 2.6, 1.2, lh(size - 1) + 1.2, 'F');
    doc.text(s.module.toUpperCase(), MARGIN + 3.2, y);
    y += lh(size - 1) + 0.8;

    doc.setFont('helvetica', 'italic').setFontSize(size - 1.5).setTextColor(...MUTED);
    const prompt = doc.splitTextToSize(s.prompt, width) as string[];
    doc.text(prompt, MARGIN, y);
    y += prompt.length * lh(size - 1.5) + 0.8;

    const filled = answers[i].length > 0;
    doc.setFont('helvetica', filled ? 'normal' : 'italic').setFontSize(size).setTextColor(...(filled ? INK : MUTED));
    const lines = doc.splitTextToSize(filled ? answers[i] : EMPTY, width) as string[];
    doc.text(lines, MARGIN, y);
    y += lines.length * lh(size) + 4.2;

    if (i < sections.length - 1) {
      const ly = y - lh(size) / 2 - 2.8;
      doc.setDrawColor(226, 232, 240).setLineWidth(0.2).line(MARGIN, ly, PAGE_W - MARGIN, ly);
    }
  });

  // ── footer ──
  doc.setFont('helvetica', 'normal').setFontSize(8).setTextColor(...MUTED);
  doc.text('MyLearningLaunchpad  |  AI Strategy for Leaders  |  www.mylearninglaunchpad.com', MARGIN, PAGE_H - 8);

  return { doc, fontSize: size, answers };
}

/** Browser download. Throws if PDF generation fails so the caller can show an error. */
export async function downloadActionCardPdf(input: ActionCardPdfInput): Promise<void> {
  const { doc } = await buildActionCardPdf(input);
  doc.save(PDF_FILE_NAME);
}
