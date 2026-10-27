import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  writeBatch,
} from 'firebase/firestore';
import { ref, deleteObject } from 'firebase/storage';
import { db, storage, auth, handleFirestoreError, OperationType } from '../lib/firebase';
import {
  Course,
  Module,
  Topic,
  Lesson,
  Activity,
  Enrollment,
  LessonProgress,
  AssessmentAttempt,
  TeacherApplication,
} from '../types';

/* ================= COURSE OPERATIONS ================= */

export async function getPublishedCourses(): Promise<Course[]> {
  try {
    const coursesRef = collection(db, 'courses');
    const q = query(coursesRef, where('status', '==', 'published'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() } as Course));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'courses');
  }
}

export async function getTeacherCourses(teacherId: string): Promise<Course[]> {
  try {
    const coursesRef = collection(db, 'courses');
    const q = query(coursesRef, where('teacherId', '==', teacherId));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() } as Course));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'courses');
  }
}

export async function getCourseById(courseId: string): Promise<Course | null> {
  try {
    const courseRef = doc(db, 'courses', courseId);
    const snap = await getDoc(courseRef);
    if (!snap.exists()) return null;
    return { id: snap.id, ...snap.data() } as Course;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, `courses/${courseId}`);
  }
}

export async function createCourse(
  courseData: Omit<Course, 'id' | 'createdAt' | 'updatedAt' | 'modulesCount' | 'lessonsCount'>
): Promise<string> {
  try {
    const courseRef = doc(collection(db, 'courses'));
    const newCourse: Course = {
      ...courseData,
      id: courseRef.id,
      modulesCount: 0,
      lessonsCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await setDoc(courseRef, newCourse);
    return courseRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, 'courses');
  }
}

