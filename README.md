# Spark Learn AI

PROMPT CHO LOVABLE AI — Hệ thống Cá nhân hóa Học tập trên nền LMS

Hướng dẫn dùng: copy toàn bộ nội dung dưới đây, dán vào ô chat đầu tiên của dự án Lovable. Nếu Lovable giới hạn độ dài, dán theo thứ tự: Phần 1-2-3 trước (khung + database), sau đó Phần 4 (từng nhóm chức năng) ở các lượt tiếp theo trong cùng dự án.

VAI TRÒ CỦA BẠN

Bạn là kỹ sư full-stack xây dựng đồ án tốt nghiệp cho tôi: "Hệ thống Cá nhân hóa Học tập trên nền LMS". Đây không phải một LMS đầy đủ như Moodle — hãy đọc kỹ phần "Nguyên tắc phạm vi" bên dưới trước khi code bất cứ thứ gì.

1. NGUYÊN TẮC PHẠM VI (đọc trước, bắt buộc tuân thủ)

Hệ thống gồm hai phần, không được nhầm lẫn:

CRUD lõi (thật, đơn giản): quản lý khóa học, bài học, bài tập, quiz, nộp bài, chấm điểm. Làm vừa đủ để hệ thống tự vận hành được — không cần phong phú như Moodle thật, không cần thanh toán, không cần đăng ký môn học phức tạp, không cần video conferencing.

Lớp thông minh (đây là trọng tâm, phần "ăn điểm" của đồ án): phân tích dữ liệu học tập thành hồ sơ năng lực, cá nhân hóa gợi ý, cảnh báo sớm, AI tutor, báo cáo/phổ điểm tùy chỉnh — đây là những gì LMS truyền thống KHÔNG có, hãy đầu tư chất lượng nhiều nhất vào phần này.

Nguồn dữ liệu: có 2 loại, không trộn lẫn cách tạo:

Dữ liệu cấu trúc (khóa học, bài học, quiz, user) → CRUD thật qua giao diện.

Dữ liệu hành vi (log truy cập, lịch sử điểm nhiều tháng, tương tác) → sinh bằng seed script mô phỏng, đủ nhiều và đủ đa dạng để các biểu đồ/phân tích có ý nghĩa (không được để trống hoặc chỉ có 2-3 dòng).

2. TECH STACK (bắt buộc, không tự đổi)

Frontend: React + TypeScript + Tailwind CSS + shadcn/ui (đúng stack mặc định của Lovable)

Backend/Database: Supabase (PostgreSQL + Auth + Row Level Security + Storage cho file upload)

Biểu đồ: recharts (histogram phổ điểm, radar chart năng lực, line chart xu hướng)

Icon: lucide-react

Routing: React Router

Auth: Supabase Auth (email/password), phân quyền theo bảng profiles với cột role (student | teacher)

3. THIẾT KẾ GIAO DIỆN — Liquid Glass Design System

Bảng màu (nền tối để hiệu ứng kính khúc xạ rõ)

--color-ink: #0B0F19 — nền gốc

--color-aurora-blue: #4F8EF7, --color-aurora-violet: #8B5CF6, --color-aurora-pink: #EC4899 — dải gradient nền

--color-glass: rgba(255,255,255,0.08) — bề mặt panel kính

--color-text-primary: #F5F7FA

Typography

Display/heading: Inter, weight 600–700, tracking -0.02em

Body: Inter regular

Số liệu (điểm, %, chỉ số): JetBrains Mono — để bảng số liệu thẳng hàng dễ đọc

Hai cấp độ hiệu ứng kính — RẤT QUAN TRỌNG

Glassmorphism nhẹ (dùng cho ĐA SỐ card, danh sách, nội dung): backdrop-blur-xl bg-white/[0.06] border border-white/15 rounded-3xl shadow-2xl, thêm viền sáng trên cùng bằng gradient mờ. Đây là component GlassPanel dùng lại ở khắp nơi.

Liquid Glass thật (CHỈ dùng cho nav bar, modal, nút CTA, panel AI tutor — tối đa 1-2 vùng/màn hình): dùng kỹ thuật SVG feDisplacementMap để tạo khúc xạ viền thật, không chỉ blur phẳng. Lưu ý: hiệu ứng khúc xạ chỉ hiển thị đầy đủ trên Chrome/Edge; Safari/Firefox tự động rớt về bản blur (chấp nhận được, không phải lỗi). Nếu việc dựng SVG filter phức tạp làm chậm tiến độ, ưu tiên làm chắc Glassmorphism nhẹ cho toàn hệ thống trước, chỉ áp Liquid Glass thật cho nav bar khi các phần khác đã ổn định.

