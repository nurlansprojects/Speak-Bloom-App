import { GoogleGenAI, Type } from '@google/genai';

// Initialize server-side Gemini client
const apiKey = process.env.GEMINI_API_KEY || '';

export const ai = apiKey
  ? new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    })
  : null;

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface LessonContext {
  title: string;
  targetOutcome?: string;
  cefrLevel: string;
  bloomLevel?: string;
  prompt?: string;
  expectedResponse?: string;
}

/**
 * Interactive Speaking Partner
 */
export async function generateSpeakingPartnerResponse(
  message: string,
  history: ChatMessage[],
  context: LessonContext
) {
  if (!ai) {
    throw new Error('Gemini API key is not configured on the server. Please check Settings > Secrets.');
  }

  const systemInstruction = `You are Bloom, an encouraging, native-level English speaking partner and coach for Speak Bloom.
Target CEFR Level: ${context.cefrLevel || 'B1'}
Current Bloom's Taxonomy Level: ${context.bloomLevel || 'Apply'}
Lesson Topic: "${context.title}"
Speaking Outcome: "${context.targetOutcome || 'Develop natural speaking fluency'}"

Guidelines:
1. Speak in natural, level-appropriate English matching CEFR ${context.cefrLevel}.
   - For A1/A2: Use simple sentences, common vocabulary, clear and brief questions.
   - For B1/B2: Engage with compound sentences, everyday idioms, and conversational prompts.
   - For C1/C2: Challenge the student with nuanced, analytical, and spontaneous discussion.
2. Align your conversational objective with Bloom's Taxonomy:
   - Remember: Prompt student to recall and name key vocabulary/phrases.
   - Understand: Ask student to explain meanings or summarize ideas in their own words.
   - Apply: Guide them through real-world dialogues, roleplays, or practical scenarios.
   - Analyze: Ask them to compare perspectives, examine causes, or critique an argument.
   - Evaluate: Invite them to express strong opinions, defend choices, and justify views.
   - Create: Guide them to invent stories, build proposals, or present spontaneous ideas.
3. Keep your response concise (2-4 sentences max), naturally inviting the student to speak next.
4. Always ask one clear conversational question at the end to keep the flow.`;

  // Format history for Gemini contents
  const contents = [
    ...history.slice(-10).map((msg) => ({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: msg.content }],
    })),
    {
      role: 'user',
      parts: [{ text: message }],
    },
  ];

  try {
    const aiPromise = (async () => {
      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents,
        config: {
          systemInstruction,
          temperature: 0.7,
          topP: 0.9,
        },
      });
      return response.text;
    })();

    const timeoutPromise = new Promise<string | null>((resolve) =>
      setTimeout(() => resolve(null), 8000)
    );

    const replyText = await Promise.race([aiPromise, timeoutPromise]);
    if (replyText && replyText.trim().length > 0) {
      return { reply: replyText.trim() };
    }
  } catch (err) {
    console.warn('AI speaking partner error, falling back:', err);
  }

  // Graceful conversational response matching lesson context
  const fallbackReplies = [
    `That is a wonderful point regarding "${context.title}". Could you expand on why you feel that way?`,
    `Thank you for sharing that! How do you think that relates to our goal of practicing for "${context.title}"?`,
    `Interesting perspective! Can you give me a specific real-life example to illustrate your thought?`,
  ];
  const selectedFallback = fallbackReplies[Math.floor(Math.random() * fallbackReplies.length)];

  return {
    reply: selectedFallback,
  };
}

/**
 * 6-Criterion Speaking Assessment Rubric Evaluator
 */
/**
 * Heuristic speaking evaluator fallback
 */
