CREATE POLICY "submission files insert own" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'submissions' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "submission files read own" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'submissions' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "submission files delete own" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'submissions' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "submission files teacher read" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'submissions'
    AND EXISTS (
      SELECT 1
      FROM public.submissions s
      JOIN public.assignments a ON a.id = s.assignment_id
      WHERE s.file_url = storage.objects.name
        AND public.is_teacher_of(a.course_id)
    )
  );