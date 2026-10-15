# Flagship course: 90-minute redesign. Implementation report (round 2)

Branch `feat/flagship-90min`, uncommitted. **Nothing has been deployed, synced, migrated, or published.** No production data was read or written.
The approved curriculum, copy and totals (72 video + 18 activity = 90 planned minutes) are unchanged from round 1.

## 1. Files changed

**New, application code**

| File | Purpose |
|---|---|
| `src/lib/actionCardLogic.ts` | Pure save rules: six sections, per-section revision, stale-write check, 800-character limit |
| `src/services/actionCard.ts` | Firestore transaction that saves one section |
| `src/hooks/useActionCard.ts` | Live restore, autosave, status, conflict handling |
| `src/components/ActionCardPanel.tsx` | The Action Card UI (rewritten; browser-only notes removed) |
| `src/lib/actionCardPdf.ts` | One-page PDF (jsPDF, loaded only on download) |
| `src/lib/courseProgress.ts` | Progress over required lessons; curriculum-version "track" resolution; certificate rule |
| `src/lib/liveCourse.ts`, `src/hooks/useLiveCourses.ts` | Learners see only the live record for launch-gated courses |
| `api/_lib/course-publication.ts` | Lesson states (planned / in production / ready / published) and the launch-readiness rules |
| `api/_lib/course-admin.ts` | Draft, readiness, publish, sync safety, migration; one dispatcher shared by the API, dev server and tests |
| `src/components/admin/LaunchReadiness.tsx` | Admin launch-readiness report, publish button, migration dry run / apply / revert |
| `src/components/admin/CurriculumEditor.tsx` | Editor extracted from `AdminDashboard` (see section 6) |
| `scripts/flagship-migration-dry-run.mts` | Read-only dry run against the real database (needs a service-account key) |

**Changed**: `firestore.rules` (new `actionCards` block only), `src/types.ts`, `src/data/courses.ts` (flagship gets `launchGate`), `LessonViewer.tsx`, `CourseDetail.tsx`, `Courses.tsx`, `App.tsx` (dashboard), `AdminDashboard.tsx`, `api/admin.ts`, `server.ts`, `package.json` / lockfile (`jspdf`).

**New, tests and local harness (not shipped)**: `tests/{action-card,course-admin,course-publication,learner-tracks,flagship-course}.test.ts`, `tests/helpers/e2e-server.ts`, `tests/e2e-fake/*`. Paid courses are untouched (frozen-fixture test).

## 2. Action Card persistence architecture

- **Record:** `actionCards/{uid}_{courseId}` = `{ userId, courseId, outputs: { m1..m6: { text, rev, updatedAt } }, updatedAt }`. The id equals the learner's enrollment id, so ownership and enrollment are checked with no new lookups.
- **Six independent sections.** Each has its own revision number; saving one never rewrites another's text.
- **Cross-device restore.** The panel listens to the learner's own document. Opening the course on any device shows what was saved; an untouched section updates live when another device saves.
- **No stale overwrites.** A save runs in a Firestore transaction that checks the section's revision. If another device saved a newer answer, nothing is written. When the learner also has unsaved edits, they see both versions and choose **Use the newer answer** or **Keep mine and replace it**.
- **Editing** earlier answers: module 1-5 activities show their own section; the final activity shows all six, editable.
- **Status and errors.** Per section: Not started / Unsaved changes / Saving / Saved / Not saved (with a plain-language reason and **Try again**) / Needs your decision. Autosave after 1.5 s of quiet, plus **Save now**. Unsaved text is never discarded on a failure; the tab warns before closing with unsaved work.
- **Security (`firestore.rules`).** Owner-only get; no list; no delete; create/update require `userId == auth.uid`, id `== uid_courseId`, only keys `m1..m6`, each `text <= 800` chars and integer `rev >= 1`, and an existing enrollment. The block compiles on Firebase's server-side compiler (`firebase deploy --dry-run`; nothing was released).
- **No new infrastructure:** one Firestore collection, no Cloud Function.
- **Limits.** The rules do not enforce that `rev` only increases (the transaction does; a learner can only affect their own card). A learner can only save while enrolled.

## 3. PDF export

Client-side `jsPDF`, dynamically imported (a separate ~390 kB chunk, fetched only when someone downloads). A4, navy header band with gold rule, learner name and date, six sections each with its prompt and the learner's answer, footer. Empty sections read "(not completed yet)".

