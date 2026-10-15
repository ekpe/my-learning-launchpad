import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const mail = await import("../src/lib/completionEmail.ts");

test("completion email: one clear message, with the certificate link only when one was earned", () => {
  const a = mail.buildCompletionEmail({ name: "Ada", courseTitle: "AI Strategy for Leaders", courseUrl: "https://x.test/course/a", certificateUrl: "https://x.test/certificate/C1" });
  assert.equal(a.subject, "You've completed AI Strategy for Leaders");
  assert.match(a.text, /certificate: https:\/\/x\.test\/certificate\/C1/);
  assert.match(a.html, /View your certificate/);
  const b = mail.buildCompletionEmail({ name: "Ada", courseTitle: "T", courseUrl: "https://x.test/course/a" });
  assert.doesNotMatch(b.text, /certificate/i);
  assert.doesNotMatch(b.html, /certificate/i);
});

test("completion email: learner-controlled text is escaped in the HTML body", () => {
  const m = mail.buildCompletionEmail({ name: '<img src=x onerror=alert(1)>', courseTitle: 'A & "B"', courseUrl: "https://x.test/c" });
  assert.doesNotMatch(m.html, /<img/);
  assert.match(m.html, /&lt;img/);
  assert.match(m.html, /A &amp; &quot;B&quot;/);
  assert.equal(mail.buildCompletionEmail({ name: "  ", courseTitle: "T", courseUrl: "u" }).text.startsWith("Hi there,"), true);
});

test("lesson viewer sends no per-lesson email: exactly one sendEmail call, gated on course completion", () => {
  const src = readFileSync(new URL("../src/components/LessonViewer.tsx", import.meta.url), "utf8");
  assert.equal((src.match(/sendEmail\(/g) ?? []).length, 1);
  assert.doesNotMatch(src, /Lesson Completed/);
  assert.match(src, /if \(status === 'COMPLETED' && user\.email\)/);
});
