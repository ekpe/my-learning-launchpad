import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { courses } from '../data/courses';
import { Button } from './ui/Button';
import { Clock, Users, ArrowLeft, ArrowRight, CheckCircle2, ClipboardList, Loader2, PlayCircle, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebase';
import { doc, getDoc, setDoc, serverTimestamp, onSnapshot } from 'firebase/firestore';
import { sendEmail } from '../services/emailService';
import { AuthModal } from './AuthModal';
import { DiscussionForum } from './DiscussionForum';
import { Course, Enrollment } from '../types';
import { nextRequiredKey, resolveTrack } from '../lib/courseProgress';
import { resolveCourse } from '../hooks/useLiveCourses';
import { logEvent, AnalyticsEvent } from '../services/analyticsService';
import { courseDuration, moduleDuration } from '../lib/courseDuration';

export const CourseDetail = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  // Set when a signed-out visitor presses "Register for Free": once they have an account we finish the enrolment for them.
  const pendingEnrollAt = React.useRef<number | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [isEnrolling, setIsEnrolling] = useState(false);
  const [isLoadingEnrollment, setIsLoadingEnrollment] = useState(true);
  const [activeTab, setActiveTab] = useState<'OVERVIEW' | 'CURRICULUM' | 'DISCUSSION'>('OVERVIEW');
  const [course, setCourse] = useState<Course | undefined>(() => resolveCourse(id ?? '', null));
  const [isLoadingCourse, setIsLoadingCourse] = useState(true);

  useEffect(() => {
    if (!id) {
      setIsLoadingCourse(false);
      return;
    }

    const unsubscribe = onSnapshot(doc(db, 'courses', id), (docSnap) => {
      // A launch-gated course is shown only from its published (live) record, never from the static draft.
      setCourse(resolveCourse(id, docSnap.exists() ? (docSnap.data() as Course) : null));
      setIsLoadingCourse(false);
    }, (error) => {
      console.error("Error fetching course:", error);
      setIsLoadingCourse(false);
    });

    return () => unsubscribe();
  }, [id]);

  useEffect(() => {
    if (!user || !id) {
      setIsLoadingEnrollment(false);
      return;
    }

    const enrollmentId = `${user.uid}_${id}`;
    setIsLoadingEnrollment(true);
    const unsubscribe = onSnapshot(doc(db, 'enrollments', enrollmentId), (docSnap) => {
      if (docSnap.exists()) {
        setEnrollment(docSnap.data() as Enrollment);
      } else {
        setEnrollment(null);
      }
      setIsLoadingEnrollment(false);
    }, (error) => {
      console.error("Error fetching enrollment:", error);
      setIsLoadingEnrollment(false);
    });

    return () => unsubscribe();
  }, [user, id]);

  const handleEnroll = async () => {
    if (!user) {
      pendingEnrollAt.current = Date.now();
      setIsAuthModalOpen(true);
      return;
    }

    if (!id) return;

    setIsEnrolling(true);
    try {
      if (!course.isFree) {
        const response = await fetch('/api/create-checkout-session', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            courseId: id,
            userId: user.uid,
          }),
        });

        const session = await response.json();
        if (session.error) throw new Error(session.error);

        if (session.url) {
          window.location.href = session.url;
          return;
        }

        throw new Error('Stripe session URL not found');
      }

      const enrollmentId = `${user.uid}_${id}`;

      // Never overwrite an enrolment that already exists (that would reset the learner's progress).
      // The rules refuse to read a missing enrolment, so a denied read just means "not enrolled yet".
      try {
        if ((await getDoc(doc(db, 'enrollments', enrollmentId))).exists()) {
          navigate(`/course/${id}/lesson/0/0`);
          return;
        }
      } catch {
        /* not enrolled yet */
      }

      await setDoc(doc(db, 'enrollments', enrollmentId), {
        userId: user.uid,
        courseId: id,
        status: 'ENROLLED',
        enrolledAt: serverTimestamp(),
        progress: 0,
        ...(course.curriculumVersion ? { curriculumVersion: course.curriculumVersion } : {})
      });

      logEvent(AnalyticsEvent.COURSE_ENROLLMENT, {
        courseId: id,
        courseTitle: course.title,
        isFree: true
      });

      // Send enrollment email
      if (user.email) {
        await sendEmail({
          context: 'self',
          to: user.email,
          subject: `Welcome to ${course.title}!`,
          text: `Hi ${user.displayName || 'Student'},\n\nYou've successfully enrolled in "${course.title}".\n\nStart learning now: ${window.location.origin}/course/${course.id}`,
          html: `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #1e3a8a;">Welcome to ${course.title}!</h2>
              <p>Hi ${user.displayName || 'Student'},</p>
              <p>You've successfully enrolled in "<strong>${course.title}</strong>". We're excited to have you on board!</p>
              <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; padding: 20px; border-radius: 12px; margin: 20px 0;">
                <p style="margin: 0;"><strong>Course:</strong> ${course.title}</p>
                <p style="margin: 5px 0 0 0;"><strong>Duration:</strong> ${course.duration}</p>
              </div>
              <p>Ready to start learning?</p>
              <a href="${window.location.origin}/course/${course.id}" style="display: inline-block; background-color: #1e3a8a; color: white; padding: 12px 24px; border-radius: 9999px; text-decoration: none; font-weight: bold; margin-top: 20px;">Go to Course</a>
            </div>
          `
        });
      }
      navigate(`/course/${id}/lesson/0/0`);
    } catch (error) {
      console.error("Enrollment error:", error);
      alert("Failed to enroll. Please try again.");
    } finally {
      setIsEnrolling(false);
    }
  };

  // Registration finished (or the visitor signed in): complete the enrolment they asked for, once, and only for a
  // free course they are not already enrolled in. Expires after two minutes so a stale click never enrols anyone later.
  useEffect(() => {
    const at = pendingEnrollAt.current;
    if (!at || !user || isLoadingEnrollment || !course) return;
    pendingEnrollAt.current = null;
    if (Date.now() - at > 120_000 || enrollment || !course.isFree) return;
    void handleEnroll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, isLoadingEnrollment, enrollment, course]);

  if (isLoadingCourse) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <Loader2 className="w-12 h-12 animate-spin text-blue-900" />
      </div>
    );
  }

  if (!course) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white px-6">
        <div className="text-center">
          <h2 className="text-3xl font-bold text-slate-900 mb-4">Course Not Found</h2>
          <p className="text-slate-600 mb-8">The course you are looking for does not exist or has been moved.</p>
          <Link to="/">
            <Button variant="default" className="rounded-full">
              <ArrowLeft className="mr-2 w-4 h-4" />
              Back to Home
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const isV2 = (course.curriculumVersion ?? 1) >= 2;
  const track = resolveTrack(course, enrollment);
  const enrolled = !!enrollment;
  // Finished this course at any curriculum version (the original result is never lost).
  const finishedBefore = track.status === 'COMPLETED' || track.legacy?.status === 'COMPLETED';
  const legacyNotStarted = enrolled && track.source === 'none' && track.isLegacyEnrollment;
  const duration = courseDuration(course);
  const showPlanned = duration.complete && duration.totalMinutes > 0;
  const paragraphs = (course.fullDescription || course.description).split(/\n{2,}/);
  // An emptied list falls back to the next source instead of rendering a heading with nothing under it.
  const outcomes = course.outcomes?.length ? course.outcomes : course.learningObjectives?.length ? course.learningObjectives : undefined;
  const nextSteps = (course.nextStepCourseIds ?? [])
    .map((cid) => courses.find((c) => c.id === cid))
    .filter((c): c is Course => !!c);
  const publishedResources = (course.optionalResources ?? []).filter((r) => r.available && r.url);

  return (
    <div className="min-h-screen bg-white pt-32 pb-24">
      <div className="max-w-7xl mx-auto px-6">
        <Link to="/" className="inline-flex items-center text-blue-900 font-semibold mb-8 hover:translate-x-[-4px] transition-transform">
          <ArrowLeft className="mr-2 w-4 h-4" />
          Back to All Courses
        </Link>

        {/* Tabs */}
        <div className="flex items-center gap-5 sm:gap-8 border-b border-slate-100 mb-12 overflow-x-auto">
          {[
            { id: 'OVERVIEW', label: 'Overview' },
            { id: 'CURRICULUM', label: 'Curriculum' },
            { id: 'DISCUSSION', label: 'Discussion Forum' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`pb-4 text-sm font-bold uppercase tracking-widest transition-all relative ${
                activeTab === tab.id ? 'text-blue-900' : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              {tab.label}
              {activeTab === tab.id && (
                <motion.div 
                  layoutId="activeTab"
                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-900" 
                />
              )}
            </button>
          ))}
        </div>

        <div className="grid lg:grid-cols-3 gap-16 items-start">
          <div className="lg:col-span-2">
            <AnimatePresence mode="wait">
              {activeTab === 'OVERVIEW' && (
                <motion.div
                  key="overview"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                >
                  <div className="flex flex-wrap items-center gap-2 mb-6">
                    <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 border border-blue-100 text-blue-900 text-xs font-semibold uppercase tracking-wider">
                      {course.trackLabel || (course.isFree ? 'Free Course' : 'Executive Track')}
                    </span>
                    {course.trackLabel && course.isFree && (
                      <span className="inline-flex items-center px-3 py-1 rounded-full bg-green-700 text-white text-xs font-semibold uppercase tracking-wider">Free Course</span>
                    )}
                  </div>
                  <h1 className="text-4xl md:text-5xl font-bold text-slate-900 leading-tight mb-4">
                    {course.title}
                  </h1>
                  {course.subtitle && (
                    <p className="text-2xl font-semibold text-blue-900 mb-6 leading-snug">{course.subtitle}</p>
                  )}
                  <div className="space-y-5 mb-8">
                    {paragraphs.map((p, i) => (
                      <p key={i} className="text-xl text-slate-600 leading-relaxed">{p}</p>
                    ))}
                  </div>

                  <div className="grid sm:grid-cols-2 gap-6 mb-10">
                    <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                      <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center text-blue-900 shadow-sm">
                        <Clock className="w-6 h-6" />
                      </div>
                      <div>
                        <p className="text-xs text-slate-500 uppercase font-bold tracking-wider">Duration</p>
                        <p className="font-bold text-slate-900">{course.duration}</p>
                        {course.durationStatus === 'planned' && <p className="text-xs text-slate-500">Planned run time</p>}
                      </div>
                    </div>
                    <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                      <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center text-blue-900 shadow-sm">
                        <Users className="w-6 h-6" />
                      </div>
                      <div>
                        <p className="text-xs text-slate-500 uppercase font-bold tracking-wider">Target Audience</p>
                        <p className="font-bold text-slate-900">{course.audience}</p>
                      </div>
                    </div>
                  </div>

                  {outcomes && (
                    <div className="mb-10">
                      <h3 className="text-2xl font-bold text-slate-900 mb-2">
                        {isV2 && showPlanned ? `What You'll Achieve in ${duration.totalMinutes} Minutes` : 'Learning Objectives'}
                      </h3>
                      {isV2 && showPlanned && (
                        <p className="text-sm text-slate-600 mb-6">
                          {duration.videoMinutes} minutes of video plus {duration.activityMinutes} minutes of practical activities (planned).
                        </p>
                      )}
                      <ul className="grid sm:grid-cols-2 gap-4">
                        {outcomes.map((objective, idx) => (
                          <li key={idx} className="flex items-start gap-3 text-slate-600 text-sm">
                            <CheckCircle2 className="w-5 h-5 text-blue-600 shrink-0" />
                            {objective}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div className="flex flex-col sm:flex-row gap-4 mb-12">
                    {isLoadingEnrollment ? (
                      <Button size="lg" className="rounded-full px-10 font-bold" disabled>
                        <Loader2 className="w-5 h-5 animate-spin mr-2" />
                        Loading...
                      </Button>
                    ) : legacyNotStarted ? (
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5" data-testid="legacy-cta">
                        <p className="font-semibold text-slate-900">
                          {track.legacy?.status === 'COMPLETED'
                            ? 'You completed the original version of this course. Your completion and certificate are unchanged.'
                            : 'This course has been updated. Your earlier progress is saved.'}
                        </p>
                        <div className="mt-4 flex flex-wrap gap-3">
                          <Link to={`/course/${course.id}/lesson/0/0`}>
                            <Button size="lg" className="rounded-full px-8 font-bold">Take the new 90-minute course</Button>
                          </Link>
                          <Link to="/dashboard"><Button size="lg" variant="outline" className="rounded-full px-8">Go to Dashboard</Button></Link>
                        </div>
                      </div>
                    ) : enrolled ? (
                      <>
                        {(() => {
                          const next = nextRequiredKey(course, track.completedLessons);
                          const [m, l] = (next ?? '0_0').split('_');
                          return (
                            <Link to={`/course/${course.id}/lesson/${m}/${l}`}>
                              <Button size="lg" className="rounded-full px-10 font-bold bg-green-600 hover:bg-green-700">
                                {track.completedLessons.length > 0 ? 'Continue learning' : 'Start learning'}
                              </Button>
                            </Link>
                          );
                        })()}
                        <Link to="/dashboard">
                          <Button size="lg" variant="outline" className="rounded-full px-10">Go to Dashboard</Button>
                        </Link>
                      </>
                    ) : (
                      <Button 
                        size="lg" 
                        className="rounded-full px-10 font-bold"
                        onClick={handleEnroll}
                        disabled={isEnrolling}
                      >
                        {isEnrolling ? (
                          <Loader2 className="w-5 h-5 animate-spin mr-2" />
                        ) : null}
                        {course.isFree ? 'Register for Free' : 'Enroll Now'}
                      </Button>
                    )}
                    {!isV2 && (
                      <Button variant="outline" size="lg" className="rounded-full px-10">
                        Download Syllabus
                      </Button>
                    )}
                  </div>

                  {course.assignment && (
                    <div className="p-8 bg-blue-900 rounded-3xl text-white">
                      <h3 className="text-2xl font-bold mb-4">{course.assignment.heading || 'Practical Assignment'}</h3>
                      <h4 className="text-amber-300 font-bold mb-2 text-xl">{course.assignment.title}</h4>
                      <p className="text-blue-100 text-sm mb-6 leading-relaxed">
                        {course.assignment.description}
                      </p>
                      {course.assignment.outputs && (
                        <ol className="mb-6 space-y-2">
                          {course.assignment.outputs.map((o, i) => (
                            <li key={i} className="text-sm text-blue-50">
                              <span className="font-bold text-amber-300">{o.module}:</span> {o.text}
                            </li>
                          ))}
                        </ol>
                      )}
                      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider bg-blue-800/50 w-fit px-4 py-2 rounded-full border border-blue-700">
                        Format: {course.assignment.format}
                      </div>
                    </div>
                  )}

                  {finishedBefore && nextSteps.length > 0 && (
                    <div className="mt-10 p-8 bg-navy-900 rounded-3xl text-white">
                      <h3 className="text-2xl font-bold mb-3">Ready to Put Your AI Strategy into Action?</h3>
                      <p className="text-blue-100 mb-5">When you are ready to go further, explore our programs.</p>
                      <ul className="grid sm:grid-cols-2 gap-3">
                        {nextSteps.map((c) => (
                          <li key={c.id}>
                            <Link to={`/course/${c.id}`} className="flex h-full items-center justify-between gap-3 rounded-2xl bg-white/10 p-4 font-semibold hover:bg-white/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white">
                              <span>{c.title}</span>
                              <ArrowRight className="h-4 w-4 shrink-0" aria-hidden="true" />
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {publishedResources.length > 0 && (
                    <div className="mt-10">
                      <h3 className="text-2xl font-bold text-slate-900 mb-2">Explore Further — Optional Resources</h3>
                      <p className="text-sm text-slate-600 mb-4">Optional. These are not part of the 90 minutes and are not needed to complete the course.</p>
                      <ul className="space-y-3">
                        {publishedResources.map((r) => (
                          <li key={r.title}>
                            <a href={r.url} target="_blank" rel="noopener noreferrer" className="font-semibold text-blue-900 underline">{r.title}</a>
                            {r.description && <p className="text-sm text-slate-600">{r.description}</p>}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </motion.div>
              )}

              {activeTab === 'CURRICULUM' && (
                <motion.div
                  key="curriculum"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                >
                  <h3 className="text-2xl font-bold text-slate-900 mb-2">Course Curriculum</h3>
                  {showPlanned && (
                    <p className="text-sm text-slate-600 mb-8">
                      {duration.totalMinutes} minutes planned: {duration.videoMinutes} of video and {duration.activityMinutes} of activities. Durations are planned, not measured run times.
                    </p>
                  )}
                  <div className="space-y-4">
                    {course.curriculum?.map((module, idx) => {
                      const md = moduleDuration(module);
                      return (
                        <details key={idx} className="group rounded-2xl border border-slate-100 bg-slate-50" open={!isV2}>
                          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-6 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-900">
                            <span>
                              {module.phase && <span className="block text-xs font-bold uppercase tracking-widest text-amber-700">Module {idx + 1} · {module.phase}</span>}
                              <span className="block font-bold text-blue-900">{module.module}</span>
                            </span>
                            <span className="flex shrink-0 items-center gap-3 text-sm text-slate-600">
                              {md.complete && md.totalMinutes > 0 && <span>{md.totalMinutes} min</span>}
                              <ChevronDown className="h-5 w-5 transition-transform group-open:rotate-180" aria-hidden="true" />
                            </span>
                          </summary>
                          <ul className="space-y-4 px-6 pb-6">
                            {module.topics.map((topic, tIdx) => (
                              <li key={tIdx} className={`flex items-start gap-3 text-sm ${topic.kind === 'activity' ? 'rounded-xl bg-amber-50 p-3 ring-1 ring-amber-200' : 'text-slate-600'}`}>
                                {topic.kind === 'activity' ? (
                                  <ClipboardList className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" aria-hidden="true" />
                                ) : isV2 ? (
                                  <PlayCircle className="mt-0.5 h-5 w-5 shrink-0 text-blue-700" aria-hidden="true" />
                                ) : (
                                  <CheckCircle2 className="h-5 w-5 shrink-0 text-green-600" aria-hidden="true" />
                                )}
                                <span className="flex-1">
                                  <span className="block font-semibold text-slate-900">
                                    {topic.title}
                                    {topic.optional && <span className="ml-2 rounded-full bg-slate-200 px-2 py-0.5 text-xs font-bold text-slate-700">Optional</span>}
                                  </span>
                                  {isV2 && topic.description && <span className="mt-1 block text-slate-600">{topic.description}</span>}
                                  {topic.kind === 'activity' && topic.output && <span className="mt-1 block font-semibold text-amber-900">{topic.output}</span>}
                                </span>
                                {typeof topic.plannedMinutes === 'number' && <span className="shrink-0 text-xs text-slate-600">{topic.plannedMinutes} min</span>}
                              </li>
                            ))}
                          </ul>
                        </details>
                      );
                    })}
                  </div>
                </motion.div>
              )}

              {activeTab === 'DISCUSSION' && (
                <motion.div
                  key="discussion"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                >
                  <DiscussionForum courseId={id!} />
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="lg:col-span-1">
            <div className="sticky top-32">
              <div className="rounded-3xl overflow-hidden shadow-2xl border border-slate-200 aspect-[4/3] mb-8">
                <img 
                  src={course.image} 
                  alt={course.title} 
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              </div>
              
              <div className="p-8 bg-slate-50 rounded-3xl border border-slate-100">
                <h4 className="font-bold text-slate-900 mb-4">{course.benefits?.length ? 'What You Get' : 'Course Features'}</h4>
                <ul className="space-y-4">
                  {(course.benefits?.length ? course.benefits : [
                    'Lifetime access',
                    'Mobile compatible',
                    'Certificate of completion',
                    'Practical assignments',
                    'Discussion forum access'
                  ]).map((feature, idx) => (
                    <li key={idx} className="flex items-center gap-3 text-sm text-slate-600">
                      <CheckCircle2 className="w-4 h-4 text-blue-600" />
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>

      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        initialMode={course.isFree ? 'signup' : 'login'}
        signupTitle={course.isFree ? 'Register for the free course' : undefined}
        signupSubtitle={course.isFree ? `Create your free account to start ${course.title}. It saves your progress and your Action Card.` : undefined}
        signupSubmitLabel={course.isFree ? 'Register and start the course' : undefined}
      />
    </div>
  );
};
