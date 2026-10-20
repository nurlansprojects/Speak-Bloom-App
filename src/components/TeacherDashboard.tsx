import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Course, AssessmentAttempt } from '../types';
import {
  getTeacherCourses,
  getCourseSubmissionsForTeacher,
  teacherReviewAssessment,
} from '../services/courseService';
import {
  Plus,
  BookOpen,
  Edit3,
  Layers,
  Award,
  MessageSquare,
  CheckCircle2,
  Users,
  TrendingUp,
} from 'lucide-react';

interface TeacherDashboardProps {
  onCreateCourse: () => void;
  onEditCourse: (course: Course) => void;
  onPreviewCourse: (course: Course) => void;
}

export const TeacherDashboard: React.FC<TeacherDashboardProps> = ({
  onCreateCourse,
  onEditCourse,
  onPreviewCourse,
}) => {
  const { currentUser, userProfile } = useAuth();
  const [courses, setCourses] = useState<Course[]>([]);
  const [submissions, setSubmissions] = useState<AssessmentAttempt[]>([]);
  const [selectedSubmission, setSelectedSubmission] = useState<AssessmentAttempt | null>(null);
  const [teacherReviewNote, setTeacherReviewNote] = useState('');
  const [savingReview, setSavingReview] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (currentUser) {
      loadTeacherData();
    }
  }, [currentUser]);

  const loadTeacherData = async () => {
    if (!currentUser) return;
    setLoading(true);
    try {
      const myCourses = await getTeacherCourses(currentUser.uid);
      setCourses(myCourses);

      // Fetch speaking submissions across all teacher courses
      let allSubmissions: AssessmentAttempt[] = [];
      for (const c of myCourses) {
        const subs = await getCourseSubmissionsForTeacher(c.id);
        allSubmissions = [...allSubmissions, ...subs];
      }
      allSubmissions.sort(
        (a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()
      );
      setSubmissions(allSubmissions);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveTeacherReview = async () => {
    if (!selectedSubmission || !teacherReviewNote.trim()) return;
    setSavingReview(true);
    try {
      await teacherReviewAssessment(selectedSubmission.id, teacherReviewNote.trim());
      await loadTeacherData();
      setSelectedSubmission(null);
      setTeacherReviewNote('');
    } catch (err) {
      console.error(err);
    } finally {
      setSavingReview(false);
    }
  };

  // Real statistics derived purely from database records
  const publishedCoursesCount = courses.filter((c) => c.status === 'published').length;
  const draftCoursesCount = courses.filter((c) => c.status === 'draft').length;
  const totalSubmissions = submissions.length;
  const passedSubmissions = submissions.filter((s) => s.passed).length;
  const passRate =
    totalSubmissions > 0 ? Math.round((passedSubmissions / totalSubmissions) * 100) : 0;

  return (
    <div className="space-y-8 animate-in fade-in duration-200">
      {/* Header */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-[#ECEAF2] shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider px-2.5 py-1 rounded-lg bg-[#F1EEFB] text-[#6546D7]">
              Educator Studio
            </span>
            <span className="text-xs text-[#7A778A]">Instructor Dashboard</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#16151E]">
            Teaching Management
          </h1>
          <p className="text-sm text-[#524F60] mt-1">
            Author Bloom-structured courses, evaluate student speaking submissions, and track learning progress.
          </p>
        </div>

        {/* Plus Button for Course Creation */}
        <button
          onClick={onCreateCourse}
          className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-[#6546D7] hover:bg-[#5235BE] text-white text-xs font-semibold shadow-xs transition-all cursor-pointer shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Create New Course</span>
        </button>
      </div>

      {/* Real Quantitative Analytics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-[#ECEAF2]">
          <div className="text-xs font-semibold text-[#787588]">Total Courses</div>
          <div className="text-2xl font-extrabold text-[#16151E] mt-1">{courses.length}</div>
          <div className="text-[11px] text-[#6546D7] mt-0.5">
            {publishedCoursesCount} Published • {draftCoursesCount} Drafts
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-[#ECEAF2]">
          <div className="text-xs font-semibold text-[#787588]">Student Submissions</div>
          <div className="text-2xl font-extrabold text-[#16151E] mt-1">{totalSubmissions}</div>
          <div className="text-[11px] text-[#79768A] mt-0.5">Assessed with Rubric</div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-[#ECEAF2]">
          <div className="text-xs font-semibold text-[#787588]">Mastery Pass Rate</div>
          <div className="text-2xl font-extrabold text-[#6546D7] mt-1">
            {totalSubmissions > 0 ? `${passRate}%` : '—'}
          </div>
          <div className="text-[11px] text-[#79768A] mt-0.5">
            {passedSubmissions} met threshold
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-[#ECEAF2]">
          <div className="text-xs font-semibold text-[#787588]">Reviews Pending</div>
          <div className="text-2xl font-extrabold text-[#16151E] mt-1">
            {submissions.filter((s) => !s.teacherComments).length}
          </div>
          <div className="text-[11px] text-[#79768A] mt-0.5">Awaiting teacher feedback</div>
        </div>
      </div>

      {/* Courses List */}
      <div className="space-y-4">
        <h2 className="text-lg font-bold text-[#181624] flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-[#6546D7]" />
          <span>My Authored Courses</span>
        </h2>

        {loading ? (
          <div className="py-12 flex justify-center">
            <div className="w-6 h-6 border-2 border-[#6546D7] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : courses.length === 0 ? (
          <div className="bg-white rounded-3xl p-10 text-center border border-dashed border-[#DDD9E8] space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-[#F4F3F9] text-[#6546D7] flex items-center justify-center mx-auto">
              <Plus className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-[#16151E]">You have not created any courses yet</h3>
            <p className="text-xs text-[#716E80] max-w-sm mx-auto leading-relaxed">
              Design a structured curriculum incorporating CEFR levels and Bloom's six cognitive domains.
            </p>
            <button
              onClick={onCreateCourse}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#6546D7] text-white text-xs font-semibold shadow-xs hover:bg-[#5235BE] transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Create First Course</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {courses.map((course) => (
              <div
                key={course.id}
                className="bg-white rounded-3xl p-6 border border-[#ECEAF2] shadow-xs flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <span className="text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-[#F1EEFB] text-[#6546D7]">
                      CEFR {course.cefrLevel}
                    </span>
                    <span
                      className={`text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                        course.status === 'published'
                          ? 'bg-emerald-50 text-emerald-700'
                          : 'bg-amber-50 text-amber-700'
                      }`}
                    >
                      {course.status}
                    </span>
                  </div>

                  <h3 className="font-bold text-base text-[#16151E] mb-1.5">{course.title}</h3>
                  <p className="text-xs text-[#636072] line-clamp-2 mb-4">{course.description}</p>

                  <div className="flex items-center gap-4 text-xs text-[#7B788C] mb-4">
                    <span className="flex items-center gap-1">
                      <Layers className="w-3.5 h-3.5" />
                      <span>{course.modulesCount || 0} Modules</span>
                    </span>
                    <span className="flex items-center gap-1">
                      <Award className="w-3.5 h-3.5" />
                      <span>{course.masteryThreshold || 75}% Pass</span>
                    </span>
                  </div>
                </div>

                <div className="pt-3 border-t border-[#F2EFF7] flex items-center justify-end gap-2">
                  <button
                    onClick={() => onPreviewCourse(course)}
                    className="px-3.5 py-2 rounded-xl border border-[#D8D5E5] text-xs font-medium text-[#4B485A] hover:bg-[#FAF9FC] transition-colors cursor-pointer"
                  >
                    Preview Student View
                  </button>
                  <button
                    onClick={() => onEditCourse(course)}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#6546D7] hover:bg-[#5235BF] text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>Edit Curriculum</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Student Submissions Review Panel */}
      <div className="space-y-4">
        <h2 className="text-lg font-bold text-[#181624] flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-[#6546D7]" />
          <span>Student Speaking Submissions</span>
        </h2>

        {submissions.length === 0 ? (
          <div className="bg-white rounded-3xl p-6 text-center border border-[#ECEAF2]">
            <p className="text-xs text-[#747183]">No student submissions received yet.</p>
          </div>
        ) : (
          <div className="bg-white rounded-3xl border border-[#ECEAF2] shadow-xs overflow-hidden">
            <div className="divide-y divide-[#ECEAF2]">
              {submissions.map((sub) => (
                <div
                  key={sub.id}
                  className="p-5 hover:bg-[#FAF9FC] transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-xs text-[#16151E]">{sub.studentName}</span>
                      <span className="text-[10px] text-[#868394]">•</span>
                      <span className="text-[11px] text-[#696577] capitalize">{sub.format}</span>
                      <span
                        className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                          sub.passed ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                        }`}
                      >
                        {Math.round(sub.overallPercentage)}%
                      </span>
                    </div>
                    <p className="text-xs text-[#4E4A5C] italic line-clamp-1">"{sub.content}"</p>
                    {sub.teacherComments && (
                      <p className="text-[11px] text-blue-700 font-medium">
                        ✓ Teacher note: {sub.teacherComments}
                      </p>
                    )}
                  </div>

                  <button
                    onClick={() => {
                      setSelectedSubmission(sub);
                      setTeacherReviewNote(sub.teacherComments || '');
                    }}
                    className="px-3.5 py-1.5 rounded-xl border border-[#D5D2E2] hover:bg-white text-xs font-semibold text-[#6546D7] transition-colors self-start sm:self-auto cursor-pointer"
                  >
                    {sub.teacherComments ? 'Update Review' : 'Add Teacher Feedback'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Review Modal */}
      {selectedSubmission && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-lg w-full border border-[#ECEAF2] shadow-2xl p-6 space-y-4">
            <h3 className="text-base font-bold text-[#16151E]">
              Review Submission from {selectedSubmission.studentName}
            </h3>

            <div className="p-3.5 rounded-xl bg-[#FAF9FC] border border-[#ECEAF2] text-xs text-[#312E40] italic leading-relaxed">
              "{selectedSubmission.content}"
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#322F40]">
                Teacher Feedback & Guidance
              </label>
              <textarea
                rows={4}
                value={teacherReviewNote}
                onChange={(e) => setTeacherReviewNote(e.target.value)}
                placeholder="Provide personalized advice on pronunciation, fluency, or vocabulary..."
                className="w-full p-3 rounded-xl border border-[#D5D2E2] text-xs focus:outline-none focus:border-[#6546D7]"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-[#ECEAF2]">
              <button
                onClick={() => setSelectedSubmission(null)}
                className="px-4 py-2 text-xs text-[#636074]"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveTeacherReview}
                disabled={savingReview || !teacherReviewNote.trim()}
                className="px-5 py-2 rounded-xl bg-[#6546D7] text-white text-xs font-semibold disabled:opacity-50"
              >
                {savingReview ? 'Saving...' : 'Save Feedback'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