export async function updateCourse(courseId: string, updates: Partial<Course>): Promise<void> {
  try {
    const courseRef = doc(db, 'courses', courseId);
    await updateDoc(courseRef, {
      ...updates,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `courses/${courseId}`);
  }
}

/**
 * Complete, secure global course deletion
 * Cleans up:
 * 1. Storage files (server disk uploads & Firebase Storage)
 * 2. Upload records in `uploads` collection
 * 3. Subcollections: `activities`, `lessons`, `topics`, `modules`
 * 4. Enrollments in `enrollments` collection
 * 5. Lesson progress in `progress` collection
 * 6. Assessment attempts in `assessmentAttempts` collection
 * 7. Parent course document in `courses` collection
 * 8. Backend server confirmation via DELETE /api/courses/:courseId
 */
export async function deleteCourseGlobally(courseId: string): Promise<void> {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('Authentication required: You must be signed in to delete a course.');
  }

  // 1. Fetch course to verify existence and check authorization
  const courseRef = doc(db, 'courses', courseId);
  const courseSnap = await getDoc(courseRef);
  if (!courseSnap.exists()) {
    // Course does not exist or has already been removed
    return;
  }

  const courseData = courseSnap.data() as Course;
  const isBootstrapAdmin =
    user.email?.toLowerCase() === 'cookingmaxxer@gmail.com' ||
    user.email?.toLowerCase() === 'nurlandigital@gmail.com';

  let isDbAdmin = false;
  try {
    const adminSnap = await getDoc(doc(db, 'admins', user.uid));
    isDbAdmin = adminSnap.exists();
  } catch {
    // Ignore read failure if admin collection is restricted
  }

  const isCourseOwner = courseData.teacherId === user.uid;
  if (!isCourseOwner && !isBootstrapAdmin && !isDbAdmin) {
    throw new Error(
      'Permission denied: Only the owning instructor or an administrator can delete this course.'
    );
  }

  // 2. Mark course as 'archived' & 'deleting' in Firestore so all connected clients immediately block interaction
  try {
    await updateDoc(courseRef, {
      status: 'archived',
      deleting: true,
      updatedAt: new Date().toISOString(),
    });
  } catch (markErr) {
    console.warn('Could not set pre-deletion status flag on course:', markErr);
  }

  // 3. Purge uploaded files and media associated with this course
  try {
    const uploadsRef = collection(db, 'uploads');
    const uploadsQuery = query(uploadsRef, where('courseId', '==', courseId));
    const uploadsSnap = await getDocs(uploadsQuery);

    for (const uploadDoc of uploadsSnap.docs) {
      const uData = uploadDoc.data();
      // Remove disk file if server-stored
      if (uData.storagePath && typeof uData.storagePath === 'string') {
        if (uData.storagePath.startsWith('server://uploads/')) {
          const fname = uData.storagePath.replace('server://uploads/', '');
          try {
            await fetch(`/api/storage/files/${encodeURIComponent(fname)}`, { method: 'DELETE' });
          } catch (delErr) {
            console.warn('Could not remove server file:', delErr);
          }
        } else if (!uData.storagePath.startsWith('idb://')) {
          try {
            const storageRef = ref(storage, uData.storagePath);
            await deleteObject(storageRef);
          } catch (delErr) {
            console.warn('Could not remove cloud storage object:', delErr);
          }
        }
      }
      // Delete upload record from Firestore
      await deleteDoc(uploadDoc.ref);
    }
  } catch (err) {
    console.warn('Error purging course uploads:', err);
  }

  // 4. Clean up subcollections inside course document (activities, lessons, topics, modules)
  // Must be deleted BEFORE the course document itself so isCourseTeacher(courseId) evaluates correctly
  const subcollections = ['activities', 'lessons', 'topics', 'modules'];
  for (const subName of subcollections) {
    try {
      const subRef = collection(db, 'courses', courseId, subName);
      const subSnap = await getDocs(subRef);
      if (!subSnap.empty) {
        const batch = writeBatch(db);
        subSnap.docs.forEach((docItem) => batch.delete(docItem.ref));
        await batch.commit();
      }
    } catch (subErr) {
      console.warn(`Error deleting subcollection ${subName}:`, subErr);
    }
  }

  // 5. Clean up related top-level collection records: enrollments, progress, assessmentAttempts
  // Enrollments
  try {
    const enrollmentsRef = collection(db, 'enrollments');
    const enrollmentsSnap = await getDocs(query(enrollmentsRef, where('courseId', '==', courseId)));
    if (!enrollmentsSnap.empty) {
      const batch = writeBatch(db);
      enrollmentsSnap.docs.forEach((d) => batch.delete(d.ref));
      await batch.commit();
    }
  } catch (enrErr) {
    console.warn('Error cleaning up course enrollments:', enrErr);
  }

  // Lesson Progress
  try {
    const progressRef = collection(db, 'progress');
    const progressSnap = await getDocs(query(progressRef, where('courseId', '==', courseId)));
    if (!progressSnap.empty) {
      const batch = writeBatch(db);
      progressSnap.docs.forEach((d) => batch.delete(d.ref));
      await batch.commit();
    }
  } catch (progErr) {
    console.warn('Error cleaning up course progress:', progErr);
  }

  // Assessment Attempts
  try {
    const attemptsRef = collection(db, 'assessmentAttempts');
    const attemptsSnap = await getDocs(query(attemptsRef, where('courseId', '==', courseId)));
    if (!attemptsSnap.empty) {
      const batch = writeBatch(db);
      attemptsSnap.docs.forEach((d) => batch.delete(d.ref));
      await batch.commit();
    }
  } catch (attErr) {
    console.warn('Error cleaning up course assessment attempts:', attErr);
  }

  // 6. Delete the parent course document in Firestore
  try {
    await deleteDoc(courseRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `courses/${courseId}`);
  }

  // 7. Notify backend server for server-side disk purge and verification
  try {
    const idToken = await user.getIdToken();
    const resp = await fetch(`/api/courses/${encodeURIComponent(courseId)}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${idToken}`,
      },
    });
    if (!resp.ok) {
      const errData = await resp.json().catch(() => ({}));
      console.warn('Backend server returned non-OK during course delete:', errData);
    }
  } catch (backendErr) {
    console.warn('Backend endpoint call warning:', backendErr);
  }
}

export async function deleteCourse(courseId: string): Promise<void> {
  return deleteCourseGlobally(courseId);
}

/* ================= MODULE, TOPIC, LESSON, ACTIVITY ================= */

