import { test } from "node:test";
import assert from "node:assert/strict";

const u = await import("../src/lib/uploadLimits.ts");

test("small files are allowed; anything over the limit gets a message that points to a link", () => {
  assert.equal(u.uploadSizeProblem(1_000), null);
  assert.equal(u.uploadSizeProblem(u.MAX_UPLOAD_BYTES), null);
  const m = u.uploadSizeProblem(250_000_000, "lesson-1.mp4")!;
  assert.match(m, /lesson-1\.mp4 is 250\.0 MB/);
  assert.match(m, /YouTube/);
  assert.match(m, /Vimeo/);
});

test("the limit stays under the platform's 4.5 MB request cap", () => {
  assert.ok(u.MAX_UPLOAD_BYTES < 4_500_000);
});

test("failure messages are specific and actionable", () => {
  assert.match(u.uploadFailureMessage(413), /too large/i);
  assert.match(u.uploadFailureMessage(413), /YouTube/);
  assert.match(u.uploadFailureMessage(401), /sign in again/i);
  assert.match(u.uploadFailureMessage(403), /sign in again/i);
  assert.match(u.uploadFailureMessage(500, "FIREBASE_STORAGE_BUCKET not configured"), /storage is not set up/i);
  assert.match(u.uploadFailureMessage(500, "boom"), /Upload failed: boom/);
  assert.match(u.uploadFailureMessage(502), /status 502/);
});

test("the video help text tells the admin to paste a link", () => {
  assert.match(u.VIDEO_HELP, /YouTube/);
  assert.match(u.VIDEO_HELP, /Vimeo/);
});