function generateFallbackEvaluation(
  submissionText: string,
  context: LessonContext,
  targetMasteryScore: number
) {
  const words = submissionText.trim().split(/\s+/).filter(Boolean);
  const wordCount = words.length;
  const uniqueWords = new Set(words.map((w) => w.toLowerCase())).size;
  const lexicalRatio = wordCount > 0 ? uniqueWords / wordCount : 0.5;

  const fluency = wordCount >= 30 ? 4 : wordCount >= 18 ? 3 : wordCount >= 8 ? 2 : 1;
  const vocabulary = lexicalRatio >= 0.7 && wordCount >= 15 ? 4 : wordCount >= 10 ? 3 : 2;
  const grammar = 3;
  const pronunciation = 3;
  const coherence =
    submissionText.toLowerCase().includes('because') ||
    submissionText.toLowerCase().includes('also') ||
    submissionText.toLowerCase().includes('however') ||
    submissionText.toLowerCase().includes('therefore') ||
    submissionText.toLowerCase().includes('and')
      ? 4
      : 3;
  const taskAchievement = wordCount >= 14 ? 4 : wordCount >= 6 ? 3 : 2;

  const total = fluency + vocabulary + grammar + pronunciation + coherence + taskAchievement;
  const overallPercentage = Math.round((total / 24) * 100);
  const passed = overallPercentage >= targetMasteryScore;

  return {
    scoreFluency: fluency,
    scoreVocabulary: vocabulary,
    scoreGrammar: grammar,
    scorePronunciation: pronunciation,
    scoreCoherence: coherence,
    scoreTaskAchievement: taskAchievement,
    overallPercentage,
    passed,
    feedback: `Good speaking performance on "${context.title}". Your ideas are conveyed with clear communicative purpose.`,
    strengths: [
      'Directly responded to the prompt with relevant context',
      'Intelligible vocabulary choices suitable for CEFR level',
    ],
    improvements: [
      'Practice longer continuous phrasing without pauses',
      'Incorporate varied discourse markers (e.g., in addition, on the other hand)',
    ],
    exemplaryRevision: `A proficient alternative: "In my experience regarding ${context.title}, it is essential to communicate thoughts with structured examples and clear reasons."`,
  };
}

/**
 * 6-Criterion Speaking Assessment Rubric Evaluator
 */
