import React, { useEffect, useState } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebase';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { CheckCircle2, Loader2, ArrowRight } from 'lucide-react';
import { Button } from './ui/Button';
import { motion } from 'motion/react';
import { logEvent, AnalyticsEvent } from '../services/analyticsService';

export const PaymentSuccess = () => {
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get('session_id');
  const courseId = searchParams.get('courseId');
  const { user } = useAuth();
  const [status, setStatus] = useState<'LOADING' | 'SUCCESS' | 'ERROR'>('LOADING');
  const navigate = useNavigate();

  useEffect(() => {
    const verifyPayment = async () => {
      if (!sessionId || !courseId || !user) {
        setStatus('ERROR');
        return;
      }

      try {
        // Verify session status with the server
        const response = await fetch(`/api/checkout-session/${sessionId}`);
        const session = await response.json();

        if (session.payment_status === 'paid') {
          // Create enrollment in Firestore
          const enrollmentId = `${user.uid}_${courseId}`;
          await setDoc(doc(db, 'enrollments', enrollmentId), {
            userId: user.uid,
            courseId: courseId,
            status: 'ENROLLED',
            enrolledAt: serverTimestamp(),
            progress: 0,
            paymentId: sessionId
          });

          logEvent(AnalyticsEvent.COURSE_ENROLLMENT, {
            courseId,
            sessionId,
            isFree: false
          });

          setStatus('SUCCESS');
        } else {
          setStatus('ERROR');
        }
      } catch (error) {
        console.error('Payment verification error:', error);
        setStatus('ERROR');
      }
    };

    if (user) {
      verifyPayment();
    }
  }, [sessionId, courseId, user]);

  if (status === 'LOADING') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-white">
        <Loader2 className="w-12 h-12 animate-spin text-blue-900 mb-4" />
        <p className="text-slate-600 font-medium">Verifying your payment...</p>
      </div>
    );
  }

  if (status === 'ERROR') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-white px-6">
        <div className="text-center max-w-md">
          <h2 className="text-3xl font-bold text-slate-900 mb-4">Payment Verification Failed</h2>
          <p className="text-slate-600 mb-8">
            We couldn't verify your payment. If you believe this is an error, please contact support.
          </p>
          <Link to="/">
            <Button variant="default" className="rounded-full">
              Back to Home
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-white px-6">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="text-center max-w-md"
      >
        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center text-green-600 mx-auto mb-8">
          <CheckCircle2 className="w-10 h-10" />
        </div>
        <h2 className="text-4xl font-bold text-slate-900 mb-4">Payment Successful!</h2>
        <p className="text-slate-600 mb-10 text-lg">
          Thank you for enrolling! Your course is now available in your dashboard.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link to="/dashboard">
            <Button size="lg" className="rounded-full px-10 font-bold w-full sm:w-auto">
              Go to Dashboard
              <ArrowRight className="ml-2 w-5 h-5" />
            </Button>
          </Link>
          <Link to={`/course/${courseId}`}>
            <Button variant="outline" size="lg" className="rounded-full px-10 w-full sm:w-auto">
              View Course
            </Button>
          </Link>
        </div>
      </motion.div>
    </div>
  );
};
