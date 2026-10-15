/**
 * The only progress email a learner receives: one message when they finish a course.
 * (Previously every completed lesson sent an email, which meant up to 24 in a 90-minute course.)
 * Learner-controlled text (display name) is escaped before it goes into the HTML body.
 */
export const escapeHtml = (s: string) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

export interface CompletionEmailInput {
  name?: string | null;
  courseTitle: string;
  courseUrl: string;
  /** Link to the certificate when this completion earned one. Absent for learners who already hold one. */
  certificateUrl?: string;
}

export function buildCompletionEmail(i: CompletionEmailInput): { subject: string; text: string; html: string } {
  const name = (i.name || 'there').trim() || 'there';
  const subject = `You've completed ${i.courseTitle}`;
  const text =
    `Hi ${name},\n\nCongratulations on completing "${i.courseTitle}".\n\n` +
    (i.certificateUrl ? `Your certificate: ${i.certificateUrl}\n\n` : '') +
    `Revisit the course any time: ${i.courseUrl}`;
  const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #1e3a8a;">Course completed</h2>
      <p>Hi ${escapeHtml(name)},</p>
      <p>Congratulations on completing "<strong>${escapeHtml(i.courseTitle)}</strong>".</p>
      ${i.certificateUrl ? `<p><a href="${escapeHtml(i.certificateUrl)}" style="color: #1e3a8a; font-weight: bold;">View your certificate</a></p>` : ''}
      <a href="${escapeHtml(i.courseUrl)}" style="display: inline-block; background-color: #1e3a8a; color: white; padding: 12px 24px; border-radius: 9999px; text-decoration: none; font-weight: bold; margin-top: 20px;">Go to the course</a>
    </div>`;
  return { subject, text, html };
}
