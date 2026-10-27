import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Button } from './ui/Button';
import { Menu, X, Rocket, User as UserIcon, LogOut, ArrowRight } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { useAuth } from '../contexts/AuthContext';
import { auth } from '../firebase';
import { signOut } from 'firebase/auth';
import { AuthModal } from './AuthModal';
import { useWebinarConfig } from '../hooks/useWebinarConfig';
import { ANNOUNCEMENT_HREF, NAV_HREF, announcementFor, showsAnnouncementOn } from '../lib/webinarAnnouncement';

const DISMISS_KEY = 'mll_webinar_bar_dismissed';
const wasDismissed = () => {
  try {
    return sessionStorage.getItem(DISMISS_KEY) === '1';
  } catch {
    return false;
  }
};

export const Navbar = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const { user, profile } = useAuth();
  const { pathname } = useLocation();
  const onDarkHero = pathname === '/webinar';

  // Announce the webinar only while it is real (see webinarAnnouncement.ts). Dismissal lasts for this tab session.
  const webinar = useWebinarConfig();
  const announcement = announcementFor(webinar.config);
  const [barDismissed, setBarDismissed] = useState(wasDismissed);
  const barVisible = !!announcement && !barDismissed && showsAnnouncementOn(pathname);
  const dismissBar = () => {
    setBarDismissed(true);
    try {
      sessionStorage.setItem(DISMISS_KEY, '1');
    } catch {
      /* private mode: the bar simply reappears next visit */
    }
  };

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

  const navLinks: { name: string; href: string; highlight?: boolean }[] = [
    { name: 'Home', href: '/' },
    { name: 'Courses', href: '/#courses' },
    ...(announcement ? [{ name: 'Free Webinar', href: NAV_HREF, highlight: true }] : []),
    { name: 'About', href: '/#about' },
    { name: 'Contact', href: '/#contact' },
  ];

  return (
    <>
      {barVisible && announcement && (
        <div
          className="fixed top-0 left-0 right-0 z-[60] flex h-9 items-center justify-center gap-3 bg-navy-900 px-10 text-xs text-white sm:text-sm"
          role="region"
          aria-label="Webinar announcement"
          data-testid="webinar-announcement"
        >
          <Link to={ANNOUNCEMENT_HREF} className="flex min-w-0 items-center gap-2 font-medium hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
            <span className="shrink-0 rounded bg-gold-500 px-1.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-navy-950">Free webinar</span>
            <span className="min-w-0 truncate">
              {announcement.mode === 'open' ? announcement.when : 'Date coming soon'}
              <span className="hidden md:inline"> · {announcement.title}</span>
            </span>
            <span className="flex shrink-0 items-center gap-1 font-bold text-gold-400">
              {announcement.mode === 'open' ? 'Register free' : 'Join the waitlist'} <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </span>
          </Link>
          <button
            type="button"
            onClick={dismissBar}
            aria-label="Dismiss webinar announcement"
            className="absolute right-3 rounded p-1 text-slate-300 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      )}
      <nav
        className={cn(
          'fixed left-0 right-0 z-50 transition-all duration-300 px-6 py-4',
          barVisible ? 'top-9' : 'top-0',
          isScrolled || onDarkHero ? 'bg-cream/95 backdrop-blur-md shadow-sm py-3' : 'bg-transparent'
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
              MY LEARNING<span className={cn('ml-1', onDarkHero ? 'text-amber-700' : 'text-amber-600')}>LAUNCHPAD</span>
              {onDarkHero && (
                <span className="block text-[10px] font-semibold uppercase tracking-[0.28em] text-slate-600">AI Leadership Academy</span>
              )}
            </span>
          </Link>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-8">
            {navLinks.map((link) => (
              <Link
                key={link.name}
                to={link.href}
                className={cn('text-sm font-medium transition-colors', link.highlight ? 'font-bold text-amber-700 hover:text-amber-800' : 'text-slate-600 hover:text-blue-900')}
              >
                {link.name}
              </Link>
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
            aria-label={isMobileMenuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={isMobileMenuOpen}
          >
            {isMobileMenuOpen ? <X /> : <Menu />}
          </button>
        </div>

        {/* Mobile Nav */}
        {isMobileMenuOpen && (
          <div className="md:hidden absolute top-full left-0 right-0 bg-white shadow-lg border-t border-slate-100 p-6 flex flex-col gap-4 animate-in fade-in slide-in-from-top-5">
            {navLinks.map((link) => (
              <Link
                key={link.name}
                to={link.href}
                className={cn('text-base font-medium', link.highlight ? 'font-bold text-amber-700' : 'text-slate-600')}
                onClick={() => setIsMobileMenuOpen(false)}
              >
                {link.name}
              </Link>
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
