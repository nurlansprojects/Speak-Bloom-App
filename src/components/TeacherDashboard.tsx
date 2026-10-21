import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Course, AssessmentAttempt, UploadedFileRecord } from '../types';
import {
  getTeacherCourses,
  getCourseSubmissionsForTeacher,
  teacherReviewAssessment,
} from '../services/courseService';
import {
  getCourseSubmissionsForTeacherUploads,
  teacherReviewSubmission,
  formatFileSize,
} from '../services/uploadStorageService';
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
  UploadCloud,
  File,
  FileText,
  Film,
  Music,
  FileSpreadsheet,
  Presentation,
  Download,
  ExternalLink,
  X,
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

  // Uploading submissions state
  const [uploadSubmissions, setUploadSubmissions] = useState<UploadedFileRecord[]>([]);
  const [selectedUploadSubmission, setSelectedUploadSubmission] = useState<UploadedFileRecord | null>(null);
  const [uploadFeedbackNote, setUploadFeedbackNote] = useState('');
  const [uploadGrade, setUploadGrade] = useState<number | ''>(85);
  const [savingUploadReview, setSavingUploadReview] = useState(false);

  const [submissionsTab, setSubmissionsTab] = useState<'uploading' | 'speaking'>('uploading');
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

      // Fetch speaking submissions and uploading submissions across all teacher courses
      let allSubmissions: AssessmentAttempt[] = [];
      let allUploadSubs: UploadedFileRecord[] = [];

      for (const c of myCourses) {
        const subs = await getCourseSubmissionsForTeacher(c.id);
        allSubmissions = [...allSubmissions, ...subs];

        const uSubs = await getCourseSubmissionsForTeacherUploads(c.id);
        allUploadSubs = [...allUploadSubs, ...uSubs];
      }

      allSubmissions.sort(
        (a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()
      );
      setSubmissions(allSubmissions);

      allUploadSubs.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      setUploadSubmissions(allUploadSubs);
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

  const handleSaveUploadReview = async () => {
    if (!selectedUploadSubmission || !currentUser || !userProfile) return;
    setSavingUploadReview(true);
    try {
      const grade = typeof uploadGrade === 'number' ? uploadGrade : undefined;
      await teacherReviewSubmission(
        selectedUploadSubmission.id,
        uploadFeedbackNote.trim(),
        grade,
        currentUser.uid,
        userProfile.displayName || 'Instructor'
      );
      await loadTeacherData();
      setSelectedUploadSubmission(null);
      setUploadFeedbackNote('');
      setUploadGrade(85);
    } catch (err) {
      console.error(err);
    } finally {
      setSavingUploadReview(false);
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
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#ECEAF2] pb-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSubmissionsTab('uploading')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
                submissionsTab === 'uploading'
                  ? 'bg-[#6546D7] text-white shadow-xs'
                  : 'bg-[#FAF9FC] text-[#696577] hover:bg-[#F2EFFB]'
              }`}
            >
              <UploadCloud className="w-3.5 h-3.5" />
              <span>Uploading Submissions</span>
              {uploadSubmissions.length > 0 && (
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                    submissionsTab === 'uploading'
                      ? 'bg-white/20 text-white'
                      : 'bg-[#ECE8F8] text-[#6546D7]'
                  }`}
                >
                  {uploadSubmissions.length}
                </span>
              )}
            </button>

            <button
              onClick={() => setSubmissionsTab('speaking')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
                submissionsTab === 'speaking'
                  ? 'bg-[#6546D7] text-white shadow-xs'
                  : 'bg-[#FAF9FC] text-[#696577] hover:bg-[#F2EFFB]'
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>Speaking Rubric Attempts</span>
              {submissions.length > 0 && (
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                    submissionsTab === 'speaking'
                      ? 'bg-white/20 text-white'
                      : 'bg-[#ECE8F8] text-[#6546D7]'
                  }`}
                >
                  {submissions.length}
                </span>
              )}
            </button>
          </div>

          <span className="text-xs text-[#7B788C]">
            Review student submissions, evaluate coursework, and provide personalized feedback
          </span>
        </div>

        {/* TAB A: UPLOADING SUBMISSIONS */}
        {submissionsTab === 'uploading' && (
          uploadSubmissions.length === 0 ? (
            <div className="bg-white rounded-3xl p-8 text-center border border-[#ECEAF2]">
              <UploadCloud className="w-8 h-8 text-[#A5A2B5] mx-auto mb-2" />
              <p className="text-xs text-[#747183]">No student Uploading submissions received yet.</p>
            </div>
          ) : (
            <div className="bg-white rounded-3xl border border-[#ECEAF2] shadow-xs overflow-hidden">
              <div className="divide-y divide-[#ECEAF2]">
                {uploadSubmissions.map((sub) => {
                  const getFileIcon = (type: string, ext: string) => {
                    switch (type) {
                      case 'audio':
                        return <Music className="w-4 h-4 text-purple-600" />;
                      case 'video':
                        return <Film className="w-4 h-4 text-rose-600" />;
                      case 'spreadsheet':
                        return <FileSpreadsheet className="w-4 h-4 text-emerald-600" />;
                      case 'presentation':
                        return <Presentation className="w-4 h-4 text-amber-600" />;
                      case 'document':
                      default:
                        if (ext === 'pdf') return <FileText className="w-4 h-4 text-rose-500" />;
                        return <File className="w-4 h-4 text-blue-600" />;
                    }
                  };

                  return (
                    <div
                      key={sub.id}
                      className="p-5 hover:bg-[#FAF9FC] transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                    >
                      <div className="flex items-start gap-3.5">
                        <div className="p-2.5 rounded-xl bg-[#FAF9FC] border border-[#ECEAF2] shrink-0 mt-0.5">
                          {getFileIcon(sub.fileType, sub.fileExtension)}
                        </div>
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-xs text-[#16151E]">{sub.userName}</span>
                            <span className="text-[10px] text-[#868394]">•</span>
                            <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-[#FAF9FC] border border-[#E9E7F1] text-[#615E70]">
                              .{sub.fileExtension.toUpperCase()}
                            </span>
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                                sub.status === 'reviewed'
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : 'bg-amber-50 text-amber-700 border border-amber-200'
                              }`}
                            >
                              {sub.status === 'reviewed' ? 'Reviewed' : 'Pending Review'}
                            </span>
                            {sub.grade !== undefined && sub.grade !== null && (
                              <span className="text-[10px] font-bold text-emerald-700">
                                Grade: {sub.grade}/100
                              </span>
                            )}
                          </div>
                          <div className="text-xs font-bold text-[#6546D7]">
                            {sub.title || sub.fileName}
                          </div>
                          <p className="text-xs text-[#696577]">
                            {sub.fileName} ({formatFileSize(sub.fileSize)}) • Submitted{' '}
                            {new Date(sub.createdAt).toLocaleDateString()} at{' '}
                            {new Date(sub.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </p>
                          {sub.feedback && (
                            <p className="text-[11px] text-blue-800 font-medium bg-[#F1EEFB] p-2 rounded-lg border border-[#DDD7F5] mt-1">
                              ✓ Feedback: {sub.feedback}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0 self-start sm:self-auto">
                        <a
                          href={sub.fileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#D5D2E2] hover:bg-white text-xs font-semibold text-[#6546D7] transition-colors cursor-pointer"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          <span>Inspect</span>
                        </a>

                        <button
                          onClick={() => {
                            setSelectedUploadSubmission(sub);
                            setUploadFeedbackNote(sub.feedback || '');
                            setUploadGrade(sub.grade !== undefined && sub.grade !== null ? sub.grade : 85);
                          }}
                          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#6546D7] hover:bg-[#5235BF] text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                          <span>{sub.status === 'reviewed' ? 'Update Feedback' : 'Review & Grade'}</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )
        )}

        {/* TAB B: SPEAKING RUBRIC ATTEMPTS */}
        {submissionsTab === 'speaking' && (
          submissions.length === 0 ? (
            <div className="bg-white rounded-3xl p-6 text-center border border-[#ECEAF2]">
              <p className="text-xs text-[#747183]">No speaking rubric assessments received yet.</p>
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
          )
        )}
      </div>

      {/* Speaking Review Modal */}
      {selectedSubmission && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-lg w-full border border-[#ECEAF2] shadow-2xl p-6 space-y-4">
            <h3 className="text-base font-bold text-[#16151E]">
              Review Speaking Submission from {selectedSubmission.studentName}
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

      {/* Uploading Submission Review Modal */}
      {selectedUploadSubmission && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-lg w-full border border-[#ECEAF2] shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold text-[#6546D7] uppercase tracking-wider">
                  Uploading Activity Review
                </span>
                <h3 className="text-base font-bold text-[#16151E]">
                  Submission from {selectedUploadSubmission.userName}
                </h3>
              </div>
              <button
                onClick={() => setSelectedUploadSubmission(null)}
                className="p-1 rounded-full text-[#817E91] hover:text-[#181624]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3.5 rounded-xl bg-[#FAF9FC] border border-[#ECEAF2] text-xs text-[#312E40] space-y-1">
              <div className="font-bold text-[#181624]">{selectedUploadSubmission.title || selectedUploadSubmission.fileName}</div>
              <div className="text-[11px] text-[#716E82]">
                File: {selectedUploadSubmission.fileName} ({formatFileSize(selectedUploadSubmission.fileSize)})
              </div>
              {selectedUploadSubmission.instructions && (
                <div className="text-[11px] italic text-[#555263] pt-1">
                  Note from student: "{selectedUploadSubmission.instructions}"
                </div>
              )}
            </div>

            <div className="flex items-center justify-between gap-4">
              <div>
                <label className="text-xs font-semibold text-[#322F40] block mb-1">
                  Evaluation Grade (0 - 100)
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={uploadGrade}
                  onChange={(e) => setUploadGrade(e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-28 px-3 py-2 rounded-xl border border-[#D5D2E2] text-xs focus:outline-none focus:border-[#6546D7]"
                />
              </div>

              <a
                href={selectedUploadSubmission.fileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#FAF9FC] border border-[#D5D2E2] hover:bg-[#F2EFFB] text-xs font-semibold text-[#6546D7] transition-colors cursor-pointer self-end"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Open / Download File</span>
              </a>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#322F40]">
                Teacher Feedback & Guidance *
              </label>
              <textarea
                rows={4}
                value={uploadFeedbackNote}
                onChange={(e) => setUploadFeedbackNote(e.target.value)}
                placeholder="Write specific feedback on task completion, speaking mastery, vocabulary, or pronunciation..."
                className="w-full p-3 rounded-xl border border-[#D5D2E2] text-xs focus:outline-none focus:border-[#6546D7] resize-none"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-[#ECEAF2]">
              <button
                onClick={() => setSelectedUploadSubmission(null)}
                className="px-4 py-2 text-xs text-[#636074] cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveUploadReview}
                disabled={savingUploadReview || !uploadFeedbackNote.trim()}
                className="px-5 py-2 rounded-xl bg-[#6546D7] hover:bg-[#5235BF] disabled:opacity-50 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
              >
                {savingUploadReview ? 'Saving Feedback...' : 'Save Feedback & Grade'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
