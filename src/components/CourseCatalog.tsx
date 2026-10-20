import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Course, CEFRLevel, Enrollment } from '../types';
import { getPublishedCourses, getStudentEnrollments, enrollStudentInCourse } from '../services/courseService';
import { Search, BookOpen, Check, ArrowRight, Layers, Award } from 'lucide-react';

interface CourseCatalogProps {
  onSelectCourse: (course: Course) => void;
}

const CEFR_LEVELS: (CEFRLevel | 'ALL')[] = ['ALL', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

export const CourseCatalog: React.FC<CourseCatalogProps> = ({ onSelectCourse }) => {
  const { currentUser } = useAuth();
  const [courses, setCourses] = useState<Course[]>([]);
  const [enrollments, setEnrollments] = useState<Record<string, Enrollment>>({});
  const [selectedCefr, setSelectedCefr] = useState<CEFRLevel | 'ALL'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [enrollingId, setEnrollingId] = useState<string | null>(null);

  useEffect(() => {
    loadCatalog();
  }, [currentUser]);

  const loadCatalog = async () => {
    setLoading(true);
    try {
      const allPublished = await getPublishedCourses();
      setCourses(allPublished);

      if (currentUser) {
        const myEnrollments = await getStudentEnrollments(currentUser.uid);
        const map: Record<string, Enrollment> = {};
        myEnrollments.forEach((e) => {
          map[e.courseId] = e;
        });
        setEnrollments(map);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleEnroll = async (course: Course) => {
    if (!currentUser) return;
    try {
      setEnrollingId(course.id);
      await enrollStudentInCourse(currentUser.uid, course.id);
      await loadCatalog();
      onSelectCourse(course);
    } catch (err) {
      console.error(err);
    } finally {
      setEnrollingId(null);
    }
  };

  const filteredCourses = courses.filter((c) => {
    const matchesCefr = selectedCefr === 'ALL' || c.cefrLevel === selectedCefr;
    const matchesSearch =
      c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCefr && matchesSearch;
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header & Search */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#16151E]">
            Course Catalog
          </h1>
          <p className="text-sm text-[#5B586B] mt-1">
            Structured English-speaking courses organized by CEFR levels and Bloom's Taxonomy.
          </p>
        </div>

        {/* Search Bar */}
        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 text-[#8C899C] absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search courses..."
            className="w-full pl-10 pr-4 py-2 rounded-xl border border-[#DEDCE8] bg-white text-xs sm:text-sm focus:outline-none focus:border-[#6546D7] focus:ring-1 focus:ring-[#6546D7]"
          />
        </div>
      </div>

      {/* CEFR Level Filter Chips */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
        {CEFR_LEVELS.map((level) => (
          <button
            key={level}
            onClick={() => setSelectedCefr(level)}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
              selectedCefr === level
                ? 'bg-[#6546D7] text-white shadow-xs'
                : 'bg-white text-[#5F5C6E] hover:bg-[#F2EFFC] border border-[#ECEAF2]'
            }`}
          >
            {level === 'ALL' ? 'All Levels' : `CEFR ${level}`}
          </button>
        ))}
      </div>

      {/* Course Grid */}
      {loading ? (
        <div className="py-16 flex justify-center">
          <div className="w-6 h-6 border-2 border-[#6546D7] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filteredCourses.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center border border-dashed border-[#DDD9E8] space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-[#F4F3F9] text-[#6546D7] flex items-center justify-center mx-auto">
            <BookOpen className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-[#16151E]">No courses found</h3>
          <p className="text-xs text-[#716D80] max-w-sm mx-auto leading-relaxed">
            {courses.length === 0
              ? 'No courses have been published yet by teachers. If you are an instructor or administrator, use the Teaching dashboard to publish the first course!'
              : 'No courses match your selected CEFR level or search criteria.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredCourses.map((course) => {
            const isEnrolled = !!enrollments[course.id];
            const isEnrolling = enrollingId === course.id;

            return (
              <div
                key={course.id}
                className="bg-white rounded-3xl p-6 border border-[#ECEAF2] hover:border-[#6546D7]/40 shadow-xs hover:shadow-sm transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <span className="text-xs font-bold uppercase tracking-wider px-2.5 py-1 rounded-lg bg-[#F1EEFB] text-[#6546D7]">
                      CEFR {course.cefrLevel}
                    </span>
                    <span className="text-xs text-[#807D90]">
                      By {course.teacherName}
                    </span>
                  </div>

                  <h3 className="text-base sm:text-lg font-bold text-[#16151E] mb-2 leading-snug">
                    {course.title}
                  </h3>
                  <p className="text-xs text-[#5D5A6C] line-clamp-3 mb-4 leading-relaxed">
                    {course.description}
                  </p>

                  <div className="flex items-center gap-4 text-xs text-[#7A778A] mb-5">
                    <span className="flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5" />
                      <span>{course.modulesCount || 0} Modules</span>
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Award className="w-3.5 h-3.5" />
                      <span>{course.masteryThreshold || 75}% Pass</span>
                    </span>
                  </div>
                </div>

                {/* Card Action */}
                <div className="pt-4 border-t border-[#F2EFF7]">
                  {isEnrolled ? (
                    <button
                      onClick={() => onSelectCourse(course)}
                      className="w-full py-2.5 rounded-xl bg-[#FAF9FD] hover:bg-[#F2EFFC] text-[#6546D7] border border-[#6546D7]/20 text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
                    >
                      <Check className="w-4 h-4" />
                      <span>Enrolled • Continue</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => handleEnroll(course)}
                      disabled={isEnrolling}
                      className="w-full py-2.5 rounded-xl bg-[#6546D7] hover:bg-[#5235BF] disabled:opacity-60 text-white text-xs font-semibold flex items-center justify-center gap-2 shadow-xs transition-all cursor-pointer"
                    >
                      {isEnrolling ? (
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <>
                          <span>Enroll in Course</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
