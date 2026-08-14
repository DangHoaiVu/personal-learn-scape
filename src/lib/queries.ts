import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type CourseRow = { id: string; title: string; description: string | null };

async function currentUserId() {
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

/** Khóa học sinh viên đang học */
export function useMyCourses() {
  return useQuery({
    queryKey: ["my-courses"],
    queryFn: async (): Promise<CourseRow[]> => {
      const uid = await currentUserId();
      if (!uid) return [];
      const { data, error } = await supabase
        .from("enrollments")
        .select("course:courses(id,title,description)")
        .eq("student_id", uid);
      if (error) throw error;
      return (data ?? [])
        .map((r) => (r as { course: CourseRow | null }).course)
        .filter((c): c is CourseRow => Boolean(c));
    },
  });
}

export type AttemptRow = {
  id: string;
  score: number;
  attempted_at: string;
  student_id: string;
  quiz: { id: string; title: string; course_id: string } | null;
};

/** Toàn bộ lượt làm quiz mà người dùng được phép đọc (mình + lớp / khóa mình dạy) */
export function useAttempts(courseIds: string[] | undefined) {
  return useQuery({
    queryKey: ["attempts", courseIds],
    enabled: Boolean(courseIds && courseIds.length),
    queryFn: async (): Promise<AttemptRow[]> => {
      const { data, error } = await supabase
        .from("quiz_attempts")
        .select("id,score,attempted_at,student_id,quiz:quizzes(id,title,course_id)")
        .order("attempted_at", { ascending: true });
      if (error) throw error;
      return ((data ?? []) as unknown as AttemptRow[]).filter(
        (a) => a.quiz && courseIds!.includes(a.quiz.course_id),
      );
    },
  });
}

export type TopicStat = { course_id: string; topic_tag: string; correct: number; total: number };

/** Tỉ lệ đúng theo chủ đề, tính từ question_attempts thật */
export function useTopicStats(studentId?: string | null) {
  return useQuery({
    queryKey: ["topic-stats", studentId ?? "me"],
    queryFn: async (): Promise<TopicStat[]> => {
      const uid = studentId ?? (await currentUserId());
      if (!uid) return [];
      const { data, error } = await supabase
        .from("question_attempts")
        .select(
          "is_correct,question:questions(topic_tag,quiz:quizzes(course_id)),attempt:quiz_attempts!inner(student_id)",
        )
        .eq("attempt.student_id", uid);
      if (error) throw error;
      const map = new Map<string, TopicStat>();
      for (const row of (data ?? []) as unknown as {
        is_correct: boolean;
        question: { topic_tag: string; quiz: { course_id: string } | null } | null;
      }[]) {
        if (!row.question?.quiz) continue;
        const key = `${row.question.quiz.course_id}::${row.question.topic_tag}`;
        const cur =
          map.get(key) ??
          { course_id: row.question.quiz.course_id, topic_tag: row.question.topic_tag, correct: 0, total: 0 };
        cur.total += 1;
        if (row.is_correct) cur.correct += 1;
        map.set(key, cur);
      }
      return [...map.values()];
    },
  });
}

/** Nhật ký hoạt động (heatmap) */
export function useActivityLogs(courseIds?: string[]) {
  return useQuery({
    queryKey: ["activity", courseIds],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("activity_logs")
        .select("student_id,course_id,action,timestamp")
        .order("timestamp", { ascending: false })
        .limit(5000);
      if (error) throw error;
      const rows = (data ?? []) as {
        student_id: string;
        course_id: string | null;
        action: string;
        timestamp: string;
      }[];
      return courseIds?.length ? rows.filter((r) => r.course_id && courseIds.includes(r.course_id)) : rows;
    },
  });
}

/** Khóa học do giáo viên phụ trách */
export function useTeachingCourses() {
  return useQuery({
    queryKey: ["teaching-courses"],
    queryFn: async (): Promise<CourseRow[]> => {
      const uid = await currentUserId();
      if (!uid) return [];
      const { data, error } = await supabase
        .from("courses")
        .select("id,title,description")
        .eq("teacher_id", uid)
        .order("created_at");
      if (error) throw error;
      return (data ?? []) as CourseRow[];
    },
  });
}

export function useRiskAlerts() {
  return useQuery({
    queryKey: ["risk-alerts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("risk_alerts")
        .select("id,reason,level,created_at,course_id,student:profiles(id,name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as {
        id: string;
        reason: string;
        level: string;
        created_at: string;
        course_id: string;
        student: { id: string; name: string } | null;
      }[];
    },
  });
}

export function useQuestionAnalytics(courseIds: string[] | undefined) {
  return useQuery({
    queryKey: ["question-analytics", courseIds],
    enabled: Boolean(courseIds && courseIds.length),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("question_attempts")
        .select("is_correct,question:questions(id,text,topic_tag,quiz:quizzes(id,title,course_id))")
        .limit(20000);
      if (error) throw error;
      const rows = (data ?? []) as unknown as {
        is_correct: boolean;
        question: {
          id: string;
          text: string;
          topic_tag: string;
          quiz: { id: string; title: string; course_id: string } | null;
        } | null;
      }[];
      const map = new Map<
        string,
        { id: string; text: string; topic: string; quiz: string; courseId: string; wrong: number; total: number }
      >();
      for (const r of rows) {
        const q = r.question;
        if (!q?.quiz || !courseIds!.includes(q.quiz.course_id)) continue;
        const cur =
          map.get(q.id) ??
          { id: q.id, text: q.text, topic: q.topic_tag, quiz: q.quiz.title, courseId: q.quiz.course_id, wrong: 0, total: 0 };
        cur.total += 1;
        if (!r.is_correct) cur.wrong += 1;
        map.set(q.id, cur);
      }
      return [...map.values()];
    },
  });
}
