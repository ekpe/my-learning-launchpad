export type UserRole = 'ADMIN' | 'INSTRUCTOR' | 'STUDENT';

export interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  role: UserRole;
  createdAt: any; // Using any for simplicity with Firestore Timestamp
}

/** A lesson or learner activity inside a module. All new fields are optional so older courses keep working unchanged. */
export interface CurriculumTopic {
  /** Stable identifier (e.g. "m1-l1"). Progress is still stored by position; this is what migrations map between versions. */
  id?: string;
  title: string;
  videoUrl?: string;
  materialUrl?: string;
  description?: string;
  /** 'activity' = a learner activity (counts as activity time, not video time). Default 'lesson'. */
  kind?: 'lesson' | 'activity';
  /** Planned duration in minutes. A design target until the recording/activity is validated. */
  plannedMinutes?: number;
  /** Optional enrichment. Never counts toward required completion or the advertised duration. */
  optional?: boolean;
  /** For activities that feed a cumulative artifact: what the learner produces here. */
  output?: string;
  /** Admin-controlled production state. 'ready' is never stored: it is derived from a valid media URL. */
  productionStatus?: 'planned' | 'in-production' | 'published';
}

export interface CurriculumModule {
  module: string;
  /** Short phase label shown next to the module number, e.g. "Understand". */
  phase?: string;
  topics: CurriculumTopic[];
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
}

export interface CourseResource {
  title: string;
  description?: string;
  /** Only published when an actual asset exists. */
  url?: string;
  available: boolean;
}

export interface Course {
  id: string;
  title: string;
  /** Shown under the title, e.g. "From Generative AI to the Agentic Enterprise". */
  subtitle?: string;
  description: string;
  /** Optional shorter copy for course cards; falls back to description. */
  cardDescription?: string;
  duration: string;
  format?: string;
  audience: string;
  image: string;
  isFree?: boolean;
  price?: number;
  order?: number;
  /** Replaces the default "Executive Track" label on cards and the detail page. */
  trackLabel?: string;
  fullDescription?: string;
  learningObjectives?: string[];
  /** Short outcome statements for the "What You'll Achieve" section. */
  outcomes?: string[];
  /** Replaces the default "Course Features" list when present. */
  benefits?: string[];
  /** Version of the curriculum STRUCTURE. Enrollments are stamped with it so progress can be migrated safely. */
  curriculumVersion?: number;
  /** When true, changes reach learners only via draft -> readiness check -> explicit publish (never by a direct sync). */
  launchGate?: boolean;
  /** 'planned' until final recordings/activities are validated against the budget. */
  durationStatus?: 'planned' | 'validated';
  curriculum?: CurriculumModule[];
  /** Deeper material. A resource is shown only when available:true AND it has a url. */
  optionalResources?: CourseResource[];
  /** Course ids suggested after completion. */
  nextStepCourseIds?: string[];
  assignment?: {
    title: string;
    description: string;
    format: string;
    /** Section heading, default "Practical Assignment". */
    heading?: string;
    /** For a cumulative activity: what each module adds. */
    outputs?: { module: string; text: string }[];
  };
}

export interface Enrollment {
  userId: string;
  courseId: string;
  status: 'ENROLLED' | 'IN_PROGRESS' | 'COMPLETED';
  enrolledAt: any;
  progress: number;
  completedLessons?: string[];
  /** Curriculum structure version the progress was recorded against (absent = original, version 1). */
  curriculumVersion?: number;
  /**
   * Separate record for a learner who finished an OLDER curriculum version and later chooses to take the new one.
   * Their original status, progress, completedLessons and certificate are never modified.
   */
  v2Progress?: {
    completedLessons: string[];
    progress: number;
    status: 'IN_PROGRESS' | 'COMPLETED';
    curriculumVersion: number;
    startedAt?: any;
    completedAt?: any;
  };
}
