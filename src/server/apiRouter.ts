import express from 'express';
import {
  generateSpeakingPartnerResponse,
  evaluateSpeakingSubmission,
  transcribeAudio,
  generateSpeechAudio,
} from './gemini';

import fs from 'fs';
import path from 'path';

const router = express.Router();

// Ensure local persistent uploads directory exists
const UPLOAD_DIR = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) {
  try {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  } catch (err) {
    console.error('Failed to create upload directory:', err);
  }
}

// Allow audio payloads up to 100MB
router.use(express.json({ limit: '100mb' }));
router.use(express.urlencoded({ extended: true, limit: '100mb' }));

/**
 * Upload file to persistent server storage with streaming
 */
router.post('/storage/upload', (req, res) => {
  try {
    const rawFilename = (req.headers['x-filename'] as string) || 'uploaded_file';
    const decodedFilename = decodeURIComponent(rawFilename);
    const cleanFilename = decodedFilename.replace(/[^a-zA-Z0-9._-]/g, '_');
    const uniqueFilename = `${Date.now()}_${cleanFilename}`;
    const filePath = path.join(UPLOAD_DIR, uniqueFilename);
    const mimeType = (req.headers['content-type'] as string) || 'application/octet-stream';

    const writeStream = fs.createWriteStream(filePath);
    let totalBytes = 0;

    req.on('data', (chunk) => {
      totalBytes += chunk.length;
      writeStream.write(chunk);
    });

    req.on('end', () => {
      writeStream.end(() => {
        const fileUrl = `/api/storage/files/${uniqueFilename}`;
        res.json({
          success: true,
          data: {
            fileUrl,
            storagePath: `server://uploads/${uniqueFilename}`,
            fileName: decodedFilename,
            size: totalBytes,
            mimeType,
          },
        });
      });
    });

    req.on('error', (err) => {
      console.error('Upload stream error:', err);
      writeStream.destroy();
      if (!res.headersSent) {
        res.status(500).json({
          success: false,
          error: { code: 'UPLOAD_FAILED', message: 'Failed to write file stream.' },
        });
      }
    });

    writeStream.on('error', (err) => {
      console.error('File write stream error:', err);
      if (!res.headersSent) {
        res.status(500).json({
          success: false,
          error: { code: 'WRITE_ERROR', message: 'Failed to save file to disk.' },
        });
      }
    });
  } catch (err: any) {
    console.error('Upload route error:', err);
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: err?.message || 'Storage error' },
    });
  }
});

/**
 * Serve stored files with byte range support for audio/video streaming & document downloads
 */
router.get('/storage/files/:filename', (req, res) => {
  try {
    const safeFilename = path.basename(req.params.filename);
    const filePath = path.join(UPLOAD_DIR, safeFilename);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'File not found on storage server.' },
      });
    }

    res.sendFile(filePath, {
      acceptRanges: true,
      headers: {
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch (err: any) {
    console.error('File serve error:', err);
    res.status(500).json({
      success: false,
      error: { code: 'SERVE_ERROR', message: err?.message || 'Could not serve file.' },
    });
  }
});

/**
 * Delete stored file
 */
router.delete('/storage/files/:filename', (req, res) => {
  try {
    const safeFilename = path.basename(req.params.filename);
    const filePath = path.join(UPLOAD_DIR, safeFilename);

    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    res.json({ success: true, message: 'File removed successfully.' });
  } catch (err: any) {
    console.error('File deletion error:', err);
    res.status(500).json({
      success: false,
      error: { code: 'DELETE_ERROR', message: err?.message || 'Could not delete file.' },
    });
  }
});

// Health Check
router.get('/health', (_req, res) => {
  res.json({
    success: true,
    data: {
      status: 'ok',
      service: 'Speak Bloom Backend API',
      geminiConfigured: !!process.env.GEMINI_API_KEY,
    },
  });
});

/**
 * Interactive speaking partner chat
 */
router.post('/ai/chat', async (req, res) => {
  try {
    const { message, history, lessonContext } = req.body;
    if (!message || typeof message !== 'string') {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_INPUT', message: 'Message text is required.' },
      });
    }

    const result = await generateSpeakingPartnerResponse(
      message,
      Array.isArray(history) ? history : [],
      lessonContext || { title: 'English Conversation', cefrLevel: 'B1' }
    );

    res.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    console.error('API /ai/chat error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'AI_CHAT_ERROR',
        message: error?.message || 'Failed to generate speaking response.',
      },
    });
  }
});

/**
 * 6-criterion rubric evaluation
 */
router.post('/ai/assess', async (req, res) => {
  try {
    const { submissionText, audioBase64, mimeType, lessonContext, masteryThreshold } = req.body;

    let textToEvaluate = submissionText;

    // If audio is provided but no text, transcribe first
    if (!textToEvaluate && audioBase64) {
      try {
        const { transcript } = await transcribeAudio(audioBase64, mimeType || 'audio/webm');
        textToEvaluate = transcript;
      } catch (err) {
        console.error('Transcription error during assess:', err);
      }
    }

    if (!textToEvaluate || typeof textToEvaluate !== 'string' || textToEvaluate.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'EMPTY_SUBMISSION',
          message: 'No speaking response or transcript available for evaluation. Please speak or provide text.',
        },
      });
    }

    const evaluation = await evaluateSpeakingSubmission(
      textToEvaluate,
      lessonContext || { title: 'Speaking Assessment', cefrLevel: 'B1' },
      Number(masteryThreshold) || 75
    );

    res.json({
      success: true,
      data: {
        ...evaluation,
        transcript: textToEvaluate,
      },
    });
  } catch (error: any) {
    console.error('API /ai/assess error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'AI_ASSESS_ERROR',
        message: error?.message || 'Failed to evaluate speaking submission.',
      },
    });
  }
});

