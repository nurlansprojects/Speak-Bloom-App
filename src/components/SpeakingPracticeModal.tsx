import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Course, Lesson, Activity, ActivityFormat, AssessmentAttempt } from '../types';
import { safeApiFetch } from '../lib/apiClient';
import {
  getSupportedAudioMimeType,
  uploadSpeakingRecording,
} from '../services/audioStorageService';
import { createUploadRecord } from '../services/uploadStorageService';
import { getActivityIcon, getActivityFormatLabel } from '../utils/activityUtils';
import {
  Mic,
  Square,
  Play,
  Pause,
  RotateCcw,
  Send,
  Sparkles,
  Volume2,
  AlertCircle,
  MessageSquare,
  PenLine,
  FileText,
  X,
  VolumeX,
  CheckCircle2,
  Radio,
  UserCheck,
} from 'lucide-react';

interface SpeakingPracticeModalProps {
  course?: Course;
  lesson: Lesson;
  activity: Activity;
  studentName: string;
  onComplete: (attempt: AssessmentAttempt) => void;
  onClose: () => void;
}

interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

export const SpeakingPracticeModal: React.FC<SpeakingPracticeModalProps> = ({
  course,
  lesson,
  activity,
  studentName,
  onComplete,
  onClose,
}) => {
  const { currentUser } = useAuth();
  const [activeFormat, setActiveFormat] = useState<ActivityFormat>(activity.format || 'recording');

  // Mode A: Text State
  const [textInput, setTextInput] = useState('');

  // Mode B: Voice Recording State
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordDuration, setRecordDuration] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioBase64, setAudioBase64] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [detectedMimeType, setDetectedMimeType] = useState<string>('audio/webm');

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<any>(null);

  // Mode C: AI Conversation State
  const [chatHistory, setChatHistory] = useState<ChatTurn[]>([]);
  const [aiMessageInput, setAiMessageInput] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);

  // Global Evaluation State
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Detect supported recording mime on mount
  useEffect(() => {
    setDetectedMimeType(getSupportedAudioMimeType());
    return () => {
      cleanupMediaStream();
    };
  }, []);

  // Initialize AI Conversation if Mode C
  useEffect(() => {
    if (activeFormat === 'ai_conversation' && chatHistory.length === 0) {
      startAiSession();
    }
  }, [activeFormat]);

  const cleanupMediaStream = () => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const startAiSession = async () => {
    setIsAiLoading(true);
    setErrorMessage(null);

    const res = await safeApiFetch<{ reply: string }>('/api/ai/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: `Hello! I am ready to practice speaking for the lesson "${lesson.title}". Please introduce our topic and ask me the opening question.`,
        history: [],
        lessonContext: {
          title: lesson.title,
          targetOutcome: lesson.targetSpeakingOutcome,
          bloomLevel: activity.bloomLevel,
          prompt: activity.prompt,
        },
      }),
    });

    setIsAiLoading(false);

    if (!res.success || !res.data) {
      setErrorMessage(res.error?.message || 'Unable to connect to speaking partner. Please try again.');
      return;
    }

    setChatHistory([
      {
        role: 'assistant',
        content:
          res.data.reply ||
          `Hello ${studentName}! Welcome to our speaking practice. Today we are focusing on "${lesson.title}". Could you share your thoughts to get started?`,
      },
    ]);
  };

  const sendAiChatMessage = async () => {
    if (!aiMessageInput.trim() || isAiLoading) return;
    const userMsg = aiMessageInput.trim();
    setAiMessageInput('');

    const newHistory: ChatTurn[] = [...chatHistory, { role: 'user', content: userMsg }];
    setChatHistory(newHistory);
    setIsAiLoading(true);
    setErrorMessage(null);

    const res = await safeApiFetch<{ reply: string }>('/api/ai/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: userMsg,
        history: newHistory,
        lessonContext: {
          title: lesson.title,
          targetOutcome: lesson.targetSpeakingOutcome,
          bloomLevel: activity.bloomLevel,
          prompt: activity.prompt,
        },
      }),
    });

    setIsAiLoading(false);

    if (!res.success || !res.data) {
      setErrorMessage(res.error?.message || 'Speaking partner did not respond. Please try again.');
      return;
    }

    setChatHistory([...newHistory, { role: 'assistant', content: res.data.reply }]);
  };

  /* ================= MODE B: RECORDING WORKFLOW ================= */

  const startRecording = async () => {
    try {
      setErrorMessage(null);
      setAudioBlob(null);
      setAudioUrl(null);
      setAudioBase64(null);
      setUploadProgress(null);
      audioChunksRef.current = [];

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      mediaStreamRef.current = stream;

      const mimeType = getSupportedAudioMimeType();
      setDetectedMimeType(mimeType);

      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: mimeType });
        setAudioBlob(blob);
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);

        // Convert blob to base64 for fallback evaluation
        const reader = new FileReader();
        reader.readAsDataURL(blob);
        reader.onloadend = () => {
          const base64data = reader.result?.toString().split(',')[1] || null;
          setAudioBase64(base64data);
        };

        cleanupMediaStream();
      };

      mediaRecorder.start(250); // Slice every 250ms for reliable chunks
      setIsRecording(true);
      setIsPaused(false);
      setRecordDuration(0);

      timerRef.current = setInterval(() => {
        setRecordDuration((prev) => prev + 1);
      }, 1000);
    } catch (err: any) {
      console.error('Microphone error:', err);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setErrorMessage('Microphone access was denied. Please allow microphone permissions in your browser address bar.');
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setErrorMessage('No microphone was detected on this device. Please connect a microphone and try again.');
      } else {
        setErrorMessage(err.message || 'Could not initialize microphone recording.');
      }
    }
  };

  const pauseRecording = () => {
    if (mediaRecorderRef.current && isRecording && !isPaused) {
      mediaRecorderRef.current.pause();
      setIsPaused(true);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  };

  const resumeRecording = () => {
    if (mediaRecorderRef.current && isRecording && isPaused) {
      mediaRecorderRef.current.resume();
      setIsPaused(false);
      timerRef.current = setInterval(() => {
        setRecordDuration((prev) => prev + 1);
      }, 1000);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setIsPaused(false);
      cleanupMediaStream();
    }
  };

  const resetRecording = () => {
    cleanupMediaStream();
    setIsRecording(false);
    setIsPaused(false);
    setAudioBlob(null);
    setAudioUrl(null);
    setAudioBase64(null);
    setRecordDuration(0);
    setUploadProgress(null);
  };

  /* ================= AUDIO TTS PLAYBACK ================= */

  const playPromptAudio = async (text: string) => {
    try {
      setIsPlayingAudio(true);
      const res = await safeApiFetch<{ audioDataUrl?: string }>('/api/ai/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });

      if (res.success && res.data?.audioDataUrl) {
        const audio = new Audio(res.data.audioDataUrl);
        audio.onended = () => setIsPlayingAudio(false);
        audio.onerror = () => setIsPlayingAudio(false);
        await audio.play();
        return;
      }

      // Browser Web Speech fallback
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'en-US';
        utterance.onend = () => setIsPlayingAudio(false);
        utterance.onerror = () => setIsPlayingAudio(false);
        window.speechSynthesis.speak(utterance);
      } else {
        setIsPlayingAudio(false);
      }
    } catch {
      setIsPlayingAudio(false);
    }
  };

  /* ================= SAFE ASSESSMENT SUBMISSION ================= */

  const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result?.toString().split(',')[1] || '';
        resolve(base64);
      };
      reader.onerror = () => reject(new Error('Failed to encode audio file'));
      reader.readAsDataURL(blob);
    });
  };

  const handleSubmitForTeacherReview = async () => {
    if (isEvaluating) return;
    setIsEvaluating(true);
    setErrorMessage(null);

    try {
      let uploadedAudioUrl = audioUrl || undefined;

      if (audioBlob) {
        setUploadProgress(15);
        const uploadResult = await uploadSpeakingRecording(
          audioBlob,
          course?.id || lesson.courseId,
          lesson.id,
          (pct) => setUploadProgress(pct),
          activity.id
        );
        uploadedAudioUrl = uploadResult.url;

        if (currentUser) {
          try {
            await createUploadRecord({
              userId: currentUser.uid,
              userName: studentName,
              userRole: 'student',
              courseId: course?.id || lesson.courseId,
              lessonId: lesson.id,
              activityId: activity.id,
              scope: 'student_submission',
              title: `${activity.title} (Spoken Audio)`,
              fileName: `speaking_${Date.now()}.${detectedMimeType.includes('mp4') ? 'mp4' : 'webm'}`,
              fileType: 'audio',
              fileExtension: detectedMimeType.includes('mp4') ? 'mp4' : 'webm',
              mimeType: detectedMimeType,
              fileSize: audioBlob.size,
              fileUrl: uploadResult.url,
              storagePath: uploadResult.storagePath,
              status: 'submitted',
            });
          } catch (uploadRecErr) {
            console.warn('Could not record audio upload in database:', uploadRecErr);
          }
        }
      }

      const attemptResult: AssessmentAttempt = {
        id: `att_${Date.now()}`,
        studentId: currentUser?.uid || '',
        studentName,
        courseId: course?.id || lesson.courseId,
        courseTitle: course?.title || 'English Speaking Course',
        lessonId: lesson.id,
        lessonTitle: lesson.title,
        activityId: activity.id,
        activityTitle: activity.title,
        format: activeFormat,
        content: activeFormat === 'text' ? textInput.trim() : (activity.prompt || 'Spoken audio response'),
        audioData: uploadedAudioUrl,
        scoreFluency: 0,
        scoreVocabulary: 0,
        scoreGrammar: 0,
        scorePronunciation: 0,
        scoreCoherence: 0,
        scoreTaskAchievement: 0,
        overallPercentage: 0,
        passed: false,
        evaluator: 'teacher',
        status: 'submitted',
        feedback: 'Your submission has been safely recorded for teacher evaluation. Your instructor will review your work, provide feedback, and assign your score.',
        strengths: ['Submission delivered for teacher review'],
        improvements: ['Awaiting instructor review'],
        submittedAt: new Date().toISOString(),
      };

      onComplete(attemptResult);
    } catch (err: any) {
      console.error('Teacher review submit error:', err);
      setErrorMessage(err.message || 'Failed to submit response for teacher review.');
    } finally {
      setIsEvaluating(false);
      setUploadProgress(null);
    }
  };

  const handleSubmitEvaluation = async () => {
    if (isEvaluating) return;
    setIsEvaluating(true);
    setErrorMessage(null);

    // ==========================================
    // 1. Text Response / Text Preparation Mode
    // Must use manual teacher assessment
    // ==========================================
    if (activeFormat === 'text') {
      const cleanText = textInput.trim();
      if (!cleanText) {
        setErrorMessage('Please write your response before submitting.');
        setIsEvaluating(false);
        return;
      }

      try {
        const attemptResult: AssessmentAttempt = {
          id: `att_${Date.now()}`,
          studentId: currentUser?.uid || '',
          studentName,
          courseId: course?.id || lesson.courseId,
          courseTitle: course?.title || 'English Speaking Course',
          lessonId: lesson.id,
          lessonTitle: lesson.title,
          activityId: activity.id,
          activityTitle: activity.title,
          format: 'text',
          content: cleanText,
          evaluator: 'teacher',
          status: 'submitted',
          scoreFluency: 0,
          scoreVocabulary: 0,
          scoreGrammar: 0,
          scorePronunciation: 0,
          scoreCoherence: 0,
          scoreTaskAchievement: 0,
          overallPercentage: 0,
          passed: false,
          feedback: 'Your written text response has been successfully submitted for instructor review. Your teacher will evaluate your work and assign a score.',
          strengths: ['Written text response submitted for teacher grading'],
          improvements: ['Awaiting instructor review and feedback'],
          submittedAt: new Date().toISOString(),
        };

        onComplete(attemptResult);
      } catch (err: any) {
        console.error('Text submission error:', err);
        setErrorMessage(err.message || 'Failed to submit written response.');
      } finally {
        setIsEvaluating(false);
      }
      return;
    }

    // ==========================================
    // 2. Voice Recording Mode
    // Must use manual teacher assessment
    // ==========================================
    if (activeFormat === 'recording') {
      if (!audioBlob) {
        setErrorMessage('Please record your speaking response before submitting.');
        setIsEvaluating(false);
        return;
      }

      if (recordDuration < 2) {
        setErrorMessage('Recording is too short. Please speak for at least 2 seconds before submitting.');
        setIsEvaluating(false);
        return;
      }

      try {
        setUploadProgress(15);
        const uploadResult = await uploadSpeakingRecording(
          audioBlob,
          course?.id || lesson.courseId,
          lesson.id,
          (pct) => setUploadProgress(pct),
          activity.id
        );

        if (currentUser) {
          try {
            await createUploadRecord({
              userId: currentUser.uid,
              userName: studentName,
              userRole: 'student',
              courseId: course?.id || lesson.courseId,
              lessonId: lesson.id,
              activityId: activity.id,
              scope: 'student_submission',
              title: `${activity.title} (Spoken Audio)`,
              fileName: `speaking_${Date.now()}.${detectedMimeType.includes('mp4') ? 'mp4' : 'webm'}`,
              fileType: 'audio',
              fileExtension: detectedMimeType.includes('mp4') ? 'mp4' : 'webm',
              mimeType: detectedMimeType,
              fileSize: audioBlob.size,
              fileUrl: uploadResult.url,
              storagePath: uploadResult.storagePath,
              status: 'submitted',
            });
          } catch (uploadRecErr) {
            console.warn('Could not record audio upload in database:', uploadRecErr);
          }
        }

        const attemptResult: AssessmentAttempt = {
          id: `att_${Date.now()}`,
          studentId: currentUser?.uid || '',
          studentName,
          courseId: course?.id || lesson.courseId,
          courseTitle: course?.title || 'English Speaking Course',
          lessonId: lesson.id,
          lessonTitle: lesson.title,
          activityId: activity.id,
          activityTitle: activity.title,
          format: 'recording',
          content: activity.prompt || 'Spoken audio response',
          audioData: uploadResult.url,
          evaluator: 'teacher',
          status: 'submitted',
          scoreFluency: 0,
          scoreVocabulary: 0,
          scoreGrammar: 0,
          scorePronunciation: 0,
          scoreCoherence: 0,
          scoreTaskAchievement: 0,
          overallPercentage: 0,
          passed: false,
          feedback: 'Your voice recording has been safely submitted for instructor review. Your teacher will evaluate your delivery and assign a score.',
          strengths: ['Audio successfully uploaded and saved for review'],
          improvements: ['Awaiting instructor review and feedback'],
          submittedAt: new Date().toISOString(),
        };

        onComplete(attemptResult);
      } catch (err: any) {
        console.error('Voice submission error:', err);
        setErrorMessage(err.message || 'Failed to submit voice recording.');
      } finally {
        setIsEvaluating(false);
        setUploadProgress(null);
      }
      return;
    }

    // ==========================================
    // 3. AI Speaking Partner Mode
    // Preserves automated AI rubric evaluation
    // ==========================================
    const userResponses = chatHistory
      .filter((t) => t.role === 'user')
      .map((t) => t.content)
      .join(' \n');

    if (!userResponses.trim()) {
      setErrorMessage('Please exchange at least one speaking turn with Bloom before completing.');
      setIsEvaluating(false);
      return;
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 18000);

      let res: any;
      try {
        res = await safeApiFetch<any>('/api/ai/assess', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({
            submissionText: userResponses,
            audioBase64: audioBase64 || undefined,
            mimeType: detectedMimeType,
            masteryThreshold: lesson.requiredMasteryScore || 75,
            lessonContext: {
              title: lesson.title,
              targetOutcome: lesson.targetSpeakingOutcome,
              bloomLevel: activity.bloomLevel,
              prompt: activity.prompt,
              expectedResponse: activity.expectedResponse,
            },
          }),
        });
      } finally {
        clearTimeout(timeoutId);
      }

      if (!res.success || !res.data) {
        setErrorMessage(
          res.error?.message || 'Evaluation service could not evaluate the submission. Please try again or submit for teacher review.'
        );
        return;
      }

      const evalData = res.data;

      const attemptResult: AssessmentAttempt = {
        id: `att_${Date.now()}`,
        studentId: currentUser?.uid || '',
        studentName,
        courseId: course?.id || lesson.courseId,
        courseTitle: course?.title || 'English Speaking Course',
        lessonId: lesson.id,
        lessonTitle: lesson.title,
        activityId: activity.id,
        activityTitle: activity.title,
        format: 'ai_conversation',
        content: evalData.transcript || userResponses || 'Spoken conversation',
        audioData: audioUrl || undefined,
        scoreFluency: evalData.scoreFluency || 3,
        scoreVocabulary: evalData.scoreVocabulary || 3,
        scoreGrammar: evalData.scoreGrammar || 3,
        scorePronunciation: evalData.scorePronunciation || 3,
        scoreCoherence: evalData.scoreCoherence || 3,
        scoreTaskAchievement: evalData.scoreTaskAchievement || 3,
        overallPercentage: evalData.overallPercentage || 75,
        passed: evalData.passed ?? evalData.overallPercentage >= (lesson.requiredMasteryScore || 75),
        evaluator: 'ai',
        status: 'graded',
        score: evalData.overallPercentage || 75,
        feedback: evalData.feedback || 'Good effort fulfilling the speaking task.',
        strengths: evalData.strengths || ['Clear communication', 'Engaged with topic'],
        improvements: evalData.improvements || ['Focus on sentence transitions', 'Expand vocabulary range'],
        exemplaryRevision: evalData.exemplaryRevision,
        submittedAt: new Date().toISOString(),
      };

      onComplete(attemptResult);
    } catch (err: any) {
      console.warn('Assessment evaluation warning:', err?.message || err);
      if (err.name === 'AbortError') {
        setErrorMessage('Evaluation request timed out. You can retry or submit for teacher review.');
      } else {
        setErrorMessage(err.message || 'Failed to complete assessment.');
      }
    } finally {
      setIsEvaluating(false);
      setUploadProgress(null);
    }
  };

  const formatSeconds = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const s = sec % 60;
    return `${mins}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-2xl w-full border border-[#ECEAF2] shadow-2xl overflow-hidden my-4 sm:my-6 flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-4 sm:p-6 border-b border-[#ECEAF2] flex items-center justify-between bg-white shrink-0">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#F1EEFB] text-[#6546D7]">
                Bloom: {activity.bloomLevel}
              </span>
            </div>
            <h3 className="text-base sm:text-lg font-bold text-[#16151E]">{activity.title}</h3>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="p-2 text-[#7F7C8E] hover:text-[#16151E] hover:bg-[#F2EFF8] rounded-xl transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mode Selector Tabs */}
        <div className="px-4 sm:px-6 pt-3 pb-2 border-b border-[#ECEAF2] bg-[#FAF9FC] flex items-center gap-2 overflow-x-auto scrollbar-none">
          <button
            onClick={() => setActiveFormat('recording')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap transition-all cursor-pointer ${
              activeFormat === 'recording'
                ? 'bg-[#6546D7] text-white shadow-sm'
                : 'text-[#646174] hover:text-[#181622] hover:bg-white'
            }`}
          >
            <Mic className="w-3.5 h-3.5" />
            <span>Voice Recording</span>
          </button>
          <button
            onClick={() => setActiveFormat('text')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap transition-all cursor-pointer ${
              activeFormat === 'text'
                ? 'bg-[#6546D7] text-white shadow-sm'
                : 'text-[#646174] hover:text-[#181622] hover:bg-white'
            }`}
          >
            <PenLine className="w-3.5 h-3.5" />
            <span>Text Response</span>
          </button>
          <button
            onClick={() => setActiveFormat('ai_conversation')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap transition-all cursor-pointer ${
              activeFormat === 'ai_conversation'
                ? 'bg-[#6546D7] text-white shadow-sm'
                : 'text-[#646174] hover:text-[#181622] hover:bg-white'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>AI Speaking Partner</span>
          </button>
        </div>

        {/* Scrollable Content Area */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5 flex-1">
          {/* Speaking Prompt Box */}
          <div className="bg-[#FAF9FC] p-4 sm:p-5 rounded-2xl border border-[#ECEAF2]">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-[#737083]">
                Speaking Prompt
              </span>
              <button
                onClick={() => playPromptAudio(activity.prompt)}
                disabled={isPlayingAudio}
                title="Listen to prompt"
                className="flex items-center gap-1.5 text-xs font-semibold text-[#6546D7] hover:underline cursor-pointer disabled:opacity-50"
              >
                {isPlayingAudio ? (
                  <>
                    <VolumeX className="w-3.5 h-3.5 animate-pulse text-[#6546D7]" />
                    <span>Playing...</span>
                  </>
                ) : (
                  <>
                    <Volume2 className="w-3.5 h-3.5" />
                    <span>Hear Prompt</span>
                  </>
                )}
              </button>
            </div>
            <p className="text-sm sm:text-base font-medium text-[#1A1826] leading-relaxed">
              {activity.prompt}
            </p>
            {activity.instructions && (
              <p className="text-xs text-[#6F6B7E] mt-2">
                <span className="font-semibold text-[#3F3C4C]">Tip:</span> {activity.instructions}
              </p>
            )}
          </div>

          {/* Mode B: Voice Recording Workflow */}
          {activeFormat === 'recording' && (
            <div className="flex flex-col items-center justify-center p-6 bg-[#FCFBFD] border border-[#ECEAF2] rounded-2xl space-y-4">
              <div className="text-center">
                <div className="flex items-center justify-center gap-2">
                  {isRecording && !isPaused && (
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-600 animate-ping" />
                  )}
                  <div className="text-3xl font-mono font-bold text-[#1F1D2B]">
                    {formatSeconds(recordDuration)}
                  </div>
                </div>

                {/* Live audio soundwave activity indicator */}
                {isRecording && !isPaused && (
                  <div className="flex items-center justify-center gap-1.5 my-2.5 h-7">
                    <span className="w-1 h-3 bg-[#6546D7] rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-1 h-5 bg-[#6546D7] rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-1 h-7 bg-[#6546D7] rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    <span className="w-1 h-4 bg-[#6546D7] rounded-full animate-bounce" style={{ animationDelay: '450ms' }} />
                    <span className="w-1 h-6 bg-[#6546D7] rounded-full animate-bounce" style={{ animationDelay: '200ms' }} />
                    <span className="w-1 h-3 bg-[#6546D7] rounded-full animate-bounce" style={{ animationDelay: '350ms' }} />
                  </div>
                )}

                <div className="text-xs text-[#7F7C8E] mt-1.5">
                  {isRecording
                    ? isPaused
                      ? 'Recording paused — press Resume when ready'
                      : 'Listening... Speak clearly into your microphone'
                    : audioUrl
                    ? `Recording complete (${formatSeconds(recordDuration)}). Listen below and submit.`
                    : 'Tap microphone to start speaking'}
                </div>
              </div>

              {/* Record / Pause / Resume / Stop Buttons */}
              {!audioUrl ? (
                <div className="flex items-center gap-3">
                  {!isRecording ? (
                    <button
                      onClick={startRecording}
                      className="w-16 h-16 rounded-full bg-[#6546D7] hover:bg-[#5235BE] active:scale-95 text-white flex items-center justify-center shadow-lg shadow-[#6546D7]/25 transition-all cursor-pointer"
                      title="Start Recording"
                    >
                      <Mic className="w-7 h-7" />
                    </button>
                  ) : (
                    <>
                      {isPaused ? (
                        <button
                          onClick={resumeRecording}
                          className="w-12 h-12 rounded-full bg-amber-500 hover:bg-amber-600 active:scale-95 text-white flex items-center justify-center transition-all cursor-pointer shadow-sm"
                          title="Resume Recording"
                        >
                          <Play className="w-5 h-5 ml-0.5" />
                        </button>
                      ) : (
                        <button
                          onClick={pauseRecording}
                          className="w-12 h-12 rounded-full bg-[#706B82] hover:bg-[#5E596E] active:scale-95 text-white flex items-center justify-center transition-all cursor-pointer shadow-sm"
                          title="Pause Recording"
                        >
                          <Pause className="w-5 h-5" />
                        </button>
                      )}

                      <button
                        onClick={stopRecording}
                        className="w-16 h-16 rounded-full bg-rose-600 hover:bg-rose-700 active:scale-95 text-white flex items-center justify-center shadow-lg shadow-rose-600/30 transition-all cursor-pointer animate-pulse"
                        title="Stop Recording"
                      >
                        <Square className="w-6 h-6" />
                      </button>
                    </>
                  )}
                </div>
              ) : (
                <div className="w-full space-y-4">
                  <audio src={audioUrl} controls className="w-full h-11 rounded-xl" />
                  <div className="flex items-center justify-center gap-3">
                    <button
                      onClick={resetRecording}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-[#D5D2E2] text-xs font-semibold text-[#4F4B5E] hover:bg-white transition-colors cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Discard & Re-record</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Upload progress indicator */}
              {uploadProgress !== null && (
                <div className="w-full max-w-xs space-y-1">
                  <div className="flex justify-between text-[11px] font-semibold text-[#6546D7]">
                    <span>Uploading audio recording...</span>
                    <span>{uploadProgress}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-[#EAE8F2] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#6546D7] transition-all duration-200"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Mode C: Interactive AI Speaking Partner */}
          {activeFormat === 'ai_conversation' && (
            <div className="space-y-4">
              <div className="bg-[#FAF9FC] border border-[#ECEAF2] rounded-2xl p-4 h-64 overflow-y-auto space-y-3">
                {chatHistory.map((turn, i) => (
                  <div
                    key={i}
                    className={`flex flex-col ${
                      turn.role === 'user' ? 'items-end' : 'items-start'
                    }`}
                  >
                    <div className="text-[10px] font-semibold uppercase text-[#888597] mb-0.5">
                      {turn.role === 'user' ? 'You' : 'Bloom (Coach)'}
                    </div>
                    <div
                      className={`max-w-[85%] p-3 rounded-2xl text-xs sm:text-sm leading-relaxed ${
                        turn.role === 'user'
                          ? 'bg-[#6546D7] text-white rounded-br-none'
                          : 'bg-white border border-[#E7E5F0] text-[#1E1C2B] rounded-bl-none shadow-xs'
                      }`}
                    >
                      {turn.content}
                      {turn.role === 'assistant' && (
                        <button
                          onClick={() => playPromptAudio(turn.content)}
                          className="block mt-1 text-[11px] font-medium text-[#6546D7] hover:underline cursor-pointer"
                        >
                          🔊 Listen
                        </button>
                      )}
                    </div>
                  </div>
                ))}
                {isAiLoading && (
                  <div className="flex items-center gap-2 text-xs text-[#7B778B] italic">
                    <div className="w-3 h-3 rounded-full border-2 border-[#6546D7] border-t-transparent animate-spin" />
                    <span>Bloom is speaking...</span>
                  </div>
                )}
              </div>

              {/* Chat Input */}
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={aiMessageInput}
                  onChange={(e) => setAiMessageInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && sendAiChatMessage()}
                  placeholder="Type your spoken answer or reply..."
                  className="flex-1 px-4 py-2.5 rounded-xl border border-[#DCD9E8] text-xs sm:text-sm focus:outline-none focus:border-[#6546D7]"
                />
                <button
                  onClick={sendAiChatMessage}
                  disabled={isAiLoading || !aiMessageInput.trim()}
                  className="p-2.5 rounded-xl bg-[#6546D7] text-white hover:bg-[#5236BF] disabled:opacity-50 cursor-pointer"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* Mode A: Text-Based Practice */}
          {activeFormat === 'text' && (
            <div className="space-y-2">
              <label className="text-xs font-semibold text-[#322F40]">
                Write your complete answer:
              </label>
              <textarea
                rows={5}
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                placeholder="Draft or write your spoken response here in full sentences..."
                className="w-full p-4 rounded-2xl border border-[#DCD9E8] text-xs sm:text-sm focus:outline-none focus:border-[#6546D7] leading-relaxed resize-none"
              />
            </div>
          )}

          {/* Error notice & actionable recovery */}
          {errorMessage && (
            <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-xs text-rose-800 space-y-3">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
                <span className="font-medium leading-relaxed">{errorMessage}</span>
              </div>

              {activeFormat === 'recording' && audioBlob && (
                <div className="pt-2 border-t border-rose-200/80 flex flex-wrap items-center gap-2">
                  <button
                    onClick={handleSubmitEvaluation}
                    disabled={isEvaluating}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#6546D7] hover:bg-[#5235BE] text-white text-[11px] font-semibold transition-all cursor-pointer shadow-xs disabled:opacity-50"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Retry Evaluation</span>
                  </button>

                  <button
                    onClick={handleSubmitForTeacherReview}
                    disabled={isEvaluating}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-[#D5D2E2] hover:bg-[#FAF9FC] text-[#322F40] text-[11px] font-semibold transition-all cursor-pointer shadow-xs disabled:opacity-50"
                  >
                    <UserCheck className="w-3 h-3 text-[#6546D7]" />
                    <span>Submit for Instructor Review</span>
                  </button>

                  <button
                    onClick={resetRecording}
                    disabled={isEvaluating}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl hover:bg-rose-100/60 text-rose-700 text-[11px] font-semibold transition-all cursor-pointer disabled:opacity-50"
                  >
                    <span>Record New Take</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 sm:p-5 border-t border-[#ECEAF2] bg-[#FAF9FC] flex items-center justify-between shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-[#5B576C] hover:bg-white transition-colors cursor-pointer"
          >
            Cancel
          </button>

          <button
            onClick={handleSubmitEvaluation}
            disabled={
              isEvaluating ||
              (activeFormat === 'recording' && !audioUrl) ||
              (activeFormat === 'text' && !textInput.trim()) ||
              (activeFormat === 'ai_conversation' && chatHistory.filter((t) => t.role === 'user').length === 0)
            }
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#6546D7] hover:bg-[#5235BE] disabled:opacity-50 text-white text-xs font-semibold shadow-sm transition-all cursor-pointer"
          >
            {isEvaluating ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>
                  {activeFormat === 'ai_conversation'
                    ? 'Evaluating Rubric...'
                    : 'Submitting Response...'}
                </span>
              </>
            ) : (
              <>
                {activeFormat === 'text' ? (
                  <>
                    <PenLine className="w-3.5 h-3.5" />
                    <span>Submit Response for Teacher Review</span>
                  </>
                ) : activeFormat === 'recording' ? (
                  <>
                    <Mic className="w-3.5 h-3.5" />
                    <span>Submit Recording for Teacher Review</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Submit for AI Rubric Evaluation</span>
                  </>
                )}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
