-- 1) Remove the "OR true" bypass on courses read
DROP POLICY IF EXISTS "courses read" ON public.courses;
CREATE POLICY "courses read" ON public.courses
FOR SELECT TO authenticated
USING ((teacher_id = auth.uid()) OR public.is_enrolled(id));

-- 2) Submissions delete policy
DROP POLICY IF EXISTS "submissions delete" ON public.submissions;
CREATE POLICY "submissions delete" ON public.submissions
FOR DELETE TO authenticated
USING (
  (student_id = auth.uid() AND grade IS NULL)
  OR EXISTS (
    SELECT 1 FROM public.assignments a
    WHERE a.id = submissions.assignment_id AND public.is_teacher_of(a.course_id)
  )
);

-- 3) Harden shares_course_with: only teachers can use it, and only for their own students
CREATE OR REPLACE FUNCTION public.shares_course_with(_student_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  select exists (
    select 1
    from public.enrollments e
    join public.courses c on c.id = e.course_id
    where e.student_id = _student_id
      and c.teacher_id = auth.uid()
      and _student_id <> auth.uid()
      and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'teacher')
  )
$$;

-- 4) Restrict EXECUTE on SECURITY DEFINER functions to signed-in users only
REVOKE ALL ON FUNCTION public.is_enrolled(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_teacher_of(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.shares_course_with(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.bootstrap_demo(text, public.user_role) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.is_enrolled(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_teacher_of(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.shares_course_with(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.bootstrap_demo(text, public.user_role) TO authenticated;