export async function getCourseModules(courseId: string): Promise<Module[]> {
  try {
    const modulesRef = collection(db, 'courses', courseId, 'modules');
    const q = query(modulesRef, orderBy('orderIndex', 'asc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as Module));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, `courses/${courseId}/modules`);
  }
}

export async function createModule(
  courseId: string,
  data: Omit<Module, 'id' | 'courseId' | 'createdAt'>
): Promise<string> {
  try {
    const modRef = doc(collection(db, 'courses', courseId, 'modules'));
    const newModule: Module = {
      ...data,
      id: modRef.id,
      courseId,
      createdAt: new Date().toISOString(),
    };
    await setDoc(modRef, newModule);

    // Increment module count
    const courseRef = doc(db, 'courses', courseId);
    const courseSnap = await getDoc(courseRef);
    if (courseSnap.exists()) {
      const current = courseSnap.data().modulesCount || 0;
      await updateDoc(courseRef, { modulesCount: current + 1 });
    }

    return modRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `courses/${courseId}/modules`);
  }
}

export async function getTopics(courseId: string, moduleId?: string): Promise<Topic[]> {
  try {
    const topicsRef = collection(db, 'courses', courseId, 'topics');
    const q = moduleId
      ? query(topicsRef, where('moduleId', '==', moduleId), orderBy('orderIndex', 'asc'))
      : query(topicsRef, orderBy('orderIndex', 'asc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as Topic));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, `courses/${courseId}/topics`);
  }
}

export async function createTopic(
  courseId: string,
  data: Omit<Topic, 'id' | 'courseId' | 'createdAt'>
): Promise<string> {
  try {
    const topicRef = doc(collection(db, 'courses', courseId, 'topics'));
    const newTopic: Topic = {
      ...data,
      id: topicRef.id,
      courseId,
      createdAt: new Date().toISOString(),
    };
    await setDoc(topicRef, newTopic);
    return topicRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `courses/${courseId}/topics`);
  }
}

export async function getLessons(courseId: string, topicId?: string): Promise<Lesson[]> {
  try {
    const lessonsRef = collection(db, 'courses', courseId, 'lessons');
    const q = topicId
      ? query(lessonsRef, where('topicId', '==', topicId), orderBy('orderIndex', 'asc'))
      : query(lessonsRef, orderBy('orderIndex', 'asc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as Lesson));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, `courses/${courseId}/lessons`);
  }
}

export async function getLessonById(courseId: string, lessonId: string): Promise<Lesson | null> {
  try {
    const lessonRef = doc(db, 'courses', courseId, 'lessons', lessonId);
    const snap = await getDoc(lessonRef);
    if (!snap.exists()) return null;
    return { id: snap.id, ...snap.data() } as Lesson;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, `courses/${courseId}/lessons/${lessonId}`);
  }
}

export async function createLesson(
  courseId: string,
  data: Omit<Lesson, 'id' | 'courseId' | 'createdAt'>
): Promise<string> {
  try {
    const lessonRef = doc(collection(db, 'courses', courseId, 'lessons'));
    const newLesson: Lesson = {
      ...data,
      id: lessonRef.id,
      courseId,
      createdAt: new Date().toISOString(),
    };
    await setDoc(lessonRef, newLesson);

    // Increment course lesson count
    const courseRef = doc(db, 'courses', courseId);
    const courseSnap = await getDoc(courseRef);
    if (courseSnap.exists()) {
      const current = courseSnap.data().lessonsCount || 0;
      await updateDoc(courseRef, { lessonsCount: current + 1 });
    }

    return lessonRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `courses/${courseId}/lessons`);
  }
}

export async function updateLesson(
  courseId: string,
  lessonId: string,
  updates: Partial<Lesson>
): Promise<void> {
  try {
    const lessonRef = doc(db, 'courses', courseId, 'lessons', lessonId);
    await updateDoc(lessonRef, {
      ...updates,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `courses/${courseId}/lessons/${lessonId}`);
  }
}

export async function deleteLesson(courseId: string, lessonId: string): Promise<void> {
  try {
    // 1. Delete associated activities for this lesson
    const actsRef = collection(db, 'courses', courseId, 'activities');
    const q = query(actsRef, where('lessonId', '==', lessonId));
    const actSnaps = await getDocs(q);
    for (const actDoc of actSnaps.docs) {
      await deleteDoc(actDoc.ref);
    }

    // 2. Delete the lesson doc
    const lessonRef = doc(db, 'courses', courseId, 'lessons', lessonId);
    await deleteDoc(lessonRef);

    // 3. Decrement course lessonsCount
    const courseRef = doc(db, 'courses', courseId);
    const courseSnap = await getDoc(courseRef);
    if (courseSnap.exists()) {
      const current = courseSnap.data().lessonsCount || 1;
      await updateDoc(courseRef, { lessonsCount: Math.max(0, current - 1) });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `courses/${courseId}/lessons/${lessonId}`);
  }
}

export async function getActivities(courseId: string, lessonId: string): Promise<Activity[]> {
  try {
    const actsRef = collection(db, 'courses', courseId, 'activities');
    const q = query(actsRef, where('lessonId', '==', lessonId), orderBy('orderIndex', 'asc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as Activity));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, `courses/${courseId}/activities`);
  }
}

export async function createActivity(
  courseId: string,
  data: Omit<Activity, 'id' | 'courseId' | 'createdAt'>
): Promise<string> {
  try {
    const actRef = doc(collection(db, 'courses', courseId, 'activities'));
    const newAct: Activity = {
      ...data,
      id: actRef.id,
      courseId,
      createdAt: new Date().toISOString(),
    };
    await setDoc(actRef, newAct);
    return actRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `courses/${courseId}/activities`);
  }
}

/* ================= ENROLLMENTS & MASTERY GATING ================= */

export async function getStudentEnrollments(studentId: string): Promise<Enrollment[]> {
  try {
    const enrollmentsRef = collection(db, 'enrollments');
    const q = query(enrollmentsRef, where('studentId', '==', studentId));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as Enrollment));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'enrollments');
  }
}

export async function getEnrollment(studentId: string, courseId: string): Promise<Enrollment | null> {
  try {
    const enrollRef = doc(db, 'enrollments', `${studentId}_${courseId}`);
    const snap = await getDoc(enrollRef);
    if (!snap.exists()) return null;
    return { id: snap.id, ...snap.data() } as Enrollment;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, `enrollments/${studentId}_${courseId}`);
  }
}

