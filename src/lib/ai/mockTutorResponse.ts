/**
 * ĐIỂM NỐI API AI THẬT.
 *
 * Toàn bộ phần "AI" của hệ thống đi qua hai hàm dưới đây. Khi muốn dùng AI thật
 * (OpenAI / Gemini / Lovable AI Gateway...), chỉ cần thay phần thân của
 * `studentTutorReply` và `teacherTutorReply` bằng lời gọi API — không cần sửa
 * bất kỳ file giao diện nào khác.
 *
 *   export async function studentTutorReply(ctx) {
 *     const res = await fetch("/api/tutor", { method: "POST", body: JSON.stringify(ctx) });
 *     return (await res.json()).content;
 *   }
 */

export type StudentTutorContext = {
  question: string;
  topics: { topic_tag: string; correct: number; total: number; course_id: string }[];
  courses: { id: string; title: string }[];
  averageScore?: number | null;
};

export type TeacherTutorContext = {
  question: string;
  courses: { id: string; title: string }[];
  topics: { topic_tag: string; course_id: string; mastery: number }[];
  alerts: { student: string; reason: string; level: string; course_id: string }[];
  averageScore?: number | null;
  studentCount?: number;
};

function pct(correct: number, total: number) {
  return total ? (correct / total) * 100 : 0;
}

/** Trợ giảng cho sinh viên — hiện dùng luật dựa trên hồ sơ năng lực thật. */
export async function studentTutorReply(ctx: StudentTutorContext): Promise<string> {
  const q = ctx.question.toLowerCase();
  const ranked = ctx.topics
    .filter((t) => t.total >= 3)
    .map((t) => ({ ...t, pct: pct(t.correct, t.total) }))
    .sort((a, b) => a.pct - b.pct);
  const weakest = ranked[0];
  const strongest = ranked[ranked.length - 1];
  const courseName = (id?: string) => ctx.courses.find((c) => c.id === id)?.title ?? "khóa học";

  if (!weakest) {
    return "Hãy hoàn thành ít nhất một bài kiểm tra để mình có dữ liệu phân tích năng lực và đưa ra gợi ý chính xác nhé.";
  }

  if (q.includes("ôn") || q.includes("học gì") || q.includes("yếu") || q.includes("gợi ý") || q.includes("lộ trình")) {
    const plan = ranked
      .slice(0, 3)
      .map((t, i) => `${i + 1}. **${t.topic_tag}** (${t.pct.toFixed(0)}% đúng — ${courseName(t.course_id)})`)
      .join("\n");
    return `Lộ trình ôn tập đề xuất cho bạn, ưu tiên từ chủ đề yếu nhất:\n${plan}\n\nVới mỗi chủ đề: đọc lại bài giảng → làm 8–10 câu hỏi cùng nhãn chủ đề → kiểm tra lại chỉ số ở trang Hồ sơ năng lực.`;
  }

  if (q.includes("mạnh") || q.includes("tốt nhất")) {
    return `Chủ đề bạn đang làm tốt nhất là **${strongest.topic_tag}** với ${strongest.pct.toFixed(0)}% câu đúng. Hãy giữ nhịp và dồn thời gian còn lại cho **${weakest.topic_tag}**.`;
  }

  if (q.includes("điểm") || q.includes("kết quả")) {
    const avg = ctx.averageScore != null ? ` Điểm trung bình hiện tại của bạn là ${ctx.averageScore.toFixed(2)}/10.` : "";
    return `Bạn có thể xem xu hướng điểm từng môn ở trang Tổng quan.${avg} Nếu một môn có nhãn “Đang tụt”, hãy ưu tiên hai chủ đề có % thành thạo thấp nhất của môn đó.`;
  }

  if (q.includes("hạn") || q.includes("deadline") || q.includes("bài tập")) {
    return "Trang **Bài tập** liệt kê toàn bộ deadline kèm số ngày còn lại. Hãy xử lý các mục có nhãn đỏ trước, sau đó mới quay lại ôn chủ đề yếu.";
  }

  return `Mình đã ghi nhận câu hỏi của bạn. Gợi ý nhanh: chủ đề **${weakest.topic_tag}** (${courseName(weakest.course_id)}) đang ở mức ${weakest.pct.toFixed(0)}% — đây là nơi bạn cải thiện điểm nhanh nhất.`;
}

