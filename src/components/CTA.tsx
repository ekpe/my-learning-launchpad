import React from 'react';
import { Button } from './ui/Button';
import { ArrowRight, Mail } from 'lucide-react';

export const CTA = () => {
  return (
    <section className="py-20 relative overflow-hidden">
      <div className="absolute inset-0 bg-blue-900 -z-10" />
      <div className="absolute top-0 left-0 w-full h-full opacity-10 -z-10">
        <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-l from-amber-500 to-transparent" />
      </div>

      <div className="max-w-5xl mx-auto px-6 text-center">
        <h2 className="text-3xl md:text-5xl font-bold text-white mb-8 leading-tight">
          Ready to Lead Your Organization Through the <span className="text-amber-500">AI Revolution?</span>
        </h2>
        <p className="text-xl text-blue-100 mb-10 max-w-2xl mx-auto">
          Join a cohort of forward-thinking executives and master the strategic implementation of Artificial Intelligence.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button size="lg" variant="secondary" className="rounded-full px-10 font-bold">
            Register Interest
            <ArrowRight className="ml-2 w-5 h-5" />
          </Button>
          <Button size="lg" variant="outline" className="rounded-full px-10 border-white text-white hover:bg-white hover:text-blue-900">
            Request Corporate Training
          </Button>
        </div>
      </div>
    </section>
  );
};
