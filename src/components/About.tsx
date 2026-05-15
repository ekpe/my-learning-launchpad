import React from 'react';
import { motion } from 'motion/react';
import { CheckCircle2 } from 'lucide-react';

export const About = () => {
  return (
    <section id="about" className="py-24 bg-slate-50">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          <div className="order-2 lg:order-1">
            <div className="relative">
              <div className="absolute -top-4 -left-4 w-24 h-24 bg-blue-900/10 rounded-full -z-10" />
              <div className="rounded-2xl overflow-hidden shadow-xl aspect-square lg:aspect-[4/5]">
                <img 
                  src="/images/prof_ekpe_okorafor.jpg" 
                  alt="Prof. Ekpe Okorafor" 
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              </div>
              <div className="relative lg:absolute mt-8 lg:mt-0 lg:-bottom-8 lg:-right-8 bg-white p-6 rounded-2xl shadow-xl border border-slate-100 max-w-[280px] lg:max-w-[240px] mx-auto lg:mx-0">
                <p className="text-slate-600 text-sm italic mb-4">
                  "AI is not just a technology shift; it's a fundamental change in how we create value and lead organizations."
                </p>
                <p className="font-bold text-slate-900">Prof. Ekpe Okorafor</p>
                <p className="text-xs text-slate-500 uppercase tracking-wider">Founder & Lead Instructor</p>
              </div>
            </div>
          </div>

          <div className="order-1 lg:order-2">
            <h2 className="text-sm font-bold text-blue-900 uppercase tracking-[0.2em] mb-4">About My Learning Launchpad</h2>
            <h3 className="text-3xl md:text-4xl font-bold text-slate-900 mb-6">
              Bridging the Gap Between <span className="text-blue-900">AI Potential</span> and Business Reality
            </h3>
            <p className="text-lg text-slate-600 mb-6 leading-relaxed">
              Founded by industry veterans and AI strategists, our academy focuses exclusively on the executive perspective. We don't teach you how to code; we teach you how to lead, strategize, and transform.
            </p>
            <p className="text-slate-600 mb-8 leading-relaxed">
              Our curriculum is designed for busy professionals who need high-impact insights without the technical jargon. We focus on real-world impact, ethical considerations, and strategic competitive advantage.
            </p>

            <ul className="space-y-4">
              {[
                "Strategic AI Frameworks for Decision Making",
                "Executive-Level Clarity on Emerging Tech",
                "Focus on ROI and Business Value Creation",
                "Global Network of AI-Ready Leaders"
              ].map((item, i) => (
                <li key={i} className="flex items-start gap-3">
                  <CheckCircle2 className="w-6 h-6 text-amber-500 shrink-0" />
                  <span className="text-slate-700 font-medium">{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
};