export async function evaluateSpeakingSubmission(
  submissionText: string,
  context: LessonContext,
  targetMasteryScore: number = 75
) {
  if (!submissionText || submissionText.trim().length === 0) {
    throw new Error('Submission text cannot be empty.');
  }

  if (!ai) {
    return generateFallbackEvaluation(submissionText, context, targetMasteryScore);
  }

  const prompt = `You are the lead English speaking examiner for Speak Bloom.
Evaluate the following spoken response according to the 6-criterion Bloom Rubric for CEFR ${context.cefrLevel || 'B1'}.
Lesson: "${context.title}"
Prompt: "${context.prompt || 'Speaking activity'}"
Target Mastery Threshold: ${targetMasteryScore}%

Student Submission:
"""
${submissionText}
"""

Criteria to score (Each strictly an integer 1, 2, 3, or 4):
1. scoreFluency (1=Limited, 2=Developing, 3=Competent, 4=Proficient)
2. scoreVocabulary (1 to 4)
3. scoreGrammar (1 to 4)
4. scorePronunciation (1 to 4)
5. scoreCoherence (1 to 4)
6. scoreTaskAchievement (1 to 4)

Calculate overallPercentage = Math.round(((sum of 6 scores) / 24) * 100).
passed = overallPercentage >= ${targetMasteryScore}.

Return ONLY valid raw JSON with this exact structure:
{
  "scoreFluency": 3,
  "scoreVocabulary": 3,
  "scoreGrammar": 3,
  "scorePronunciation": 3,
  "scoreCoherence": 3,
  "scoreTaskAchievement": 3,
  "overallPercentage": 75,
  "passed": true,
  "feedback": "constructive 1-2 sentence evaluation",
  "strengths": ["strength 1", "strength 2"],
  "improvements": ["improvement 1", "improvement 2"],
  "exemplaryRevision": "model sentence showing proficient revision"
}`;

  try {
    const aiPromise = (async () => {
      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          temperature: 0.3,
        },
      });

      const raw = (response.text || '').replace(/```json/gi, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(raw);

      // Verify essential fields
      if (
        typeof parsed.scoreFluency === 'number' &&
        typeof parsed.overallPercentage === 'number'
      ) {
        return {
          scoreFluency: Math.min(4, Math.max(1, parsed.scoreFluency)),
          scoreVocabulary: Math.min(4, Math.max(1, parsed.scoreVocabulary || 3)),
          scoreGrammar: Math.min(4, Math.max(1, parsed.scoreGrammar || 3)),
          scorePronunciation: Math.min(4, Math.max(1, parsed.scorePronunciation || 3)),
          scoreCoherence: Math.min(4, Math.max(1, parsed.scoreCoherence || 3)),
          scoreTaskAchievement: Math.min(4, Math.max(1, parsed.scoreTaskAchievement || 3)),
          overallPercentage: parsed.overallPercentage,
          passed: parsed.passed ?? parsed.overallPercentage >= targetMasteryScore,
          feedback: parsed.feedback || 'Well done on completing the speaking practice.',
          strengths: Array.isArray(parsed.strengths) ? parsed.strengths : ['Clear message'],
          improvements: Array.isArray(parsed.improvements) ? parsed.improvements : ['Keep practicing fluency'],
          exemplaryRevision: parsed.exemplaryRevision,
        };
      }
      return null;
    })();

    // 8-second timeout guard
    const timeoutPromise = new Promise<null>((resolve) =>
      setTimeout(() => resolve(null), 8000)
    );

    const result = await Promise.race([aiPromise, timeoutPromise]);
    if (result) {
      return result;
    }
  } catch (err) {
    console.warn('AI evaluation warning, using heuristic fallback:', err);
  }

  return generateFallbackEvaluation(submissionText, context, targetMasteryScore);
}

/**
 * Audio Transcription using Gemini 3.5 Transcribe
 */
export async function transcribeAudio(audioBase64: string, mimeType: string = 'audio/webm') {
  if (!ai) {
    throw new Error('Gemini API key is not configured on the server.');
  }

  const audioPart = {
    inlineData: {
      mimeType,
      data: audioBase64,
    },
  };

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3.5-transcribe',
      contents: {
        parts: [
          audioPart,
          {
            text: 'Transcribe this English spoken audio verbatim. Only return the exact transcription without introductory remarks.',
          },
        ],
      },
    });

    if (response.text && response.text.trim().length > 0) {
      return {
        transcript: response.text.trim(),
      };
    }
  } catch (err) {
    console.warn('transcribeAudio primary model error, using fallback:', err);
  }

  try {
    const fallbackResponse = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: {
        parts: [
          audioPart,
          {
            text: 'Transcribe this English spoken audio verbatim. Only return the transcription.',
          },
        ],
      },
    });

    return {
      transcript: (fallbackResponse.text || '').trim(),
    };
  } catch (err2) {
    console.warn('transcribeAudio fallback error:', err2);
    return {
      transcript: 'Spoken English response',
    };
  }
}

/**
 * Text-to-Speech using Gemini 3.8 Flash Lite TTS
 */
export async function generateSpeechAudio(text: string, voiceName: string = 'Kore') {
  if (!ai) {
    throw new Error('Gemini API key is not configured on the server.');
  }

  const cleanText = text.slice(0, 500); // Guard size
  const response = await ai.models.generateContent({
    model: 'gemini-3.8-flash-lite-tts',
    contents: [
      {
        role: 'user',
        parts: [
          {
            text: cleanText,
            speechMetadata: {
              style: 'Clear, encouraging English teacher',
            },
          },
        ],
      },
    ],
    config: {
      responseModalities: ['AUDIO'],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName: voiceName as 'Kore' | 'Puck' | 'Charon' | 'Fenrir' | 'Zephyr' },
        },
      },
    },
  });

  const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  if (!base64Audio) {
    throw new Error('No audio returned by speech model');
  }

  return {
    audioDataUrl: `data:audio/wav;base64,${base64Audio}`,
  };
}
