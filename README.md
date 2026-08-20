# EduSense Local

Nền tảng học tập cá nhân hóa chạy hoàn toàn trên máy cá nhân. Ứng dụng không cần
Supabase, Lovable, Docker hay tài khoản dịch vụ bên ngoài.

## Chạy dự án

Yêu cầu Node.js 22.5 trở lên vì database sử dụng module SQLite tích hợp của Node.

```bash
npm install
npm run dev -- --host 127.0.0.1 --port 3000
```

Mở `http://127.0.0.1:3000`.

## Database và dữ liệu mẫu

SQLite được tạo tự động tại `data/edusense.sqlite` trong lần truy cập đầu tiên.
Mọi thao tác tạo, sửa, xóa khóa học, bài học, quiz, bài nộp và tài khoản đều được
lưu bền trong file này.

Seed mặc định gồm 2 giáo viên, 8 học sinh, 4 môn học không trùng nhau cùng bài
học, bài tập, quiz, lượt làm bài, hồ sơ năng lực và cảnh báo mẫu.

Tài khoản đăng nhập nhanh:

- Học sinh: `student1@edusense.local` / `123456`
- Giáo viên: `teacher@edusense.local` / `123456`

Để xóa toàn bộ thay đổi local và tạo lại seed từ đầu:

```bash
npm run db:reset
```

Sau đó dừng và chạy lại ứng dụng. File SQLite và các file WAL/SHM được bỏ qua bởi
Git nên dữ liệu thử nghiệm cá nhân không bị commit.

## Kiến trúc local

- React 19, TanStack Start/Router và Tailwind CSS 4.
- API local tại `/api/local`.
- SQLite tích hợp trong Node cho tài khoản, phiên đăng nhập, CRUD và file nộp bài.
- Mật khẩu được băm bằng `scrypt` kèm salt trước khi lưu.
- Phiên local hết hạn sau 30 ngày và được lưu trên trình duyệt hiện tại.

Đây là môi trường phát triển và trình diễn local, không phải cấu hình production
cho nhiều người dùng hoặc triển khai Internet.
