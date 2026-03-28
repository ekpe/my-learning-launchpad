import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { 
  collection, 
  query, 
  onSnapshot, 
  doc, 
  updateDoc, 
  setDoc,
  serverTimestamp,
  getDocs,
  deleteDoc
} from 'firebase/firestore';
import { 
  Users, 
  BookOpen, 
  GraduationCap, 
  Shield, 
  ShieldAlert, 
  ShieldCheck, 
  Search, 
  MoreVertical,
  Edit2,
  Trash2,
  Plus,
  RefreshCw,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Button } from './ui/Button';
import { courses as staticCourses } from '../data/courses';
import { UserProfile, Enrollment, Course } from '../types';

import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
  PieChart,
  Pie
} from 'recharts';

type AdminTab = 'users' | 'courses' | 'enrollments' | 'analytics';

export const AdminDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<AdminTab>('users');
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [enrollments, setEnrollments] = useState<(Enrollment & { user?: UserProfile })[]>([]);
  const [dbCourses, setDbCourses] = useState<Course[]>([]);
  const [analytics, setAnalytics] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    setLoading(true);
    
    // Subscribe to users
    const usersUnsub = onSnapshot(collection(db, 'users'), (snapshot) => {
      const usersData = snapshot.docs.map(doc => doc.data() as UserProfile);
      setUsers(usersData);
    });

    // Subscribe to enrollments
    const enrollmentsUnsub = onSnapshot(collection(db, 'enrollments'), (snapshot) => {
      const enrollmentsData = snapshot.docs.map(doc => doc.data() as Enrollment);
      setEnrollments(enrollmentsData);
    });

    // Subscribe to courses
    const coursesUnsub = onSnapshot(collection(db, 'courses'), (snapshot) => {
      const coursesData = snapshot.docs.map(doc => doc.data() as Course);
      setDbCourses(coursesData);
      setLoading(false);
    });

    // Subscribe to analytics
    const analyticsUnsub = onSnapshot(collection(db, 'analytics'), (snapshot) => {
      const analyticsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        timestamp: doc.data().timestamp?.toDate() || new Date()
      }));
      setAnalytics(analyticsData);
    });

    return () => {
      usersUnsub();
      enrollmentsUnsub();
      coursesUnsub();
      analyticsUnsub();
    };
  }, []);

  const handleRoleChange = async (userId: string, newRole: 'ADMIN' | 'INSTRUCTOR' | 'STUDENT') => {
    try {
      await updateDoc(doc(db, 'users', userId), {
        role: newRole
      });
    } catch (error) {
      console.error('Error updating role:', error);
      alert('Failed to update role. Check permissions.');
    }
  };

  const syncCourses = async () => {
    setSyncing(true);
    try {
      for (const course of staticCourses) {
        await setDoc(doc(db, 'courses', course.id), {
          ...course,
          createdAt: serverTimestamp()
        }, { merge: true });
      }
      alert('Courses synced successfully!');
    } catch (error) {
      console.error('Error syncing courses:', error);
      alert('Failed to sync courses.');
    } finally {
      setSyncing(false);
    }
  };

  const filteredUsers = users.filter(u => 
    u.displayName?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    u.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredCourses = dbCourses.filter(c => 
    c.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredEnrollments = enrollments.map(e => ({
    ...e,
    user: users.find(u => u.uid === e.userId)
  })).filter(e => 
    e.user?.displayName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    e.user?.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    e.courseId.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 text-blue-900 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pt-24 pb-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Admin Dashboard</h1>
            <p className="text-slate-600">Manage your platform's users, courses, and enrollments.</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-900/20 focus:border-blue-900 transition-all w-full md:w-64"
              />
            </div>
            {activeTab === 'courses' && (
              <Button 
                onClick={syncCourses} 
                disabled={syncing}
                className="rounded-xl flex items-center gap-2"
              >
                {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                Sync Static Data
              </Button>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-200 mb-8 overflow-x-auto">
          <button
            onClick={() => setActiveTab('users')}
            className={`flex items-center gap-2 px-6 py-4 font-medium transition-all relative ${
              activeTab === 'users' ? 'text-blue-900' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <Users className="w-4 h-4" />
            Users
            {activeTab === 'users' && (
              <motion.div layoutId="activeTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-900" />
            )}
          </button>
          <button
            onClick={() => setActiveTab('courses')}
            className={`flex items-center gap-2 px-6 py-4 font-medium transition-all relative ${
              activeTab === 'courses' ? 'text-blue-900' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            Courses
            {activeTab === 'courses' && (
              <motion.div layoutId="activeTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-900" />
            )}
          </button>
          <button
            onClick={() => setActiveTab('enrollments')}
            className={`flex items-center gap-2 px-6 py-4 font-medium transition-all relative ${
              activeTab === 'enrollments' ? 'text-blue-900' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <GraduationCap className="w-4 h-4" />
            Enrollments
            {activeTab === 'enrollments' && (
              <motion.div layoutId="activeTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-900" />
            )}
          </button>
          <button
            onClick={() => setActiveTab('analytics')}
            className={`flex items-center gap-2 px-6 py-4 font-medium transition-all relative ${
              activeTab === 'analytics' ? 'text-blue-900' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <RefreshCw className="w-4 h-4" />
            Analytics
            {activeTab === 'analytics' && (
              <motion.div layoutId="activeTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-900" />
            )}
          </button>
        </div>

        {/* Content */}
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
          {activeTab === 'users' && (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="px-6 py-4 font-semibold text-slate-700">User</th>
                    <th className="px-6 py-4 font-semibold text-slate-700">Role</th>
                    <th className="px-6 py-4 font-semibold text-slate-700">Joined</th>
                    <th className="px-6 py-4 font-semibold text-slate-700 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredUsers.map((user) => (
                    <tr key={user.uid} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-900 font-bold">
                            {user.displayName?.[0] || user.email[0].toUpperCase()}
                          </div>
                          <div>
                            <div className="font-medium text-slate-900">{user.displayName || 'Anonymous'}</div>
                            <div className="text-sm text-slate-500">{user.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <select
                            value={user.role}
                            onChange={(e) => handleRoleChange(user.uid, e.target.value as any)}
                            className={`text-xs font-bold px-2 py-1 rounded-full border-none focus:ring-2 focus:ring-blue-900/20 cursor-pointer ${
                              user.role === 'ADMIN' ? 'bg-purple-100 text-purple-700' :
                              user.role === 'INSTRUCTOR' ? 'bg-blue-100 text-blue-700' :
                              'bg-green-100 text-green-700'
                            }`}
                          >
                            <option value="STUDENT">STUDENT</option>
                            <option value="INSTRUCTOR">INSTRUCTOR</option>
                            <option value="ADMIN">ADMIN</option>
                          </select>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-500">
                        {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'N/A'}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button className="p-2 text-slate-400 hover:text-slate-600 transition-colors">
                          <MoreVertical className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'courses' && (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="px-6 py-4 font-semibold text-slate-700">Course</th>
                    <th className="px-6 py-4 font-semibold text-slate-700">Duration</th>
                    <th className="px-6 py-4 font-semibold text-slate-700">Audience</th>
                    <th className="px-6 py-4 font-semibold text-slate-700 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredCourses.map((course) => (
                    <tr key={course.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <img 
                            src={course.image} 
                            alt={course.title} 
                            className="w-12 h-8 rounded object-cover bg-slate-100"
                            referrerPolicy="no-referrer"
                          />
                          <div>
                            <div className="font-medium text-slate-900">{course.title}</div>
                            <div className="text-xs text-slate-500 truncate max-w-[200px]">{course.description}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-500">
                        {course.duration}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-500">
                        {course.audience}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button className="p-2 text-slate-400 hover:text-blue-600 transition-colors">
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button className="p-2 text-slate-400 hover:text-red-600 transition-colors">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredCourses.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-6 py-12 text-center text-slate-500">
                        No courses found in database. Use "Sync Static Data" to import them.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'enrollments' && (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="px-6 py-4 font-semibold text-slate-700">Student</th>
                    <th className="px-6 py-4 font-semibold text-slate-700">Course ID</th>
                    <th className="px-6 py-4 font-semibold text-slate-700">Status</th>
                    <th className="px-6 py-4 font-semibold text-slate-700">Progress</th>
                    <th className="px-6 py-4 font-semibold text-slate-700">Enrolled</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredEnrollments.map((enrollment, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 text-xs font-bold">
                            {enrollment.user?.displayName?.[0] || enrollment.user?.email[0].toUpperCase() || '?'}
                          </div>
                          <div>
                            <div className="font-medium text-slate-900 text-sm">{enrollment.user?.displayName || 'Anonymous'}</div>
                            <div className="text-xs text-slate-500">{enrollment.user?.email || 'No email'}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-500 font-mono">
                        {enrollment.courseId}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${
                          enrollment.status === 'COMPLETED' ? 'bg-green-100 text-green-700' :
                          enrollment.status === 'IN_PROGRESS' ? 'bg-blue-100 text-blue-700' :
                          'bg-slate-100 text-slate-700'
                        }`}>
                          {enrollment.status}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-blue-900 rounded-full" 
                              style={{ width: `${enrollment.progress || 0}%` }}
                            />
                          </div>
                          <span className="text-xs text-slate-600">{enrollment.progress || 0}%</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-500">
                        {enrollment.enrolledAt ? new Date(enrollment.enrolledAt.seconds * 1000).toLocaleDateString() : 'N/A'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'analytics' && (
            <div className="p-8 space-y-12">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100">
                  <p className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-1">Total Events</p>
                  <p className="text-4xl font-bold text-slate-900">{analytics.length}</p>
                </div>
                <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100">
                  <p className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-1">Page Views</p>
                  <p className="text-4xl font-bold text-slate-900">
                    {analytics.filter(a => a.event === 'page_view').length}
                  </p>
                </div>
                <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100">
                  <p className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-1">Lesson Starts</p>
                  <p className="text-4xl font-bold text-slate-900">
                    {analytics.filter(a => a.event === 'lesson_start').length}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                <div className="space-y-4">
                  <h3 className="text-xl font-bold text-slate-900">Events Over Time</h3>
                  <div className="h-80 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={
                        Object.entries(
                          analytics.reduce((acc: any, curr) => {
                            const date = curr.timestamp.toLocaleDateString();
                            acc[date] = (acc[date] || 0) + 1;
                            return acc;
                          }, {})
                        ).map(([date, count]) => ({ date, count }))
                      }>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="date" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                        <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                        <Tooltip 
                          contentStyle={{ backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                        />
                        <Line type="monotone" dataKey="count" stroke="#1e3a8a" strokeWidth={3} dot={{ r: 4, fill: '#1e3a8a' }} activeDot={{ r: 6 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-xl font-bold text-slate-900">Event Distribution</h3>
                  <div className="h-80 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={
                        Object.entries(
                          analytics.reduce((acc: any, curr) => {
                            acc[curr.event] = (acc[curr.event] || 0) + 1;
                            return acc;
                          }, {})
                        ).map(([event, count]) => ({ event, count }))
                      }>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="event" stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} />
                        <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                        <Tooltip 
                          contentStyle={{ backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                        />
                        <Bar dataKey="count" fill="#1e3a8a" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-xl font-bold text-slate-900">Recent Activity</h3>
                <div className="space-y-2">
                  {analytics.slice(0, 10).map((a) => (
                    <div key={a.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100">
                      <div className="flex items-center gap-4">
                        <div className={`w-2 h-2 rounded-full ${
                          a.event.includes('complete') ? 'bg-green-500' :
                          a.event.includes('start') ? 'bg-blue-500' :
                          'bg-slate-400'
                        }`} />
                        <div>
                          <p className="text-sm font-bold text-slate-900 uppercase tracking-wider">{a.event.replace(/_/g, ' ')}</p>
                          <p className="text-xs text-slate-500">{a.userEmail || 'Anonymous'}</p>
                        </div>
                      </div>
                      <p className="text-xs text-slate-400 font-medium">{a.timestamp.toLocaleString()}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
