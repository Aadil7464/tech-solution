import { isIP } from "node:net";

// Explicit IPs/subnets only. Never accept booleans, hop counts or wildcard trust.
export function trustedProxyCidrs(value = "") {
  const entries = String(value).split(",").map((entry) => entry.trim()).filter(Boolean);
  for (const entry of entries) {
    const [address, prefix, extra] = entry.split("/");
    const family = isIP(address);
    if (!family || extra !== undefined || (prefix !== undefined &&
      (!/^\d+$/.test(prefix) || Number(prefix) < 1 || Number(prefix) > (family === 4 ? 32 : 128))))
      throw new Error("TRUSTED_PROXY_CIDRS must contain explicit IP addresses or nonzero CIDR ranges");
  }
  return entries.length ? [...new Set(entries)] : false;
}
