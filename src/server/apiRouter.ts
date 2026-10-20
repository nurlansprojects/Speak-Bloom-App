import express from 'express';
import {
  generateSpeakingPartnerResponse,
  evaluateSpeakingSubmission,
  transcribeAudio,
  generateSpeechAudio,
} from './gemini';

const router = express.Router();

// Allow audio payloads up to 50MB
router.use(express.json({ limit: '50mb' }));
router.use(express.urlencoded({ extended: true, limit: '50mb' }));

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