- **Always one page:** type shrinks from 10.5 pt to a 7 pt floor, then the longest answer is trimmed as a last resort. Tested with maximum-length answers in all six sections and with absurd input.
- **Fonts:** built-in PDF fonts cover Western European text only. Other characters are transliterated (`ọ` becomes `o`, `→` becomes `->`) or shown as `?`. Documented limitation.
- Checked: a rendered sample page (via pdf.js) and the real in-browser download (valid `%PDF`, 7.6 kB, contains the title, name and answers).

## 4. Legacy learner migration approach

Existing enrollments without a version stamp are **version 1**. Progress ids are positional, so an old id is never read against the new structure (`resolveTrack`).

| Learner | What happens |
|---|---|
| **Completed the original course** | Status, progress, `completedLessons` and certificate are untouched. The only write is an explicit `curriculumVersion: 1`. No v2 completions are created. |
| Chooses the new course | A separate `v2Progress` record on the same enrollment (written with dotted paths, so original fields are never touched). |
| Finishes the new course after the original | `v2Progress.status = COMPLETED`. **No second certificate** is issued; the original stays. |
| Part-way through the original | Remapped to v2 (a v2 lesson counts only if every v1 lesson feeding it was done; activities and new lessons never auto-complete). The original progress is backed up on the enrollment and **Revert** restores it exactly. |
| Not started | Moved to v2 with empty progress. |
| Before the new curriculum is published | Nothing changes for anyone (version 1 vs version 1). |

Certificates: issued only on the primary track. The create is attempted directly; the rules allow create-only, so an existing certificate cannot be overwritten. (I first read before writing, then found the production rules deny reading a non-existent certificate, which would have silently stopped new certificates; fixed.)

The dry run reports: enrollments, completed, partial, not started, unmappable progress (learners and lessons, plus unknown ids), completed learners with and without a certificate, certificates without completion. Apply and revert need the typed token `MIGRATE-FLAGSHIP-V2`.

## 5. Content publication safeguards

- **States, derived from the actual media URL**, never from metadata: *planned* (nothing) / *in production* (admin flag, no media) / *ready* (valid `https` media URL; for activities, on-page content) / *published* (ready **and** admin sign-off). Marking a lesson "published" with no valid URL downgrades it to "in production" with a warning.
- **Launch gate.** The flagship has `launchGate: true`. **Sync Static Data never changes the live course**; it writes `courseDrafts/{id}`, keeping any media and production state already in the draft. Learners never see the static copy (catalog, detail, lessons and dashboard use the live record only).
- **Publish** is blocked server-side until every required lesson and activity is published, re-validates every URL, archives the live version to `courseArchive`, refuses to drop live-only media without confirmation, and never touches enrollments. It needs a typed-confirm API call.
- **Admin report:** Admin > Courses > Launch readiness: verdict, counts per state, per-lesson blockers, optional **Verify media links** (HEAD check, advisory). Today the shipped flagship reports **NOT READY: 0 of 24 published** (18 lessons planned, 6 activities ready, awaiting sign-off).
- Existing content is never removed; paid programs are untouched.

## 6. Test results

| Check | Result |
|---|---|
| `npm test` | **Passed: 122/122** (47 new this round) |
| `npm run lint` (`tsc --noEmit`) / `npm run build` | **Passed** |
| `firestore.rules` compiles | **Passed** (Firebase dry run; nothing released) |
| Free-course enrollment; stamps `curriculumVersion` | **Passed** (local signed-in harness) |
| Learner dashboard (new, legacy-completed, legacy-partial, migrated) | **Passed** |
| Lesson navigation; mark complete; progress 1/24 to 24/24 | **Passed** |
| Action Card save, reload restore, cross-device update, conflict (both choices), offline error + retry | **Passed** |
| Action Card isolation: another learner, anonymous, forged owner, list, no enrollment, over-length, bad key | **Passed against the harness's model of the rules only** (see below) |
| Action Card PDF download | **Passed** |
| Course completion: status, next-steps panel, version-2 certificate | **Passed** |
| Legacy learner: original result and certificate unchanged; separate v2 track; no second certificate | **Passed** |
| Admin: Sync Static Data creates a draft only; editor loads/saves the draft; upload does not wipe edits; invalid URL flagged; publish blocked then allowed; archive created; enrollments untouched | **Passed** |
| Admin: migration dry run (writes nothing), apply, revert, revert controls visible | **Passed** (synthetic data) |
| Mobile 375x812: home, course, dashboard, lesson, final activity | **Passed**, no horizontal overflow |
| Mobile: admin page | **Partial**: readiness panel fits; the admin dashboard overflows by 8 px (pre-existing desktop-first layout, not fixed) |
| Real Firestore **rules behaviour** | **Pending.** The emulator needs JDK 21+ (this machine has 1.8). Isolation was exercised against a hand-written model of the rules, which cannot prove the real file is correct |
| Real Firebase Auth/Firestore signed-in session (production or preview) | **Pending.** I did not create accounts in the production project |
| Real-device mobile | **Pending** |
| **Migration dry run on real enrollments** | **Not run: no Admin credentials exist on this machine** (no service-account key). Command ready; see section 7 |
| Accessibility audit (axe) of the new screens | **Not run** (labels, live regions and focus styles were built in) |

