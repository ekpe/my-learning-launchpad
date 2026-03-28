import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Button } from './ui/Button';
import { Menu, X, Rocket, User as UserIcon, LogOut } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { useAuth } from '../contexts/AuthContext';
import { auth } from '../firebase';
import { signOut } from 'firebase/auth';
import { AuthModal } from './AuthModal';

export const Navbar = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const { user, profile } = useAuth();

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleSignOut = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const navLinks = [
    { name: 'Home', href: '/' },
    { name: 'Courses', href: '/#courses' },
    { name: 'About', href: '/#about' },
    { name: 'Contact', href: '/#contact' },
  ];

  return (
    <>
      <nav
        className={cn(
          'fixed top-0 left-0 right-0 z-50 transition-all duration-300 px-6 py-4',
          isScrolled ? 'bg-white/90 backdrop-blur-md shadow-sm py-3' : 'bg-transparent'
        )}
      >
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-10 h-10 bg-blue-900 rounded-lg flex items-center justify-center shadow-lg shadow-blue-900/20">
              <Rocket className="text-white w-6 h-6" />
            </div>
            <span className={cn(
              "text-xl font-bold tracking-tight",
              isScrolled ? "text-blue-900" : "text-blue-900"
            )}>
              MY LEARNING<span className="text-amber-600 ml-1">LAUNCHPAD</span>
            </span>
          </Link>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-8">
            {navLinks.map((link) => (
              <a
                key={link.name}
                href={link.href}
                className="text-sm font-medium text-slate-600 hover:text-blue-900 transition-colors"
              >
                {link.name}
              </a>
            ))}

            {user && (
              <Link
                to="/dashboard"
                className="text-sm font-medium text-slate-600 hover:text-blue-900 transition-colors"
              >
                Dashboard
              </Link>
            )}

            {(profile?.role === 'ADMIN' || profile?.role === 'INSTRUCTOR') && (
              <Link
                to="/instructor"
                className="text-sm font-medium text-slate-600 hover:text-blue-900 transition-colors"
              >
                Instructor
              </Link>
            )}

            {profile?.role === 'ADMIN' && (
              <Link
                to="/admin"
                className="text-sm font-medium text-slate-600 hover:text-blue-900 transition-colors"
              >
                Admin
              </Link>
            )}
            
            {user ? (
              <div className="flex items-center gap-4 pl-4 border-l border-slate-200">
                <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
                  <div className="w-8 h-8 bg-blue-50 rounded-full flex items-center justify-center text-blue-900">
                    <UserIcon className="w-4 h-4" />
                  </div>
                  <span className="max-w-[120px] truncate">{user.displayName || user.email}</span>
                </div>
                <button 
                  onClick={handleSignOut}
                  className="text-slate-400 hover:text-red-500 transition-colors"
                  title="Sign Out"
                >
                  <LogOut className="w-5 h-5" />
                </button>
              </div>
            ) : (
              <Button 
                variant="default" 
                size="sm" 
                className="rounded-full px-6"
                onClick={() => setIsAuthModalOpen(true)}
              >
                Sign In
              </Button>
            )}
          </div>

          {/* Mobile Menu Toggle */}
          <button
            className="md:hidden text-blue-900"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          >
            {isMobileMenuOpen ? <X /> : <Menu />}
          </button>
        </div>

        {/* Mobile Nav */}
        {isMobileMenuOpen && (
          <div className="md:hidden absolute top-full left-0 right-0 bg-white shadow-lg border-t border-slate-100 p-6 flex flex-col gap-4 animate-in fade-in slide-in-from-top-5">
            {navLinks.map((link) => (
              <a
                key={link.name}
                href={link.href}
                className="text-base font-medium text-slate-600"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                {link.name}
              </a>
            ))}

            {user && (
              <Link
                to="/dashboard"
                className="text-base font-medium text-slate-600"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                Dashboard
              </Link>
            )}

            {(profile?.role === 'ADMIN' || profile?.role === 'INSTRUCTOR') && (
              <Link
                to="/instructor"
                className="text-base font-medium text-slate-600"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                Instructor
              </Link>
            )}

            {profile?.role === 'ADMIN' && (
              <Link
                to="/admin"
                className="text-base font-medium text-slate-600"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                Admin
              </Link>
            )}
            {user ? (
              <div className="flex flex-col gap-4 pt-4 border-t border-slate-100">
                <div className="flex items-center gap-3 text-slate-900 font-bold">
                  <UserIcon className="w-5 h-5" />
                  <span>{user.displayName || user.email}</span>
                </div>
                <Button variant="outline" onClick={handleSignOut} className="w-full">
                  Sign Out
                </Button>
              </div>
            ) : (
              <Button 
                variant="default" 
                className="w-full"
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  setIsAuthModalOpen(true);
                }}
              >
                Sign In
              </Button>
            )}
          </div>
        )}
      </nav>

      <AuthModal 
        isOpen={isAuthModalOpen} 
        onClose={() => setIsAuthModalOpen(false)} 
      />
    </>
  );
};
