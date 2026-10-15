import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const logic = await import("../src/lib/actionCardLogic.ts");
const pdf = await import("../src/lib/actionCardPdf.ts");
const { courses } = await import("../src/data/courses.ts");

const flagship = courses.find((c) => c.id === "ai-strategy-leaders")!;

// ── save logic ───────────────────────────────────────────────────────────────

test("first save of a section succeeds at revision 1", () => {
  const r = logic.applySave(null, "m1", "my workflow", 0);
  assert.equal(r.ok, true);
  if (r.ok) {
    assert.equal(r.rev, 1);
    assert.deepEqual(r.outputs, { m1: { text: "my workflow", rev: 1 } });
  }
});

test("sections save independently: saving one leaves the others exactly as they were", () => {
  const existing = { outputs: { m1: { text: "one", rev: 3 }, m2: { text: "two", rev: 1 } } };
  const r = logic.applySave(existing, "m2", "two, edited", 1);
  assert.equal(r.ok, true);
  if (r.ok) {
    assert.deepEqual(r.outputs.m1, { text: "one", rev: 3 });
    assert.deepEqual(r.outputs.m2, { text: "two, edited", rev: 2 });
  }
});

test("a stale device cannot overwrite a newer answer", () => {
  const existing = { outputs: { m1: { text: "written on the phone", rev: 5 } } };
  const r = logic.applySave(existing, "m1", "stale laptop text", 4);
  assert.equal(r.ok, false);
  if (!r.ok && r.reason === "conflict") assert.deepEqual(r.remote, { text: "written on the phone", rev: 5 });
  else assert.fail("expected a conflict");
});

test("a stale save for a section that now exists on the server is also a conflict (base 0 vs rev 1)", () => {
  const r = logic.applySave({ outputs: { m3: { text: "already here", rev: 1 } } }, "m3", "mine", 0);
  assert.equal(r.ok, false);
});

test("keep-mine: rebasing on the remote revision then saving succeeds", () => {
  const existing = { outputs: { m1: { text: "remote", rev: 5 } } };
  const first = logic.applySave(existing, "m1", "mine", 4);
  assert.equal(first.ok, false);
  const second = logic.applySave(existing, "m1", "mine", 5);
  assert.equal(second.ok, true);
  if (second.ok) assert.equal(second.rev, 6);
});

test("editing a previously saved answer bumps the revision", () => {
  const r = logic.applySave({ outputs: { m4: { text: "v1", rev: 1 } } }, "m4", "v2", 1);
  assert.equal(r.ok && r.rev, 2);
});

test("invalid input is rejected: unknown section, over-long text", () => {
  assert.equal(logic.applySave(null, "m7", "x", 0).ok, false);
  assert.equal(logic.applySave(null, "constructor", "x", 0).ok, false);
  const tooLong = logic.applySave(null, "m1", "x".repeat(logic.MAX_OUTPUT_CHARS + 1), 0);
  assert.equal(tooLong.ok, false);
  assert.equal(logic.applySave(null, "m1", "x".repeat(logic.MAX_OUTPUT_CHARS), 0).ok, true);
});

test("document id ties the card to learner and course; module index maps to m1..m6", () => {
  assert.equal(logic.actionCardId("uid1", "ai-strategy-leaders"), "uid1_ai-strategy-leaders");
  assert.equal(logic.keyForModule(0), "m1");
  assert.equal(logic.keyForModule(5), "m6");
  assert.equal(logic.keyForModule(6), null);
});

test("saved-output count ignores blank answers", () => {
  assert.equal(logic.savedOutputCount(null), 0);
  assert.equal(logic.savedOutputCount({ outputs: { m1: { text: "a", rev: 1 }, m2: { text: "  ", rev: 1 }, m3: { text: "c", rev: 2 } } }), 2);
});

test("firestore.rules and the app agree on the output limit and the six keys", () => {
  const rules = readFileSync(new URL("../firestore.rules", import.meta.url), "utf8");
  assert.match(rules, new RegExp(`o\\.text\\.size\\(\\) <= ${logic.MAX_OUTPUT_CHARS}`));
  for (const k of logic.ACTION_CARD_KEYS) assert.match(rules, new RegExp(`'${k}'`));
  assert.match(rules, /match \/actionCards\/\{cardId\}/);
  assert.match(rules, /allow list: if false/);
  assert.match(rules, /allow delete: if false/);
  assert.match(rules, /cardId == request\.auth\.uid \+ '_' \+ data\.courseId/);
});

// ── PDF ──────────────────────────────────────────────────────────────────────

const sectionsFor = (answers: string[]) =>
  flagship.assignment!.outputs!.map((o, i) => ({ module: o.module, prompt: o.text, answer: answers[i] ?? "" }));
const base = { learnerName: "Ada Obi", courseTitle: flagship.title, dateLabel: "14 October 2026" };
const rawText = (doc: any) => Buffer.from(doc.output("arraybuffer")).toString("latin1");

test("pdf: a normal card is exactly one A4 page and contains the learner's answers", async () => {
  const { doc } = await pdf.buildActionCardPdf({ ...base, sections: sectionsFor(["Claims intake", "AI acts with approval", "Faster triage", "Human reviews exceptions", "Named owner: COO", "Pilot in 30 days"]) });
  assert.equal(doc.getNumberOfPages(), 1);
  const text = rawText(doc);
  assert.match(text, /My AI Leadership Action Card/);
  assert.match(text, /Claims intake/);
  assert.match(text, /Pilot in 30 days/);
  assert.match(text, /Ada Obi/);
});

test("pdf: empty sections are labelled, not blank", async () => {
  const { doc } = await pdf.buildActionCardPdf({ ...base, sections: sectionsFor([]) });
  assert.equal(doc.getNumberOfPages(), 1);
  assert.match(rawText(doc), /not completed yet/);
});

test("pdf: maximum-length answers in all six sections still fit on one page", async () => {
  const long = "Operational detail that goes on and on about the workflow and its constraints. ".repeat(20).slice(0, logic.MAX_OUTPUT_CHARS);
  const { doc, fontSize } = await pdf.buildActionCardPdf({ ...base, sections: sectionsFor(Array(6).fill(long)) });
  assert.equal(doc.getNumberOfPages(), 1);
  assert.ok(fontSize >= 7, `type stays legible (got ${fontSize}pt)`);
});

test("pdf: absurdly long input is truncated rather than spilling onto a second page", async () => {
  const huge = "word ".repeat(6000);
  const { doc } = await pdf.buildActionCardPdf({ ...base, sections: sectionsFor(Array(6).fill(huge)) });
  assert.equal(doc.getNumberOfPages(), 1);
});

test("pdf: text the built-in fonts cannot draw is transliterated or replaced, not garbled", () => {
  assert.equal(pdf.toPdfSafeText("plain ASCII"), "plain ASCII");
  assert.equal(pdf.toPdfSafeText("café — “quoted” ™"), "café — “quoted” ™");
  assert.equal(pdf.toPdfSafeText("A → B"), "A -> B");
  assert.equal(pdf.toPdfSafeText("ọmọ"), "omo");
  assert.equal(pdf.toPdfSafeText("日本語"), "???");
  assert.equal(pdf.toPdfSafeText("ok 👍"), "ok ?");
  assert.equal(pdf.toPdfSafeText("line1\nline2"), "line1\nline2");
});