**How the signed-in tests ran:** a local harness (`tests/helpers/e2e-server.ts` + `tests/e2e-fake/`) replaces Firebase with an in-memory server shared by browser tabs, plus the real admin handlers. Seeded accounts only; no credentials in this repo apply to anything real.

**Bugs found by that testing and fixed:** the lesson sidebar covered the whole lesson on phones; a non-enrolled learner on a lesson URL saw an endless spinner (now an "Enroll to start" screen); the admin curriculum editor remounted on every parent update, so starting a video upload threw away unsaved edits (editor moved to its own component); "Keep mine" did not save; revert controls vanished after Apply; certificates would not have been issued (above); the video placeholder wasted a screen on activity steps.

## 7. Outstanding launch blockers

1. **No lesson content exists.** 18 scripts, slide sets and videos (Appendix B). Publish is blocked until they do.
2. **Real-rules verification and a real-account smoke test** (section 6). Strongly recommended before publish.
3. **Real migration dry run.** Provide a service-account key for one command, or run it from the admin UI after deploying:
   `FIREBASE_SERVICE_ACCOUNT_KEY='...' npm run migration:dry-run`. The enrolled-learner count is still unknown.
4. **Decisions (both confirmed):** (a) completed legacy learners who finish the new course get **no second certificate**. (b) Per-lesson emails are **removed**: a learner now gets one welcome email on enrolling and one email on finishing a course (with the certificate link when one was earned). This applies to every course, paid ones included, because the lesson screen is shared; the email is sent after the certificate and can never block it. Covered by unit tests and a source guard (exactly one send call); not re-checked in the browser.
5. **Rules must be deployed before the code**, or the Action Card shows a clear "could not save" error.
6. Low risk: the migration queries enrollments by `courseId` ordered by document id; if Firestore asks for an index, the error includes a one-click link.

## 8. Exact deployment sequence (each numbered gate needs your approval)

1. Review; commit the branch (leave out `.claude/` and the modified `AI-Strategy-for-Leaders.pdf`); merge to `main`.
2. **Deploy Firestore rules first:** `npx firebase deploy --only firestore:rules` (additive: only the new `actionCards` block).
3. **Deploy the code** (push to `main`; Vercel builds). Learners see no change: the live record is still version 1 and the static v2 copy is hidden by the gate. Verify the home page, a lesson, the dashboard, and Admin > Courses > Launch readiness (NOT READY).
4. **Migration dry run** (admin UI or the script). Review the counts and the unmappable and certificate lines. **Gate: approve or amend.**
5. Admin > Courses > **Sync Static Data**. This creates the draft only; the live course is unchanged.
6. **Produce content.** For each lesson: Edit curriculum (draft), upload the video, set it to Published after review. Use **Verify media links**. Continue until the report says **READY TO PUBLISH**.
7. **Gate: choose the publish time.** Press **Publish to learners** (the old live version is archived) and immediately press **Apply migration** (type the token). Do these back to back: between them, part-way learners see "this course has been updated".
8. Smoke test with a real test account: enroll, complete a lesson, save the Action Card on two devices, download the PDF; check three existing learners' dashboards.
9. **Rollback:** Revert migration (restores every learner it moved). To restore the old live curriculum, copy `courseArchive/<id>.course` (or `docs/archive/ai-strategy-leaders.live-firestore-2026-10-14.json`) back into `courses/ai-strategy-leaders` in the Firebase console. There is no button for that second step.

---

## Appendix A. Curriculum migration map (v1 to v2)

