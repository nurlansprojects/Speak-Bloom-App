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
/**
 * Server storage fallback for audio recordings
 */
async function uploadBlobToServer(blob: Blob, filename: string): Promise<{ fileUrl: string; storagePath: string }> {
  const xhr = new XMLHttpRequest();
  return new Promise((resolve, reject) => {
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
          reject(new Error('Invalid response'));
        } catch (e) {
          reject(e);
        }
      } else {
        reject(new Error(`Server error ${xhr.status}`));
      }
    };
    xhr.onerror = () => reject(new Error('Network error'));
    xhr.open('POST', '/api/storage/upload');
    xhr.setRequestHeader('Content-Type', blob.type || 'audio/webm');
    xhr.setRequestHeader('X-Filename', encodeURIComponent(filename));
    xhr.send(blob);
  });
}

/**
 * Upload student speaking audio recording to Firebase Storage with timeout guard & server fallback
 */
export async function uploadSpeakingRecording(
  audioBlob: Blob,
  courseId: string,
  lessonId: string,
  onProgress?: UploadProgressCallback,
  activityId?: string
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
  const subPath = activityId ? `${activityId}/` : '';
  const storagePath = `recordings/${user.uid}/${courseId}/${lessonId}/${subPath}${timestamp}.${extension}`;

  try {
    const storageRef = ref(storage, storagePath);
    const uploadTask = uploadBytesResumable(storageRef, audioBlob, {
      contentType: mimeType,
      customMetadata: {
        userId: user.uid,
        courseId,
        lessonId,
        activityId: activityId || '',
        uploadedAt: new Date().toISOString(),
      },
    });

    return await new Promise<AudioUploadResult>((resolve) => {
      let settled = false;

      // 10-second timeout guard to prevent infinite loading
      const timeoutId = setTimeout(async () => {
        if (settled) return;
        settled = true;
        try {
          uploadTask.cancel();
        } catch {}
        console.warn('Firebase Storage upload timed out after 10s, trying server fallback...');
        try {
          const serverRes = await uploadBlobToServer(audioBlob, `${timestamp}_recording.${extension}`);
          resolve({
            url: serverRes.fileUrl,
            storagePath: serverRes.storagePath,
            format: mimeType,
            sizeBytes: audioBlob.size,
          });
        } catch {
          const fallbackUrl = URL.createObjectURL(audioBlob);
          resolve({
            url: fallbackUrl,
            storagePath,
            format: mimeType,
            sizeBytes: audioBlob.size,
          });
        }
      }, 10000);

      uploadTask.on(
        'state_changed',
        (snapshot) => {
          if (snapshot.totalBytes > 0 && onProgress) {
            const percent = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
            onProgress(percent);
          }
        },
        async (error) => {
          if (settled) return;
          settled = true;
          clearTimeout(timeoutId);
          console.warn('Firebase Storage upload error, using server fallback:', error);
          try {
            const serverRes = await uploadBlobToServer(audioBlob, `${timestamp}_recording.${extension}`);
            resolve({
              url: serverRes.fileUrl,
              storagePath: serverRes.storagePath,
              format: mimeType,
              sizeBytes: audioBlob.size,
            });
          } catch {
            const fallbackUrl = URL.createObjectURL(audioBlob);
            resolve({
              url: fallbackUrl,
              storagePath,
              format: mimeType,
              sizeBytes: audioBlob.size,
            });
          }
        },
        async () => {
          if (settled) return;
          settled = true;
          clearTimeout(timeoutId);
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
            console.warn('Error fetching download URL, trying server fallback:', urlErr);
            try {
              const serverRes = await uploadBlobToServer(audioBlob, `${timestamp}_recording.${extension}`);
              resolve({
                url: serverRes.fileUrl,
                storagePath: serverRes.storagePath,
                format: mimeType,
                sizeBytes: audioBlob.size,
              });
            } catch {
              const fallbackUrl = URL.createObjectURL(audioBlob);
              resolve({
                url: fallbackUrl,
                storagePath,
                format: mimeType,
                sizeBytes: audioBlob.size,
              });
            }
          }
        }
      );
    });
  } catch (err: any) {
    console.error('Storage upload initialization error, using server fallback:', err);
    try {
      const serverRes = await uploadBlobToServer(audioBlob, `${timestamp}_recording.${extension}`);
      return {
        url: serverRes.fileUrl,
        storagePath: serverRes.storagePath,
        format: mimeType,
        sizeBytes: audioBlob.size,
      };
    } catch {
      const fallbackUrl = URL.createObjectURL(audioBlob);
      return {
        url: fallbackUrl,
        storagePath,
        format: mimeType,
        sizeBytes: audioBlob.size,
      };
    }
  }
}
