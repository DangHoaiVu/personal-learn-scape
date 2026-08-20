import { existsSync, rmSync } from "node:fs";
import { dirname, resolve } from "node:path";

const dataDirectory = resolve(process.cwd(), "data");
const databasePath = resolve(dataDirectory, "edusense.sqlite");

if (dirname(databasePath) !== dataDirectory) {
  throw new Error("Refusing to reset a database outside the local data directory.");
}

for (const path of [databasePath, `${databasePath}-wal`, `${databasePath}-shm`]) {
  if (existsSync(path)) rmSync(path);
}

console.log("Đã xóa database local. Seed mới sẽ được tạo ở lần chạy ứng dụng tiếp theo.");