| v1 id | v1 lesson | Disposition | Feeds v2 topic | Auto-carries progress |
|---|---|---|---|---|
| 0_0 | Lesson 1.1 — Why This AI Moment Is Different | retained | m1-l1 (Lesson 1.1 — Why This AI Moment Is Different) | yes (all sources needed) |
| 0_1 | Lesson 1.2 — The AI Capability Ladder™ | retained | m1-l2 (Lesson 1.2 — The AI Capability Ladder™) | yes (all sources needed) |
| 0_2 | Lesson 1.3 — What AI Can—and Cannot—Do | retained | m1-l3 (Lesson 1.3 — What AI Can—and Cannot—Do) | yes (all sources needed) |
| 0_3 | Module 1 Activity — AI Leadership Self-Assessment | optional | — | no |
| 1_0 | Lesson 2.1 — Generative AI vs. Agentic AI | retained | m2-l1 (Lesson 2.1 — From Generative AI to Agentic AI) | yes (all sources needed) |
| 1_1 | Lesson 2.2 — Copilots, Assistants and Agents | optional | — | no |
| 1_2 | Lesson 2.3 — The Autonomy Spectrum | retained | m2-l2 (Lesson 2.2 — The AI Autonomy Spectrum™) | yes (all sources needed) |
| 1_3 | Lesson 2.4 — The Emerging Agentic Enterprise | archived | — | no |
| 1_4 | Module 2 Activity — The Delegation Exercise | merged | m2-a (Activity — My Delegation Decision) | no |
| 2_0 | Lesson 3.1 — Stop Starting With the Technology | retained | m3-l1 (Lesson 3.1 — Start with the Problem, Not the Technology) | yes (all sources needed) |
| 2_1 | Lesson 3.2 — The AI Value Map™ | retained | m3-l2 (Lesson 3.2 — The AI Value Map™) | yes (all sources needed) |
| 2_2 | Lesson 3.3 — Think Workflow, Not Use Case | merged | m3-l3 (Lesson 3.3 — Choose One High-Value Workflow) | yes (all sources needed) |
| 2_3 | Lesson 3.4 — Prioritizing AI Opportunities | merged | m3-l3 (Lesson 3.3 — Choose One High-Value Workflow) | yes (all sources needed) |
| 2_4 | Module 3 Activity — Find Your Top Three AI Opportunities | merged | m3-a (Activity — My Priority Opportunity) | no |
| 3_0 | Lesson 4.1 — Don't Automate a Bad Process | retained | m4-l1 (Lesson 4.1 — Don't Automate a Bad Process) | yes (all sources needed) |
| 3_1 | Lesson 4.2 — Human + AI Comparative Advantage | retained | m4-l2 (Lesson 4.2 — Human + AI Comparative Advantage) | yes (all sources needed) |
| 3_2 | Lesson 4.3 — The Human-Agent Operating Model™ | merged | m4-l3 (Lesson 4.3 — Redesign One Workflow) | yes (all sources needed) |
| 3_3 | Lesson 4.4 — Redesigning the Workflow | merged | m4-l3 (Lesson 4.3 — Redesign One Workflow) | yes (all sources needed) |
| 3_4 | Module 4 Activity — Human + AI Workflow Canvas™ | merged | m4-a (Activity — My Human + AI Workflow) | no |
| 4_0 | Lesson 5.1 — The New Risk Equation | retained | m5-l1 (Lesson 5.1 — Why Autonomy Changes the Risk) | yes (all sources needed) |
| 4_1 | Lesson 5.2 — The AI Trust Stack™ | retained | m5-l2 (Lesson 5.2 — The AI Trust Stack™) | yes (all sources needed) |
| 4_2 | Lesson 5.3 — Matching Governance to Autonomy | merged | m5-l3 (Lesson 5.3 — Who Is Accountable?) | yes (all sources needed) |
| 4_3 | Lesson 5.4 — Responsible AI as a Leadership Responsibility | merged | m5-l3 (Lesson 5.3 — Who Is Accountable?) | yes (all sources needed) |
| 4_4 | Module 5 Activity — AI Governance Checklist | merged | m5-a (Activity — My Essential Safeguard) | no |
| 5_0 | Lesson 6.1 — Why AI Pilots Don't Scale | retained | m6-l1 (Lesson 6.1 — Why AI Pilots Don't Scale) | yes (all sources needed) |
| 5_1 | Lesson 6.2 — The Enterprise AI Readiness Model™ | retained | m6-l2 (Lesson 6.2 — What Must Be Ready?) | yes (all sources needed) |
| 5_2 | Lesson 6.3 — Build, Buy or Partner? | archived | — | no |
| 5_3 | Lesson 6.4 — Measuring AI Value | merged | m6-l3 (Lesson 6.3 — Your First 90 Days) | yes (all sources needed) |
| 5_4 | Lesson 6.5 — The Path to the AI-Native Enterprise | archived | — | no |
| 6_0 | Part 1 — The Opportunity | merged | m6-a (Final Activity — My 90-Day AI Leadership Action Card) | no |
| 6_1 | Part 2 — The Workflow | merged | m6-a (Final Activity — My 90-Day AI Leadership Action Card) | no |
| 6_2 | Part 3 — Human + AI | merged | m6-a (Final Activity — My 90-Day AI Leadership Action Card) | no |
| 6_3 | Part 4 — Governance | merged | m6-a (Final Activity — My 90-Day AI Leadership Action Card) | no |
| 6_4 | Part 5 — Success Measures | merged | m6-a (Final Activity — My 90-Day AI Leadership Action Card) | no |
| 6_5 | Part 6 — 90-Day Plan | merged | m6-l3 (Lesson 6.3 — Your First 90 Days) | yes (all sources needed) |

