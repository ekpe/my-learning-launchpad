import React, { useState, useEffect } from 'react';
import { auth, db } from '../firebase';
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
  CheckCircle,
  CheckCircle2,
  X,
  XCircle,
  AlertCircle,
  Loader2,
  FileText,
  Video,
  Upload,
  GripVertical
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

// Safely parse API responses — Vercel can return HTML error pages on 500s
async function safeJson(response: Response): Promise<any> {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    // HTML or plain-text error from Vercel/server
    const snippet = text.slice(0, 200);
    throw new Error(
      response.ok
        ? `Unexpected server response: ${snippet}`
        : `Server error ${response.status}: ${snippet}`
    );
  }
}

export const AdminDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<AdminTab>('users');
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [enrollments, setEnrollments] = useState<(Enrollment & { user?: UserProfile })[]>([]);
  const [dbCourses, setDbCourses] = useState<Course[]>([]);
  const [analytics, setAnalytics] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null);
  const [showCourseForm, setShowCourseForm] = useState(false);
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
  const [showUserForm, setShowUserForm] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [serverConfig, setServerConfig] = useState<{ ok: boolean; checks: Record<string, boolean>; firebaseAdminError?: string } | null>(null);
  const [newUser, setNewUser] = useState({
    email: '',
    password: '',
    displayName: '',
    role: 'STUDENT' as 'ADMIN' | 'INSTRUCTOR' | 'STUDENT'
  });

  const [newCourse, setNewCourse] = useState<Partial<Course>>({
    title: '',
    description: '',
    duration: '',
    audience: '',
    image: '',
    price: 0,
    isFree: false,
    order: 10,
    curriculum: []
  });

  useEffect(() => {
    if (status) {
      const timer = setTimeout(() => setStatus(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [status]);

  // Check server config on mount so admin can see missing env vars immediately
  useEffect(() => {
    fetch('/api/config-check')
      .then(r => r.json())
      .then(data => setServerConfig(data))
      .catch(() => {}); // non-fatal
  }, []);

  useEffect(() => {
    // Use a counter so loading clears as soon as ALL four snapshots have fired at least once.
    // Without this, a blocked/empty collection keeps the dashboard spinning forever.
    let resolved = 0;
    const total = 4;
    const tryResolve = () => { if (++resolved >= total) setLoading(false); };

    // Safety net — never spin more than 6 seconds
    const timeout = setTimeout(() => setLoading(false), 6000);

    // Subscribe to users
    const usersUnsub = onSnapshot(collection(db, 'users'), (snapshot) => {
      setUsers(snapshot.docs.map(doc => doc.data() as UserProfile));
      tryResolve();
    }, (error) => {
      console.error('Firestore users subscription error:', error);
      setStatus({ type: 'error', message: `Failed to load users: ${error.message}` });
      tryResolve();
    });

    // Subscribe to enrollments
    const enrollmentsUnsub = onSnapshot(collection(db, 'enrollments'), (snapshot) => {
      setEnrollments(snapshot.docs.map(doc => doc.data() as Enrollment));
      tryResolve();
    }, (error) => {
      console.error('Firestore enrollments error:', error);
      tryResolve();
    });

    // Subscribe to courses
    const coursesUnsub = onSnapshot(collection(db, 'courses'), (snapshot) => {
      setDbCourses(snapshot.docs.map(doc => doc.data() as Course));
      tryResolve();
    }, (error) => {
      console.error('Firestore courses error:', error);
      setStatus({ type: 'error', message: `Failed to load courses: ${error.message}` });
      tryResolve();
    });

    // Subscribe to analytics
    const analyticsUnsub = onSnapshot(collection(db, 'analytics'), (snapshot) => {
      const analyticsData = snapshot.docs.map(doc => {
        const data = doc.data();
        let timestamp = new Date();
        if (data.timestamp) {
          if (typeof data.timestamp.toDate === 'function') {
            timestamp = data.timestamp.toDate();
          } else if (data.timestamp instanceof Date) {
            timestamp = data.timestamp;
          } else if (data.timestamp.seconds) {
            timestamp = new Date(data.timestamp.seconds * 1000);
          }
        }
        return { id: doc.id, ...data, timestamp };
      });
      setAnalytics(analyticsData);
      tryResolve();
    }, (error) => {
      console.error('Firestore analytics error:', error);
      tryResolve(); // non-fatal
    });

    return () => {
      clearTimeout(timeout);
      usersUnsub();
      enrollmentsUnsub();
      coursesUnsub();
      analyticsUnsub();
    };
  }, []);

  const handleRoleChange = async (userId: string, newRole: 'ADMIN' | 'INSTRUCTOR' | 'STUDENT') => {
    try {
      const idToken = await auth.currentUser?.getIdToken();
      const response = await fetch('/api/admin?resource=update-user-role', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify({ uid: userId, role: newRole })
      });

      if (!response.ok) {
        const error = await safeJson(response);
        const message = error.details ? `${error.error}: ${error.details}` : (error.error || 'Failed to update role');
        throw new Error(message);
      }
      
      setStatus({ type: 'success', message: 'Role updated successfully!' });
    } catch (error: any) {
      console.error('Error updating role:', error);
      setStatus({ type: 'error', message: error.message || 'Failed to update role.' });
    }
  };

  const handleSyncUsers = async () => {
    setSyncing(true);
    setStatus(null);
    try {
      const idToken = await auth.currentUser?.getIdToken();
      const response = await fetch('/api/admin?resource=sync-users', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${idToken}` }
      });
      const data = await safeJson(response);
      if (!response.ok) throw new Error(data.error || 'Sync failed');
      setStatus({
        type: 'success',
        message: `Sync complete — ${data.created} user${data.created !== 1 ? 's' : ''} added, ${data.skipped} already existed.${data.errors ? ` ${data.errors.length} error(s).` : ''}`
      });
    } catch (error: any) {
      setStatus({ type: 'error', message: error.message || 'Sync failed.' });
    } finally {
      setSyncing(false);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setSyncing(true);
    setStatus(null);
    try {
      const idToken = await auth.currentUser?.getIdToken();
      const response = await fetch('/api/admin?resource=create-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify(newUser)
      });

      if (!response.ok) {
        const error = await safeJson(response);
        const message = error.details ? `${error.error}: ${error.details}` : (error.error || 'Failed to create user');
        throw new Error(message);
      }

      setShowUserForm(false);
      setNewUser({
        email: '',
        password: '',
        displayName: '',
        role: 'STUDENT'
      });
      setStatus({ type: 'success', message: 'User created successfully!' });
    } catch (error: any) {
      console.error('Error creating user:', error);
      setStatus({ type: 'error', message: error.message || 'Failed to create user.' });
    } finally {
      setSyncing(false);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    setSyncing(true);
    setStatus(null);
    try {
      const idToken = await auth.currentUser?.getIdToken();
      const response = await fetch(`/api/admin?resource=delete-user&uid=${userId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${idToken}`
        }
      });

      if (!response.ok) {
        const error = await safeJson(response);
        const message = error.details ? `${error.error}: ${error.details}` : (error.error || 'Failed to delete user');
        throw new Error(message);
      }

      setDeleteConfirmId(null);
      setStatus({ type: 'success', message: 'User deleted successfully!' });
    } catch (error: any) {
      console.error('Error deleting user:', error);
      setStatus({ type: 'error', message: error.message || 'Failed to delete user.' });
    } finally {
      setSyncing(false);
    }
  };

  const handleFileUpload = async (file: File) => {
    setIsUploading(true);
    setStatus(null);
    try {
      const idToken = await auth.currentUser?.getIdToken();
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/admin?resource=upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${idToken}`
        },
        body: formData
      });

      if (!response.ok) {
        throw new Error('Failed to upload file');
      }

      const data = await safeJson(response);
      return data.url;
    } catch (error: any) {
      console.error('Upload error:', error);
      setStatus({ type: 'error', message: 'Failed to upload file.' });
      return null;
    } finally {
      setIsUploading(false);
    }
  };

  const syncCourses = async () => {
    setSyncing(true);
    setStatus(null);
    try {
      const idToken = await auth.currentUser?.getIdToken();
      const response = await fetch('/api/admin?resource=sync-courses', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${idToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ courses: staticCourses })
      });
      const data = await safeJson(response);
      if (!response.ok) throw new Error(data.error || 'Sync failed');
      setStatus({ type: 'success', message: `Courses synced — ${data.synced} course${data.synced !== 1 ? 's' : ''} written.` });
    } catch (error: any) {
      console.error('Error syncing courses:', error);
      setStatus({ type: 'error', message: error.message || 'Failed to sync courses.' });
    } finally {
      setSyncing(false);
    }
  };

  const handleCreateCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    setSyncing(true);
    setStatus(null);
    try {
      const id = newCourse.title?.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
      if (!id) throw new Error("Course title is required");
      
      await setDoc(doc(db, 'courses', id), {
        ...newCourse,
        id,
        curriculum: newCourse.curriculum || [],
        createdAt: serverTimestamp(),
        price: newCourse.isFree ? 0 : Number(newCourse.price),
        order: Number(newCourse.order)
      });
      setShowCourseForm(false);
      setNewCourse({
        title: '',
        description: '',
        duration: '',
        audience: '',
        image: '',
        price: 0,
        isFree: false,
        order: 10,
        curriculum: []
      });
      setStatus({ type: 'success', message: 'Course created successfully!' });
    } catch (error: any) {
      console.error('Error creating course:', error);
      setStatus({ type: 'error', message: error.message || 'Failed to create course.' });
    } finally {
      setSyncing(false);
    }
  };

  const handleDeleteCourse = async (courseId: string) => {
    setSyncing(true);
    setStatus(null);
    try {
      await deleteDoc(doc(db, 'courses', courseId));
      setStatus({ type: 'success', message: 'Course deleted successfully!' });
      setDeleteConfirmId(null);
    } catch (error) {
      console.error('Error deleting course:', error);
      setStatus({ type: 'error', message: 'Failed to delete course.' });
    } finally {
      setSyncing(false);
    }
  };

  const handleSaveCurriculum = async (courseId: string, curriculum: any[]) => {
    setSyncing(true);
    try {
      await updateDoc(doc(db, 'courses', courseId), { curriculum });
      setStatus({ type: 'success', message: 'Curriculum updated successfully!' });
      setEditingCourse(null);
    } catch (error) {
      console.error('Error updating curriculum:', error);
      setStatus({ type: 'error', message: 'Failed to update curriculum.' });
    } finally {
      setSyncing(false);
    }
  };

  const CurriculumEditor = ({ course, onCancel }: { course: Course, onCancel: () => void }) => {
    const [localCurriculum, setLocalCurriculum] = useState<any[]>(course.curriculum || []);

    const addModule = () => {
      setLocalCurriculum([...localCurriculum, { module: 'New Module', topics: [] }]);
    };

    const removeModule = (mIdx: number) => {
      const newCur = [...localCurriculum];
      newCur.splice(mIdx, 1);
      setLocalCurriculum(newCur);
    };

    const updateModuleTitle = (mIdx: number, title: string) => {
      const newCur = [...localCurriculum];
      newCur[mIdx].module = title;
      setLocalCurriculum(newCur);
    };

    const addLesson = (mIdx: number) => {
      const newCur = [...localCurriculum];
      newCur[mIdx].topics.push({ title: 'New Lesson', description: '' });
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
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={onCancel} className="rounded-xl">Cancel</Button>
            <Button 
              onClick={() => handleSaveCurriculum(course.id, localCurriculum)} 
              disabled={syncing}
              className="rounded-xl flex items-center gap-2 bg-blue-900"
            >
              {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
              Save All Changes
            </Button>
          </div>
        </div>

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
                                  const file = e.target.files?.[0];
                                  if (file) {
                                    const url = await handleFileUpload(file);
                                    if (url) updateLesson(mIdx, lIdx, { videoUrl: url });
                                  }
                                }}
                              />
                              <label
                                htmlFor={`video-${mIdx}-${lIdx}`}
                                className="p-2 bg-blue-50 text-blue-900 rounded-lg cursor-pointer hover:bg-blue-100 transition-colors flex items-center justify-center"
                                title="Upload Video"
                              >
                                {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                              </label>
                            </div>
                          </div>
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
                                  const file = e.target.files?.[0];
                                  if (file) {
                                    const url = await handleFileUpload(file);
                                    if (url) updateLesson(mIdx, lIdx, { materialUrl: url });
                                  }
                                }}
                              />
                              <label
                                htmlFor={`material-${mIdx}-${lIdx}`}
                                className="p-2 bg-blue-50 text-blue-900 rounded-lg cursor-pointer hover:bg-blue-100 transition-colors flex items-center justify-center"
                                title="Upload Material"
                              >
                                {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                              </label>
                            </div>
                          </div>
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

  const filteredUsers = users.filter(u => 
    u.displayName?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    u.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredCourses = dbCourses
    .filter(c => c.title.toLowerCase().includes(searchTerm.toLowerCase()))
    .sort((a, b) => {
      if (a.isFree && !b.isFree) return -1;
      if (!a.isFree && b.isFree) return 1;
      return (a.order || 0) - (b.order || 0);
    });

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

        {/* Server config warning — shows missing env vars */}
        {serverConfig && !serverConfig.ok && (
          <div className="mb-6 p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-sm">
            <p className="font-bold mb-2">⚠️ Server configuration incomplete — some admin features will not work.</p>
            <ul className="space-y-1 list-disc list-inside">
              {!serverConfig.checks.firebaseAdmin && (
                <li>
                  <strong>Firebase Admin SDK not initialised</strong> — set <code className="bg-amber-100 px-1 rounded">FIREBASE_SERVICE_ACCOUNT_KEY</code> in Vercel → Project Settings → Environment Variables.
                  {serverConfig.firebaseAdminError && (
                    <span className="block mt-1 text-xs text-amber-700 font-mono">{serverConfig.firebaseAdminError}</span>
                  )}
                </li>
              )}
              {!serverConfig.checks.adminEmail && (
                <li>
                  <code className="bg-amber-100 px-1 rounded">ADMIN_EMAIL</code> not set — admin role checks may fail.
                </li>
              )}
              {!serverConfig.checks.firestoreDbId && (
                <li>
                  <code className="bg-amber-100 px-1 rounded">FIRESTORE_DATABASE_ID</code> not set — using default Firestore database.
                </li>
              )}
            </ul>
          </div>
        )}

        {status && (
          <div className={`mb-6 p-4 rounded-xl flex items-center justify-between border animate-in fade-in slide-in-from-top-4 duration-300 ${
            status.type === 'success' 
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200' 
              : 'bg-rose-50 text-rose-800 border-rose-200'
          }`}>
            <div className="flex items-center gap-3">
              {status.type === 'success' ? (
                <CheckCircle className="w-5 h-5 text-emerald-500" />
              ) : (
                <AlertCircle className="w-5 h-5 text-rose-500" />
              )}
              <p className="font-medium">{status.message}</p>
            </div>
            <button 
              onClick={() => setStatus(null)}
              className="p-1 hover:bg-black/5 rounded-lg transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
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
            {activeTab === 'users' && (
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  onClick={handleSyncUsers}
                  disabled={syncing}
                  className="rounded-xl flex items-center gap-2 border-slate-200"
                  title="Sync Firebase Auth users into Firestore"
                >
                  {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                  Sync Auth Users
                </Button>
                <Button
                  onClick={() => setShowUserForm(true)}
                  className="rounded-xl flex items-center gap-2 bg-blue-900 hover:bg-blue-800"
                >
                  <Plus className="w-4 h-4" />
                  New User
                </Button>
              </div>
            )}
            {activeTab === 'courses' && (
              <div className="flex items-center gap-2">
                <Button 
                  onClick={() => setShowCourseForm(true)}
                  className="rounded-xl flex items-center gap-2 bg-green-600 hover:bg-green-700"
                >
                  <Plus className="w-4 h-4" />
                  New Course
                </Button>
                <Button 
                  onClick={syncCourses} 
                  disabled={syncing}
                  className="rounded-xl flex items-center gap-2"
                >
                  {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                  Sync Static Data
                </Button>
              </div>
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
          {editingCourse ? (
             <CurriculumEditor course={editingCourse} onCancel={() => setEditingCourse(null)} />
          ) : (
            <>
              <AnimatePresence>
                {showUserForm && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="border-b border-slate-200 bg-slate-50/50 overflow-hidden"
              >
                <form onSubmit={handleCreateUser} className="p-8 space-y-6">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-bold text-slate-900">Add New User</h2>
                    <button 
                      type="button"
                      onClick={() => setShowUserForm(false)}
                      className="text-slate-400 hover:text-slate-600"
                    >
                      <XCircle className="w-6 h-6" />
                    </button>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-slate-700">Full Name</label>
                      <input
                        required
                        type="text"
                        value={newUser.displayName}
                        onChange={(e) => setNewUser({ ...newUser, displayName: e.target.value })}
                        placeholder="John Doe"
                        className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-900/20 focus:border-blue-900 outline-none transition-all"
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-slate-700">Email Address</label>
                      <input
                        required
                        type="email"
                        value={newUser.email}
                        onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                        placeholder="john@example.com"
                        className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-900/20 focus:border-blue-900 outline-none transition-all"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-slate-700">Password</label>
                      <input
                        required
                        type="password"
                        value={newUser.password}
                        onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                        placeholder="••••••••"
                        minLength={6}
                        className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-900/20 focus:border-blue-900 outline-none transition-all"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-slate-700">Initial Role</label>
                      <select
                        value={newUser.role}
                        onChange={(e) => setNewUser({ ...newUser, role: e.target.value as any })}
                        className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-900/20 focus:border-blue-900 outline-none transition-all bg-white"
                      >
                        <option value="STUDENT">STUDENT</option>
                        <option value="INSTRUCTOR">INSTRUCTOR</option>
                        <option value="ADMIN">ADMIN</option>
                      </select>
                    </div>

                    <div className="md:col-span-2 flex justify-end pt-4">
                      <Button 
                        type="submit"
                        disabled={syncing}
                        className="rounded-xl px-12 py-3 flex items-center justify-center gap-2"
                      >
                        {syncing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Plus className="w-5 h-5" />}
                        Create User
                      </Button>
                    </div>
                  </div>
                </form>
              </motion.div>
            )}

            {showCourseForm && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="border-b border-slate-200 bg-slate-50/50 overflow-hidden"
              >
                <form onSubmit={handleCreateCourse} className="p-8 space-y-6">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-bold text-slate-900">Create New Course</h2>
                    <button 
                      type="button"
                      onClick={() => setShowCourseForm(false)}
                      className="text-slate-400 hover:text-slate-600"
                    >
                      <XCircle className="w-6 h-6" />
                    </button>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-slate-700">Course Title</label>
                      <input
                        required
                        type="text"
                        value={newCourse.title}
                        onChange={(e) => setNewCourse({ ...newCourse, title: e.target.value })}
                        placeholder="e.g. AI for Executives"
                        className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-900/20 focus:border-blue-900 outline-none transition-all"
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-slate-700">Image URL</label>
                      <input
                        required
                        type="url"
                        value={newCourse.image}
                        onChange={(e) => setNewCourse({ ...newCourse, image: e.target.value })}
                        placeholder="https://images.unsplash.com/..."
                        className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-900/20 focus:border-blue-900 outline-none transition-all"
                      />
                    </div>

                    <div className="space-y-2 md:col-span-2">
                      <label className="text-sm font-semibold text-slate-700">Description</label>
                      <textarea
                        required
                        value={newCourse.description}
                        onChange={(e) => setNewCourse({ ...newCourse, description: e.target.value })}
                        placeholder="Brief overview of the course..."
                        rows={3}
                        className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-900/20 focus:border-blue-900 outline-none transition-all resize-none"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-slate-700">Duration</label>
                      <input
                        required
                        type="text"
                        value={newCourse.duration}
                        onChange={(e) => setNewCourse({ ...newCourse, duration: e.target.value })}
                        placeholder="e.g. 4 Weeks"
                        className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-900/20 focus:border-blue-900 outline-none transition-all"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-slate-700">Target Audience</label>
                      <input
                        required
                        type="text"
                        value={newCourse.audience}
                        onChange={(e) => setNewCourse({ ...newCourse, audience: e.target.value })}
                        placeholder="e.g. Business Leaders"
                        className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-900/20 focus:border-blue-900 outline-none transition-all"
                      />
                    </div>

                    <div className="flex items-center gap-8 p-4 bg-white rounded-xl border border-slate-200">
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id="isFree"
                          checked={newCourse.isFree}
                          onChange={(e) => setNewCourse({ ...newCourse, isFree: e.target.checked })}
                          className="w-4 h-4 text-blue-900 rounded focus:ring-blue-900"
                        />
                        <label htmlFor="isFree" className="text-sm font-semibold text-slate-700">Free Course</label>
                      </div>
                      
                      {!newCourse.isFree && (
                        <div className="flex-1 flex items-center gap-2">
                          <label className="text-sm font-semibold text-slate-700">Price ($)</label>
                          <input
                            type="number"
                            value={newCourse.price}
                            onChange={(e) => setNewCourse({ ...newCourse, price: Number(e.target.value) })}
                            className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-900/20 focus:border-blue-900 outline-none transition-all"
                          />
                        </div>
                      )}
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-slate-700">Display Order (Lower = First)</label>
                      <input
                        required
                        type="number"
                        value={newCourse.order}
                        onChange={(e) => setNewCourse({ ...newCourse, order: Number(e.target.value) })}
                        placeholder="e.g. 10"
                        className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-900/20 focus:border-blue-900 outline-none transition-all"
                      />
                    </div>

                    <div className="flex items-end">
                      <Button 
                        type="submit"
                        disabled={syncing}
                        className="w-full rounded-xl py-3 flex items-center justify-center gap-2"
                      >
                        {syncing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Plus className="w-5 h-5" />}
                        Save Course
                      </Button>
                    </div>
                  </div>
                </form>
              </motion.div>
            )}
          </AnimatePresence>

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
                        <div className="flex items-center justify-end gap-2">
                          {deleteConfirmId === user.uid ? (
                            <div className="flex items-center gap-2 animate-in fade-in zoom-in duration-200">
                              <span className="text-xs font-medium text-rose-600">Confirm?</span>
                              <button 
                                onClick={() => handleDeleteUser(user.uid)}
                                disabled={syncing}
                                className="p-1.5 bg-rose-600 text-white rounded-lg hover:bg-rose-700 disabled:opacity-50"
                              >
                                {syncing ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
                              </button>
                              <button 
                                onClick={() => setDeleteConfirmId(null)}
                                disabled={syncing}
                                className="p-1.5 bg-slate-200 text-slate-600 rounded-lg hover:bg-slate-300 disabled:opacity-50"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          ) : (
                            <button 
                              onClick={() => setDeleteConfirmId(user.uid)}
                              className="p-2 text-slate-400 hover:text-rose-600 transition-colors"
                              title="Delete User"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
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
                          <button 
                            onClick={() => setEditingCourse(course)}
                            className="p-2 text-slate-400 hover:text-blue-600 transition-colors"
                            title="Edit Curriculum"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          {deleteConfirmId === course.id ? (
                            <div className="flex items-center gap-2 animate-in fade-in zoom-in duration-200">
                              <span className="text-xs font-medium text-rose-600">Confirm?</span>
                              <button 
                                onClick={() => handleDeleteCourse(course.id)}
                                disabled={syncing}
                                className="p-1.5 bg-rose-600 text-white rounded-lg hover:bg-rose-700 disabled:opacity-50"
                              >
                                {syncing ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
                              </button>
                              <button 
                                onClick={() => setDeleteConfirmId(null)}
                                disabled={syncing}
                                className="p-1.5 bg-slate-200 text-slate-600 rounded-lg hover:bg-slate-300 disabled:opacity-50"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          ) : (
                            <button 
                              onClick={() => setDeleteConfirmId(course.id)}
                              className="p-2 text-slate-400 hover:text-red-600 transition-colors"
                              title="Delete Course"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
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
            </>
          )}
        </div>
      </div>
    </div>
  );
};
