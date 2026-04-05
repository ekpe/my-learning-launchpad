import React, { useState } from 'react';
import { Button } from './ui/Button';
import { motion } from 'motion/react';
import { ArrowRight, CheckCircle2, Download, ShieldCheck, Zap, Layers } from 'lucide-react';
import { LeadMagnetModal } from './LeadMagnetModal';

export const LeadMagnetHero = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const bulletPoints = [
    {
      icon: <Layers className="w-5 h-5 text-blue-600" />,
      text: "Understand how AI actually works in real systems"
    },
    {
      icon: <ShieldCheck className="w-5 h-5 text-blue-600" />,
      text: "Learn where to start (and what to avoid)"
    },
    {
      icon: <Zap className="w-5 h-5 text-blue-600" />,
      text: "Move from confusion → clarity → execution"
    }
  ];

  return (
    <section className="relative pt-32 pb-20 lg:pt-48 lg:pb-32 overflow-hidden bg-slate-50">
      {/* Background Accents */}
      <div className="absolute top-0 right-0 -translate-y-1/4 translate-x-1/4 w-[800px] h-[800px] bg-blue-100/30 rounded-full blur-3xl opacity-50 -z-10" />
      <div className="absolute bottom-0 left-0 translate-y-1/4 -translate-x-1/4 w-[600px] h-[600px] bg-amber-100/20 rounded-full blur-3xl opacity-50 -z-10" />

      <div className="max-w-7xl mx-auto px-6">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8 }}
          >
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white border border-slate-200 text-blue-900 text-xs font-bold uppercase tracking-widest mb-8 shadow-sm">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-600"></span>
              </span>
              Free Executive Resource
            </div>
            
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-slate-900 leading-[1.1] mb-8 tracking-tight">
              Cut Through the AI Noise. Learn How to Think, Design, and Execute AI the Right Way.
            </h1>
            
            <p className="text-xl text-slate-600 mb-10 leading-relaxed max-w-xl">
              A practical playbook for leaders and professionals who want clarity—not hype.
            </p>

            <div className="space-y-5 mb-12">
              {bulletPoints.map((point, index) => (
                <motion.div 
                  key={index}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 + index * 0.1 }}
                  className="flex items-start gap-4 group"
                >
                  <div className="mt-1 p-1 rounded-lg bg-blue-50 group-hover:bg-blue-100 transition-colors">
                    {point.icon}
                  </div>
                  <span className="text-lg text-slate-700 font-medium">{point.text}</span>
                </motion.div>
              ))}
            </div>

            <div className="flex flex-col sm:flex-row gap-5">
              <Button 
                size="lg" 
                className="rounded-2xl py-8 px-10 text-lg font-bold shadow-xl shadow-blue-900/20 group relative overflow-hidden"
                onClick={() => setIsModalOpen(true)}
              >
                <span className="relative z-10 flex items-center gap-3">
                  Download the Free Guide
                  <Download className="w-5 h-5 group-hover:translate-y-0.5 transition-transform" />
                </span>
              </Button>
              <div className="flex items-center gap-4 px-4 py-2">
                <div className="flex -space-x-3">
                  {[1, 2, 3].map((i) => (
                    <img 
                      key={i}
                      src={`https://picsum.photos/seed/exec${i}/100/100`} 
                      alt="Executive" 
                      className="w-10 h-10 rounded-full border-2 border-white shadow-sm"
                      referrerPolicy="no-referrer"
                    />
                  ))}
                </div>
                <div className="text-sm">
                  <p className="font-bold text-slate-900">Joined by 2,400+</p>
                  <p className="text-slate-500">Leaders & Professionals</p>
                </div>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1, delay: 0.2 }}
            className="relative lg:ml-auto"
          >
            {/* Premium Visual: Lead Magnet Preview */}
            <div className="relative z-10">
              <div className="relative bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden transform rotate-2 hover:rotate-0 transition-transform duration-500">
                <img 
                  src="https://images.unsplash.com/photo-1639322537228-f710d846310a?auto=format&fit=crop&q=80&w=1200" 
                  alt="AI Strategy Playbook" 
                  className="w-full h-full object-cover aspect-[3/4]"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 via-slate-900/20 to-transparent flex flex-col justify-end p-10">
                  <div className="bg-blue-600 text-white text-[10px] font-bold uppercase tracking-widest w-fit px-3 py-1 rounded-full mb-4">
                    Playbook 2026
                  </div>
                  <h3 className="text-2xl font-bold text-white mb-2">The AI Executive Playbook</h3>
                  <p className="text-slate-300 text-sm">From Confusion to Execution in 30 Days</p>
                </div>
              </div>
              
              {/* Decorative elements */}
              <div className="absolute -top-10 -right-10 w-40 h-40 bg-amber-400/10 rounded-full blur-2xl -z-10" />
              <div className="absolute -bottom-10 -left-10 w-60 h-60 bg-blue-600/10 rounded-full blur-3xl -z-10" />
              
              {/* Floating Badge */}
              <div className="absolute -bottom-6 -right-6 z-20 bg-white p-5 rounded-2xl shadow-2xl border border-slate-100 animate-bounce-subtle">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-green-50 rounded-xl flex items-center justify-center text-green-600">
                    <CheckCircle2 className="w-7 h-7" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-900">Updated for 2026</p>
                    <p className="text-xs text-slate-500">Latest AI Frameworks</p>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      <LeadMagnetModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
      />
    </section>
  );
};
