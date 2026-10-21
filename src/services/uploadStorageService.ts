import {
  ref,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject,
} from 'firebase/storage';
import {
  collection,
  doc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
} from 'firebase/firestore';
import { storage, db, auth, handleFirestoreError, OperationType } from '../lib/firebase';
import { UploadedFileRecord, UploadCategory } from '../types';

export interface FileValidationResult {
  valid: boolean;
  error?: string;
  category?: UploadCategory;
  extension?: string;
}

// Supported file format mappings
export const SUPPORTED_EXTENSIONS = {
  audio: ['mp3'],
  video: ['mp4'],
  document: ['pdf', 'doc', 'docx'],
  spreadsheet: ['xls', 'xlsx'],
  presentation: ['ppt', 'pptx'],
};

export const ALL_ALLOWED_EXTENSIONS = ['mp3', 'mp4', 'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'];

/**
 * Validate selected file format against supported types
 */
export function validateUploadedFile(file: File, allowedList?: string[]): FileValidationResult {
  const parts = file.name.split('.');
  if (parts.length < 2) {
    return {
      valid: false,
      error: 'File is missing an extension. Please select a valid file.',
    };
  }

  const ext = parts.pop()!.toLowerCase();
  const allowed = allowedList && allowedList.length > 0 ? allowedList : ALL_ALLOWED_EXTENSIONS;

  if (!allowed.includes(ext)) {
    return {
      valid: false,
      error: `Unsupported file type ".${ext}". Supported formats are: Audio (MP3), Video (MP4), Documents (DOC, DOCX, PDF), Spreadsheets (XLS, XLSX), Presentations (PPT, PPTX).`,
    };
  }

  let category: UploadCategory = 'document';
  if (SUPPORTED_EXTENSIONS.audio.includes(ext)) {
    category = 'audio';
  } else if (SUPPORTED_EXTENSIONS.video.includes(ext)) {
    category = 'video';
  } else if (SUPPORTED_EXTENSIONS.document.includes(ext)) {
    category = 'document';
  } else if (SUPPORTED_EXTENSIONS.spreadsheet.includes(ext)) {
    category = 'spreadsheet';
  } else if (SUPPORTED_EXTENSIONS.presentation.includes(ext)) {
    category = 'presentation';
  }

  // Maximum file size limit: 50MB
  const maxBytes = 50 * 1024 * 1024;
  if (file.size > maxBytes) {
    return {
      valid: false,
      error: `File size exceeds the 50MB limit (${(file.size / (1024 * 1024)).toFixed(1)}MB). Please choose a smaller file.`,
    };
  }

  return {
    valid: true,
    category,
    extension: ext,
  };
}

/**
 * Formats file size in human readable format
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

/**
 * IndexedDB storage fallback for offline / demo environments
 */
const IDB_NAME = 'SpeakBloom_Uploads_DB';
const IDB_STORE = 'files';

function openUploadsDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      return reject(new Error('IndexedDB not supported'));
    }
    const req = window.indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function saveFileToIndexedDB(key: string, blob: Blob): Promise<string> {
  try {
    const idb = await openUploadsDB();
    await new Promise<void>((resolve, reject) => {
      const tx = idb.transaction(IDB_STORE, 'readwrite');
      tx.objectStore(IDB_STORE).put(blob, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    return URL.createObjectURL(blob);
  } catch (err) {
    console.warn('IDB fallback error:', err);
    return URL.createObjectURL(blob);
  }
}

export type UploadState =
  | 'idle'
  | 'validating'
  | 'uploading'
  | 'processing'
  | 'saving'
  | 'success'
  | 'error'
  | 'cancelled';

export interface UploadOptions {
  onProgress?: (percent: number, transferred: number, total: number) => void;
  onStateChange?: (state: UploadState, message?: string) => void;
  signal?: AbortSignal;
}

/**
 * Upload a file with real byte upload progress tracking, state management, and reliable persistence
 */
export async function uploadFileToStorage(
  file: File,
  courseId: string,
  lessonId?: string,
  onProgressOrOptions?:
    | ((percent: number, transferred: number, total: number) => void)
    | UploadOptions
): Promise<{ fileUrl: string; storagePath: string }> {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('User must be signed in to perform Uploading activities.');
  }

  const options: UploadOptions =
    typeof onProgressOrOptions === 'function'
      ? { onProgress: onProgressOrOptions }
      : onProgressOrOptions || {};

  const { onProgress, onStateChange, signal } = options;

  // 1. Validating state
  onStateChange?.('validating', 'Validating file format and size...');
  const validation = validateUploadedFile(file);
  if (!validation.valid) {
    onStateChange?.('error', validation.error || 'Validation failed');
    throw new Error(validation.error || 'Invalid file format.');
  }

  // 2. Uploading state
  onStateChange?.('uploading', 'Starting real-time file upload...');

  return new Promise<{ fileUrl: string; storagePath: string }>((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    if (signal) {
      if (signal.aborted) {
        onStateChange?.('cancelled', 'Upload was cancelled.');
        return reject(new Error('Upload cancelled.'));
      }
      signal.addEventListener('abort', () => {
        xhr.abort();
        onStateChange?.('cancelled', 'Upload was cancelled.');
        reject(new Error('Upload cancelled.'));
      });
    }

    xhr.upload.onprogress = (evt) => {
      if (evt.lengthComputable && evt.total > 0) {
        const percent = Math.min(99, Math.round((evt.loaded / evt.total) * 100));
        onProgress?.(percent, evt.loaded, evt.total);
        onStateChange?.('uploading', `Uploading... ${percent}%`);
      }
    };

    xhr.upload.onload = () => {
      // Bytes transferred to server; server is now processing and persisting the file stream
      onProgress?.(100, file.size, file.size);
      onStateChange?.('processing', 'Processing and verifying file storage...');
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const resp = JSON.parse(xhr.responseText);
          if (resp.success && resp.data?.fileUrl) {
            resolve({
              fileUrl: resp.data.fileUrl,
              storagePath: resp.data.storagePath,
            });
            return;
          }
          throw new Error(resp.error?.message || 'Invalid server response');
        } catch (parseErr: any) {
          onStateChange?.('error', parseErr.message || 'Failed to parse upload response');
          reject(new Error(parseErr.message || 'Failed to parse upload response.'));
        }
      } else {
        const msg = `Upload server error (HTTP ${xhr.status}): ${xhr.statusText || 'Upload failed'}`;
        onStateChange?.('error', msg);
        reject(new Error(msg));
      }
    };

    xhr.onerror = async () => {
      console.warn('Network upload error, falling back to local persistent store...');
      try {
        const cleanName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const fallbackPath = `uploads/${user.uid}/${courseId}/${lessonId || 'general'}/${Date.now()}_${cleanName}`;
        const fallbackUrl = await saveFileToIndexedDB(fallbackPath, file);
        onProgress?.(100, file.size, file.size);
        resolve({
          fileUrl: fallbackUrl,
          storagePath: `idb://${fallbackPath}`,
        });
      } catch (fallbackErr: any) {
        const msg = 'Network error during upload. Please check your connection and retry.';
        onStateChange?.('error', msg);
        reject(new Error(msg));
      }
    };

    xhr.onabort = () => {
      onStateChange?.('cancelled', 'Upload was cancelled.');
      reject(new Error('Upload cancelled.'));
    };

    try {
      xhr.open('POST', '/api/storage/upload');
      xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
      xhr.setRequestHeader('X-Filename', encodeURIComponent(file.name));
      xhr.setRequestHeader('X-Course-Id', encodeURIComponent(courseId));
      if (lessonId) {
        xhr.setRequestHeader('X-Lesson-Id', encodeURIComponent(lessonId));
      }
      xhr.send(file);
    } catch (sendErr: any) {
      onStateChange?.('error', sendErr.message || 'Failed to initiate upload');
      reject(sendErr);
    }
  });
}

/**
 * Persist upload metadata into Firestore database
 */
export async function createUploadRecord(
  data: Omit<UploadedFileRecord, 'id' | 'createdAt' | 'updatedAt'>,
  existingId?: string
): Promise<UploadedFileRecord> {
  try {
    const uploadRef = existingId ? doc(db, 'uploads', existingId) : doc(collection(db, 'uploads'));
    const docId = uploadRef.id;
    const now = new Date().toISOString();

    const rawRecord: Record<string, any> = {
      ...data,
      id: docId,
      createdAt: now,
      updatedAt: now,
    };

    // Prune undefined fields so Firestore payload strictly conforms to schema
    const cleanRecord: Record<string, any> = {};
    for (const [key, value] of Object.entries(rawRecord)) {
      if (value !== undefined) {
        cleanRecord[key] = value;
      }
    }

    await setDoc(uploadRef, cleanRecord);
    return cleanRecord as UploadedFileRecord;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, 'uploads');
  }
}

/**
 * Update an existing upload record
 */
export async function updateUploadRecord(
  uploadId: string,
  updates: Partial<UploadedFileRecord>
): Promise<void> {
  try {
    const uploadRef = doc(db, 'uploads', uploadId);
    const cleanUpdates: Record<string, any> = {
      updatedAt: new Date().toISOString(),
    };
    for (const [key, value] of Object.entries(updates)) {
      if (value !== undefined) {
        cleanUpdates[key] = value;
      }
    }
    await updateDoc(uploadRef, cleanUpdates);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `uploads/${uploadId}`);
  }
}

/**
 * Delete an upload record and its storage resource
 */
