import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme, Theme } from '../context/ThemeContext';
import { submitTeacherApplication } from '../services/courseService';
import {
  X,
  Mail,
  Calendar,
  Shield,
  GraduationCap,
  LogOut,
  Send,
  CheckCircle2,
  Sun,
  Moon,
  Laptop,
} from 'lucide-react';

interface UserProfileModalProps {
  onClose: () => void;
}

export const UserProfileModal: React.FC<UserProfileModalProps> = ({ onClose }) => {
  const { userProfile, currentUser, logout, refreshProfile } = useAuth();
  const { theme, setTheme, resolvedTheme } = useTheme();

  // Teacher Application state
  const [showTeacherApp, setShowTeacherApp] = useState(false);
  const [experience, setExperience] = useState('');
  const [qualifications, setQualifications] = useState('');
  const [statement, setStatement] = useState('');
  const [submittingApp, setSubmittingApp] = useState(false);
  const [appSubmitted, setAppSubmitted] = useState(false);

  const handleApplyTeacher = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !userProfile) return;

    setSubmittingApp(true);
    try {
      await submitTeacherApplication({
        userId: currentUser.uid,
        userEmail: userProfile.email,
        userName: userProfile.displayName,
        experience,
        qualifications,
        statement,
      });
      setAppSubmitted(true);
    } catch (err) {
      console.error(err);
    } finally {
      setSubmittingApp(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-md w-full border border-[#ECEAF2] shadow-2xl overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-6 bg-[#FAF9FC] border-b border-[#ECEAF2] flex items-center justify-between">
          <h3 className="font-bold text-base text-[#16151E]">Learner Profile</h3>
          <button
            onClick={onClose}
            aria-label="Close"
            className="p-1.5 text-[#7E7B8D] hover:text-[#16151E] hover:bg-[#F0EEF8] rounded-xl transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Profile Content */}
        <div className="p-6 space-y-6">
          {/* User Identity Card */}
          <div className="flex items-center gap-4">
            {userProfile?.photoURL ? (
              <img
                src={userProfile.photoURL}
                alt={userProfile.displayName}
                className="w-16 h-16 rounded-2xl object-cover border border-[#D5D2E2] shadow-xs"
              />
            ) : (
              <div className="w-16 h-16 rounded-2xl bg-[#6546D7] text-white flex items-center justify-center font-bold text-2xl shadow-xs">
                {userProfile?.displayName?.[0]?.toUpperCase() || 'U'}
              </div>
            )}
            <div>
              <h4 className="font-bold text-lg text-[#16151E]">{userProfile?.displayName}</h4>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-[#F1EEFB] text-[#6546D7] mt-1">
                {userProfile?.role}
              </span>
            </div>
          </div>

          {/* Authenticated Meta Fields */}
          <div className="space-y-2.5 text-xs text-[#524E60] bg-[#FAF9FC] p-4 rounded-2xl border border-[#ECEAF2]">
            <div className="flex items-center gap-2">
              <Mail className="w-4 h-4 text-[#8C899B]" />
              <span className="font-medium text-[#252232]">{userProfile?.email}</span>
            </div>
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-[#8C899B]" />
              <span>UID: {userProfile?.id}</span>
            </div>
            {userProfile?.createdAt && (
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-[#8C899B]" />
                <span>Joined {new Date(userProfile.createdAt).toLocaleDateString()}</span>
              </div>
            )}
          </div>

          {/* Interface Theme Preference */}
          <div className="p-4 rounded-2xl bg-[#FAF9FC] border border-[#ECEAF2] space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#16151E]">Appearance Theme</span>
              <span className="text-[11px] font-semibold text-[#6546D7] uppercase tracking-wider">
                {theme}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setTheme('light')}
                className={`flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                  theme === 'light'
                    ? 'bg-white border-[#6546D7] text-[#6546D7] shadow-xs'
                    : 'bg-white/60 border-[#E2DFEC] text-[#5A5769] hover:bg-white'
                }`}
              >
                <Sun className="w-3.5 h-3.5" />
                <span>Light</span>
              </button>
              <button
                type="button"
                onClick={() => setTheme('dark')}
                className={`flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                  theme === 'dark'
                    ? 'bg-[#1D1A30] border-[#7B5CF5] text-[#8E73FA] shadow-xs'
                    : 'bg-white/60 border-[#E2DFEC] text-[#5A5769] hover:bg-white'
                }`}
              >
                <Moon className="w-3.5 h-3.5" />
                <span>Dark</span>
              </button>
              <button
                type="button"
                onClick={() => setTheme('system')}
                className={`flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                  theme === 'system'
                    ? 'bg-white border-[#6546D7] text-[#6546D7] shadow-xs'
                    : 'bg-white/60 border-[#E2DFEC] text-[#5A5769] hover:bg-white'
                }`}
              >
                <Laptop className="w-3.5 h-3.5" />
                <span>System</span>
              </button>
            </div>
          </div>

          {/* Teacher Application Section for students */}
          {userProfile?.role === 'student' && (
            <div className="p-4 rounded-2xl bg-[#F7F5FC] border border-[#6546D7]/15 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#6546D7] flex items-center gap-1.5">
                  <GraduationCap className="w-4 h-4" />
                  <span>Educator Access</span>
                </span>
                {!showTeacherApp && !appSubmitted && (
                  <button
                    onClick={() => setShowTeacherApp(true)}
                    className="text-xs font-semibold text-[#6546D7] hover:underline cursor-pointer"
                  >
                    Apply as Teacher
                  </button>
                )}
              </div>

              {appSubmitted ? (
                <div className="flex items-center gap-1.5 text-xs text-emerald-700 font-medium">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>Your teacher application has been submitted for admin review.</span>
                </div>
              ) : showTeacherApp ? (
                <form onSubmit={handleApplyTeacher} className="space-y-2.5 pt-2">
                  <input
                    type="text"
                    required
                    placeholder="Teaching experience (e.g. 3 years ESL)"
                    value={experience}
                    onChange={(e) => setExperience(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-xl border border-[#D5D2E2] bg-white text-xs"
                  />
                  <input
                    type="text"
                    required
                    placeholder="Degrees / TEFL / CELTA certifications"
                    value={qualifications}
                    onChange={(e) => setQualifications(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-xl border border-[#D5D2E2] bg-white text-xs"
                  />
                  <textarea
                    rows={2}
                    required
                    placeholder="Brief statement on your teaching goals..."
                    value={statement}
                    onChange={(e) => setStatement(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-[#D5D2E2] bg-white text-xs resize-none"
                  />
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setShowTeacherApp(false)}
                      className="px-3 py-1 text-xs text-[#636072]"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={submittingApp}
                      className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-[#6546D7] text-white text-xs font-semibold"
                    >
                      <Send className="w-3 h-3" />
                      <span>{submittingApp ? 'Submitting...' : 'Submit Application'}</span>
                    </button>
                  </div>
                </form>
              ) : (
                <p className="text-[11px] text-[#636074]">
                  Interested in designing courses and assessing student speaking? Submit an application to unlock the educator studio.
                </p>
              )}
            </div>
          )}

          {/* Sign Out Action */}
          <button
            onClick={() => {
              logout();
              onClose();
            }}
            className="w-full py-2.5 rounded-xl border border-rose-200 text-rose-700 hover:bg-rose-50 text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>
    </div>
  );
};
