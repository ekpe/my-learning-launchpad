import { db, auth } from '../firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import ReactGA from 'react-ga4';

const GA_MEASUREMENT_ID = import.meta.env.VITE_GA_MEASUREMENT_ID || 'G-TELQCXJMCC';

// Initialize GA if ID is provided
if (GA_MEASUREMENT_ID) {
  ReactGA.initialize(GA_MEASUREMENT_ID);
}

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

    // 1. Log to Google Analytics if configured
    if (GA_MEASUREMENT_ID) {
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
          ...metadata
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
