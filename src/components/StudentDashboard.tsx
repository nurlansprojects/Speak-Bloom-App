import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Course, Enrollment, AssessmentAttempt } from '../types';
import {
  getStudentEnrollments,
  getCourseById,
  getStudentAssessmentAttempts,
} from '../services/courseService';
import {
  BookOpen,
  ArrowRight,
  Sparkles,
  Award,
  History,
  TrendingUp,
  Compass,
} from 'lucide-react';

interface StudentDashboardProps {
  onOpenCourse: (course: Course) => void;
  onBrowseCourses: () => void;
  onViewAttempt: (attempt: AssessmentAttempt) => void;
}

interface EnrolledCourseCard {
  enrollment: Enrollment;
  course: Course;
}

export const StudentDashboard: React.FC<StudentDashboardProps> = ({
  onOpenCourse,
  onBrowseCourses,
  onViewAttempt,
}) => {
  const { userProfile, currentUser } = useAuth();
  const [enrolledCourses, setEnrolledCourses] = useState<EnrolledCourseCard[]>([]);
  const [recentAttempts, setRecentAttempts] = useState<AssessmentAttempt[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (currentUser) {
      loadDashboardData();
    }
  }, [currentUser]);

  const loadDashboardData = async () => {
    if (!currentUser) return;
    setLoading(true);
    try {
      const enrollments = await getStudentEnrollments(currentUser.uid);
      const coursePromises = enrollments.map(async (e) => {
        const c = await getCourseById(e.courseId);
        return c ? { enrollment: e, course: c } : null;
      });

      const resolved = (await Promise.all(coursePromises)).filter(Boolean) as EnrolledCourseCard[];
      setEnrolledCourses(resolved);

      const attempts = await getStudentAssessmentAttempts(currentUser.uid);
      // Sort by submittedAt descending
      attempts.sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());
      setRecentAttempts(attempts);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Compute overall stats
  const totalAttempts = recentAttempts.length;
  const passedAttempts = recentAttempts.filter((a) => a.passed).length;
  const averageScore =
    totalAttempts > 0
      ? Math.round(
          recentAttempts.reduce((acc, a) => acc + (a.overallPercentage || 0), 0) / totalAttempts
        )
      : 0;

  return (
    <div className="space-y-8 animate-in fade-in duration-200">
      {/* Welcome & Progress Overview */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-[#ECEAF2] shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider px-2.5 py-1 rounded-lg bg-[#F1EEFB] text-[#6546D7]">
              CEFR Goal: {userProfile?.cefrGoal || 'B1'}
            </span>
            <span className="text-xs text-[#7B788B]">English Speaking Journey</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#16151E]">
            Welcome back, {userProfile?.displayName}
          </h1>
          <p className="text-sm text-[#545163] mt-1">
            Master spoken English through Bloom's Taxonomy and real conversational practice.
          </p>
        </div>

        {/* Real Quantitative Learning Stats */}
        <div className="flex items-center gap-4 sm:gap-6 border-t md:border-t-0 md:border-l border-[#ECEAF2] pt-4 md:pt-0 md:pl-6">
          <div className="text-center sm:text-left">
            <div className="text-2xl font-extrabold text-[#16151E]">{enrolledCourses.length}</div>
            <div className="text-xs text-[#7B788C]">Enrolled Courses</div>
          </div>
          <div className="text-center sm:text-left">
            <div className="text-2xl font-extrabold text-[#6546D7]">{passedAttempts}</div>
            <div className="text-xs text-[#7B788C]">Mastered Lessons</div>
          </div>
          <div className="text-center sm:text-left">
            <div className="text-2xl font-extrabold text-[#16151E]">
              {totalAttempts > 0 ? `${averageScore}%` : '—'}
            </div>
            <div className="text-xs text-[#7B788C]">Average Rubric</div>
          </div>
        </div>
      </div>

      {/* Enrolled Courses Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-[#181624] flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-[#6546D7]" />
            <span>My Active Courses</span>
          </h2>
          <button
            onClick={onBrowseCourses}
            className="flex items-center gap-1.5 text-xs font-semibold text-[#6546D7] hover:underline"
          >
            <span>Browse All Courses</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {loading ? (
          <div className="py-12 flex justify-center">
            <div className="w-6 h-6 border-2 border-[#6546D7] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : enrolledCourses.length === 0 ? (
          <div className="bg-white rounded-3xl p-8 sm:p-12 text-center border border-dashed border-[#DDD9E8] space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-[#F4F3F9] text-[#6546D7] flex items-center justify-center mx-auto">
              <Compass className="w-6 h-6" />
            </div>
            <div className="max-w-md mx-auto space-y-1">
              <h3 className="text-base font-bold text-[#171523]">No active enrollments yet</h3>
              <p className="text-xs text-[#6F6B7E] leading-relaxed">
                Explore published courses aligned to your CEFR proficiency level and begin your speaking lessons.
              </p>
            </div>
            <button
              onClick={onBrowseCourses}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#6546D7] hover:bg-[#5235BE] text-white text-xs font-semibold shadow-xs transition-all cursor-pointer"
            >
              <span>Explore Course Catalog</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {enrolledCourses.map(({ course, enrollment }) => {
              const lessonsCount = course.lessonsCount || 1;
              const completedCount = enrollment.completedLessonsCount || 0;
              const percent = Math.min(100, Math.round((completedCount / lessonsCount) * 100));

              return (
                <div
                  key={course.id}
                  className="bg-white rounded-3xl p-6 border border-[#ECEAF2] hover:border-[#6546D7]/35 shadow-xs transition-all flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <span className="text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-[#F1EEFB] text-[#6546D7]">
                        CEFR {course.cefrLevel}
                      </span>
                      <span className="text-xs text-[#7B788C]">
                        Teacher: {course.teacherName}
                      </span>
                    </div>

                    <h3 className="text-lg font-bold text-[#181624] mb-2">{course.title}</h3>
                    <p className="text-xs text-[#615E70] line-clamp-2 mb-5">{course.description}</p>
                  </div>

                  {/* Progress & Continue */}
                  <div className="space-y-4 pt-3 border-t border-[#F1EFF7]">
                    <div>
                      <div className="flex justify-between text-xs font-semibold mb-1.5">
                        <span className="text-[#6D6A7C]">Mastery Progress</span>
                        <span className="text-[#6546D7]">{percent}%</span>
                      </div>
                      <div className="w-full h-2 rounded-full bg-[#EFEFF5] overflow-hidden">
                        <div
                          className="h-full rounded-full bg-[#6546D7] transition-all duration-300"
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                    </div>

                    <button
                      onClick={() => onOpenCourse(course)}
                      className="w-full py-2.5 rounded-xl bg-[#FAF9FD] hover:bg-[#F2EFFC] text-[#6546D7] border border-[#6546D7]/20 text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
                    >
                      <span>Continue Learning</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Speaking Assessments History */}
      <div className="space-y-4">
        <h2 className="text-lg font-bold text-[#181624] flex items-center gap-2">
          <History className="w-5 h-5 text-[#6546D7]" />
          <span>Recent Speaking Assessments</span>
        </h2>

        {recentAttempts.length === 0 ? (
          <div className="bg-white rounded-3xl p-6 text-center border border-[#ECEAF2]">
            <p className="text-xs text-[#747183]">No speaking assessments submitted yet.</p>
          </div>
        ) : (
          <div className="bg-white rounded-3xl border border-[#ECEAF2] shadow-xs overflow-hidden">
            <div className="divide-y divide-[#ECEAF2]">
              {recentAttempts.slice(0, 5).map((att) => (
                <div
                  key={att.id}
                  onClick={() => onViewAttempt(att)}
                  className="p-4 sm:p-5 hover:bg-[#FAF9FC] transition-colors flex items-center justify-between gap-4 cursor-pointer"
                >
                  <div className="flex items-center gap-3.5">
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs ${
                        att.passed
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-amber-50 text-amber-700 border border-amber-200'
                      }`}
                    >
                      {Math.round(att.overallPercentage)}%
                    </div>
                    <div>
                      <div className="font-bold text-sm text-[#181624]">
                        {att.format === 'recording'
                          ? 'Voice Speaking Assessment'
                          : att.format === 'ai_conversation'
                          ? 'AI Conversation Practice'
                          : 'Text-Based Preparation'}
                      </div>
                      <p className="text-xs text-[#726E80] line-clamp-1 italic">"{att.content}"</p>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <span
                      className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                        att.passed
                          ? 'bg-emerald-50 text-emerald-700'
                          : 'bg-amber-50 text-amber-700'
                      }`}
                    >
                      {att.passed ? 'Passed' : 'Needs Review'}
                    </span>
                    <div className="text-[10px] text-[#918E9E] mt-1">
                      {new Date(att.submittedAt).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
