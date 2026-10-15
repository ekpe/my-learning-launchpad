import React, { useState } from 'react';
import { AlertTriangle, CheckCircle2, ClipboardList, Clock, Download, Loader2 } from 'lucide-react';
import type { Course, CurriculumTopic } from '../types';
import { useActionCard, type SectionDraft } from '../hooks/useActionCard';
import { ACTION_CARD_KEYS, MAX_OUTPUT_CHARS, keyForModule, type ActionCardKey } from '../lib/actionCardLogic';
import { downloadActionCardPdf } from '../lib/actionCardPdf';

interface Props {
  course: Course;
  moduleIndex: number;
  topic: CurriculumTopic;
  uid: string;
  learnerName: string;
}

const STATUS_TEXT: Record<SectionDraft['state'], string> = {
  empty: 'Not started',
  saved: 'Saved',
  dirty: 'Unsaved changes',
  saving: 'Saving…',
  error: 'Not saved',
  conflict: 'Needs your decision',
};

interface SectionProps {
  label: string;
  hint: string;
  keyName: ActionCardKey;
  draft: SectionDraft;
  onChange: (k: ActionCardKey, v: string) => void;
  onSave: (k: ActionCardKey) => void;
  onTakeNewer: (k: ActionCardKey) => void;
  onKeepMine: (k: ActionCardKey) => void;
  heading?: boolean;
}

