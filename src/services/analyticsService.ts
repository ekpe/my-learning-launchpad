import { db, auth } from '../firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import ReactGA from 'react-ga4';
import { hasAnalyticsConsent, onConsentChange } from './consent';

const GA_MEASUREMENT_ID = import.meta.env.VITE_GA_MEASUREMENT_ID || 'G-TELQCXJMCC';

// Google Analytics only runs after the visitor accepts analytics (see ConsentBanner).
let gaReady = false;

const setGaDisabled = (disabled: boolean) => {
  (window as any)[`ga-disable-${GA_MEASUREMENT_ID}`] = disabled;
};

const clearGaCookies = () => {
  document.cookie.split(';').forEach((c) => {
    const name = c.split('=')[0].trim();
    if (name === '_ga' || name.startsWith('_ga_')) {
      document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
    }
  });
};

const syncGaWithConsent = () => {
  if (!GA_MEASUREMENT_ID) return;
  if (hasAnalyticsConsent()) {
    setGaDisabled(false);
    if (!gaReady) {
      ReactGA.initialize(GA_MEASUREMENT_ID);
      gaReady = true;
    }
  } else {
    setGaDisabled(true);
    if (gaReady) clearGaCookies();
  }
};

if (typeof window !== 'undefined') {
  syncGaWithConsent();
  onConsentChange(syncGaWithConsent);
}

/** Sends a GA4 event only when the visitor has consented. Returns whether it was sent. */
export const sendGaEvent = (name: string, params: Record<string, string | number | boolean | undefined> = {}): boolean => {
  if (!gaReady || !hasAnalyticsConsent()) return false;
  const clean = Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined));
  ReactGA.event(name, clean);
  return true;
};

export enum AnalyticsEvent {
  PAGE_VIEW = 'page_view',
  COURSE_ENROLLMENT = 'course_enrollment',
  LESSON_START = 'lesson_start',
  LESSON_COMPLETE = 'lesson_complete',
  QUIZ_COMPLETE = 'quiz_complete',
  VIDEO_PLAY = 'video_play',
  VIDEO_PAUSE = 'video_pause',
  VIDEO_COMPLETE = 'video_complete',
  LEAD_CAPTURE = 'lead_capture',
}

interface AnalyticsData {
  event: AnalyticsEvent;
  userId?: string;
  userEmail?: string;
  timestamp: any;
  metadata?: Record<string, any>;
}

const stripUndefined = (obj: any): any => {
  if (Array.isArray(obj)) {
    return obj.map(stripUndefined);
  } else if (obj !== null && typeof obj === 'object') {
    return Object.entries(obj).reduce((acc: any, [key, value]) => {
      if (value !== undefined) {
        acc[key] = stripUndefined(value);
      }
      return acc;
    }, {});
  }
  return obj;
};

export const logEvent = async (event: AnalyticsEvent, metadata?: Record<string, any>) => {
  try {
    const user = auth.currentUser;
    const analyticsData: any = {
      event,
      timestamp: serverTimestamp(),
    };

    if (metadata) {
      analyticsData.metadata = metadata;
    }

    if (user?.uid) {
      analyticsData.userId = user.uid;
    }

    if (user?.email) {
      analyticsData.userEmail = user.email;
    }

    const cleanData = stripUndefined(analyticsData);
    console.log('Logging analytics event:', event, cleanData);

    // 1. Log to Google Analytics — only with consent, and never with email addresses
    if (GA_MEASUREMENT_ID && gaReady && hasAnalyticsConsent()) {
      const { email: _email, userEmail: _userEmail, ...gaMetadata } = metadata ?? {};
      if (event === AnalyticsEvent.PAGE_VIEW) {
        ReactGA.send({
          hitType: 'pageview',
          page: metadata?.path || window.location.pathname + window.location.search
        });
      } else {
        ReactGA.event({
          category: 'User Interaction',
          action: event,
          label: metadata?.courseId || metadata?.lessonId || undefined,
          value: metadata?.progress || undefined,
          ...gaMetadata
        });
      }
    }

    // 2. Log to Firestore
    await addDoc(collection(db, 'analytics'), cleanData);
  } catch (error: any) {
    console.error('Error logging analytics event:', event, error);
    if (error.code === 'permission-denied') {
      console.error('Permission denied for analytics event. Current user:', auth.currentUser?.uid);
    }
  }
};
