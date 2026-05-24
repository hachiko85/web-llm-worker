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
const markerUrl = `${baseUrl}/models/onnx-community/Ternary-Bonsai-4B-ONNX/resolve/main/MIRROR_README.txt`;

const readPanel = async (page) => ({
  title: await page.title(),
  brokerId: await page.locator("[data-broker-id]").innerText(),
  clients: await page.locator('[data-status="clients"]').innerText(),
  output: await page.locator("[data-output]").innerText(),
  engineId: await page.locator("[data-engine-id]").innerText(),
  reload: await page.locator("[data-reload]").innerText(),
  jobsSinceRestart: await page.locator("[data-jobs-since-restart]").innerText(),
  modelHost: await page.locator("[data-model-host]").innerText(),
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
  const markerResponse = await pageA.request.get(markerUrl);
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
  await pageA.waitForFunction(() => document.querySelector("[data-engine-id]")?.textContent !== "idle");

  await pageA.getByRole("button", { name: "メトリクス更新" }).click();
  await pageB.getByRole("button", { name: "メトリクス更新" }).click();
  await pageA.waitForFunction(() => document.querySelector("[data-metrics-notes]")?.textContent !== "No metrics sampled yet.");
  await pageB.waitForFunction(() => document.querySelector("[data-metrics-notes]")?.textContent !== "No metrics sampled yet.");

  const siteA = await readPanel(pageA);
  const siteB = await readPanel(pageB);
  await pageA.getByRole("button", { name: "ワーカー再起動" }).click();
  await pageA.waitForFunction(() => document.querySelector("[data-engine-id]")?.textContent === "idle");
  await pageA.waitForFunction(() => document.querySelector("[data-jobs-since-restart]")?.textContent === "0");
  const afterRestart = {
    engineId: await pageA.locator("[data-engine-id]").innerText(),
    jobsSinceRestart: await pageA.locator("[data-jobs-since-restart]").innerText(),
    reload: await pageA.locator("[data-reload]").innerText()
  };
  const result = {
    executablePath,
    baseUrl,
    modelMirrorMarker: {
      url: markerUrl,
      ok: markerResponse.ok(),
      status: markerResponse.status()
    },
    sameBroker: siteA.brokerId === siteB.brokerId,
    restartWorked: afterRestart.engineId === "idle" && afterRestart.jobsSinceRestart === "0",
    siteA,
    siteB,
    afterRestart
  };

  await mkdir(screenshotDir, { recursive: true });
  const screenshotWarnings = [];
  await pageA.screenshot({ path: join(screenshotDir, "site-a-metrics.png"), fullPage: false, timeout: 10000 })
    .catch((error) => screenshotWarnings.push(`Site A screenshot skipped: ${error.message}`));
  await pageB.screenshot({ path: join(screenshotDir, "site-b-metrics.png"), fullPage: false, timeout: 10000 })
    .catch((error) => screenshotWarnings.push(`Site B screenshot skipped: ${error.message}`));

  console.log(JSON.stringify(result, null, 2));
  if (screenshotWarnings.length > 0) {
    console.warn(screenshotWarnings.join("\n"));
  }

  if (!result.sameBroker) {
    throw new Error("Site A and Site B did not connect to the same SharedWorker broker.");
  }
  if (!result.modelMirrorMarker.ok) {
    throw new Error("Same-origin model mirror marker was not served correctly.");
  }
  if (!siteA.reload.includes("reload")) {
    throw new Error("Reload status did not become recommended after the configured threshold.");
  }
  if (!result.restartWorked) {
    throw new Error("Worker restart did not reset the persistent engine state.");
  }
} finally {
  if (!headless) {
    await pageA.waitForTimeout(1500);
  }
  await browser.close();
}
