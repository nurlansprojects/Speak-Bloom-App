import React from 'react';
import { useAuth } from '../context/AuthContext';
import { SpeakBloomLogo } from './SpeakBloomLogo';
import {
  BookOpen,
  LayoutDashboard,
  GraduationCap,
  ShieldCheck,
  LogOut,
  User as UserIcon,
} from 'lucide-react';

interface NavbarProps {
  currentTab: 'student' | 'catalog' | 'teacher' | 'admin';
  setCurrentTab: (tab: 'student' | 'catalog' | 'teacher' | 'admin') => void;
  onOpenProfile: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ currentTab, setCurrentTab, onOpenProfile }) => {
  const { userProfile, logout } = useAuth();

  const isTeacher = userProfile?.role === 'teacher' || userProfile?.role === 'admin';
  const isAdmin = userProfile?.role === 'admin';

  return (
    <header className="sticky top-0 z-40 bg-white/85 backdrop-blur-md border-b border-[#E9E8F0] px-4 sm:px-8 py-3 transition-colors">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        {/* Brand with Minimalist Audio Icon */}
        <div
          onClick={() => setCurrentTab('student')}
          className="flex items-center gap-2.5 cursor-pointer select-none group"
        >
          <div className="transition-transform group-hover:scale-105 duration-200">
            <SpeakBloomLogo size="md" />
          </div>
          <div>
            <span className="text-lg font-bold tracking-tight text-[#16151E]">
              Speak <span className="text-[#6546D7]">Bloom</span>
            </span>
          </div>
        </div>

        {/* Center Navigation (Desktop) */}
        <nav className="hidden md:flex items-center gap-1 bg-[#F4F3F9] p-1 rounded-2xl border border-[#ECEAF3]">
          <button
            onClick={() => setCurrentTab('student')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              currentTab === 'student'
                ? 'bg-white text-[#6546D7] shadow-sm'
                : 'text-[#6C697A] hover:text-[#16151E]'
            }`}
          >
            <LayoutDashboard className="w-3.5 h-3.5" />
            <span>Dashboard</span>
          </button>

          <button
            onClick={() => setCurrentTab('catalog')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              currentTab === 'catalog'
                ? 'bg-white text-[#6546D7] shadow-sm'
                : 'text-[#6C697A] hover:text-[#16151E]'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Courses</span>
          </button>

          {isTeacher && (
            <button
              onClick={() => setCurrentTab('teacher')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                currentTab === 'teacher'
                  ? 'bg-white text-[#6546D7] shadow-sm'
                  : 'text-[#6C697A] hover:text-[#16151E]'
              }`}
            >
              <GraduationCap className="w-3.5 h-3.5" />
              <span>Teaching</span>
            </button>
          )}

          {isAdmin && (
            <button
              onClick={() => setCurrentTab('admin')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                currentTab === 'admin'
                  ? 'bg-white text-[#6546D7] shadow-sm'
                  : 'text-[#6C697A] hover:text-[#16151E]'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Admin</span>
            </button>
          )}
        </nav>

        {/* Right Actions: Role Tag, Profile, Logout */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Role badge */}
          <span className="hidden sm:inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold uppercase tracking-wider bg-[#F1EEFB] text-[#6546D7] border border-[#6546D7]/15">
            {userProfile?.role || 'student'}
          </span>

          {/* User Profile Button (Accessible on both Mobile & Desktop) */}
          <button
            onClick={onOpenProfile}
            title="View Profile"
            aria-label="View Profile"
            className="flex items-center gap-2 p-1 sm:p-1.5 rounded-xl hover:bg-[#F3F2F8] active:bg-[#ECEAF6] transition-colors border border-transparent hover:border-[#E5E3ED] cursor-pointer"
          >
            {userProfile?.photoURL ? (
              <img
                src={userProfile.photoURL}
                alt={userProfile.displayName}
                className="w-8 h-8 rounded-lg object-cover border border-[#D5D2E2]"
              />
            ) : (
              <div className="w-8 h-8 rounded-lg bg-[#ECEAF6] text-[#6546D7] flex items-center justify-center font-bold text-xs">
                {userProfile?.displayName?.[0]?.toUpperCase() || <UserIcon className="w-4 h-4" />}
              </div>
            )}
            <span className="hidden lg:inline text-xs font-medium text-[#22212C] max-w-[120px] truncate">
              {userProfile?.displayName}
            </span>
          </button>

          {/* Sign Out Button */}
          <button
            onClick={logout}
            title="Sign out"
            aria-label="Sign out"
            className="p-2 text-[#7E7B8D] hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Mobile bottom navigation bar (With Dedicated Profile Action) */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-[#EAE8F2] px-2 py-2 flex items-center justify-around shadow-lg">
        <button
          onClick={() => setCurrentTab('student')}
          className={`flex flex-col items-center gap-1 p-1 text-[11px] font-medium transition-colors ${
            currentTab === 'student' ? 'text-[#6546D7]' : 'text-[#7A7789]'
          }`}
        >
          <LayoutDashboard className="w-4 h-4" />
          <span>Dashboard</span>
        </button>

        <button
          onClick={() => setCurrentTab('catalog')}
          className={`flex flex-col items-center gap-1 p-1 text-[11px] font-medium transition-colors ${
            currentTab === 'catalog' ? 'text-[#6546D7]' : 'text-[#7A7789]'
          }`}
        >
          <BookOpen className="w-4 h-4" />
          <span>Courses</span>
        </button>

        {isTeacher && (
          <button
            onClick={() => setCurrentTab('teacher')}
            className={`flex flex-col items-center gap-1 p-1 text-[11px] font-medium transition-colors ${
              currentTab === 'teacher' ? 'text-[#6546D7]' : 'text-[#7A7789]'
            }`}
          >
            <GraduationCap className="w-4 h-4" />
            <span>Teaching</span>
          </button>
        )}

        {isAdmin && (
          <button
            onClick={() => setCurrentTab('admin')}
            className={`flex flex-col items-center gap-1 p-1 text-[11px] font-medium transition-colors ${
              currentTab === 'admin' ? 'text-[#6546D7]' : 'text-[#7A7789]'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Admin</span>
          </button>
        )}

        {/* Mobile Profile Navigation Item */}
        <button
          onClick={onOpenProfile}
          className="flex flex-col items-center gap-1 p-1 text-[11px] font-medium text-[#7A7789] hover:text-[#6546D7] transition-colors"
        >
          <UserIcon className="w-4 h-4" />
          <span>Profile</span>
        </button>
      </div>
    </header>
  );
};
