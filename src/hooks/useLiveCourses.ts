import { useEffect, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import type { Course } from '../types';

export { resolveCourse, publicStaticCourses } from '../lib/liveCourse';

/** All live course records keyed by id (one listener), for screens that list several courses. */
export function useLiveCourseMap(): { liveById: Map<string, Course>; ready: boolean } {
  const [liveById, setLiveById] = useState<Map<string, Course>>(new Map());
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, 'courses'),
      (snap) => {
        setLiveById(new Map(snap.docs.map((d) => [d.id, d.data() as Course])));
        setReady(true);
      },
      (err) => {
        console.error('Error fetching courses:', err);
        setReady(true);
      },
    );
    return () => unsub();
  }, []);

  return { liveById, ready };
}
