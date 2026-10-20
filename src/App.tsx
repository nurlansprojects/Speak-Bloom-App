import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { WelcomePage } from './components/WelcomePage';
import { Navbar } from './components/Navbar';
import { Footer } from './components/Footer';
import { StudentDashboard } from './components/StudentDashboard';
import { CourseCatalog } from './components/CourseCatalog';
import { CourseViewer } from './components/CourseViewer';
import { LessonStudyView } from './components/LessonStudyView';
import { CourseBuilder } from './components/CourseBuilder';
import { TeacherDashboard } from './components/TeacherDashboard';
import { AdminDashboard } from './components/AdminDashboard';
import { SpeakingPracticeModal } from './components/SpeakingPracticeModal';
import { AssessmentResultModal } from './components/AssessmentResultModal';
import { UserProfileModal } from './components/UserProfileModal';
import { Course, Lesson, Activity, AssessmentAttempt, LessonProgress } from './types';
import {
  submitAssessmentAttempt,
  recordLessonAssessment,
  getLessonById,
} from './services/courseService';

function MainApp() {
  const { currentUser, userProfile, loading } = useAuth();

  // Navigation State
  const [currentTab, setCurrentTab] = useState<'student' | 'catalog' | 'teacher' | 'admin'>('student');

  // Course & Lesson Flow State
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [selectedLesson, setSelectedLesson] = useState<Lesson | null>(null);
  const [selectedLessonProgress, setSelectedLessonProgress] = useState<LessonProgress | undefined>(undefined);

  // Modals & Interactive Overlays
  const [activeActivity, setActiveActivity] = useState<Activity | null>(null);
  const [activeAttemptResult, setActiveAttemptResult] = useState<AssessmentAttempt | null>(null);
  const [showProfileModal, setShowProfileModal] = useState(false);

  // Teacher Course Editing
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
  const [isBuildingCourse, setIsBuildingCourse] = useState(false);

  // 1. Initial Loading Screen
  if (loading) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-[#FAF9FC]">
        <div className="w-8 h-8 border-3 border-[#6546D7] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // 2. Unauthenticated: Strictly minimal Google-only Welcome Page
  if (!currentUser) {
    return <WelcomePage />;
  }

  // Handler when speaking practice completes and rubric is evaluated
  const handleAssessmentComplete = async (attempt: AssessmentAttempt) => {
    setActiveActivity(null);

    try {
      // 1. Persist the assessment attempt in Firestore
      const attemptId = await submitAssessmentAttempt({
        ...attempt,
        studentId: currentUser.uid,
        studentName: userProfile?.displayName || 'Learner',
      });

      // 2. Update authoritative progress and check mastery gates
      const { nextUnlockedLessonId, isCourseCompleted } = await recordLessonAssessment(
        currentUser.uid,
        attempt.courseId,
        attempt.lessonId,
        attempt.overallPercentage,
        attempt.passed
      );

      const savedAttempt: AssessmentAttempt = {
        ...attempt,
        id: attemptId,
        studentId: currentUser.uid,
      };

      setActiveAttemptResult(savedAttempt);
    } catch (err) {
      console.error('Error saving assessment attempt:', err);
      setActiveAttemptResult(attempt);
    }
  };

  const handleOpenCourse = (course: Course) => {
    setSelectedCourse(course);
    setSelectedLesson(null);
  };

  const handleSelectLesson = (lesson: Lesson, prog?: LessonProgress) => {
    setSelectedLesson(lesson);
    setSelectedLessonProgress(prog);
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#FAF9FC] text-[#1E1C2B]">
      {/* Top Navigation */}
      <Navbar
        currentTab={currentTab}
        setCurrentTab={(tab) => {
          setCurrentTab(tab);
          setSelectedCourse(null);
          setSelectedLesson(null);
          setIsBuildingCourse(false);
          setEditingCourse(null);
        }}
        onOpenProfile={() => setShowProfileModal(true)}
      />

      {/* Main View Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-8 py-6 pb-24 md:pb-12">
        {/* If inside Course Builder */}
        {isBuildingCourse ? (
          <CourseBuilder
            existingCourse={editingCourse}
            onBack={() => {
              setIsBuildingCourse(false);
              setEditingCourse(null);
            }}
            onSaved={(_cid) => {
              setIsBuildingCourse(false);
              setEditingCourse(null);
              setCurrentTab('teacher');
            }}
          />
        ) : selectedLesson && selectedCourse ? (
          /* Lesson Learning & Study View */
          <LessonStudyView
            course={selectedCourse}
            lesson={selectedLesson}
            progress={selectedLessonProgress}
            onBack={() => setSelectedLesson(null)}
            onStartActivity={(activity) => setActiveActivity(activity)}
            onViewAttemptResult={(att) => setActiveAttemptResult(att)}
          />
        ) : selectedCourse ? (
          /* Course Curriculum Tree View */
          <CourseViewer
            course={selectedCourse}
            studentId={currentUser.uid}
            isInstructor={userProfile?.role === 'teacher' || userProfile?.role === 'admin' || selectedCourse.teacherId === currentUser.uid}
            onBack={() => setSelectedCourse(null)}
            onSelectLesson={handleSelectLesson}
            onEditCourse={(c) => {
              setEditingCourse(c);
              setIsBuildingCourse(true);
            }}
          />
        ) : currentTab === 'student' ? (
          /* Student Learning Dashboard */
          <StudentDashboard
            onOpenCourse={handleOpenCourse}
            onBrowseCourses={() => setCurrentTab('catalog')}
            onViewAttempt={(att) => setActiveAttemptResult(att)}
          />
        ) : currentTab === 'catalog' ? (
          /* Published Courses Catalog */
          <CourseCatalog onSelectCourse={handleOpenCourse} />
        ) : currentTab === 'teacher' ? (
          /* Teacher Dashboard */
          <TeacherDashboard
            onCreateCourse={() => {
              setEditingCourse(null);
              setIsBuildingCourse(true);
            }}
            onEditCourse={(c) => {
              setEditingCourse(c);
              setIsBuildingCourse(true);
            }}
            onPreviewCourse={handleOpenCourse}
          />
        ) : currentTab === 'admin' ? (
          /* Administrator Console */
          <AdminDashboard />
        ) : null}
      </main>

      {/* Speaking Practice Modal (Mode A, B, C) */}
      {activeActivity && selectedLesson && (
        <SpeakingPracticeModal
          lesson={selectedLesson}
          activity={activeActivity}
          studentName={userProfile?.displayName || 'Learner'}
          onComplete={handleAssessmentComplete}
          onClose={() => setActiveActivity(null)}
        />
      )}

      {/* Assessment Rubric Result Modal */}
      {activeAttemptResult && selectedLesson && (
        <AssessmentResultModal
          attempt={activeAttemptResult}
          masteryThreshold={selectedLesson.requiredMasteryScore || 75}
          onClose={() => setActiveAttemptResult(null)}
          onRetry={() => {
            setActiveAttemptResult(null);
            if (activeActivity) {
              setActiveActivity(activeActivity);
            }
          }}
          onContinueNext={() => {
            setActiveAttemptResult(null);
            setSelectedLesson(null);
          }}
          hasNextLesson={true}
        />
      )}

      {/* User Profile & Teacher Application Modal */}
      {showProfileModal && <UserProfileModal onClose={() => setShowProfileModal(false)} />}

      {/* Minimal Footer with required copyright */}
      <Footer />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
}
