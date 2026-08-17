DROP POLICY IF EXISTS "courses browse open" ON public.courses;

CREATE OR REPLACE FUNCTION public.browse_open_courses(_q text DEFAULT '')
RETURNS TABLE(id uuid, title text, description text, teacher_name text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.id, c.title, c.description, p.name
  FROM public.courses c
  LEFT JOIN public.profiles p ON p.id = c.teacher_id
  WHERE c.visible = true
    AND EXISTS (SELECT 1 FROM public.profiles me WHERE me.id = auth.uid() AND me.role = 'student')
    AND (coalesce(_q, '') = '' OR c.title ILIKE '%' || _q || '%')
  ORDER BY c.created_at
  LIMIT 100
$$;

REVOKE ALL ON FUNCTION public.browse_open_courses(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.browse_open_courses(text) TO authenticated;