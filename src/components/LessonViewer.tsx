import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { courses } from '../data/courses';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebase';
import { doc, getDoc, updateDoc, onSnapshot, setDoc, serverTimestamp } from 'firebase/firestore';
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
import { Course } from '../types';

export const LessonViewer = () => {
  const { courseId, moduleIndex, lessonIndex } = useParams<{ 
    courseId: string; 
    moduleIndex: string; 
    lessonIndex: string; 
  }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [enrollment, setEnrollment] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [course, setCourse] = useState<Course | undefined>(courses.find(c => c.id === courseId));
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
      if (docSnap.exists()) {
        setCourse(docSnap.data() as Course);
      }
    });

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
      if (docSnap.exists()) {
        setEnrollment(docSnap.data());
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user, courseId]);

  const handleMarkComplete = async () => {
    if (!user || !courseId || !enrollment) return;

    const completedLessons = enrollment.completedLessons || [];
    if (completedLessons.includes(lessonId)) return;

    const newCompletedLessons = [...completedLessons, lessonId];
    
    // Calculate progress
    const totalLessons = course?.curriculum?.reduce((acc, mod) => acc + mod.topics.length, 0) || 1;
    const progress = Math.round((newCompletedLessons.length / totalLessons) * 100);
    const status = progress === 100 ? 'COMPLETED' : 'IN_PROGRESS';

    try {
      const enrollmentId = `${user.uid}_${courseId}`;
      await updateDoc(doc(db, 'enrollments', enrollmentId), {
        completedLessons: newCompletedLessons,
        progress,
        status
      });

      logEvent(AnalyticsEvent.LESSON_COMPLETE, {
        courseId,
        lessonId,
        progress,
        status
      });

      // Generate certificate if completed
      if (status === 'COMPLETED') {
        const certificateId = `CERT_${user.uid}_${courseId}`;
        await setDoc(doc(db, 'certificates', certificateId), {
          userId: user.uid,
          courseId: courseId,
          courseTitle: course?.title || 'Course Completion',
          userName: user.displayName || user.email,
          issuedAt: serverTimestamp(),
          certificateId: certificateId
        });
      }
    } catch (error) {
      console.error("Error updating progress:", error);
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

  if (loading) {
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

  const next = getNextLesson();
  const prev = getPrevLesson();
  const isCompleted = enrollment?.completedLessons?.includes(lessonId);

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
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Your Progress</div>
            <div className="w-32 h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div 
                className="h-full bg-green-500 transition-all duration-500" 
                style={{ width: `${enrollment?.progress || 0}%` }}
              />
            </div>
          </div>
          <Button variant="outline" size="sm" className="rounded-full hidden sm:flex">
            <Download className="w-4 h-4 mr-2" />
            Resources
          </Button>
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
                      Module {mIdx_cur + 1}: {module.module}
                    </h3>
                    <div className="space-y-1">
                      {module.topics.map((topic, lIdx_cur) => {
                        const curId = `${mIdx_cur}_${lIdx_cur}`;
                        const isActive = mIdx === mIdx_cur && lIdx === lIdx_cur;
                        const isDone = enrollment?.completedLessons?.includes(curId);
                        
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
                              <CheckCircle2 className={`w-4 h-4 ${isActive ? 'text-white' : 'text-green-500'}`} />
                            ) : (
                              <PlayCircle className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                            )}
                            <span className="text-sm font-medium line-clamp-1">{topic.title}</span>
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
            {/* Video Player */}
            <div className="aspect-video bg-slate-900 rounded-3xl mb-10 overflow-hidden shadow-2xl">
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
                <div className="w-full h-full flex items-center justify-center relative group">
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-900/60 to-transparent" />
                  <PlayCircle className="w-20 h-20 text-white opacity-80 group-hover:scale-110 transition-transform cursor-pointer" />
                  <div className="absolute bottom-6 left-6 text-white">
                    <p className="text-xs font-bold uppercase tracking-widest text-blue-400 mb-1">Video Unavailable</p>
                    <h2 className="text-xl font-bold">{currentLesson?.title}</h2>
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-8">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                  <h2 className="text-3xl font-bold text-slate-900 mb-2">{currentLesson?.title}</h2>
                  <p className="text-slate-500">Module {mIdx + 1} • Lesson {lIdx + 1}</p>
                </div>
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

              {/* Resources Section */}
              <div className="bg-slate-50 rounded-3xl p-8 border border-slate-100">
                <h3 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-2">
                  <FileText className="w-5 h-5 text-blue-900" />
                  Lesson Resources
                </h3>
                <div className="grid sm:grid-cols-2 gap-4">
                  <button className="flex items-center justify-between p-4 bg-white rounded-2xl border border-slate-100 hover:border-blue-900 transition-colors group">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center text-red-600">
                        <FileText className="w-5 h-5" />
                      </div>
                      <div className="text-left">
                        <p className="text-sm font-bold text-slate-900">Lesson Slides</p>
                        <p className="text-xs text-slate-400">PDF • 2.4 MB</p>
                      </div>
                    </div>
                    <Download className="w-4 h-4 text-slate-400 group-hover:text-blue-900 transition-colors" />
                  </button>
                  <button className="flex items-center justify-between p-4 bg-white rounded-2xl border border-slate-100 hover:border-blue-900 transition-colors group">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
                        <FileText className="w-5 h-5" />
                      </div>
                      <div className="text-left">
                        <p className="text-sm font-bold text-slate-900">Strategic Framework</p>
                        <p className="text-xs text-slate-400">DOCX • 1.1 MB</p>
                      </div>
                    </div>
                    <Download className="w-4 h-4 text-slate-400 group-hover:text-blue-900 transition-colors" />
                  </button>
                </div>
              </div>

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