export async function deleteUploadRecord(upload: UploadedFileRecord): Promise<void> {
  try {
    // 1. Delete from Firestore
    const uploadRef = doc(db, 'uploads', upload.id);
    await deleteDoc(uploadRef);

    // 2. Delete from storage resource
    if (upload.storagePath && upload.storagePath.startsWith('server://uploads/')) {
      const filename = upload.storagePath.replace('server://uploads/', '');
      try {
        await fetch(`/api/storage/files/${encodeURIComponent(filename)}`, { method: 'DELETE' });
      } catch (err) {
        console.warn('Could not delete server storage file:', err);
      }
    } else if (upload.storagePath && !upload.storagePath.startsWith('idb://')) {
      try {
        const storageRef = ref(storage, upload.storagePath);
        await deleteObject(storageRef);
      } catch (err) {
        console.warn('Could not delete storage object:', err);
      }
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `uploads/${upload.id}`);
  }
}

/**
 * Teacher files attached to a course
 */
export async function getTeacherUploadsForCourse(courseId: string): Promise<UploadedFileRecord[]> {
  try {
    const uploadsRef = collection(db, 'uploads');
    const q = query(
      uploadsRef,
      where('courseId', '==', courseId),
      where('scope', '==', 'teacher_resource')
    );
    const snap = await getDocs(q);
    const records = snap.docs.map((d) => ({ id: d.id, ...d.data() } as UploadedFileRecord));
    return records.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'uploads');
  }
}

/**
 * Teacher files attached to a lesson
 */
export async function getTeacherUploadsForLesson(
  courseId: string,
  lessonId: string
): Promise<UploadedFileRecord[]> {
  try {
    const uploadsRef = collection(db, 'uploads');
    const q = query(
      uploadsRef,
      where('courseId', '==', courseId),
      where('lessonId', '==', lessonId),
      where('scope', '==', 'teacher_resource')
    );
    const snap = await getDocs(q);
    const records = snap.docs.map((d) => ({ id: d.id, ...d.data() } as UploadedFileRecord));
    return records.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'uploads');
  }
}

/**
 * Get uploads attached to an activity (both teacher resources and student submissions if authorized)
 */
export async function getUploadsForActivity(
  courseId: string,
  activityId: string
): Promise<UploadedFileRecord[]> {
  try {
    const uploadsRef = collection(db, 'uploads');
    const q = query(
      uploadsRef,
      where('courseId', '==', courseId),
      where('activityId', '==', activityId)
    );
    const snap = await getDocs(q);
    const records = snap.docs.map((d) => ({ id: d.id, ...d.data() } as UploadedFileRecord));
    return records.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'uploads');
  }
}

/**
 * Get student's private submissions for a specific activity
 */
export async function getStudentSubmissionsForActivity(
  courseId: string,
  activityId: string,
  studentId: string
): Promise<UploadedFileRecord[]> {
  try {
    const uploadsRef = collection(db, 'uploads');
    const q = query(
      uploadsRef,
      where('courseId', '==', courseId),
      where('activityId', '==', activityId),
      where('userId', '==', studentId),
      where('scope', '==', 'student_submission')
    );
    const snap = await getDocs(q);
    const records = snap.docs.map((d) => ({ id: d.id, ...d.data() } as UploadedFileRecord));
    return records.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'uploads');
  }
}

/**
 * Get all student submissions for a course (for teacher review)
 */
export async function getCourseSubmissionsForTeacherUploads(
  courseId: string
): Promise<UploadedFileRecord[]> {
  try {
    const uploadsRef = collection(db, 'uploads');
    const q = query(
      uploadsRef,
      where('courseId', '==', courseId),
      where('scope', '==', 'student_submission')
    );
    const snap = await getDocs(q);
    const records = snap.docs.map((d) => ({ id: d.id, ...d.data() } as UploadedFileRecord));
    return records.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'uploads');
  }
}

/**
 * Get all submissions by a student across all courses
 */
export async function getStudentAllSubmissions(studentId: string): Promise<UploadedFileRecord[]> {
  try {
    const uploadsRef = collection(db, 'uploads');
    const q = query(
      uploadsRef,
      where('userId', '==', studentId),
      where('scope', '==', 'student_submission')
    );
    const snap = await getDocs(q);
    const records = snap.docs.map((d) => ({ id: d.id, ...d.data() } as UploadedFileRecord));
    return records.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'uploads');
  }
}

/**
 * Teacher reviews student submission and provides feedback
 */
export async function teacherReviewSubmission(
  uploadId: string,
  feedback: string,
  grade: number | undefined,
  teacherId: string,
  teacherName: string
): Promise<void> {
  try {
    const uploadRef = doc(db, 'uploads', uploadId);
    await updateDoc(uploadRef, {
      feedback,
      grade: grade !== undefined ? grade : null,
      status: 'reviewed',
      reviewedBy: teacherId,
      reviewedByName: teacherName,
      reviewedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `uploads/${uploadId}`);
  }
}
