import React from 'react';
import { AssessmentAttempt } from '../types';
import { CheckCircle2, XCircle, Award, Sparkles, ArrowRight, RotateCcw } from 'lucide-react';

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
            attempt.passed ? 'bg-gradient-to-br from-[#6546D7] to-[#482DB0]' : 'bg-gradient-to-br from-[#4A4758] to-[#2E2C38]'
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {attempt.passed ? (
                <div className="w-12 h-12 rounded-2xl bg-white/15 flex items-center justify-center">
                  <CheckCircle2 className="w-7 h-7 text-emerald-300" />
                </div>
              ) : (
                <div className="w-12 h-12 rounded-2xl bg-white/15 flex items-center justify-center">
                  <XCircle className="w-7 h-7 text-amber-300" />
                </div>
              )}
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-white/80">
                  {attempt.evaluator === 'ai' ? 'AI Rubric Assessment' : 'Teacher Assessment'}
                </span>
                <h2 className="text-2xl font-bold tracking-tight">
                  {attempt.passed ? 'Mastery Milestone Achieved!' : 'Practice Needs Attention'}
                </h2>
              </div>
            </div>

            {/* Score Pill */}
            <div className="text-right">
              <div className="text-3xl font-extrabold tracking-tight">
                {Math.round(attempt.overallPercentage)}%
              </div>
              <div className="text-xs text-white/80">Required: {masteryThreshold}%</div>
            </div>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 sm:p-8 space-y-6 max-h-[70vh] overflow-y-auto">
          {/* Transcript / Submission Content */}
          <div className="bg-[#FAF9FC] p-4 rounded-2xl border border-[#ECEAF2]">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#737084] mb-1.5">
              Your Spoken Submission
            </h4>
            <p className="text-sm text-[#272533] leading-relaxed italic">
              "{attempt.content}"
            </p>
          </div>

          {/* 6-Criterion Rubric Breakdown Grid */}
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

          {/* Qualitative Feedback */}
          {attempt.feedback && (
            <div className="p-4 rounded-2xl bg-[#F7F5FC] border border-[#6546D7]/15">
              <h4 className="text-xs font-bold uppercase tracking-wider text-[#6546D7] mb-1.5 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Feedback Summary</span>
              </h4>
              <p className="text-sm text-[#312E40] leading-relaxed">{attempt.feedback}</p>
            </div>
          )}

          {/* Strengths & Improvements */}
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

          {/* Exemplary Revision */}
          {attempt.exemplaryRevision && (
            <div className="p-4 rounded-2xl bg-[#FAF9FC] border border-[#ECEAF2]">
              <h5 className="text-xs font-bold text-[#6546D7] uppercase tracking-wider mb-1.5">
                Exemplary Native Expression
              </h5>
              <p className="text-xs text-[#2A2838] leading-relaxed italic">
                "{attempt.exemplaryRevision}"
              </p>
            </div>
          )}

          {/* Teacher Comments if available */}
          {attempt.teacherComments && (
            <div className="p-4 rounded-2xl bg-blue-50/70 border border-blue-200/60">
              <h5 className="text-xs font-bold text-blue-900 uppercase tracking-wider mb-1">
                Teacher Review Note
              </h5>
              <p className="text-xs text-blue-950">{attempt.teacherComments}</p>
            </div>
          )}
        </div>

        {/* Modal Actions */}
        <div className="p-5 sm:p-6 bg-[#FAF9FC] border-t border-[#ECEAF2] flex flex-wrap items-center justify-between gap-3">
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl border border-[#D8D5E4] text-xs font-medium text-[#444154] hover:bg-white transition-colors"
          >
            Close
          </button>

          <div className="flex items-center gap-2">
            {onRetry && (
              <button
                onClick={onRetry}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-[#6546D7]/30 text-xs font-semibold text-[#6546D7] bg-white hover:bg-[#F2EFFC] transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Retry Practice</span>
              </button>
            )}

            {attempt.passed && hasNextLesson && onContinueNext && (
              <button
                onClick={onContinueNext}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#6546D7] hover:bg-[#5337B6] text-white text-xs font-semibold shadow-sm transition-all"
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
