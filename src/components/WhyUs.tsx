import React from 'react';
import { Lightbulb, Target, TrendingUp, ShieldCheck, Zap } from 'lucide-react';

export const WhyUs = () => {
  const values = [
    {
      icon: <Target className="w-8 h-8" />,
      title: "Practical, Business-Focused",
      description: "We skip the hype and focus on what actually drives revenue, efficiency, and competitive advantage."
    },
    {
      icon: <Zap className="w-8 h-8" />,
      title: "Executive-Level Clarity",
      description: "Complex concepts explained with strategic clarity, tailored for decision-makers, not developers."
    },
    {
      icon: <TrendingUp className="w-8 h-8" />,
      title: "Real-World Use Cases",
      description: "Learn from successful (and failed) AI implementations across diverse industries and sectors."
    },
    {
      icon: <Lightbulb className="w-8 h-8" />,
      title: "Strategic Insights",
      description: "Go beyond tools to understand the fundamental shifts in business models and market dynamics."
    },
    {
      icon: <ShieldCheck className="w-8 h-8" />,
      title: "Responsible AI Focus",
      description: "Deep dive into ethics, governance, and risk management to ensure sustainable AI adoption."
    }
  ];

  return (
    <section className="py-24 bg-blue-900 text-white overflow-hidden relative">
      {/* Decorative Elements */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl" />
      <div className="absolute bottom-0 left-0 w-64 h-64 bg-amber-500/10 rounded-full translate-y-1/2 -translate-x-1/2 blur-3xl" />

      <div className="max-w-7xl mx-auto px-6 relative z-10">
        <div className="grid lg:grid-cols-3 gap-16 items-start">
          <div className="lg:col-span-1">
            <h2 className="text-sm font-bold text-amber-500 uppercase tracking-[0.2em] mb-4">Why Choose Us</h2>
            <h3 className="text-3xl md:text-4xl font-bold mb-6 leading-tight">
              The Academy for <span className="text-amber-500">Strategic</span> AI Leadership
            </h3>
            <p className="text-blue-100 text-lg mb-8 leading-relaxed">
              We provide the framework, network, and insights necessary for leaders to navigate the most significant technological shift of our time.
            </p>
            <div className="p-6 bg-white/10 backdrop-blur-sm rounded-2xl border border-white/10">
              <p className="text-3xl font-bold text-amber-500 mb-1">15+</p>
              <p className="text-sm text-blue-200 uppercase tracking-wider font-semibold">Years of Experience</p>
            </div>
          </div>

          <div className="lg:col-span-2 grid sm:grid-cols-2 gap-8">
            {values.map((value, index) => (
              <div key={index} className="p-8 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors group">
                <div className="text-amber-500 mb-6 group-hover:scale-110 transition-transform duration-300">
                  {value.icon}
                </div>
                <h4 className="text-xl font-bold mb-3">{value.title}</h4>
                <p className="text-blue-100/70 text-sm leading-relaxed">
                  {value.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};
