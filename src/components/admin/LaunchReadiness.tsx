import React, { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Loader2, RefreshCw, Rocket, ShieldCheck } from 'lucide-react';
import { Button } from '../ui/Button';
import { MIGRATION_CONFIRM_TOKEN, PUBLISH_CONFIRM_TOKEN, LESSON_STATES, type LessonState } from '../../../api/_lib/course-publication';

type AdminFetch = (resource: string, init?: RequestInit, extraQuery?: string) => Promise<any>;

interface Props {
  courseId: string;
  courseTitle: string;
  adminFetch: AdminFetch;
}

const STATE_STYLE: Record<LessonState, string> = {
  planned: 'bg-slate-100 text-slate-800',
  'in-production': 'bg-amber-100 text-amber-900',
  ready: 'bg-blue-100 text-blue-900',
  published: 'bg-green-100 text-green-900',
};

/**
 * Admin-only launch panel for a launch-gated course: readiness from actual media URLs, the explicit publish step,
 * and the (approval-gated) learner progress migration. Nothing here runs without an admin pressing a button.
 */
export const LaunchReadiness = ({ courseId, courseTitle, adminFetch }: Props) => {
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [message, setMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const [migration, setMigration] = useState<any>(null);
  const [migBusy, setMigBusy] = useState(false);
  const [typed, setTyped] = useState('');

  const load = useCallback(
    async (verify = false) => {
      verify ? setVerifying(true) : setLoading(true);
      setError(null);
      try {
        setReport(await adminFetch('course-readiness', undefined, `&courseId=${encodeURIComponent(courseId)}${verify ? '&verify=1' : ''}`));
      } catch (e: any) {
        setError(e.message || 'Could not load readiness.');
      } finally {
        setLoading(false);
        setVerifying(false);
      }
    },
    [adminFetch, courseId],
  );

  useEffect(() => {
    void load();
  }, [load]);

  const publish = async () => {
    if (!window.confirm(`Publish "${courseTitle}" to learners now?\n\nThe current live version is archived first. Enrolled learners' progress is NOT migrated by this step.`)) return;
    setPublishing(true);
    setMessage(null);
    try {
      await adminFetch('course-publish', { method: 'POST', body: JSON.stringify({ courseId, confirm: PUBLISH_CONFIRM_TOKEN }) });
      setMessage({ type: 'ok', text: 'Published. The previous live version was archived.' });
      await load();
    } catch (e: any) {
      setMessage({ type: 'err', text: e.message || 'Publish failed.' });
    } finally {
      setPublishing(false);
    }
  };

  const runMigration = async (mode: 'dry-run' | 'apply' | 'revert') => {
    setMigBusy(true);
    setMessage(null);
    try {
      const body: any = { mode };
      if (mode !== 'dry-run') body.confirm = typed;
      const out = await adminFetch('course-migrate-progress', { method: 'POST', body: JSON.stringify(body) });
      setMigration(out);
      if (mode !== 'dry-run') setMessage({ type: 'ok', text: mode === 'apply' ? `Migration applied to ${out.changed} learner(s).` : `Reverted ${out.reverted} learner(s).` });
    } catch (e: any) {
      setMessage({ type: 'err', text: e.message || 'Migration request failed.' });
    } finally {
      setMigBusy(false);
    }
  };

  const required = report?.lessons?.filter((l: any) => !l.optional) ?? [];

  return (
    <section className="m-6 rounded-2xl border border-slate-200 bg-white p-6" aria-labelledby={`lr-${courseId}`} data-testid="launch-readiness">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 id={`lr-${courseId}`} className="flex items-center gap-2 text-lg font-bold text-slate-900">
          <Rocket className="h-5 w-5 text-blue-900" aria-hidden="true" /> Launch readiness: {courseTitle}
        </h3>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => load()} disabled={loading}>
            <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" /> Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={() => load(true)} disabled={verifying || loading}>
            {verifying ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" /> : <ShieldCheck className="mr-2 h-4 w-4" aria-hidden="true" />}
            Verify media links
          </Button>
        </div>
      </div>

      {loading && <p className="mt-4 text-sm text-slate-600" role="status">Checking…</p>}
      {error && <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-900" role="alert">{error}</p>}

      {report && (
        <>
          <p className="mt-4 text-sm text-slate-700">
            Showing the <strong>{report.source === 'draft' ? 'draft' : 'live course'}</strong>
            {report.live?.exists ? ` · live course is version ${report.live.curriculumVersion}${report.live.publishedAt ? ', published' : ', not yet published as v2'}` : ' · no live course'}.
          </p>

          <div className="mt-3 flex flex-wrap items-center gap-2" data-testid="lr-counts">
            <span
              className={`rounded-full px-3 py-1 text-sm font-bold ${report.launchReady ? 'bg-green-700 text-white' : 'bg-red-100 text-red-900'}`}
              data-testid="lr-verdict"
            >
              {report.launchReady ? 'READY TO PUBLISH' : 'NOT READY TO PUBLISH'}
            </span>
            {LESSON_STATES.map((s) => (
              <span key={s} className={`rounded-full px-3 py-1 text-xs font-bold ${STATE_STYLE[s]}`}>
                {s}: {report.counts?.[s] ?? 0} of {report.requiredTotal}
              </span>
            ))}
          </div>

          {report.warnings?.length > 0 && (
            <ul className="mt-3 list-disc pl-5 text-sm text-amber-900">
              {report.warnings.map((w: string) => <li key={w}>{w}</li>)}
            </ul>
          )}

          {!report.launchReady && report.blockers?.length > 0 && (
            <details className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-900">
              <summary className="cursor-pointer font-semibold">{report.blockers.length} blocker{report.blockers.length !== 1 ? 's' : ''}</summary>
              <ul className="mt-2 list-disc pl-5">
                {report.blockers.map((b: string) => <li key={b}>{b}</li>)}
              </ul>
            </details>
          )}

          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">Required lessons and their readiness</caption>
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase tracking-wider text-slate-600">
                  <th scope="col" className="py-2 pr-3">Lesson</th>
                  <th scope="col" className="py-2 pr-3">Type</th>
                  <th scope="col" className="py-2 pr-3">State</th>
                  <th scope="col" className="py-2">Still needed</th>
                </tr>
              </thead>
              <tbody>
                {required.map((l: any) => (
                  <tr key={`${l.moduleIndex}-${l.topicIndex}`} className="border-b border-slate-100 align-top">
                    <td className="py-2 pr-3 font-medium text-slate-900">{l.title}</td>
                    <td className="py-2 pr-3 text-slate-700">{l.kind}</td>
                    <td className="py-2 pr-3"><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${STATE_STYLE[l.state as LessonState]}`}>{l.state}</span></td>
                    <td className="py-2 text-slate-700">
                      {l.needs.join('; ') || 'Nothing'}
                      {report.reachability && l.videoUrl && <span className="ml-2 text-xs">{report.reachability[l.videoUrl] === 'ok' ? '✓ link reachable' : report.reachability[l.videoUrl] === 'unknown' ? '? link could not be checked' : '✗ link unreachable'}</span>}
                      {l.warnings.map((w: string) => <span key={w} className="mt-1 flex items-center gap-1 text-xs font-semibold text-red-800"><AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />{w}</span>)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <Button onClick={publish} disabled={!report.launchReady || publishing || report.source !== 'draft'} className="rounded-xl" data-testid="lr-publish">
              {publishing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" /> : <CheckCircle2 className="mr-2 h-4 w-4" aria-hidden="true" />}
              Publish to learners
            </Button>
            {!report.launchReady && <span className="text-sm text-slate-700">Publishing is blocked until every required lesson has a valid video link and is marked Published.</span>}
          </div>
        </>
      )}

      {message && (
        <p className={`mt-4 rounded-lg p-3 text-sm ${message.type === 'ok' ? 'bg-green-50 text-green-900' : 'bg-red-50 text-red-900'}`} role={message.type === 'ok' ? 'status' : 'alert'}>{message.text}</p>
      )}

      <details className="mt-6 rounded-xl border border-slate-200 p-4">
        <summary className="cursor-pointer font-semibold text-slate-900">Enrolled learners: progress migration</summary>
        <p className="mt-3 text-sm text-slate-700">
          Run a <strong>dry run</strong> first. It reads enrollments and certificates and changes nothing. Learners who completed the original course keep their status, progress,
          certificate and curriculum version; only learners still part-way through are remapped.
        </p>
        <div className="mt-3">
          <Button variant="outline" size="sm" onClick={() => runMigration('dry-run')} disabled={migBusy}>
            {migBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" /> : null}
            Run dry run (no changes)
          </Button>
        </div>

        {migration && (
          <div className="mt-4 text-sm" data-testid="mig-report">
            <p className="font-semibold text-slate-900">Mode: {migration.mode}</p>
            <ul className="mt-2 grid gap-1 sm:grid-cols-2">
              <li>Enrollments: <strong>{migration.total}</strong></li>
              <li>Completed (original curriculum): <strong>{migration.completedLearners}</strong></li>
              <li>Partially completed: <strong>{migration.partialLearners}</strong></li>
              <li>Not started: <strong>{migration.notStartedLearners}</strong></li>
              <li>Unmappable progress: <strong>{migration.unmappable?.learners}</strong> learner(s), {migration.unmappable?.lessons} lesson(s)</li>
              <li>Unknown lesson ids: <strong>{migration.unmappable?.unknownLessonIds}</strong></li>
              <li>Completed with certificate: <strong>{migration.certificates?.completedWithCertificate}</strong></li>
              <li>Completed, certificate missing: <strong>{migration.certificates?.completedMissingCertificate}</strong></li>
              <li>Certificate without completion: <strong>{migration.certificates?.certificateWithoutCompletion}</strong></li>
              {migration.mode === 'apply' && <li>Learners changed: <strong>{migration.changed}</strong></li>}
              {migration.mode === 'revert' && <li>Learners restored: <strong>{migration.reverted}</strong></li>}
            </ul>
          </div>
        )}

        {migration && (
          <div className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-950">
            <label htmlFor={`mig-confirm-${courseId}`} className="font-semibold">To apply or revert, type {MIGRATION_CONFIRM_TOKEN} (revert restores every learner this migration moved)</label>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <input
                id={`mig-confirm-${courseId}`}
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-slate-900"
                autoComplete="off"
              />
              <Button size="sm" onClick={() => runMigration('apply')} disabled={migBusy || typed !== MIGRATION_CONFIRM_TOKEN}>Apply migration</Button>
              <Button size="sm" variant="outline" onClick={() => runMigration('revert')} disabled={migBusy || typed !== MIGRATION_CONFIRM_TOKEN}>Revert migration</Button>
            </div>
          </div>
        )}
      </details>
    </section>
  );
};
