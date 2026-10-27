export type UserRole = 'student' | 'teacher' | 'admin';

export type CEFRLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';

export type BloomLevel =
  | 'Remember'
  | 'Understand'
  | 'Apply'
  | 'Analyze'
  | 'Evaluate'
  | 'Create';

export type ActivityFormat = 'text' | 'recording' | 'ai_conversation' | 'uploading';

export type UploadCategory = 'audio' | 'video' | 'document' | 'spreadsheet' | 'presentation' | 'image';

export interface UploadedFileRecord {
  id: string;
  userId: string;
  studentId?: string;
  assignmentId?: string;
  userName: string;
  userRole: UserRole;
  courseId: string;
  lessonId?: string;
  activityId?: string;
  scope: 'teacher_resource' | 'student_submission';
  title: string;
  instructions?: string;
  fileName: string;
  fileType: UploadCategory;
  fileExtension: string; // mp3, mp4, doc, docx, pdf, xls, xlsx, ppt, pptx
  mimeType: string;
  fileSize: number;
  fileUrl: string;
  storagePath: string;
  status: 'submitted' | 'reviewed' | 'pending';
  feedback?: string;
  grade?: number; // 0 - 100
  reviewedBy?: string;
  reviewedByName?: string;
  reviewedAt?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface UserProfile {
  id: string;
  email: string;
  displayName: string;
  photoURL: string | null;
  role: UserRole;
  cefrGoal: CEFRLevel;
  createdAt: string;
  updatedAt?: string;
}

export interface Course {
  id: string;
  teacherId: string;
  teacherName: string;
  title: string;
  description: string;
  cefrLevel: CEFRLevel;
  targetAudience: string;
  learningOutcomes: string;
  prerequisites?: string;
  status: 'draft' | 'published' | 'archived';
  masteryThreshold: number; // default 75
  modulesCount: number;
  lessonsCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface Module {
  id: string;
  courseId: string;
  title: string;
  description: string;
  orderIndex: number;
  createdAt?: string;
}

export interface Topic {
  id: string;
  courseId: string;
  moduleId: string;
  title: string;
  description: string;
  orderIndex: number;
  createdAt?: string;
}

export interface Lesson {
  id: string;
  courseId: string;
  moduleId: string;
  topicId: string;
  title: string;
  description: string;
  targetSpeakingOutcome: string;
  cefrLevel: CEFRLevel;
  bloomLevels: BloomLevel[];
  orderIndex: number;
  requiredMasteryScore: number;
  explanation: string;
  vocabularyNotes: string;
  sampleAnswer: string;
  videoUrl?: string;
  createdAt?: string;
}

export interface Activity {
  id: string;
  courseId: string;
  lessonId: string;
  title: string;
  instructions: string;
  bloomLevel: BloomLevel;
  cefrLevel: CEFRLevel;
  format: ActivityFormat;
  prompt: string;
  expectedResponse?: string;
  maxAttempts: number;
  orderIndex: number;
  allowedFormats?: string[];
  resourceFileIds?: string[];
  createdAt?: string;
}

export interface Enrollment {
  id: string;
  studentId: string;
  courseId: string;
  enrolledAt: string;
  completedLessonsCount: number;
  status: 'active' | 'completed';
  lastAccessedAt: string;
}

export interface LessonProgress {
  id: string; // `${studentId}_${lessonId}`
  studentId: string;
  courseId: string;
  lessonId: string;
  isUnlocked: boolean;
  isCompleted: boolean;
  bestScore: number;
  attemptsCount: number;
  lastAttemptAt?: string;
}

export interface RubricScores {
  scoreFluency: number; // 1-4
  scoreVocabulary: number; // 1-4
  scoreGrammar: number; // 1-4
  scorePronunciation: number; // 1-4
  scoreCoherence: number; // 1-4
  scoreTaskAchievement: number; // 1-4
  overallPercentage: number; // 0-100
  passed: boolean;
}

export interface AssessmentAttempt extends RubricScores {
  id: string;
  studentId: string;
  studentName: string;
  courseId: string;
  courseTitle?: string;
  lessonId: string;
  lessonTitle?: string;
  activityId?: string;
  activityTitle?: string;
  format: ActivityFormat;
  content: string;
  audioData?: string;
  fileUrl?: string;
  fileName?: string;
  fileType?: string;
  fileSize?: number;
  evaluator: 'ai' | 'teacher';
  status?: 'submitted' | 'graded';
  score?: number;
  feedback: string;
  strengths: string[];
  improvements: string[];
  exemplaryRevision?: string;
  teacherComments?: string;
  teacherId?: string;
  gradedBy?: string;
  gradedByName?: string;
  gradedAt?: string;
  submittedAt: string;
}

export interface TeacherApplication {
  id: string;
  userId: string;
  userEmail: string;
  userName: string;
  experience: string;
  qualifications: string;
  statement: string;
  status: 'pending' | 'approved' | 'rejected';
  reviewedBy?: string;
  submittedAt: string;
}
