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
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
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

export async function deleteCourse(courseId: string): Promise<void> {
  try {
    const courseRef = doc(db, 'courses', courseId);
    await deleteDoc(courseRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `courses/${courseId}`);
  }
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
    const newAttempt: AssessmentAttempt = {
      ...data,
      id: attemptRef.id,
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