export async function enrollStudentInCourse(studentId: string, courseId: string): Promise<void> {
  try {
    const enrollId = `${studentId}_${courseId}`;
    const enrollRef = doc(db, 'enrollments', enrollId);
    const newEnrollment: Enrollment = {
      id: enrollId,
      studentId,
      courseId,
      enrolledAt: new Date().toISOString(),
      completedLessonsCount: 0,
      status: 'active',
      lastAccessedAt: new Date().toISOString(),
    };
    await setDoc(enrollRef, newEnrollment);

    // Automatically unlock the first lesson of the course for this student
    const lessons = await getLessons(courseId);
    if (lessons.length > 0) {
      const firstLesson = lessons[0];
      const progRef = doc(db, 'progress', `${studentId}_${firstLesson.id}`);
      const initialProgress: LessonProgress = {
        id: `${studentId}_${firstLesson.id}`,
        studentId,
        courseId,
        lessonId: firstLesson.id,
        isUnlocked: true,
        isCompleted: false,
        bestScore: 0,
        attemptsCount: 0,
      };
      await setDoc(progRef, initialProgress);
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `enrollments/${studentId}_${courseId}`);
  }
}

export async function getStudentCourseProgress(
  studentId: string,
  courseId: string
): Promise<Record<string, LessonProgress>> {
  try {
    const progRef = collection(db, 'progress');
    const q = query(progRef, where('studentId', '==', studentId), where('courseId', '==', courseId));
    const snapshot = await getDocs(q);
    const progressMap: Record<string, LessonProgress> = {};
    snapshot.docs.forEach((docSnap) => {
      const item = docSnap.data() as LessonProgress;
      progressMap[item.lessonId] = item;
    });
    return progressMap;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'progress');
  }
}

/**
 * Authoritative Mastery Gate Progression:
 * Evaluates lesson attempt and unlocks next sequential lesson if passed.
 */
