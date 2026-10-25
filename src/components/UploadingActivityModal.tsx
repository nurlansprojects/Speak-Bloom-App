import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { Course, Lesson, Activity, UploadedFileRecord } from '../types';
import {
  validateUploadedFile,
  formatFileSize,
  uploadFileToStorage,
  createUploadRecord,
  deleteUploadRecord,
  getUploadsForActivity,
  getStudentSubmissionsForActivity,
  getTeacherUploadsForLesson,
  teacherReviewSubmission,
  ALL_ALLOWED_EXTENSIONS,
} from '../services/uploadStorageService';
import {
  UploadCloud,
  File,
  FileText,
  Film,
  Music,
  FileSpreadsheet,
  Presentation,
  Image as ImageIcon,
  CheckCircle2,
  AlertCircle,
  X,
  Trash2,
  Download,
  ExternalLink,
  RefreshCw,
  MessageSquare,
  Award,
  Clock,
  ShieldCheck,
  UserCheck,
} from 'lucide-react';

interface UploadingActivityModalProps {
  course: Course;
  lesson: Lesson;
  activity: Activity;
  onClose: () => void;
  onSubmissionSuccess?: () => void;
}

import { UploadState } from '../services/uploadStorageService';

interface QueuedUploadItem {
  id: string;
  file: File;
  title: string;
  instructions: string;
  progress: number;
  transferredBytes: number;
  totalBytes: number;
  status: UploadState;
  statusMessage?: string;
  errorMessage?: string;
  uploadedFileUrl?: string;
  storagePath?: string;
  abortController?: AbortController;
}

