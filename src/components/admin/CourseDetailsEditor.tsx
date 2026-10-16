import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Clock, Loader2, MonitorPlay, Upload, Users } from 'lucide-react';
import { Button } from '../ui/Button';
import {
  DETAIL_LABELS,
  DETAIL_SPEC,
  detailsFromCourse,
  validateCourseDetails,
  type CourseDetails,
} from '../../../api/_lib/course-details';
import type { Course } from '../../types';

type AdminFetch = (resource: string, init?: RequestInit, extraQuery?: string) => Promise<any>;

interface Props {
  course: Course;
  /** Launch-gated course (its changes normally flow through a draft). */
  gated: boolean;
  adminFetch: AdminFetch;
  onUpload: (file: File) => Promise<string>;
  onCancel: () => void;
  onSaved: (message: string) => void;
}

type FormState = Omit<CourseDetails, 'outcomes' | 'benefits'> & { outcomes: string; benefits: string };

const toForm = (d: CourseDetails): FormState => ({ ...d, outcomes: d.outcomes.join('\n'), benefits: d.benefits.join('\n') });
const lines = (s: string) => s.split('\n');
const toDetails = (f: FormState): CourseDetails => ({ ...f, outcomes: lines(f.outcomes), benefits: lines(f.benefits) });

const inputCls =
  'w-full rounded-xl border border-slate-200 px-4 py-2 outline-none transition-all focus:border-blue-900 focus:ring-2 focus:ring-blue-900/20';

/**
 * Edit the content on the course card and course page. Saves go straight to the database through the admin API,
 * so changes appear for visitors immediately: no code change, no redeploy.
 */
