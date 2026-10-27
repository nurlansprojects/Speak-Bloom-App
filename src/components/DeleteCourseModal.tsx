import React, { useState } from 'react';
import { Course } from '../types';
import {
  AlertTriangle,
  Trash2,
  X,
  RefreshCw,
  Layers,
  Users,
  FileText,
  ShieldAlert,
} from 'lucide-react';

interface DeleteCourseModalProps {
  course: Course | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirmDelete: (course: Course) => Promise<void>;
  isDeleting: boolean;
  error?: string | null;
}

export const DeleteCourseModal: React.FC<DeleteCourseModalProps> = ({
  course,
  isOpen,
  onClose,
  onConfirmDelete,
  isDeleting,
  error,
}) => {
  const [confirmed, setConfirmed] = useState(false);

  if (!isOpen || !course) return null;

  const handleDelete = async () => {
    if (!confirmed || isDeleting) return;
    await onConfirmDelete(course);
  };

  const handleClose = () => {
    if (isDeleting) return;
    setConfirmed(false);
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-course-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
    >
      <div className="bg-white w-full max-w-lg rounded-3xl border border-rose-200 shadow-2xl overflow-hidden flex flex-col">
        {/* Modal Header */}
        <div className="p-6 pb-4 border-b border-[#ECEAF2] bg-rose-50/40 flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-rose-100 text-rose-700">
                  Permanent Removal
                </span>
                <span className="text-xs text-[#7B788C]">Global Deletion</span>
              </div>
              <h2 id="delete-course-title" className="text-lg font-bold text-[#181624] mt-0.5">
                Delete Course
              </h2>
            </div>
          </div>

          <button
            onClick={handleClose}
            disabled={isDeleting}
            aria-label="Close dialog"
            className="p-1.5 rounded-xl text-[#787588] hover:text-[#181624] hover:bg-white disabled:opacity-50 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-4 text-xs">
          {/* Target Course Highlight */}
          <div className="p-4 rounded-2xl bg-[#FAF9FC] border border-[#ECEAF2] space-y-1.5">
            <div className="text-[10px] font-bold uppercase tracking-wider text-[#6546D7]">
              Course to be permanently deleted
            </div>
            <div className="text-sm font-bold text-[#181624]">{course.title}</div>
            <div className="text-[#6D6A7C] flex items-center gap-3 text-[11px] pt-1">
              <span>{course.modulesCount || 0} Modules</span>
              <span>•</span>
              <span>Instructor: {course.teacherName}</span>
            </div>
          </div>

          {/* Impact Warning */}
          <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200/80 space-y-2 text-rose-900">
            <div className="flex items-center gap-2 font-bold text-rose-800">
              <ShieldAlert className="w-4 h-4 shrink-0 text-rose-600" />
              <span>This action cannot be undone</span>
            </div>
            <p className="leading-relaxed">
              Deleting this course removes it from Speak Bloom globally. It will be permanently removed
              from:
            </p>
            <ul className="list-disc pl-5 space-y-1 text-rose-950/90 text-[11px]">
              <li>All enrolled students' dashboards and study lists</li>
              <li>Public course catalogs, discovery, and search results</li>
              <li>All course modules, topics, lessons, and interactive speaking activities</li>
              <li>All associated uploaded lesson materials, audio, video, and assignment files</li>
              <li>Student progress records and active learning gate data</li>
            </ul>
          </div>

          {/* Error Banner if any */}
          {error && (
            <div className="p-3.5 rounded-xl bg-rose-100 border border-rose-300 text-rose-900 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-rose-700" />
              <div className="leading-relaxed">
                <span className="font-bold">Deletion Failed: </span>
                <span>{error}</span>
                <div className="text-[11px] mt-0.5 text-rose-800">
                  The course remains available. You can safely retry or cancel.
                </div>
              </div>
            </div>
          )}

          {/* Explicit Confirmation Checkbox */}
          <label className="flex items-start gap-3 p-3.5 rounded-xl border border-[#DCD9E7] bg-[#FAF9FC] hover:bg-white cursor-pointer select-none transition-colors">
            <input
              type="checkbox"
              checked={confirmed}
              disabled={isDeleting}
              onChange={(e) => setConfirmed(e.target.checked)}
              className="mt-0.5 rounded text-rose-600 focus:ring-rose-500 cursor-pointer h-4 w-4"
            />
            <span className="font-semibold text-[#252233] leading-normal">
              I understand that deleting <span className="font-bold">"{course.title}"</span> is
              permanent, deletes all associated lessons and materials, and removes it for all users
              immediately.
            </span>
          </label>
        </div>

        {/* Modal Footer Actions */}
        <div className="p-4 px-6 border-t border-[#ECEAF2] bg-[#FAF9FC] flex flex-col sm:flex-row items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={handleClose}
            disabled={isDeleting}
            className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-[#D5D2E2] bg-white hover:bg-[#FAF9FC] text-xs font-semibold text-[#545163] disabled:opacity-50 transition-colors cursor-pointer"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleDelete}
            disabled={!confirmed || isDeleting}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white text-xs font-semibold shadow-xs transition-all cursor-pointer"
          >
            {isDeleting ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Deleting Course & Assets...</span>
              </>
            ) : (
              <>
                <Trash2 className="w-4 h-4" />
                <span>Confirm & Delete Course</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
