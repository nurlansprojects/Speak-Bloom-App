import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { TeacherApplication, Course } from '../types';
import {
  getPendingTeacherApplications,
  reviewTeacherApplication,
  deleteCourseGlobally,
} from '../services/courseService';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { DeleteCourseModal } from './DeleteCourseModal';
import {
  ShieldCheck,
  CheckCircle,
  XCircle,
  Clock,
  UserCheck,
  BookOpen,
  Trash2,
  Search,
  Layers,
  Award,
  RefreshCw,
  X,
  CheckCircle2,
} from 'lucide-react';

export const AdminDashboard: React.FC = () => {
  const { currentUser, userProfile, updateRole } = useAuth();
  const [applications, setApplications] = useState<TeacherApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  // Platform courses management
  const [courses, setCourses] = useState<Course[]>([]);
  const [loadingCourses, setLoadingCourses] = useState(true);
  const [courseSearch, setCourseSearch] = useState('');
  const [courseToDelete, setCourseToDelete] = useState<Course | null>(null);
  const [isDeletingCourse, setIsDeletingCourse] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteSuccess, setDeleteSuccess] = useState<string | null>(null);

  useEffect(() => {
    loadApplications();
    loadAllPlatformCourses();
  }, []);

  const loadAllPlatformCourses = async () => {
    setLoadingCourses(true);
    try {
      const snap = await getDocs(collection(db, 'courses'));
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Course));
      setCourses(list);
    } catch (err) {
      console.error('Failed loading platform courses:', err);
    } finally {
      setLoadingCourses(false);
    }
  };

  const handleAdminDeleteCourse = async (course: Course) => {
    setIsDeletingCourse(true);
    setDeleteError(null);
    try {
      await deleteCourseGlobally(course.id);
      setCourses((prev) => prev.filter((c) => c.id !== course.id));
      setDeleteSuccess(`Course "${course.title}" was permanently deleted by Administrator.`);
      setCourseToDelete(null);
      setTimeout(() => setDeleteSuccess(null), 6000);
    } catch (err: any) {
      console.error('Admin course deletion failed:', err);
      setDeleteError(err.message || 'Failed to delete course.');
    } finally {
      setIsDeletingCourse(false);
    }
  };

  const loadApplications = async () => {
    setLoading(true);
    try {
      const apps = await getPendingTeacherApplications();
      setApplications(apps);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleReview = async (appId: string, status: 'approved' | 'rejected') => {
    if (!currentUser) return;
    setProcessingId(appId);
    try {
      await reviewTeacherApplication(appId, status, currentUser.uid);
      await loadApplications();
    } catch (err) {
      console.error(err);
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-200">
      {/* Header */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-[#ECEAF2] shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider px-2.5 py-1 rounded-lg bg-[#F1EEFB] text-[#6546D7]">
              Platform Administration
            </span>
            <span className="text-xs text-[#757285]">Authorized Console</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#16151E]">
            Admin Control Center
          </h1>
          <p className="text-sm text-[#545163] mt-1">
            Review educator onboarding requests, enforce role-based access control, and audit educational content.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-[#F0EDFB] text-[#6546D7] flex items-center justify-center">
            <ShieldCheck className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Role Management Notice */}
      <div className="bg-[#FAF9FC] p-5 rounded-3xl border border-[#ECEAF2] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h4 className="text-xs font-bold uppercase tracking-wider text-[#6546D7] mb-1">
            Active Administrator Session
          </h4>
          <p className="text-xs text-[#4E4B5E]">
            Signed in as <strong>{userProfile?.email}</strong>. Bootstrapped with verified administrator privileges.
          </p>
        </div>

        {/* Quick testing switch for admin testing teacher / student views */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => updateRole('teacher')}
            className="px-3 py-1.5 rounded-xl border border-[#D5D2E2] bg-white text-xs font-semibold text-[#484557] hover:bg-[#F2EFFC]"
          >
            Switch to Teacher Mode
          </button>
          <button
            onClick={() => updateRole('student')}
            className="px-3 py-1.5 rounded-xl border border-[#D5D2E2] bg-white text-xs font-semibold text-[#484557] hover:bg-[#F2EFFC]"
          >
            Switch to Student Mode
          </button>
          <button
            onClick={() => updateRole('admin')}
            className="px-3 py-1.5 rounded-xl bg-[#6546D7] text-white text-xs font-semibold shadow-xs"
          >
            Admin Mode
          </button>
        </div>
      </div>

      {/* Pending Teacher Applications */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-[#181624] flex items-center gap-2">
            <UserCheck className="w-5 h-5 text-[#6546D7]" />
            <span>Educator Applications ({applications.length})</span>
          </h2>
        </div>

        {loading ? (
          <div className="py-12 flex justify-center">
            <div className="w-6 h-6 border-2 border-[#6546D7] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : applications.length === 0 ? (
          <div className="bg-white rounded-3xl p-10 text-center border border-[#ECEAF2]">
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-2">
              <CheckCircle className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-sm text-[#16151E]">No pending applications</h3>
            <p className="text-xs text-[#716E80] mt-1">
              All educator access requests have been reviewed.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {applications.map((app) => (
              <div
                key={app.id}
                className="bg-white rounded-3xl p-6 border border-[#ECEAF2] shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-6"
              >
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-[#181624]">{app.userName}</span>
                    <span className="text-xs text-[#767385]">({app.userEmail})</span>
                  </div>

                  <div className="text-xs text-[#484558] space-y-1">
                    <div>
                      <span className="font-semibold text-[#181624]">Experience:</span>{' '}
                      {app.experience}
                    </div>
                    <div>
                      <span className="font-semibold text-[#181624]">Credentials:</span>{' '}
                      {app.qualifications}
                    </div>
                    <div>
                      <span className="font-semibold text-[#181624]">Statement:</span>{' '}
                      {app.statement}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => handleReview(app.id, 'rejected')}
                    disabled={processingId === app.id}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-rose-200 text-xs font-semibold text-rose-700 hover:bg-rose-50 transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    <XCircle className="w-4 h-4" />
                    <span>Decline</span>
                  </button>

                  <button
                    onClick={() => handleReview(app.id, 'approved')}
                    disabled={processingId === app.id}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition-colors disabled:opacity-50 cursor-pointer shadow-xs"
                  >
                    <CheckCircle className="w-4 h-4" />
                    <span>Approve as Teacher</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Platform Course Management Section */}
      <div className="space-y-4 pt-4 border-t border-[#ECEAF2]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-[#181624] flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-[#6546D7]" />
              <span>Platform Course Directory & Management ({courses.length})</span>
            </h2>
            <p className="text-xs text-[#706D7F] mt-0.5">
              Administratively review and manage educational content published across all teachers.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-[#868397] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={courseSearch}
                onChange={(e) => setCourseSearch(e.target.value)}
                placeholder="Search by title or teacher..."
                className="pl-8 pr-3 py-1.5 rounded-xl border border-[#D5D2E2] bg-white text-xs text-[#181624] focus:outline-none focus:border-[#6546D7] w-48 sm:w-64"
              />
            </div>
            <button
              onClick={loadAllPlatformCourses}
              disabled={loadingCourses}
              className="p-2 rounded-xl border border-[#D5D2E2] bg-white hover:bg-[#FAF9FC] text-[#555263] transition-colors cursor-pointer"
              title="Refresh courses list"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingCourses ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Success Alert Banner */}
        {deleteSuccess && (
          <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center justify-between gap-3 animate-in fade-in duration-200">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{deleteSuccess}</span>
            </div>
            <button
              onClick={() => setDeleteSuccess(null)}
              className="text-emerald-700 hover:text-emerald-950 p-1 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {loadingCourses ? (
          <div className="py-12 flex justify-center">
            <div className="w-6 h-6 border-2 border-[#6546D7] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : courses.length === 0 ? (
          <div className="bg-white rounded-3xl p-10 text-center border border-[#ECEAF2]">
            <p className="text-xs text-[#706D7F]">No courses currently published on the platform.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {courses
              .filter(
                (c) =>
                  !courseSearch ||
                  c.title.toLowerCase().includes(courseSearch.toLowerCase()) ||
                  c.teacherName.toLowerCase().includes(courseSearch.toLowerCase())
              )
              .map((c) => (
                <div
                  key={c.id}
                  className="bg-white rounded-3xl p-5 sm:p-6 border border-[#ECEAF2] shadow-xs flex flex-col justify-between space-y-4"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-[#F1EEFB] text-[#6546D7]">
                        CEFR {c.cefrLevel}
                      </span>
                      <span
                        className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                          c.status === 'published'
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-amber-50 text-amber-700'
                        }`}
                      >
                        {c.status}
                      </span>
                    </div>

                    <h4 className="font-bold text-sm text-[#181624]">{c.title}</h4>
                    <p className="text-xs text-[#666375] line-clamp-2">{c.description}</p>

                    <div className="flex items-center gap-4 text-xs text-[#757284] pt-1">
                      <span>Instructor: <strong className="text-[#181624]">{c.teacherName}</strong></span>
                      <span>•</span>
                      <span>{c.modulesCount || 0} Modules</span>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-[#F2EFF7] flex items-center justify-between gap-2">
                    <span className="text-[11px] text-[#868397]">
                      Created {new Date(c.createdAt).toLocaleDateString()}
                    </span>

                    <button
                      onClick={() => {
                        setDeleteError(null);
                        setCourseToDelete(c);
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-rose-200 text-rose-700 hover:bg-rose-50 hover:border-rose-300 text-xs font-semibold transition-colors cursor-pointer"
                      title="Admin Delete Course"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Delete Course</span>
                    </button>
                  </div>
                </div>
              ))}
          </div>
        )}
      </div>

      {/* Admin Course Deletion Confirmation Dialog */}
      <DeleteCourseModal
        course={courseToDelete}
        isOpen={!!courseToDelete}
        onClose={() => {
          if (!isDeletingCourse) {
            setCourseToDelete(null);
            setDeleteError(null);
          }
        }}
        onConfirmDelete={handleAdminDeleteCourse}
        isDeleting={isDeletingCourse}
        error={deleteError}
      />
    </div>
  );
};
