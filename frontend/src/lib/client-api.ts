let token = "";
export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}
const networkMessage = "Unable to connect to the server. Please try again.";
async function fetchApi(path: string, options: RequestInit) {
  try {
    return await fetch(path, { ...options, credentials: "same-origin" });
  } catch {
    throw new Error(networkMessage);
  }
}
export async function request(path: string, options: RequestInit = {}) {
  const method = options.method || "GET";
  const signal = options.signal || AbortSignal.timeout(15000);
  const headers = new Headers(options.headers);
  if (!["GET", "HEAD"].includes(method)) {
    if (!token) {
      const r = await fetchApi("/api/v1/auth/csrf", { cache: "no-store", signal });
      if (!r.ok) throw new ApiError(r.status >= 500 ? networkMessage : "Unable to establish a secure session. Please reload and try again.", r.status);
      const csrf = await r.json().catch(() => null);
      if (!csrf?.data?.token || typeof csrf.data.token !== "string") throw new Error(networkMessage);
      token = csrf.data.token;
    }
    headers.set("x-csrf-token", token);
  }
  if (options.body && !(options.body instanceof FormData))
    headers.set("Content-Type", "application/json");
  const r = await fetchApi("/api/v1" + path, {
    ...options,
    headers,
    cache: "no-store",
    signal,
  });
  if (r.status === 204) return null;
  const json = await r
    .json()
    .catch(() => ({
      error: { message: networkMessage },
    }));
  if (!r.ok) {
    if (r.status === 403) token = "";
    const fields = json.error?.fields;
    throw new ApiError(
      (json.error?.message || "Something went wrong. Please try again.") +
        (fields
          ? " · " +
            Object.entries(fields)
              .map(([k, v]) => `${k}: ${(v as string[]).join(", ")}`)
              .join(" · ")
          : ""),
      r.status,
    );
  }
  if (!json.data) throw new Error(networkMessage);
  return json;
}