export async function recordLessonAssessment(
  studentId: string,
  courseId: string,
  lessonId: string,
  score: number,
  passed: boolean
): Promise<{ nextUnlockedLessonId?: string; isCourseCompleted: boolean }> {
  try {
    const progId = `${studentId}_${lessonId}`;
    const progRef = doc(db, 'progress', progId);
    const progSnap = await getDoc(progRef);

    const prevBest = progSnap.exists() ? progSnap.data().bestScore || 0 : 0;
    const prevAttempts = progSnap.exists() ? progSnap.data().attemptsCount || 0 : 0;
    const prevCompleted = progSnap.exists() ? progSnap.data().isCompleted : false;

    const isNowCompleted = prevCompleted || passed;

    await setDoc(
      progRef,
      {
        id: progId,
        studentId,
        courseId,
        lessonId,
        isUnlocked: true,
        isCompleted: isNowCompleted,
        bestScore: Math.max(prevBest, score),
        attemptsCount: prevAttempts + 1,
        lastAttemptAt: new Date().toISOString(),
      },
      { merge: true }
    );

    let nextUnlockedLessonId: string | undefined;
    let isCourseCompleted = false;

    if (passed) {
      // Find all lessons sorted by orderIndex
      const allLessons = await getLessons(courseId);
      const currentIndex = allLessons.findIndex((l) => l.id === lessonId);

      if (currentIndex >= 0 && currentIndex < allLessons.length - 1) {
        // Unlock the next sequential lesson
        const nextLesson = allLessons[currentIndex + 1];
        const nextProgId = `${studentId}_${nextLesson.id}`;
        const nextProgRef = doc(db, 'progress', nextProgId);
        const nextProgSnap = await getDoc(nextProgRef);

        if (!nextProgSnap.exists() || !nextProgSnap.data().isUnlocked) {
          await setDoc(
            nextProgRef,
            {
              id: nextProgId,
              studentId,
              courseId,
              lessonId: nextLesson.id,
              isUnlocked: true,
              isCompleted: false,
              bestScore: 0,
              attemptsCount: 0,
            },
            { merge: true }
          );
        }
        nextUnlockedLessonId = nextLesson.id;
      } else if (currentIndex === allLessons.length - 1) {
        isCourseCompleted = true;
      }

      // Update enrollment completed lessons count
      const allProgress = await getStudentCourseProgress(studentId, courseId);
      const completedCount = Object.values(allProgress).filter((p) => p.isCompleted).length;
      const enrollRef = doc(db, 'enrollments', `${studentId}_${courseId}`);
      await updateDoc(enrollRef, {
        completedLessonsCount: completedCount,
        status: isCourseCompleted ? 'completed' : 'active',
        lastAccessedAt: new Date().toISOString(),
      });
    }

    return { nextUnlockedLessonId, isCourseCompleted };
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `progress/${studentId}_${lessonId}`);
  }
}

/* ================= ASSESSMENT ATTEMPTS ================= */

export async function submitAssessmentAttempt(
  data: Omit<AssessmentAttempt, 'id' | 'submittedAt'>
): Promise<string> {
  try {
    const attemptRef = doc(collection(db, 'assessmentAttempts'));
    const isTeacherEvaluated = data.evaluator === 'teacher';
    const newAttempt: AssessmentAttempt = {
      ...data,
      id: attemptRef.id,
      status: data.status || (isTeacherEvaluated ? 'submitted' : 'graded'),
      submittedAt: new Date().toISOString(),
    };
    await setDoc(attemptRef, newAttempt);
    return attemptRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, 'assessmentAttempts');
  }
}

export async function getStudentAssessmentAttempts(
  studentId: string,
  courseId?: string
): Promise<AssessmentAttempt[]> {
  try {
    const attemptsRef = collection(db, 'assessmentAttempts');
    const q = courseId
      ? query(attemptsRef, where('studentId', '==', studentId), where('courseId', '==', courseId))
      : query(attemptsRef, where('studentId', '==', studentId));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as AssessmentAttempt));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'assessmentAttempts');
  }
}

export async function getCourseSubmissionsForTeacher(courseId: string): Promise<AssessmentAttempt[]> {
  try {
    const attemptsRef = collection(db, 'assessmentAttempts');
    const q = query(attemptsRef, where('courseId', '==', courseId));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as AssessmentAttempt));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'assessmentAttempts');
  }
}

export async function gradeAssessmentAttempt(
  attemptId: string,
  score: number,
  feedback: string,
  teacherId: string,
  teacherName: string,
  masteryThreshold: number = 75
): Promise<void> {
  try {
    const attemptRef = doc(db, 'assessmentAttempts', attemptId);
    const snap = await getDoc(attemptRef);
    if (!snap.exists()) {
      throw new Error('Assessment submission not found');
    }
    const currentData = snap.data() as AssessmentAttempt;
    const passed = score >= masteryThreshold;

    const updates: Partial<AssessmentAttempt> = {
      status: 'graded',
      score,
      overallPercentage: score,
      passed,
      feedback: feedback.trim(),
      teacherComments: feedback.trim(),
      gradedBy: teacherId,
      gradedByName: teacherName,
      gradedAt: new Date().toISOString(),
    };

    await updateDoc(attemptRef, updates);

    // Update student lesson progression authoritative state
    if (currentData.studentId && currentData.courseId && currentData.lessonId) {
      try {
        await recordLessonAssessment(
          currentData.studentId,
          currentData.courseId,
          currentData.lessonId,
          score,
          passed
        );
      } catch (progErr) {
        console.warn('Could not automatically record lesson progress for student:', progErr);
      }
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `assessmentAttempts/${attemptId}`);
  }
}