export const CourseDetailsEditor = ({ course, gated, adminFetch, onUpload, onCancel, onSaved }: Props) => {
  // A published launch-gated course keeps its draft in step automatically, so only an UNpublished one needs a choice.
  const livePublished = course.launchGate === true;
  const chooseTarget = gated && !livePublished;
  const [target, setTarget] = useState<'live' | 'draft'>('live');
  const [form, setForm] = useState<FormState>(() => toForm(detailsFromCourse(course)));
  const [original, setOriginal] = useState<FormState>(form);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [triedSave, setTriedSave] = useState(false);
  const [serverErrors, setServerErrors] = useState<Record<string, string>>({});

  // Load the right source when the target changes.
  useEffect(() => {
    let cancelled = false;
    setError(null);
    setServerErrors({});
    if (target === 'live') {
      const f = toForm(detailsFromCourse(course));
      setForm(f);
      setOriginal(f);
      return;
    }
    setLoading(true);
    adminFetch('course-draft-get', undefined, `&courseId=${encodeURIComponent(course.id)}`)
      .then((r) => {
        if (cancelled) return;
        if (!r.exists) {
          setError('There is no draft yet. Press "Sync Static Data" first; it creates the draft without touching the live page.');
          return;
        }
        const f = toForm(detailsFromCourse(r.course));
        setForm(f);
        setOriginal(f);
      })
      .catch((e) => !cancelled && setError(e.message || 'Could not load the draft.'))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [target, course.id]);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((f) => ({ ...f, [k]: v }));
  const dirty = useMemo(() => JSON.stringify(form) !== JSON.stringify(original), [form, original]);
  const local = useMemo(() => validateCourseDetails(toDetails(form)), [form]);
  const errors: Record<string, string> = { ...(local.errors as Record<string, string>), ...serverErrors };

  const save = async () => {
    setError(null);
    setServerErrors({});
    if (!local.ok) {
      setTriedSave(true);
      return;
    }
    setTriedSave(false);
    setSaving(true);
    try {
      const out = await adminFetch('course-details-save', {
        method: 'POST',
        body: JSON.stringify({ courseId: course.id, target, fields: local.fields }),
      });
      onSaved(
        out.changed?.length
          ? target === 'draft'
            ? 'Saved to the draft. Visitors will see it after you publish.'
            : 'Saved. The change is live now.'
          : 'Nothing changed.',
      );
    } catch (e: any) {
      setError(e.message || 'Could not save.');
    } finally {
      setSaving(false);
    }
  };

  const text = (key: Exclude<keyof CourseDetails, 'outcomes' | 'benefits' | 'image' | 'fullDescription' | 'description' | 'cardDescription' | 'audience'>) => {
    const spec = DETAIL_SPEC[key] as { max: number; required?: boolean };
    return (
      <div className="space-y-1.5">
        <label htmlFor={`cd-${key}`} className="text-sm font-semibold text-slate-700">
          {DETAIL_LABELS[key]}
          {spec.required ? ' *' : ''}
        </label>
        <input id={`cd-${key}`} type="text" value={form[key]} onChange={(e) => set(key, e.target.value)} className={inputCls} aria-invalid={!!errors[key]} />
        <Hint k={key} value={form[key]} max={spec.max} />
        {errors[key] && <p className="text-sm font-semibold text-red-800" role="alert">{errors[key]}</p>}
      </div>
    );
  };

  const area = (key: 'description' | 'cardDescription' | 'fullDescription' | 'audience', rows: number, help?: string) => {
    const spec = DETAIL_SPEC[key] as { max: number; required?: boolean };
    return (
      <div className="space-y-1.5">
        <label htmlFor={`cd-${key}`} className="text-sm font-semibold text-slate-700">
          {DETAIL_LABELS[key]}
          {spec.required ? ' *' : ''}
        </label>
        <textarea id={`cd-${key}`} rows={rows} value={form[key]} onChange={(e) => set(key, e.target.value)} className={`${inputCls} resize-y`} aria-invalid={!!errors[key]} />
        {help && <p className="text-xs text-slate-600">{help}</p>}
        <Hint k={key} value={form[key]} max={spec.max} />
        {errors[key] && <p className="text-sm font-semibold text-red-800" role="alert">{errors[key]}</p>}
      </div>
    );
  };

  const list = (key: 'outcomes' | 'benefits', rows: number, help: string) => (
    <div className="space-y-1.5">
      <label htmlFor={`cd-${key}`} className="text-sm font-semibold text-slate-700">{DETAIL_LABELS[key]}</label>
      <textarea id={`cd-${key}`} rows={rows} value={form[key]} onChange={(e) => set(key, e.target.value)} className={`${inputCls} resize-y`} aria-invalid={!!errors[key]} />
      <p className="text-xs text-slate-600">{help}</p>
      {errors[key] && <p className="text-sm font-semibold text-red-800" role="alert">{errors[key]}</p>}
    </div>
  );

  return (
    <div className="p-8 space-y-8" data-testid="course-details-editor">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 mb-1">Edit course page: {course.title}</h2>
          <p className="text-sm text-slate-600">Changes to the live page appear for visitors immediately. No code change or redeploy is needed.</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" onClick={onCancel} className="rounded-xl">Cancel</Button>
          <Button onClick={save} disabled={!dirty || saving || loading || !!(error && target === 'draft' && !dirty)} className="rounded-xl bg-blue-900">
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" /> : <CheckCircle2 className="mr-2 h-4 w-4" aria-hidden="true" />}
            Save changes
          </Button>
        </div>
      </div>

      {chooseTarget && (
        <fieldset className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <legend className="px-2 text-sm font-semibold text-slate-800">Which version are you editing?</legend>
          <label className="flex items-start gap-2 py-1 text-sm text-slate-800">
            <input type="radio" name="cd-target" checked={target === 'live'} onChange={() => setTarget('live')} className="mt-1" />
            <span><strong>Live page</strong>: what visitors see right now.</span>
          </label>
          <label className="flex items-start gap-2 py-1 text-sm text-slate-800">
            <input type="radio" name="cd-target" checked={target === 'draft'} onChange={() => setTarget('draft')} className="mt-1" />
            <span><strong>Draft</strong>: the new version of this course. Visitors see it only after you publish it.</span>
          </label>
        </fieldset>
      )}
      {gated && livePublished && (
        <p className="rounded-xl bg-blue-50 p-3 text-sm text-blue-900">This change is saved to the live page and to the draft, so a later publish will not undo it.</p>
      )}

      {triedSave && !local.ok && <p className="rounded-xl bg-red-50 p-4 text-sm text-red-900" role="alert">Please fix the highlighted fields.</p>}
      {error && <p className="rounded-xl bg-red-50 p-4 text-sm text-red-900" role="alert">{error}</p>}
      {loading && <p className="text-sm text-slate-600" role="status">Loading…</p>}

      <div className={`grid gap-8 lg:grid-cols-[1fr_340px] ${loading ? 'opacity-50' : ''}`}>
        <div className="space-y-6">
          <h3 className="text-lg font-bold text-slate-900">Card and headline</h3>
          <div className="grid gap-6 md:grid-cols-2">
            {text('title')}
            {text('subtitle')}
            {text('trackLabel')}
            <div className="space-y-1.5">
              <label htmlFor="cd-image" className="text-sm font-semibold text-slate-700">{DETAIL_LABELS.image}</label>
              <div className="flex gap-2">
                <input id="cd-image" type="text" value={form.image} onChange={(e) => set('image', e.target.value)} className={inputCls} placeholder="https://…" aria-invalid={!!errors.image} />
                <label className="flex cursor-pointer items-center rounded-xl bg-blue-50 px-3 text-blue-900 hover:bg-blue-100" title="Upload an image">
                  {uploading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Upload className="h-4 w-4" aria-hidden="true" />}
                  <span className="sr-only">Upload an image</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      setUploading(true);
                      setServerErrors((er) => ({ ...er, image: '' }));
                      try {
                        set('image', await onUpload(file));
                      } catch (err: any) {
                        setServerErrors((er) => ({ ...er, image: err?.message || 'Upload failed.' }));
                      } finally {
                        setUploading(false);
                        e.target.value = '';
                      }
                    }}
                  />
                </label>
              </div>
              {errors.image && <p className="text-sm font-semibold text-red-800" role="alert">{errors.image}</p>}
            </div>
          </div>
          {area('cardDescription', 3, 'Shown on the course card. Leave empty to use the short description.')}

          <h3 className="pt-2 text-lg font-bold text-slate-900">Course page</h3>
          {area('description', 3)}
          {area('fullDescription', 10, 'Leave a blank line between paragraphs. Empty shows the short description instead.')}

          <h3 className="pt-2 text-lg font-bold text-slate-900">Facts</h3>
          <div className="grid gap-6 md:grid-cols-2">
            {text('duration')}
            {text('format')}
          </div>
          {area('audience', 3)}

          <h3 className="pt-2 text-lg font-bold text-slate-900">Lists</h3>
          {list('outcomes', 6, 'One per line, up to 10. Shown as "What You\'ll Achieve".')}
          {list('benefits', 6, 'One per line, up to 10. Empty restores the default feature list.')}
        </div>

        <aside aria-label="Card preview" className="lg:sticky lg:top-24 lg:self-start">
          <p className="mb-2 text-xs font-bold uppercase tracking-widest text-slate-600">Card preview</p>
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm" data-testid="card-preview">
            <div className="relative h-36 bg-slate-100">
              {form.image && isPreviewable(form.image) && <img src={form.image} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" />}
              <span className="absolute left-3 top-3 rounded-full bg-white/90 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-blue-900">
                {form.trackLabel || 'Executive Track'}
              </span>
            </div>
            <div className="p-4">
              <h4 className="text-lg font-bold leading-tight text-slate-900">{form.title || 'Course title'}</h4>
              {form.subtitle && <p className="mt-1 text-sm font-semibold text-blue-900">{form.subtitle}</p>}
              <p className="mt-2 line-clamp-3 text-sm text-slate-600">{form.cardDescription || form.description}</p>
              <ul className="mt-3 space-y-1 text-xs text-slate-600">
                <li className="flex items-center gap-2"><Clock className="h-3.5 w-3.5 text-blue-900" aria-hidden="true" />{form.duration}</li>
                {form.format && <li className="flex items-center gap-2"><MonitorPlay className="h-3.5 w-3.5 text-blue-900" aria-hidden="true" />{form.format}</li>}
                <li className="flex items-center gap-2"><Users className="h-3.5 w-3.5 text-blue-900" aria-hidden="true" />{form.audience}</li>
              </ul>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
};

const isPreviewable = (v: string) => v.startsWith('/') || v.startsWith('https://');

const Hint = ({ k, value, max }: { k: string; value: string; max: number }) => (
  <p id={`cd-${k}-count`} className={`text-xs ${value.length > max ? 'font-semibold text-red-800' : 'text-slate-600'}`}>
    {value.length}/{max}
  </p>
);
