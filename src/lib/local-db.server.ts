import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from "node:crypto";

/* eslint-disable @typescript-eslint/no-explicit-any */

type Row = any;
type Filter = { kind: "eq" | "in"; column: string; value: unknown };
type QueryPayload = {
  type: "query";
  token?: string | null;
  table: string;
  action: "select" | "insert" | "update" | "upsert" | "delete";
  values?: Row | Row[];
  select?: string;
  filters?: Filter[];
  order?: { column: string; ascending: boolean };
  limit?: number;
  single?: "single" | "maybeSingle";
  onConflict?: string;
};

export type LocalRequest =
  | QueryPayload
  | {
      type: "auth";
      action: "signup" | "signin" | "user" | "signout" | "updatePassword";
      token?: string | null;
      email?: string;
      password?: string;
      name?: string;
      role?: "student" | "teacher";
    }
  | { type: "rpc"; name: string; args?: Row; token?: string | null }
  | {
      type: "storage";
      action: "upload" | "get";
      path: string;
      data?: string;
      mime?: string;
      token?: string | null;
    };

const databasePath = join(process.cwd(), "data", "edusense.sqlite");
mkdirSync(dirname(databasePath), { recursive: true });

const db = new DatabaseSync(databasePath);
db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;
  CREATE TABLE IF NOT EXISTS meta (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    password_salt TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );
  CREATE TABLE IF NOT EXISTS records (
    table_name TEXT NOT NULL,
    id TEXT NOT NULL,
    data TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    PRIMARY KEY (table_name, id)
  );
  CREATE INDEX IF NOT EXISTS records_table_idx ON records(table_name);
  CREATE TABLE IF NOT EXISTS files (
    path TEXT PRIMARY KEY,
    data TEXT NOT NULL,
    mime TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
`);

const defaults: Record<string, Row> = {
  profiles: { role: "student" },
  courses: { description: null, teacher_id: null, visible: true },
  lessons: { content: null, file_url: null, order: 0 },
  assignments: { description: null, due_date: null },
  submissions: { content: null, file_url: null, grade: null, feedback: null },
  quizzes: { visible: true },
  questions: { options: [], visible: true },
  question_attempts: { chosen_answer: null },
  topic_mastery: { mastery_pct: 0 },
  risk_alerts: { level: "medium" },
};

const timestampFields: Record<string, string> = {
  profiles: "created_at",
  courses: "created_at",
  enrollments: "enrolled_at",
  lessons: "created_at",
  assignments: "created_at",
  submissions: "submitted_at",
  quizzes: "created_at",
  quiz_attempts: "attempted_at",
  activity_logs: "timestamp",
  topic_mastery: "updated_at",
  risk_alerts: "created_at",
  chat_messages: "created_at",
};

const relations: Record<string, Record<string, { table: string; foreignKey: string }>> = {
  enrollments: {
    course: { table: "courses", foreignKey: "course_id" },
    courses: { table: "courses", foreignKey: "course_id" },
    student: { table: "profiles", foreignKey: "student_id" },
    profiles: { table: "profiles", foreignKey: "student_id" },
  },
  quiz_attempts: {
    quiz: { table: "quizzes", foreignKey: "quiz_id" },
    quizzes: { table: "quizzes", foreignKey: "quiz_id" },
    student: { table: "profiles", foreignKey: "student_id" },
  },
  question_attempts: {
    question: { table: "questions", foreignKey: "question_id" },
    questions: { table: "questions", foreignKey: "question_id" },
    attempt: { table: "quiz_attempts", foreignKey: "quiz_attempt_id" },
    quiz_attempts: { table: "quiz_attempts", foreignKey: "quiz_attempt_id" },
  },
  questions: {
    quiz: { table: "quizzes", foreignKey: "quiz_id" },
    quizzes: { table: "quizzes", foreignKey: "quiz_id" },
  },
  risk_alerts: {
    student: { table: "profiles", foreignKey: "student_id" },
    profiles: { table: "profiles", foreignKey: "student_id" },
  },
  submissions: {
    student: { table: "profiles", foreignKey: "student_id" },
    assignment: { table: "assignments", foreignKey: "assignment_id" },
  },
};

function now() {
  return new Date().toISOString();
}

function error(message: string, code = "local_error") {
  return { message, code };
}

function hashPassword(password: string, salt: string) {
  return scryptSync(password, salt, 64).toString("hex");
}

function createPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  return { salt, hash: hashPassword(password, salt) };
}

function passwordMatches(password: string, salt: string, storedHash: string) {
  const candidate = Buffer.from(hashPassword(password, salt), "hex");
  const stored = Buffer.from(storedHash, "hex");
  return candidate.length === stored.length && timingSafeEqual(candidate, stored);
}

function createRecord(table: string, values: Row) {
  const id = typeof values.id === "string" ? values.id : randomUUID();
  const timestampField = timestampFields[table];
  const row: Row = { ...(defaults[table] ?? {}), ...values, id };
  if (timestampField && row[timestampField] == null) row[timestampField] = now();
  db.prepare(
    `INSERT INTO records(table_name, id, data, updated_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(table_name, id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`,
  ).run(table, id, JSON.stringify(row), now());
  return row;
}

function allRecords(table: string): Row[] {
  return db
    .prepare("SELECT data FROM records WHERE table_name = ?")
    .all(table)
    .map((entry) => JSON.parse(String((entry as Row).data)) as Row);
}

function recordById(table: string, id: unknown) {
  if (typeof id !== "string") return null;
  const entry = db
    .prepare("SELECT data FROM records WHERE table_name = ? AND id = ?")
    .get(table, id) as Row | undefined;
  return entry ? (JSON.parse(String(entry.data)) as Row) : null;
}

function updateRecord(table: string, row: Row) {
  return createRecord(table, row);
}

function splitFields(value: string) {
  const fields: string[] = [];
  let depth = 0;
  let start = 0;
  for (let index = 0; index < value.length; index += 1) {
    if (value[index] === "(") depth += 1;
    if (value[index] === ")") depth -= 1;
    if (value[index] === "," && depth === 0) {
      fields.push(value.slice(start, index).trim());
      start = index + 1;
    }
  }
  fields.push(value.slice(start).trim());
  return fields.filter(Boolean);
}

function relationFor(sourceTable: string, alias: string, requestedTable?: string) {
  const configured = relations[sourceTable]?.[alias];
  if (configured) return configured;
  if (requestedTable) {
    return Object.values(relations[sourceTable] ?? {}).find(
      (item) => item.table === requestedTable,
    );
  }
  return undefined;
}

function relatedRow(sourceTable: string, source: Row, alias: string, requestedTable?: string) {
  const relation = relationFor(sourceTable, alias, requestedTable);
  return relation ? recordById(relation.table, source[relation.foreignKey]) : null;
}

function projectRow(table: string, row: Row, selection = "*"): Row {
  if (!selection || selection === "*") return { ...row };
  const output: Row = {};
  for (const field of splitFields(selection)) {
    const open = field.indexOf("(");
    if (open === -1) {
      if (field === "*") Object.assign(output, row);
      else output[field] = row[field];
      continue;
    }

    const relationPart = field.slice(0, open).replace("!inner", "");
    const nestedSelection = field.slice(open + 1, -1);
    const [rawAlias, rawRequested] = relationPart.includes(":")
      ? relationPart.split(":", 2)
      : [relationPart, relationPart];
    const alias = rawAlias ?? relationPart;
    const requested = rawRequested ?? alias;
    const relation = relationFor(table, alias, requested);
    const nested = relatedRow(table, row, alias, requested);
    output[alias] = nested && relation ? projectRow(relation.table, nested, nestedSelection) : null;
  }
  return output;
}

function valueAtPath(table: string, row: Row, path: string): unknown {
  const [head, ...rest] = path.split(".");
  if (!head) return undefined;
  if (!rest.length) return row[head];
  const relation = relationFor(table, head);
  const nested = relatedRow(table, row, head);
  return relation && nested ? valueAtPath(relation.table, nested, rest.join(".")) : undefined;
}

function matchesFilters(table: string, row: Row, filters: Filter[] = []) {
  return filters.every((filter) => {
    const actual = valueAtPath(table, row, filter.column);
    if (filter.kind === "eq") return actual === filter.value;
    return Array.isArray(filter.value) && filter.value.includes(actual);
  });
}

function executeQuery(payload: QueryPayload) {
  const filters = payload.filters ?? [];
  if (payload.action === "select") {
    let rows = allRecords(payload.table).filter((row) =>
      matchesFilters(payload.table, row, filters),
    );
    if (payload.order) {
      const { column, ascending } = payload.order;
      rows.sort((left, right) => {
        const a = left[column];
        const b = right[column];
        const result = String(a ?? "").localeCompare(String(b ?? ""), undefined, {
          numeric: true,
        });
        return ascending ? result : -result;
      });
    }
    if (payload.limit != null) rows = rows.slice(0, payload.limit);
    const data = rows.map((row) => projectRow(payload.table, row, payload.select));
    if (payload.single === "single") {
      return data.length === 1
        ? { data: data[0], error: null }
        : { data: null, error: error("Không tìm thấy đúng một bản ghi.", "not_single") };
    }
    if (payload.single === "maybeSingle") {
      return data.length <= 1
        ? { data: data[0] ?? null, error: null }
        : { data: null, error: error("Có nhiều hơn một bản ghi.", "not_single") };
    }
    return { data, error: null };
  }

  if (payload.action === "insert") {
    const input = Array.isArray(payload.values) ? payload.values : [payload.values ?? {}];
    const inserted = input.map((row) => createRecord(payload.table, row));
    const selected = inserted.map((row) => projectRow(payload.table, row, payload.select));
    const data = Array.isArray(payload.values) ? selected : selected;
    if (payload.single === "single" || payload.single === "maybeSingle") {
      return { data: selected[0] ?? null, error: null };
    }
    return { data, error: null };
  }

  const matched = allRecords(payload.table).filter((row) =>
    matchesFilters(payload.table, row, filters),
  );

  if (payload.action === "update") {
    const values = Array.isArray(payload.values) ? payload.values[0] : payload.values;
    matched.forEach((row) => updateRecord(payload.table, { ...row, ...(values ?? {}) }));
    return { data: matched, error: null };
  }

  if (payload.action === "delete") {
    const statement = db.prepare("DELETE FROM records WHERE table_name = ? AND id = ?");
    matched.forEach((row) => statement.run(payload.table, String(row.id)));
    return { data: matched, error: null };
  }

  const input = Array.isArray(payload.values) ? payload.values : [payload.values ?? {}];
  const conflict = (payload.onConflict || "id").split(",").map((field) => field.trim());
  const upserted = input.map((values) => {
    const existing = allRecords(payload.table).find((row) =>
      conflict.every((field) => row[field] === values[field]),
    );
    return createRecord(payload.table, { ...(existing ?? {}), ...values });
  });
  return { data: upserted, error: null };
}

function userFromId(id: string) {
  const account = db.prepare("SELECT id, email, created_at FROM users WHERE id = ?").get(id) as
    Row | undefined;
  if (!account) return null;
  const profile = recordById("profiles", id);
  return {
    id: String(account.id),
    email: String(account.email),
    created_at: String(account.created_at),
    user_metadata: { name: profile?.name, role: profile?.role },
  };
}

function userFromToken(token?: string | null) {
  if (!token) return null;
  const session = db
    .prepare("SELECT user_id, expires_at FROM sessions WHERE token = ?")
    .get(token) as Row | undefined;
  if (!session || new Date(String(session.expires_at)).getTime() <= Date.now()) return null;
  return userFromId(String(session.user_id));
}

function createSession(userId: string) {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  db.prepare("INSERT INTO sessions(token, user_id, expires_at) VALUES (?, ?, ?)").run(
    token,
    userId,
    expiresAt,
  );
  return { access_token: token, expires_at: expiresAt, user: userFromId(userId) };
}

function createAccount(email: string, password: string, name: string, role: "student" | "teacher") {
  const id = randomUUID();
  const credentials = createPassword(password);
  db.prepare(
    "INSERT INTO users(id, email, password_hash, password_salt, created_at) VALUES (?, ?, ?, ?, ?)",
  ).run(id, email.toLowerCase(), credentials.hash, credentials.salt, now());
  createRecord("profiles", { id, name, role });
  return userFromId(id);
}

function executeAuth(request: Extract<LocalRequest, { type: "auth" }>) {
  if (request.action === "user") {
    const user = userFromToken(request.token);
    return { data: { user }, error: user ? null : error("Chưa đăng nhập.", "unauthorized") };
  }
  if (request.action === "signout") {
    if (request.token) db.prepare("DELETE FROM sessions WHERE token = ?").run(request.token);
    return { data: null, error: null };
  }
  if (request.action === "updatePassword") {
    const user = userFromToken(request.token);
    if (!user || !request.password) return { data: null, error: error("Phiên không hợp lệ.") };
    const credentials = createPassword(request.password);
    db.prepare("UPDATE users SET password_hash = ?, password_salt = ? WHERE id = ?").run(
      credentials.hash,
      credentials.salt,
      user.id,
    );
    return { data: { user }, error: null };
  }

  const email = request.email?.trim().toLowerCase();
  const password = request.password ?? "";
  if (!email || !password) {
    return {
      data: { user: null, session: null },
      error: error("Email và mật khẩu không được để trống."),
    };
  }
  const existing = db.prepare("SELECT * FROM users WHERE email = ? COLLATE NOCASE").get(email) as
    Row | undefined;
  if (request.action === "signup") {
    if (existing) {
      return {
        data: { user: null, session: null },
        error: error("Email này đã được đăng ký.", "user_already_exists"),
      };
    }
    const user = createAccount(
      email,
      password,
      request.name || email.split("@")[0] || email,
      request.role || "student",
    );
    const session = createSession(user!.id);
    return { data: { user, session }, error: null };
  }
  if (
    !existing ||
    !passwordMatches(password, String(existing.password_salt), String(existing.password_hash))
  ) {
    return {
      data: { user: null, session: null },
      error: error("Email hoặc mật khẩu không đúng.", "invalid_credentials"),
    };
  }
  const user = userFromId(String(existing.id));
  return { data: { user, session: createSession(String(existing.id)) }, error: null };
}

const courseSeeds = [
  [
    "Lập trình Web",
    "HTML, CSS, JavaScript và React cho ứng dụng web hiện đại.",
    ["HTML & CSS", "JavaScript", "React", "API & Fetch"],
  ],
  [
    "Cơ sở dữ liệu",
    "Thiết kế mô hình quan hệ, truy vấn SQL và tối ưu hoá.",
    ["Mô hình ER", "SQL cơ bản", "Phép JOIN", "Chuẩn hoá"],
  ],
  [
    "Cấu trúc dữ liệu & Giải thuật",
    "Cấu trúc dữ liệu nền tảng và kỹ thuật thiết kế giải thuật.",
    ["Mảng & chuỗi", "Cây", "Đồ thị", "Sắp xếp"],
  ],
  [
    "Nhập môn Trí tuệ nhân tạo",
    "Tìm kiếm, học máy có giám sát và đánh giá mô hình.",
    ["Tìm kiếm", "Học có giám sát", "Mạng nơ-ron", "Đánh giá mô hình"],
  ],
] as const;

function seedCourse(teacherId: string, courseIndex: number, studentIds: string[]) {
  const seed = courseSeeds[courseIndex];
  if (!seed) throw new Error("Không tìm thấy cấu hình môn học mẫu.");
  const [title, description, topics] = seed;
  const course = createRecord("courses", { title, description, teacher_id: teacherId });
  for (let index = 0; index < 5; index += 1) {
    createRecord("lessons", {
      course_id: course.id,
      title: `Bài ${index + 1}: ${topics[index % topics.length]}`,
      content: `Lý thuyết, ví dụ minh hoạ và bài tập tự luyện về ${topics[index % topics.length]}.`,
      order: index + 1,
    });
  }
  const assignments = [0, 1].map((index) =>
    createRecord("assignments", {
      course_id: course.id,
      title: `Bài tập ${index + 1} - ${title}`,
      description: `Vận dụng kiến thức ${topics[index]}.`,
      due_date: new Date(Date.now() + (index + 1) * 10 * 86400000).toISOString(),
    }),
  );
  const enrolled = studentIds.filter((_, index) => (index + courseIndex) % 5 !== 0);
  enrolled.forEach((studentId, studentIndex) => {
    createRecord("enrollments", { student_id: studentId, course_id: course.id });
    createRecord("topic_mastery", {
      student_id: studentId,
      course_id: course.id,
      topic_tag: topics[(studentIndex + courseIndex) % topics.length],
      mastery_pct: 45 + ((studentIndex * 7 + courseIndex * 5) % 50),
    });
    createRecord("activity_logs", {
      student_id: studentId,
      course_id: course.id,
      action: "view_lesson",
      timestamp: new Date(Date.now() - (studentIndex + 1) * 86400000).toISOString(),
    });
    if (studentIndex % 2 === 0) {
      createRecord("submissions", {
        assignment_id: assignments[studentIndex % assignments.length].id,
        student_id: studentId,
        content: "Bài làm mẫu được lưu trong SQLite local.",
        grade: 6 + (studentIndex % 5),
        feedback: "Bài làm tốt, cần bổ sung phần giải thích.",
      });
    }
  });

  for (let quizIndex = 0; quizIndex < 2; quizIndex += 1) {
    const quiz = createRecord("quizzes", {
      course_id: course.id,
      title: `Kiểm tra ${quizIndex + 1} - ${title}`,
    });
    const questions = topics.map((topic, questionIndex) =>
      createRecord("questions", {
        quiz_id: quiz.id,
        text: `Nhận định nào đúng về ${topic}?`,
        topic_tag: topic,
        options: ["A", "B", "C", "D"].map((key) => ({ key, text: `Phương án ${key}` })),
        correct_answer: ["A", "B", "C", "D"][questionIndex % 4],
      }),
    );
    enrolled.slice(0, 6).forEach((studentId, studentIndex) => {
      const correctCount = 1 + ((studentIndex + quizIndex + courseIndex) % 4);
      const attempt = createRecord("quiz_attempts", {
        quiz_id: quiz.id,
        student_id: studentId,
        score: (correctCount * 10) / questions.length,
        attempted_at: new Date(
          Date.now() - (14 - quizIndex * 5 + studentIndex) * 86400000,
        ).toISOString(),
      });
      questions.forEach((question, questionIndex) =>
        createRecord("question_attempts", {
          quiz_attempt_id: attempt.id,
          question_id: question.id,
          chosen_answer: ["A", "B", "C", "D"][questionIndex % 4],
          is_correct: questionIndex < correctCount,
        }),
      );
    });
  }
  if (enrolled[0]) {
    createRecord("risk_alerts", {
      student_id: enrolled[0],
      course_id: course.id,
      reason: "Không có hoạt động trong 24 ngày",
      level: courseIndex % 2 ? "medium" : "high",
    });
  }
  return course;
}

function seedDatabase() {
  const seeded = db.prepare("SELECT value FROM meta WHERE key = 'seed_version'").get();
  if (seeded) return;

  const teachers = [
    { email: "teacher@edusense.local", name: "TS. Nguyễn Văn Bình" },
    { email: "teacher2@edusense.local", name: "ThS. Trần Thu Trang" },
  ].map((teacher) => createAccount(teacher.email, "123456", teacher.name, "teacher")!);
  const names = [
    "Nguyễn Minh Anh",
    "Trần Bảo Long",
    "Lê Thu Hà",
    "Phạm Quốc Huy",
    "Vũ Ngọc Mai",
    "Đặng Hải Nam",
    "Bùi Thanh Tùng",
    "Hoàng Diệu Linh",
  ];
  const students = names.map((name, index) =>
    createAccount(`student${index + 1}@edusense.local`, "123456", name, "student")!,
  );
  courseSeeds.forEach((_, index) =>
    seedCourse(
      teachers[index % teachers.length]!.id,
      index,
      students.map((student) => student.id),
    ),
  );
  db.prepare("INSERT INTO meta(key, value) VALUES ('seed_version', '1')").run();
}

function bootstrapDemo(userId: string, name: string, role: "student" | "teacher") {
  const profile = recordById("profiles", userId);
  createRecord("profiles", { ...(profile ?? {}), id: userId, name, role });
  if (role === "student") {
    const hasEnrollment = allRecords("enrollments").some((row) => row.student_id === userId);
    if (!hasEnrollment) {
      allRecords("courses").forEach((course) =>
        createRecord("enrollments", { student_id: userId, course_id: course.id }),
      );
    }
  } else if (!allRecords("courses").some((course) => course.teacher_id === userId)) {
    const students = allRecords("profiles")
      .filter((row) => row.role === "student")
      .slice(0, 8)
      .map((row) => String(row.id));
    courseSeeds.forEach((_, index) => seedCourse(userId, index, students));
  }
}

function executeRpc(request: Extract<LocalRequest, { type: "rpc" }>) {
  const user = userFromToken(request.token);
  if (!user) return { data: null, error: error("Chưa đăng nhập.", "unauthorized") };
  const args = request.args ?? {};
  if (request.name === "bootstrap_demo") {
    bootstrapDemo(
      user.id,
      String(args._name || user.user_metadata.name || user.email),
      args._role === "teacher" ? "teacher" : "student",
    );
    return { data: null, error: null };
  }
  if (request.name === "browse_open_courses") {
    const query = String(args._q ?? "").toLocaleLowerCase("vi");
    const data = allRecords("courses")
      .filter((course) => course.visible !== false)
      .filter((course) =>
        `${course.title ?? ""} ${course.description ?? ""}`.toLocaleLowerCase("vi").includes(query),
      )
      .map((course) => ({
        id: course.id,
        title: course.title,
        description: course.description,
        teacher_name: recordById("profiles", course.teacher_id)?.name ?? "Giáo viên",
      }));
    return { data, error: null };
  }
  if (request.name === "search_students") {
    const query = String(args._q ?? "").toLocaleLowerCase("vi");
    return {
      data: allRecords("profiles")
        .filter((profile) => profile.role === "student")
        .filter((profile) => String(profile.name).toLocaleLowerCase("vi").includes(query))
        .slice(0, 20)
        .map(({ id, name }) => ({ id, name })),
      error: null,
    };
  }
  if (request.name === "teacher_add_student") {
    let studentId = typeof args._student_id === "string" ? args._student_id : null;
    if (!studentId) {
      studentId = randomUUID();
      createRecord("profiles", {
        id: studentId,
        name: String(args._new_name || "Học sinh mới"),
        role: "student",
      });
    }
    const exists = allRecords("enrollments").some(
      (row) => row.course_id === args._course_id && row.student_id === studentId,
    );
    if (!exists) createRecord("enrollments", { course_id: args._course_id, student_id: studentId });
    return { data: studentId, error: null };
  }
  if (request.name === "recompute_risk_alerts") {
    return { data: allRecords("risk_alerts").length, error: null };
  }
  return { data: null, error: error(`RPC local chưa hỗ trợ: ${request.name}`) };
}

seedDatabase();

export function handleLocalRequest(request: LocalRequest) {
  try {
    if (request.type === "query") {
      if (!userFromToken(request.token)) {
        return { data: null, error: error("Chưa đăng nhập.", "unauthorized") };
      }
      return executeQuery(request);
    }
    if (request.type === "auth") return executeAuth(request);
    if (request.type === "rpc") return executeRpc(request);
    if (!userFromToken(request.token)) return { data: null, error: error("Chưa đăng nhập.") };
    if (request.action === "upload") {
      db.prepare(
        `INSERT INTO files(path, data, mime, updated_at) VALUES (?, ?, ?, ?)
         ON CONFLICT(path) DO UPDATE SET data = excluded.data, mime = excluded.mime, updated_at = excluded.updated_at`,
      ).run(request.path, request.data ?? "", request.mime ?? "application/octet-stream", now());
      return { data: { path: request.path }, error: null };
    }
    const file = db.prepare("SELECT data, mime FROM files WHERE path = ?").get(request.path) as
      Row | undefined;
    return file
      ? { data: `data:${String(file.mime)};base64,${String(file.data)}`, error: null }
      : { data: null, error: error("Không tìm thấy tệp.", "not_found") };
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : "Lỗi database local.";
    return { data: null, error: error(message) };
  }
}

export function resetLocalDatabase() {
  db.exec(
    "DELETE FROM files; DELETE FROM records; DELETE FROM sessions; DELETE FROM users; DELETE FROM meta;",
  );
  seedDatabase();
}
