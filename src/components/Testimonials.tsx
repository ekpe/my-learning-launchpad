import React from 'react';
import { Quote } from 'lucide-react';

export const Testimonials = () => {
  const testimonials = [
    {
      quote: "The strategic clarity I gained from this course was transformative. I now have a clear roadmap for AI implementation that aligns perfectly with our 5-year vision.",
      name: "Sarah Jenkins",
      role: "COO, Global Logistics Corp",
      image: "https://picsum.photos/seed/sarah/100/100"
    },
    {
      quote: "Finally, an AI program that speaks the language of business. No technical fluff—just high-impact strategic insights that we could put to work immediately.",
      name: "David Miller",
      role: "VP of Strategy, FinTech Solutions",
      image: "https://picsum.photos/seed/david/100/100"
    },
    {
      quote: "As a government leader, the focus on responsible AI and governance was invaluable. This course is essential for anyone in the public sector.",
      name: "Elena Rodriguez",
      role: "Director of Innovation, City Council",
      image: "https://picsum.photos/seed/elena/100/100"
    }
  ];

  return (
    <section className="py-24 bg-slate-50">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-16">
          <h2 className="text-sm font-bold text-blue-900 uppercase tracking-[0.2em] mb-4">Testimonials</h2>
          <h3 className="text-3xl md:text-4xl font-bold text-slate-900">
            Trusted by <span className="text-blue-900">Global Leaders</span>
          </h3>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {testimonials.map((t, i) => (
            <div key={i} className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100 flex flex-col">
              <Quote className="w-10 h-10 text-amber-500/20 mb-6" />
              <p className="text-slate-600 italic mb-8 flex-grow leading-relaxed">
                "{t.quote}"
              </p>
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full overflow-hidden bg-slate-200">
                  <img src={t.image} alt={t.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                </div>
                <div>
                  <p className="font-bold text-slate-900">{t.name}</p>
                  <p className="text-xs text-slate-500">{t.role}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
