import React, { useState } from 'react';
import { Button } from './ui/Button';
import { X, Mail, User, Loader2, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { db } from '../firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';

interface LeadMagnetModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const LeadMagnetModal: React.FC<LeadMagnetModalProps> = ({ isOpen, onClose }) => {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // 1. Save lead to Firestore
      await addDoc(collection(db, 'leads'), {
        name,
        email,
        source: 'free_guide_hero',
        status: 'new',
        createdAt: serverTimestamp()
      });

      // 2. Trigger email delivery via backend
      try {
        await fetch('/api/send-email', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            to: email,
            subject: 'Your Free AI Strategy Playbook is Here!',
            text: `Hi ${name},\n\nThank you for downloading the AI Strategy Playbook. You can access it here: [LINK_TO_GUIDE]\n\nBest regards,\nThe AI Executive Team`,
            html: `
              <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; rounded: 12px;">
                <h2 style="color: #1e3a8a;">Your AI Strategy Playbook is Here!</h2>
                <p>Hi ${name},</p>
                <p>Thank you for downloading the <strong>AI Strategy Playbook</strong>. This guide is designed to help you cut through the noise and start executing AI the right way.</p>
                <div style="margin: 30px 0;">
                  <a href="#" style="background-color: #1e3a8a; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold;">Download the Playbook (PDF)</a>
                </div>
                <p>If you have any questions or want to discuss how to apply these frameworks to your specific business, feel free to reply to this email.</p>
                <p>Best regards,<br/>The AI Executive Team</p>
              </div>
            `
          }),
        });
      } catch (emailErr) {
        console.error('Failed to trigger email delivery:', emailErr);
        // We don't fail the whole process if email fails, as the lead is saved
      }

      setSubmitted(true);
    } catch (err) {
      console.error('Error saving lead:', err);
      setError('Something went wrong. Please try again.');
      handleFirestoreError(err, OperationType.WRITE, 'leads');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden relative"
        >
          <button 
            onClick={onClose}
            className="absolute top-6 right-6 text-slate-400 hover:text-slate-600 transition-colors z-10"
          >
            <X className="w-6 h-6" />
          </button>

          <div className="p-8 md:p-12">
            {!submitted ? (
              <>
                <div className="mb-8">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-bold uppercase tracking-wider mb-4">
                    Free Executive Guide
                  </div>
                  <h2 className="text-3xl font-bold text-slate-900 mb-4 leading-tight">
                    Get Your Practical AI Playbook
                  </h2>
                  <p className="text-slate-600 leading-relaxed">
                    Enter your details below to receive the guide immediately in your inbox.
                  </p>
                </div>

                {error && (
                  <div className="mb-6 p-4 bg-red-50 border border-red-100 text-red-600 text-sm rounded-xl">
                    {error}
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-5">
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-700">Full Name</label>
                    <div className="relative">
                      <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                      <input 
                        type="text" 
                        required
                        className="w-full pl-12 pr-4 py-4 rounded-xl border border-slate-200 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-900/20 focus:border-blue-900 transition-all"
                        placeholder="Enter your name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-700">Work Email</label>
                    <div className="relative">
                      <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                      <input 
                        type="email" 
                        required
                        className="w-full pl-12 pr-4 py-4 rounded-xl border border-slate-200 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-900/20 focus:border-blue-900 transition-all"
                        placeholder="you@company.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                      />
                    </div>
                  </div>

                  <Button 
                    type="submit" 
                    className="w-full py-7 text-lg font-bold rounded-xl mt-4 shadow-lg shadow-blue-900/20"
                    disabled={loading}
                  >
                    {loading ? (
                      <Loader2 className="w-6 h-6 animate-spin" />
                    ) : (
                      'Send Me the Guide'
                    )}
                  </Button>
                  
                  <p className="text-center text-xs text-slate-400 mt-4">
                    We respect your privacy. No spam, ever.
                  </p>
                </form>
              </>
            ) : (
              <div className="text-center py-8">
                <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                  <CheckCircle2 className="w-10 h-10 text-green-600" />
                </div>
                <h2 className="text-3xl font-bold text-slate-900 mb-4">Check Your Inbox!</h2>
                <p className="text-slate-600 mb-8 leading-relaxed">
                  We've sent the **AI Strategy Playbook** to **{email}**. <br />
                  It should arrive in the next few minutes.
                </p>
                <Button 
                  onClick={onClose}
                  variant="outline"
                  className="rounded-xl px-8"
                >
                  Close
                </Button>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