Signature element

Các khối gradient mờ (blur-3xl, hình tròn, màu aurora-blue/violet/pink) trôi chậm bằng CSS keyframes, đặt cố định phía sau toàn bộ nội dung ở layout gốc — tạo chiều sâu cho các panel kính phía trước.

Nguyên tắc bắt buộc

Chữ trên nền kính dùng text-slate-200/text-slate-300, không dùng trắng thuần (đỡ chói, tăng dễ đọc).

Responsive đầy đủ xuống mobile.

Tôn trọng prefers-reduced-motion.

4. MÔ HÌNH DỮ LIỆU (Supabase — SQL)

-- Vai trò người dùng
create type user_role as enum ('student', 'teacher');

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  role user_role not null,
  created_at timestamptz default now()
);

create table courses (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  teacher_id uuid references profiles(id),
  created_at timestamptz default now()
);

create table enrollments (
  id uuid primary key default gen_random_uuid(),
  student_id uuid references profiles(id),
  course_id uuid references courses(id),
  enrolled_at timestamptz default now(),
  unique(student_id, course_id)
);

create table lessons (
  id uuid primary key default gen_random_uuid(),
  course_id uuid references courses(id),
  title text not null,
  content text,
  file_url text,
  "order" int not null
);

create table assignments (
  id uuid primary key default gen_random_uuid(),
  course_id uuid references courses(id),
  title text not null,
  description text,
  due_date timestamptz
);

create table submissions (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid references assignments(id),
  student_id uuid references profiles(id),
  file_url text,
  submitted_at timestamptz default now(),
  grade numeric,
  feedback text
);

create table quizzes (
  id uuid primary key default gen_random_uuid(),
  course_id uuid references courses(id),
  title text not null
);

create table questions (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid references quizzes(id),
  text text not null,
  topic_tag text not null, -- BẮT BUỘC, dùng để tính hồ sơ năng lực theo chủ đề
  options jsonb not null,
  correct_answer text not null
);

create table quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid references quizzes(id),
  student_id uuid references profiles(id),
  score numeric not null,
  attempted_at timestamptz default now()
);

create table question_attempts (
  id uuid primary key default gen_random_uuid(),
  quiz_attempt_id uuid references quiz_attempts(id),
  question_id uuid references questions(id),
  is_correct boolean not null
);

-- Dữ liệu hành vi (chủ yếu do seed script sinh ra)
create table activity_logs (
  id uuid primary key default gen_random_uuid(),
  student_id uuid references profiles(id),
  course_id uuid references courses(id),
  action text not null, -- 'view_lesson' | 'login' | 'submit_assignment'...
  timestamp timestamptz not null
);

-- Lớp phân tích / cá nhân hóa (tính toán, không phải CRUD tay)
create table topic_mastery (
  id uuid primary key default gen_random_uuid(),
  student_id uuid references profiles(id),
  course_id uuid references courses(id),
  topic_tag text not null,
  mastery_pct numeric not null, -- 0-100
  updated_at timestamptz default now(),
  unique(student_id, course_id, topic_tag)
);

create table risk_alerts (
  id uuid primary key default gen_random_uuid(),
  student_id uuid references profiles(id),
  course_id uuid references courses(id),
  reason text not null,
  level text not null, -- 'medium' | 'high'
  created_at timestamptz default now()
);

create table chat_messages (
  id uuid primary key default gen_random_uuid(),
  student_id uuid references profiles(id),
  role text not null, -- 'user' | 'ai'
  content text not null,
  created_at timestamptz default now()
);


Row Level Security: bật RLS cho mọi bảng. Student chỉ đọc/ghi dữ liệu của chính mình; Teacher đọc/ghi dữ liệu các khóa học mình phụ trách (courses.teacher_id = auth.uid()), đọc dữ liệu học sinh trong khóa học đó.

5. ĐẶC TẢ CHỨC NĂNG THEO VAI TRÒ

A. Học sinh

CRUD/cơ bản: đăng nhập/đăng ký, xem danh sách khóa học đã đăng ký, xem nội dung bài học, làm quiz, nộp bài tập, xem điểm từng bài.

Cá nhân hóa (trọng tâm):

