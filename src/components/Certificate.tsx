import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { db } from '../firebase';
import { doc, getDoc } from 'firebase/firestore';
import { 
  Trophy, 
  Download, 
  Share2, 
  ArrowLeft, 
  Loader2,
  ShieldCheck,
  Calendar,
  User as UserIcon,
  Rocket
} from 'lucide-react';
import { Button } from './ui/Button';
import { motion } from 'motion/react';

export const Certificate = () => {
  const { certificateId } = useParams<{ certificateId: string }>();
  const [certificate, setCertificate] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCertificate = async () => {
      if (!certificateId) return;
      try {
        const docSnap = await getDoc(doc(db, 'certificates', certificateId));
        if (docSnap.exists()) {
          setCertificate(docSnap.data());
        }
      } catch (error) {
        console.error("Error fetching certificate:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchCertificate();
  }, [certificateId]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-12 h-12 animate-spin text-blue-900" />
      </div>
    );
  }

  if (!certificate) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-6">
        <div className="bg-white p-12 rounded-3xl shadow-xl text-center max-w-md">
          <div className="w-20 h-20 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
            <ShieldCheck className="w-10 h-10" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mb-4">Certificate Not Found</h2>
          <p className="text-slate-500 mb-8">The certificate you are looking for is invalid or has been revoked.</p>
          <Link to="/">
            <Button className="rounded-full w-full">Back to Home</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pt-32 pb-20 px-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6 mb-12">
          <div>
            <Link to="/dashboard" className="inline-flex items-center text-blue-900 font-bold mb-4 hover:translate-x-[-4px] transition-transform">
              <ArrowLeft className="mr-2 w-4 h-4" />
              Back to Dashboard
            </Link>
            <h1 className="text-3xl font-bold text-slate-900">Course Certificate</h1>
          </div>
          <div className="flex items-center gap-4">
            <Button variant="outline" className="rounded-full">
              <Download className="w-4 h-4 mr-2" />
              Download PDF
            </Button>
            <Button className="rounded-full bg-blue-900 shadow-lg shadow-blue-900/20">
              <Share2 className="w-4 h-4 mr-2" />
              Share on LinkedIn
            </Button>
          </div>
        </div>

        {/* Certificate Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-[40px] shadow-2xl shadow-slate-200/50 border-[16px] border-slate-50 p-12 md:p-20 relative overflow-hidden"
        >
          {/* Decorative Elements */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-blue-50 rounded-full -mr-32 -mt-32 opacity-50" />
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-amber-50 rounded-full -ml-32 -mb-32 opacity-50" />
          
          <div className="relative z-10 text-center">
            <div className="flex items-center justify-center gap-3 mb-12">
              <div className="w-12 h-12 bg-blue-900 rounded-xl flex items-center justify-center shadow-lg shadow-blue-900/20">
                <Rocket className="text-white w-7 h-7" />
              </div>
              <span className="text-2xl font-black tracking-tighter text-blue-900">
                MY LEARNING<span className="text-amber-600 ml-1">LAUNCHPAD</span>
              </span>
            </div>

            <div className="mb-12">
              <p className="text-sm font-bold text-amber-600 uppercase tracking-[0.3em] mb-4">Certificate of Completion</p>
              <h2 className="text-lg text-slate-400 font-medium italic">This is to certify that</h2>
            </div>

            <div className="mb-12">
              <h3 className="text-4xl md:text-6xl font-black text-slate-900 tracking-tight mb-4">
                {certificate.userName}
              </h3>
              <div className="h-1 w-32 bg-amber-400 mx-auto rounded-full" />
            </div>

            <div className="mb-16">
              <p className="text-lg text-slate-400 font-medium italic mb-6">has successfully completed the executive course</p>
              <h4 className="text-2xl md:text-3xl font-bold text-blue-900 max-w-2xl mx-auto leading-tight">
                {certificate.courseTitle}
              </h4>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-12 items-end pt-12 border-t border-slate-100">
              <div className="text-center md:text-left">
                <div className="flex items-center justify-center md:justify-start gap-2 text-slate-400 mb-2">
                  <Calendar className="w-4 h-4" />
                  <span className="text-xs font-bold uppercase tracking-widest">Issued On</span>
                </div>
                <p className="font-bold text-slate-900">
                  {certificate.issuedAt?.toDate().toLocaleDateString('en-US', { 
                    month: 'long', 
                    day: 'numeric', 
                    year: 'numeric' 
                  })}
                </p>
              </div>

              <div className="flex justify-center">
                <div className="w-24 h-24 bg-amber-50 rounded-full flex items-center justify-center border-4 border-white shadow-xl">
                  <Trophy className="w-10 h-10 text-amber-600" />
                </div>
              </div>

              <div className="text-center md:text-right">
                <div className="flex items-center justify-center md:justify-end gap-2 text-slate-400 mb-2">
                  <ShieldCheck className="w-4 h-4" />
                  <span className="text-xs font-bold uppercase tracking-widest">Certificate ID</span>
                </div>
                <p className="font-mono text-xs font-bold text-slate-900">{certificate.certificateId}</p>
              </div>
            </div>
          </div>

          {/* Verification Badge */}
          <div className="mt-20 pt-8 border-t border-slate-50 flex flex-col items-center gap-2">
            <div className="flex items-center gap-2 text-green-600 bg-green-50 px-4 py-2 rounded-full border border-green-100">
              <ShieldCheck className="w-4 h-4" />
              <span className="text-[10px] font-bold uppercase tracking-widest">Verified Digital Credential</span>
            </div>
            <p className="text-[10px] text-slate-300">Verify this certificate at mylearninglaunchpad.com/verify/{certificate.certificateId}</p>
          </div>
        </motion.div>
      </div>
    </div>
  );
};
