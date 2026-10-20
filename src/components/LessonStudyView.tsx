import React, { useState, useEffect, useRef } from 'react';
import { Lesson, Activity, Course, LessonProgress, AssessmentAttempt } from '../types';
import { getActivities } from '../services/courseService';
import { safeApiFetch } from '../lib/apiClient';
import {
  Volume2,
  Mic,
  ArrowLeft,
  CheckCircle2,
  Lock,
  Sparkles,
  BookOpen,
  Award,
  Square,
  VolumeX,
} from 'lucide-react';

interface LessonStudyViewProps {
  course: Course;
  lesson: Lesson;
  progress?: LessonProgress;
  onBack: () => void;
  onStartActivity: (activity: Activity) => void;
  onViewAttemptResult?: (attempt: AssessmentAttempt) => void;
}

export const LessonStudyView: React.FC<LessonStudyViewProps> = ({
  course,
  lesson,
  progress,
  onBack,
  onStartActivity,
}) => {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [playingKey, setPlayingKey] = useState<string | null>(null);
  const [currentSpeakingSegment, setCurrentSpeakingSegment] = useState<string | null>(null);

  const activeAudioRef = useRef<HTMLAudioElement | null>(null);
  const isCancelledRef = useRef<boolean>(false);

  useEffect(() => {
    loadActivities();
    return () => {
      stopAllAudio();
    };
  }, [lesson.id]);

  const loadActivities = async () => {
    setLoading(true);
    try {
      const acts = await getActivities(course.id, lesson.id);
      setActivities(acts);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const stopAllAudio = () => {
    isCancelledRef.current = true;
    if (activeAudioRef.current) {
      activeAudioRef.current.pause();
      activeAudioRef.current = null;
    }
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setPlayingKey(null);
    setCurrentSpeakingSegment(null);
  };

  // Helper to speak a single string using Web Speech API with voice selection
  const speakWithSynthesis = (text: string): Promise<void> => {
    return new Promise((resolve) => {
      if (!('speechSynthesis' in window)) {
        resolve();
        return;
      }

      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'en-US';
      utterance.rate = 0.95;

      const voices = window.speechSynthesis.getVoices();
      const englishVoice =
        voices.find((v) => v.lang.startsWith('en') && (v.name.includes('Natural') || v.name.includes('Google'))) ||
        voices.find((v) => v.lang.startsWith('en'));
      if (englishVoice) {
        utterance.voice = englishVoice;
      }

      utterance.onend = () => resolve();
      utterance.onerror = () => resolve();

      window.speechSynthesis.speak(utterance);
    });
  };

  /**
   * Pronounce All: Reads the actual visible lesson content in logical order:
   * 1. Target speaking outcome
   * 2. Learning guide & explanation
   * 3. Vocabulary and key phrases
   * 4. Model sample answer
   * 5. Practice activities prompts
   */
  const handlePronounceAll = async () => {
    if (playingKey === 'all') {
      stopAllAudio();
      return;
    }

    stopAllAudio();
    isCancelledRef.current = false;
    setPlayingKey('all');

    // Build the ordered sequence of visible lesson content
    const segments: { label: string; text: string }[] = [];

    if (lesson.targetSpeakingOutcome || lesson.description) {
      segments.push({
        label: 'Speaking Outcome',
        text: `Target speaking outcome: ${lesson.targetSpeakingOutcome || lesson.description}`,
      });
    }

    if (lesson.explanation && lesson.explanation.trim().length > 0) {
      segments.push({
        label: 'Learning Guide',
        text: `Learning guide: ${lesson.explanation}`,
      });
    }

    if (lesson.vocabularyNotes && lesson.vocabularyNotes.trim().length > 0) {
      segments.push({
        label: 'Essential Vocabulary',
        text: `Essential vocabulary and expressions: ${lesson.vocabularyNotes}`,
      });
    }

    if (lesson.sampleAnswer && lesson.sampleAnswer.trim().length > 0) {
      segments.push({
        label: 'Model Sample Answer',
        text: `Model sample answer: ${lesson.sampleAnswer}`,
      });
    }

    for (let i = 0; i < activities.length; i++) {
      const act = activities[i];
      segments.push({
        label: `Activity ${i + 1}: ${act.title}`,
        text: `Practice activity: ${act.title}. ${act.prompt}`,
      });
    }

    if (segments.length === 0) {
      setPlayingKey(null);
      return;
    }

    // Play segments sequentially
    for (const segment of segments) {
      if (isCancelledRef.current) break;
      setCurrentSpeakingSegment(segment.label);

      // Attempt server TTS first, with clean fallback to browser SpeechSynthesis
      let playedWithServer = false;
      try {
        const res = await safeApiFetch<{ audioDataUrl?: string }>('/api/ai/tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: segment.text }),
        });

        if (res.success && res.data?.audioDataUrl && !isCancelledRef.current) {
          const audio = new Audio(res.data.audioDataUrl);
          activeAudioRef.current = audio;
          await new Promise<void>((resolve) => {
            audio.onended = () => resolve();
            audio.onerror = () => resolve();
            audio.play().catch(() => resolve());
          });
          playedWithServer = true;
        }
      } catch {
        // Fallback to Web Speech
      }

      if (!playedWithServer && !isCancelledRef.current) {
        await speakWithSynthesis(segment.text);
      }
    }

    if (!isCancelledRef.current) {
      setPlayingKey(null);
      setCurrentSpeakingSegment(null);
    }
  };

  const playSingleSection = async (text: string, key: string) => {
    if (playingKey === key) {
      stopAllAudio();
      return;
    }

    stopAllAudio();
    isCancelledRef.current = false;
    setPlayingKey(key);

    try {
      const res = await safeApiFetch<{ audioDataUrl?: string }>('/api/ai/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });

      if (res.success && res.data?.audioDataUrl && !isCancelledRef.current) {
        const audio = new Audio(res.data.audioDataUrl);
        activeAudioRef.current = audio;
        audio.onended = () => setPlayingKey(null);
        audio.onerror = () => setPlayingKey(null);
        await audio.play();
        return;
      }
    } catch {
      // Fallback
    }

    if (!isCancelledRef.current) {
      await speakWithSynthesis(text);
      setPlayingKey(null);
    }
  };

  const isUnlocked = progress ? progress.isUnlocked : true;
  const isCompleted = progress ? progress.isCompleted : false;

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12 animate-in fade-in duration-200">
      {/* Back Button & Top Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <button
          onClick={() => {
            stopAllAudio();
            onBack();
          }}
          className="inline-flex items-center gap-2 text-xs font-semibold text-[#575367] hover:text-[#181622] transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to {course.title}</span>
        </button>

        {/* Status Pill & Master Pronounce All Button */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Main Pronounce All control */}
          <button
            onClick={handlePronounceAll}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold shadow-xs transition-all cursor-pointer ${
              playingKey === 'all'
                ? 'bg-rose-600 hover:bg-rose-700 text-white animate-pulse'
                : 'bg-[#6546D7] hover:bg-[#5235BE] text-white'
            }`}
          >
            {playingKey === 'all' ? (
              <>
                <Square className="w-3.5 h-3.5" />
                <span>Stop Audio</span>
              </>
            ) : (
              <>
                <Volume2 className="w-3.5 h-3.5" />
                <span>Pronounce All</span>
              </>
            )}
          </button>

          {isCompleted ? (
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>Mastered ({progress?.bestScore}%)</span>
            </div>
          ) : !isUnlocked ? (
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
              <Lock className="w-3.5 h-3.5" />
              <span>Prerequisites Required</span>
            </div>
          ) : (
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-[#F1EEFB] text-[#6546D7] border border-[#6546D7]/15">
              <Sparkles className="w-3.5 h-3.5" />
              <span>In Progress (Required: {lesson.requiredMasteryScore || 75}%)</span>
            </div>
          )}
        </div>
      </div>

      {/* Active Pronunciation Banner if speaking */}
      {playingKey === 'all' && currentSpeakingSegment && (
        <div className="p-3.5 rounded-2xl bg-[#F0EDFB] border border-[#6546D7]/30 text-xs text-[#5235BE] font-semibold flex items-center justify-between animate-pulse">
          <div className="flex items-center gap-2">
            <Volume2 className="w-4 h-4 text-[#6546D7]" />
            <span>Now Pronouncing: {currentSpeakingSegment}</span>
          </div>
          <button
            onClick={stopAllAudio}
            className="text-[11px] underline text-[#6546D7] hover:text-[#41279A]"
          >
            Stop
          </button>
        </div>
      )}

      {/* Lesson Header Card */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-[#ECEAF2] shadow-xs">
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <span className="text-xs font-bold uppercase tracking-wider px-2.5 py-1 rounded-lg bg-[#F1EEFB] text-[#6546D7]">
            CEFR {lesson.cefrLevel}
          </span>
          {lesson.bloomLevels?.map((lvl) => (
            <span
              key={lvl}
              className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-[#FAF9FC] border border-[#ECEAF2] text-[#474457]"
            >
              Bloom: {lvl}
            </span>
          ))}
        </div>

        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#16151E] mb-3">
          {lesson.title}
        </h1>

        <div className="p-4 rounded-2xl bg-[#F7F6FB] border border-[#ECEAF2]">
          <span className="text-xs font-bold uppercase tracking-wider text-[#6546D7] block mb-1">
            Target Speaking Outcome
          </span>
          <p className="text-sm font-medium text-[#252233] leading-relaxed">
            {lesson.targetSpeakingOutcome || lesson.description}
          </p>
        </div>
      </div>

      {/* Explanation & Conceptual Strategy */}
      {lesson.explanation && (
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-[#ECEAF2] shadow-xs space-y-3">
          <h3 className="text-base font-bold text-[#181624] flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-[#6546D7]" />
            <span>Learning Guide & Speaking Strategy</span>
          </h3>
          <p className="text-sm text-[#383548] leading-relaxed whitespace-pre-line">
            {lesson.explanation}
          </p>
        </div>
      )}

      {/* Vocabulary & Expression Notes */}
      {lesson.vocabularyNotes && (
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-[#ECEAF2] shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-[#181624] flex items-center gap-2">
              <Award className="w-4 h-4 text-[#6546D7]" />
              <span>Essential Vocabulary & Sentence Frames</span>
            </h3>
            <button
              onClick={() => playSingleSection(lesson.vocabularyNotes, 'vocab')}
              className="flex items-center gap-1.5 text-xs font-semibold text-[#6546D7] hover:underline cursor-pointer"
            >
              {playingKey === 'vocab' ? (
                <>
                  <Square className="w-3.5 h-3.5 text-rose-600" />
                  <span className="text-rose-600">Stop</span>
                </>
              ) : (
                <>
                  <Volume2 className="w-3.5 h-3.5" />
                  <span>Pronounce Vocabulary</span>
                </>
              )}
            </button>
          </div>
          <div className="p-4 rounded-2xl bg-[#FAF9FC] border border-[#ECEAF2] text-sm text-[#383548] whitespace-pre-line leading-relaxed font-mono">
            {lesson.vocabularyNotes}
          </div>
        </div>
      )}

      {/* Exemplary Sample Answer */}
      {lesson.sampleAnswer && (
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-[#ECEAF2] shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-[#181624] flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#6546D7]" />
              <span>Model Sample Speaking Answer</span>
            </h3>
            <button
              onClick={() => playSingleSection(lesson.sampleAnswer, 'sample')}
              className="flex items-center gap-1.5 text-xs font-semibold text-[#6546D7] hover:underline cursor-pointer"
            >
              {playingKey === 'sample' ? (
                <>
                  <Square className="w-3.5 h-3.5 text-rose-600" />
                  <span className="text-rose-600">Stop</span>
                </>
              ) : (
                <>
                  <Volume2 className="w-3.5 h-3.5" />
                  <span>Hear Native Sample</span>
                </>
              )}
            </button>
          </div>
          <div className="p-4 rounded-2xl bg-[#FAF9FC] border border-[#ECEAF2] italic text-sm text-[#242232] leading-relaxed">
            "{lesson.sampleAnswer}"
          </div>
        </div>
      )}

      {/* Practice Activities & Speaking Assessments */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-[#ECEAF2] shadow-xs space-y-4">
        <div>
          <h3 className="text-lg font-bold text-[#181624]">Speaking Practice & Assessments</h3>
          <p className="text-xs text-[#706D7F]">
            Satisfy the {lesson.requiredMasteryScore || 75}% mastery threshold to advance to the next lesson.
          </p>
        </div>

        {loading ? (
          <div className="py-8 flex justify-center">
            <div className="w-6 h-6 border-2 border-[#6546D7] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : activities.length === 0 ? (
          <div className="p-8 text-center bg-[#FAF9FC] rounded-2xl border border-dashed border-[#DCD9E8]">
            <p className="text-xs text-[#6C697B]">No practice activities added yet for this lesson.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3">
            {activities.map((act) => (
              <div
                key={act.id}
                className="p-5 rounded-2xl border border-[#ECEAF2] hover:border-[#6546D7]/40 bg-[#FAF9FC] transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-[#ECE8F8] text-[#6546D7]">
                      {act.bloomLevel}
                    </span>
                    <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-white border border-[#E5E3EF] text-[#615E70] uppercase">
                      {act.format === 'recording'
                        ? 'Voice Recording'
                        : act.format === 'ai_conversation'
                        ? 'AI Conversation'
                        : 'Text Response'}
                    </span>
                  </div>
                  <h4 className="font-bold text-sm text-[#1A1826]">{act.title}</h4>
                  <p className="text-xs text-[#686577] mt-0.5 line-clamp-1">{act.prompt}</p>
                </div>

                <button
                  onClick={() => {
                    stopAllAudio();
                    onStartActivity(act);
                  }}
                  disabled={!isUnlocked}
                  className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-[#6546D7] hover:bg-[#5235BF] disabled:opacity-50 text-white text-xs font-semibold shadow-xs transition-all cursor-pointer shrink-0"
                >
                  <Mic className="w-3.5 h-3.5" />
                  <span>Start Practice</span>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
