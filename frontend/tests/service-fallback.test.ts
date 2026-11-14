import { test } from "node:test";
import assert from "node:assert/strict";
import { getServiceFallback } from "../src/lib/serviceFallback.ts";

test("known service fallback entries include page content for offline detail routes", () => {
  const service = getServiceFallback("mobile-app-development");
  assert.ok(service);
  assert.equal(service.title, "Mobile App Development");
  assert.match(service.content, /mobile experiences/i);
});

test("unknown services do not resolve to fallback content", () => {
  assert.equal(getServiceFallback("not-a-service"), undefined);
});
