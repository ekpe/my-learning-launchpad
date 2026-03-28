export type UserRole = 'ADMIN' | 'INSTRUCTOR' | 'STUDENT';

export interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  role: UserRole;
  createdAt: any; // Using any for simplicity with Firestore Timestamp
}

export interface Course {
  id: string;
  title: string;
  description: string;
  duration: string;
  audience: string;
  image: string;
  isFree?: boolean;
  price?: number;
  fullDescription?: string;
  learningObjectives?: string[];
  curriculum?: {
    module: string;
    topics: {
      title: string;
      videoUrl?: string;
      description?: string;
    }[];
    quiz?: {
      id: string;
      title: string;
      questions: {
        id: string;
        question: string;
        options: string[];
        correctAnswer: number;
      }[];
    };
  }[];
  assignment?: {
    title: string;
    description: string;
    format: string;
  };
}

export interface Enrollment {
  userId: string;
  courseId: string;
  status: 'ENROLLED' | 'IN_PROGRESS' | 'COMPLETED';
  enrolledAt: any;
  progress: number;
  completedLessons?: string[];
}
