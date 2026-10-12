import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, Download, Loader2, RefreshCw } from 'lucide-react';
import { auth } from '../../firebase';
import { Button } from '../ui/Button';
import { DEFAULT_AGENDA, DEFAULT_EVENT_ID, DEFAULT_SUBTITLE, DEFAULT_TITLE } from '../../config/webinar';
import { formatEventWhen, utcIsoToZonedLocal, zonedLocalToUtcIso } from '../../../api/_lib/webinar-shared';

type Json = Record<string, any>;

interface Registrant {
  id: string;
  type: 'registration' | 'interest';
  firstName: string;
  lastName: string;
  email: string;
  organization: string;
  role: string;
  sector: string;
  country: string;
  marketingOptIn: boolean;
  attended: boolean;
  attribution: Json;
  delivery: Record<string, { status: string; lastEvent?: string; error?: string; scheduledAt?: string }>;
  createdAt: string | null;
}

const field = 'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-900 focus:outline-none focus:ring-2 focus:ring-blue-900/30';
const label = 'mb-1 block text-xs font-bold uppercase tracking-wider text-slate-500';

async function api(resource: string, opts: { method?: 'GET' | 'POST'; body?: Json; query?: Record<string, string> } = {}): Promise<Json> {
  const token = await auth.currentUser?.getIdToken();
  const qs = new URLSearchParams({ resource, ...(opts.query ?? {}) }).toString();
  const res = await fetch(`/api/admin?${qs}`, {
    method: opts.method ?? 'GET',
    headers: { Authorization: `Bearer ${token}`, ...(opts.body ? { 'Content-Type': 'application/json' } : {}) },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const text = await res.text();
  let data: Json;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`Server error ${res.status}: ${text.slice(0, 160)}`);
  }
  if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`);
  return data;
}

/** Runs a cursor-paged admin operation until the server reports it is done. */
async function runBatches(resource: string, body: Json, onProgress: (totals: Json) => void): Promise<Json> {
  const totals: Json = {};
  let cursor: string | null = null;
  do {
    const out: Json = await api(resource, { method: 'POST', body: { ...body, cursor } });
    for (const [k, v] of Object.entries(out)) if (typeof v === 'number') totals[k] = (totals[k] ?? 0) + v;
    cursor = out.nextCursor ?? null;
    onProgress({ ...totals });
  } while (cursor);
  return totals;
}

const csvCell = (v: unknown): string => {
  let s = v === null || v === undefined ? '' : String(v);
  // Neutralise spreadsheet formula injection from attendee-supplied text.
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
};

export const WebinarAdmin = () => {
  const [eventId, setEventId] = useState(DEFAULT_EVENT_ID);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [exists, setExists] = useState(true);
  const [registrants, setRegistrants] = useState<Registrant[]>([]);

  const [f, setF] = useState({
    title: DEFAULT_TITLE,
    subtitle: DEFAULT_SUBTITLE,
    localStart: '',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
    durationMinutes: 60,
    registrationStatus: 'waitlist',
    webinarStatus: 'scheduled',
    replayAvailable: false,
    capacity: '',
    agendaText: DEFAULT_AGENDA.map((a) => `${a.time} | ${a.title}`).join('\n'),
    meetUrl: '',
    replayUrl: '',
    calendarEventId: '',
  });
  const [dirty, setDirty] = useState(false);
  const update = (patch: Partial<typeof f>) => {
    setF((p) => ({ ...p, ...patch }));
    setDirty(true);
  };

  const [template, setTemplate] = useState('followup-thanks');
  const [recap, setRecap] = useState('');
  const [attendedText, setAttendedText] = useState('');
  const [progress, setProgress] = useState<string>('');

  const load = useCallback(async () => {
    setLoading(true);
    setNotice(null);
    try {
      const data = await api('webinar-get', { query: { eventId } });
      setExists(!!data.exists);
      setRegistrants(data.registrations ?? []);
      if (data.exists) {
        const p = data.public ?? {};
        const q = data.private ?? {};
        setF({
          title: p.title ?? DEFAULT_TITLE,
          subtitle: p.subtitle ?? DEFAULT_SUBTITLE,
          localStart: p.startsAt ? utcIsoToZonedLocal(p.startsAt, p.timezone || 'UTC') : '',
          timezone: p.timezone || 'UTC',
          durationMinutes: p.durationMinutes ?? 60,
          registrationStatus: p.registrationStatus ?? 'waitlist',
          webinarStatus: p.webinarStatus ?? 'scheduled',
          replayAvailable: p.replayAvailable === true,
          capacity: p.capacity ? String(p.capacity) : '',
          agendaText: (p.agenda?.length ? p.agenda : DEFAULT_AGENDA).map((a: any) => `${a.time} | ${a.title}`).join('\n'),
          meetUrl: q.meetUrl ?? '',
          replayUrl: q.replayUrl ?? '',
          calendarEventId: q.calendarEventId ?? '',
        });
        setDirty(false);
      }
    } catch (e: any) {
      setNotice({ type: 'error', text: e.message });
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    load();
  }, [load]);

  const startsAtUtc = useMemo(() => {
    if (!f.localStart) return null;
    try {
      return zonedLocalToUtcIso(f.localStart, f.timezone);
    } catch {
      return null;
    }
  }, [f.localStart, f.timezone]);

  const run = async (name: string, fn: () => Promise<string>) => {
    setBusy(name);
    setNotice(null);
    setProgress('');
    try {
      setNotice({ type: 'success', text: await fn() });
    } catch (e: any) {
      setNotice({ type: 'error', text: e.message });
    } finally {
      setBusy(null);
      setProgress('');
    }
  };

  const save = () =>
    run('save', async () => {
      const agenda = f.agendaText
        .split('\n')
        .map((l) => l.split('|').map((s) => s.trim()))
        .filter((p) => p.length >= 2 && p[0] && p[1])
        .map((p) => ({ time: p[0], title: p.slice(1).join(' | ') }));
      await api('webinar-save', {
        method: 'POST',
        body: {
          eventId,
          public: {
            title: f.title,
            subtitle: f.subtitle,
            startsAt: startsAtUtc,
            timezone: f.timezone,
            durationMinutes: Number(f.durationMinutes),
            registrationStatus: f.registrationStatus,
            webinarStatus: f.webinarStatus,
            replayAvailable: f.replayAvailable,
            capacity: f.capacity ? Number(f.capacity) : null,
            agenda,
          },
          private: { meetUrl: f.meetUrl, replayUrl: f.replayUrl, calendarEventId: f.calendarEventId },
        },
      });
      await load();
      return 'Saved. The public page reflects these settings immediately. Reminders already scheduled are unchanged until you reschedule them.';
    });

  const progressText = (t: Json) =>
    setProgress(Object.entries(t).map(([k, v]) => `${k}: ${v}`).join(' · '));

  const reschedule = () =>
    run('reschedule', async () => {
      if (dirty && !window.confirm('You have unsaved changes. Rescheduling uses the SAVED event details. Continue anyway?')) return 'Cancelled.';
      const t = await runBatches('webinar-reschedule', { eventId }, progressText);
      await load();
      return `Reminders rescheduled for ${t.processed ?? 0} registrant(s)${t.failed ? `, ${t.failed} failed (see the table)` : ''}.`;
    });

  const refreshDelivery = () =>
    run('delivery', async () => {
      const t = await runBatches('webinar-refresh-delivery', { eventId }, progressText);
      await load();
      return `Checked delivery status for ${t.checked ?? 0} registrant(s).`;
    });

  const broadcastPreview = () =>
    run('preview', async () => {
      const out = await api('webinar-broadcast', { method: 'POST', body: { eventId, template, dryRun: true } });
      return `Dry run: ${out.recipients} eligible recipient(s), ${out.alreadySent} already sent, ${out.toSend} would be sent${out.promotional ? ' (promotional: opted-in registrants only)' : ''}. Nothing was sent.`;
    });

  const broadcastSend = () =>
    run('send', async () => {
      const preview = await api('webinar-broadcast', { method: 'POST', body: { eventId, template, dryRun: true } });
      if (!preview.toSend) return 'No eligible recipients to send to.';
      if (!window.confirm(`Send "${template}" to ${preview.toSend} recipient(s) now? This sends real emails and cannot be undone.`)) return 'Cancelled. Nothing was sent.';
      const t = await runBatches(
        'webinar-broadcast',
        { eventId, template, dryRun: false, confirm: true, recap: recap.split('\n').map((s) => s.trim()).filter(Boolean) },
        progressText
      );
      await load();
      return `Sent ${t.sent ?? 0}, failed ${t.failed ?? 0}, skipped ${t.skipped ?? 0}.`;
    });

  const markAttended = () =>
    run('attended', async () => {
      const emails = attendedText.split(/[\s,;]+/).filter((e) => e.includes('@'));
      const out = await api('webinar-mark-attended', { method: 'POST', body: { eventId, emails } });
      await load();
      return `Marked ${out.matched} attended; ${out.unmatchedCount} email(s) didn't match a registrant${out.unmatchedCount ? `: ${(out.unmatched as string[]).slice(0, 5).join(', ')}${out.unmatchedCount > 5 ? '…' : ''}` : ''}.`;
    });

  const exportCsv = () => {
    const head = ['Type', 'First name', 'Last name', 'Email', 'Organization', 'Role', 'Sector', 'Country', 'Marketing opt-in', 'Attended', 'Registered at (UTC)', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'Confirmation', 'Confirmation last event', '24h reminder', '1h reminder'];
    const rows = registrants.map((r) => [
      r.type, r.firstName, r.lastName, r.email, r.organization, r.role, r.sector, r.country,
      r.marketingOptIn ? 'yes' : 'no', r.attended ? 'yes' : 'no', r.createdAt,
      r.attribution.utm_source, r.attribution.utm_medium, r.attribution.utm_campaign, r.attribution.utm_content, r.attribution.utm_term,
      r.delivery.confirmation?.status, r.delivery.confirmation?.lastEvent, r.delivery.reminder24?.status, r.delivery.reminder1?.status,
    ]);
    const csv = [head, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `webinar-${eventId}-registrants.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const counts = useMemo(
    () => ({
      total: registrants.length,
      reg: registrants.filter((r) => r.type === 'registration').length,
      interest: registrants.filter((r) => r.type === 'interest').length,
      optIn: registrants.filter((r) => r.marketingOptIn).length,
      attended: registrants.filter((r) => r.attended).length,
    }),
    [registrants]
  );

  return (
    <div className="space-y-10 p-8">
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[16rem] flex-1">
          <label htmlFor="wa-eventId" className={label}>Event ID</label>
          <input id="wa-eventId" className={field} value={eventId} onChange={(e) => setEventId(e.target.value.toLowerCase())} />
        </div>
        <Button variant="outline" onClick={load} disabled={loading} className="rounded-xl">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Load
        </Button>
      </div>

      {notice && (
        <div role="status" className={`flex items-start gap-3 rounded-xl border p-4 text-sm ${notice.type === 'success' ? 'border-green-200 bg-green-50 text-green-900' : 'border-red-200 bg-red-50 text-red-900'}`}>
          {notice.type === 'success' ? <CheckCircle2 className="h-5 w-5 shrink-0" /> : <AlertCircle className="h-5 w-5 shrink-0" />}
          <p>{notice.text}</p>
        </div>
      )}
      {busy && progress && <p className="text-sm text-slate-600">Working… {progress}</p>}
      {!exists && (
        <p className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
          This event doesn't exist yet. Fill in the details below and press <strong>Save event</strong> to create it. Until it exists,
          the public page shows "Registration isn't open yet".
        </p>
      )}

      {/* Event settings */}
      <section className="space-y-5" aria-labelledby="wa-settings">
        <h3 id="wa-settings" className="text-xl font-bold text-slate-900">Event settings</h3>
        <div className="grid gap-5 md:grid-cols-2">
          <div className="md:col-span-2">
            <label htmlFor="wa-title" className={label}>Title</label>
            <input id="wa-title" className={field} value={f.title} onChange={(e) => update({ title: e.target.value })} />
          </div>
          <div className="md:col-span-2">
            <label htmlFor="wa-subtitle" className={label}>Subtitle</label>
            <input id="wa-subtitle" className={field} value={f.subtitle} onChange={(e) => update({ subtitle: e.target.value })} />
          </div>
          <div>
            <label htmlFor="wa-start" className={label}>Start (local time in the time zone →)</label>
            <input id="wa-start" type="datetime-local" className={field} value={f.localStart} onChange={(e) => update({ localStart: e.target.value })} />
          </div>
          <div>
            <label htmlFor="wa-tz" className={label}>Time zone (IANA)</label>
            <input id="wa-tz" list="wa-tzlist" className={field} value={f.timezone} onChange={(e) => update({ timezone: e.target.value })} />
            <datalist id="wa-tzlist">
              {(Intl as any).supportedValuesOf?.('timeZone')?.map((z: string) => <option key={z} value={z} />)}
            </datalist>
          </div>
          <p className="text-sm text-slate-600 md:col-span-2">
            {startsAtUtc
              ? <>Resolves to <strong>{formatEventWhen(startsAtUtc, f.timezone)}</strong> ({startsAtUtc} UTC). Check this reads as intended before saving.</>
              : 'No date set: the page shows a waitlist and no date is displayed.'}
          </p>
          <div>
            <label htmlFor="wa-duration" className={label}>Duration (minutes)</label>
            <input id="wa-duration" type="number" min={5} max={600} className={field} value={f.durationMinutes} onChange={(e) => update({ durationMinutes: Number(e.target.value) })} />
          </div>
          <div>
            <label htmlFor="wa-capacity" className={label}>Capacity (leave empty if no real limit)</label>
            <input id="wa-capacity" type="number" min={1} className={field} value={f.capacity} onChange={(e) => update({ capacity: e.target.value })} />
          </div>
          <div>
            <label htmlFor="wa-reg" className={label}>Registration</label>
            <select id="wa-reg" className={field} value={f.registrationStatus} onChange={(e) => update({ registrationStatus: e.target.value })}>
              <option value="open">Open (requires a date)</option>
              <option value="waitlist">Waitlist / interest only</option>
              <option value="closed">Closed</option>
            </select>
          </div>
          <div>
            <label htmlFor="wa-status" className={label}>Webinar status</label>
            <select id="wa-status" className={field} value={f.webinarStatus} onChange={(e) => update({ webinarStatus: e.target.value })}>
              <option value="scheduled">Scheduled</option>
              <option value="live">Live</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
          <div className="md:col-span-2">
            <label htmlFor="wa-agenda" className={label}>Agenda (one per line: time | title)</label>
            <textarea id="wa-agenda" rows={5} className={field} value={f.agendaText} onChange={(e) => update({ agendaText: e.target.value })} />
          </div>
        </div>

        <h4 className="pt-2 text-sm font-bold text-slate-900">Private (never shown publicly or put in analytics)</h4>
        <div className="grid gap-5 md:grid-cols-2">
          <div className="md:col-span-2">
            <label htmlFor="wa-meet" className={label}>Google Meet joining URL</label>
            <input id="wa-meet" className={field} placeholder="https://meet.google.com/abc-defg-hij" value={f.meetUrl} onChange={(e) => update({ meetUrl: e.target.value })} />
            <p className="mt-1 text-xs text-slate-500">Only goes out in confirmation and reminder emails. Changing it doesn't update reminders already scheduled; use "Reschedule reminders" afterwards.</p>
          </div>
          <div>
            <label htmlFor="wa-cal" className={label}>Google Calendar event ID (optional, reference only)</label>
            <input id="wa-cal" className={field} value={f.calendarEventId} onChange={(e) => update({ calendarEventId: e.target.value })} />
          </div>
          <div>
            <label htmlFor="wa-replay" className={label}>Replay URL (optional)</label>
            <input id="wa-replay" className={field} value={f.replayUrl} onChange={(e) => update({ replayUrl: e.target.value })} />
            <label className="mt-2 flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={f.replayAvailable} onChange={(e) => update({ replayAvailable: e.target.checked })} />
              Replay confirmed available (changes the public FAQ answer)
            </label>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <Button onClick={save} disabled={!!busy} className="rounded-xl bg-blue-900">
            {busy === 'save' && <Loader2 className="h-4 w-4 animate-spin" />} Save event
          </Button>
          <Button variant="outline" onClick={reschedule} disabled={!!busy || !exists} className="rounded-xl">
            {busy === 'reschedule' && <Loader2 className="h-4 w-4 animate-spin" />} Reschedule reminders for registrants
          </Button>
        </div>
        <p className="text-xs text-slate-500">
          Rescheduling cancels each registrant's pending 24h/1h reminders and creates new ones from the saved date. It also upgrades
          waitlist sign-ups to registrations once the event has a date and registration is open. It does not email anyone about the change;
          use the "Updated details" message below for that.
        </p>
      </section>

      {/* Follow-up emails */}
      <section className="space-y-4" aria-labelledby="wa-broadcast">
        <h3 id="wa-broadcast" className="text-xl font-bold text-slate-900">Manual emails</h3>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label htmlFor="wa-template" className={label}>Message</label>
            <select id="wa-template" className={field} value={template} onChange={(e) => setTemplate(e.target.value)}>
              <option value="preview">Before the webinar: what we'll cover</option>
              <option value="update">Updated details (date, time or link changed)</option>
              <option value="followup-thanks">After the webinar: thank you (+ replay)</option>
              <option value="followup-pathways">Follow-up: learning pathways (promotional, opted-in only)</option>
            </select>
          </div>
          {template === 'followup-thanks' && (
            <div className="md:col-span-2">
              <label htmlFor="wa-recap" className={label}>Key takeaways (one per line; only what you actually covered)</label>
              <textarea id="wa-recap" rows={4} className={field} value={recap} onChange={(e) => setRecap(e.target.value)} />
            </div>
          )}
        </div>
        <div className="flex flex-wrap gap-3">
          <Button variant="outline" onClick={broadcastPreview} disabled={!!busy || !exists} className="rounded-xl">Preview recipients (sends nothing)</Button>
          <Button onClick={broadcastSend} disabled={!!busy || !exists} className="rounded-xl bg-amber-600 hover:bg-amber-700">
            {busy === 'send' && <Loader2 className="h-4 w-4 animate-spin" />} Send…
          </Button>
        </div>
      </section>

      {/* Attendance */}
      <section className="space-y-3" aria-labelledby="wa-attendance">
        <h3 id="wa-attendance" className="text-xl font-bold text-slate-900">Attendance reconciliation</h3>
        <p className="text-sm text-slate-600">
          Registering or opening the link does not count as attending. After the session, paste the email addresses of people who actually
          joined (for example from the Google Meet attendance report, if your Workspace plan provides one, or your own notes).
        </p>
        <textarea aria-label="Attendee emails" rows={4} className={field} value={attendedText} onChange={(e) => setAttendedText(e.target.value)} />
        <Button variant="outline" onClick={markAttended} disabled={!!busy || !exists || !attendedText.trim()} className="rounded-xl">Mark as attended</Button>
      </section>

      {/* Registrants */}
      <section className="space-y-4" aria-labelledby="wa-registrants">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 id="wa-registrants" className="text-xl font-bold text-slate-900">
            Registrants ({counts.total}) <span className="text-sm font-normal text-slate-500">
              {counts.reg} registered · {counts.interest} waitlist · {counts.optIn} opted in · {counts.attended} attended
            </span>
          </h3>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={refreshDelivery} disabled={!!busy || !registrants.length} className="rounded-lg">
              {busy === 'delivery' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />} Refresh delivery status
            </Button>
            <Button variant="outline" size="sm" onClick={exportCsv} disabled={!registrants.length} className="rounded-lg">
              <Download className="h-3.5 w-3.5" /> Export CSV
            </Button>
          </div>
        </div>
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full min-w-[56rem] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
              <tr>
                {['Name', 'Email', 'Type', 'Sector', 'Marketing', 'Confirmation', '24h', '1h', 'Attended', 'Registered'].map((h) => (
                  <th key={h} scope="col" className="px-4 py-3 font-bold">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {registrants.length === 0 && (
                <tr><td colSpan={10} className="px-4 py-8 text-center text-slate-500">No registrants yet.</td></tr>
              )}
              {registrants.map((r) => {
                const d = (k: string) => {
                  const s = r.delivery[k];
                  return s ? `${s.status}${s.lastEvent ? ` · ${s.lastEvent}` : ''}` : '—';
                };
                return (
                  <tr key={r.id}>
                    <td className="px-4 py-3 font-medium text-slate-900">{r.firstName} {r.lastName}</td>
                    <td className="px-4 py-3 text-slate-700">{r.email}</td>
                    <td className="px-4 py-3">{r.type === 'interest' ? 'waitlist' : 'registered'}</td>
                    <td className="px-4 py-3">{r.sector || '—'}</td>
                    <td className="px-4 py-3">{r.marketingOptIn ? 'opted in' : 'no'}</td>
                    <td className="px-4 py-3" title={r.delivery.confirmation?.error}>{d('confirmation')}</td>
                    <td className="px-4 py-3" title={r.delivery.reminder24?.error}>{d('reminder24')}</td>
                    <td className="px-4 py-3" title={r.delivery.reminder1?.error}>{d('reminder1')}</td>
                    <td className="px-4 py-3">{r.attended ? 'yes' : '—'}</td>
                    <td className="px-4 py-3 text-slate-600">{r.createdAt ? new Date(r.createdAt).toLocaleString() : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};
