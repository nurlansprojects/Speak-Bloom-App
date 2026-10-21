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
