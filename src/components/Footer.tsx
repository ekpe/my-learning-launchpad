import React from 'react';
import { Link } from 'react-router-dom';
import { Linkedin, Twitter, Facebook, Instagram, Rocket } from 'lucide-react';
import { courses } from '../data/courses';

export const Footer = () => {
  return (
    <footer className="bg-slate-900 text-slate-300 py-16">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-12 mb-12">
          <div className="lg:col-span-1">
            <Link to="/" className="flex items-center gap-2 mb-6">
              <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center shadow-lg shadow-blue-600/20">
                <Rocket className="text-white w-6 h-6" />
              </div>
              <span className="text-xl font-bold tracking-tight text-white">
                MY LEARNING<span className="text-amber-500 ml-1">LAUNCHPAD</span>
              </span>
            </Link>
            <p className="text-sm leading-relaxed mb-6">
              Empowering global leaders to master the strategic implementation of Artificial Intelligence for business transformation and sustainable growth.
            </p>
            <div className="flex gap-4">
              <a href="#" className="hover:text-amber-500 transition-colors"><Linkedin className="w-5 h-5" /></a>
              <a href="#" className="hover:text-amber-500 transition-colors"><Twitter className="w-5 h-5" /></a>
              <a href="#" className="hover:text-amber-500 transition-colors"><Facebook className="w-5 h-5" /></a>
              <a href="#" className="hover:text-amber-500 transition-colors"><Instagram className="w-5 h-5" /></a>
            </div>
          </div>

          <div>
            <h4 className="text-white font-bold mb-6">Quick Links</h4>
            <ul className="space-y-4 text-sm">
              <li><Link to="/" className="hover:text-amber-500 transition-colors">Home</Link></li>
              <li><a href="/#courses" className="hover:text-amber-500 transition-colors">Courses</a></li>
              <li><a href="/#about" className="hover:text-amber-500 transition-colors">About Us</a></li>
              <li><a href="/#contact" className="hover:text-amber-500 transition-colors">Contact</a></li>
            </ul>
          </div>

          <div>
            <h4 className="text-white font-bold mb-6">Programs</h4>
            <ul className="space-y-4 text-sm">
              {courses.map(course => (
                <li key={course.id}>
                  <Link to={`/course/${course.id}`} className="hover:text-amber-500 transition-colors">
                    {course.title.split(':')[0]}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="text-white font-bold mb-6">Newsletter</h4>
            <p className="text-sm mb-4">Stay updated with the latest in AI strategy and executive education.</p>
            <div className="flex gap-2">
              <input 
                type="email" 
                placeholder="Email address" 
                className="bg-slate-800 border-none rounded-lg px-4 py-2 text-sm w-full focus:ring-1 focus:ring-amber-500 outline-none"
              />
              <button className="bg-amber-500 text-slate-900 px-4 py-2 rounded-lg font-bold text-sm hover:bg-amber-600 transition-colors">
                Join
              </button>
            </div>
          </div>
        </div>

        <div className="pt-8 border-t border-slate-800 flex flex-col md:flex-row justify-between items-center gap-4 text-xs">
          <p>© 2026 My Learning Launchpad. All rights reserved.</p>
          <div className="flex gap-6">
            <a href="#" className="hover:text-white transition-colors">Privacy Policy</a>
            <a href="#" className="hover:text-white transition-colors">Terms of Service</a>
            <a href="#" className="hover:text-white transition-colors">Cookie Policy</a>
          </div>
        </div>
      </div>
    </footer>
  );
};
