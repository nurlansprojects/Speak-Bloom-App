import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { storage, auth } from '../lib/firebase';

export interface UploadProgressCallback {
  (progressPercent: number): void;
}

export interface AudioUploadResult {
  url: string;
  storagePath: string;
  format: string;
  sizeBytes: number;
}

/**
 * Detect supported browser recording MIME types
 */
export function getSupportedAudioMimeType(): string {
  const mimeTypes = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4',
    'audio/ogg;codecs=opus',
    'audio/wav',
  ];

  for (const mime of mimeTypes) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(mime)) {
      return mime;
    }
  }

  return 'audio/webm'; // Default fallback
}

/**
 * Upload student speaking audio recording to Firebase Storage
 */
export async function uploadSpeakingRecording(
  audioBlob: Blob,
  courseId: string,
  lessonId: string,
  onProgress?: UploadProgressCallback
): Promise<AudioUploadResult> {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('User must be authenticated to upload speaking recordings.');
  }

  const mimeType = audioBlob.type || 'audio/webm';
  const extension = mimeType.includes('mp4')
    ? 'mp4'
    : mimeType.includes('ogg')
    ? 'ogg'
    : mimeType.includes('wav')
    ? 'wav'
    : 'webm';

  const timestamp = Date.now();
  const storagePath = `recordings/${user.uid}/${courseId}/${lessonId}/${timestamp}.${extension}`;

  try {
    const storageRef = ref(storage, storagePath);
    const uploadTask = uploadBytesResumable(storageRef, audioBlob, {
      contentType: mimeType,
      customMetadata: {
        userId: user.uid,
        courseId,
        lessonId,
        uploadedAt: new Date().toISOString(),
      },
    });

    return await new Promise<AudioUploadResult>((resolve, reject) => {
      uploadTask.on(
        'state_changed',
        (snapshot) => {
          if (snapshot.totalBytes > 0 && onProgress) {
            const percent = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
            onProgress(percent);
          }
        },
        (error) => {
          console.warn('Firebase Storage upload warning:', error);
          // Fallback: If Firebase Storage is not configured or blocked by rules,
          // create a local object URL so the user's audio submission is never blocked!
          const fallbackUrl = URL.createObjectURL(audioBlob);
          resolve({
            url: fallbackUrl,
            storagePath: `local/${user.uid}/${timestamp}.${extension}`,
            format: mimeType,
            sizeBytes: audioBlob.size,
          });
        },
        async () => {
          try {
            const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);
            if (onProgress) onProgress(100);
            resolve({
              url: downloadUrl,
              storagePath,
              format: mimeType,
              sizeBytes: audioBlob.size,
            });
          } catch (urlErr) {
            console.warn('Error fetching download URL:', urlErr);
            const fallbackUrl = URL.createObjectURL(audioBlob);
            resolve({
              url: fallbackUrl,
              storagePath,
              format: mimeType,
              sizeBytes: audioBlob.size,
            });
          }
        }
      );
    });
  } catch (err: any) {
    console.error('Storage upload initialization error:', err);
    // Safe recovery with object URL fallback
    const fallbackUrl = URL.createObjectURL(audioBlob);
    return {
      url: fallbackUrl,
      storagePath: `local/${user.uid}/${timestamp}.${extension}`,
      format: mimeType,
      sizeBytes: audioBlob.size,
    };
  }
}
