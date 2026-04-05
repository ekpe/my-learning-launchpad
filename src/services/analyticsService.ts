import { db, auth } from '../firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

export enum AnalyticsEvent {
  PAGE_VIEW = 'page_view',
  COURSE_ENROLLMENT = 'course_enrollment',
  LESSON_START = 'lesson_start',
  LESSON_COMPLETE = 'lesson_complete',
  QUIZ_COMPLETE = 'quiz_complete',
  VIDEO_PLAY = 'video_play',
  VIDEO_PAUSE = 'video_pause',
  VIDEO_COMPLETE = 'video_complete',
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
    await addDoc(collection(db, 'analytics'), cleanData);
  } catch (error) {
    console.error('Error logging analytics event:', error);
  }
};
