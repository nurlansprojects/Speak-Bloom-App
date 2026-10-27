import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  Course,
  Module,
  Topic,
  Lesson,
  Activity,
  CEFRLevel,
  BloomLevel,
  ActivityFormat,
} from '../types';
import {
  createCourse,
  updateCourse,
  getCourseModules,
  createModule,
  getTopics,
  createTopic,
  getLessons,
  createLesson,
  updateLesson,
  deleteLesson,
  getActivities,
  createActivity,
} from '../services/courseService';
import {
  Plus,
  ArrowLeft,
  Save,
  CheckCircle2,
  AlertCircle,
  Layers,
  Edit3,
  Trash2,
  X,
  UploadCloud,
} from 'lucide-react';
import { getActivityIcon, getActivityFormatLabel } from '../utils/activityUtils';

interface CourseBuilderProps {
  existingCourse?: Course | null;
  onBack: () => void;
  onSaved: (courseId: string) => void;
}

const BLOOM_LEVELS: BloomLevel[] = [
  'Remember',
  'Understand',
  'Apply',
  'Analyze',
  'Evaluate',
  'Create',
];

const CEFR_LEVELS: CEFRLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

export const CourseBuilder: React.FC<CourseBuilderProps> = ({
  existingCourse,
  onBack,
  onSaved,
}) => {
  const { currentUser, userProfile } = useAuth();

  // Course Basic State
  const [courseId, setCourseId] = useState<string | null>(existingCourse?.id || null);
  const [title, setTitle] = useState(existingCourse?.title || '');
  const [description, setDescription] = useState(existingCourse?.description || '');
  const [cefrLevel, setCefrLevel] = useState<CEFRLevel>(existingCourse?.cefrLevel || 'B1');
  const [targetAudience, setTargetAudience] = useState(existingCourse?.targetAudience || '');
  const [learningOutcomes, setLearningOutcomes] = useState(existingCourse?.learningOutcomes || '');
  const [masteryThreshold, setMasteryThreshold] = useState<number>(
    existingCourse?.masteryThreshold || 75
  );
  const [status, setStatus] = useState<'draft' | 'published'>(
    existingCourse?.status === 'published' ? 'published' : 'draft'
  );

  // Hierarchy Data
  const [modules, setModules] = useState<Module[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [activitiesMap, setActivitiesMap] = useState<Record<string, Activity[]>>({});

  // Modals for adding hierarchy items
  const [showAddModule, setShowAddModule] = useState(false);
  const [newModuleTitle, setNewModuleTitle] = useState('');
  const [newModuleDesc, setNewModuleDesc] = useState('');

  const [showAddTopic, setShowAddTopic] = useState<string | null>(null); // moduleId
  const [newTopicTitle, setNewTopicTitle] = useState('');
  const [newTopicDesc, setNewTopicDesc] = useState('');

  // Lesson Modal State (for both Creation and Editing!)
  const [showLessonModal, setShowLessonModal] = useState<{
    moduleId: string;
    topicId: string;
    editingLessonId?: string;
  } | null>(null);
  const [lessonTitle, setLessonTitle] = useState('');
  const [lessonOutcome, setLessonOutcome] = useState('');
  const [lessonSelectedBloom, setLessonSelectedBloom] = useState<BloomLevel[]>(['Apply']);
  const [lessonExplanation, setLessonExplanation] = useState('');
  const [lessonVocabulary, setLessonVocabulary] = useState('');
  const [lessonSampleAnswer, setLessonSampleAnswer] = useState('');
  const [lessonMasteryScore, setLessonMasteryScore] = useState<number>(75);

  // Lesson Deletion Confirmation Dialog State
  const [deletingLesson, setDeletingLesson] = useState<Lesson | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Activity Modal State
  const [showAddActivity, setShowAddActivity] = useState<string | null>(null); // lessonId
  const [activityTitle, setActivityTitle] = useState('');
  const [activityFormat, setActivityFormat] = useState<ActivityFormat>('recording');
  const [activityBloom, setActivityBloom] = useState<BloomLevel>('Apply');
  const [activityPrompt, setActivityPrompt] = useState('');
  const [activityInstructions, setActivityInstructions] = useState('');

  const [saving, setSaving] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    if (courseId) {
      loadHierarchy(courseId);
    }
  }, [courseId]);

  const loadHierarchy = async (cid: string) => {
    try {
      const [mods, tops, less] = await Promise.all([
        getCourseModules(cid),
        getTopics(cid),
        getLessons(cid),
      ]);
      setModules(mods);
      setTopics(tops);
      setLessons(less);

      // Load activities for each lesson
      const actMap: Record<string, Activity[]> = {};
      for (const l of less) {
        const acts = await getActivities(cid, l.id);
        actMap[l.id] = acts;
      }
      setActivitiesMap(actMap);
    } catch (err) {
      console.error('Error loading curriculum hierarchy:', err);
    }
  };

  const validateCourseForPublishing = (): string[] => {
    const errors: string[] = [];
    if (!title.trim()) errors.push('Course title is required.');
    if (!description.trim()) errors.push('Course description is required.');
    if (!learningOutcomes.trim()) errors.push('Learning outcomes must be defined.');
    if (modules.length === 0) errors.push('Course must have at least one module.');
    if (topics.length === 0) errors.push('Course must have at least one topic.');
    if (lessons.length === 0) errors.push('Course must have at least one lesson.');

    const totalActivities = Object.values(activitiesMap).reduce((acc, a) => acc + a.length, 0);
    if (totalActivities === 0) errors.push('At least one speaking practice activity is required.');

    return errors;
  };

  const handleSaveCourse = async (publish: boolean = false) => {
    if (!currentUser || !userProfile) return;
    setSaving(true);
    setValidationErrors([]);
    setSuccessMessage(null);

    const newStatus = publish ? 'published' : 'draft';

    if (publish) {
      const errors = validateCourseForPublishing();
      if (errors.length > 0) {
        setValidationErrors(errors);
        setSaving(false);
        return;
      }
    }

    try {
      let activeCid = courseId;
      if (!activeCid) {
        activeCid = await createCourse({
          teacherId: currentUser.uid,
          teacherName: userProfile.displayName || 'Instructor',
          title: title.trim(),
          description: description.trim(),
          cefrLevel,
          targetAudience: targetAudience.trim(),
          learningOutcomes: learningOutcomes.trim(),
          status: newStatus,
          masteryThreshold,
        });
        setCourseId(activeCid);
      } else {
        await updateCourse(activeCid, {
          title: title.trim(),
          description: description.trim(),
          cefrLevel,
          targetAudience: targetAudience.trim(),
          learningOutcomes: learningOutcomes.trim(),
          status: newStatus,
          masteryThreshold,
        });
      }

      setStatus(newStatus);
      setSuccessMessage(
        publish
          ? 'Course successfully published to the Speak Bloom catalog!'
          : 'Course draft saved successfully.'
      );
      if (publish && activeCid) {
        onSaved(activeCid);
      }
    } catch (err: any) {
      console.error(err);
      setValidationErrors([err.message || 'Failed to save course.']);
    } finally {
      setSaving(false);
    }
  };

  const handleCreateModule = async () => {
    if (!courseId) {
      alert('Please save the course details first before adding modules.');
      return;
    }
    if (!newModuleTitle.trim()) return;

    await createModule(courseId, {
      title: newModuleTitle.trim(),
      description: newModuleDesc.trim(),
      orderIndex: modules.length + 1,
    });

    setNewModuleTitle('');
    setNewModuleDesc('');
    setShowAddModule(false);
    await loadHierarchy(courseId);
  };

  const handleCreateTopic = async (moduleId: string) => {
    if (!courseId || !newTopicTitle.trim()) return;

    await createTopic(courseId, {
      moduleId,
      title: newTopicTitle.trim(),
      description: newTopicDesc.trim(),
      orderIndex: topics.filter((t) => t.moduleId === moduleId).length + 1,
    });

    setNewTopicTitle('');
    setNewTopicDesc('');
    setShowAddTopic(null);
    await loadHierarchy(courseId);
  };

  // Open Lesson Modal for New Lesson
  const handleOpenAddLesson = (moduleId: string, topicId: string) => {
    setLessonTitle('');
    setLessonOutcome('');
    setLessonSelectedBloom(['Apply']);
    setLessonExplanation('');
    setLessonVocabulary('');
    setLessonSampleAnswer('');
    setLessonMasteryScore(masteryThreshold);
    setShowLessonModal({ moduleId, topicId });
  };

  // Open Lesson Modal for Editing Existing Lesson
  const handleOpenEditLesson = (lesson: Lesson) => {
    setLessonTitle(lesson.title);
    setLessonOutcome(lesson.targetSpeakingOutcome || lesson.description || '');
    setLessonSelectedBloom(
      Array.isArray(lesson.bloomLevels) && lesson.bloomLevels.length > 0
        ? lesson.bloomLevels
        : ['Apply']
    );
    setLessonExplanation(lesson.explanation || '');
    setLessonVocabulary(lesson.vocabularyNotes || '');
    setLessonSampleAnswer(lesson.sampleAnswer || '');
    setLessonMasteryScore(lesson.requiredMasteryScore || masteryThreshold);
    setShowLessonModal({
      moduleId: lesson.moduleId,
      topicId: lesson.topicId,
      editingLessonId: lesson.id,
    });
  };

  // Save Lesson (Handles both Create and Update)
  const handleSaveLesson = async () => {
    if (!courseId || !showLessonModal || !lessonTitle.trim()) return;

    try {
      if (showLessonModal.editingLessonId) {
        // UPDATE EXISTING LESSON
        await updateLesson(courseId, showLessonModal.editingLessonId, {
          title: lessonTitle.trim(),
          description: lessonOutcome.trim(),
          targetSpeakingOutcome: lessonOutcome.trim(),
          cefrLevel,
          bloomLevels: lessonSelectedBloom,
          requiredMasteryScore: lessonMasteryScore,
          explanation: lessonExplanation.trim(),
          vocabularyNotes: lessonVocabulary.trim(),
          sampleAnswer: lessonSampleAnswer.trim(),
        });
        setSuccessMessage(`Lesson "${lessonTitle.trim()}" updated successfully.`);
      } else {
        // CREATE NEW LESSON
        await createLesson(courseId, {
          moduleId: showLessonModal.moduleId,
          topicId: showLessonModal.topicId,
          title: lessonTitle.trim(),
          description: lessonOutcome.trim(),
          targetSpeakingOutcome: lessonOutcome.trim(),
          cefrLevel,
          bloomLevels: lessonSelectedBloom,
          orderIndex: lessons.length + 1,
          requiredMasteryScore: lessonMasteryScore,
          explanation: lessonExplanation.trim(),
          vocabularyNotes: lessonVocabulary.trim(),
          sampleAnswer: lessonSampleAnswer.trim(),
        });
        setSuccessMessage(`Lesson "${lessonTitle.trim()}" created successfully.`);
      }

      setShowLessonModal(null);
      await loadHierarchy(courseId);
    } catch (err: any) {
      console.error(err);
      alert(err.message || 'Failed to save lesson.');
    }
  };

  // Confirm and Execute Lesson Deletion
  const handleConfirmDeleteLesson = async () => {
    if (!courseId || !deletingLesson) return;
    setIsDeleting(true);
    try {
      await deleteLesson(courseId, deletingLesson.id);
      setSuccessMessage(`Lesson "${deletingLesson.title}" was deleted.`);
      setDeletingLesson(null);
      await loadHierarchy(courseId);
    } catch (err: any) {
      console.error('Failed to delete lesson:', err);
      alert(err.message || 'Failed to delete lesson.');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleCreateActivity = async (lessonId: string) => {
    if (!courseId || !activityTitle.trim() || !activityPrompt.trim()) return;

    await createActivity(courseId, {
      lessonId,
      title: activityTitle.trim(),
      instructions: activityInstructions.trim(),
      bloomLevel: activityBloom,
      cefrLevel,
      format: activityFormat,
      prompt: activityPrompt.trim(),
      maxAttempts: 3,
      orderIndex: (activitiesMap[lessonId]?.length || 0) + 1,
    });

    setActivityTitle('');
    setActivityPrompt('');
    setActivityInstructions('');
    setShowAddActivity(null);
    await loadHierarchy(courseId);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-16 animate-in fade-in duration-200">
      {/* Top Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 text-xs font-semibold text-[#565366] hover:text-[#181622] transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Teaching Dashboard</span>
        </button>

        <div className="flex items-center gap-2">
          <button
            onClick={() => handleSaveCourse(false)}
            disabled={saving || !title.trim()}
            className="flex items-center gap-2 px-4 py-2 rounded-xl border border-[#D5D2E2] bg-white hover:bg-[#F4F3F9] text-xs font-semibold text-[#322F40] disabled:opacity-50 transition-colors cursor-pointer"
          >
            <Save className="w-3.5 h-3.5" />
            <span>Save Draft</span>
          </button>

          <button
            onClick={() => handleSaveCourse(true)}
            disabled={saving || !title.trim()}
            className="flex items-center gap-2 px-5 py-2 rounded-xl bg-[#6546D7] hover:bg-[#5235BF] text-white text-xs font-semibold shadow-xs disabled:opacity-50 transition-all cursor-pointer"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>Publish Course</span>
          </button>
        </div>
      </div>

      {/* Messages */}
      {validationErrors.length > 0 && (
        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-900 space-y-1">
          <div className="font-bold flex items-center gap-1.5">
            <AlertCircle className="w-4 h-4 text-amber-700" />
            <span>Cannot publish until requirements are met:</span>
          </div>
          <ul className="list-disc list-inside space-y-0.5 pl-1">
            {validationErrors.map((err, idx) => (
              <li key={idx}>{err}</li>
            ))}
          </ul>
        </div>
      )}

      {successMessage && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successMessage}</span>
          </div>
          <button
            onClick={() => setSuccessMessage(null)}
            className="text-xs text-emerald-700 hover:underline cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Course Details Card */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-[#ECEAF2] shadow-xs space-y-5">
        <div className="flex items-center justify-between border-b border-[#F1EFF7] pb-4">
          <h2 className="text-xl font-bold text-[#16151E]">Course Details</h2>
          <span
            className={`text-xs font-semibold uppercase tracking-wider px-2.5 py-1 rounded-full ${
              status === 'published'
                ? 'bg-emerald-50 text-emerald-700'
                : 'bg-amber-50 text-amber-700'
            }`}
          >
            {status}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2 space-y-1.5">
            <label className="text-xs font-semibold text-[#322F40]">Course Title *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Spoken Fluency for Daily Situations"
              className="w-full px-4 py-2.5 rounded-xl border border-[#DCD9E8] text-xs sm:text-sm focus:outline-none focus:border-[#6546D7]"
            />
          </div>

          <div className="sm:col-span-2 space-y-1.5">
            <label className="text-xs font-semibold text-[#322F40]">Course Description *</label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the target speaking capabilities and course structure..."
              className="w-full p-4 rounded-xl border border-[#DCD9E8] text-xs sm:text-sm focus:outline-none focus:border-[#6546D7] resize-none"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[#322F40]">Target CEFR Level *</label>
            <select
              value={cefrLevel}
              onChange={(e) => setCefrLevel(e.target.value as CEFRLevel)}
              className="w-full px-4 py-2.5 rounded-xl border border-[#DCD9E8] bg-white text-xs sm:text-sm focus:outline-none focus:border-[#6546D7]"
            >
              {CEFR_LEVELS.map((lvl) => (
                <option key={lvl} value={lvl}>
                  CEFR {lvl}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[#322F40]">
              Mastery Threshold (%) *
            </label>
            <input
              type="number"
              min={60}
              max={100}
              value={masteryThreshold}
              onChange={(e) => setMasteryThreshold(parseInt(e.target.value, 10) || 75)}
              className="w-full px-4 py-2.5 rounded-xl border border-[#DCD9E8] text-xs sm:text-sm focus:outline-none focus:border-[#6546D7]"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[#322F40]">Target Audience</label>
            <input
              type="text"
              value={targetAudience}
              onChange={(e) => setTargetAudience(e.target.value)}
              placeholder="e.g. Intermediate adult learners preparing for presentations"
              className="w-full px-4 py-2.5 rounded-xl border border-[#DCD9E8] text-xs sm:text-sm focus:outline-none focus:border-[#6546D7]"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[#322F40]">Learning Outcomes *</label>
            <input
              type="text"
              value={learningOutcomes}
              onChange={(e) => setLearningOutcomes(e.target.value)}
              placeholder="e.g. Express clear viewpoints with justifications and transition markers"
              className="w-full px-4 py-2.5 rounded-xl border border-[#DCD9E8] text-xs sm:text-sm focus:outline-none focus:border-[#6546D7]"
            />
          </div>
        </div>
      </div>

      {/* Curriculum Hierarchy Builder */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-[#16151E] flex items-center gap-2">
            <Layers className="w-5 h-5 text-[#6546D7]" />
            <span>Curriculum Hierarchy (Modules → Topics → Lessons)</span>
          </h2>

          <button
            onClick={() => {
              if (!courseId) {
                handleSaveCourse(false).then(() => setShowAddModule(true));
              } else {
                setShowAddModule(true);
              }
            }}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#6546D7] hover:bg-[#5235BF] text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add Module</span>
          </button>
        </div>

        {/* Add Module Inline Form */}
        {showAddModule && (
          <div className="p-5 rounded-2xl bg-[#F7F5FC] border border-[#6546D7]/20 space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#6546D7]">
              New Curriculum Module
            </h4>
            <input
              type="text"
              value={newModuleTitle}
              onChange={(e) => setNewModuleTitle(e.target.value)}
              placeholder="Module Title (e.g. Expressing Opinions & Agreement)"
              className="w-full px-4 py-2 rounded-xl border border-[#D8D4E6] bg-white text-xs sm:text-sm"
            />
            <input
              type="text"
              value={newModuleDesc}
              onChange={(e) => setNewModuleDesc(e.target.value)}
              placeholder="Short Module Summary..."
              className="w-full px-4 py-2 rounded-xl border border-[#D8D4E6] bg-white text-xs sm:text-sm"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowAddModule(false)}
                className="px-3 py-1.5 text-xs text-[#636074]"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateModule}
                className="px-4 py-1.5 rounded-xl bg-[#6546D7] text-white text-xs font-semibold cursor-pointer"
              >
                Create Module
              </button>
            </div>
          </div>
        )}

        {/* Modules List */}
        {modules.length === 0 ? (
          <div className="bg-white rounded-3xl p-8 text-center border border-dashed border-[#DDD9E8]">
            <p className="text-xs text-[#716E82]">
              No modules created yet. Click "+ Add Module" to start structuring your course.
            </p>
          </div>
        ) : (
          modules.map((mod, modIdx) => {
            const modTopics = topics.filter((t) => t.moduleId === mod.id);

            return (
              <div
                key={mod.id}
                className="bg-white rounded-3xl border border-[#ECEAF2] shadow-xs overflow-hidden space-y-4"
              >
                <div className="p-5 bg-[#FAF9FC] border-b border-[#ECEAF2] flex items-center justify-between">
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-[#6546D7]">
                      Module {modIdx + 1}
                    </span>
                    <h3 className="font-bold text-base text-[#181624]">{mod.title}</h3>
                  </div>
                  <button
                    onClick={() => setShowAddTopic(mod.id)}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-[#DCD9E8] bg-white hover:bg-[#F2EFFC] text-xs font-semibold text-[#6546D7] cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Topic</span>
                  </button>
                </div>

                {/* Add Topic Inline Form */}
                {showAddTopic === mod.id && (
                  <div className="mx-5 p-4 rounded-2xl bg-[#F7F5FC] border border-[#6546D7]/20 space-y-3">
                    <h5 className="text-xs font-bold uppercase tracking-wider text-[#6546D7]">
                      New Topic in Module {modIdx + 1}
                    </h5>
                    <input
                      type="text"
                      value={newTopicTitle}
                      onChange={(e) => setNewTopicTitle(e.target.value)}
                      placeholder="Topic Title (e.g. Polite Disagreement)"
                      className="w-full px-3 py-2 rounded-xl border border-[#D5D2E2] bg-white text-xs"
                    />
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => setShowAddTopic(null)}
                        className="px-3 py-1 text-xs text-[#636074]"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => handleCreateTopic(mod.id)}
                        className="px-4 py-1.5 rounded-xl bg-[#6546D7] text-white text-xs font-semibold cursor-pointer"
                      >
                        Create Topic
                      </button>
                    </div>
                  </div>
                )}

                {/* Topics List */}
                <div className="p-5 pt-0 space-y-4">
                  {modTopics.length === 0 ? (
                    <p className="text-xs text-[#827F90] italic pl-2">
                      No topics added in this module yet.
                    </p>
                  ) : (
                    modTopics.map((top, topIdx) => {
                      const topicLessons = lessons.filter((l) => l.topicId === top.id);

                      return (
                        <div
                          key={top.id}
                          className="p-4 rounded-2xl border border-[#ECEAF2] bg-[#FAF9FC] space-y-3"
                        >
                          <div className="flex items-center justify-between">
                            <h4 className="font-bold text-xs uppercase tracking-wider text-[#4A475A]">
                              Topic {topIdx + 1}: {top.title}
                            </h4>
                            <button
                              onClick={() => handleOpenAddLesson(mod.id, top.id)}
                              className="flex items-center gap-1 text-xs font-semibold text-[#6546D7] hover:underline cursor-pointer"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              <span>Add Lesson</span>
                            </button>
                          </div>

                          {/* Lessons in Topic */}
                          <div className="space-y-2.5">
                            {topicLessons.map((les) => {
                              const acts = activitiesMap[les.id] || [];

                              return (
                                <div
                                  key={les.id}
                                  className="p-4 rounded-2xl bg-white border border-[#E7E5EF] space-y-3 shadow-xs"
                                >
                                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                    <div>
                                      <div className="flex flex-wrap items-center gap-1.5 mb-1">
                                        {les.bloomLevels?.map((b) => (
                                          <span
                                            key={b}
                                            className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-[#F1EEFB] text-[#6546D7]"
                                          >
                                            Bloom: {b}
                                          </span>
                                        ))}
                                        <span className="text-[10px] font-semibold text-[#7E7A8E]">
                                          Pass: {les.requiredMasteryScore || 75}%
                                        </span>
                                      </div>
                                      <h5 className="font-bold text-sm text-[#16151E]">
                                        {les.title}
                                      </h5>
                                      {les.targetSpeakingOutcome && (
                                        <p className="text-xs text-[#636074] mt-0.5 line-clamp-1">
                                          Outcome: {les.targetSpeakingOutcome}
                                        </p>
                                      )}
                                    </div>

                                    {/* Action Buttons: Edit, Delete, Add Activity */}
                                    <div className="flex items-center gap-1.5 self-end sm:self-auto shrink-0">
                                      <button
                                        onClick={() => handleOpenEditLesson(les)}
                                        title="Edit Lesson"
                                        aria-label={`Edit Lesson ${les.title}`}
                                        className="p-1.5 rounded-lg border border-[#DCD9E8] hover:border-[#6546D7] text-[#555265] hover:text-[#6546D7] hover:bg-[#F3EFFC] transition-colors cursor-pointer"
                                      >
                                        <Edit3 className="w-4 h-4" />
                                      </button>

                                      <button
                                        onClick={() => setDeletingLesson(les)}
                                        title="Delete Lesson"
                                        aria-label={`Delete Lesson ${les.title}`}
                                        className="p-1.5 rounded-lg border border-rose-200 hover:border-rose-400 text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                                      >
                                        <Trash2 className="w-4 h-4" />
                                      </button>

                                      <button
                                        onClick={() => setShowAddActivity(les.id)}
                                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#6546D7] hover:bg-[#5235BF] text-white text-xs font-semibold shadow-xs cursor-pointer ml-1"
                                      >
                                        <Plus className="w-3.5 h-3.5" />
                                        <span>Activity</span>
                                      </button>
                                    </div>
                                  </div>

                                  {/* Activities list for this lesson */}
                                  {acts.length > 0 && (
                                    <div className="pt-2 border-t border-[#F2F0F7] space-y-1.5">
                                      <span className="text-[10px] font-bold uppercase tracking-wider text-[#817E8E]">
                                        Speaking Activities ({acts.length})
                                      </span>
                                      <div className="grid grid-cols-1 gap-1">
                                        {acts.map((act) => (
                                          <div
                                            key={act.id}
                                            className="text-xs text-[#4F4B5D] flex items-center justify-between p-2 rounded-xl bg-[#FAF9FC] border border-[#ECEAF2]"
                                          >
                                            <div className="flex items-center gap-2 truncate pr-2">
                                              {getActivityIcon(act.format, 'w-3.5 h-3.5 text-[#6546D7] shrink-0')}
                                              <span className="font-semibold">{act.title}</span>
                                              <span className="text-[#898696] text-[11px] font-medium">
                                                • {getActivityFormatLabel(act.format)}
                                              </span>
                                            </div>
                                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-white border border-[#E0DDEB] text-[#6546D7] shrink-0">
                                              {act.bloomLevel}
                                            </span>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Lesson Creation & Editing Modal */}
      {showLessonModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-xl w-full border border-[#ECEAF2] shadow-2xl p-6 space-y-4 my-8">
            <div className="flex items-center justify-between border-b border-[#ECEAF2] pb-3">
              <h3 className="text-base font-bold text-[#16151E]">
                {showLessonModal.editingLessonId ? 'Edit Lesson' : 'Add Bloom-Aligned Lesson'}
              </h3>
              <button
                onClick={() => setShowLessonModal(null)}
                className="p-1.5 text-[#7E7B8D] hover:text-[#16151E] hover:bg-[#F2EFF8] rounded-xl cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3.5 max-h-[70vh] overflow-y-auto pr-1">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-[#322F40]">Lesson Title *</label>
                <input
                  type="text"
                  value={lessonTitle}
                  onChange={(e) => setLessonTitle(e.target.value)}
                  placeholder="e.g. Stating and Justifying a Perspective"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#D5D2E2] text-xs sm:text-sm focus:outline-none focus:border-[#6546D7]"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-[#322F40]">
                  Target Speaking Outcome *
                </label>
                <input
                  type="text"
                  value={lessonOutcome}
                  onChange={(e) => setLessonOutcome(e.target.value)}
                  placeholder="e.g. Formulate reasoned arguments using 'In my view... because...'"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#D5D2E2] text-xs sm:text-sm focus:outline-none focus:border-[#6546D7]"
                />
              </div>

              {/* Bloom's Taxonomy Multi-Select */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-[#322F40]">
                    Bloom's Taxonomy Levels (Select all applicable)
                  </label>
                  <span className="text-[11px] text-[#6546D7] font-medium">
                    {lessonSelectedBloom.length} selected
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {BLOOM_LEVELS.map((bloom) => {
                    const isSelected = lessonSelectedBloom.includes(bloom);
                    return (
                      <button
                        key={bloom}
                        type="button"
                        onClick={() => {
                          if (isSelected) {
                            if (lessonSelectedBloom.length > 1) {
                              setLessonSelectedBloom(lessonSelectedBloom.filter((b) => b !== bloom));
                            }
                          } else {
                            setLessonSelectedBloom([...lessonSelectedBloom, bloom]);
                          }
                        }}
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer transition-all ${
                          isSelected
                            ? 'bg-[#6546D7] text-white shadow-xs'
                            : 'bg-[#F2EFFC] text-[#555265] hover:bg-[#E9E4F8]'
                        }`}
                      >
                        {bloom}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-[#322F40]">
                  Required Mastery Score (%)
                </label>
                <input
                  type="number"
                  min={50}
                  max={100}
                  value={lessonMasteryScore}
                  onChange={(e) => setLessonMasteryScore(parseInt(e.target.value, 10) || 75)}
                  className="w-full px-3.5 py-2 rounded-xl border border-[#D5D2E2] text-xs focus:outline-none focus:border-[#6546D7]"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-[#322F40]">
                  Instructional Explanation & Speaking Strategy
                </label>
                <textarea
                  rows={3}
                  value={lessonExplanation}
                  onChange={(e) => setLessonExplanation(e.target.value)}
                  placeholder="Provide grammar patterns, communicative guidance, and practical advice..."
                  className="w-full p-3 rounded-xl border border-[#D5D2E2] text-xs focus:outline-none focus:border-[#6546D7] resize-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-[#322F40]">
                  Essential Vocabulary & Phrase Frames
                </label>
                <textarea
                  rows={2}
                  value={lessonVocabulary}
                  onChange={(e) => setLessonVocabulary(e.target.value)}
                  placeholder="e.g. As far as I'm concerned; on the one hand; to illustrate..."
                  className="w-full p-3 rounded-xl border border-[#D5D2E2] text-xs focus:outline-none focus:border-[#6546D7] resize-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-[#322F40]">
                  Model Native Sample Answer
                </label>
                <textarea
                  rows={2}
                  value={lessonSampleAnswer}
                  onChange={(e) => setLessonSampleAnswer(e.target.value)}
                  placeholder="Provide an exemplary spoken answer demonstrating proficiency..."
                  className="w-full p-3 rounded-xl border border-[#D5D2E2] text-xs focus:outline-none focus:border-[#6546D7] resize-none"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-[#ECEAF2]">
              <button
                onClick={() => setShowLessonModal(null)}
                className="px-4 py-2 text-xs font-medium text-[#636074] hover:bg-[#F2EFF8] rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveLesson}
                disabled={!lessonTitle.trim()}
                className="px-5 py-2 rounded-xl bg-[#6546D7] hover:bg-[#5235BF] text-white text-xs font-semibold shadow-xs disabled:opacity-50 transition-colors cursor-pointer"
              >
                {showLessonModal.editingLessonId ? 'Save Changes' : 'Create Lesson'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lesson Deletion Confirmation Dialog */}
      {deletingLesson && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl max-w-md w-full border border-rose-100 shadow-2xl p-6 space-y-4">
            <div className="w-10 h-10 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center">
              <Trash2 className="w-5 h-5" />
            </div>

            <div>
              <h3 className="text-base font-bold text-[#16151E]">Delete Lesson</h3>
              <p className="text-xs text-[#636074] mt-1.5 leading-relaxed">
                Are you sure you want to delete <strong>"{deletingLesson.title}"</strong>?
                This will remove the lesson and its practice activities from the course curriculum.
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setDeletingLesson(null)}
                disabled={isDeleting}
                className="px-4 py-2 text-xs font-medium text-[#5E5B6E] hover:bg-[#F4F3F8] rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDeleteLesson}
                disabled={isDeleting}
                className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer disabled:opacity-50"
              >
                {isDeleting ? 'Deleting...' : 'Delete Lesson'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Activity Modal */}
      {showAddActivity && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-md w-full border border-[#ECEAF2] shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-[#ECEAF2] pb-3">
              <h3 className="text-base font-bold text-[#16151E]">Add Speaking Activity</h3>
              <button
                onClick={() => setShowAddActivity(null)}
                className="p-1.5 text-[#7E7B8D] hover:text-[#16151E] hover:bg-[#F2EFF8] rounded-xl cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-[#322F40]">Activity Title *</label>
                <input
                  type="text"
                  value={activityTitle}
                  onChange={(e) => setActivityTitle(e.target.value)}
                  placeholder="e.g. Guided Opinion Recording"
                  className="w-full px-3 py-2 rounded-xl border border-[#D5D2E2] text-xs focus:outline-none focus:border-[#6546D7]"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-[#322F40]">Practice Format *</label>
                <select
                  value={activityFormat}
                  onChange={(e) => setActivityFormat(e.target.value as ActivityFormat)}
                  className="w-full px-3 py-2 rounded-xl border border-[#D5D2E2] bg-white text-xs focus:outline-none focus:border-[#6546D7]"
                >
                  <option value="text">Text Response / Preparation (Teacher Assessed)</option>
                  <option value="recording">Voice Recording (Teacher Assessed)</option>
                  <option value="uploading">File Uploading (Teacher Assessed)</option>
                  <option value="ai_conversation">Interactive AI Speaking Partner (AI Rubric Evaluated)</option>
                </select>
                {activityFormat === 'uploading' && (
                  <p className="text-[11px] text-[#6546D7] bg-[#F4F1FD] p-2 rounded-lg border border-[#DDD7F5]">
                    Supports PPTX, PDF, DOCX, XLSX, MP3, MP4. Students submit work directly to the teacher's grading queue with score (0–100) and feedback.
                  </p>
                )}
                {activityFormat === 'text' && (
                  <p className="text-[11px] text-[#6546D7] bg-[#F4F1FD] p-2 rounded-lg border border-[#DDD7F5]">
                    Students submit their written response directly to the teacher's grading queue for review, numerical score, and personalized feedback.
                  </p>
                )}
                {activityFormat === 'recording' && (
                  <p className="text-[11px] text-[#6546D7] bg-[#F4F1FD] p-2 rounded-lg border border-[#DDD7F5]">
                    Students record spoken audio directly into the browser and submit for instructor audio playback, grading, and review.
                  </p>
                )}
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-[#322F40]">Bloom Level *</label>
                <select
                  value={activityBloom}
                  onChange={(e) => setActivityBloom(e.target.value as BloomLevel)}
                  className="w-full px-3 py-2 rounded-xl border border-[#D5D2E2] bg-white text-xs focus:outline-none focus:border-[#6546D7]"
                >
                  {BLOOM_LEVELS.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-[#322F40]">Speaking Prompt *</label>
                <textarea
                  rows={3}
                  value={activityPrompt}
                  onChange={(e) => setActivityPrompt(e.target.value)}
                  placeholder="Write the exact question or prompt the student will speak about..."
                  className="w-full p-3 rounded-xl border border-[#D5D2E2] text-xs focus:outline-none focus:border-[#6546D7] resize-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-[#322F40]">Instructions / Tips</label>
                <input
                  type="text"
                  value={activityInstructions}
                  onChange={(e) => setActivityInstructions(e.target.value)}
                  placeholder="e.g. Speak for 45-60 seconds and include at least two reasons."
                  className="w-full px-3 py-2 rounded-xl border border-[#D5D2E2] text-xs focus:outline-none focus:border-[#6546D7]"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-[#ECEAF2]">
              <button
                onClick={() => setShowAddActivity(null)}
                className="px-4 py-2 text-xs text-[#636074] hover:bg-[#F2EFF8] rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => handleCreateActivity(showAddActivity)}
                disabled={!activityTitle.trim() || !activityPrompt.trim()}
                className="px-5 py-2 rounded-xl bg-[#6546D7] hover:bg-[#5235BF] text-white text-xs font-semibold shadow-xs disabled:opacity-50 cursor-pointer"
              >
                Save Activity
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