/** Trợ lý cho giáo viên — trả lời về tình hình lớp dựa trên mastery và cảnh báo đã tính. */
export async function teacherTutorReply(ctx: TeacherTutorContext): Promise<string> {
  const q = ctx.question.toLowerCase();
  const courseName = (id?: string) => ctx.courses.find((c) => c.id === id)?.title ?? "khóa học";
  const ranked = [...ctx.topics].sort((a, b) => a.mastery - b.mastery);
  const weakest = ranked[0];
  const high = ctx.alerts.filter((a) => a.level === "high");

  if (q.includes("yếu") || q.includes("chủ đề") || q.includes("kém")) {
    if (!weakest) return "Chưa có đủ dữ liệu bài làm để xác định chủ đề yếu. Hãy để lớp hoàn thành thêm một bài kiểm tra.";
    const top = ranked
      .slice(0, 3)
      .map((t, i) => `${i + 1}. **${t.topic_tag}** — ${t.mastery.toFixed(0)}% (${courseName(t.course_id)})`)
      .join("\n");
    return `Ba chủ đề lớp đang yếu nhất:\n${top}\n\nĐề xuất: dành một buổi chữa bài cho **${weakest.topic_tag}** và bổ sung câu hỏi cùng nhãn vào bài kiểm tra kế tiếp.`;
  }

  if (q.includes("rủi ro") || q.includes("nguy cơ") || q.includes("cảnh báo") || q.includes("bỏ học")) {
    if (ctx.alerts.length === 0) return "Hiện không có sinh viên nào bị gắn cờ nguy cơ. Bạn có thể bấm “Tính lại cảnh báo” ở trang Cảnh báo để cập nhật theo dữ liệu mới nhất.";
    const list = ctx.alerts
      .slice(0, 5)
      .map((a) => `• **${a.student}** — ${a.reason} (${courseName(a.course_id)})`)
      .join("\n");
    return `Đang có ${ctx.alerts.length} cảnh báo, trong đó ${high.length} ở mức cao:\n${list}\n\nƯu tiên liên hệ nhóm mức cao trong tuần này.`;
  }

  if (q.includes("điểm") || q.includes("trung bình") || q.includes("kết quả")) {
    const avg = ctx.averageScore != null ? ctx.averageScore.toFixed(2) : "—";
    return `Điểm trung bình toàn bộ bài kiểm tra hiện là **${avg}/10** trên ${ctx.studentCount ?? 0} sinh viên có bài làm. Xem phân bố điểm chi tiết và các câu hỏi khó nhất ở trang Phân tích.`;
  }

  if (q.includes("câu hỏi") || q.includes("đề") || q.includes("khó")) {
    return "Trang **Phân tích** có mục “Câu hỏi khó nhất” xếp theo tỉ lệ trả lời sai. Câu nào sai trên 70% thường là câu diễn đạt chưa rõ hoặc chủ đề chưa được dạy kỹ — nên rà lại trước khi dùng cho kỳ sau.";
  }

  return `Mình có thể tóm tắt tình hình lớp: ${ctx.alerts.length} cảnh báo nguy cơ, ${ctx.courses.length} khóa học đang phụ trách${
    weakest ? `, chủ đề yếu nhất là **${weakest.topic_tag}** (${weakest.mastery.toFixed(0)}%)` : ""
  }. Hãy hỏi cụ thể hơn, ví dụ “lớp đang yếu chủ đề nào nhất?” hoặc “ai đang có nguy cơ?”.`;
}