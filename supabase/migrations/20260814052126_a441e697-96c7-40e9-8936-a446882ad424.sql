
create or replace function public.bootstrap_demo(_name text, _role public.user_role)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  teacher uuid;
  titles text[] := array['Lập trình Web','Cơ sở dữ liệu','Cấu trúc dữ liệu & Giải thuật','Nhập môn Trí tuệ nhân tạo'];
  descs text[] := array[
    'HTML, CSS, JavaScript và React cho ứng dụng web hiện đại.',
    'Thiết kế mô hình quan hệ, truy vấn SQL và tối ưu hoá.',
    'Các cấu trúc dữ liệu nền tảng và kỹ thuật thiết kế giải thuật.',
    'Tìm kiếm, học máy có giám sát và đánh giá mô hình.'];
  topicstr text[] := array[
    'HTML & CSS,JavaScript,React,API & Fetch,Bảo mật web',
    'Mô hình ER,SQL cơ bản,Phép JOIN,Chuẩn hoá,Chỉ mục',
    'Mảng & chuỗi,Danh sách liên kết,Cây,Đồ thị,Sắp xếp,Quy hoạch động',
    'Tìm kiếm,Học có giám sát,Mạng nơ-ron,Đánh giá mô hình'];
  snames text[] := array['Nguyễn Minh Anh','Trần Bảo Long','Lê Thu Hà','Phạm Quốc Huy','Vũ Ngọc Mai','Đặng Hải Nam','Bùi Thanh Tùng','Hoàng Diệu Linh','Đỗ Gia Bảo','Ngô Phương Thảo','Lý Đức Trung','Trịnh Khánh Vy','Cao Minh Khôi','Dương Thuỳ Dung','Phan Anh Tuấn','Mai Hồng Nhung','Tạ Việt Hưng','Chu Bích Ngọc'];
  students uuid[] := '{}';
  ability numeric[] := '{}';
  weakidx int[] := '{}';
  cid uuid; qid uuid; aid uuid; sid uuid;
  topics text[];
  ci int; li int; qi int; k int; i int; w int;
  qcreated timestamptz;
  correct_cnt int; ok boolean; p numeric; att uuid;
  qrow record; opts jsonb; corr text; letters text[] := array['A','B','C','D'];
  logs int; wk int; d int; h int;