## Appendix B. Remaining content production

None of the 18 lessons has a video. Lessons read "Video in production" until one is added. Activities are on-page.

| # | Topic | Type | Planned | Script | Slides | Video |
|---|---|---|---|---|---|---|
| 1.1 | Lesson 1.1 — Why This AI Moment Is Different | lesson | 4 min | pending | pending | pending |
| 1.2 | Lesson 1.2 — The AI Capability Ladder™ | lesson | 4 min | pending | pending | pending |
| 1.3 | Lesson 1.3 — What AI Can—and Cannot—Do | lesson | 4 min | pending | pending | pending |
| 1.4 | Activity — My AI Leadership Starting Point | activity | 3 min | pending | pending | n/a (on-page activity) |
| 2.1 | Lesson 2.1 — From Generative AI to Agentic AI | lesson | 4 min | pending | pending | pending |
| 2.2 | Lesson 2.2 — The AI Autonomy Spectrum™ | lesson | 5 min | pending | pending | pending |
| 2.3 | Lesson 2.3 — Oversight, Command and Accountability | lesson | 3 min | pending | pending | pending |
| 2.4 | Activity — My Delegation Decision | activity | 3 min | pending | pending | n/a (on-page activity) |
| 3.1 | Lesson 3.1 — Start with the Problem, Not the Technology | lesson | 4 min | pending | pending | pending |
| 3.2 | Lesson 3.2 — The AI Value Map™ | lesson | 4 min | pending | pending | pending |
| 3.3 | Lesson 3.3 — Choose One High-Value Workflow | lesson | 4 min | pending | pending | pending |
| 3.4 | Activity — My Priority Opportunity | activity | 3 min | pending | pending | n/a (on-page activity) |
| 4.1 | Lesson 4.1 — Don't Automate a Bad Process | lesson | 4 min | pending | pending | pending |
| 4.2 | Lesson 4.2 — Human + AI Comparative Advantage | lesson | 4 min | pending | pending | pending |
| 4.3 | Lesson 4.3 — Redesign One Workflow | lesson | 4 min | pending | pending | pending |
| 4.4 | Activity — My Human + AI Workflow | activity | 3 min | pending | pending | n/a (on-page activity) |
| 5.1 | Lesson 5.1 — Why Autonomy Changes the Risk | lesson | 3 min | pending | pending | pending |
| 5.2 | Lesson 5.2 — The AI Trust Stack™ | lesson | 4 min | pending | pending | pending |
| 5.3 | Lesson 5.3 — Who Is Accountable? | lesson | 3 min | pending | pending | pending |
| 5.4 | Activity — My Essential Safeguard | activity | 2 min | pending | pending | n/a (on-page activity) |
| 6.1 | Lesson 6.1 — Why AI Pilots Don't Scale | lesson | 4 min | pending | pending | pending |
| 6.2 | Lesson 6.2 — What Must Be Ready? | lesson | 4 min | pending | pending | pending |
| 6.3 | Lesson 6.3 — Your First 90 Days | lesson | 6 min | pending | pending | pending |
| 6.4 | Final Activity — My 90-Day AI Leadership Action Card | activity | 4 min | pending | pending | n/a (on-page activity) |

Optional resources stay as unpublished placeholders and appear only when a real file and URL exist.
