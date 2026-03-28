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

export const logEvent = async (event: AnalyticsEvent, metadata?: Record<string, any>) => {
  try {
    const user = auth.currentUser;
    const analyticsData: AnalyticsData = {
      event,
      userId: user?.uid,
      userEmail: user?.email || undefined,
      timestamp: serverTimestamp(),
      metadata,
    };

    await addDoc(collection(db, 'analytics'), analyticsData);
  } catch (error) {
    console.error('Error logging analytics event:', error);
  }
};
