import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { getConsent, onConsentReopen, setConsent } from '../services/consent';

/**
 * Small, non-modal consent notice. Appears only until the visitor makes a
 * choice (or re-opens it from the footer). Accept and Decline carry equal weight.
 */
export const ConsentBanner = () => {
  const [open, setOpen] = useState(false);
  const acceptRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setOpen(getConsent() === null);
    return onConsentReopen(() => setOpen(true));
  }, []);

  useEffect(() => {
    if (open && getConsent() !== null) acceptRef.current?.focus();
  }, [open]);

  if (!open) return null;

  const choose = (analytics: boolean) => {
    setConsent(analytics);
    setOpen(false);
  };

  return (
    <div
      role="region"
      aria-label="Analytics preferences"
      className="fixed inset-x-0 bottom-0 z-[60] p-3 sm:p-4 pointer-events-none"
    >
      <div className="pointer-events-auto mx-auto max-w-3xl rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-2xl">
        <p className="text-sm text-slate-700 leading-relaxed">
          We'd like to use analytics cookies to understand how people find and use this site. They stay off unless you
          accept. See our{' '}
          <Link to="/privacy#cookies" className="font-semibold text-navy-900 underline underline-offset-2">
            Privacy &amp; Cookie Policy
          </Link>
          .
        </p>
        <div className="mt-3 flex gap-2 sm:mt-4 sm:justify-end">
          <button
            type="button"
            onClick={() => choose(false)}
            className="flex-1 rounded-full border border-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy-900 sm:flex-none"
          >
            Decline
          </button>
          <button
            ref={acceptRef}
            type="button"
            onClick={() => choose(true)}
            className="flex-1 rounded-full border border-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy-900 sm:flex-none"
          >
            Accept analytics
          </button>
        </div>
      </div>
    </div>
  );
};
