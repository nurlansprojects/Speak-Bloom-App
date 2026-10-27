import React from 'react';
import { AssessmentAttempt } from '../types';
import { getActivityIcon, getActivityFormatLabel } from '../utils/activityUtils';
import {
  CheckCircle2,
  XCircle,
  Award,
  Sparkles,
  ArrowRight,
  RotateCcw,
  Clock,
  PenLine,
  Mic,
  FileText,
  Volume2,
} from 'lucide-react';

interface AssessmentResultModalProps {
  attempt: AssessmentAttempt;
  masteryThreshold: number;
  onClose: () => void;
  onRetry?: () => void;
  onContinueNext?: () => void;
  hasNextLesson?: boolean;
}

export const AssessmentResultModal: React.FC<AssessmentResultModalProps> = ({
  attempt,
  masteryThreshold,
  onClose,
  onRetry,
  onContinueNext,
  hasNextLesson,
}) => {
  const isTeacherPending = attempt.evaluator === 'teacher' && attempt.status !== 'graded';
  const isTeacherGraded = attempt.evaluator === 'teacher' && attempt.status === 'graded';
  const isAiEvaluated = attempt.evaluator === 'ai';

  const criteria = [
    { name: 'Fluency', score: attempt.scoreFluency, desc: 'Smoothness, rhythm, and natural pacing' },
    { name: 'Vocabulary', score: attempt.scoreVocabulary, desc: 'Range and precision of CEFR vocabulary' },
    { name: 'Grammar', score: attempt.scoreGrammar, desc: 'Sentence structures and grammatical accuracy' },
    { name: 'Pronunciation', score: attempt.scorePronunciation, desc: 'Clarity, word stress, and intelligibility' },
    { name: 'Coherence', score: attempt.scoreCoherence, desc: 'Logical flow and linking expressions' },
    { name: 'Task Achievement', score: attempt.scoreTaskAchievement, desc: 'Direct response to the prompt' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-2xl w-full border border-[#ECEAF2] shadow-2xl overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-200">
        {/* Header Banner */}
        <div
          className={`p-6 sm:p-8 text-white ${
            isTeacherPending
              ? 'bg-gradient-to-br from-[#6546D7] to-[#482DB0]'
              : attempt.passed
              ? 'bg-gradient-to-br from-[#6546D7] to-[#482DB0]'
              : 'bg-gradient-to-br from-[#4A4758] to-[#2E2C38]'
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {isTeacherPending ? (
                <div className="w-12 h-12 rounded-2xl bg-white/15 flex items-center justify-center">
                  <Clock className="w-7 h-7 text-amber-200 animate-pulse" />
                </div>
              ) : attempt.passed ? (
                <div className="w-12 h-12 rounded-2xl bg-white/15 flex items-center justify-center">
                  <CheckCircle2 className="w-7 h-7 text-emerald-300" />
                </div>
              ) : (
                <div className="w-12 h-12 rounded-2xl bg-white/15 flex items-center justify-center">
                  <XCircle className="w-7 h-7 text-amber-300" />
                </div>
              )}
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-white/80 flex items-center gap-1.5">
                  {getActivityIcon(attempt.format, 'w-3.5 h-3.5 text-white/90')}
                  <span>
                    {isAiEvaluated
                      ? 'AI Rubric Assessment'
                      : isTeacherPending
                      ? 'Teacher Assessment • Pending Review'
                      : 'Teacher Assessment • Graded'}
                  </span>
                </span>
                <h2 className="text-2xl font-bold tracking-tight">
                  {isTeacherPending
                    ? 'Submission Received!'
                    : isTeacherGraded
                    ? `Graded: ${Math.round(attempt.score ?? attempt.overallPercentage)}%`
                    : attempt.passed
                    ? 'Mastery Milestone Achieved!'
                    : 'Practice Needs Attention'}
                </h2>
              </div>
            </div>

            {/* Score or Status Pill */}
            <div className="text-right">
              {isTeacherPending ? (
                <div>
                  <span className="px-3 py-1 rounded-full bg-amber-400/25 border border-amber-300/40 text-amber-200 text-xs font-bold uppercase tracking-wider">
                    Awaiting Review
                  </span>
                  <div className="text-[11px] text-white/80 mt-1">Pending Teacher Grade</div>
                </div>
              ) : (
                <div>
                  <div className="text-3xl font-extrabold tracking-tight">
                    {Math.round(attempt.score ?? attempt.overallPercentage)}%
                  </div>
                  <div className="text-xs text-white/80">Required: {masteryThreshold}%</div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 sm:p-8 space-y-6 max-h-[70vh] overflow-y-auto">
          {/* TEACHER PENDING NOTIFICATION */}
          {isTeacherPending && (
            <div className="p-4 rounded-2xl bg-[#F7F5FC] border border-[#6546D7]/20 flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-[#6546D7] shrink-0 mt-0.5" />
              <div className="text-xs sm:text-sm text-[#2C2939] leading-relaxed">
                <span className="font-bold text-[#6546D7]">Saved to Teacher Dashboard: </span>
                Your submission has been recorded in the Speak Bloom database and is now available in your instructor's review queue. Your teacher will evaluate your work, assign a numerical score (0–100), and share personalized feedback.
              </div>
            </div>
          )}

          {/* TEACHER GRADED FEEDBACK */}
          {isTeacherGraded && (
            <div className="p-5 rounded-2xl bg-emerald-50/70 border border-emerald-200 space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-800 flex items-center gap-1.5">
                  <Award className="w-4 h-4 text-emerald-600" />
                  <span>Teacher Evaluation & Score</span>
                </h4>
                {attempt.gradedByName && (
                  <span className="text-[11px] text-emerald-700 font-medium">
                    Graded by {attempt.gradedByName}
                  </span>
                )}
              </div>
              <div className="text-base font-bold text-emerald-950">
                Score: {attempt.score ?? attempt.overallPercentage} / 100
                {attempt.passed && (
                  <span className="ml-2 text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-200/60 text-emerald-800">
                    Passed Mastery Gate
                  </span>
                )}
              </div>
              {(attempt.teacherComments || attempt.feedback) && (
                <div className="text-xs sm:text-sm text-emerald-900 leading-relaxed pt-1 border-t border-emerald-200/60">
                  <span className="font-semibold">Instructor Feedback: </span>
                  {attempt.teacherComments || attempt.feedback}
                </div>
              )}
            </div>
          )}

          {/* Transcript / Submission Content */}
          <div className="bg-[#FAF9FC] p-4 sm:p-5 rounded-2xl border border-[#ECEAF2]">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#737084] mb-2 flex items-center gap-2">
              {getActivityIcon(attempt.format, 'w-3.5 h-3.5')}
              <span>
                {attempt.format === 'text'
                  ? 'Your Written Response'
                  : attempt.format === 'recording'
                  ? 'Your Voice Audio Submission'
                  : 'Your Practice Submission'}
              </span>
            </h4>

            {attempt.format === 'text' ? (
              <div className="p-3.5 rounded-xl bg-white border border-[#EBE8F3] text-sm text-[#272533] leading-relaxed whitespace-pre-wrap font-sans">
                {attempt.content}
              </div>
            ) : attempt.audioData ? (
              <div className="space-y-3">
                <p className="text-xs text-[#5D596D] italic">"{attempt.content}"</p>
                <audio src={attempt.audioData} controls className="w-full h-10 rounded-xl" />
              </div>
            ) : (
              <p className="text-sm text-[#272533] leading-relaxed italic">
                "{attempt.content}"
              </p>
            )}
          </div>

          {/* AI 6-Criterion Rubric Breakdown Grid (only if AI evaluated) */}
          {isAiEvaluated && (
            <div>
              <h4 className="text-sm font-bold text-[#191724] mb-3 flex items-center gap-2">
                <Award className="w-4 h-4 text-[#6546D7]" />
                <span>6-Criterion Rubric Evaluation</span>
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {criteria.map((c) => (
                  <div
                    key={c.name}
                    className="p-3.5 rounded-2xl border border-[#ECEAF2] bg-white flex items-center justify-between"
                  >
                    <div>
                      <div className="font-semibold text-xs text-[#201E2B]">{c.name}</div>
                      <div className="text-[11px] text-[#7A7789]">{c.desc}</div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0 pl-2">
                      <span className="text-sm font-bold text-[#6546D7]">{c.score}</span>
                      <span className="text-xs text-[#9E9BAE]">/ 4</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* AI Qualitative Feedback (only for AI evaluation) */}
          {isAiEvaluated && attempt.feedback && (
            <div className="p-4 rounded-2xl bg-[#F7F5FC] border border-[#6546D7]/15">
              <h4 className="text-xs font-bold uppercase tracking-wider text-[#6546D7] mb-1.5 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                <span>AI Feedback Summary</span>
              </h4>
              <p className="text-sm text-[#312E40] leading-relaxed">{attempt.feedback}</p>
            </div>
          )}

          {/* Strengths & Improvements */}
          {isAiEvaluated && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {attempt.strengths && attempt.strengths.length > 0 && (
                <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200/60">
                  <h5 className="text-xs font-bold text-emerald-800 uppercase tracking-wider mb-2">
                    What You Did Well
                  </h5>
                  <ul className="space-y-1.5 text-xs text-emerald-950">
                    {attempt.strengths.map((str, idx) => (
                      <li key={idx} className="flex items-start gap-1.5">
                        <span className="text-emerald-600 font-bold">•</span>
                        <span>{str}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {attempt.improvements && attempt.improvements.length > 0 && (
                <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200/60">
                  <h5 className="text-xs font-bold text-amber-800 uppercase tracking-wider mb-2">
                    Targeted Improvements
                  </h5>
                  <ul className="space-y-1.5 text-xs text-amber-950">
                    {attempt.improvements.map((imp, idx) => (
                      <li key={idx} className="flex items-start gap-1.5">
                        <span className="text-amber-600 font-bold">•</span>
                        <span>{imp}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Exemplary Revision */}
          {isAiEvaluated && attempt.exemplaryRevision && (
            <div className="p-4 rounded-2xl bg-[#FAF9FC] border border-[#ECEAF2]">
              <h5 className="text-xs font-bold text-[#6546D7] uppercase tracking-wider mb-1.5">
                Exemplary Native Expression
              </h5>
              <p className="text-xs text-[#2A2838] leading-relaxed italic">
                "{attempt.exemplaryRevision}"
              </p>
            </div>
          )}
        </div>

        {/* Modal Actions */}
        <div className="p-5 sm:p-6 bg-[#FAF9FC] border-t border-[#ECEAF2] flex flex-wrap items-center justify-between gap-3">
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl border border-[#D8D5E4] text-xs font-medium text-[#444154] hover:bg-white transition-colors cursor-pointer"
          >
            {isTeacherPending ? 'Return to Lesson' : 'Close'}
          </button>

          <div className="flex items-center gap-2">
            {isAiEvaluated && onRetry && (
              <button
                onClick={onRetry}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-[#6546D7]/30 text-xs font-semibold text-[#6546D7] bg-white hover:bg-[#F2EFFC] transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Retry Practice</span>
              </button>
            )}

            {attempt.passed && hasNextLesson && onContinueNext && (
              <button
                onClick={onContinueNext}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#6546D7] hover:bg-[#5337B6] text-white text-xs font-semibold shadow-sm transition-all cursor-pointer"
              >
                <span>Next Lesson</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
