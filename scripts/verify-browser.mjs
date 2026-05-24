import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { chromium } from "playwright-core";

const baseUrl = process.env.TEST_BASE_URL || "http://127.0.0.1:8787";
const headless = process.argv.includes("--headless");
const screenshotDir = resolve("dist", "verification");

const browserCandidates = [
  process.env.BROWSER_PATH,
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe"
].filter(Boolean);

const executablePath = browserCandidates.find((path) => existsSync(path));
if (!executablePath) {
  throw new Error("Chrome or Edge executable was not found. Set BROWSER_PATH to run browser verification.");
}

const browser = await chromium.launch({
  executablePath,
  headless,
  args: ["--enable-features=WebGPU"]
});

const context = await browser.newContext({
  viewport: {
    width: 1280,
    height: 900
  }
});

const pageA = await context.newPage();
const pageB = await context.newPage();

const readPanel = async (page) => ({
  title: await page.title(),
  brokerId: await page.locator("[data-broker-id]").innerText(),
  clients: await page.locator('[data-status="clients"]').innerText(),
  output: await page.locator("[data-output]").innerText(),
  workerHeapUsed: await page.locator("[data-worker-heap-used]").innerText(),
  workerHeapLimit: await page.locator("[data-worker-heap-limit]").innerText(),
  pageHeapUsed: await page.locator("[data-page-heap-used]").innerText(),
  pageHeapLimit: await page.locator("[data-page-heap-limit]").innerText(),
  agentMemory: await page.locator("[data-agent-memory]").innerText(),
  deviceMemory: await page.locator("[data-device-memory]").innerText(),
  storageQuota: await page.locator("[data-storage-quota]").innerText(),
  isolation: await page.locator("[data-isolation]").innerText(),
  notes: await page.locator("[data-metrics-notes]").innerText()
});

try {
  await pageA.goto(`${baseUrl}/test-sites/site-a/`);
  await pageB.goto(`${baseUrl}/test-sites/site-b/`);
  await pageA.waitForLoadState("domcontentloaded");
  await pageB.waitForLoadState("domcontentloaded");

  await pageA.locator("[data-broker-id]").waitFor({ state: "visible" });
  await pageB.locator("[data-broker-id]").waitFor({ state: "visible" });
  await pageA.waitForFunction(() => document.querySelector("[data-broker-id]")?.textContent !== "...");
  await pageB.waitForFunction(() => document.querySelector("[data-broker-id]")?.textContent !== "...");

  await pageA.getByRole("button", { name: "メトリクス更新" }).click();
  await pageB.getByRole("button", { name: "メトリクス更新" }).click();
  await pageA.getByRole("button", { name: "要約" }).click();
  await pageB.getByRole("button", { name: "翻訳" }).click();

  await pageA.waitForFunction(() => document.querySelector("[data-output]")?.textContent?.includes("要約"));
  await pageB.waitForFunction(() => document.querySelector("[data-output]")?.textContent?.includes("翻訳"));

  await pageA.getByRole("button", { name: "メトリクス更新" }).click();
  await pageB.getByRole("button", { name: "メトリクス更新" }).click();
  await pageA.waitForFunction(() => document.querySelector("[data-metrics-notes]")?.textContent !== "No metrics sampled yet.");
  await pageB.waitForFunction(() => document.querySelector("[data-metrics-notes]")?.textContent !== "No metrics sampled yet.");

  const siteA = await readPanel(pageA);
  const siteB = await readPanel(pageB);
  const result = {
    executablePath,
    baseUrl,
    sameBroker: siteA.brokerId === siteB.brokerId,
    siteA,
    siteB
  };

  await mkdir(screenshotDir, { recursive: true });
  await pageA.screenshot({ path: join(screenshotDir, "site-a-metrics.png"), fullPage: true });
  await pageB.screenshot({ path: join(screenshotDir, "site-b-metrics.png"), fullPage: true });

  console.log(JSON.stringify(result, null, 2));

  if (!result.sameBroker) {
    throw new Error("Site A and Site B did not connect to the same SharedWorker broker.");
  }
} finally {
  if (!headless) {
    await pageA.waitForTimeout(1500);
  }
  await browser.close();
}
