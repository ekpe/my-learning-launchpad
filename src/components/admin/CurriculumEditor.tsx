import React, { useEffect, useState } from 'react';
import { CheckCircle, Loader2, FileText, Video, Upload, GripVertical, Plus, Trash2, AlertCircle } from 'lucide-react';
import { Button } from '../ui/Button';
import { courseDuration } from '../../lib/courseDuration';
import { assessTopic } from '../../../api/_lib/course-publication';
import { VIDEO_HELP } from '../../lib/uploadLimits';
import type { Course } from '../../types';

export interface CurriculumEditorProps {
  course: Course;
  /** Launch-gated course: edits go to the draft (not the live course) and are published separately. */
  gated: boolean;
  busy: boolean;
  isUploading: boolean;
  onCancel: () => void;
  /** Resolves with the file's URL, or throws an Error whose message is shown next to the field. */
  onUpload: (file: File) => Promise<string>;
  onSave: (curriculum: any[]) => Promise<void>;
  /** Gated only: returns the draft curriculum, or null when no draft exists yet. */
  loadDraft?: () => Promise<any[] | null>;
}

const STATE_STYLE: Record<string, string> = {
  planned: 'bg-slate-100 text-slate-700',
  'in-production': 'bg-amber-100 text-amber-900',
  ready: 'bg-blue-100 text-blue-900',
  published: 'bg-green-100 text-green-900',
};

/**
 * Defined at module level on purpose: when it lived inside AdminDashboard it was re-created on every parent
 * render (for example when an upload started), which remounted it and discarded unsaved edits.
 */
