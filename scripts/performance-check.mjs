import { chromium } from "@playwright/test";
const browser = await chromium.launch({
  executablePath:
    process.env.CHROME_PATH ||
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: true,
});
try {
  for (const width of [1440, 390]) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    await page.addInitScript(() => {
      window.__localVitals = { lcp: 0, cls: 0, interaction: 0 };
      new PerformanceObserver((list) => {
        for (const e of list.getEntries())
          window.__localVitals.lcp = e.startTime;
      }).observe({ type: "largest-contentful-paint", buffered: true });
      new PerformanceObserver((list) => {
        for (const e of list.getEntries())
          if (!e.hadRecentInput) window.__localVitals.cls += e.value;
      }).observe({ type: "layout-shift", buffered: true });
      new PerformanceObserver((list) => {
        for (const e of list.getEntries())
          if (e.interactionId)
            window.__localVitals.interaction = Math.max(
              window.__localVitals.interaction,
              e.duration,
            );
      }).observe({ type: "event", buffered: true, durationThreshold: 16 });
    });
    await page.goto(process.env.TEST_BASE_URL || "http://localhost:3000", {
      waitUntil: "networkidle",
    });
    await page.locator("summary").first().click();
    await page.waitForTimeout(250);
    const result = await page.evaluate(() => ({
      ...window.__localVitals,
      ttfb: performance.getEntriesByType("navigation")[0].responseStart,
      fcp: performance.getEntriesByName("first-contentful-paint")[0]?.startTime,
    }));
    console.log(
      JSON.stringify({
        viewport: width,
        lcpMs: Math.round(result.lcp),
        cls: Number(result.cls.toFixed(4)),
        sampleInteractionMs: result.interaction || "<16",
        ttfbMs: Math.round(result.ttfb),
        fcpMs: Math.round(result.fcp),
      }),
    );
    if (result.lcp > 2500 || result.cls > 0.1)
      throw new Error("Local LCP/CLS budget exceeded");
    await page.close();
  }
  console.log(
    "Local synthetic LCP and CLS budgets passed. These samples are not field Core Web Vitals or a real-user INP measurement.",
  );
} finally {
  await browser.close();
}
