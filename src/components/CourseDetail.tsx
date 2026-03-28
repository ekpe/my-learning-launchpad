import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { courses } from '../data/courses';
import { Button } from './ui/Button';
import { Clock, Users, ArrowLeft, CheckCircle2, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebase';
import { doc, setDoc, serverTimestamp, onSnapshot } from 'firebase/firestore';
import { sendEmail } from '../services/emailService';
import { AuthModal } from './AuthModal';
import { DiscussionForum } from './DiscussionForum';
import { Course } from '../types';
import { loadStripe } from '@stripe/stripe-js';
import { logEvent, AnalyticsEvent } from '../services/analyticsService';

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY);

export const CourseDetail = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [enrollmentStatus, setEnrollmentStatus] = useState<'NONE' | 'ENROLLED' | 'IN_PROGRESS' | 'COMPLETED'>('NONE');
  const [isEnrolling, setIsEnrolling] = useState(false);
  const [isLoadingEnrollment, setIsLoadingEnrollment] = useState(true);
  const [activeTab, setActiveTab] = useState<'OVERVIEW' | 'CURRICULUM' | 'DISCUSSION'>('OVERVIEW');
  const [course, setCourse] = useState<Course | undefined>(courses.find(c => c.id === id));
  const [isLoadingCourse, setIsLoadingCourse] = useState(true);

  useEffect(() => {
    if (!id) {
      setIsLoadingCourse(false);
      return;
    }

    const unsubscribe = onSnapshot(doc(db, 'courses', id), (docSnap) => {
      if (docSnap.exists()) {
        setCourse(docSnap.data() as Course);
      }
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
    const unsubscribe = onSnapshot(doc(db, 'enrollments', enrollmentId), (docSnap) => {
      if (docSnap.exists()) {
        setEnrollmentStatus(docSnap.data().status);
      } else {
        setEnrollmentStatus('NONE');
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
            courseName: course.title,
            price: course.price || 99, // Default price if not set
            userId: user.uid,
          }),
        });

        const session = await response.json();
        if (session.error) throw new Error(session.error);

        const stripe = await stripePromise;
        if (!stripe) throw new Error('Stripe failed to load');

        const { error } = await (stripe as any).redirectToCheckout({
          sessionId: session.id,
        });

        if (error) throw new Error(error.message);
        return;
      }

      const enrollmentId = `${user.uid}_${id}`;
      await setDoc(doc(db, 'enrollments', enrollmentId), {
        userId: user.uid,
        courseId: id,
        status: 'ENROLLED',
        enrolledAt: serverTimestamp(),
        progress: 0
      });

      logEvent(AnalyticsEvent.COURSE_ENROLLMENT, {
        courseId: id,
        courseTitle: course.title,
        isFree: true
      });

      // Send enrollment email
      if (user.email) {
        await sendEmail({
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
    } catch (error) {
      console.error("Enrollment error:", error);
      alert("Failed to enroll. Please try again.");
    } finally {
      setIsEnrolling(false);
    }
  };

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

  return (
    <div className="min-h-screen bg-white pt-32 pb-24">
      <div className="max-w-7xl mx-auto px-6">
        <Link to="/" className="inline-flex items-center text-blue-900 font-semibold mb-8 hover:translate-x-[-4px] transition-transform">
          <ArrowLeft className="mr-2 w-4 h-4" />
          Back to All Courses
        </Link>

        {/* Tabs */}
        <div className="flex items-center gap-8 border-b border-slate-100 mb-12">
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
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 border border-blue-100 text-blue-900 text-xs font-semibold uppercase tracking-wider mb-6">
                    {course.isFree ? 'Free Course' : 'Executive Track'}
                  </div>
                  <h1 className="text-4xl md:text-5xl font-bold text-slate-900 leading-tight mb-6">
                    {course.title}
                  </h1>
                  <p className="text-xl text-slate-600 mb-8 leading-relaxed">
                    {course.fullDescription || course.description}
                  </p>

                  <div className="grid sm:grid-cols-2 gap-6 mb-10">
                    <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                      <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center text-blue-900 shadow-sm">
                        <Clock className="w-6 h-6" />
                      </div>
                      <div>
                        <p className="text-xs text-slate-500 uppercase font-bold tracking-wider">Duration</p>
                        <p className="font-bold text-slate-900">{course.duration}</p>
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

                  {course.learningObjectives && (
                    <div className="mb-10">
                      <h3 className="text-2xl font-bold text-slate-900 mb-6">Learning Objectives</h3>
                      <ul className="grid sm:grid-cols-2 gap-4">
                        {course.learningObjectives.map((objective, idx) => (
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
                    ) : enrollmentStatus !== 'NONE' ? (
                      <Link to="/dashboard">
                        <Button size="lg" className="rounded-full px-10 font-bold bg-green-600 hover:bg-green-700">
                          Go to Dashboard
                        </Button>
                      </Link>
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
                        {course.isFree ? 'Enroll for Free' : 'Enroll Now'}
                      </Button>
                    )}
                    <Button variant="outline" size="lg" className="rounded-full px-10">
                      Download Syllabus
                    </Button>
                  </div>

                  {course.assignment && (
                    <div className="p-8 bg-blue-900 rounded-3xl text-white">
                      <h3 className="text-2xl font-bold mb-4">Practical Assignment</h3>
                      <h4 className="text-amber-400 font-bold mb-2">{course.assignment.title}</h4>
                      <p className="text-blue-100 text-sm mb-6 leading-relaxed">
                        {course.assignment.description}
                      </p>
                      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider bg-blue-800/50 w-fit px-4 py-2 rounded-full border border-blue-700">
                        Format: {course.assignment.format}
                      </div>
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
                  <h3 className="text-2xl font-bold text-slate-900 mb-8">Course Curriculum</h3>
                  <div className="space-y-6">
                    {course.curriculum?.map((module, idx) => (
                      <div key={idx} className="p-6 bg-slate-50 rounded-2xl border border-slate-100">
                        <h4 className="font-bold text-blue-900 mb-4">{module.module}</h4>
                        <ul className="space-y-3">
                          {module.topics.map((topic, tIdx) => (
                            <li key={tIdx} className="flex items-start gap-3 text-slate-600 text-sm">
                              <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0" />
                              {topic.title}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
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
                <h4 className="font-bold text-slate-900 mb-4">Course Features</h4>
                <ul className="space-y-4">
                  {[
                    'Lifetime access',
                    'Mobile compatible',
                    'Certificate of completion',
                    'Practical assignments',
                    'Discussion forum access'
                  ].map((feature, idx) => (
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
      />
    </div>
  );
};
