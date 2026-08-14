
create type public.user_role as enum ('student','teacher');

create table public.profiles (
  id uuid primary key,
  name text not null,
  role public.user_role not null default 'student',
  created_at timestamptz not null default now()
);
grant select, insert, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;

create table public.courses (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  teacher_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.courses to authenticated;
grant all on public.courses to service_role;
alter table public.courses enable row level security;

create table public.enrollments (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  enrolled_at timestamptz not null default now(),
  unique(student_id, course_id)
);
grant select, insert, update, delete on public.enrollments to authenticated;
grant all on public.enrollments to service_role;
alter table public.enrollments enable row level security;

create or replace function public.is_teacher_of(_course_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.courses c where c.id = _course_id and c.teacher_id = auth.uid())
$$;

create or replace function public.is_enrolled(_course_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.enrollments e where e.course_id = _course_id and e.student_id = auth.uid())
$$;

create or replace function public.shares_course_with(_student_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.enrollments e
    join public.courses c on c.id = e.course_id
    where e.student_id = _student_id and c.teacher_id = auth.uid()
  )
$$;

create table public.lessons (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  title text not null,
  content text,
  file_url text,
  "order" int not null default 1,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.lessons to authenticated;
grant all on public.lessons to service_role;
alter table public.lessons enable row level security;

create table public.assignments (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  title text not null,
  description text,
  due_date timestamptz,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.assignments to authenticated;
grant all on public.assignments to service_role;
alter table public.assignments enable row level security;

create table public.submissions (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.assignments(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  content text,
  file_url text,
  submitted_at timestamptz not null default now(),
  grade numeric,
  feedback text,
  unique(assignment_id, student_id)
);
grant select, insert, update, delete on public.submissions to authenticated;
grant all on public.submissions to service_role;
alter table public.submissions enable row level security;

create table public.quizzes (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  title text not null,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.quizzes to authenticated;
grant all on public.quizzes to service_role;
alter table public.quizzes enable row level security;

create table public.questions (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references public.quizzes(id) on delete cascade,
  text text not null,
  topic_tag text not null,
  options jsonb not null default '[]'::jsonb,
  correct_answer text not null
);
grant select, insert, update, delete on public.questions to authenticated;
grant all on public.questions to service_role;
alter table public.questions enable row level security;

create table public.quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references public.quizzes(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  score numeric not null,
  attempted_at timestamptz not null default now()
);
grant select, insert, update, delete on public.quiz_attempts to authenticated;
grant all on public.quiz_attempts to service_role;
alter table public.quiz_attempts enable row level security;

create table public.question_attempts (
  id uuid primary key default gen_random_uuid(),
  quiz_attempt_id uuid not null references public.quiz_attempts(id) on delete cascade,
  question_id uuid not null references public.questions(id) on delete cascade,
  is_correct boolean not null
);
grant select, insert, update, delete on public.question_attempts to authenticated;
grant all on public.question_attempts to service_role;
alter table public.question_attempts enable row level security;

create table public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  course_id uuid references public.courses(id) on delete cascade,
  action text not null,
  timestamp timestamptz not null default now()
);
grant select, insert on public.activity_logs to authenticated;
grant all on public.activity_logs to service_role;
alter table public.activity_logs enable row level security;

create table public.topic_mastery (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  topic_tag text not null,
  mastery_pct numeric not null default 0,
  updated_at timestamptz not null default now(),
  unique(student_id, course_id, topic_tag)
);
grant select, insert, update, delete on public.topic_mastery to authenticated;
grant all on public.topic_mastery to service_role;
alter table public.topic_mastery enable row level security;

create table public.risk_alerts (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  reason text not null,
  level text not null default 'medium',
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.risk_alerts to authenticated;
grant all on public.risk_alerts to service_role;
alter table public.risk_alerts enable row level security;

create table public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  role text not null,
  content text not null,
  created_at timestamptz not null default now()
);
grant select, insert, delete on public.chat_messages to authenticated;
grant all on public.chat_messages to service_role;
alter table public.chat_messages enable row level security;

-- Policies
create policy "own profile read" on public.profiles for select to authenticated
  using (id = auth.uid() or public.shares_course_with(id));
create policy "own profile write" on public.profiles for insert to authenticated with check (id = auth.uid());
create policy "own profile update" on public.profiles for update to authenticated using (id = auth.uid());

create policy "courses read" on public.courses for select to authenticated
  using (teacher_id = auth.uid() or public.is_enrolled(id) or true);
create policy "courses insert" on public.courses for insert to authenticated with check (teacher_id = auth.uid());
create policy "courses update" on public.courses for update to authenticated using (teacher_id = auth.uid());
create policy "courses delete" on public.courses for delete to authenticated using (teacher_id = auth.uid());

create policy "enrollments read" on public.enrollments for select to authenticated
  using (student_id = auth.uid() or public.is_teacher_of(course_id));
create policy "enrollments insert" on public.enrollments for insert to authenticated
  with check (student_id = auth.uid() or public.is_teacher_of(course_id));
create policy "enrollments delete" on public.enrollments for delete to authenticated
  using (student_id = auth.uid() or public.is_teacher_of(course_id));

create policy "lessons read" on public.lessons for select to authenticated
  using (public.is_enrolled(course_id) or public.is_teacher_of(course_id));
create policy "lessons write" on public.lessons for all to authenticated
  using (public.is_teacher_of(course_id)) with check (public.is_teacher_of(course_id));

create policy "assignments read" on public.assignments for select to authenticated
  using (public.is_enrolled(course_id) or public.is_teacher_of(course_id));
create policy "assignments write" on public.assignments for all to authenticated
  using (public.is_teacher_of(course_id)) with check (public.is_teacher_of(course_id));

create policy "submissions read" on public.submissions for select to authenticated
  using (student_id = auth.uid() or exists (
    select 1 from public.assignments a where a.id = assignment_id and public.is_teacher_of(a.course_id)));
create policy "submissions insert" on public.submissions for insert to authenticated
  with check (student_id = auth.uid());
create policy "submissions update" on public.submissions for update to authenticated
  using (student_id = auth.uid() or exists (
    select 1 from public.assignments a where a.id = assignment_id and public.is_teacher_of(a.course_id)));

create policy "quizzes read" on public.quizzes for select to authenticated
  using (public.is_enrolled(course_id) or public.is_teacher_of(course_id));
create policy "quizzes write" on public.quizzes for all to authenticated
  using (public.is_teacher_of(course_id)) with check (public.is_teacher_of(course_id));

create policy "questions read" on public.questions for select to authenticated
  using (exists (select 1 from public.quizzes q where q.id = quiz_id
    and (public.is_enrolled(q.course_id) or public.is_teacher_of(q.course_id))));
create policy "questions write" on public.questions for all to authenticated
  using (exists (select 1 from public.quizzes q where q.id = quiz_id and public.is_teacher_of(q.course_id)))
  with check (exists (select 1 from public.quizzes q where q.id = quiz_id and public.is_teacher_of(q.course_id)));

create policy "quiz attempts read" on public.quiz_attempts for select to authenticated
  using (exists (select 1 from public.quizzes q where q.id = quiz_id
    and (public.is_enrolled(q.course_id) or public.is_teacher_of(q.course_id))));
create policy "quiz attempts insert" on public.quiz_attempts for insert to authenticated
  with check (student_id = auth.uid());

create policy "question attempts read" on public.question_attempts for select to authenticated
  using (exists (select 1 from public.quiz_attempts qa join public.quizzes q on q.id = qa.quiz_id
    where qa.id = quiz_attempt_id and (qa.student_id = auth.uid() or public.is_teacher_of(q.course_id))));
create policy "question attempts insert" on public.question_attempts for insert to authenticated
  with check (exists (select 1 from public.quiz_attempts qa where qa.id = quiz_attempt_id and qa.student_id = auth.uid()));

create policy "activity read" on public.activity_logs for select to authenticated
  using (student_id = auth.uid() or public.is_teacher_of(course_id));
create policy "activity insert" on public.activity_logs for insert to authenticated
  with check (student_id = auth.uid());

create policy "mastery read" on public.topic_mastery for select to authenticated
  using (student_id = auth.uid() or public.is_teacher_of(course_id));
create policy "mastery write" on public.topic_mastery for all to authenticated
  using (student_id = auth.uid()) with check (student_id = auth.uid());

create policy "risk read" on public.risk_alerts for select to authenticated
  using (student_id = auth.uid() or public.is_teacher_of(course_id));
create policy "risk write" on public.risk_alerts for all to authenticated
  using (public.is_teacher_of(course_id)) with check (public.is_teacher_of(course_id));

create policy "chat own" on public.chat_messages for all to authenticated
  using (student_id = auth.uid()) with check (student_id = auth.uid());

create index on public.quiz_attempts (student_id, attempted_at);
create index on public.question_attempts (quiz_attempt_id);
create index on public.activity_logs (student_id, timestamp);
