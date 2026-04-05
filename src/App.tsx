/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation, Link } from 'react-router-dom';
import { Navbar } from './components/Navbar';
import { Hero } from './components/Hero';
import { LeadMagnetHero } from './components/LeadMagnetHero';
import { About } from './components/About';
import { Courses } from './components/Courses';
import { WhyUs } from './components/WhyUs';
import { Testimonials } from './components/Testimonials';
import { CTA } from './components/CTA';
import { Contact } from './components/Contact';
import { Footer } from './components/Footer';
import { CourseDetail } from './components/CourseDetail';
import { PaymentSuccess } from './components/PaymentSuccess';
import { LessonViewer } from './components/LessonViewer';
import { QuizViewer } from './components/QuizViewer';
import { InstructorDashboard } from './components/InstructorDashboard';
import { AdminDashboard } from './components/AdminDashboard';
import { Certificate } from './components/Certificate';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from './firebase';
import { courses } from './data/courses';
import { Loader2, PlayCircle, BookOpen, Clock, Trophy, ExternalLink } from 'lucide-react';
import { Button } from './components/ui/Button';

const ScrollToTop = () => {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
};

const HomePage = () => (
  <main>
    <LeadMagnetHero />
    <Hero />
    <About />
    <Courses />
    <WhyUs />
    <Testimonials />
    <CTA />
    <Contact />
  </main>
);


