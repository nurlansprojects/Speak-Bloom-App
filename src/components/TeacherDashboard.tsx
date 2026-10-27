import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Course, AssessmentAttempt, UploadedFileRecord, ActivityFormat } from '../types';
import {
  getTeacherCourses,
  getCourseSubmissionsForTeacher,
  gradeAssessmentAttempt,
  deleteCourseGlobally,
} from '../services/courseService';
import {
  getCourseSubmissionsForTeacherUploads,
  teacherReviewSubmission,
  formatFileSize,
} from '../services/uploadStorageService';
import { getActivityIcon, getActivityFormatLabel } from '../utils/activityUtils';
import { DeleteCourseModal } from './DeleteCourseModal';
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
  Trash2,
  AlertTriangle,
  Clock,
  Filter,
  PenLine,
  Mic,
  Sparkles,
  Search,
} from 'lucide-react';

interface TeacherDashboardProps {
  onCreateCourse: () => void;
  onEditCourse: (course: Course) => void;
  onPreviewCourse: (course: Course) => void;
}

export interface TeacherGradingItem {
  id: string;
  source: 'attempt' | 'upload';
  studentId: string;
  studentName: string;
  courseId: string;
  courseTitle: string;
  lessonId?: string;
  activityId?: string;
  activityTitle: string;
  format: ActivityFormat;
  content?: string;
  audioUrl?: string;
  fileUrl?: string;
  fileName?: string;
  fileType?: string;
  fileExtension?: string;
  fileSize?: number;
  status: 'submitted' | 'graded';
  score?: number;
  feedback?: string;
  submittedAt: string;
  gradedAt?: string;
  gradedByName?: string;
  rawAttempt?: AssessmentAttempt;
  rawUpload?: UploadedFileRecord;
}