Hồ sơ năng lực: biểu đồ radar + thanh tiến độ thể hiện % thành thạo theo từng topic_tag trong mỗi môn, tính từ tỷ lệ đúng các question_attempts gắn tag đó.

Dashboard tổng hợp nhiều môn: một màn hình nhìn tất cả môn đang học, đánh dấu môn nào đang tụt (dựa trên xu hướng điểm giảm).

Gợi ý học tập: danh sách gợi ý ôn lại đúng chủ đề có mastery_pct thấp nhất.

So sánh percentile ẩn danh: "Bạn đang thuộc top X% của lớp" — không hiển thị tên người khác.

AI Tutor: giao diện chat, lưu lịch sử vào chat_messages. Giai đoạn đầu có thể trả lời bằng response giả lập cố định (chưa cần nối API thật) để không chặn tiến độ.

B. Giáo viên

CRUD: tạo/sửa/xóa khóa học, bài học (upload file), tạo bài tập, tạo quiz (mỗi câu hỏi bắt buộc chọn topic_tag), quản lý danh sách sinh viên trong lớp, chấm điểm bài nộp.

Phân tích (trọng tâm):

Cảnh báo sinh viên nguy cơ: danh sách từ bảng risk_alerts, sinh tự động khi phát hiện điểm giảm liên tiếp hoặc không hoạt động > N ngày (tính bằng một hàm/edge function chạy định kỳ hoặc tính on-demand khi load trang).

Phổ điểm tùy chỉnh: cho phép lọc theo khóa học/quiz/khoảng thời gian, chọn kiểu biểu đồ (histogram/boxplot), tự đặt ngưỡng phân loại (VD input số để tự định nghĩa "Giỏi ≥ 8.5").

Item analysis: bảng liệt kê câu hỏi có tỷ lệ sai cao nhất trong quiz.

Heatmap tương tác: lưới giờ trong ngày × ngày trong tuần, màu đậm nhạt theo số lượng activity_logs.

Báo cáo tổng hợp: xu hướng điểm trung bình lớp theo thời gian.

6. DỮ LIỆU SEED (bắt buộc, để phân tích có ý nghĩa)

Viết script/seed data tạo:

2 giáo viên, 15-20 sinh viên (dùng Supabase Auth để tạo user thật + insert vào profiles)

3-4 khóa học, mỗi khóa 4-6 chủ đề (topic_tag) khác nhau

Mỗi khóa 3-5 quiz, mỗi quiz 8-10 câu hỏi trải đều các chủ đề

3-6 tháng dữ liệu quiz_attempts + question_attempts mô phỏng cho từng sinh viên, với mức độ khác nhau có chủ đích (một số sinh viên giỏi đều, một số yếu dần một chủ đề cụ thể, một số ít hoạt động dần — để cảnh báo nguy cơ và hồ sơ năng lực có dữ liệu thực tế để thể hiện)

activity_logs trải đều nhiều tuần, có sinh viên hoạt động đều và có sinh viên ngừng hoạt động giữa chừng (để demo cảnh báo)

7. THỨ TỰ XÂY DỰNG (làm theo đúng thứ tự, không nhảy cóc)

Khởi tạo project, kết nối Supabase, tạo schema + RLS ở trên

Auth + phân quyền, layout theo vai trò (sidebar/nav khác nhau cho student/teacher)

CRUD khóa học, bài học, quiz, bài tập (phía giáo viên) + xem/làm/nộp (phía học sinh)

Chạy seed data mô phỏng theo mục 6

Hồ sơ năng lực + dashboard tổng hợp (phía học sinh)

Cảnh báo nguy cơ + phổ điểm tùy chỉnh + item analysis (phía giáo viên)

Gợi ý học tập cá nhân hóa

AI Tutor (chat UI trước, nối API thật sau nếu có thời gian)

8. TIÊU CHÍ HOÀN THÀNH

Mọi số liệu hiển thị (mastery %, cảnh báo, phổ điểm) phải tính từ dữ liệu thật trong Supabase, không phải số hard-code trong component.

Giao diện nhất quán theo Liquid Glass design system ở mục 3, không tự ý dùng style rời rạc.

Responsive được trên mobile.

Có phân quyền rõ ràng: học sinh không thấy được trang quản lý của giáo viên và ngược lại.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://personal-learn-scape.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/74b12cbe-2a84-4997-87ed-71bdfd9e7e6c).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