// Dashboard Components
const StudentDashboard = () => {
  const { user, profile } = useAuth();
  const [enrollments, setEnrollments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const q = query(collection(db, 'enrollments'), where('userId', '==', user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const enrollmentData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setEnrollments(enrollmentData);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching enrollments:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-12 h-12 animate-spin text-blue-900" />
      </div>
    );
  }

  const enrolledCourses = enrollments.map(enrol => {
    const course = courses.find(c => c.id === enrol.courseId);
    return { ...course, enrollment: enrol };
  }).filter(c => c.id);

  const getResumeLink = (course: any) => {
    if (!course.curriculum) return `/course/${course.id}`;
    
    const completed = course.enrollment.completedLessons || [];
    
    for (let m = 0; m < course.curriculum.length; m++) {
      for (let l = 0; l < course.curriculum[m].topics.length; l++) {
        const id = `${m}_${l}`;
        if (!completed.includes(id)) {
          return `/course/${course.id}/lesson/${m}/${l}`;
        }
      }
    }
    return `/course/${course.id}/lesson/0/0`;
  };

  return (
    <div className="pt-32 pb-20 px-6 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
        <div>
          <h1 className="text-4xl font-bold text-slate-900 mb-2">My Learning Dashboard</h1>
          <p className="text-slate-600">Welcome back, {profile?.displayName || user?.email}. Continue your AI journey.</p>
        </div>
        <div className="flex items-center gap-4 p-4 bg-blue-50 rounded-2xl border border-blue-100">
          <div className="text-center px-4 border-r border-blue-200">
            <p className="text-2xl font-bold text-blue-900">{enrolledCourses.length}</p>
            <p className="text-xs text-blue-600 font-bold uppercase tracking-wider">Courses</p>
          </div>
          <div className="text-center px-4">
            <p className="text-2xl font-bold text-blue-900">
              {enrolledCourses.filter(c => c.enrollment.status === 'COMPLETED').length}
            </p>
            <p className="text-xs text-blue-600 font-bold uppercase tracking-wider">Completed</p>
          </div>
        </div>
      </div>

      {enrolledCourses.length > 0 ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {enrolledCourses.map((course: any) => (
            <div key={course.id} className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden flex flex-col group hover:shadow-xl hover:shadow-slate-200/50 transition-all">
              <div className="aspect-video relative overflow-hidden">
                <img 
                  src={course.image} 
                  alt={course.title} 
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-900/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <PlayCircle className="w-12 h-12 text-white" />
                </div>
                <div className="absolute top-4 right-4 px-3 py-1 bg-white/90 backdrop-blur-sm rounded-full text-[10px] font-bold uppercase tracking-wider text-blue-900">
                  {course.enrollment.status.replace('_', ' ')}
                </div>
              </div>
              <div className="p-6 flex-1 flex flex-col">
                <h3 className="text-lg font-bold text-slate-900 mb-4 line-clamp-2">{course.title}</h3>
                
                <div className="flex items-center gap-4 mb-6 text-xs text-slate-500">
                  <div className="flex items-center gap-1">
                    <BookOpen className="w-3.5 h-3.5" />
                    <span>{course.curriculum?.reduce((acc: number, m: any) => acc + m.topics.length, 0) || 0} Lessons</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" />
                    <span>{course.duration}</span>
                  </div>
                </div>

                <div className="mt-auto pt-6">
                  <div className="flex justify-between text-xs font-bold text-slate-500 mb-2">
                    <span>Progress</span>
                    <span>{course.enrollment.progress || 0}%</span>
                  </div>
                  <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden mb-6">
                    <div 
                      className="h-full bg-blue-900 rounded-full transition-all duration-500" 
                      style={{ width: `${course.enrollment.progress || 0}%` }}
                    />
                  </div>
                  <div className="flex flex-col gap-3">
                    <Link to={getResumeLink(course)}>
                      <Button className="w-full rounded-xl font-bold py-5">
                        {course.enrollment.progress > 0 ? 'Resume Learning' : 'Start Learning'}
                      </Button>
                    </Link>
                    {course.enrollment.status === 'COMPLETED' && (
                      <Link to={`/certificate/CERT_${user.uid}_${course.id}`}>
                        <Button variant="outline" className="w-full rounded-xl font-bold py-5 border-amber-200 text-amber-700 hover:bg-amber-50">
                          <Trophy className="w-4 h-4 mr-2" />
                          View Certificate
                        </Button>
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-20 bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200">
          <h3 className="text-xl font-bold text-slate-900 mb-2">No courses enrolled yet</h3>
          <p className="text-slate-500 mb-8">Explore our executive AI courses and start learning today.</p>
          <Link to="/#courses">
            <Button variant="default" className="rounded-full px-8">
              Browse Courses
            </Button>
          </Link>
        </div>
      )}
    </div>
  );
};

import { ErrorBoundary } from './components/ErrorBoundary';
import { usePageTracking } from './hooks/usePageTracking';

const PageTracker = () => {
  usePageTracking();
  return null;
};

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <Router>
          <ScrollToTop />
          <PageTracker />
          <div className="min-h-screen bg-white font-sans text-slate-900 selection:bg-blue-100 selection:text-blue-900">
            <Navbar />
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/course/:id" element={<CourseDetail />} />
              <Route path="/payment-success" element={<PaymentSuccess />} />
              
              {/* Protected Student Routes */}
              <Route 
                path="/dashboard" 
                element={
                  <ProtectedRoute allowedRoles={['STUDENT', 'INSTRUCTOR', 'ADMIN']}>
                    <StudentDashboard />
                  </ProtectedRoute>
                } 
              />

              {/* Protected Lesson and Quiz Routes */}
              <Route 
                path="/course/:courseId/lesson/:moduleIndex/:lessonIndex" 
                element={
                  <ProtectedRoute allowedRoles={['STUDENT', 'INSTRUCTOR', 'ADMIN']}>
                    <LessonViewer />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/course/:courseId/quiz/:moduleIndex" 
                element={
                  <ProtectedRoute allowedRoles={['STUDENT', 'INSTRUCTOR', 'ADMIN']}>
                    <QuizViewer />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/certificate/:certificateId" 
                element={
                  <ProtectedRoute allowedRoles={['STUDENT', 'INSTRUCTOR', 'ADMIN']}>
                    <Certificate />
                  </ProtectedRoute>
                } 
              />

              {/* Protected Instructor Routes */}
              <Route 
                path="/instructor" 
                element={
                  <ProtectedRoute allowedRoles={['INSTRUCTOR', 'ADMIN']}>
                    <InstructorDashboard />
                  </ProtectedRoute>
                } 
              />

              {/* Protected Admin Routes */}
              <Route 
                path="/admin" 
                element={
                  <ProtectedRoute allowedRoles={['ADMIN']}>
                    <AdminDashboard />
                  </ProtectedRoute>
                } 
              />
            </Routes>
            <Footer />
          </div>
        </Router>
      </AuthProvider>
    </ErrorBoundary>
  );
}
