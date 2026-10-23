import React, { useState, useEffect } from 'react';
import { Course, Module, Topic, Lesson, LessonProgress } from '../types';
import {
  getCourseModules,
  getTopics,
  getLessons,
  getStudentCourseProgress,
  getCourseById,
} from '../services/courseService';
import {
  CheckCircle2,
  Lock,
  Play,
  Layers,
  ArrowLeft,
  Award,
  Edit3,
  AlertTriangle,
} from 'lucide-react';

interface CourseViewerProps {
  course: Course;
  studentId: string;
  isInstructor?: boolean;
  onBack: () => void;
  onSelectLesson: (lesson: Lesson, progress?: LessonProgress) => void;
  onEditCourse?: (course: Course) => void;
}

export const CourseViewer: React.FC<CourseViewerProps> = ({
  course,
  studentId,
  isInstructor = false,
  onBack,
  onSelectLesson,
  onEditCourse,
}) => {
  const [modules, setModules] = useState<Module[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [progressMap, setProgressMap] = useState<Record<string, LessonProgress>>({});
  const [loading, setLoading] = useState(true);
  const [isDeleted, setIsDeleted] = useState(false);

  useEffect(() => {
    loadCourseContent();
  }, [course.id]);

  const loadCourseContent = async () => {
    setLoading(true);
    setIsDeleted(false);
    try {
      // 1. Verify that the course document exists and is active
      const courseDoc = await getCourseById(course.id);
      if (!courseDoc || (courseDoc as any).deleting) {
        setIsDeleted(true);
        setLoading(false);
        return;
      }

      const [mods, tops, less, progs] = await Promise.all([
        getCourseModules(course.id),
        getTopics(course.id),
        getLessons(course.id),
        getStudentCourseProgress(studentId, course.id),
      ]);
      setModules(mods);
      setTopics(tops);
      setLessons(less);
      setProgressMap(progs);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Compute actual completion stats
  const totalLessons = lessons.length;
  const completedLessons = lessons.filter((l) => progressMap[l.id]?.isCompleted).length;
  const progressPercent = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;

  if (isDeleted) {
    return (
      <div className="max-w-2xl mx-auto py-12 px-4 text-center space-y-4 animate-in fade-in duration-200">
        <div className="w-14 h-14 rounded-3xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto border border-rose-200">
          <AlertTriangle className="w-7 h-7" />
        </div>
        <h2 className="text-xl font-bold text-[#181624]">Course No Longer Available</h2>
        <p className="text-xs text-[#6F6C7E] max-w-md mx-auto leading-relaxed">
          This course has been permanently deleted from the platform by its instructor or an administrator. All associated modules, lessons, and access permissions have been removed.
        </p>
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#6546D7] hover:bg-[#5235BF] text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Return to Dashboard</span>
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12 animate-in fade-in duration-200">
      {/* Back Button */}
      <button
        onClick={onBack}
        className="inline-flex items-center gap-2 text-xs font-semibold text-[#575367] hover:text-[#181622] transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Back to Courses</span>
      </button>

      {/* Course Banner */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-[#ECEAF2] shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider px-2.5 py-1 rounded-lg bg-[#F1EEFB] text-[#6546D7]">
              CEFR {course.cefrLevel}
            </span>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-[#FAF9FC] border border-[#ECEAF2] text-[#555263]">
              Instructor: {course.teacherName}
            </span>
          </div>

          <div className="flex items-center gap-3">
            {isInstructor && onEditCourse && (
              <button
                onClick={() => onEditCourse(course)}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#6546D7] hover:bg-[#5235BF] text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Edit Curriculum & Lessons</span>
              </button>
            )}
            <div className="flex items-center gap-2 text-xs font-semibold text-[#6546D7]">
              <Award className="w-4 h-4" />
              <span>Mastery Gate: {course.masteryThreshold || 75}%</span>
            </div>
          </div>
        </div>

        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#16151E] mb-3">
          {course.title}
        </h1>
        <p className="text-sm text-[#4E4B5D] leading-relaxed mb-6">
          {course.description}
        </p>

        {/* Learning Outcomes */}
        {course.learningOutcomes && (
          <div className="p-4 rounded-2xl bg-[#FAF9FC] border border-[#ECEAF2] mb-6">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#757284] mb-1">
              Learning Outcomes
            </h4>
            <p className="text-xs sm:text-sm text-[#2B2937] leading-relaxed">
              {course.learningOutcomes}
            </p>
          </div>
        )}

        {/* Progress Bar */}
        <div>
          <div className="flex items-center justify-between text-xs font-semibold mb-2">
            <span className="text-[#6A6678]">Course Mastery Progress</span>
            <span className="text-[#6546D7]">{completedLessons} / {totalLessons} Lessons ({progressPercent}%)</span>
          </div>
          <div className="w-full h-2.5 rounded-full bg-[#EFEFF5] overflow-hidden">
            <div
              className="h-full rounded-full bg-[#6546D7] transition-all duration-500 ease-out"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      </div>

      {/* Curriculum Hierarchy */}
      <div className="space-y-6">
        <h2 className="text-lg font-bold text-[#191725] flex items-center gap-2">
          <Layers className="w-5 h-5 text-[#6546D7]" />
          <span>Curriculum Modules</span>
        </h2>

        {loading ? (
          <div className="py-12 flex justify-center">
            <div className="w-6 h-6 border-2 border-[#6546D7] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : modules.length === 0 ? (
          <div className="bg-white rounded-3xl p-8 text-center border border-dashed border-[#DDD9E8]">
            <p className="text-sm text-[#6C697B]">No modules have been published for this course yet.</p>
          </div>
        ) : (
          modules.map((mod, modIdx) => {
            const modTopics = topics.filter((t) => t.moduleId === mod.id);
            return (
              <div
                key={mod.id}
                className="bg-white rounded-3xl border border-[#ECEAF2] shadow-xs overflow-hidden"
              >
                {/* Module Header */}
                <div className="p-5 sm:p-6 bg-[#FAF9FC] border-b border-[#ECEAF2]">
                  <span className="text-xs font-bold uppercase tracking-wider text-[#6546D7]">
                    Module {modIdx + 1}
                  </span>
                  <h3 className="text-base sm:text-lg font-bold text-[#181624] mt-0.5">
                    {mod.title}
                  </h3>
                  {mod.description && (
                    <p className="text-xs text-[#6B687B] mt-1">{mod.description}</p>
                  )}
                </div>

                {/* Module Content / Topics & Lessons */}
                <div className="p-4 sm:p-6 space-y-4">
                  {modTopics.length === 0 ? (
                    <p className="text-xs text-[#878496] italic">No topics in this module yet.</p>
                  ) : (
                    modTopics.map((top, topIdx) => {
                      const topicLessons = lessons.filter((l) => l.topicId === top.id);
                      return (
                        <div key={top.id} className="space-y-3">
                          <h4 className="text-xs font-bold uppercase tracking-wider text-[#545062] flex items-center gap-2">
                            <span>Topic {topIdx + 1}: {top.title}</span>
                          </h4>

                          <div className="grid grid-cols-1 gap-2.5">
                            {topicLessons.map((lesson) => {
                              const prog = progressMap[lesson.id];
                              const isUnlocked = prog ? prog.isUnlocked : false;
                              const isCompleted = prog ? prog.isCompleted : false;

                              return (
                                <div
                                  key={lesson.id}
                                  onClick={() => isUnlocked && onSelectLesson(lesson, prog)}
                                  className={`p-4 rounded-2xl border transition-all flex items-center justify-between gap-4 ${
                                    isUnlocked
                                      ? 'bg-white border-[#E8E6F0] hover:border-[#6546D7]/40 hover:shadow-xs cursor-pointer'
                                      : 'bg-[#F9F8FA] border-[#ECEAF0] opacity-65 cursor-not-allowed'
                                  }`}
                                >
                                  <div className="flex items-center gap-3.5">
                                    {isCompleted ? (
                                      <div className="w-8 h-8 rounded-xl bg-emerald-100/70 text-emerald-700 flex items-center justify-center shrink-0">
                                        <CheckCircle2 className="w-4 h-4" />
                                      </div>
                                    ) : isUnlocked ? (
                                      <div className="w-8 h-8 rounded-xl bg-[#F0EDFB] text-[#6546D7] flex items-center justify-center shrink-0">
                                        <Play className="w-4 h-4 fill-current ml-0.5" />
                                      </div>
                                    ) : (
                                      <div className="w-8 h-8 rounded-xl bg-[#EBE9F0] text-[#9390A0] flex items-center justify-center shrink-0">
                                        <Lock className="w-3.5 h-3.5" />
                                      </div>
                                    )}

                                    <div>
                                      <div className="flex items-center gap-2 mb-0.5">
                                        <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-[#FAF9FC] border border-[#E9E7F1] text-[#555263]">
                                          {lesson.bloomLevels?.[0] || 'Apply'}
                                        </span>
                                        {isCompleted && (
                                          <span className="text-[10px] font-bold text-emerald-600">
                                            Score: {prog?.bestScore}%
                                          </span>
                                        )}
                                      </div>
                                      <div className="font-bold text-sm text-[#181624]">
                                        {lesson.title}
                                      </div>
                                    </div>
                                  </div>

                                  <div className="shrink-0 text-right">
                                    {isUnlocked ? (
                                      <span className="text-xs font-semibold text-[#6546D7] hover:underline">
                                        {isCompleted ? 'Review' : 'Start'}
                                      </span>
                                    ) : (
                                      <span className="text-[11px] text-[#9390A0] font-medium">
                                        Locked
                                      </span>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
