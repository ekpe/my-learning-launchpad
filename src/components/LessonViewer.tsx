import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { courses } from '../data/courses';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebase';
import { doc, getDoc, updateDoc, onSnapshot, setDoc, serverTimestamp } from 'firebase/firestore';
import { sendEmail } from '../services/emailService';
import ReactPlayer from 'react-player';
import { logEvent, AnalyticsEvent } from '../services/analyticsService';

const Player = ReactPlayer as any;
import { 
  ChevronLeft, 
  ChevronRight, 
  PlayCircle, 
  CheckCircle2, 
  FileText, 
  Download,
  Menu,
  X,
  Loader2,
  ArrowLeft,
  Trophy
} from 'lucide-react';
import { Button } from './ui/Button';
import { motion, AnimatePresence } from 'motion/react';
import { Course, Enrollment } from '../types';
import { computeProgress, courseVersion, progressUpdate, resolveTrack, shouldIssueCertificate } from '../lib/courseProgress';
import { resolveCourse } from '../hooks/useLiveCourses';
import { buildCompletionEmail } from '../lib/completionEmail';
import { ActionCardPanel } from './ActionCardPanel';
import { ArrowRight, ClipboardList, Clock } from 'lucide-react';

export const LessonViewer = () => {
  const { courseId, moduleIndex, lessonIndex } = useParams<{ 
    courseId: string; 
    moduleIndex: string; 
    lessonIndex: string; 
  }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [loading, setLoading] = useState(true);
  const [courseReady, setCourseReady] = useState(false);
  const [startingNew, setStartingNew] = useState(false);
  // Open by default only where it sits beside the lesson (desktop); on phones it is a full-screen overlay.
  const [isSidebarOpen, setIsSidebarOpen] = useState(() => typeof window === 'undefined' || window.innerWidth >= 1024);
  // Launch-gated courses are never shown from the static copy: only a published (live) record counts.
  const [course, setCourse] = useState<Course | undefined>(() => resolveCourse(courseId ?? '', null));
  const playerRef = useRef<any>(null);

  useEffect(() => {
    if (courseId && moduleIndex && lessonIndex) {
      logEvent(AnalyticsEvent.LESSON_START, {
        courseId,
        moduleIndex,
        lessonIndex,
        lessonTitle: currentLesson?.title
      });
    }
  }, [courseId, moduleIndex, lessonIndex]);

  useEffect(() => {
    if (!courseId) return;

    const unsubscribe = onSnapshot(doc(db, 'courses', courseId), (docSnap) => {
      setCourse(resolveCourse(courseId, docSnap.exists() ? (docSnap.data() as Course) : null));
      setCourseReady(true);
    }, () => setCourseReady(true));

    return () => unsubscribe();
  }, [courseId]);

  const mIdx = parseInt(moduleIndex || '0');
  const lIdx = parseInt(lessonIndex || '0');
  
  const currentModule = course?.curriculum?.[mIdx];
  const currentLesson = currentModule?.topics?.[lIdx];
  const lessonId = `${mIdx}_${lIdx}`;

  useEffect(() => {
    if (!user || !courseId) return;

    const enrollmentId = `${user.uid}_${courseId}`;
    const unsubscribe = onSnapshot(doc(db, 'enrollments', enrollmentId), (docSnap) => {
      setEnrollment(docSnap.exists() ? (docSnap.data() as Enrollment) : null);
      setLoading(false);
    }, () => {
      // The rules refuse to read an enrollment that does not exist: that simply means "not enrolled".
      setEnrollment(null);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user, courseId]);

  const handleMarkComplete = async () => {
    if (!user || !courseId || !enrollment) return;

    // Which record applies to the curriculum as it is now (see resolveTrack). Never writes to a legacy result.
    const track = resolveTrack(course!, enrollment);
    if (track.source === 'none') return;
    const completedLessons = track.completedLessons;
    if (completedLessons.includes(lessonId)) return;

    const newCompletedLessons = [...completedLessons, lessonId];

    // Progress counts required topics only (optional topics and stale ids never affect it)
    const { fields, summary, status } = progressUpdate(track, course!, newCompletedLessons);
    const progress = summary.percent;

    try {
      const enrollmentId = `${user.uid}_${courseId}`;
      await updateDoc(doc(db, 'enrollments', enrollmentId), {
        ...fields,
        ...(track.source === 'v2Progress' && status === 'COMPLETED' ? { 'v2Progress.completedAt': serverTimestamp() } : {}),
      });

      logEvent(AnalyticsEvent.LESSON_COMPLETE, {
        courseId,
        lessonId,
        progress,
        status
      });

      // Generate a certificate on completion. Only the primary track earns one (see shouldIssueCertificate), and the
      // rules allow certificates to be CREATED but never updated, so an existing certificate (for example one earned on
      // an older version of this course) can never be overwritten. We do not read first: reading a certificate that does
      // not exist is itself denied by the rules, which would silently stop new certificates being issued.
      if (shouldIssueCertificate(track, status, false)) {
        const certificateId = `CERT_${user.uid}_${courseId}`;
        try {
          await setDoc(doc(db, 'certificates', certificateId), {
            userId: user.uid,
            courseId: courseId,
            courseTitle: course?.title || 'Course Completion',
            userName: user.displayName || user.email,
            issuedAt: serverTimestamp(),
            certificateId: certificateId,
            curriculumVersion: courseVersion(course)
          });
        } catch (certError: any) {
          // permission-denied here means the certificate already exists: keep the original.
          if (!String(certError?.code ?? '').includes('permission-denied')) throw certError;
        }
      }

      // The only progress email: one note when the course is finished. Best effort, and it runs after the
      // certificate so an email problem can never prevent a certificate.
      if (status === 'COMPLETED' && user.email) {
        const mail = buildCompletionEmail({
          name: user.displayName,
          courseTitle: course?.title || 'your course',
          courseUrl: `${window.location.origin}/course/${courseId}`,
          certificateUrl: shouldIssueCertificate(track, status, false) ? `${window.location.origin}/certificate/CERT_${user.uid}_${courseId}` : undefined,
        });
        void sendEmail({ context: 'self', to: user.email, ...mail }).catch(() => undefined);
      }
    } catch (error) {
      console.error("Error updating progress:", error);
    }
  };

  const startNewVersion = async () => {
    if (!user || !courseId || !course) return;
    setStartingNew(true);
    try {
      await updateDoc(doc(db, 'enrollments', `${user.uid}_${courseId}`), {
        v2Progress: {
          completedLessons: [],
          progress: 0,
          status: 'IN_PROGRESS',
          curriculumVersion: courseVersion(course),
          startedAt: serverTimestamp(),
        },
      });
    } catch (error) {
      console.error('Error starting the new version:', error);
      alert('We could not start the new version. Please try again.');
    } finally {
      setStartingNew(false);
    }
  };

  const navigateToLesson = (m: number, l: number) => {
    navigate(`/course/${courseId}/lesson/${m}/${l}`);
  };

  const getNextLesson = () => {
    if (!course) return null;
    if (lIdx < (currentModule?.topics.length || 0) - 1) {
      return { m: mIdx, l: lIdx + 1 };
    } else if (mIdx < (course.curriculum?.length || 0) - 1) {
      return { m: mIdx + 1, l: 0 };
    }
    return null;
  };

  const getPrevLesson = () => {
    if (!course) return null;
    if (lIdx > 0) {
      return { m: mIdx, l: lIdx - 1 };
    } else if (mIdx > 0) {
      const prevModule = course.curriculum?.[mIdx - 1];
      return { m: mIdx - 1, l: (prevModule?.topics.length || 0) - 1 };
    }
    return null;
  };

  if (loading || !courseReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <Loader2 className="w-12 h-12 animate-spin text-blue-900" />
      </div>
    );
  }

  if (!course || !currentLesson) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6">
        <h2 className="text-2xl font-bold text-slate-900 mb-4">Lesson not found</h2>
        <Link to="/dashboard">
          <Button variant="outline">Back to Dashboard</Button>
        </Link>
      </div>
    );
  }

  // Lessons are for enrolled learners. Without an enrollment, point them to the course page instead of a dead end.
  if (!enrollment) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="max-w-xl rounded-3xl bg-white p-8 shadow-xl border border-slate-100" data-testid="not-enrolled">
          <h1 className="text-2xl font-bold text-slate-900">Enroll to start this course</h1>
          <p className="mt-4 leading-relaxed text-slate-700">You are not enrolled in {course.title} yet. Open the course page to enroll, then come back to your lessons.</p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Link to={`/course/${course.id}`}><Button className="rounded-full px-8 w-full">Go to the course page</Button></Link>
            <Link to="/dashboard"><Button variant="outline" className="rounded-full px-8 w-full">Back to dashboard</Button></Link>
          </div>
        </div>
      </div>
    );
  }

  const next = getNextLesson();
  const prev = getPrevLesson();
  const track = resolveTrack(course, enrollment);
  const isCompleted = track.completedLessons.includes(lessonId);
  const progressSummary = computeProgress(course, track.completedLessons);
  const isActivity = currentLesson.kind === 'activity';
  const nextSteps = (course.nextStepCourseIds ?? [])
    .map((id) => courses.find((c) => c.id === id))
    .filter((c): c is Course => !!c);
  const showNextSteps = progressSummary.isComplete && nextSteps.length > 0 && !next;

  // Enrolled on an older curriculum and not (yet) on the new one: explain, never reinterpret old progress.
  if (enrollment && track.source === 'none' && track.isLegacyEnrollment) {
    const finished = track.legacy?.status === 'COMPLETED';
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="max-w-xl rounded-3xl bg-white p-8 shadow-xl border border-slate-100" data-testid="legacy-gate">
          <h1 className="text-2xl font-bold text-slate-900">{finished ? 'You completed the original course' : 'This course has been updated'}</h1>
          <p className="mt-4 leading-relaxed text-slate-700">
            {finished
              ? 'Your completion and certificate are exactly as you earned them and are not affected. We have since released a new 90-minute version. You are welcome to take it, and your new progress will be tracked separately.'
              : 'We have released a new 90-minute version of this course. The progress you made on the earlier version is saved and has not been lost. Start the new version whenever you are ready.'}
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Button onClick={startNewVersion} disabled={startingNew} className="rounded-full px-8">
              {startingNew ? 'Starting…' : 'Start the new 90-minute course'}
            </Button>
            {finished && (
              <Link to={`/certificate/CERT_${user!.uid}_${course.id}`}>
                <Button variant="outline" className="rounded-full px-8 w-full">View my certificate</Button>
              </Link>
            )}
            <Link to="/dashboard"><Button variant="outline" className="rounded-full px-8 w-full">Back to dashboard</Button></Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Header */}
      <header className="h-16 border-b border-slate-100 flex items-center justify-between px-6 bg-white sticky top-0 z-50">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="p-2 hover:bg-slate-50 rounded-lg lg:hidden"
          >
            <Menu className="w-5 h-5 text-slate-600" />
          </button>
          <Link to="/dashboard" className="flex items-center gap-2 text-slate-500 hover:text-blue-900 transition-colors">
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm font-bold hidden sm:inline">Dashboard</span>
          </Link>
          <div className="h-4 w-px bg-slate-200 mx-2 hidden sm:block" />
          <h1 className="text-sm font-bold text-slate-900 truncate max-w-[200px] md:max-w-md">
            {course.title}
          </h1>
        </div>
        <div className="flex items-center gap-4">
          <div className="hidden md:flex flex-col items-end mr-4">
            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Your Progress · {progressSummary.completed}/{progressSummary.total}</div>
            <div className="w-32 h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div 
                className="h-full bg-green-500 transition-all duration-500" 
                style={{ width: `${progressSummary.percent}%` }}
              />
            </div>
          </div>
          {currentLesson?.materialUrl && (
            <a href={currentLesson.materialUrl} target="_blank" rel="noopener noreferrer">
              <Button variant="outline" size="sm" className="rounded-full hidden sm:flex">
                <Download className="w-4 h-4 mr-2" />
                Resources
              </Button>
            </a>
          )}
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <AnimatePresence mode="wait">
          {isSidebarOpen && (
            <motion.aside 
              initial={{ x: -300, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -300, opacity: 0 }}
              className="fixed inset-0 z-40 lg:relative lg:z-0 w-80 bg-slate-50 border-r border-slate-100 overflow-y-auto"
            >
              <div className="p-6 lg:hidden flex justify-between items-center border-b border-slate-200 mb-4">
                <span className="font-bold text-slate-900">Course Content</span>
                <button onClick={() => setIsSidebarOpen(false)}>
                  <X className="w-5 h-5 text-slate-500" />
                </button>
              </div>
              
              <div className="p-4 space-y-6">
                {course.curriculum?.map((module, mIdx_cur) => (
                  <div key={mIdx_cur} className="space-y-2">
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest px-2">
                      Module {mIdx_cur + 1}: {module.module.replace(/^module\s+\d+\s*[:\-—]\s*/i, '')}
                    </h3>
                    <div className="space-y-1">
                      {module.topics.map((topic, lIdx_cur) => {
                        const curId = `${mIdx_cur}_${lIdx_cur}`;
                        const isActive = mIdx === mIdx_cur && lIdx === lIdx_cur;
                        const isDone = track.completedLessons.includes(curId);
                        
                        return (
                          <button
                            key={lIdx_cur}
                            onClick={() => {
                              navigateToLesson(mIdx_cur, lIdx_cur);
                              if (window.innerWidth < 1024) setIsSidebarOpen(false);
                            }}
                            className={`w-full text-left p-3 rounded-xl flex items-center gap-3 transition-all ${
                              isActive 
                                ? 'bg-blue-900 text-white shadow-lg shadow-blue-900/20' 
                                : 'hover:bg-white text-slate-600'
                            }`}
                          >
                            {isDone ? (
                              <CheckCircle2 className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-green-500'}`} />
                            ) : topic.kind === 'activity' ? (
                              <ClipboardList className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-amber-600'}`} />
                            ) : (
                              <PlayCircle className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                            )}
                            <span className="text-sm font-medium line-clamp-2 flex-1">{topic.title}</span>
                            {typeof topic.plannedMinutes === 'number' && (
                              <span className={`text-xs shrink-0 ${isActive ? 'text-blue-100' : 'text-slate-500'}`}>{topic.plannedMinutes} min</span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </motion.aside>
          )}
        </AnimatePresence>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto bg-white">
          <div className="max-w-4xl mx-auto p-6 md:p-12">
            {/* Video Player (activities happen on the page, so they get no video box) */}
            {!isActivity && (
            <div className="aspect-video bg-slate-900 rounded-3xl mb-10 overflow-hidden shadow-2xl relative">
              {currentLesson?.videoUrl ? (
                <Player
                  ref={playerRef}
                  url={currentLesson.videoUrl}
                  width="100%"
                  height="100%"
                  controls
                  onPlay={() => logEvent(AnalyticsEvent.VIDEO_PLAY, { courseId, lessonId, videoUrl: currentLesson.videoUrl })}
                  onPause={() => logEvent(AnalyticsEvent.VIDEO_PAUSE, { courseId, lessonId, videoUrl: currentLesson.videoUrl })}
                  onEnded={() => {
                    logEvent(AnalyticsEvent.VIDEO_COMPLETE, { courseId, lessonId, videoUrl: currentLesson.videoUrl });
                    handleMarkComplete();
                  }}
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center relative group bg-slate-800">
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-900/60 to-transparent" />
                  <div className="z-10 text-center p-6">
                    <p className="text-xs font-bold uppercase tracking-widest text-blue-300 mb-4">{isActivity ? 'Activity' : currentLesson?.id ? 'Video in production' : 'No Video Content'}</p>
                    <h2 className="text-2xl font-bold text-white mb-6">{currentLesson?.title}</h2>
                  </div>
                </div>
              )}
            </div>
            )}

            <div className="space-y-8">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                  <div>
                    <h2 className="text-3xl font-bold text-slate-900 mb-2">{currentLesson?.title}</h2>
                    <p className="text-slate-500">
                      Module {mIdx + 1} • {isActivity ? 'Activity' : `Lesson ${lIdx + 1}`}
                      {typeof currentLesson.plannedMinutes === 'number' && (
                        <span className="ml-2 inline-flex items-center gap-1 text-sm"><Clock className="w-3.5 h-3.5" aria-hidden="true" /> about {currentLesson.plannedMinutes} min (planned)</span>
                      )}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Button
                      onClick={handleMarkComplete}
                      variant={isCompleted ? "outline" : "default"}
                      className={`rounded-full px-8 transition-all ${isCompleted ? 'border-green-500 text-green-600 hover:bg-green-50' : ''}`}
                    >
                      {isCompleted ? (
                        <><CheckCircle2 className="w-4 h-4 mr-2" /> Completed</>
                      ) : (
                        "Mark as Complete"
                      )}
                    </Button>
                  </div>
                </div>

              {currentLesson.description ? (
                <p className="text-slate-700 leading-relaxed text-lg">{currentLesson.description}</p>
              ) : (
              <div className="prose prose-slate max-w-none">
                <p className="text-slate-600 leading-relaxed text-lg">
                  In this lesson, we explore the core concepts of {currentLesson?.title}. We'll dive deep into strategic frameworks, real-world case studies, and actionable insights that you can apply immediately to your organization.
                </p>
                <h3 className="text-xl font-bold text-slate-900 mt-8 mb-4">Key Takeaways</h3>
                <ul className="space-y-3">
                  <li className="flex items-start gap-3 text-slate-600">
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-900 mt-2 shrink-0" />
                    Understanding the strategic landscape of {currentLesson?.title}.
                  </li>
                  <li className="flex items-start gap-3 text-slate-600">
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-900 mt-2 shrink-0" />
                    Identifying high-value opportunities and potential pitfalls.
                  </li>
                  <li className="flex items-start gap-3 text-slate-600">
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-900 mt-2 shrink-0" />
                    Implementing a robust roadmap for organizational transformation.
                  </li>
                </ul>
              </div>
              )}

              {isActivity && course.assignment && (
                <ActionCardPanel
                  course={course}
                  moduleIndex={mIdx}
                  topic={currentLesson}
                  uid={user!.uid}
                  learnerName={user!.displayName || user!.email || ''}
                />
              )}

              {/* Resources Section */}
              {currentLesson?.materialUrl && (
                <div className="bg-slate-50 rounded-3xl p-8 border border-slate-100">
                  <h3 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-2">
                    <FileText className="w-5 h-5 text-blue-900" />
                    Lesson Resources
                  </h3>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <a 
                      href={currentLesson.materialUrl} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="flex items-center justify-between p-4 bg-white rounded-2xl border border-slate-100 hover:border-blue-900 transition-colors group"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
                          <FileText className="w-5 h-5" />
                        </div>
                        <div className="text-left">
                          <p className="text-sm font-bold text-slate-900">Download Resource</p>
                          <p className="text-xs text-slate-400">Lesson Material</p>
                        </div>
                      </div>
                      <Download className="w-4 h-4 text-slate-400 group-hover:text-blue-900 transition-colors" />
                    </a>
                  </div>
                </div>
              )}

              {showNextSteps && (
                <section className="rounded-3xl bg-navy-900 p-8 text-white md:p-10" aria-labelledby="next-steps-heading">
                  <h3 id="next-steps-heading" className="text-2xl font-bold">Ready to Put Your AI Strategy into Action?</h3>
                  <p className="mt-3 max-w-2xl text-lg leading-relaxed text-blue-100">
                    You have completed the foundations. When you are ready to go further, explore our programs.
                  </p>
                  <ul className="mt-6 grid gap-3 sm:grid-cols-2">
                    {nextSteps.map((c) => (
                      <li key={c.id}>
                        <Link
                          to={`/course/${c.id}`}
                          className="flex h-full items-center justify-between gap-3 rounded-2xl bg-white/10 p-4 font-semibold hover:bg-white/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                        >
                          <span>{c.title}</span>
                          <ArrowRight className="h-4 w-4 shrink-0" aria-hidden="true" />
                        </Link>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {/* Navigation Footer */}
              <div className="flex items-center justify-between pt-12 border-t border-slate-100">
                {prev ? (
                  <button 
                    onClick={() => navigateToLesson(prev.m, prev.l)}
                    className="flex items-center gap-3 text-slate-500 hover:text-blue-900 transition-colors group"
                  >
                    <div className="w-10 h-10 rounded-full border border-slate-200 flex items-center justify-center group-hover:border-blue-900 transition-colors">
                      <ChevronLeft className="w-5 h-5" />
                    </div>
                    <div className="text-left hidden sm:block">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Previous Lesson</p>
                      <p className="text-sm font-bold">Back to Previous</p>
                    </div>
                  </button>
                ) : <div />}

                {/* Quiz Link if available for this module and it's the last lesson */}
                {currentModule?.quiz && lIdx === (currentModule.topics.length - 1) && (
                  <Link to={`/course/${courseId}/quiz/${mIdx}`}>
                    <Button className="rounded-full px-8 bg-amber-600 hover:bg-amber-700 shadow-lg shadow-amber-600/20">
                      <Trophy className="w-4 h-4 mr-2" />
                      Take Module Quiz
                    </Button>
                  </Link>
                )}

                {next ? (
                  <button 
                    onClick={() => navigateToLesson(next.m, next.l)}
                    className="flex items-center gap-3 text-slate-500 hover:text-blue-900 transition-colors group text-right"
                  >
                    <div className="text-right hidden sm:block">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Next Lesson</p>
                      <p className="text-sm font-bold">Continue to Next</p>
                    </div>
                    <div className="w-10 h-10 rounded-full bg-blue-900 text-white flex items-center justify-center shadow-lg shadow-blue-900/20 group-hover:scale-105 transition-transform">
                      <ChevronRight className="w-5 h-5" />
                    </div>
                  </button>
                ) : (
                  <Link to="/dashboard">
                    <Button className="rounded-full px-8">
                      Finish Course
                    </Button>
                  </Link>
                )}
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};
