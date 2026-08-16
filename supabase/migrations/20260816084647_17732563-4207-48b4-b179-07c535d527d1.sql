ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS visible boolean NOT NULL DEFAULT true;
ALTER TABLE public.quizzes ADD COLUMN IF NOT EXISTS visible boolean NOT NULL DEFAULT true;
ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS visible boolean NOT NULL DEFAULT true;

DROP POLICY IF EXISTS "courses browse open" ON public.courses;
CREATE POLICY "courses browse open" ON public.courses
  FOR SELECT TO authenticated
  USING (visible = true);

CREATE OR REPLACE FUNCTION public.search_students(_q text)
RETURNS TABLE (id uuid, name text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.name
  FROM public.profiles p
  WHERE p.role = 'student'
    AND (coalesce(_q, '') = '' OR p.name ILIKE '%' || _q || '%')
    AND EXISTS (SELECT 1 FROM public.profiles me WHERE me.id = auth.uid() AND me.role = 'teacher')
  ORDER BY p.name
  LIMIT 50
$$;

REVOKE ALL ON FUNCTION public.search_students(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.search_students(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.teacher_add_student(_course_id uuid, _student_id uuid, _new_name text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  sid uuid;
BEGIN
  IF NOT public.is_teacher_of(_course_id) THEN
    RAISE EXCEPTION 'not allowed';
  END IF;

  IF _student_id IS NOT NULL THEN
    sid := _student_id;
    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = sid AND role = 'student') THEN
      RAISE EXCEPTION 'student not found';
    END IF;
  ELSE
    IF coalesce(trim(_new_name), '') = '' THEN
      RAISE EXCEPTION 'name required';
    END IF;
    sid := gen_random_uuid();
    INSERT INTO public.profiles (id, name, role) VALUES (sid, trim(_new_name), 'student');
  END IF;

  INSERT INTO public.enrollments (student_id, course_id)
  VALUES (sid, _course_id)
  ON CONFLICT DO NOTHING;

  RETURN sid;
END;
$$;

REVOKE ALL ON FUNCTION public.teacher_add_student(uuid, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.teacher_add_student(uuid, uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.recompute_risk_alerts()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  n integer;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;

  DELETE FROM public.risk_alerts ra
  USING public.courses c
  WHERE ra.course_id = c.id AND c.teacher_id = uid;

  INSERT INTO public.risk_alerts (student_id, course_id, reason, level)
  SELECT e.student_id, e.course_id,
         CASE WHEN max(al.timestamp) IS NULL THEN 'Chưa có hoạt động nào được ghi nhận'
              ELSE 'Không có hoạt động trong ' || extract(day from now() - max(al.timestamp))::int || ' ngày' END,
         CASE WHEN max(al.timestamp) IS NULL OR now() - max(al.timestamp) > interval '45 days' THEN 'high' ELSE 'medium' END
  FROM public.enrollments e
  JOIN public.courses c ON c.id = e.course_id AND c.teacher_id = uid
  LEFT JOIN public.activity_logs al ON al.student_id = e.student_id AND al.course_id = e.course_id
  GROUP BY e.student_id, e.course_id
  HAVING max(al.timestamp) IS NULL OR now() - max(al.timestamp) > interval '21 days';

  INSERT INTO public.risk_alerts (student_id, course_id, reason, level)
  SELECT student_id, course_id,
         'Điểm quiz giảm liên tiếp (' || first_score || ' → ' || last_score || ')',
         CASE WHEN first_score - last_score >= 3 THEN 'high' ELSE 'medium' END
  FROM (
    SELECT qa.student_id, q.course_id,
           (array_agg(qa.score ORDER BY qa.attempted_at))[1] AS first_score,
           (array_agg(qa.score ORDER BY qa.attempted_at DESC))[1] AS last_score,
           count(*) AS cnt
    FROM public.quiz_attempts qa
    JOIN public.quizzes q ON q.id = qa.quiz_id
    JOIN public.courses c ON c.id = q.course_id AND c.teacher_id = uid
    GROUP BY qa.student_id, q.course_id
  ) t
  WHERE cnt >= 3 AND first_score - last_score >= 1.5;

  INSERT INTO public.risk_alerts (student_id, course_id, reason, level)
  SELECT qa.student_id, q.course_id,
         'Điểm trung bình thấp (' || round(avg(qa.score), 1) || '/10)',
         CASE WHEN avg(qa.score) < 4 THEN 'high' ELSE 'medium' END
  FROM public.quiz_attempts qa
  JOIN public.quizzes q ON q.id = qa.quiz_id
  JOIN public.courses c ON c.id = q.course_id AND c.teacher_id = uid
  GROUP BY qa.student_id, q.course_id
  HAVING avg(qa.score) < 5;

  SELECT count(*) INTO n
  FROM public.risk_alerts ra
  JOIN public.courses c ON c.id = ra.course_id
  WHERE c.teacher_id = uid;

  RETURN n;
END;
$$;

REVOKE ALL ON FUNCTION public.recompute_risk_alerts() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.recompute_risk_alerts() TO authenticated;