export async function teacherReviewAssessment(
  attemptId: string,
  teacherComments: string
): Promise<void> {
  try {
    const attemptRef = doc(db, 'assessmentAttempts', attemptId);
    await updateDoc(attemptRef, {
      teacherComments,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `assessmentAttempts/${attemptId}`);
  }
}

/* ================= TEACHER APPLICATIONS ================= */

export async function submitTeacherApplication(
  data: Omit<TeacherApplication, 'id' | 'status' | 'submittedAt'>
): Promise<void> {
  try {
    const appRef = doc(db, 'teacherApplications', data.userId);
    const newApp: TeacherApplication = {
      ...data,
      id: data.userId,
      status: 'pending',
      submittedAt: new Date().toISOString(),
    };
    await setDoc(appRef, newApp);
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `teacherApplications/${data.userId}`);
  }
}

export async function getTeacherApplication(userId: string): Promise<TeacherApplication | null> {
  try {
    const appRef = doc(db, 'teacherApplications', userId);
    const snap = await getDoc(appRef);
    if (!snap.exists()) return null;
    return { id: snap.id, ...snap.data() } as TeacherApplication;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, `teacherApplications/${userId}`);
  }
}

export async function getPendingTeacherApplications(): Promise<TeacherApplication[]> {
  try {
    const appsRef = collection(db, 'teacherApplications');
    const q = query(appsRef, where('status', '==', 'pending'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as TeacherApplication));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'teacherApplications');
  }
}