export const UploadingActivityModal: React.FC<UploadingActivityModalProps> = ({
  course,
  lesson,
  activity,
  onClose,
  onSubmissionSuccess,
}) => {
  const { currentUser, userProfile } = useAuth();
  const isTeacher =
    userProfile?.role === 'teacher' ||
    userProfile?.role === 'admin' ||
    course.teacherId === currentUser?.uid;

  // Tabs for view:
  // - Students: 'submit' (My Uploading Submissions) and 'resources' (Teacher Materials)
  // - Teachers: 'resources' (Lesson & Activity Uploading), 'submissions' (Student Submissions), and 'upload_resource' (Add Teacher Material)
  const [activeTab, setActiveTab] = useState<'submissions' | 'resources' | 'submit'>(
    isTeacher ? 'resources' : 'submit'
  );

  // Loaded database records
  const [teacherResources, setTeacherResources] = useState<UploadedFileRecord[]>([]);
  const [mySubmissions, setMySubmissions] = useState<UploadedFileRecord[]>([]);
  const [allStudentSubmissions, setAllStudentSubmissions] = useState<UploadedFileRecord[]>([]);
  const [loadingRecords, setLoadingRecords] = useState(true);

  // File Upload Queue state
  const [uploadQueue, setUploadQueue] = useState<QueuedUploadItem[]>([]);
  const [isProcessingQueue, setIsProcessingQueue] = useState(false);
  const [generalUploadTitle, setGeneralUploadTitle] = useState('');
  const [generalUploadInstructions, setGeneralUploadInstructions] = useState('');
  const [uploadScope, setUploadScope] = useState<'student_submission' | 'teacher_resource'>(
    isTeacher ? 'teacher_resource' : 'student_submission'
  );
  const [validationError, setValidationError] = useState<string | null>(null);

  // Teacher Review state
  const [reviewingSubmission, setReviewingSubmission] = useState<UploadedFileRecord | null>(null);
  const [reviewFeedback, setReviewFeedback] = useState('');
  const [reviewGrade, setReviewGrade] = useState<number | ''>(85);
  const [isSavingReview, setIsSavingReview] = useState(false);

  // Drag and drop state
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    loadAllRecords();
  }, [course.id, activity.id, currentUser?.uid]);

  const loadAllRecords = async () => {
    if (!currentUser) return;
    setLoadingRecords(true);
    try {
      if (isTeacher) {
        // Teacher sees all teacher resources and student submissions for this activity
        const allActivityUploads = await getUploadsForActivity(course.id, activity.id);
        const resources = allActivityUploads.filter((u) => u.scope === 'teacher_resource');
        const studentSubs = allActivityUploads.filter((u) => u.scope === 'student_submission');
        setTeacherResources(resources);
        setAllStudentSubmissions(studentSubs);
      } else {
        // Student sees teacher materials for lesson/activity, but ONLY their own private submissions
        const lessonResources = await getTeacherUploadsForLesson(course.id, lesson.id);
        setTeacherResources(lessonResources);
      }

      // Load student's own submissions
      const myOwn = await getStudentSubmissionsForActivity(course.id, activity.id, currentUser.uid);
      setMySubmissions(myOwn);
    } catch (err: any) {
      console.error('Failed to load uploads:', err);
    } finally {
      setLoadingRecords(false);
    }
  };

  // Helper to get file type icon
  const getFileIcon = (fileType: string, extension: string) => {
    switch (fileType) {
      case 'image':
        return <ImageIcon className="w-5 h-5 text-emerald-600" />;
      case 'audio':
        return <Music className="w-5 h-5 text-purple-600" />;
      case 'video':
        return <Film className="w-5 h-5 text-rose-600" />;
      case 'spreadsheet':
        return <FileSpreadsheet className="w-5 h-5 text-emerald-600" />;
      case 'presentation':
        return <Presentation className="w-5 h-5 text-amber-600" />;
      case 'document':
      default:
        if (extension === 'pdf') {
          return <FileText className="w-5 h-5 text-rose-500" />;
        }
        return <File className="w-5 h-5 text-blue-600" />;
    }
  };

  // Handle incoming files from input or drag
  const handleFilesSelected = (files: FileList | File[]) => {
    setValidationError(null);
    const newItems: QueuedUploadItem[] = [];
    const errors: string[] = [];

    Array.from(files).forEach((file) => {
      const validation = validateUploadedFile(file, activity.allowedFormats || ALL_ALLOWED_EXTENSIONS);
      if (!validation.valid) {
        errors.push(`${file.name}: ${validation.error}`);
        return;
      }

      newItems.push({
        id: `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
        file,
        title: generalUploadTitle.trim() || file.name,
        instructions: generalUploadInstructions.trim(),
        progress: 0,
        transferredBytes: 0,
        totalBytes: file.size,
        status: 'idle',
        statusMessage: 'Ready to upload',
      });
    });

    if (errors.length > 0) {
      setValidationError(errors.join('\n'));
    }

    if (newItems.length > 0) {
      setUploadQueue((prev) => [...prev, ...newItems]);
    }
  };

  // Cancel an in-progress upload
  const cancelUploadItem = (id: string) => {
    setUploadQueue((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          if (item.abortController) {
            item.abortController.abort();
          }
          return {
            ...item,
            status: 'cancelled',
            statusMessage: 'Upload cancelled by user',
          };
        }
        return item;
      })
    );
  };

  // Execute Uploading process for all pending files in queue
  const processUploadQueue = async () => {
    if (!currentUser || !userProfile || isProcessingQueue) return;

    setIsProcessingQueue(true);
    setValidationError(null);

    const pendingItems = uploadQueue.filter(
      (item) => item.status === 'idle' || item.status === 'error' || item.status === 'cancelled'
    );

    for (const item of pendingItems) {
      let fileUrl = item.uploadedFileUrl;
      let storagePath = item.storagePath;

      // 1. Validating step
      setUploadQueue((prev) =>
        prev.map((i) =>
          i.id === item.id
            ? { ...i, status: 'validating', statusMessage: 'Validating file format and size...', errorMessage: undefined }
            : i
        )
      );

      const validation = validateUploadedFile(item.file, activity.allowedFormats || ALL_ALLOWED_EXTENSIONS);
      if (!validation.valid) {
        setUploadQueue((prev) =>
          prev.map((i) =>
            i.id === item.id
              ? { ...i, status: 'error', errorMessage: validation.error || 'Invalid file format.' }
              : i
          )
        );
        continue;
      }

      // 2. Uploading step (only if not already uploaded to storage in a prior attempt)
      if (!fileUrl || !storagePath) {
        const controller = new AbortController();

        setUploadQueue((prev) =>
          prev.map((i) =>
            i.id === item.id
              ? {
                  ...i,
                  status: 'uploading',
                  statusMessage: 'Uploading bytes...',
                  abortController: controller,
                  progress: 0,
                  errorMessage: undefined,
                }
              : i
          )
        );

        try {
          const uploadResult = await uploadFileToStorage(
            item.file,
            course.id,
            lesson.id,
            activity.id,
            {
              signal: controller.signal,
              onProgress: (percent, transferred, total) => {
                setUploadQueue((prev) =>
                  prev.map((i) =>
                    i.id === item.id
                      ? {
                          ...i,
                          status: 'uploading',
                          progress: percent,
                          transferredBytes: transferred,
                          totalBytes: total,
                          statusMessage: `Uploading... ${percent}%`,
                        }
                      : i
                  )
                );
              },
              onStateChange: (state, message) => {
                setUploadQueue((prev) =>
                  prev.map((i) =>
                    i.id === item.id
                      ? {
                          ...i,
                          status: state,
                          statusMessage: message || i.statusMessage,
                        }
                      : i
                  )
                );
              },
            }
          );

          fileUrl = uploadResult.fileUrl;
          storagePath = uploadResult.storagePath;

          setUploadQueue((prev) =>
            prev.map((i) =>
              i.id === item.id
                ? {
                    ...i,
                    uploadedFileUrl: fileUrl,
                    storagePath,
                    progress: 100,
                    status: 'processing',
                    statusMessage: 'Verifying file integrity...',
                  }
                : i
            )
          );
        } catch (uploadErr: any) {
          if (controller.signal.aborted) {
            setUploadQueue((prev) =>
              prev.map((i) =>
                i.id === item.id
                  ? { ...i, status: 'cancelled', statusMessage: 'Upload cancelled by user' }
                  : i
              )
            );
          } else {
            console.error('Uploading item failed:', uploadErr);
            setUploadQueue((prev) =>
              prev.map((i) =>
                i.id === item.id
                  ? {
                      ...i,
                      status: 'error',
                      errorMessage: uploadErr.message || 'Uploading failed. You can retry this upload.',
                    }
                  : i
              )
            );
          }
          continue; // Move to next item
        }
      }

      // 3. Saving metadata to Firestore database
      setUploadQueue((prev) =>
        prev.map((i) =>
          i.id === item.id
            ? { ...i, status: 'saving', statusMessage: 'Saving record to database...' }
            : i
        )
      );

      try {
        const fileType = validation.category || 'document';
        const fileExtension = validation.extension || 'file';

        const record = await createUploadRecord({
          userId: currentUser.uid,
          userName: userProfile.displayName || 'Speak Bloom User',
          userRole: userProfile.role || 'student',
          courseId: course.id,
          lessonId: lesson.id,
          activityId: activity.id,
          scope: isTeacher && uploadScope === 'teacher_resource' ? 'teacher_resource' : 'student_submission',
          title: item.title || item.file.name,
          instructions: item.instructions || undefined,
          fileName: item.file.name,
          fileType,
          fileExtension,
          mimeType: item.file.type || 'application/octet-stream',
          fileSize: item.file.size,
          fileUrl: fileUrl!,
          storagePath: storagePath!,
          status: 'submitted',
        });

        // 4. Success terminal state
        setUploadQueue((prev) =>
          prev.map((i) =>
            i.id === item.id
              ? {
                  ...i,
                  status: 'success',
                  progress: 100,
                  statusMessage: 'Successfully uploaded & saved',
                }
              : i
          )
        );

        if (record.scope === 'teacher_resource') {
          setTeacherResources((prev) => [record, ...prev]);
        } else {
          setMySubmissions((prev) => [record, ...prev]);
          if (isTeacher) {
            setAllStudentSubmissions((prev) => [record, ...prev]);
          }
        }
      } catch (dbErr: any) {
        console.error('Database record creation failed:', dbErr);
        setUploadQueue((prev) =>
          prev.map((i) =>
            i.id === item.id
              ? {
                  ...i,
                  status: 'error',
                  errorMessage: `File uploaded to storage, but database save failed: ${dbErr.message || 'Database error'}. Click Retry to save without re-uploading.`,
                }
              : i
          )
        );
      }
    }

    setIsProcessingQueue(false);
    await loadAllRecords();
    if (onSubmissionSuccess) onSubmissionSuccess();
  };

  // Remove single item from queue
  const removeItemFromQueue = (id: string) => {
    setUploadQueue((prev) => prev.filter((item) => item.id !== id));
  };

  // Retry failed upload item (preserves already uploaded fileUrl if database write was what failed)
  const retryFailedUpload = async (item: QueuedUploadItem) => {
    setUploadQueue((prev) =>
      prev.map((i) =>
        i.id === item.id
          ? {
              ...i,
              status: 'idle',
              errorMessage: undefined,
              statusMessage: item.uploadedFileUrl ? 'Ready to retry database save' : 'Ready to retry upload',
            }
          : i
      )
    );
    setTimeout(() => {
      processUploadQueue();
    }, 50);
  };

  // Delete an existing upload record
  const handleDeleteUpload = async (record: UploadedFileRecord) => {
    if (!currentUser) return;

    // Enforce permissions: students cannot delete teacher files or other student files
    if (!isTeacher && record.userId !== currentUser.uid) {
      alert('You are not authorized to delete this file.');
      return;
    }

    if (
      !window.confirm(
        `Are you sure you want to delete "${record.fileName}"? This action cannot be undone.`
      )
    ) {
      return;
    }

    try {
      await deleteUploadRecord(record);
      setTeacherResources((prev) => prev.filter((r) => r.id !== record.id));
      setMySubmissions((prev) => prev.filter((r) => r.id !== record.id));
      setAllStudentSubmissions((prev) => prev.filter((r) => r.id !== record.id));
    } catch (err: any) {
      alert(err.message || 'Failed to delete file.');
    }
  };

  // Save Teacher review and feedback
  const handleSaveReview = async () => {
    if (!reviewingSubmission || !currentUser || !userProfile) return;
    setIsSavingReview(true);
    try {
      const numericGrade = typeof reviewGrade === 'number' ? reviewGrade : undefined;
      await teacherReviewSubmission(
        reviewingSubmission.id,
        reviewFeedback.trim(),
        numericGrade,
        currentUser.uid,
        userProfile.displayName || 'Teacher'
      );

      // Refresh records
      await loadAllRecords();
      setReviewingSubmission(null);
      setReviewFeedback('');
      setReviewGrade(85);
    } catch (err: any) {
      alert(err.message || 'Failed to save review feedback.');
    } finally {
      setIsSavingReview(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-4xl max-h-[92vh] rounded-3xl shadow-2xl flex flex-col border border-[#E4E1EE] overflow-hidden">
        {/* Header with exact label "Uploading" */}
        <div className="p-5 sm:p-6 border-b border-[#ECEAF2] bg-[#FAF9FC] flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#6546D7] text-white flex items-center justify-center shadow-xs">
              <UploadCloud className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-[#ECE8F8] text-[#6546D7]">
                  Uploading
                </span>
                <span className="text-[11px] font-semibold text-[#666375]">
                  Lesson: {lesson.title}
                </span>
              </div>
              <h2 className="text-lg sm:text-xl font-bold text-[#181624] mt-0.5">
                {activity.title}
              </h2>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-white border border-[#E5E3ED] hover:bg-[#F2EFFB] text-[#605C70] flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Activity Prompt & Instructions Box */}
        <div className="px-5 sm:px-6 py-4 bg-white border-b border-[#F0EEF6]">
          <div className="text-xs font-bold uppercase tracking-wider text-[#6546D7] mb-1">
            Activity Prompt & Task Instructions
          </div>
          <p className="text-sm font-semibold text-[#201D2D] leading-snug">
            {activity.prompt}
          </p>
          {activity.instructions && (
            <p className="text-xs text-[#5D5A6E] mt-1.5 leading-relaxed bg-[#FAF9FC] p-3 rounded-xl border border-[#ECEAF2]">
              <span className="font-semibold text-[#181624]">Instructions: </span>
              {activity.instructions}
            </p>
          )}

          {/* Supported Format Badges */}
          <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-[#F3F1F8]">
            <span className="text-[11px] font-semibold text-[#737084]">Supported formats:</span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200">
              Audio: MP3
            </span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200">
              Video: MP4
            </span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
              Documents: DOC, DOCX, PDF
            </span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
              Spreadsheets: XLS, XLSX
            </span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">
              Presentations: PPT, PPTX
            </span>
          </div>
        </div>

        {/* Tabs */}
        <div className="px-5 sm:px-6 pt-3 border-b border-[#ECEAF2] bg-[#FAF9FC] flex items-center gap-2 overflow-x-auto">
          {/* Submit/Uploading Tab */}
          <button
            onClick={() => setActiveTab('submit')}
            className={`px-4 py-2.5 text-xs font-bold rounded-t-xl transition-all border-b-2 flex items-center gap-2 cursor-pointer ${
              activeTab === 'submit'
                ? 'border-[#6546D7] text-[#6546D7] bg-white'
                : 'border-transparent text-[#6D6A7E] hover:text-[#181624]'
            }`}
          >
            <UploadCloud className="w-4 h-4" />
            <span>Uploading Activity ({isTeacher ? 'Upload Resource / Test' : 'My Submissions'})</span>
            {mySubmissions.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-[#ECE8F8] text-[#6546D7]">
                {mySubmissions.length}
              </span>
            )}
          </button>

          {/* Teacher Materials Tab */}
          <button
            onClick={() => setActiveTab('resources')}
            className={`px-4 py-2.5 text-xs font-bold rounded-t-xl transition-all border-b-2 flex items-center gap-2 cursor-pointer ${
              activeTab === 'resources'
                ? 'border-[#6546D7] text-[#6546D7] bg-white'
                : 'border-transparent text-[#6D6A7E] hover:text-[#181624]'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Teacher Materials & Resources</span>
            {teacherResources.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-emerald-100 text-emerald-800">
                {teacherResources.length}
              </span>
            )}
          </button>

          {/* Teacher Review Tab */}
          {isTeacher && (
            <button
              onClick={() => setActiveTab('submissions')}
              className={`px-4 py-2.5 text-xs font-bold rounded-t-xl transition-all border-b-2 flex items-center gap-2 cursor-pointer ${
                activeTab === 'submissions'
                  ? 'border-[#6546D7] text-[#6546D7] bg-white'
                : 'border-transparent text-[#6D6A7E] hover:text-[#181624]'
              }`}
            >
              <UserCheck className="w-4 h-4" />
              <span>Review Student Submissions</span>
              {allStudentSubmissions.length > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-purple-100 text-purple-800">
                  {allStudentSubmissions.length}
                </span>
              )}
            </button>
          )}
        </div>

        {/* Tab Content Area */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
          {/* TAB 1: UPLOADING SUBMISSIONS (Shared for student submissions & teacher resource uploads) */}
          {activeTab === 'submit' && (
            <div className="space-y-6">
              {/* Teacher selector if uploading as teacher resource or testing as submission */}
              {isTeacher && (
                <div className="p-4 rounded-2xl bg-[#F4F1FD] border border-[#DDD7F5] flex flex-wrap items-center justify-between gap-3">
                  <div className="text-xs">
                    <span className="font-bold text-[#6546D7]">Instructor Upload Mode: </span>
                    <span className="text-[#3B3848]">
                      Choose whether to attach files as official course resources or as test submissions.
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <label className="flex items-center gap-1.5 cursor-pointer font-semibold text-[#181624]">
                      <input
                        type="radio"
                        name="uploadScope"
                        checked={uploadScope === 'teacher_resource'}
                        onChange={() => setUploadScope('teacher_resource')}
                        className="text-[#6546D7]"
                      />
                      <span>Teacher Resource</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer font-semibold text-[#181624] ml-2">
                      <input
                        type="radio"
                        name="uploadScope"
                        checked={uploadScope === 'student_submission'}
                        onChange={() => setUploadScope('student_submission')}
                        className="text-[#6546D7]"
                      />
                      <span>Student Submission</span>
                    </label>
                  </div>
                </div>
              )}

              {/* Upload Configuration & Metadata Inputs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-[#2A2737] block mb-1">
                    Upload Title / Assignment Label
                  </label>
                  <input
                    type="text"
                    value={generalUploadTitle}
                    onChange={(e) => setGeneralUploadTitle(e.target.value)}
                    placeholder="e.g. Unit 3 Speaking Recording / Practice Worksheet"
                    className="w-full px-3.5 py-2 rounded-xl border border-[#D5D2E2] text-xs focus:outline-none focus:border-[#6546D7]"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-[#2A2737] block mb-1">
                    Instructions / Submission Note
                  </label>
                  <input
                    type="text"
                    value={generalUploadInstructions}
                    onChange={(e) => setGeneralUploadInstructions(e.target.value)}
                    placeholder="e.g. Focused on pronunciation of past tense -ed endings"
                    className="w-full px-3.5 py-2 rounded-xl border border-[#D5D2E2] text-xs focus:outline-none focus:border-[#6546D7]"
                  />
                </div>
              </div>

              {/* Drag and Drop Zone with Exact Label Uploading */}
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragOver(true);
                }}
                onDragLeave={() => setIsDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragOver(false);
                  if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                    handleFilesSelected(e.dataTransfer.files);
                  }
                }}
                className={`p-8 rounded-3xl border-2 border-dashed transition-all text-center flex flex-col items-center justify-center gap-3 cursor-pointer ${
                  isDragOver
                    ? 'border-[#6546D7] bg-[#F4F1FD]'
                    : 'border-[#D9D6E7] hover:border-[#6546D7] bg-[#FAF9FC]'
                }`}
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept=".mp3,.mp4,.doc,.docx,.pdf,.xls,.xlsx,.ppt,.pptx,audio/mpeg,video/mp4,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files && e.target.files.length > 0) {
                      handleFilesSelected(e.target.files);
                    }
                  }}
                />

                <div className="w-12 h-12 rounded-2xl bg-[#ECE8F8] text-[#6546D7] flex items-center justify-center shadow-xs">
                  <UploadCloud className="w-6 h-6" />
                </div>

                <div>
                  <h4 className="text-sm font-bold text-[#181624]">
                    Select files for <span className="text-[#6546D7]">Uploading</span>
                  </h4>
                  <p className="text-xs text-[#6B687B] mt-1">
                    Drag and drop files here, or click to browse multiple files
                  </p>
                </div>

                <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-[#DCD9E8] text-xs font-semibold text-[#484557]">
                  <span>Supports MP3, MP4, PDF, DOC, DOCX, XLS, XLSX, PPT, PPTX (up to 50MB)</span>
                </div>
              </div>

              {/* Validation Error Banner */}
              {validationError && (
                <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
                  <div className="whitespace-pre-line leading-relaxed">{validationError}</div>
                </div>
              )}

              {/* Upload Queue Section */}
              {uploadQueue.length > 0 && (
                <div className="bg-white rounded-2xl border border-[#ECEAF2] p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-[#181624]">
                      Uploading Queue ({uploadQueue.length} {uploadQueue.length === 1 ? 'file' : 'files'})
                    </h4>
                    <button
                      onClick={processUploadQueue}
                      disabled={isProcessingQueue || uploadQueue.every((q) => q.status === 'success')}
                      className="px-4 py-2 rounded-xl bg-[#6546D7] hover:bg-[#5235BF] disabled:opacity-50 text-white text-xs font-semibold shadow-xs transition-all flex items-center gap-2 cursor-pointer"
                    >
                      {isProcessingQueue ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>Uploading...</span>
                        </>
                      ) : (
                        <>
                          <UploadCloud className="w-3.5 h-3.5" />
                          <span>Start Uploading</span>
                        </>
                      )}
                    </button>
                  </div>

                  <div className="space-y-3">
                    {uploadQueue.map((item) => (
                      <div
                        key={item.id}
                        className="p-3.5 rounded-xl border border-[#E9E7F1] bg-[#FAF9FC] space-y-2"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2.5 overflow-hidden">
                            {getFileIcon(
                              validateUploadedFile(item.file).category || 'document',
                              validateUploadedFile(item.file).extension || 'file'
                            )}
                            <div className="truncate">
                              <div className="text-xs font-bold text-[#181624] truncate">
                                {item.file.name}
                              </div>
                              <div className="text-[10px] text-[#787588]">
                                {formatFileSize(item.file.size)} • {item.title || 'Untitled'}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            {item.status === 'success' && (
                              <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>Uploaded</span>
                              </span>
                            )}
                            {item.status === 'validating' && (
                              <span className="flex items-center gap-1 text-[11px] font-bold text-[#6546D7] bg-[#ECE8F8] px-2 py-0.5 rounded-md">
                                <RefreshCw className="w-3 h-3 animate-spin" />
                                <span>Validating...</span>
                              </span>
                            )}
                            {item.status === 'uploading' && (
                              <div className="flex items-center gap-1.5">
                                <span className="text-[11px] font-bold text-[#6546D7]">
                                  {item.progress}%
                                </span>
                                <button
                                  onClick={() => cancelUploadItem(item.id)}
                                  className="text-[10px] font-bold text-[#777488] hover:text-rose-600 px-1.5 py-0.5 rounded border border-[#D5D2E2] hover:bg-rose-50 cursor-pointer"
                                  title="Cancel upload"
                                >
                                  Cancel
                                </button>
                              </div>
                            )}
                            {item.status === 'processing' && (
                              <span className="flex items-center gap-1 text-[11px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-200">
                                <RefreshCw className="w-3 h-3 animate-spin" />
                                <span>Processing...</span>
                              </span>
                            )}
                            {item.status === 'saving' && (
                              <span className="flex items-center gap-1 text-[11px] font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-md border border-purple-200">
                                <RefreshCw className="w-3 h-3 animate-spin" />
                                <span>Saving...</span>
                              </span>
                            )}
                            {item.status === 'cancelled' && (
                              <button
                                onClick={() => retryFailedUpload(item)}
                                className="flex items-center gap-1 text-[11px] font-bold text-amber-700 hover:text-amber-900 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200 cursor-pointer"
                              >
                                <RefreshCw className="w-3 h-3" />
                                <span>Cancelled - Retry</span>
                              </button>
                            )}
                            {item.status === 'error' && (
                              <button
                                onClick={() => retryFailedUpload(item)}
                                className="flex items-center gap-1 text-[11px] font-bold text-rose-600 hover:text-rose-800 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-200 cursor-pointer"
                              >
                                <RefreshCw className="w-3 h-3" />
                                <span>{item.uploadedFileUrl ? 'Retry Save' : 'Retry'}</span>
                              </button>
                            )}
                            {item.status !== 'uploading' && item.status !== 'processing' && item.status !== 'saving' && (
                              <button
                                onClick={() => removeItemFromQueue(item.id)}
                                className="text-[#888597] hover:text-rose-600 p-1 cursor-pointer"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Progress Bar */}
                        {(item.status === 'uploading' ||
                          item.status === 'processing' ||
                          item.status === 'saving' ||
                          item.status === 'success') && (
                          <div className="space-y-1">
                            <div className="w-full h-1.5 rounded-full bg-[#E8E6F0] overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all duration-300 ${
                                  item.status === 'success' ? 'bg-emerald-500' : 'bg-[#6546D7]'
                                }`}
                                style={{ width: `${item.progress}%` }}
                              />
                            </div>
                            <div className="flex justify-between text-[10px] text-[#7B788C]">
                              <span>
                                {formatFileSize(item.transferredBytes || (item.file.size * item.progress) / 100)} of{' '}
                                {formatFileSize(item.totalBytes || item.file.size)}
                              </span>
                              <span>
                                {item.statusMessage || (item.status === 'success' ? 'Saved to database' : 'Uploading...')}
                              </span>
                            </div>
                          </div>
                        )}

                        {/* Error message */}
                        {item.status === 'error' && item.errorMessage && (
                          <div className="text-[11px] text-rose-600 flex items-center gap-1 font-medium bg-rose-50/50 p-2 rounded-lg border border-rose-100">
                            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                            <span>{item.errorMessage}</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* My Uploaded Submissions List */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-[#181624]">
                    My Uploading Submissions ({mySubmissions.length})
                  </h4>
                  <button
                    onClick={loadAllRecords}
                    className="text-xs text-[#6546D7] hover:underline flex items-center gap-1 font-semibold cursor-pointer"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>Refresh</span>
                  </button>
                </div>

                {loadingRecords ? (
                  <div className="py-6 flex justify-center">
                    <div className="w-5 h-5 border-2 border-[#6546D7] border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : mySubmissions.length === 0 ? (
                  <div className="p-6 rounded-2xl bg-[#FAF9FC] border border-dashed border-[#DDD9E8] text-center">
                    <p className="text-xs text-[#706D7E]">
                      No files submitted for this activity yet. Select or drop your files above to begin.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-3">
                    {mySubmissions.map((sub) => (
                      <div
                        key={sub.id}
                        className="p-4 rounded-2xl border border-[#ECEAF2] bg-white hover:border-[#6546D7]/30 transition-all space-y-3"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-3">
                            <div className="p-2.5 rounded-xl bg-[#FAF9FC] border border-[#ECEAF2] shrink-0 mt-0.5">
                              {getFileIcon(sub.fileType, sub.fileExtension)}
                            </div>
                            <div>
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-[#FAF9FC] border border-[#E7E5F0] text-[#555263]">
                                  .{sub.fileExtension.toUpperCase()}
                                </span>
                                <span
                                  className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                                    sub.status === 'reviewed'
                                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                      : 'bg-amber-50 text-amber-700 border border-amber-200'
                                  }`}
                                >
                                  {sub.status === 'reviewed' ? 'Reviewed by Teacher' : 'Submitted & Pending Review'}
                                </span>
                              </div>
                              <h5 className="text-sm font-bold text-[#181624]">{sub.title || sub.fileName}</h5>
                              <p className="text-xs text-[#6F6C7E]">
                                {sub.fileName} • {formatFileSize(sub.fileSize)} •{' '}
                                {new Date(sub.createdAt).toLocaleDateString()} at{' '}
                                {new Date(sub.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            <a
                              href={sub.fileUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-2 rounded-xl border border-[#E5E3ED] hover:bg-[#F2EFFB] text-[#6546D7] transition-colors cursor-pointer"
                              title="Download or preview file"
                            >
                              <Download className="w-4 h-4" />
                            </a>
                            <button
                              onClick={() => handleDeleteUpload(sub)}
                              className="p-2 rounded-xl border border-[#E5E3ED] hover:bg-rose-50 text-[#868394] hover:text-rose-600 transition-colors cursor-pointer"
                              title="Delete submission"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        {/* Instructions note if any */}
                        {sub.instructions && (
                          <div className="text-xs text-[#524F60] bg-[#FAF9FC] p-2.5 rounded-xl border border-[#ECEAF2]">
                            <span className="font-semibold text-[#181624]">Student Note: </span>
                            {sub.instructions}
                          </div>
                        )}

                        {/* Teacher Feedback & Evaluation Display */}
                        {sub.feedback && (
                          <div className="p-3.5 rounded-xl bg-[#F4F1FD] border border-[#DDD7F5] space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-[#6546D7] flex items-center gap-1.5">
                                <Award className="w-3.5 h-3.5" />
                                <span>Teacher Feedback & Evaluation</span>
                              </span>
                              {sub.grade !== undefined && sub.grade !== null && (
                                <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-white border border-[#DDD7F5] text-[#6546D7]">
                                  Score: {sub.grade}/100
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-[#2A2737] leading-relaxed whitespace-pre-line">
                              {sub.feedback}
                            </p>
                            {sub.reviewedByName && (
                              <div className="text-[10px] text-[#7A778B]">
                                Reviewed by {sub.reviewedByName} on{' '}
                                {sub.reviewedAt ? new Date(sub.reviewedAt).toLocaleDateString() : ''}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: TEACHER MATERIALS & RESOURCES */}
          {activeTab === 'resources' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold text-[#181624]">Teacher Uploading Materials</h4>
                  <p className="text-xs text-[#6F6C7E]">
                    Instructional slides, sample audio/video, worksheets, and rubric documents provided by the instructor.
                  </p>
                </div>
                {isTeacher && (
                  <button
                    onClick={() => {
                      setUploadScope('teacher_resource');
                      setActiveTab('submit');
                    }}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#6546D7] hover:bg-[#5235BF] text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
                  >
                    <UploadCloud className="w-3.5 h-3.5" />
                    <span>Upload Resource</span>
                  </button>
                )}
              </div>

              {loadingRecords ? (
                <div className="py-8 flex justify-center">
                  <div className="w-6 h-6 border-2 border-[#6546D7] border-t-transparent rounded-full animate-spin" />
                </div>
              ) : teacherResources.length === 0 ? (
                <div className="p-8 text-center bg-[#FAF9FC] rounded-2xl border border-dashed border-[#DDD9E8]">
                  <p className="text-xs text-[#6B687B]">
                    No teacher reference files have been attached for this activity.
                  </p>
                  {isTeacher && (
                    <button
                      onClick={() => {
                        setUploadScope('teacher_resource');
                        setActiveTab('submit');
                      }}
                      className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold text-[#6546D7] hover:underline cursor-pointer"
                    >
                      <UploadCloud className="w-3.5 h-3.5" />
                      <span>Upload reference files now</span>
                    </button>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3">
                  {teacherResources.map((res) => (
                    <div
                      key={res.id}
                      className="p-4 rounded-2xl border border-[#ECEAF2] bg-white hover:border-[#6546D7]/30 transition-all flex items-center justify-between gap-4"
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-3 rounded-2xl bg-[#F4F1FD] border border-[#ECE8F8] shrink-0">
                          {getFileIcon(res.fileType, res.fileExtension)}
                        </div>
                        <div>
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-[#FAF9FC] border border-[#E7E5F0] text-[#555263]">
                              .{res.fileExtension.toUpperCase()}
                            </span>
                            <span className="text-[10px] font-semibold text-[#737084]">
                              Uploaded by {res.userName || 'Instructor'}
                            </span>
                          </div>
                          <h5 className="text-sm font-bold text-[#181624]">{res.title || res.fileName}</h5>
                          <p className="text-xs text-[#686577]">
                            {res.fileName} • {formatFileSize(res.fileSize)}
                          </p>
                          {res.instructions && (
                            <p className="text-xs text-[#4F4C5E] mt-1 italic">
                              "{res.instructions}"
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <a
                          href={res.fileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#6546D7] hover:bg-[#5235BF] text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>Download</span>
                        </a>
                        {isTeacher && (
                          <button
                            onClick={() => handleDeleteUpload(res)}
                            className="p-2 rounded-xl border border-[#E5E3ED] hover:bg-rose-50 text-[#868394] hover:text-rose-600 transition-colors cursor-pointer"
                            title="Delete file"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: TEACHER REVIEW OF ALL STUDENT SUBMISSIONS */}
          {activeTab === 'submissions' && isTeacher && (
            <div className="space-y-4">
              <div>
                <h4 className="text-sm font-bold text-[#181624]">
                  Student Submissions for Review ({allStudentSubmissions.length})
                </h4>
                <p className="text-xs text-[#6F6C7E]">
                  Review coursework, audio recordings, video submissions, and documents submitted by enrolled students.
                </p>
              </div>

              {allStudentSubmissions.length === 0 ? (
                <div className="p-8 text-center bg-[#FAF9FC] rounded-2xl border border-dashed border-[#DDD9E8]">
                  <p className="text-xs text-[#6B687B]">No students have submitted files for this activity yet.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {allStudentSubmissions.map((sub) => (
                    <div
                      key={sub.id}
                      className="p-5 rounded-2xl border border-[#ECEAF2] bg-white hover:border-[#6546D7]/40 transition-all space-y-3"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="p-2.5 rounded-xl bg-[#FAF9FC] border border-[#ECEAF2] shrink-0">
                            {getFileIcon(sub.fileType, sub.fileExtension)}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-[#181624]">{sub.userName}</span>
                              <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                                  sub.status === 'reviewed'
                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                    : 'bg-amber-50 text-amber-700 border border-amber-200'
                                }`}
                              >
                                {sub.status === 'reviewed' ? 'Reviewed' : 'Pending Review'}
                              </span>
                            </div>
                            <div className="text-xs text-[#6546D7] font-semibold mt-0.5">
                              {sub.title || sub.fileName}
                            </div>
                            <div className="text-[11px] text-[#787588]">
                              {sub.fileName} ({formatFileSize(sub.fileSize)}) • Submitted{' '}
                              {new Date(sub.createdAt).toLocaleDateString()} at{' '}
                              {new Date(sub.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <a
                            href={sub.fileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#FAF9FC] border border-[#E5E3ED] hover:bg-[#F2EFFB] text-[#6546D7] text-xs font-semibold transition-colors cursor-pointer"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                            <span>Inspect File</span>
                          </a>
                          <button
                            onClick={() => {
                              setReviewingSubmission(sub);
                              setReviewFeedback(sub.feedback || '');
                              setReviewGrade(sub.grade !== undefined && sub.grade !== null ? sub.grade : 85);
                            }}
                            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#6546D7] hover:bg-[#5235BF] text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
                          >
                            <MessageSquare className="w-3.5 h-3.5" />
                            <span>{sub.status === 'reviewed' ? 'Update Feedback' : 'Give Feedback'}</span>
                          </button>
                        </div>
                      </div>

                      {/* Existing feedback if present */}
                      {sub.feedback && (
                        <div className="p-3 rounded-xl bg-[#FAF9FC] border border-[#ECEAF2] text-xs text-[#3A3748]">
                          <div className="flex items-center justify-between font-bold text-[#6546D7] mb-1">
                            <span>Feedback Provided:</span>
                            {sub.grade !== undefined && sub.grade !== null && (
                              <span>Score: {sub.grade}/100</span>
                            )}
                          </div>
                          <p className="whitespace-pre-line">{sub.feedback}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Teacher Feedback Modal Overlay */}
        {reviewingSubmission && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
            <div className="bg-white w-full max-w-lg rounded-3xl p-6 border border-[#E0DDEB] shadow-2xl space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-[#6546D7] uppercase tracking-wider">
                    Teacher Review
                  </span>
                  <h3 className="text-base font-bold text-[#181624]">
                    Feedback for {reviewingSubmission.userName}
                  </h3>
                </div>
                <button
                  onClick={() => setReviewingSubmission(null)}
                  className="w-8 h-8 rounded-full hover:bg-[#F0EEF7] flex items-center justify-center text-[#706D80]"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-3 rounded-xl bg-[#FAF9FC] border border-[#ECEAF2] text-xs text-[#524F62]">
                <div className="font-semibold text-[#181624]">{reviewingSubmission.fileName}</div>
                <div>{formatFileSize(reviewingSubmission.fileSize)} • Submitted {new Date(reviewingSubmission.createdAt).toLocaleString()}</div>
              </div>

              <div>
                <label className="text-xs font-bold text-[#2C293A] block mb-1">
                  Mastery Score / Grade (0 - 100)
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={reviewGrade}
                  onChange={(e) => setReviewGrade(e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-32 px-3 py-2 rounded-xl border border-[#D5D2E2] text-xs focus:outline-none focus:border-[#6546D7]"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-[#2C293A] block mb-1">
                  Qualitative Feedback & Speaking Assessment Notes *
                </label>
                <textarea
                  rows={4}
                  value={reviewFeedback}
                  onChange={(e) => setReviewFeedback(e.target.value)}
                  placeholder="Provide constructive feedback on pronunciation, vocabulary usage, grammar, coherence, and assignment completion..."
                  className="w-full p-3 rounded-xl border border-[#D5D2E2] text-xs focus:outline-none focus:border-[#6546D7] resize-none"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  onClick={() => setReviewingSubmission(null)}
                  className="px-4 py-2 rounded-xl border border-[#D5D2E2] hover:bg-[#FAF9FC] text-xs font-semibold text-[#5A5769] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveReview}
                  disabled={isSavingReview || !reviewFeedback.trim()}
                  className="px-5 py-2 rounded-xl bg-[#6546D7] hover:bg-[#5235BF] disabled:opacity-50 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
                >
                  {isSavingReview ? 'Saving Review...' : 'Save Feedback & Grade'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="p-4 px-6 border-t border-[#ECEAF2] bg-[#FAF9FC] flex items-center justify-between text-xs text-[#737084]">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Files are encrypted and stored in Speak Bloom Storage with permission enforcement.</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-[#D5D2E2] bg-white hover:bg-[#FAF9FC] text-xs font-semibold text-[#322F40] cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
