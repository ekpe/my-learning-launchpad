import React, { useState, useEffect } from 'react';
import { collection, query, onSnapshot, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { courses } from '../data/courses';
import { 
  Users, 
  BookOpen, 
  TrendingUp, 
  CheckCircle2, 
  Clock, 
  ChevronRight,
  Search,
  Filter,
  Loader2
} from 'lucide-react';
import { Button } from './ui/Button';

export const InstructorDashboard = () => {
  const [enrollments, setEnrollments] = useState<any[]>([]);
  const [userProfiles, setUserProfiles] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    // Fetch all enrollments
    const enrollmentsQuery = query(collection(db, 'enrollments'));
    const unsubscribeEnrollments = onSnapshot(enrollmentsQuery, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setEnrollments(data);
    });

    // Fetch all user profiles to map names
    const fetchProfiles = async () => {
      const profilesSnapshot = await getDocs(collection(db, 'users'));
      const profiles: Record<string, any> = {};
      profilesSnapshot.forEach(doc => {
        profiles[doc.id] = doc.data();
      });
      setUserProfiles(profiles);
      setLoading(false);
    };

    fetchProfiles();

    return () => unsubscribeEnrollments();
  }, []);

  const stats = {
    totalStudents: Object.keys(userProfiles).length,
    totalEnrollments: enrollments.length,
    completedCourses: enrollments.filter(e => e.status === 'COMPLETED').length,
    avgProgress: enrollments.length > 0 
      ? Math.round(enrollments.reduce((acc, e) => acc + (e.progress || 0), 0) / enrollments.length) 
      : 0
  };

  const courseStats = courses.map(course => {
    const courseEnrollments = enrollments.filter(e => e.courseId === course.id);
    return {
      ...course,
      studentCount: courseEnrollments.length,
      avgProgress: courseEnrollments.length > 0
        ? Math.round(courseEnrollments.reduce((acc, e) => acc + (e.progress || 0), 0) / courseEnrollments.length)
        : 0
    };
  });

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-12 h-12 animate-spin text-blue-900" />
      </div>
    );
  }

  return (
    <div className="pt-32 pb-20 px-6 max-w-7xl mx-auto">
      <div className="mb-12">
        <h1 className="text-4xl font-bold text-slate-900 mb-2">Instructor Dashboard</h1>
        <p className="text-slate-600">Overview of student progress and course performance.</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
        {[
          { label: 'Total Students', value: stats.totalStudents, icon: Users, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Total Enrollments', value: stats.totalEnrollments, icon: BookOpen, color: 'text-amber-600', bg: 'bg-amber-50' },
          { label: 'Avg. Progress', value: `${stats.avgProgress}%`, icon: TrendingUp, color: 'text-green-600', bg: 'bg-green-50' },
          { label: 'Completions', value: stats.completedCourses, icon: CheckCircle2, color: 'text-purple-600', bg: 'bg-purple-50' },
        ].map((stat, idx) => (
          <div key={idx} className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
            <div className={`w-12 h-12 ${stat.bg} ${stat.color} rounded-2xl flex items-center justify-center mb-4`}>
              <stat.icon className="w-6 h-6" />
            </div>
            <p className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-1">{stat.label}</p>
            <p className="text-3xl font-bold text-slate-900">{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-12">
        {/* Course Performance */}
        <div className="lg:col-span-2 space-y-8">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-slate-900">Course Performance</h2>
            <Button variant="outline" size="sm" className="rounded-full">
              View All Reports
            </Button>
          </div>

          <div className="space-y-4">
            {courseStats.map(course => (
              <div key={course.id} className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-2xl overflow-hidden shrink-0">
                      <img src={course.image} alt={course.title} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-900 mb-1">{course.title}</h3>
                      <p className="text-xs text-slate-500 font-medium">{course.duration} • {course.studentCount} Students</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-8">
                    <div className="text-right">
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Avg. Progress</p>
                      <div className="flex items-center gap-3">
                        <div className="w-24 h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full bg-blue-900" style={{ width: `${course.avgProgress}%` }} />
                        </div>
                        <span className="text-sm font-bold text-slate-900">{course.avgProgress}%</span>
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-slate-300" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="space-y-8">
          <h2 className="text-2xl font-bold text-slate-900">Recent Enrollments</h2>
          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="divide-y divide-slate-50">
              {enrollments.slice(0, 6).map((enrol, idx) => {
                const profile = userProfiles[enrol.userId];
                const course = courses.find(c => c.id === enrol.courseId);
                return (
                  <div key={idx} className="p-4 flex items-center gap-4 hover:bg-slate-50 transition-colors">
                    <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 font-bold">
                      {profile?.displayName?.[0] || profile?.email?.[0] || '?'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-slate-900 truncate">
                        {profile?.displayName || profile?.email || 'Unknown User'}
                      </p>
                      <p className="text-xs text-slate-500 truncate">
                        Enrolled in {course?.title || 'Unknown Course'}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-bold text-blue-600 uppercase tracking-wider">
                        {enrol.status.replace('_', ' ')}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="p-4 bg-slate-50 border-t border-slate-100 text-center">
              <button className="text-sm font-bold text-blue-900 hover:text-blue-700 transition-colors">
                View All Activity
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