export async function reviewTeacherApplication(
  applicationId: string,
  status: 'approved' | 'rejected',
  adminId: string
): Promise<void> {
  try {
    const appRef = doc(db, 'teacherApplications', applicationId);
    await updateDoc(appRef, {
      status,
      reviewedBy: adminId,
    });

    if (status === 'approved') {
      const userRef = doc(db, 'users', applicationId);
      await updateDoc(userRef, {
        role: 'teacher',
        updatedAt: new Date().toISOString(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `teacherApplications/${applicationId}`);
  }
}

/* ================= DEMO CURRICULUM SEEDING ================= */

export async function seedSampleCourseWithUploading(
  teacherId: string,
  teacherName: string
): Promise<string> {
  try {
    // 1. Create Course
    const courseRef = doc(collection(db, 'courses'));
    const courseId = courseRef.id;
    const newCourse: Course = {
      id: courseId,
      teacherId,
      teacherName: teacherName || 'Prof. Sarah Vance',
      title: 'Professional English & Executive Presentations',
      description:
        'Master formal business discourse, strategic presentations, and professional pitches aligned with CEFR B2 outcomes and Bloom Taxonomy.',
      cefrLevel: 'B2',
      targetAudience: 'Professionals, business leaders, and advanced English learners.',
      learningOutcomes:
        'Deliver structured persuasive presentations, defend quarterly strategy with precision vocabulary, and prepare executive pitch decks.',
      status: 'published',
      masteryThreshold: 75,
      modulesCount: 1,
      lessonsCount: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await setDoc(courseRef, newCourse);

    // 2. Create Module
    const moduleRef = doc(collection(db, 'courses', courseId, 'modules'));
    const moduleId = moduleRef.id;
    await setDoc(moduleRef, {
      id: moduleId,
      courseId,
      title: 'Module 1: Workplace Discourse & Persuasion',
      description: 'Frameworks for high-impact communication and executive decks.',
      orderIndex: 1,
      createdAt: new Date().toISOString(),
    });

    // 3. Create Topic
    const topicRef = doc(collection(db, 'courses', courseId, 'topics'));
    const topicId = topicRef.id;
    await setDoc(topicRef, {
      id: topicId,
      courseId,
      moduleId,
      title: 'Topic 1: Strategic Pitches & Boardroom Speaking',
      description: 'Structuring arguments and responding with clarity.',
      orderIndex: 1,
      createdAt: new Date().toISOString(),
    });

    // 4. Create Lesson
    const lessonRef = doc(collection(db, 'courses', courseId, 'lessons'));
    const lessonId = lessonRef.id;
    await setDoc(lessonRef, {
      id: lessonId,
      courseId,
      moduleId,
      topicId,
      title: 'Delivering Persuasive Business Presentations',
      description: 'Apply the Rule of Three and rhetorical signposting in business presentations.',
      targetSpeakingOutcome:
        'Deliver a confident 3-minute executive pitch using signposting language and supporting presentation slides.',
      cefrLevel: 'B2',
      bloomLevels: ['Create', 'Apply', 'Evaluate'],
      orderIndex: 1,
      requiredMasteryScore: 75,
      explanation:
        'When presenting to executives or clients, begin with a compelling executive summary. Use clear rhetorical signposts: "First and foremost...", "Turning now to the data...", and "To conclude our findings...". Ensure your slides reinforce your speech rather than duplicate verbatim text.',
      vocabularyNotes:
        '• "First and foremost" (discourse marker)\n• "To substantiate this claim..." (evidence introduction)\n• "A pivotal metric in our analysis..." (strategic vocabulary)\n• "Strategic dividend" (business impact)\n• "Moving forward to implementation..." (transition)',
      sampleAnswer:
        'Good morning board members. First and foremost, our second-quarter expansion demonstrates a pivotal metric: customer retention has climbed 18 percent. To substantiate this claim, please refer to slide four in our deck. Turning now to implementation, our projected strategic dividend provides substantial leverage for the upcoming fiscal cycle.',
      createdAt: new Date().toISOString(),
    });

    // 5. Create Activities
    // Activity 1: Uploading Activity
    const actUploadRef = doc(collection(db, 'courses', courseId, 'activities'));
    const actUploadId = actUploadRef.id;
    await setDoc(actUploadRef, {
      id: actUploadId,
      courseId,
      lessonId,
      title: 'Executive Presentation Deck & Recorded Pitch',
      instructions:
        'Select and upload your presentation materials. You may submit your slide deck (PPT, PPTX, or PDF), video presentation (MP4), audio rehearsal (MP3), or supporting financial model (XLS, XLSX). Your instructor will evaluate your submission with rubric-based feedback.',
      bloomLevel: 'Create',
      cefrLevel: 'B2',
      format: 'uploading',
      prompt:
        'Upload your executive presentation deck (PPTX/PDF) or recorded pitch (MP4/MP3) showcasing structured rhetorical signposts and high-impact vocabulary.',
      maxAttempts: 3,
      orderIndex: 1,
      createdAt: new Date().toISOString(),
    });

    // Activity 2: Voice Recording Practice
    const actRecRef = doc(collection(db, 'courses', courseId, 'activities'));
    const actRecId = actRecRef.id;
    await setDoc(actRecRef, {
      id: actRecId,
      courseId,
      lessonId,
      title: 'Executive Summary Spoken Rehearsal',
      instructions: 'Record your 60-second opening statement using at least two key signposts.',
      bloomLevel: 'Apply',
      cefrLevel: 'B2',
      format: 'recording',
      prompt:
        'Speak for 60 seconds delivering your presentation introduction. Incorporate "First and foremost" and "To substantiate this claim...".',
      maxAttempts: 3,
      orderIndex: 2,
      createdAt: new Date().toISOString(),
    });

    // 6. Create attached Teacher Resource in uploads collection
    const uploadRef = doc(collection(db, 'uploads'));
    await setDoc(uploadRef, {
      id: uploadRef.id,
      userId: teacherId,
      userName: teacherName || 'Prof. Sarah Vance',
      userRole: 'teacher',
      courseId,
      lessonId,
      activityId: actUploadId,
      scope: 'teacher_resource',
      title: 'Executive Presentation Framework & Template (PPTX)',
      instructions: 'Download this reference slide framework to format your pitch submission.',
      fileName: 'Executive_Presentation_Framework.pptx',
      fileType: 'presentation',
      fileExtension: 'pptx',
      mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      fileSize: 1024 * 340, // 340 KB
      fileUrl: 'https://storage.googleapis.com/demo/Executive_Presentation_Framework.pptx',
      storagePath: `uploads/${teacherId}/${courseId}/${lessonId}/demo_Executive_Presentation_Framework.pptx`,
      status: 'submitted',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    return courseId;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, 'courses');
  }
}

