import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { TeacherApplication } from '../types';
import {
  getPendingTeacherApplications,
  reviewTeacherApplication,
} from '../services/courseService';
import {
  ShieldCheck,
  CheckCircle,
  XCircle,
  Clock,
  UserCheck,
} from 'lucide-react';

export const AdminDashboard: React.FC = () => {
  const { currentUser, userProfile, updateRole } = useAuth();
  const [applications, setApplications] = useState<TeacherApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  useEffect(() => {
    loadApplications();
  }, []);

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
    </div>
  );
};