export const TeacherDashboard: React.FC<TeacherDashboardProps> = ({
  onCreateCourse,
  onEditCourse,
  onPreviewCourse,
}) => {
  const { currentUser, userProfile } = useAuth();
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);

  // Unified grading submissions
  const [gradingItems, setGradingItems] = useState<TeacherGradingItem[]>([]);
  const [selectedItem, setSelectedItem] = useState<TeacherGradingItem | null>(null);

  // Filter state
  const [courseFilter, setCourseFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'submitted' | 'graded'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Grading form state
  const [inputScore, setInputScore] = useState<number | ''>(85);
  const [inputFeedback, setInputFeedback] = useState<string>('');
  const [isSavingGrade, setIsSavingGrade] = useState<boolean>(false);
  const [gradingSuccessAlert, setGradingSuccessAlert] = useState<string | null>(null);

  // Global course deletion state
  const [courseToDelete, setCourseToDelete] = useState<Course | null>(null);
  const [isDeletingCourse, setIsDeletingCourse] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteSuccessMessage, setDeleteSuccessMessage] = useState<string | null>(null);

  const canDeleteCourse = (course: Course) => {
    if (!currentUser) return false;
    const isOwner = course.teacherId === currentUser.uid;
    const isAdmin =
      userProfile?.role === 'admin' ||
      userProfile?.email?.toLowerCase() === 'cookingmaxxer@gmail.com' ||
      userProfile?.email?.toLowerCase() === 'nurlandigital@gmail.com';
    return isOwner || isAdmin;
  };

  const handleConfirmDeleteCourse = async (course: Course) => {
    setIsDeletingCourse(true);
    setDeleteError(null);
    try {
      await deleteCourseGlobally(course.id);
      setCourses((prev) => prev.filter((c) => c.id !== course.id));
      setDeleteSuccessMessage(
        `Course "${course.title}" and all associated learning data were permanently deleted.`
      );
      setCourseToDelete(null);
      setTimeout(() => {
        setDeleteSuccessMessage(null);
      }, 7000);
    } catch (err: any) {
      console.error('Course deletion failed:', err);
      setDeleteError(err.message || 'Failed to delete course. Please retry.');
    } finally {
      setIsDeletingCourse(false);
    }
  };

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

      const courseMap = new Map<string, Course>();
      myCourses.forEach((c) => courseMap.set(c.id, c));

      const items: TeacherGradingItem[] = [];

      // Fetch speaking and upload submissions across all authored courses
      for (const c of myCourses) {
        // 1. Assessment attempts (Text response, voice recording, AI partner)
        try {
          const subs = await getCourseSubmissionsForTeacher(c.id);
          for (const s of subs) {
            const isGraded =
              s.status === 'graded' ||
              (s.score !== undefined && s.score !== null) ||
              !!s.teacherComments ||
              (s.evaluator === 'ai' && (s.overallPercentage || 0) > 0);

            items.push({
              id: s.id,
              source: 'attempt',
              studentId: s.studentId,
              studentName: s.studentName || 'Student',
              courseId: s.courseId,
              courseTitle: c.title,
              lessonId: s.lessonId,
              activityId: s.activityId,
              activityTitle: s.activityTitle || getActivityFormatLabel(s.format),
              format: s.format,
              content: s.content,
              audioUrl: s.audioData,
              status: isGraded ? 'graded' : 'submitted',
              score: s.score ?? (s.overallPercentage > 0 ? Math.round(s.overallPercentage) : undefined),
              feedback: s.teacherComments || s.feedback,
              submittedAt: s.submittedAt,
              gradedAt: s.gradedAt,
              gradedByName: s.gradedByName,
              rawAttempt: s,
            });
          }
        } catch (subErr) {
          console.warn(`Could not load attempts for course ${c.id}:`, subErr);
        }

        // 2. Upload records (Student file submissions)
        try {
          const uSubs = await getCourseSubmissionsForTeacherUploads(c.id);
          for (const u of uSubs) {
            const isGraded = u.status === 'reviewed' || (u.grade !== undefined && u.grade !== null);
            items.push({
              id: u.id,
              source: 'upload',
              studentId: u.userId,
              studentName: u.userName || 'Student',
              courseId: u.courseId,
              courseTitle: c.title,
              lessonId: u.lessonId,
              activityId: u.activityId,
              activityTitle: u.title || u.fileName,
              format: 'uploading',
              fileUrl: u.fileUrl,
              fileName: u.fileName,
              fileType: u.fileType,
              fileExtension: u.fileExtension,
              fileSize: u.fileSize,
              status: isGraded ? 'graded' : 'submitted',
              score: u.grade,
              feedback: u.feedback,
              submittedAt: u.createdAt,
              gradedAt: u.reviewedAt,
              gradedByName: u.reviewedByName,
              rawUpload: u,
            });
          }
        } catch (uErr) {
          console.warn(`Could not load uploads for course ${c.id}:`, uErr);
        }
      }

      // Sort newest submissions first
      items.sort(
        (a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()
      );
      setGradingItems(items);
    } catch (err) {
      console.error('Error loading teacher data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenGradingModal = (item: TeacherGradingItem) => {
    setSelectedItem(item);
    setInputScore(item.score !== undefined && item.score !== null ? item.score : 85);
    setInputFeedback(item.feedback || '');
  };

  const handleSaveGradeAndFeedback = async () => {
    if (!selectedItem || !currentUser || !userProfile) return;

    const numScore = typeof inputScore === 'number' ? Math.max(0, Math.min(100, inputScore)) : 80;
    const cleanFeedback = inputFeedback.trim();

    setIsSavingGrade(true);
    try {
      if (selectedItem.source === 'attempt') {
        const course = courses.find((c) => c.id === selectedItem.courseId);
        const masteryThreshold = course?.masteryThreshold || 75;

        await gradeAssessmentAttempt(
          selectedItem.id,
          numScore,
          cleanFeedback,
          currentUser.uid,
          userProfile.displayName || 'Instructor',
          masteryThreshold
        );
      } else {
        // Upload record
        await teacherReviewSubmission(
          selectedItem.id,
          cleanFeedback,
          numScore,
          currentUser.uid,
          userProfile.displayName || 'Instructor'
        );
      }

      // Immediate optimistic update of the local items list
      setGradingItems((prev) =>
        prev.map((item) =>
          item.id === selectedItem.id
            ? {
                ...item,
                status: 'graded',
                score: numScore,
                feedback: cleanFeedback,
                gradedAt: new Date().toISOString(),
                gradedByName: userProfile.displayName || 'Instructor',
              }
            : item
        )
      );

      setGradingSuccessAlert(
        `Grade (${numScore}/100) and feedback saved for ${selectedItem.studentName}.`
      );
      setSelectedItem(null);

      setTimeout(() => {
        setGradingSuccessAlert(null);
      }, 5000);
    } catch (err: any) {
      console.error('Failed to save teacher grade:', err);
      alert(err.message || 'Failed to save grade and feedback. Please try again.');
    } finally {
      setIsSavingGrade(false);
    }
  };

  // Filtered submissions
  const filteredSubmissions = gradingItems.filter((item) => {
    if (courseFilter !== 'all' && item.courseId !== courseFilter) return false;
    if (typeFilter !== 'all' && item.format !== typeFilter) return false;
    if (statusFilter !== 'all' && item.status !== statusFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = item.studentName.toLowerCase().includes(q);
      const matchTitle = item.activityTitle.toLowerCase().includes(q);
      const matchContent = item.content?.toLowerCase().includes(q);
      const matchFile = item.fileName?.toLowerCase().includes(q);
      if (!matchName && !matchTitle && !matchContent && !matchFile) return false;
    }
    return true;
  });

  // Quantitative Stats
  const publishedCoursesCount = courses.filter((c) => c.status === 'published').length;
  const draftCoursesCount = courses.filter((c) => c.status === 'draft').length;
  const totalSubmissions = gradingItems.length;
  const pendingCount = gradingItems.filter((s) => s.status === 'submitted').length;
  const gradedCount = gradingItems.filter((s) => s.status === 'graded').length;

  return (
    <div className="space-y-8 animate-in fade-in duration-200">
      {/* Header Banner */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-[#ECEAF2] shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider px-2.5 py-1 rounded-lg bg-[#F1EEFB] text-[#6546D7]">
              Educator Studio
            </span>
            <span className="text-xs text-[#7A778A]">Instructor Dashboard</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#16151E]">
            Teacher Assessment & Grading
          </h1>
          <p className="text-sm text-[#524F60] mt-1">
            Evaluate student coursework for Text Response, Voice Recording, and File Uploading with real database persistence.
          </p>
        </div>

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
          <div className="text-xs font-semibold text-[#787588]">Total Submissions</div>
          <div className="text-2xl font-extrabold text-[#16151E] mt-1">{totalSubmissions}</div>
          <div className="text-[11px] text-[#79768A] mt-0.5">Across all authored courses</div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-[#ECEAF2]">
          <div className="text-xs font-semibold text-amber-700">Awaiting Teacher Review</div>
          <div className="text-2xl font-extrabold text-amber-600 mt-1">{pendingCount}</div>
          <div className="text-[11px] text-amber-700/80 mt-0.5">
            Pending grade & feedback
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-[#ECEAF2]">
          <div className="text-xs font-semibold text-emerald-700">Graded & Evaluated</div>
          <div className="text-2xl font-extrabold text-emerald-600 mt-1">{gradedCount}</div>
          <div className="text-[11px] text-emerald-700/80 mt-0.5">Scores & feedback delivered</div>
        </div>
      </div>

      {/* Success Alert Banner */}
      {gradingSuccessAlert && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex items-center justify-between gap-3 animate-in fade-in duration-200">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="font-medium">{gradingSuccessAlert}</span>
          </div>
          <button
            onClick={() => setGradingSuccessAlert(null)}
            className="text-emerald-700 hover:text-emerald-950 p-1 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Courses List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-[#181624] flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-[#6546D7]" />
            <span>My Authored Courses</span>
          </h2>
        </div>

        {deleteSuccessMessage && (
          <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center justify-between gap-3 animate-in fade-in duration-200">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{deleteSuccessMessage}</span>
            </div>
            <button
              onClick={() => setDeleteSuccessMessage(null)}
              className="text-emerald-700 hover:text-emerald-950 p-1 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

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

                <div className="pt-3 border-t border-[#F2EFF7] flex flex-wrap items-center justify-end gap-2">
                  <button
                    onClick={() => onPreviewCourse(course)}
                    className="px-3.5 py-2 rounded-xl border border-[#D8D5E5] text-xs font-medium text-[#4B485A] hover:bg-[#FAF9FC] transition-colors cursor-pointer"
                  >
                    Preview Student View
                  </button>
                  <button
                    onClick={() => onEditCourse(course)}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#6546D7] hover:bg-[#5235BE] text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>Edit Curriculum</span>
                  </button>
                  {canDeleteCourse(course) && (
                    <button
                      onClick={() => {
                        setDeleteError(null);
                        setCourseToDelete(course);
                      }}
                      className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-rose-200 text-rose-700 hover:bg-rose-50 hover:border-rose-300 text-xs font-semibold transition-colors cursor-pointer"
                      title="Delete Course permanently"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Delete Course</span>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ========================================================= */}
      {/* SECTION: TEACHER ASSESSMENT DASHBOARD                     */}
      {/* Unified submissions queue for Text, Voice, and File Upload */}
      {/* ========================================================= */}
      <div className="space-y-4 pt-4 border-t border-[#ECEAF2]">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-[#181624] flex items-center gap-2">
              <Award className="w-5 h-5 text-[#6546D7]" />
              <span>Student Submissions & Teacher Grading</span>
            </h2>
            <p className="text-xs text-[#716D81] mt-0.5">
              Review and grade submissions for Text Response, Voice Recording, and File Uploading.
            </p>
          </div>

          {/* Quick status tabs */}
          <div className="flex items-center gap-1.5 bg-[#F4F2F9] p-1 rounded-2xl shrink-0">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                statusFilter === 'all'
                  ? 'bg-white text-[#181624] shadow-xs'
                  : 'text-[#646073] hover:text-[#181624]'
              }`}
            >
              All ({gradingItems.length})
            </button>
            <button
              onClick={() => setStatusFilter('submitted')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                statusFilter === 'submitted'
                  ? 'bg-white text-amber-800 shadow-xs'
                  : 'text-[#646073] hover:text-amber-800'
              }`}
            >
              <Clock className="w-3 h-3 text-amber-600" />
              <span>Pending Review ({pendingCount})</span>
            </button>
            <button
              onClick={() => setStatusFilter('graded')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                statusFilter === 'graded'
                  ? 'bg-white text-emerald-800 shadow-xs'
                  : 'text-[#646073] hover:text-emerald-800'
              }`}
            >
              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
              <span>Graded ({gradedCount})</span>
            </button>
          </div>
        </div>

        {/* Filter Toolbar: Course, Activity Type, Search */}
        <div className="bg-white p-4 rounded-2xl border border-[#ECEAF2] shadow-xs flex flex-wrap items-center gap-3">
          {/* Course filter */}
          <div className="flex items-center gap-2 min-w-[200px] flex-1">
            <span className="text-xs font-bold text-[#6D697C] shrink-0">Course:</span>
            <select
              value={courseFilter}
              onChange={(e) => setCourseFilter(e.target.value)}
              className="w-full text-xs font-semibold px-3 py-2 rounded-xl border border-[#D7D4E3] bg-[#FAF9FD] text-[#242131] focus:outline-none focus:border-[#6546D7]"
            >
              <option value="all">All Authored Courses</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </select>
          </div>

          {/* Activity Type filter */}
          <div className="flex items-center gap-2 min-w-[200px] flex-1">
            <span className="text-xs font-bold text-[#6D697C] shrink-0">Activity Type:</span>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="w-full text-xs font-semibold px-3 py-2 rounded-xl border border-[#D7D4E3] bg-[#FAF9FD] text-[#242131] focus:outline-none focus:border-[#6546D7]"
            >
              <option value="all">All Activity Types</option>
              <option value="text">Text Response / Preparation</option>
              <option value="recording">Voice Recording</option>
              <option value="uploading">File Uploading</option>
              <option value="ai_conversation">AI Speaking Partner</option>
            </select>
          </div>

          {/* Search box */}
          <div className="relative min-w-[180px] flex-1">
            <Search className="w-3.5 h-3.5 text-[#928FA1] absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search by student or title..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full text-xs pl-8 pr-3 py-2 rounded-xl border border-[#D7D4E3] bg-[#FAF9FD] text-[#242131] focus:outline-none focus:border-[#6546D7]"
            />
          </div>
        </div>

        {/* Submissions List */}
        {loading ? (
          <div className="py-12 flex justify-center">
            <div className="w-6 h-6 border-2 border-[#6546D7] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filteredSubmissions.length === 0 ? (
          <div className="bg-white rounded-3xl p-10 text-center border border-[#ECEAF2] space-y-2">
            <Award className="w-8 h-8 text-[#A5A2B5] mx-auto mb-2" />
            <h4 className="text-sm font-bold text-[#1E1C2B]">No student submissions found</h4>
            <p className="text-xs text-[#747183] max-w-sm mx-auto">
              {gradingItems.length === 0
                ? 'When students submit responses for Text Preparation, Voice Recording, or File Uploading, their submissions will automatically appear here for teacher review.'
                : 'No submissions matched your selected course, activity type, or grading status filters.'}
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-3xl border border-[#ECEAF2] shadow-xs overflow-hidden">
            <div className="divide-y divide-[#ECEAF2]">
              {filteredSubmissions.map((item) => (
                <div
                  key={`${item.source}_${item.id}`}
                  className="p-5 hover:bg-[#FAF9FC] transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="flex items-start gap-3.5">
                    <div className="p-2.5 rounded-xl bg-[#FAF9FC] border border-[#ECEAF2] shrink-0 mt-0.5">
                      {getActivityIcon(item.format, 'w-4 h-4 text-[#6546D7]')}
                    </div>

                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-bold text-xs text-[#16151E]">{item.studentName}</span>
                        <span className="text-[10px] text-[#868394]">•</span>
                        <span className="text-[11px] font-semibold text-[#6546D7]">
                          {item.courseTitle}
                        </span>
                        <span className="text-[10px] text-[#868394]">•</span>
                        <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-[#FAF9FC] border border-[#E9E7F1] text-[#615E70] flex items-center gap-1">
                          {getActivityIcon(item.format, 'w-3 h-3 text-[#6546D7]')}
                          <span>{getActivityFormatLabel(item.format)}</span>
                        </span>

                        {/* Status Badge */}
                        {item.status === 'graded' ? (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>Graded: {item.score ?? 0}/100</span>
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200 flex items-center gap-1">
                            <Clock className="w-3 h-3 animate-pulse" />
                            <span>Submitted — Awaiting Review</span>
                          </span>
                        )}
                      </div>

                      <div className="text-xs font-bold text-[#2A2838]">
                        {item.activityTitle}
                      </div>

                      {/* Content Preview based on format */}
                      {item.format === 'text' && item.content && (
                        <p className="text-xs text-[#4F4B5E] italic line-clamp-2 bg-[#FAF9FC] p-2 rounded-xl border border-[#EBE8F3]">
                          "{item.content}"
                        </p>
                      )}

                      {item.format === 'recording' && item.audioUrl && (
                        <div className="flex items-center gap-3 pt-1">
                          <audio src={item.audioUrl} controls className="h-8 w-60 rounded-lg" />
                          <span className="text-[11px] text-[#7A778A]">Audio Recording</span>
                        </div>
                      )}

                      {item.format === 'uploading' && item.fileUrl && (
                        <div className="flex items-center gap-2 pt-0.5 text-xs text-[#625E72]">
                          <FileText className="w-3.5 h-3.5 text-[#6546D7]" />
                          <span className="font-medium text-[#1E1C2B]">{item.fileName}</span>
                          {item.fileSize && (
                            <span className="text-[10px] text-[#868394]">
                              ({formatFileSize(item.fileSize)})
                            </span>
                          )}
                        </div>
                      )}

                      <p className="text-[11px] text-[#7B788C]">
                        Submitted on {new Date(item.submittedAt).toLocaleDateString()} at{' '}
                        {new Date(item.submittedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        {item.gradedAt && (
                          <span className="ml-2 text-emerald-700 font-medium">
                            • Evaluated {new Date(item.gradedAt).toLocaleDateString()}
                          </span>
                        )}
                      </p>

                      {/* Teacher's recorded feedback preview if graded */}
                      {item.feedback && (
                        <div className="text-[11px] text-[#44378A] bg-[#F1EEFB] p-2 rounded-xl border border-[#DDD7F5] mt-1">
                          <span className="font-semibold text-[#6546D7]">Your Feedback: </span>
                          {item.feedback}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 shrink-0 self-start md:self-auto">
                    {/* External download / view link for uploads or audio */}
                    {(item.fileUrl || item.audioUrl) && (
                      <a
                        href={item.fileUrl || item.audioUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#D5D2E2] hover:bg-white text-xs font-semibold text-[#6546D7] transition-colors cursor-pointer"
                        title="Download or inspect student submission"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>Inspect File</span>
                      </a>
                    )}

                    <button
                      onClick={() => handleOpenGradingModal(item)}
                      className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold shadow-xs transition-colors cursor-pointer ${
                        item.status === 'graded'
                          ? 'bg-white border border-[#6546D7]/40 text-[#6546D7] hover:bg-[#F2EFFC]'
                          : 'bg-[#6546D7] hover:bg-[#5235BE] text-white'
                      }`}
                    >
                      <Award className="w-3.5 h-3.5" />
                      <span>{item.status === 'graded' ? 'Edit Grade & Feedback' : 'Grade Submission'}</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ========================================================= */}
      {/* UNIFIED TEACHER GRADING MODAL                             */}
      {/* Supports Text Response, Voice Recording, and File Upload   */}
      {/* ========================================================= */}
      {selectedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-xl w-full border border-[#ECEAF2] shadow-2xl overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="p-6 bg-gradient-to-br from-[#6546D7] to-[#492EB2] text-white flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-white/80 flex items-center gap-1.5">
                  {getActivityIcon(selectedItem.format, 'w-3.5 h-3.5 text-white')}
                  <span>Teacher Assessment • {getActivityFormatLabel(selectedItem.format)}</span>
                </span>
                <h3 className="text-xl font-bold tracking-tight text-white mt-0.5">
                  Evaluate {selectedItem.studentName}'s Work
                </h3>
                <p className="text-xs text-white/85 mt-0.5">
                  {selectedItem.courseTitle} • {selectedItem.activityTitle}
                </p>
              </div>

              <button
                onClick={() => setSelectedItem(null)}
                className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-5 max-h-[70vh] overflow-y-auto">
              {/* Submission Information & Display */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-[#6D697D] uppercase tracking-wider">
                  <span>Student Submission Content</span>
                  <span>Submitted {new Date(selectedItem.submittedAt).toLocaleDateString()}</span>
                </div>

                {/* A. Text Response Submission */}
                {selectedItem.format === 'text' && (
                  <div className="p-4 rounded-2xl bg-[#FAF9FD] border border-[#ECEAF2] space-y-2">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-[#6546D7]">
                      <PenLine className="w-3.5 h-3.5" />
                      <span>Full Student Written Response:</span>
                    </div>
                    <div className="p-3.5 rounded-xl bg-white border border-[#EBE8F3] text-sm text-[#1E1C2B] leading-relaxed whitespace-pre-wrap font-sans max-h-60 overflow-y-auto select-text">
                      {selectedItem.content || 'No text content provided.'}
                    </div>
                    {selectedItem.content && (
                      <div className="text-[11px] text-[#787588] text-right">
                        {selectedItem.content.trim().split(/\s+/).length} words
                      </div>
                    )}
                  </div>
                )}

                {/* B. Voice Recording Submission */}
                {selectedItem.format === 'recording' && (
                  <div className="p-4 rounded-2xl bg-[#FAF9FD] border border-[#ECEAF2] space-y-3">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-[#6546D7]">
                      <Mic className="w-3.5 h-3.5" />
                      <span>Student Voice Recording:</span>
                    </div>

                    {selectedItem.audioUrl ? (
                      <div className="space-y-2">
                        <audio src={selectedItem.audioUrl} controls className="w-full h-11 rounded-xl" />
                        <div className="flex justify-end">
                          <a
                            href={selectedItem.audioUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-[#6546D7] hover:underline"
                          >
                            <ExternalLink className="w-3 h-3" />
                            <span>Open Audio File</span>
                          </a>
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-[#716E82] italic">
                        Spoken audio submitted: "{selectedItem.content}"
                      </p>
                    )}
                  </div>
                )}

                {/* C. File Uploading Submission */}
                {selectedItem.format === 'uploading' && (
                  <div className="p-4 rounded-2xl bg-[#FAF9FD] border border-[#ECEAF2] space-y-3">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-[#6546D7]">
                      <UploadCloud className="w-3.5 h-3.5" />
                      <span>Uploaded File Submission:</span>
                    </div>

                    <div className="p-3 rounded-xl bg-white border border-[#EBE8F3] flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <FileText className="w-5 h-5 text-[#6546D7]" />
                        <div>
                          <div className="text-xs font-bold text-[#1E1C2B]">{selectedItem.fileName}</div>
                          <div className="text-[11px] text-[#716E82]">
                            {selectedItem.fileExtension?.toUpperCase()} •{' '}
                            {selectedItem.fileSize ? formatFileSize(selectedItem.fileSize) : 'File'}
                          </div>
                        </div>
                      </div>

                      {selectedItem.fileUrl && (
                        <a
                          href={selectedItem.fileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#FAF9FD] border border-[#6546D7]/30 text-xs font-semibold text-[#6546D7] hover:bg-[#F2EFFC]"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>Download</span>
                        </a>
                      )}
                    </div>
                  </div>
                )}

                {/* D. AI Conversation (fallback / view) */}
                {selectedItem.format === 'ai_conversation' && (
                  <div className="p-4 rounded-2xl bg-[#FAF9FD] border border-[#ECEAF2] space-y-2">
                    <div className="text-xs font-semibold text-[#6546D7]">Conversation Transcript:</div>
                    <div className="p-3 rounded-xl bg-white border border-[#EBE8F3] text-xs text-[#1E1C2B] italic max-h-48 overflow-y-auto">
                      "{selectedItem.content}"
                    </div>
                  </div>
                )}
              </div>

              {/* Grading Input: Numerical Score 0 - 100 */}
              <div className="space-y-2 pt-2 border-t border-[#ECEAF2]">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-[#1E1C2B] flex items-center gap-1.5">
                    <Award className="w-4 h-4 text-[#6546D7]" />
                    <span>Assign Numerical Score (0 – 100)</span>
                  </label>
                  <span className="text-xs font-semibold text-[#6546D7]">
                    Passing threshold: 75%
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={inputScore}
                    onChange={(e) => {
                      const val = e.target.value === '' ? '' : parseInt(e.target.value, 10);
                      setInputScore(val);
                    }}
                    placeholder="e.g. 85"
                    className="w-28 px-3.5 py-2.5 rounded-xl border border-[#D5D2E2] text-sm font-bold text-[#16151E] focus:outline-none focus:border-[#6546D7]"
                  />

                  {/* Quick score buttons */}
                  <div className="flex items-center gap-1.5 overflow-x-auto">
                    {[70, 75, 80, 85, 90, 95, 100].map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setInputScore(preset)}
                        className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                          inputScore === preset
                            ? 'bg-[#6546D7] text-white'
                            : 'bg-[#F2EFF8] text-[#555263] hover:bg-[#EAE6F4]'
                        }`}
                      >
                        {preset}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Feedback Input: Written Feedback */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#1E1C2B] flex items-center gap-1.5">
                  <MessageSquare className="w-4 h-4 text-[#6546D7]" />
                  <span>Written Feedback for Student</span>
                </label>
                <textarea
                  rows={4}
                  value={inputFeedback}
                  onChange={(e) => setInputFeedback(e.target.value)}
                  placeholder="Provide targeted guidance on speaking clarity, grammatical structures, task completion, and vocabulary development..."
                  className="w-full p-3.5 rounded-2xl border border-[#D5D2E2] text-xs sm:text-sm focus:outline-none focus:border-[#6546D7] leading-relaxed resize-none font-sans"
                />
              </div>
            </div>

            {/* Modal Actions */}
            <div className="p-5 bg-[#FAF9FC] border-t border-[#ECEAF2] flex items-center justify-between">
              <button
                onClick={() => setSelectedItem(null)}
                className="px-4 py-2 text-xs font-semibold text-[#575365] hover:text-[#181622] cursor-pointer"
              >
                Cancel
              </button>

              <button
                onClick={handleSaveGradeAndFeedback}
                disabled={isSavingGrade || inputScore === ''}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#6546D7] hover:bg-[#5235BE] disabled:opacity-50 text-white text-xs font-semibold shadow-xs transition-all cursor-pointer"
              >
                {isSavingGrade ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Saving Grade & Feedback...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Save Grade & Feedback</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Global Course Deletion Confirmation Modal */}
      {courseToDelete && (
        <DeleteCourseModal
          course={courseToDelete}
          isOpen={!!courseToDelete}
          isDeleting={isDeletingCourse}
          error={deleteError}
          onConfirmDelete={handleConfirmDeleteCourse}
          onClose={() => {
            setCourseToDelete(null);
            setDeleteError(null);
          }}
        />
      )}
    </div>
  );
};
