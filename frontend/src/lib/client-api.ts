let token = "";
export async function request(path: string, options: RequestInit = {}) {
  const method = options.method || "GET";
  const headers = new Headers(options.headers);
  if (!["GET", "HEAD"].includes(method)) {
    if (!token) {
      const r = await fetch("/api/v1/auth/csrf", { cache: "no-store" });
      if (!r.ok) throw new Error("Unable to establish a secure session");
      token = (await r.json()).data.token;
    }
    headers.set("x-csrf-token", token);
  }
  if (options.body && !(options.body instanceof FormData))
    headers.set("Content-Type", "application/json");
  const r = await fetch("/api/v1" + path, {
    ...options,
    headers,
    cache: "no-store",
  });
  if (r.status === 204) return null;
  const json = await r
    .json()
    .catch(() => ({
      error: { message: "The server is unavailable. Please try again." },
    }));
  if (!r.ok) {
    if (r.status === 403) token = "";
    const fields = json.error?.fields;
    throw new Error(
      json.error?.message +
        (fields
          ? " · " +
            Object.entries(fields)
              .map(([k, v]) => `${k}: ${(v as string[]).join(", ")}`)
              .join(" · ")
          : ""),
    );
  }
  return json;
}