export const CurriculumEditor = ({ course, gated, busy, isUploading, onCancel, onUpload, onSave, loadDraft }: CurriculumEditorProps) => {
    const [localCurriculum, setLocalCurriculum] = useState<any[]>(course.curriculum || []);
    // Upload problems are shown beside the field they belong to (a banner at the top of the page is easy to miss).
    const [uploadErrors, setUploadErrors] = useState<Record<string, string>>({});
    const [uploadingKey, setUploadingKey] = useState<string | null>(null);
    const runUpload = async (key: string, file: File, apply: (url: string) => void) => {
      setUploadErrors((e) => ({ ...e, [key]: '' }));
      setUploadingKey(key);
      try {
        apply(await onUpload(file));
      } catch (err: any) {
        setUploadErrors((e) => ({ ...e, [key]: err?.message || 'Upload failed.' }));
      } finally {
        setUploadingKey(null);
      }
    };

    const [draftState, setDraftState] = useState<'ready' | 'loading' | 'missing' | 'error'>(gated ? 'loading' : 'ready');

    useEffect(() => {
      if (!gated || !loadDraft) return;
      let cancelled = false;
      loadDraft()
        .then((cur) => {
          if (cancelled) return;
          if (cur) {
            setLocalCurriculum(cur);
            setDraftState('ready');
          } else {
            setDraftState('missing');
          }
        })
        .catch(() => !cancelled && setDraftState('error'));
      return () => {
        cancelled = true;
      };
    }, [gated]);


    const addModule = () => {
      setLocalCurriculum([...localCurriculum, { module: 'New Module', topics: [] }]);
    };

    const removeModule = (mIdx: number) => {
      const newCur = [...localCurriculum];
      newCur.splice(mIdx, 1);
      setLocalCurriculum(newCur);
    };

    const updateModulePhase = (mIdx: number, phase: string) => {
      const newCur = [...localCurriculum];
      newCur[mIdx].phase = phase;
      setLocalCurriculum(newCur);
    };

    const updateModuleTitle = (mIdx: number, title: string) => {
      const newCur = [...localCurriculum];
      newCur[mIdx].module = title;
      setLocalCurriculum(newCur);
    };

    const addLesson = (mIdx: number) => {
      const newCur = [...localCurriculum];
      newCur[mIdx].topics.push({ id: `m${mIdx + 1}-x${Date.now().toString(36)}`, title: 'New Lesson', description: '', kind: 'lesson' });
      setLocalCurriculum(newCur);
    };

    const removeLesson = (mIdx: number, lIdx: number) => {
      const newCur = [...localCurriculum];
      newCur[mIdx].topics.splice(lIdx, 1);
      setLocalCurriculum(newCur);
    };

    const updateLesson = (mIdx: number, lIdx: number, data: any) => {
      const newCur = [...localCurriculum];
      newCur[mIdx].topics[lIdx] = { ...newCur[mIdx].topics[lIdx], ...data };
      setLocalCurriculum(newCur);
    };

    return (
      <div className="p-8 space-y-8 animate-in fade-in duration-500">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-slate-900 mb-1">Curriculum Editor: {course.title}</h2>
            <p className="text-slate-500 text-sm">Add modules, lessons, and upload relevant materials or videos.</p>
            {gated && (
              <p className="mt-1 text-xs font-semibold text-blue-900">
                Editing the DRAFT. Learners do not see changes until you publish from Launch readiness.
              </p>
            )}
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={onCancel} className="rounded-xl">Cancel</Button>
            <Button 
              onClick={() => onSave(localCurriculum)} 
              disabled={busy || (gated && draftState !== 'ready')}
              className="rounded-xl flex items-center gap-2 bg-blue-900"
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
              Save All Changes
            </Button>
          </div>
        </div>

        {(() => {
          const d = courseDuration({ curriculum: localCurriculum });
          return (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700" role="status">
              <span className="font-bold text-slate-900">Planned total: {d.totalMinutes} min</span>
              {' '}({d.videoMinutes} video + {d.activityMinutes} activity, required lessons only; optional lessons are excluded).
              {!d.complete && <span className="ml-1 font-semibold text-amber-700">Some required lessons have no planned minutes yet, so the course duration will not be updated on save.</span>}
              <span className="ml-1 text-slate-500">These are planned durations, not measured run times.</span>
            </div>
          );
        })()}

        {gated && draftState === 'loading' && <p className="text-sm text-slate-600" role="status">Loading draft…</p>}
        {gated && draftState === 'missing' && (
          <p className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900" role="alert">
            There is no draft yet. Press "Sync Static Data" first. For this course it creates the draft (it never changes the live course).
          </p>
        )}
        {gated && draftState === 'error' && <p className="rounded-xl bg-red-50 p-4 text-sm text-red-900" role="alert">Could not load the draft. Please try again.</p>}

        <div className="space-y-6">
          {localCurriculum.map((mod, mIdx) => (
            <div key={mIdx} className="bg-slate-50 rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
              <div className="p-4 bg-slate-100/50 flex items-center justify-between border-b border-slate-200">
                <div className="flex items-center gap-4 flex-1">
                  <GripVertical className="w-5 h-5 text-slate-400" />
                  <input
                    type="text"
                    value={mod.module}
                    onChange={(e) => updateModuleTitle(mIdx, e.target.value)}
                    className="bg-transparent border-b border-transparent hover:border-slate-300 focus:border-blue-900 font-bold text-slate-900 outline-none transition-all px-1 py-0.5 flex-1"
                    aria-label={`Module ${mIdx + 1} title`}
                  />
                  <input
                    type="text"
                    value={mod.phase || ''}
                    onChange={(e) => updateModulePhase(mIdx, e.target.value)}
                    className="w-32 bg-transparent border-b border-slate-200 text-xs font-semibold text-slate-700 outline-none focus:border-blue-900 px-1 py-0.5"
                    placeholder="Phase (e.g. Understand)"
                    aria-label={`Module ${mIdx + 1} phase label`}
                  />
                </div>
                <button
                  onClick={() => removeModule(mIdx)}
                  className="p-2 text-slate-400 hover:text-rose-600 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              <div className="p-4 space-y-4">
                {mod.topics?.map((lesson: any, lIdx: number) => (
                  <div key={lIdx} className="bg-white p-4 rounded-xl border border-slate-200 space-y-4 transition-all hover:border-slate-300 shadow-sm">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 flex-1">
                        <span className="text-xs font-bold text-slate-400 w-6">L{lIdx + 1}</span>
                        <input
                          type="text"
                          value={lesson.title}
                          onChange={(e) => updateLesson(mIdx, lIdx, { title: e.target.value })}
                          className="bg-transparent border-b border-slate-100 hover:border-slate-300 focus:border-blue-900 font-semibold text-slate-900 outline-none transition-all px-1 py-0.5 flex-1"
                          placeholder="Lesson Title"
                        />
                      </div>
                      <button
                        onClick={() => removeLesson(mIdx, lIdx)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="flex flex-wrap items-end gap-4 rounded-lg bg-slate-50 p-3">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                        Type
                        <select
                          value={lesson.kind || 'lesson'}
                          onChange={(e) => updateLesson(mIdx, lIdx, { kind: e.target.value })}
                          className="mt-1 block rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm font-normal normal-case text-slate-900"
                        >
                          <option value="lesson">Lesson (video)</option>
                          <option value="activity">Activity</option>
                        </select>
                      </label>
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                        Planned minutes
                        <input
                          type="number"
                          min={0}
                          max={240}
                          value={typeof lesson.plannedMinutes === 'number' ? lesson.plannedMinutes : ''}
                          onChange={(e) => updateLesson(mIdx, lIdx, { plannedMinutes: e.target.value === '' ? undefined : Math.max(0, Number(e.target.value)) })}
                          className="mt-1 block w-24 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm font-normal text-slate-900"
                        />
                      </label>
                      {gated && (
                        <>
                          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                            Production status
                            <select
                              value={lesson.productionStatus || 'planned'}
                              onChange={(e) => updateLesson(mIdx, lIdx, { productionStatus: e.target.value })}
                              className="mt-1 block rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm font-normal normal-case text-slate-900"
                            >
                              <option value="planned">Planned</option>
                              <option value="in-production">In production</option>
                              <option value="published">Published (approved)</option>
                            </select>
                          </label>
                          {(() => {
                            const a = assessTopic(lesson);
                            return (
                              <span className="pb-1.5 text-sm" data-testid={`lesson-state-${mIdx}-${lIdx}`}>
                                <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${STATE_STYLE[a.state]}`}>{a.state}</span>
                                {a.warnings[0] && (
                                  <span className="ml-2 inline-flex items-center gap-1 text-xs font-semibold text-red-800"><AlertCircle className="h-3.5 w-3.5" aria-hidden="true" />{a.warnings[0]}</span>
                                )}
                              </span>
                            );
                          })()}
                        </>
                      )}
                      <label className="flex items-center gap-2 pb-1.5 text-sm font-medium text-slate-700">
                        <input
                          type="checkbox"
                          checked={!!lesson.optional}
                          onChange={(e) => updateLesson(mIdx, lIdx, { optional: e.target.checked || undefined })}
                        />
                        Optional (not required for completion; excluded from totals)
                      </label>
                    </div>
                    {lesson.kind === 'activity' && (
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block" htmlFor={`out-${mIdx}-${lIdx}`}>Action Card output</label>
                        <textarea
                          id={`out-${mIdx}-${lIdx}`}
                          value={lesson.output || ''}
                          onChange={(e) => updateLesson(mIdx, lIdx, { output: e.target.value })}
                          className="w-full text-sm p-3 rounded-lg border border-slate-100 bg-slate-50/30 focus:bg-white transition-all outline-none focus:ring-1 focus:ring-blue-900/10 resize-none h-16"
                          placeholder="What the learner produces for the cumulative activity..."
                        />
                      </div>
                    )}

                    <div className="grid md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Description</label>
                        <textarea
                          value={lesson.description || ''}
                          onChange={(e) => updateLesson(mIdx, lIdx, { description: e.target.value })}
                          className="w-full text-sm p-3 rounded-lg border border-slate-100 bg-slate-50/30 focus:bg-white transition-all outline-none focus:ring-1 focus:ring-blue-900/10 resize-none h-20"
                          placeholder="What will students learn in this lesson..."
                        />
                      </div>
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Video URL or Upload</label>
                          <div className="flex gap-2">
                            <div className="relative flex-1">
                              <Video className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                              <input
                                type="text"
                                value={lesson.videoUrl || ''}
                                onChange={(e) => updateLesson(mIdx, lIdx, { videoUrl: e.target.value })}
                                className="w-full text-xs pl-9 pr-4 py-2 rounded-lg border border-slate-100 bg-slate-50/30 focus:bg-white outline-none focus:ring-1 focus:ring-blue-900/10"
                                placeholder="Paste video URL (YouTube, Vimeo, etc.)"
                              />
                            </div>
                            <div className="relative">
                              <input
                                type="file"
                                id={`video-${mIdx}-${lIdx}`}
                                className="hidden"
                                accept="video/*"
                                onChange={async (e) => {
                                  const input = e.target;
                                  const file = input.files?.[0];
                                  input.value = ''; // lets the same file be chosen again after a failure
                                  if (file) await runUpload(`video-${mIdx}-${lIdx}`, file, (url) => updateLesson(mIdx, lIdx, { videoUrl: url }));
                                }}
                              />
                              <label
                                htmlFor={`video-${mIdx}-${lIdx}`}
                                className="p-2 bg-blue-50 text-blue-900 rounded-lg cursor-pointer hover:bg-blue-100 transition-colors flex items-center justify-center"
                                title="Upload a small file (videos: paste a link instead)"
                              >
                                {uploadingKey === `video-${mIdx}-${lIdx}` ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                              </label>
                            </div>
                          </div>
                          <p className="text-xs text-slate-600">{VIDEO_HELP}</p>
                          {uploadErrors[`video-${mIdx}-${lIdx}`] && (
                            <p className="rounded-lg bg-red-50 p-2 text-xs font-semibold text-red-900" role="alert" data-testid={`upload-error-video-${mIdx}-${lIdx}`}>{uploadErrors[`video-${mIdx}-${lIdx}`]}</p>
                          )}
                        </div>

                        <div className="space-y-2">
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Materials / Links</label>
                          <div className="flex gap-2">
                            <div className="relative flex-1">
                              <FileText className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                              <input
                                type="text"
                                value={lesson.materialUrl || ''}
                                onChange={(e) => updateLesson(mIdx, lIdx, { materialUrl: e.target.value })}
                                className="w-full text-xs pl-9 pr-4 py-2 rounded-lg border border-slate-100 bg-slate-50/30 focus:bg-white outline-none focus:ring-1 focus:ring-blue-900/10"
                                placeholder="External resource link"
                              />
                            </div>
                            <div className="relative">
                              <input
                                type="file"
                                id={`material-${mIdx}-${lIdx}`}
                                className="hidden"
                                onChange={async (e) => {
                                  const input = e.target;
                                  const file = input.files?.[0];
                                  input.value = '';
                                  if (file) await runUpload(`material-${mIdx}-${lIdx}`, file, (url) => updateLesson(mIdx, lIdx, { materialUrl: url }));
                                }}
                              />
                              <label
                                htmlFor={`material-${mIdx}-${lIdx}`}
                                className="p-2 bg-blue-50 text-blue-900 rounded-lg cursor-pointer hover:bg-blue-100 transition-colors flex items-center justify-center"
                                title="Upload Material"
                              >
                                {uploadingKey === `material-${mIdx}-${lIdx}` ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                              </label>
                            </div>
                          </div>
                          {uploadErrors[`material-${mIdx}-${lIdx}`] && (
                            <p className="rounded-lg bg-red-50 p-2 text-xs font-semibold text-red-900" role="alert">{uploadErrors[`material-${mIdx}-${lIdx}`]}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
                <button
                  onClick={() => addLesson(mIdx)}
                  className="w-full py-3 border-2 border-dashed border-slate-200 rounded-xl text-slate-400 font-bold text-sm hover:border-blue-900/20 hover:text-blue-900 hover:bg-blue-50/50 transition-all flex items-center justify-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Add Lesson
                </button>
              </div>
            </div>
          ))}

          <button
            onClick={addModule}
            className="w-full py-6 border-2 border-dashed border-slate-200 rounded-2xl text-slate-400 font-bold hover:border-blue-900/30 hover:text-blue-900 hover:bg-blue-50 transition-all flex items-center justify-center gap-2 group"
          >
            <div className="w-10 h-10 rounded-full border border-slate-200 flex items-center justify-center group-hover:bg-blue-900 group-hover:text-white transition-all">
              <Plus className="w-5 h-5" />
            </div>
            Add New Module
          </button>
        </div>
      </div>
    );
};