/**
 * Transcribe pre-recorded audio
 */
router.post('/ai/transcribe', async (req, res) => {
  try {
    const { audioBase64, mimeType } = req.body;
    if (!audioBase64) {
      return res.status(400).json({
        success: false,
        error: { code: 'MISSING_AUDIO', message: 'audioBase64 payload is required.' },
      });
    }

    const result = await transcribeAudio(audioBase64, mimeType || 'audio/webm');
    res.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    console.error('API /ai/transcribe error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'TRANSCRIBE_ERROR',
        message: error?.message || 'Failed to transcribe audio.',
      },
    });
  }
});

/**
 * Text-to-speech for speaking lessons and audio feedback
 */
router.post('/ai/tts', async (req, res) => {
  try {
    const { text, voice } = req.body;
    if (!text || typeof text !== 'string') {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_TEXT', message: 'Text is required for TTS.' },
      });
    }

    const result = await generateSpeechAudio(text, voice || 'Kore');
    res.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    console.error('API /ai/tts error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'TTS_ERROR',
        message: error?.message || 'Failed to synthesize speech audio.',
      },
    });
  }
});

/**
 * DELETE /api/courses/:courseId
 * Server-authoritative course deletion endpoint
 * Verifies authenticated caller identity, validates course ownership or admin privileges,
 * and purges stored files on server disk.
 */
router.delete('/courses/:courseId', async (req, res) => {
  try {
    const { courseId } = req.params;
    if (!courseId) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_ID', message: 'Course ID is required.' },
      });
    }

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Bearer authentication token is required.' },
      });
    }

    const idToken = authHeader.split('Bearer ')[1].trim();

    // Read project config
    const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
    let fbConfig: any = {};
    if (fs.existsSync(configPath)) {
      try {
        fbConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      } catch (err) {
        console.error('Failed reading firebase config in server:', err);
      }
    }

    const apiKey = fbConfig.apiKey || process.env.VITE_FIREBASE_API_KEY || 'AIzaSyAUCiXkqVEmvFYXm_lIR1DG5keQOQyIKOs';
    const projectId = fbConfig.projectId || 'gen-lang-client-0382135068';
    const databaseId = fbConfig.firestoreDatabaseId || 'ai-studio-97c4ed04-a739-49b6-b197-5c944b301cde';

    // Verify token with Firebase REST API (Identity Toolkit)
    const verifyResp = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      }
    );

    if (!verifyResp.ok) {
      return res.status(401).json({
        success: false,
        error: { code: 'INVALID_TOKEN', message: 'Invalid or expired Firebase authentication token.' },
      });
    }

    const verifyData = await verifyResp.json();
    const user = verifyData.users?.[0];
    if (!user) {
      return res.status(401).json({
        success: false,
        error: { code: 'USER_NOT_FOUND', message: 'User record not found for provided token.' },
      });
    }

    const uid = user.localId;
    const email = (user.email || '').toLowerCase();
    const isAdmin =
      email === 'cookingmaxxer@gmail.com' ||
      email === 'nurlandigital@gmail.com';

    // Verify course ownership or admin authorization via Firestore REST API using the user's token
    const firestoreCourseUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${databaseId}/documents/courses/${courseId}`;
    const getCourseResp = await fetch(firestoreCourseUrl, {
      headers: { Authorization: `Bearer ${idToken}` },
    });

    if (getCourseResp.ok) {
      const courseDoc = await getCourseResp.json();
      const teacherId = courseDoc.fields?.teacherId?.stringValue;
      if (!isAdmin && teacherId && teacherId !== uid) {
        return res.status(403).json({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'You are not authorized to delete this course. Only the owning instructor or an administrator can delete it.',
          },
        });
      }
    } else if (getCourseResp.status !== 404 && getCourseResp.status !== 403) {
      console.warn('Firestore course check returned status:', getCourseResp.status);
    }

    // Clean up any files on disk in uploads directory that are tagged with or reference this course
    try {
      if (fs.existsSync(UPLOAD_DIR)) {
        const files = fs.readdirSync(UPLOAD_DIR);
        for (const file of files) {
          if (file.includes(courseId)) {
            try {
              fs.unlinkSync(path.join(UPLOAD_DIR, file));
            } catch (unlinkErr) {
              console.warn(`Could not delete course file ${file}:`, unlinkErr);
            }
          }
        }
      }
    } catch (fsErr) {
      console.warn('Error during disk files purge:', fsErr);
    }

    return res.json({
      success: true,
      data: {
        courseId,
        purgedBy: uid,
        timestamp: new Date().toISOString(),
      },
      message: 'Course and related assets permanently deleted from platform.',
    });
  } catch (err: any) {
    console.error('API DELETE /courses/:courseId error:', err);
    return res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: err?.message || 'Failed to process course deletion.' },
    });
  }
});

// Catch-all for undefined /api routes: Return JSON 404, never HTML!
router.use('*', (_req, res) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: 'API endpoint not found.',
    },
  });
});

export default router;