begin
  if uid is null then raise exception 'not authenticated'; end if;

  insert into public.profiles (id, name, role) values (uid, coalesce(_name,'Người dùng'), _role)
  on conflict (id) do update set name = excluded.name, role = excluded.role;

  if exists (select 1 from public.courses where teacher_id = uid)
     or exists (select 1 from public.enrollments where student_id = uid) then
    return;
  end if;

  if _role = 'teacher' then
    teacher := uid;
  else
    teacher := gen_random_uuid();
    insert into public.profiles (id, name, role) values (teacher, 'TS. Nguyễn Văn Bình', 'teacher');
  end if;

  -- cohort
  for i in 1..array_length(snames,1) loop
    sid := gen_random_uuid();
    insert into public.profiles (id, name, role) values (sid, snames[i], 'student');
    students := students || sid;
    ability := ability || (0.40 + (i % 6) * 0.09)::numeric;
    weakidx := weakidx || (1 + (i * 3) % 5);
  end loop;
  if _role = 'student' then
    students := students || uid;
    ability := ability || 0.68::numeric;
    weakidx := weakidx || 2;
  end if;

  for ci in 1..array_length(titles,1) loop
    insert into public.courses (title, description, teacher_id)
      values (titles[ci], descs[ci], teacher) returning id into cid;
    topics := string_to_array(topicstr[ci], ',');

    for li in 1..5 loop
      insert into public.lessons (course_id, title, content, "order")
      values (cid, 'Bài ' || li || ': ' || topics[1 + (li-1) % array_length(topics,1)],
              'Nội dung bài giảng về ' || topics[1 + (li-1) % array_length(topics,1)] || '. Bao gồm lý thuyết, ví dụ minh hoạ và bài tập tự luyện.', li);
    end loop;

    for li in 1..2 loop
      insert into public.assignments (course_id, title, description, due_date)
      values (cid, 'Bài tập lớn ' || li || ' - ' || titles[ci],
              'Vận dụng kiến thức chủ đề ' || topics[li] || ' để hoàn thành sản phẩm.',
              now() + (li * 10 || ' days')::interval);
    end loop;

    -- enrollments
    for i in 1..array_length(students,1) loop
      if ci = 4 and i % 5 = 0 then continue; end if;
      insert into public.enrollments (student_id, course_id) values (students[i], cid)
      on conflict do nothing;
    end loop;

    for qi in 1..4 loop
      qcreated := now() - ((5 - qi) * 30 || ' days')::interval;
      insert into public.quizzes (course_id, title, created_at)
      values (cid, 'Kiểm tra ' || qi || ' - ' || titles[ci], qcreated) returning id into qid;

      for k in 1..8 loop
        corr := letters[1 + floor(random()*4)::int];
        opts := jsonb_build_array(
          jsonb_build_object('key','A','text','Phương án A'),
          jsonb_build_object('key','B','text','Phương án B'),
          jsonb_build_object('key','C','text','Phương án C'),
          jsonb_build_object('key','D','text','Phương án D'));
        insert into public.questions (quiz_id, text, topic_tag, options, correct_answer)
        values (qid, 'Câu ' || k || ': Nhận định nào đúng về ' || topics[1 + (k-1) % array_length(topics,1)] || '?',
                topics[1 + (k-1) % array_length(topics,1)], opts, corr);
      end loop;

      -- attempts
      for i in 1..array_length(students,1) loop
        if ci = 4 and i % 5 = 0 then continue; end if;
        if i % 6 = 0 and qi > 2 then continue; -- sinh viên ngừng hoạt động
        end if;
        insert into public.quiz_attempts (quiz_id, student_id, score, attempted_at)
          values (qid, students[i], 0, qcreated + ((random()*5)::int || ' days')::interval)
          returning id into att;
        correct_cnt := 0;
        for qrow in select id, topic_tag from public.questions where quiz_id = qid loop
          p := ability[i];
          w := weakidx[i];
          if qrow.topic_tag = topics[1 + (w-1) % array_length(topics,1)] then
            p := p - 0.28 - (qi * 0.04);            -- yếu dần một chủ đề
          end if;
          if i % 4 = 0 then p := p - (qi - 1) * 0.07; end if;  -- xu hướng giảm
          if i % 7 = 0 then p := p + (qi - 1) * 0.05; end if;  -- xu hướng tăng
          p := greatest(0.05, least(0.97, p));
          ok := random() < p;
          if ok then correct_cnt := correct_cnt + 1; end if;
          insert into public.question_attempts (quiz_attempt_id, question_id, is_correct)
            values (att, qrow.id, ok);
        end loop;
        update public.quiz_attempts set score = round(correct_cnt * 10.0 / 8.0, 2) where id = att;
      end loop;
    end loop;

    -- activity logs
    for i in 1..array_length(students,1) loop
      if ci = 4 and i % 5 = 0 then continue; end if;
      for wk in 0..17 loop
        if i % 6 = 0 and wk > 8 then continue; end if;
        logs := 2 + floor(random() * (case when ability[i] > 0.7 then 8 else 4 end))::int;
        for k in 1..logs loop
          d := floor(random()*7)::int;
          h := (case when random() < 0.6 then 18 + floor(random()*5)::int else 8 + floor(random()*9)::int end);
          insert into public.activity_logs (student_id, course_id, action, timestamp)
          values (students[i], cid,
            (array['view_lesson','login','submit_assignment','take_quiz'])[1+floor(random()*4)::int],
            date_trunc('week', now()) - ((17 - wk) * 7 || ' days')::interval + (d || ' days')::interval + (h || ' hours')::interval);
        end loop;
      end loop;
    end loop;

    -- submissions
    for aid in select id from public.assignments where course_id = cid loop
      for i in 1..array_length(students,1) loop
        if ci = 4 and i % 5 = 0 then continue; end if;
        if random() < 0.8 then
          insert into public.submissions (assignment_id, student_id, content, submitted_at, grade, feedback)
          values (aid, students[i], 'Bài làm nộp qua hệ thống.', now() - ((random()*20)::int || ' days')::interval,
                  case when random() < 0.85 then round((4 + ability[i]*6 + random())::numeric, 1) else null end,
                  case when random() < 0.5 then 'Trình bày tốt, cần bổ sung phần phân tích.' else null end)
          on conflict do nothing;
        end if;
      end loop;
    end loop;
  end loop;

  -- topic mastery
  insert into public.topic_mastery (student_id, course_id, topic_tag, mastery_pct)
  select qa.student_id, q.course_id, qs.topic_tag,
         round(100.0 * sum(case when ja.is_correct then 1 else 0 end) / count(*), 1)
  from public.question_attempts ja
  join public.quiz_attempts qa on qa.id = ja.quiz_attempt_id
  join public.questions qs on qs.id = ja.question_id
  join public.quizzes q on q.id = qa.quiz_id
  where q.course_id in (select id from public.courses where teacher_id = teacher)
  group by qa.student_id, q.course_id, qs.topic_tag
  on conflict (student_id, course_id, topic_tag) do update set mastery_pct = excluded.mastery_pct, updated_at = now();

  -- risk alerts: không hoạt động lâu ngày
  insert into public.risk_alerts (student_id, course_id, reason, level)
  select e.student_id, e.course_id,
         'Không có hoạt động trong ' || extract(day from now() - max(al.timestamp))::int || ' ngày',
         case when now() - max(al.timestamp) > interval '45 days' then 'high' else 'medium' end
  from public.enrollments e
  join public.courses c on c.id = e.course_id and c.teacher_id = teacher
  left join public.activity_logs al on al.student_id = e.student_id and al.course_id = e.course_id
  group by e.student_id, e.course_id
  having max(al.timestamp) is null or now() - max(al.timestamp) > interval '21 days';

  -- risk alerts: điểm giảm liên tiếp
  insert into public.risk_alerts (student_id, course_id, reason, level)
  select student_id, course_id, 'Điểm quiz giảm liên tiếp (' || first_score || ' → ' || last_score || ')',
         case when first_score - last_score >= 3 then 'high' else 'medium' end
  from (
    select qa.student_id, q.course_id,
           (array_agg(qa.score order by qa.attempted_at))[1] as first_score,
           (array_agg(qa.score order by qa.attempted_at desc))[1] as last_score,
           count(*) as n
    from public.quiz_attempts qa
    join public.quizzes q on q.id = qa.quiz_id
    join public.courses c on c.id = q.course_id and c.teacher_id = teacher
    group by qa.student_id, q.course_id
  ) t
  where n >= 3 and first_score - last_score >= 1.5;
end;
$$;

revoke execute on function public.bootstrap_demo(text, public.user_role) from public, anon;
grant execute on function public.bootstrap_demo(text, public.user_role) to authenticated;
