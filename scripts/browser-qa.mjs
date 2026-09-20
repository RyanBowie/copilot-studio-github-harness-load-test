import { chromium } from "@playwright/test";
import { createRequire } from "node:module";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { once } from "node:events";
import { readFile, mkdir, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { build, renderHtml } from "./build.mjs";
import { syntheticPacedReport } from "../tests/fixtures/synthetic-paced-report.mjs";

const require = createRequire(import.meta.url);
const axePath = require.resolve("axe-core/axe.min.js");
const { html, report } = await build();
const schema = JSON.parse(await readFile(new URL("../schema/report.schema.json", import.meta.url), "utf8"));
const emptyHtml = await renderHtml({
  schemaVersion: 1, harness: "GitHub Copilot Harness", outcomeBasis: "requested_operation",
  publication: { status: "awaiting_pilot", reviewedOn: null }, studyContext: null, runs: [], documentedLimits: []
}, schema);
const synthetic = JSON.parse(await readFile(new URL("../tests/fixtures/synthetic-report.json", import.meta.url), "utf8"));
synthetic.runs.push(structuredClone(synthetic.runs[0]));
Object.assign(synthetic.runs[1], {
  runKey: "offline-preview-fixture", surface: "studio_preview", firstVisibleActivity: null, firstVisibleLatency: null, latency: null, arrival: null, concurrency: null, windowSeconds: null,
  cost: { status: "settled", currency: "USD", amount: 0.000001, source: "billing_export", scope: "shared_window", recordedOn: "2026-09-20" }
});
const syntheticHtml = (await renderHtml(synthetic, schema)).replace("<body>", '<body><aside aria-label="Offline QA warning">OFFLINE SYNTHETIC QA FIXTURE - NOT OBSERVED RESULTS</aside>');
const pacedHtml = (await renderHtml(syntheticPacedReport("transport-stop"), schema)).replace("<body>", '<body><aside aria-label="Offline QA warning">OFFLINE SYNTHETIC PACED FIXTURE - NOT OBSERVED RESULTS</aside>');
const rejectedHtml = html.replace('"schemaVersion":1', '"schemaVersion":999');
const server = createServer((request, response) => {
  const path = new URL(request.url, "http://localhost").pathname;
  const json = path === "/report.json" ? report : path === "/report.schema.json" ? schema : null;
  if (json) {
    response.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
    response.end(JSON.stringify(json));
    return;
  }
  const content = path === "/" ? html : path === "/empty" ? emptyHtml : path === "/synthetic" ? syntheticHtml : path === "/paced" ? pacedHtml : path === "/rejected" ? rejectedHtml : null;
  if (content === null) { response.writeHead(404); response.end(); return; }
  response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  response.end(content);
});
server.listen(0, "127.0.0.1");
await once(server, "listening");
const origin = `http://127.0.0.1:${server.address().port}`;
const artifacts = process.env.QA_OUTPUT_DIR ? resolve(process.env.QA_OUTPUT_DIR) : await mkdtemp(resolve(tmpdir(), "github-harness-qa-"));
await mkdir(artifacts, { recursive: true });
let browser;
try {
  assert.equal((await fetch(origin)).status, 200, "owned local server must be responsive");
  browser = await chromium.launch(process.env.QA_BROWSER_CHANNEL ? { channel: process.env.QA_BROWSER_CHANNEL } : {});
  let snapshots = 0;
  for (const width of [320, 390, 1440]) {
    for (const theme of ["light", "dark"]) {
      const context = await browser.newContext({ viewport: { width, height: 1000 }, colorScheme: theme === "light" ? "dark" : "light" });
      await context.route("**/*", (route) => {
        if (route.request().url().startsWith(origin)) return route.continue();
        return route.abort("blockedbyclient");
      });
      const page = await context.newPage();
      const errors = [];
      page.on("pageerror", (error) => errors.push(error.message));
      page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
      for (const view of ["empty", "report"]) {
        await page.goto(`${origin}/${view === "empty" ? "empty" : ""}?scoutTheme=${theme}&keep=qa#overview`);
        const expectedStatus = view === "empty" ? "NOT MEASURED" : "REVIEWED AGGREGATES";
        await page.waitForFunction((expected) => document.querySelector("#publication-status").textContent === expected, expectedStatus);
        assert.equal(await page.locator("html").getAttribute("data-theme"), theme);
        const metrics = await page.locator(".metric-value").allTextContents();
        assert.deepEqual(metrics, view === "empty" ? Array(4).fill("NOT MEASURED") : ["20", "20", "0", "0", "50", "50", "0", "0", "100", "98", "2", "0", "214", "213", "1", "0", "100", "33", "67", "0", "3", "2", "1", "0"]);
        const background = await page.locator("body").evaluate((element) => getComputedStyle(element).backgroundColor);
        assert.equal(background, theme === "light" ? "rgb(242, 242, 248)" : "rgb(23, 23, 23)");
        for (const id of ["overview", "response-time", "throughput", "observations", "methodology", "costs"]) {
          await page.locator(`.section-nav a[href="#${id}"]`).click();
          await page.locator(`#${id}`).waitFor({ state: "visible" });
          assert.equal(await page.locator("main > section:visible").count(), 1);
          assert.equal(await page.locator(`.section-nav a[href="#${id}"]`).getAttribute("aria-current"), "page");
          assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true, `${view}/${width}/${theme}/${id}: no page overflow`);
          await page.addScriptTag({ path: axePath });
          const violations = await page.evaluate(async () => (await window.axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa"] } })).violations.map(({ id, impact, nodes }) => ({ id, impact, count: nodes.length })));
          assert.deepEqual(violations, [], `${view}/${width}/${theme}/${id}: accessibility violations`);
        }
        if (view === "report") {
          assert.equal(await page.locator(".paced-summary").count(), 4);
          const campaign = await page.locator(".campaign-summary").textContent();
          assert.match(campaign, /No full hourly result/);
          assert.match(campaign, /384 attempts \/ 381 greeting replies \/ 3 failures \/ 0 pending/);
          assert.match(campaign, /100 \/ 150 RPM calibration stages were not attempted/);
          assert.match(campaign, /383 distinct returned conversations/);
          assert.match(campaign, /1286|1,286/);
          assert.match(campaign, /213 eventual replies are counted through the following 6\.062 s drain/);
          assert.match(await page.locator("#methodology").textContent(), /150 metadata records.*partial corroboration/);
          assert.match(await page.locator("#methodology").textContent(), /150 of that cohort's 213 successes/);
          assert.match(await page.locator("#methodology").textContent(), /211 completed before the observed arrival-end boundary and two during drain/);
          const hour = page.locator('.paced-summary[data-run-key="paced-hour-25-stopped"]');
          assert.match(await hour.textContent(), /WorkIQ MCP HTTP transport 429; GitHub Copilot Harness attribution unknown/);
          assert.match(await hour.textContent(), /512\.233 s of a planned 3,600 s/);
          assert.match(await hour.textContent(), /1,286 unoffered/);
          const burst = page.locator('.burst-summary[data-run-key="m365-native-burst-100"]');
          assert.match(await burst.textContent(), /100 requests \/ Published Microsoft 365 Copilot/);
          assert.match(await burst.textContent(), /33% greeting reply success/);
          assert.match(await burst.textContent(), /100 outstanding client invocations/);
          assert.match(await burst.textContent(), /1\.6675 ms/);
          assert.match(await burst.textContent(), /67 generic WorkIQ\/Microsoft 365 server_error/);
          assert.doesNotMatch(await burst.textContent(), /same existing conversation|103|105/);
          assert.match(await page.locator("#overview-summary").textContent(), /One existing Teams conversation/);
          assert.match(await page.locator("#overview-summary").textContent(), /No high-volume ramp was performed in this earlier Teams pilot/);
          assert.match(await page.locator("#observations-content").textContent(), /agent message reported a workflow HTTP 504 timeout/);
          assert.match(await page.locator("#observations-content").textContent(), /not independently observed wire-level HTTP status/);
          assert.match(await page.locator("#observations-content").textContent(), /Review workflow still running/);
          assert.match(await page.locator("#observations-content").textContent(), /120\.167 s timing cutoff: 0 successful, 0 failed, 1 pending/);
          assert.match(await page.locator("#observations-content").textContent(), /33 successful reply conversations exactly matched/);
          assert.match(await page.locator("#observations-content").textContent(), /hasMore=true/);
          assert.doesNotMatch(await page.locator("#throughput-content").textContent(), /completed\/min/);
          assert.match(await page.locator("#throughput-content").textContent(), /100 client invocations; backend\/model execution overlap unmeasured/);
          assert.match(await page.locator("#response-content").textContent(), /26,234 ms/);
          const nativeRows = await page.locator("#native-response-content tbody tr").evaluateAll((rows) => rows.map((row) => [...row.cells].map((cell) => cell.textContent)));
          assert.equal(nativeRows.length, 15);
          assert.deepEqual(nativeRows.slice(-3), [
            ["Successful greeting replies", "33", "8.867 s", "17.299 s", "33.442 s", "34.379 s"],
            ["Failed invocations", "67", "8.235 s", "24.965 s", "37.947 s", "39.024 s"],
            ["All invocation outcomes", "100", "8.235 s", "24.526 s", "37.267 s", "39.024 s"]
          ]);
          assert.deepEqual(nativeRows.filter((_, index) => index < 12 && index % 3 === 0).map((row) => [row[1], row[3], row[4]]), [
            ["20", "8.431 s", "10.380 s"], ["50", "8.064 s", "12.842 s"], ["98", "7.644 s", "9.676 s"], ["213", "7.858 s", "9.680 s"]
          ]);
          assert.deepEqual(nativeRows[10], ["Failed invocations", "1", "0.065 s", "0.065 s", "0.065 s", "0.065 s"]);
          assert.doesNotMatch(await page.locator("#response-content").textContent(), /m365-native-burst-100|17\.299/);
          assert.equal((await page.locator("#costs-content").textContent()).match(/PENDING/g).length, 8);
          assert.match(await page.locator("#costs-content").textContent(), /updated 44 minutes earlier/);
          assert.match(await page.locator("#costs-content").textContent(), /stale preburst analytics, not this burst/);
          assert.match(await page.locator("#costs-content").textContent(), /36 old sessions/);
          assert.match(await page.locator("#costs-content").textContent(), /refresh 120 minutes earlier/);
          assert.match(await page.locator("#observations-content").textContent(), /Transport throttling: 1/);
          assert.doesNotMatch(await page.locator("#costs-content").textContent(), /USD|GBP|EUR/);
          assert.deepEqual(await page.locator("#report-data").evaluate((element) => JSON.parse(element.textContent)), report);
          if (width === 1440 && theme === "light") {
            for (const [name, expected] of [["Public aggregate JSON", report], ["JSON schema", schema]]) {
              const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("link", { name, exact: true }).click()]);
              assert.equal(await download.failure(), null);
              const chunks = [];
              for await (const chunk of await download.createReadStream()) chunks.push(chunk);
              assert.deepEqual(JSON.parse(Buffer.concat(chunks).toString("utf8")), expected);
              await download.delete();
            }
          }
        }
        await page.locator("#theme-toggle").click();
        const url = new URL(page.url());
        assert.equal(url.searchParams.get("keep"), "qa");
        assert.equal(url.hash, "#costs");
        assert.equal(url.searchParams.get("scoutTheme"), theme === "light" ? "dark" : "light");
        await page.locator("#theme-toggle").click();
        await page.locator('.section-nav a[href="#overview"]').click();
        await page.screenshot({ path: resolve(artifacts, `${view}-overview-${width}-${theme}.png`), fullPage: true });
        snapshots++;
        await page.locator('.section-nav a[href="#costs"]').click();
        await page.screenshot({ path: resolve(artifacts, `${view}-costs-${width}-${theme}.png`), fullPage: true });
        snapshots++;
        if (view === "report") {
          await page.locator('.section-nav a[href="#response-time"]').click();
          await page.screenshot({ path: resolve(artifacts, `native-timing-${width}-${theme}.png`), fullPage: true });
          snapshots++;
        }
      }
      assert.deepEqual(errors, [], "no browser errors");
      await context.close();
    }
  }
  const context = await browser.newContext({ viewport: { width: 390, height: 900 }, colorScheme: "dark" });
  await context.route("**/*", (route) => route.request().url().startsWith(origin) ? route.continue() : route.abort("blockedbyclient"));
  const page = await context.newPage();
  await page.goto(`${origin}/#response-time`);
  await page.locator("#theme-toggle").waitFor({ state: "visible" });
  assert.equal(await page.locator("html").getAttribute("data-theme"), "dark", "system theme applies without a query override");
  await page.emulateMedia({ colorScheme: "light" });
  await page.waitForFunction(() => document.documentElement.dataset.theme === "light");
  assert.equal(await page.locator("html").getAttribute("data-theme"), "light", "system changes propagate");
  await page.goto(`${origin}/?scoutTheme=invalid#costs`);
  await page.locator("#theme-toggle").waitFor({ state: "visible" });
  assert.equal(await page.locator("html").getAttribute("data-theme"), "light", "invalid theme falls back to system");
  await page.emulateMedia({ media: "print" });
  assert.equal(await page.locator("main > section:visible").count(), 6, "print includes every section");
  await page.emulateMedia({ media: "screen", forcedColors: "active", reducedMotion: "reduce" });
  assert.equal(await page.locator(".hero-gradient").evaluate((element) => getComputedStyle(element).backgroundImage), "none");
  await page.emulateMedia({ forcedColors: "none", reducedMotion: "no-preference" });
  await page.goto(origin);
  await page.keyboard.press("Tab");
  assert.equal(await page.locator(":focus").textContent(), "Skip to report");
  await page.keyboard.press("Enter");
  assert.equal(await page.locator(":focus").getAttribute("id"), "main");
  await page.goto(origin);
  await page.keyboard.press("Tab");
  await page.keyboard.press("Tab");
  assert.equal(await page.locator(":focus").getAttribute("id"), "theme-toggle");
  assert.equal(await page.locator(":focus").evaluate((element) => getComputedStyle(element).outlineWidth), "3px");
  await page.keyboard.press("Tab");
  await page.keyboard.press("Tab");
  await page.keyboard.press("Enter");
  await page.locator("#response-time").waitFor({ state: "visible" });
  await page.goto(`${origin}/synthetic#overview`);
  await page.waitForFunction(() => document.querySelector("#publication-status").textContent === "REVIEWED AGGREGATES");
  assert.match(await page.locator("#run-ledger").textContent(), /Published Teams/);
  assert.match(await page.locator("#run-ledger").textContent(), /Studio Preview/);
  for (const id of ["overview", "response-time", "throughput", "observations", "costs"]) {
    await page.locator(`.section-nav a[href="#${id}"]`).click();
    await page.locator(`#${id}`).waitFor({ state: "visible" });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
    await page.addScriptTag({ path: axePath });
    assert.deepEqual(await page.evaluate(async () => (await window.axe.run()).violations.map(({ id }) => id)), []);
  }
  assert.match(await page.locator("#costs-content").textContent(), /USD 0\.000001/);
  assert.match(await page.locator("#costs-content").textContent(), /PENDING/);
  assert.match(await page.locator("#costs-content").textContent(), /shared window/);
  await page.locator('.section-nav a[href="#response-time"]').click();
  assert.match(await page.locator("#response-content").textContent(), /First activity \(status or answer; not answer latency\)/);
  assert.match(await page.locator("#response-content").textContent(), /First actual answer \(status excluded\)/);
  assert.match(await page.locator("#response-content").textContent(), /8 \/ 8 sent/);
  assert.match(await page.locator("#response-content").textContent(), /5 \/ 5 successful/);
  assert.match(await page.locator("#response-content").textContent(), /feedback controls \+ 0\.5 s stable text/);
  await page.locator('.section-nav a[href="#observations"]').click();
  assert.match(await page.locator("#observations-content").textContent(), /Excluded client setup issue/);
  await page.goto(`${origin}/paced#overview`);
  await page.waitForFunction(() => document.querySelector("#publication-status").textContent === "REVIEWED AGGREGATES");
  assert.equal(await page.locator(".paced-summary").count(), 2);
  assert.equal(await page.locator(".burst-summary").count(), 0);
  assert.match(await page.locator("#overview-summary").textContent(), /585 unoffered client slots/);
  assert.match(await page.locator("#overview-summary").textContent(), /9\.333 achieved client dispatches\/min/);
  assert.match(await page.locator("#overview-summary").textContent(), /WorkIQ MCP HTTP transport 429; GitHub Copilot Harness attribution unknown/);
  for (const id of ["overview", "response-time", "throughput", "observations", "costs"]) {
    await page.locator(`.section-nav a[href="#${id}"]`).click();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
    await page.addScriptTag({ path: axePath });
    assert.deepEqual(await page.evaluate(async () => (await window.axe.run()).violations.map(({ id }) => id)), []);
  }
  assert.match(await page.locator("#native-response-content").textContent(), /Pending invocations.*excluded/);
  assert.match(await page.locator("#throughput-content").textContent(), /not completions occurring within that minute/);
  assert.match(await page.locator("#observations-content").textContent(), /Transport throttling: 1/);
  assert.match(await page.locator("#observations-content").textContent(), /No conversation identifier or Retry-After was exposed/);
  assert.equal((await page.locator("#costs-content").textContent()).match(/PENDING/g).length, 2);
  await page.goto(`${origin}/rejected#overview`);
  await page.locator("#data-error").waitFor({ state: "visible" });
  assert.equal(await page.locator("#publication-status").textContent(), "DATA REJECTED");
  assert.equal(await page.locator(".metric-value").count(), 0);
  assert.equal(await page.locator("#native-response-content").textContent(), "");
  await context.close();
  const offline = await browser.newContext({ offline: true });
  const offlinePage = await offline.newPage();
  await offlinePage.goto(pathToFileURL(fileURLToPath(new URL("../dist/index.html", import.meta.url))).href);
  const expectedStatus = report.publication.status === "reviewed" ? "REVIEWED AGGREGATES" : "NOT MEASURED";
  await offlinePage.waitForFunction((expected) => document.querySelector("#publication-status").textContent === expected, expectedStatus);
  assert.equal(await offlinePage.locator("#data-error").isVisible(), false, "published artifact works offline from disk");
  await offline.close();
  console.log(`Browser QA passed: six viewport/theme combinations, all sections, eight-record integrity, JSON/schema downloads, axe, keyboard, print, forced colors/reduced motion, system theme, offline artifact, synthetic states and rejection. ${snapshots} screenshots: ${artifacts}`);
} finally {
  if (browser) await browser.close();
  await new Promise((done, reject) => server.close((error) => error ? reject(error) : done()));
}
