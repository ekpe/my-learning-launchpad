import React, { useState } from 'react';
import { auth, db } from '../firebase';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  GoogleAuthProvider,
  signInWithPopup,
} from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { sendEmail } from '../services/emailService';
import { Button } from './ui/Button';
import { X, Mail, Lock, User as UserIcon, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// Map Firebase error codes to human-friendly messages
function friendlyError(code: string): string {
  switch (code) {
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'Incorrect email or password.';
    case 'auth/email-already-in-use':
      return 'An account with this email already exists.';
    case 'auth/weak-password':
      return 'Password must be at least 6 characters.';
    case 'auth/invalid-email':
      return 'Please enter a valid email address.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Please wait a moment and try again.';
    case 'auth/network-request-failed':
      return 'Network error. Please check your connection and try again.';
    case 'auth/popup-closed-by-user':
      return 'Sign-in popup was closed. Please try again.';
    default:
      return 'Something went wrong. Please try again.';
  }
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const reset = () => {
    setEmail('');
    setPassword('');
    setName('');
    setError('');
    setLoading(false);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  // Create or update the Firestore user profile after any sign-in
  const upsertProfile = async (uid: string, displayName: string | null, userEmail: string | null) => {
    const adminEmail = import.meta.env.VITE_ADMIN_EMAIL || '';
    const role = adminEmail && userEmail === adminEmail ? 'ADMIN' : 'STUDENT';
    try {
      await setDoc(
        doc(db, 'users', uid),
        { uid, displayName, email: userEmail, role, lastLogin: serverTimestamp() },
        { merge: true }
      );
    } catch (err) {
      // Non-fatal — user is authenticated even if profile write fails
      console.error('[AuthModal] Profile upsert failed:', err);
    }
  };

  const handleGoogleSignIn = async () => {
    setError('');
    setLoading(true);
    try {
      const { user } = await signInWithPopup(auth, new GoogleAuthProvider());
      // Close immediately — user is authenticated. Upsert profile in background.
      handleClose();
      upsertProfile(user.uid, user.displayName, user.email)
        .catch(err => console.error('[AuthModal] Google profile upsert failed:', err));
    } catch (err: any) {
      if (err.code !== 'auth/popup-closed-by-user') {
        setError(friendlyError(err.code));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
        handleClose();
      } else {
        // Registration
        const { user } = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(user, { displayName: name });
        // Close immediately — user is authenticated
        handleClose();
        // Profile write and welcome email in background — never block close
        upsertProfile(user.uid, name, email)
          .catch(err => console.error('[AuthModal] Profile upsert failed:', err));
        sendEmail({
          context: 'self',
          to: email,
          subject: 'Welcome to My Learning Launchpad!',
          text: `Hi ${name},\n\nWelcome! We're excited to have you on board.\n\nBest regards,\nThe My Learning Launchpad Team`,
          html: `
            <div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#1e293b;">
              <h1 style="color:#1e3a8a;">Welcome to My Learning Launchpad!</h1>
              <p>Hi ${name},</p>
              <p>We're thrilled to have you join our community of forward-thinking executives and AI enthusiasts.</p>
              <div style="margin:30px 0;">
                <a href="${window.location.origin}" style="background:#1e3a8a;color:white;padding:12px 24px;border-radius:9999px;text-decoration:none;font-weight:bold;">
                  Start Learning Now
                </a>
              </div>
              <p>Best regards,<br/>The My Learning Launchpad Team</p>
            </div>
          `,
        }).catch(err => console.error('[AuthModal] Welcome email failed:', err));
      }
    } catch (err: any) {
      console.error('[AuthModal] Auth error:', err);
      setError(friendlyError(err.code));
    } finally {
      setLoading(false);
    }
    // Note: handleClose() unmounts the component on success which is fine —
    // the finally setLoading(false) is a no-op on unmounted components in React 18.
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden relative"
          >
            <button
              onClick={handleClose}
              className="absolute top-6 right-6 text-slate-400 hover:text-slate-600 transition-colors"
              aria-label="Close"
            >
              <X className="w-6 h-6" />
            </button>

            <div className="p-8 md:p-10">
              <div className="text-center mb-8">
                <h2 className="text-2xl font-bold text-slate-900 mb-2">
                  {isLogin ? 'Welcome Back' : 'Create Account'}
                </h2>
                <p className="text-slate-500 text-sm">
                  {isLogin
                    ? 'Sign in to access your AI learning dashboard'
                    : 'Join My Learning Launchpad to start your AI journey'}
                </p>
              </div>

              {error && (
                <div className="mb-6 p-4 bg-red-50 border border-red-100 text-red-600 text-sm rounded-xl">
                  {error}
                </div>
              )}

              <div className="space-y-4">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full py-6 flex items-center justify-center gap-3 border-slate-200 hover:bg-slate-50 rounded-xl"
                  onClick={handleGoogleSignIn}
                  disabled={loading}
                >
                  <img
                    src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg"
                    className="w-5 h-5"
                    alt="Google"
                  />
                  <span>Continue with Google</span>
                </Button>

                <div className="relative my-8">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-slate-100" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-white px-4 text-slate-400 font-medium">Or continue with email</span>
                  </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                  {!isLogin && (
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-slate-700">Full Name</label>
                      <div className="relative">
                        <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                        <input
                          type="text"
                          required
                          className="w-full pl-12 pr-4 py-3 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-900/20 focus:border-blue-900 transition-all"
                          placeholder="John Doe"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                        />
                      </div>
                    </div>
                  )}

                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-700">Email Address</label>
                    <div className="relative">
                      <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                      <input
                        type="email"
                        required
                        className="w-full pl-12 pr-4 py-3 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-900/20 focus:border-blue-900 transition-all"
                        placeholder="john@company.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-700">Password</label>
                    <div className="relative">
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                      <input
                        type="password"
                        required
                        className="w-full pl-12 pr-4 py-3 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-900/20 focus:border-blue-900 transition-all"
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                      />
                    </div>
                  </div>

                  <Button
                    type="submit"
                    className="w-full py-6 text-lg font-bold rounded-xl mt-4"
                    disabled={loading}
                  >
                    {loading ? (
                      <Loader2 className="w-6 h-6 animate-spin" />
                    ) : (
                      isLogin ? 'Sign In' : 'Create Account'
                    )}
                  </Button>
                </form>
              </div>

              <div className="mt-8 text-center text-sm text-slate-500">
                {isLogin ? (
                  <p>
                    Don't have an account?{' '}
                    <button
                      onClick={() => { setIsLogin(false); setError(''); }}
                      className="text-blue-900 font-bold hover:underline"
                    >
                      Sign Up
                    </button>
                  </p>
                ) : (
                  <p>
                    Already have an account?{' '}
                    <button
                      onClick={() => { setIsLogin(true); setError(''); }}
                      className="text-blue-900 font-bold hover:underline"
                    >
                      Sign In
                    </button>
                  </p>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
