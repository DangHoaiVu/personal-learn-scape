
revoke execute on function public.is_teacher_of(uuid) from public, anon;
revoke execute on function public.is_enrolled(uuid) from public, anon;
revoke execute on function public.shares_course_with(uuid) from public, anon;
grant execute on function public.is_teacher_of(uuid) to authenticated;
grant execute on function public.is_enrolled(uuid) to authenticated;
grant execute on function public.shares_course_with(uuid) to authenticated;
