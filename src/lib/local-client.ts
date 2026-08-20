/* eslint-disable @typescript-eslint/no-explicit-any */

type LocalError = { message: string; code?: string };
type LocalResponse<T = any> = { data: T; error: LocalError | null };
type AuthEvent = "SIGNED_IN" | "SIGNED_OUT" | "USER_UPDATED";
type Filter = { kind: "eq" | "in"; column: string; value: unknown };

const sessionKey = "edusense-local-session";
const authListeners = new Set<(event: AuthEvent, session: any) => void>();

function readToken() {
  return typeof window === "undefined" ? null : window.localStorage.getItem(sessionKey);
}

function saveToken(token: string | null) {
  if (typeof window === "undefined") return;
  if (token) window.localStorage.setItem(sessionKey, token);
  else window.localStorage.removeItem(sessionKey);
}

async function request<T = any>(payload: Record<string, unknown>): Promise<LocalResponse<T>> {
  try {
    const response = await fetch("/api/local", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      return { data: null as T, error: { message: `Local API trả về mã ${response.status}.` } };
    }
    return (await response.json()) as LocalResponse<T>;
  } catch (caught) {
    return {
      data: null as T,
      error: {
        message: caught instanceof Error ? caught.message : "Không kết nối được database local.",
      },
    };
  }
}

class LocalQueryBuilder implements PromiseLike<LocalResponse> {
  private action: "select" | "insert" | "update" | "upsert" | "delete" = "select";
  private values: any;
  private selection = "*";
  private filters: Filter[] = [];
  private ordering?: { column: string; ascending: boolean };
  private rowLimit?: number;
  private singleMode?: "single" | "maybeSingle";
  private conflict: string | undefined;

  constructor(private readonly table: string) {}

  select(selection = "*") {
    this.selection = selection;
    return this;
  }

  insert(values: any) {
    this.action = "insert";
    this.values = values;
    return this;
  }

  update(values: any) {
    this.action = "update";
    this.values = values;
    return this;
  }

  upsert(values: any, options?: { onConflict?: string }) {
    this.action = "upsert";
    this.values = values;
    this.conflict = options?.onConflict;
    return this;
  }

  delete() {
    this.action = "delete";
    return this;
  }

  eq(column: string, value: unknown) {
    this.filters.push({ kind: "eq", column, value });
    return this;
  }

  in(column: string, value: unknown[]) {
    this.filters.push({ kind: "in", column, value });
    return this;
  }

  order(column: string, options?: { ascending?: boolean }) {
    this.ordering = { column, ascending: options?.ascending !== false };
    return this;
  }

  limit(value: number) {
    this.rowLimit = value;
    return this;
  }

  single() {
    this.singleMode = "single";
    return this;
  }

  maybeSingle() {
    this.singleMode = "maybeSingle";
    return this;
  }

  private execute() {
    return request({
      type: "query",
      table: this.table,
      action: this.action,
      values: this.values,
      select: this.selection,
      filters: this.filters,
      order: this.ordering,
      limit: this.rowLimit,
      single: this.singleMode,
      onConflict: this.conflict,
      token: readToken(),
    });
  }

  then<TResult1 = LocalResponse, TResult2 = never>(
    onfulfilled?: ((value: LocalResponse) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return this.execute().then(onfulfilled, onrejected);
  }
}

async function fileToBase64(file: File) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = "";
  const chunkSize = 8192;
  for (let start = 0; start < bytes.length; start += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(start, start + chunkSize));
  }
  return btoa(binary);
}

export const localDb = {
  from(table: string) {
    return new LocalQueryBuilder(table);
  },

  rpc(name: string, args?: Record<string, unknown>) {
    return request({ type: "rpc", name, args, token: readToken() });
  },

  storage: {
    from(_bucket: string) {
      return {
        async upload(path: string, file: File) {
          return request({
            type: "storage",
            action: "upload",
            path,
            data: await fileToBase64(file),
            mime: file.type || "application/octet-stream",
            token: readToken(),
          });
        },
        async createSignedUrl(path: string, _expiresIn: number) {
          const result = await request<string>({
            type: "storage",
            action: "get",
            path,
            token: readToken(),
          });
          return {
            data: result.data ? { signedUrl: result.data } : null,
            error: result.error,
          };
        },
      };
    },
  },

  auth: {
    async signUp({
      email,
      password,
      options,
    }: {
      email: string;
      password: string;
      options?: { data?: { name?: string; role?: "student" | "teacher" } };
    }) {
      const result = await request<any>({
        type: "auth",
        action: "signup",
        email,
        password,
        name: options?.data?.name,
        role: options?.data?.role,
      });
      const token = result.data?.session?.access_token ?? null;
      if (token) {
        saveToken(token);
        authListeners.forEach((listener) => listener("SIGNED_IN", result.data.session));
      }
      return result;
    },

    async signInWithPassword({ email, password }: { email: string; password: string }) {
      const result = await request<any>({ type: "auth", action: "signin", email, password });
      const token = result.data?.session?.access_token ?? null;
      if (token) {
        saveToken(token);
        authListeners.forEach((listener) => listener("SIGNED_IN", result.data.session));
      }
      return result;
    },

    async getUser() {
      return request<any>({ type: "auth", action: "user", token: readToken() });
    },

    async getSession() {
      const token = readToken();
      if (!token) return { data: { session: null }, error: null };
      const result = await request<any>({ type: "auth", action: "user", token });
      if (result.error || !result.data?.user) {
        saveToken(null);
        return { data: { session: null }, error: result.error };
      }
      return { data: { session: { access_token: token, user: result.data.user } }, error: null };
    },

    async signOut() {
      const result = await request({ type: "auth", action: "signout", token: readToken() });
      saveToken(null);
      authListeners.forEach((listener) => listener("SIGNED_OUT", null));
      return result;
    },

    async updateUser({ password }: { password: string }) {
      const result = await request<any>({
        type: "auth",
        action: "updatePassword",
        password,
        token: readToken(),
      });
      if (!result.error) authListeners.forEach((listener) => listener("USER_UPDATED", null));
      return result;
    },

    onAuthStateChange(callback: (event: AuthEvent, session: any) => void) {
      authListeners.add(callback);
      return {
        data: {
          subscription: {
            unsubscribe: () => {
              authListeners.delete(callback);
            },
          },
        },
      };
    },
  },
};
