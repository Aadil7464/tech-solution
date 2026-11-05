let cachedToken;

class GraphError extends Error {
  constructor(message, code = "GRAPH_SYNC_FAILED", status) {
    super(message);
    this.name = "GraphError";
    this.code = code;
    this.status = status;
  }
}

const configured = (env) =>
  !!(
    env.MS_CLIENT_ID &&
    env.MS_CLIENT_SECRET &&
    env.MS_TENANT_ID &&
    env.MS_DRIVE_ID &&
    env.MS_WORKBOOK_ID
  );
const safeError = (error) =>
  String(error?.message || "")
    .replace(/[\r\n]+/g, " ")
    .slice(0, 240);

async function graphRequestWithToken(env, token, path, options) {
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    env.MS_GRAPH_TIMEOUT_MS || 15000,
  );
  try {
    const response = await fetch(`https://graph.microsoft.com/v1.0${path}`, {
      ...options,
      headers: {
        ...options.headers,
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
      signal: controller.signal,
    });
    if (response.status === 401) return { unauthorized: true };
    const text = await response.text();
    const body = text ? JSON.parse(text) : {};
    if (!response.ok)
      throw new GraphError(
        body.error?.code || "Graph request failed",
        body.error?.code,
        response.status,
      );
    return body;
  } catch (error) {
    if (error.name === "AbortError")
      throw new GraphError(
        "Microsoft Graph request timed out",
        "GRAPH_TIMEOUT",
      );
    if (error instanceof GraphError) throw error;
    throw new GraphError(
      "Microsoft Graph request failed",
      "GRAPH_NETWORK_ERROR",
    );
  } finally {
    clearTimeout(timeout);
  }
}

async function getToken(env) {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60000)
    return cachedToken.value;
  const body = new URLSearchParams({
    client_id: env.MS_CLIENT_ID,
    client_secret: env.MS_CLIENT_SECRET,
    scope: "https://graph.microsoft.com/.default",
    grant_type: "client_credentials",
  });
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    env.MS_GRAPH_TIMEOUT_MS || 15000,
  );
  try {
    const response = await fetch(
      `https://login.microsoftonline.com/${encodeURIComponent(env.MS_TENANT_ID)}/oauth2/v2.0/token`,
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body,
        signal: controller.signal,
      },
    );
    const data = await response.json();
    if (!response.ok)
      throw new GraphError(
        data.error_description || "Microsoft authentication failed",
        data.error || "MS_AUTH_FAILED",
        response.status,
      );
    cachedToken = {
      value: data.access_token,
      expiresAt: Date.now() + Number(data.expires_in || 3600) * 1000,
    };
    return cachedToken.value;
  } catch (error) {
    if (error.name === "AbortError")
      throw new GraphError(
        "Microsoft authentication timed out",
        "GRAPH_TIMEOUT",
      );
    if (error instanceof GraphError) throw error;
    throw new GraphError("Microsoft authentication failed", "MS_AUTH_FAILED");
  } finally {
    clearTimeout(timeout);
  }
}

export function excelRow(lead) {
  const date =
    lead.createdAt instanceof Date
      ? lead.createdAt
      : new Date(lead.createdAt || Date.now());
  return [
    String(lead._id),
    date.toISOString(),
    lead.name || "",
    lead.email || "",
    lead.phone || "",
    lead.company || "",
    lead.service || "",
    lead.budget || "",
    lead.message || "",
    lead.status || "New",
    "Website Contact Form",
  ];
}

export async function syncLeadToExcel(lead, env) {
  if (!configured(env))
    return { status: "pending", errorCode: "NOT_CONFIGURED" };
  const base = `/drives/${encodeURIComponent(env.MS_DRIVE_ID)}/items/${encodeURIComponent(env.MS_WORKBOOK_ID)}/workbook/tables/${encodeURIComponent(env.MS_TABLE_NAME || "ContactLeads")}`;
  const append = async () => {
    let token = await getToken(env);
    let result = await graphRequestWithToken(
      env,
      token,
      `${base}/range/usedRange?valuesOnly=true`,
      {},
    );
    if (result.unauthorized) {
      cachedToken = undefined;
      token = await getToken(env);
      result = await graphRequestWithToken(
        env,
        token,
        `${base}/range/usedRange?valuesOnly=true`,
        {},
      );
    }
    if (result.unauthorized)
      throw new GraphError(
        "Microsoft authentication expired",
        "AUTH_EXPIRED",
        401,
      );
    if (result.values?.some((row) => String(row[0] || "") === String(lead._id)))
      return { status: "synced", duplicatePrevented: true };

    result = await graphRequestWithToken(env, token, `${base}/rows/add`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ values: [excelRow(lead)] }),
    });
    if (result.unauthorized) {
      cachedToken = undefined;
      token = await getToken(env);
      result = await graphRequestWithToken(env, token, `${base}/rows/add`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ values: [excelRow(lead)] }),
      });
    }
    if (result.unauthorized)
      throw new GraphError(
        "Microsoft authentication expired",
        "AUTH_EXPIRED",
        401,
      );
    return { status: "synced", duplicatePrevented: false };
  };
  try {
    return await append();
  } catch (error) {
    return {
      status: "failed",
      errorCode: error.code || "GRAPH_SYNC_FAILED",
      message: safeError(error),
    };
  }
}
