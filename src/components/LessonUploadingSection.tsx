import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { Course, Lesson, UploadedFileRecord } from '../types';
import {
  validateUploadedFile,
  formatFileSize,
  uploadFileToStorage,
  createUploadRecord,
  deleteUploadRecord,
  getTeacherUploadsForLesson,
  ALL_ALLOWED_EXTENSIONS,
  UploadState,
} from '../services/uploadStorageService';
import {
  UploadCloud,
  File,
  FileText,
  Film,
  Music,
  FileSpreadsheet,
  Presentation,
  Download,
  Trash2,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Plus,
  X,
  Paperclip,
} from 'lucide-react';

interface LessonUploadingSectionProps {
  course: Course;
  lesson: Lesson;
  readOnly?: boolean;
}

export const LessonUploadingSection: React.FC<LessonUploadingSectionProps> = ({
  course,
  lesson,
  readOnly = false,
}) => {
  const { currentUser, userProfile } = useAuth();
  const isTeacher =
    userProfile?.role === 'teacher' ||
    userProfile?.role === 'admin' ||
    course.teacherId === currentUser?.uid;

  const [files, setFiles] = useState<UploadedFileRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [showUploadForm, setShowUploadForm] = useState(false);

  // Upload state
  const [fileToUpload, setFileToUpload] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [instructions, setInstructions] = useState('');
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [uploadState, setUploadState] = useState<UploadState>('idle');
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(null);
  const [uploadedStoragePath, setUploadedStoragePath] = useState<string | null>(null);
  const [abortController, setAbortController] = useState<AbortController | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    loadLessonFiles();
  }, [course.id, lesson.id]);

  const loadLessonFiles = async () => {
    setLoading(true);
    try {
      const records = await getTeacherUploadsForLesson(course.id, lesson.id);
      setFiles(records);
    } catch (err) {
      console.error('Failed to load lesson upload files:', err);
    } finally {
      setLoading(false);
    }
  };

  const getFileIcon = (fileType: string, extension: string) => {
    switch (fileType) {
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
        if (extension === 'pdf') {
          return <FileText className="w-4 h-4 text-rose-500" />;
        }
        return <File className="w-4 h-4 text-blue-600" />;
    }
  };

  const handleFilePicked = (e: React.ChangeEvent<HTMLInputElement>) => {
    setErrorMessage(null);
    setUploadedUrl(null);
    setUploadedStoragePath(null);
    setUploadState('idle');
    setStatusMessage('');
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    const validation = validateUploadedFile(file, ALL_ALLOWED_EXTENSIONS);
    if (!validation.valid) {
      setErrorMessage(validation.error || 'Invalid file format.');
      return;
    }

    setFileToUpload(file);
    if (!title) {
      setTitle(file.name);
    }
  };

  const cancelUpload = () => {
    if (abortController) {
      abortController.abort();
    }
    setUploadState('cancelled');
    setStatusMessage('Upload cancelled.');
  };

  const handleStartUpload = async () => {
    if (!fileToUpload || !currentUser || !userProfile) return;
    setErrorMessage(null);

    let fileUrl = uploadedUrl;
    let storagePath = uploadedStoragePath;

    // 1. Validating
    setUploadState('validating');
    setStatusMessage('Validating file format and size...');
    const validation = validateUploadedFile(fileToUpload, ALL_ALLOWED_EXTENSIONS);
    if (!validation.valid) {
      setUploadState('error');
      setErrorMessage(validation.error || 'Invalid file format.');
      return;
    }

    // 2. Uploading (if not already uploaded to storage)
    if (!fileUrl || !storagePath) {
      const controller = new AbortController();
      setAbortController(controller);
      setUploadState('uploading');
      setUploadProgress(0);
      setStatusMessage('Uploading bytes to storage...');

      try {
        const uploadRes = await uploadFileToStorage(
          fileToUpload,
          course.id,
          lesson.id,
          {
            signal: controller.signal,
            onProgress: (percent) => {
              setUploadProgress(percent);
              setStatusMessage(`Uploading... ${percent}%`);
            },
            onStateChange: (state, msg) => {
              setUploadState(state);
              if (msg) setStatusMessage(msg);
            },
          }
        );

        fileUrl = uploadRes.fileUrl;
        storagePath = uploadRes.storagePath;
        setUploadedUrl(fileUrl);
        setUploadedStoragePath(storagePath);
        setUploadProgress(100);
        setUploadState('processing');
        setStatusMessage('Verifying storage...');
      } catch (err: any) {
        if (controller.signal.aborted) {
          setUploadState('cancelled');
          setStatusMessage('Upload cancelled by user.');
        } else {
          setUploadState('error');
          setErrorMessage(err.message || 'Failed to complete uploading.');
        }
        return;
      }
    }

    // 3. Saving to database
    setUploadState('saving');
    setStatusMessage('Saving lesson resource to database...');

    try {
      const newRecord = await createUploadRecord({
        userId: currentUser.uid,
        userName: userProfile.displayName || 'Instructor',
        userRole: userProfile.role || 'teacher',
        courseId: course.id,
        lessonId: lesson.id,
        scope: 'teacher_resource',
        title: title.trim() || fileToUpload.name,
        instructions: instructions.trim() || undefined,
        fileName: fileToUpload.name,
        fileType: validation.category || 'document',
        fileExtension: validation.extension || 'file',
        mimeType: fileToUpload.type || 'application/octet-stream',
        fileSize: fileToUpload.size,
        fileUrl: fileUrl!,
        storagePath: storagePath!,
        status: 'submitted',
      });

      setUploadState('success');
      setStatusMessage('Uploaded & saved successfully!');
      setFiles((prev) => [newRecord, ...prev]);

      setTimeout(() => {
        setFileToUpload(null);
        setTitle('');
        setInstructions('');
        setUploadProgress(null);
        setUploadedUrl(null);
        setUploadedStoragePath(null);
        setUploadState('idle');
        setStatusMessage('');
        setShowUploadForm(false);
      }, 700);
    } catch (err: any) {
      setUploadState('error');
      setErrorMessage(`Storage uploaded, but saving to database failed: ${err.message || 'Database error'}. Click Retry to save without re-uploading.`);
    }
  };

  const handleDelete = async (record: UploadedFileRecord) => {
    if (!isTeacher) return;
    if (!window.confirm(`Delete "${record.fileName}"?`)) return;

    try {
      await deleteUploadRecord(record);
      setFiles((prev) => prev.filter((f) => f.id !== record.id));
    } catch (err: any) {
      alert(err.message || 'Failed to delete file.');
    }
  };

  return (
    <div className="bg-white rounded-3xl p-6 sm:p-8 border border-[#ECEAF2] shadow-xs space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-base sm:text-lg font-bold text-[#181624] flex items-center gap-2">
            <Paperclip className="w-4 h-4 text-[#6546D7]" />
            <span>Lesson Materials & Uploading Resources</span>
          </h3>
          <p className="text-xs text-[#6F6C7E] mt-0.5">
            Reference audio, documents, presentations, spreadsheets, and instructional videos for this lesson.
          </p>
        </div>

        {isTeacher && !readOnly && !showUploadForm && (
          <button
            onClick={() => setShowUploadForm(true)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#6546D7] hover:bg-[#5235BF] text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer self-start sm:self-auto"
          >
            <UploadCloud className="w-3.5 h-3.5" />
            <span>Uploading Lesson File</span>
          </button>
        )}
      </div>

      {/* Teacher Upload Form */}
      {showUploadForm && (
        <div className="p-4 sm:p-5 rounded-2xl bg-[#FAF9FC] border border-[#DDD7F5] space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-[#ECE8F8] text-[#6546D7]">
                Uploading
              </span>
              <h4 className="text-xs font-bold text-[#181624]">Attach Lesson Resource</h4>
            </div>
            <button
              onClick={() => {
                setShowUploadForm(false);
                setFileToUpload(null);
                setErrorMessage(null);
              }}
              className="p-1 rounded-full text-[#7B788C] hover:text-[#181624]"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-bold text-[#322F40] block mb-1">
                Resource Title *
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Conversation Framework Slides (PPTX) / Dialogue Audio (MP3)"
                className="w-full px-3 py-2 rounded-xl border border-[#D5D2E2] bg-white text-xs focus:outline-none focus:border-[#6546D7]"
              />
            </div>
            <div>
              <label className="text-[11px] font-bold text-[#322F40] block mb-1">
                Instructions for Students (Optional)
              </label>
              <input
                type="text"
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                placeholder="e.g. Listen before attempting the speaking rubric exercise"
                className="w-full px-3 py-2 rounded-xl border border-[#D5D2E2] bg-white text-xs focus:outline-none focus:border-[#6546D7]"
              />
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".mp3,.mp4,.doc,.docx,.pdf,.xls,.xlsx,.ppt,.pptx,audio/mpeg,video/mp4,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation"
                className="hidden"
                onChange={handleFilePicked}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-3.5 py-1.5 rounded-xl border border-[#D5D2E2] bg-white hover:bg-[#FAF9FC] text-xs font-semibold text-[#322F40] flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5 text-[#6546D7]" />
                <span>{fileToUpload ? fileToUpload.name : 'Choose File (MP3, MP4, PDF, DOCX, XLSX, PPTX)'}</span>
              </button>
              {fileToUpload && (
                <div className="text-[10px] text-[#696677] mt-1">
                  Selected: {fileToUpload.name} ({formatFileSize(fileToUpload.size)})
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              {uploadState === 'uploading' && (
                <button
                  type="button"
                  onClick={cancelUpload}
                  className="px-3.5 py-1.5 rounded-xl border border-rose-200 text-rose-600 hover:bg-rose-50 text-xs font-semibold cursor-pointer"
                >
                  Cancel Upload
                </button>
              )}
              {uploadState !== 'uploading' && uploadState !== 'processing' && uploadState !== 'saving' && (
                <button
                  type="button"
                  onClick={() => {
                    setShowUploadForm(false);
                    setFileToUpload(null);
                    setUploadedUrl(null);
                    setUploadedStoragePath(null);
                    setErrorMessage(null);
                  }}
                  className="px-3.5 py-1.5 rounded-xl border border-[#D5D2E2] text-xs font-semibold text-[#666375] hover:bg-white cursor-pointer"
                >
                  Close
                </button>
              )}
              <button
                type="button"
                onClick={handleStartUpload}
                disabled={
                  !fileToUpload ||
                  uploadState === 'uploading' ||
                  uploadState === 'processing' ||
                  uploadState === 'saving'
                }
                className="px-4 py-1.5 rounded-xl bg-[#6546D7] hover:bg-[#5235BF] disabled:opacity-50 text-white text-xs font-semibold shadow-xs flex items-center gap-1.5 cursor-pointer"
              >
                {uploadState === 'uploading' ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Uploading ({uploadProgress || 0}%)...</span>
                  </>
                ) : uploadState === 'processing' ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Processing...</span>
                  </>
                ) : uploadState === 'saving' ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : uploadState === 'error' ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>{uploadedUrl ? 'Retry Save' : 'Retry Uploading'}</span>
                  </>
                ) : (
                  <>
                    <UploadCloud className="w-3.5 h-3.5" />
                    <span>Confirm Uploading</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Real-time Progress Bar */}
          {(uploadState === 'uploading' ||
            uploadState === 'processing' ||
            uploadState === 'saving' ||
            uploadState === 'success') && (
            <div className="space-y-1.5 pt-1">
              <div className="w-full h-1.5 rounded-full bg-[#E5E3ED] overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${
                    uploadState === 'success' ? 'bg-emerald-500' : 'bg-[#6546D7]'
                  }`}
                  style={{ width: `${uploadProgress || (uploadState === 'success' ? 100 : 50)}%` }}
                />
              </div>
              <div className="flex justify-between text-[11px] text-[#716E82]">
                <span>
                  {fileToUpload && uploadProgress
                    ? `${formatFileSize((fileToUpload.size * uploadProgress) / 100)} of ${formatFileSize(fileToUpload.size)}`
                    : ''}
                </span>
                <span className="font-medium text-[#6546D7]">{statusMessage}</span>
              </div>
            </div>
          )}

          {errorMessage && (
            <div className="text-xs text-rose-700 bg-rose-50 border border-rose-200 p-2.5 rounded-xl flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}
        </div>
      )}

      {/* Files List */}
      {loading ? (
        <div className="py-6 flex justify-center">
          <div className="w-5 h-5 border-2 border-[#6546D7] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : files.length === 0 ? (
        <div className="p-5 rounded-2xl bg-[#FAF9FC] border border-dashed border-[#DDD9E8] text-center">
          <p className="text-xs text-[#706D7F]">
            No reference materials attached to this lesson yet.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {files.map((file) => (
            <div
              key={file.id}
              className="p-3.5 rounded-2xl border border-[#ECEAF2] bg-[#FAF9FC] hover:border-[#6546D7]/40 transition-all flex items-center justify-between gap-3"
            >
              <div className="flex items-center gap-2.5 overflow-hidden">
                <div className="p-2 rounded-xl bg-white border border-[#ECEAF2] shrink-0">
                  {getFileIcon(file.fileType, file.fileExtension)}
                </div>
                <div className="truncate">
                  <div className="text-xs font-bold text-[#181624] truncate">
                    {file.title || file.fileName}
                  </div>
                  <div className="text-[10px] text-[#767385] truncate">
                    .{file.fileExtension.toUpperCase()} • {formatFileSize(file.fileSize)}
                    {file.instructions ? ` • "${file.instructions}"` : ''}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <a
                  href={file.fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1.5 rounded-lg border border-[#E2DFEC] bg-white hover:bg-[#F2EFFB] text-[#6546D7] transition-colors cursor-pointer"
                  title="Download or preview file"
                >
                  <Download className="w-3.5 h-3.5" />
                </a>
                {isTeacher && !readOnly && (
                  <button
                    onClick={() => handleDelete(file)}
                    className="p-1.5 rounded-lg border border-[#E2DFEC] bg-white hover:bg-rose-50 text-[#7F7C8E] hover:text-rose-600 transition-colors cursor-pointer"
                    title="Delete file"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
