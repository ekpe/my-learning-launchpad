import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Button } from './ui/Button';
import { Clock, Users, ArrowRight, Loader2, MonitorPlay } from 'lucide-react';
import { motion } from 'motion/react';
import { courses as staticCourses } from '../data/courses';
import { db } from '../firebase';
import { collection, onSnapshot } from 'firebase/firestore';
import { Course } from '../types';

interface CourseCardProps {
  id: string;
  title: string;
  description: string;
  duration: string;
  format?: string;
  audience: string;
  image: string;
  isFree?: boolean;
  featured?: boolean;
}

const CourseCard: React.FC<CourseCardProps> = ({ id, title, description, duration, format, audience, image, isFree, featured }) => {
  return (
    <motion.div 
      whileHover={{ y: -5 }}
      className={`bg-white rounded-2xl overflow-hidden border border-slate-200 shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col ${featured ? 'md:flex-row' : 'h-full'} relative`}
    >
      {isFree && (
        <div className="absolute top-4 right-4 z-10 bg-green-600 text-white px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider shadow-lg">
          Free Course
        </div>
      )}
      <div className={`${featured ? 'md:w-2/5 h-64 md:h-auto' : 'h-48'} overflow-hidden relative`}>
        <img 
          src={image} 
          alt={title} 
          className="w-full h-full object-cover transition-transform duration-500 hover:scale-110"
          referrerPolicy="no-referrer"
        />
        <div className="absolute top-4 left-4 bg-white/90 backdrop-blur-sm px-3 py-1 rounded-full text-[10px] font-bold text-blue-900 uppercase tracking-wider">
          Executive Track
        </div>
      </div>
      <div className={`p-6 flex flex-col flex-grow ${featured ? 'md:p-10 md:w-3/5' : ''}`}>
        <h4 className={`${featured ? 'text-2xl md:text-3xl' : 'text-xl'} font-bold text-slate-900 mb-3 leading-tight`}>{title}</h4>
        <p className="text-slate-600 text-sm mb-6 line-clamp-3 flex-grow">{description}</p>
        
        <div className={`grid ${featured ? 'grid-cols-2 gap-4' : 'space-y-3'} mb-6`}>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Clock className="w-4 h-4 text-blue-900" />
            <span>{duration}</span>
          </div>
          {format && (
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <MonitorPlay className="w-4 h-4 text-blue-900" />
              <span>{format}</span>
            </div>
          )}
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Users className="w-4 h-4 text-blue-900" />
            <span>{audience}</span>
          </div>
        </div>
        
        <Link to={`/course/${id}`} className="mt-auto">
          <Button variant="outline" className={`${featured ? 'w-auto px-8' : 'w-full'} group`}>
            {isFree ? 'Enroll Now' : 'View Details'}
            <ArrowRight className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </Button>
        </Link>
      </div>
    </motion.div>
  );
};

export const Courses = () => {
  const [displayCourses, setDisplayCourses] = useState<Course[]>(() => {
    return [...staticCourses].sort((a, b) => {
      const aFree = !!a.isFree;
      const bFree = !!b.isFree;
      if (aFree && !bFree) return -1;
      if (!aFree && bFree) return 1;
      return (a.order || 0) - (b.order || 0);
    });
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'courses'), (snapshot) => {
      let finalCourses = [...staticCourses];
      
      if (!snapshot.empty) {
        const dbCourses = snapshot.docs.map(doc => doc.data() as Course);
        
        // Create a map of DB courses by ID for easy lookup
        const dbMap = new Map(dbCourses.map(c => [c.id, c]));
        
        // Merge: DB courses override static ones if IDs match
        // Also include DB courses that aren't in static
        const mergedIds = new Set([...finalCourses.map(c => c.id), ...dbCourses.map(c => c.id)]);
        
        finalCourses = Array.from(mergedIds).map(id => {
          const dbCourse = dbMap.get(id);
          const staticCourse = staticCourses.find(c => c.id === id);
          
          if (dbCourse && staticCourse) {
            // Merge: prefer static for order and isFree to ensure layout intent
            return {
              ...dbCourse,
              order: staticCourse.order,
              isFree: staticCourse.isFree
            };
          }
          
          if (dbCourse) {
            // For courses only in DB, ensure they have a high order so they don't displace static ones
            return {
              ...dbCourse,
              order: (dbCourse.order && dbCourse.order > 10) ? dbCourse.order : 100,
              isFree: !!dbCourse.isFree
            };
          }
          
          return staticCourse!;
        });
      }

      // Sort: free courses first, then by order
      const sorted = finalCourses.sort((a, b) => {
        const aFree = !!a.isFree;
        const bFree = !!b.isFree;
        if (aFree && !bFree) return -1;
        if (!aFree && bFree) return 1;
        return (a.order || 0) - (b.order || 0);
      });
      
      console.log('Courses sorted for display:', sorted.map(c => ({ id: c.id, order: c.order, isFree: c.isFree })));
      setDisplayCourses(sorted);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching courses:", error);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  return (
    <section id="courses" className="py-24 bg-white">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-sm font-bold text-blue-900 uppercase tracking-[0.2em] mb-4">Curriculum</h2>
          <h3 className="text-3xl md:text-4xl font-bold text-slate-900 mb-6">
            Strategic Programs for <span className="text-blue-900">Modern Leadership</span>
          </h3>
          <p className="text-lg text-slate-600">
            Select from our range of specialized courses designed to provide immediate value and long-term strategic advantage.
          </p>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-8 h-8 text-blue-900 animate-spin" />
          </div>
        ) : (
          <div className="max-w-5xl mx-auto space-y-8">
            {/* Top Course - Full Width */}
            {displayCourses.length > 0 && (
              <div className="w-full">
                <CourseCard 
                  id={displayCourses[0].id}
                  title={displayCourses[0].title}
                  description={displayCourses[0].description}
                  duration={displayCourses[0].duration}
                  format={displayCourses[0].format}
                  audience={displayCourses[0].audience}
                  image={displayCourses[0].image}
                  isFree={displayCourses[0].isFree}
                  featured={true}
                />
              </div>
            )}

            {/* Remaining Courses - 2 Column Grid */}
            <div className="grid md:grid-cols-2 gap-8">
              {displayCourses.slice(1).map((course) => (
                <CourseCard 
                  key={course.id} 
                  id={course.id}
                  title={course.title}
                  description={course.description}
                  duration={course.duration}
                  format={course.format}
                  audience={course.audience}
                  image={course.image}
                  isFree={course.isFree}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
};