const Section = ({ label, hint, keyName, draft, onChange, onSave, onTakeNewer, onKeepMine, heading }: SectionProps) => {
  const id = `action-card-${keyName}`;
  const Heading = heading ? 'h4' : 'p';
  return (
    <div className="rounded-2xl bg-white p-4 ring-1 ring-amber-100" data-testid={`ac-section-${keyName}`}>
      <Heading className="text-xs font-bold uppercase tracking-widest text-amber-800">{label}</Heading>
      <p className="mt-1 text-sm text-slate-600">{hint}</p>
      <label htmlFor={id} className="sr-only">{`Your answer: ${label}`}</label>
      <textarea
        id={id}
        value={draft.text}
        onChange={(e) => onChange(keyName, e.target.value)}
        rows={4}
        maxLength={MAX_OUTPUT_CHARS}
        aria-describedby={`${id}-status`}
        className="mt-2 w-full rounded-xl border border-slate-300 bg-white p-3 text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-900"
        placeholder="Write a few lines. It saves automatically."
      />
      <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
        <p
          id={`${id}-status`}
          role="status"
          aria-live="polite"
          className={`flex items-center gap-1.5 text-sm font-semibold ${
            draft.state === 'error' || draft.state === 'conflict' ? 'text-red-800' : draft.state === 'saved' ? 'text-green-800' : 'text-slate-700'
          }`}
        >
          {draft.state === 'saving' && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
          {draft.state === 'saved' && <CheckCircle2 className="h-4 w-4" aria-hidden="true" />}
          {(draft.state === 'error' || draft.state === 'conflict') && <AlertTriangle className="h-4 w-4" aria-hidden="true" />}
          {STATUS_TEXT[draft.state]}
          <span className="ml-2 font-normal text-slate-600">{draft.text.length}/{MAX_OUTPUT_CHARS}</span>
        </p>
        <button
          type="button"
          onClick={() => onSave(keyName)}
          disabled={draft.state === 'saving' || draft.state === 'conflict' || draft.state === 'saved' || draft.state === 'empty'}
          className="rounded-full border border-amber-700 px-4 py-1.5 text-sm font-bold text-amber-900 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700"
        >
          {draft.state === 'error' ? 'Try again' : 'Save now'}
        </button>
      </div>

      {draft.state === 'error' && draft.message && (
        <p role="alert" className="mt-2 rounded-lg bg-red-50 p-3 text-sm text-red-900">{draft.message}</p>
      )}

      {draft.state === 'conflict' && draft.remote && (
        <div role="alert" className="mt-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">
          <p className="font-bold">A newer answer was saved from another device.</p>
          <p className="mt-2 whitespace-pre-wrap rounded-lg bg-white p-3 text-slate-900">{draft.remote.text || '(empty)'}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={() => onTakeNewer(keyName)} className="rounded-full bg-blue-900 px-4 py-1.5 font-bold text-white hover:bg-blue-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-900">
              Use the newer answer
            </button>
            <button type="button" onClick={() => onKeepMine(keyName)} className="rounded-full border border-red-800 px-4 py-1.5 font-bold text-red-900 hover:bg-red-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-800">
              Keep mine and replace it
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * The cumulative "AI Leadership Action Card". Answers are saved to the learner's own private Firestore record
 * (one revision-tracked section per module), so they follow the learner across devices.
 */
export const ActionCardPanel = ({ course, moduleIndex, topic, uid, learnerName }: Props) => {
  const card = useActionCard(uid, course.id);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [pdfBusy, setPdfBusy] = useState(false);

  const outputs = course.assignment?.outputs ?? [];
  const isFinal = moduleIndex === course.curriculum.length - 1;
  const currentKey = keyForModule(moduleIndex);
  const keys: ActionCardKey[] = isFinal ? [...ACTION_CARD_KEYS] : currentKey ? [currentKey] : [];

  const exportPdf = async () => {
    setPdfError(null);
    setPdfBusy(true);
    try {
      await downloadActionCardPdf({
        learnerName,
        courseTitle: course.title,
        dateLabel: new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }),
        sections: ACTION_CARD_KEYS.map((k, i) => ({
          module: outputs[i]?.module ?? `Module ${i + 1}`,
          prompt: outputs[i]?.text ?? '',
          answer: card.drafts[k].text,
        })),
      });
    } catch (err) {
      console.error('Action Card PDF failed:', err);
      setPdfError('We could not create the PDF. Please try again.');
    } finally {
      setPdfBusy(false);
    }
  };

  return (
    <section className="rounded-3xl border border-amber-200 bg-amber-50/60 p-6 md:p-8" aria-labelledby="action-card-heading">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 id="action-card-heading" className="flex items-center gap-2 text-xl font-bold text-slate-900">
          <ClipboardList className="h-5 w-5 text-amber-700" aria-hidden="true" />
          {course.assignment?.title ?? 'Action Card'}
        </h3>
        {typeof topic.plannedMinutes === 'number' && (
          <span className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1 text-xs font-bold text-amber-800 ring-1 ring-amber-200">
            <Clock className="h-3.5 w-3.5" aria-hidden="true" /> About {topic.plannedMinutes} min
          </span>
        )}
      </div>

      <p className="mt-3 text-sm font-semibold text-amber-900" role="status" data-testid="ac-progress">
        Action Card progress: {card.savedCount} of {ACTION_CARD_KEYS.length} outputs saved
      </p>
      <div className="mt-2 h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-amber-100" aria-hidden="true">
        <div className="h-full bg-amber-500 transition-all" style={{ width: `${(card.savedCount / ACTION_CARD_KEYS.length) * 100}%` }} />
      </div>
      <p className="mt-2 text-xs text-slate-700">Private to you and saved to your account, so it follows you to any device.</p>

      {card.loadError && <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-900">{card.loadError}</p>}

      {!card.loaded ? (
        <p className="mt-4 flex items-center gap-2 text-sm text-slate-700"><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Loading your saved answers…</p>
      ) : (
        <div className="mt-5 space-y-4">
          {isFinal && <p className="font-semibold leading-relaxed text-slate-900">{topic.output}</p>}
          {keys.map((k) => {
            const i = ACTION_CARD_KEYS.indexOf(k);
            return (
              <Section
                key={k}
                keyName={k}
                heading={isFinal}
                label={outputs[i]?.module ?? `Module ${i + 1}`}
                hint={outputs[i]?.text ?? ''}
                draft={card.drafts[k]}
                onChange={card.setText}
                onSave={card.save}
                onTakeNewer={card.takeNewer}
                onKeepMine={card.keepMine}
              />
            );
          })}
        </div>
      )}

      <div className="mt-6">
        <button
          type="button"
          onClick={exportPdf}
          disabled={pdfBusy || !card.loaded}
          className="inline-flex items-center gap-2 rounded-full bg-blue-900 px-6 py-2.5 text-sm font-bold text-white hover:bg-blue-800 disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-900"
        >
          {pdfBusy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Download className="h-4 w-4" aria-hidden="true" />}
          Download your Action Card (PDF)
        </button>
        <p className="mt-2 text-xs text-slate-700">A clean one-page PDF of everything you have written so far.</p>
        {pdfError && <p role="alert" className="mt-2 rounded-lg bg-red-50 p-3 text-sm text-red-900">{pdfError}</p>}
      </div>
    </section>
  );
};
