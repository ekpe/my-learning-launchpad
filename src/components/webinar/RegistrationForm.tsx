import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertCircle, Loader2 } from 'lucide-react';
import { SECTORS, validateRegistration } from '../../../api/_lib/webinar-shared';
import type { WebinarConfig } from '../../config/webinar';
import { getAttribution } from '../../services/attribution';
import { trackWebinar } from '../../services/webinarAnalytics';

interface Props {
  config: WebinarConfig;
  mode: 'registration' | 'interest';
  /** 'compact' is the narrow hero card: single column, with its own heading. */
  variant?: 'full' | 'compact';
  /** Keeps element ids unique when the form appears more than once on a page. */
  idPrefix?: string;
}

const inputClass =
  'scroll-mt-28 w-full rounded-xl border bg-white px-4 py-3 text-base text-slate-900 placeholder:text-slate-400 shadow-sm ' +
  'focus:border-navy-900 focus:outline-none focus:ring-2 focus:ring-navy-900/40';

const REQUEST_TIMEOUT_MS = 20_000;

export const RegistrationForm: React.FC<Props> = ({ config, mode, variant = 'full', idPrefix = 'wb' }) => {
  const navigate = useNavigate();
  const p = idPrefix;
  const compact = variant === 'compact';
  const [values, setValues] = useState({
    firstName: '',
    lastName: '',
    email: '',
    organization: '',
    role: '',
    sector: '',
    country: '',
  });
  const [marketingOptIn, setMarketingOptIn] = useState(false); // never pre-checked
  const [honeypot, setHoneypot] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const startedAt = useRef(Date.now());
  const errorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (formError) errorRef.current?.focus();
  }, [formError]);

  const set = (key: keyof typeof values) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setValues((v) => ({ ...v, [key]: e.target.value }));
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: '' }));
  };

  const fieldProps = (key: keyof typeof values) => ({
    id: `${p}-${key}`,
    name: key,
    value: values[key],
    onChange: set(key),
    'aria-invalid': errors[key] ? true : undefined,
    'aria-describedby': errors[key] ? `${p}-${key}-error` : undefined,
    className: `${inputClass} ${errors[key] ? 'border-red-600' : 'border-slate-300'}`,
  });

  const FieldError = ({ field }: { field: string }) =>
    errors[field] ? (
      <p id={`${p}-${field}-error`} className="mt-1.5 text-sm font-medium text-red-700">
        {errors[field]}
      </p>
    ) : null;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setFormError(null);

    const input = { ...values, marketingOptIn, attribution: getAttribution() };
    const checked = validateRegistration(input);
    if (!checked.ok || !checked.value) {
      setErrors(checked.errors);
      trackWebinar('webinar_registration_error', { event_id: config.id, error_code: 'validation' });
      const first = Object.keys(checked.errors)[0];
      document.getElementById(`${p}-${first}`)?.focus();
      return;
    }
    setErrors({});
    setSubmitting(true);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const res = await fetch('/api/webinar?action=register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...input, eventId: config.id, website: honeypot, formStartedAt: startedAt.current }),
        signal: controller.signal,
      });
      const data = await res.json().catch(() => null);

      if (res.ok && data?.ok) {
        trackWebinar('webinar_registration_complete', { event_id: config.id, mode: data.mode }, String(data.ref));
        navigate('/webinar/thank-you', {
          state: { eventId: config.id, firstName: checked.value.firstName, mode: data.mode, emailStatus: data.emailStatus },
        });
        return;
      }

      trackWebinar('webinar_registration_error', { event_id: config.id, error_code: String(data?.code ?? res.status) });
      if (data?.fields) setErrors(data.fields);
      setFormError(
        data?.error ??
          (res.status >= 500
            ? 'Something went wrong on our side. Please try again in a moment.'
            : 'We could not complete your registration. Please check your details and try again.')
      );
    } catch (err: any) {
      trackWebinar('webinar_registration_error', { event_id: config.id, error_code: err?.name === 'AbortError' ? 'timeout' : 'network' });
      setFormError(
        err?.name === 'AbortError'
          ? 'This is taking longer than expected. Please check your connection and try again.'
          : 'We could not reach the server. Please check your connection and try again.'
      );
    } finally {
      clearTimeout(timer);
      setSubmitting(false);
    }
  };

  const label = mode === 'registration' ? 'Reserve My Free Seat' : 'Join the Waitlist';

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      aria-busy={submitting}
      aria-labelledby={compact ? `${p}-title` : undefined}
      onFocusCapture={() => trackWebinar('webinar_registration_start', { event_id: config.id, mode }, config.id)}
      className={`rounded-3xl border border-slate-200 bg-white shadow-xl ${compact ? 'p-6' : 'p-6 sm:p-8'}`}
    >
      {compact && (
        <div className="mb-6">
          <h2 id={`${p}-title`} className="text-balance text-2xl font-bold tracking-tight text-slate-900">
            {mode === 'registration' ? 'Reserve Your Free Seat' : 'Get Notified When the Date Is Set'}
          </h2>
        </div>
      )}

      {formError && (
        <div
          ref={errorRef}
          role="alert"
          tabIndex={-1}
          className="mb-6 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900 focus:outline-none"
        >
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
          <p>{formError}</p>
        </div>
      )}

      <div className={`grid gap-5 ${compact ? '' : 'sm:grid-cols-2'}`}>
        <div>
          <label htmlFor={`${p}-firstName`} className="mb-1.5 block text-sm font-semibold text-slate-800">
            First name <span aria-hidden="true">*</span>
            <span className="sr-only">(required)</span>
          </label>
          <input {...fieldProps('firstName')} type="text" autoComplete="given-name" required />
          <FieldError field="firstName" />
        </div>
        <div>
          <label htmlFor={`${p}-email`} className="mb-1.5 block text-sm font-semibold text-slate-800">
            Email address <span aria-hidden="true">*</span>
            <span className="sr-only">(required)</span>
          </label>
          <input {...fieldProps('email')} type="email" inputMode="email" autoComplete="email" required />
          <FieldError field="email" />
        </div>
      </div>

      <details className="group mt-5 rounded-xl border border-slate-200 bg-slate-50/60 open:bg-white">
        <summary className="cursor-pointer select-none rounded-xl px-4 py-3 text-sm font-semibold text-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-navy-900">
          Tell us a bit more <span className="font-normal text-slate-500">(optional)</span>
        </summary>
        <div className={`grid gap-5 px-4 pb-5 pt-2 ${compact ? '' : 'sm:grid-cols-2'}`}>
          <div>
            <label htmlFor={`${p}-lastName`} className="mb-1.5 block text-sm font-semibold text-slate-800">Last name</label>
            <input {...fieldProps('lastName')} type="text" autoComplete="family-name" />
          </div>
          <div>
            <label htmlFor={`${p}-organization`} className="mb-1.5 block text-sm font-semibold text-slate-800">Organization</label>
            <input {...fieldProps('organization')} type="text" autoComplete="organization" />
          </div>
          <div>
            <label htmlFor={`${p}-role`} className="mb-1.5 block text-sm font-semibold text-slate-800">Role</label>
            <input {...fieldProps('role')} type="text" autoComplete="organization-title" />
          </div>
          <div>
            <label htmlFor={`${p}-sector`} className="mb-1.5 block text-sm font-semibold text-slate-800">Sector</label>
            <select {...fieldProps('sector')}>
              <option value="">Select a sector</option>
              {SECTORS.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            <FieldError field="sector" />
          </div>
          <div className={compact ? '' : 'sm:col-span-2'}>
            <label htmlFor={`${p}-country`} className="mb-1.5 block text-sm font-semibold text-slate-800">Country</label>
            <input {...fieldProps('country')} type="text" autoComplete="country-name" />
          </div>
        </div>
      </details>

      {/* Honeypot: invisible to people and assistive tech; bots tend to fill it. */}
      <div aria-hidden="true" style={{ position: 'absolute', left: '-10000px', width: 1, height: 1, overflow: 'hidden' }}>
        <label htmlFor={`${p}-website`}>Website</label>
        <input id={`${p}-website`} name="website" type="text" tabIndex={-1} autoComplete="off" value={honeypot} onChange={(e) => setHoneypot(e.target.value)} />
      </div>

      <p className="mt-6 text-sm leading-relaxed text-slate-600">
        By registering, you agree that MyLearningLaunchpad may use your details to run this webinar and to email you
        confirmations, reminders and joining instructions. See our{' '}
        <Link to="/privacy" className="font-semibold text-navy-900 underline underline-offset-2">Privacy Policy</Link>.
      </p>

      <label htmlFor={`${p}-marketing`} className="mt-4 flex cursor-pointer items-start gap-3 text-sm leading-relaxed text-slate-700">
        <input
          id={`${p}-marketing`}
          type="checkbox"
          checked={marketingOptIn}
          onChange={(e) => setMarketingOptIn(e.target.checked)}
          className="mt-0.5 h-5 w-5 shrink-0 rounded border-slate-400 text-navy-900 focus:ring-2 focus:ring-navy-900/40"
        />
        <span>
          Also send me occasional updates about MyLearningLaunchpad courses and AI leadership learning.{' '}
          <span className="text-slate-500">Optional. You can unsubscribe at any time.</span>
        </span>
      </label>

      <button
        type="submit"
        disabled={submitting}
        className="mt-7 inline-flex w-full items-center justify-center gap-2 rounded-full bg-navy-900 px-8 py-4 text-base font-bold text-white shadow-lg shadow-navy-900/20 transition-colors hover:bg-navy-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy-900 disabled:cursor-not-allowed disabled:opacity-70"
      >
        {submitting ? (
          <>
            <Loader2 className="h-5 w-5 animate-spin motion-reduce:animate-none" aria-hidden="true" />
            {mode === 'registration' ? 'Reserving your seat…' : 'Adding you to the waitlist…'}
          </>
        ) : (
          label
        )}
      </button>
      <p className="mt-3 text-center text-xs text-slate-500">Free. No payment details needed.</p>
    </form>
  );
};
