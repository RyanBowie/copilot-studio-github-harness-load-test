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
import { syntheticMinuteRetest } from "../tests/fixtures/synthetic-minute-retest.mjs";
import { syntheticCountRetest } from "../tests/fixtures/synthetic-count-retest.mjs";
import { syntheticCountBaseline } from "../tests/fixtures/synthetic-count-baseline.mjs";
import { syntheticCapacityReport } from "../tests/fixtures/synthetic-capacity-report.mjs";

const require = createRequire(import.meta.url);
const focused = process.argv.includes("--focused");
const sectionIds = ["overview", "concurrency", "response-time", "throughput", "observations", "answers", "failures", "conversations", "methodology", "costs"];
const orderedNativeKeys = [
  "paced-calibration-10", "paced-calibration-25", "paced-hour-25-stopped",
  "paced-spread-25-completed", "capacity-25-transport-stop", "paced-125-25-baseline", "paced-calibration-50", "paced-standalone-100-stopped", "paced-minute-100-local-stop", "paced-elastic-100-completed", "m365-native-burst-100"
];
const axePath = require.resolve("axe-core/axe.min.js");
const { html, report, evidence, evidenceSchema } = await build();
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
const minuteCases = [
  ["minute", {}],
  ["minute-clean", { failed: 0 }],
  ["minute-failed", { failed: 100 }],
  ["minute-stopped", { attempted: 21, failed: 1, arrivalSeconds: 13, stopReason: "explicit_throttle" }],
  ["minute-pending", { pending: 2 }]
].map(([path, options]) => ({ path, report: syntheticMinuteRetest(options) }));
minuteCases.push(...[
  ["count", {}], ["count-clean", { failed: 0 }], ["count-failed", { failed: 100 }],
  ["count-disconnected", { failed: 40, disconnected: 1 }],
  ["count-pending", { pending: 2 }],
  ["count-stopped", { attempted: 21, failed: 1, arrivalSeconds: 14, stopReason: "explicit_throttle" }]
].map(([path, options]) => ({ path, report: syntheticCountRetest(options) })));
minuteCases.push(...[
  ["baseline", {}], ["baseline-clean", { failed: 0 }],
  ["baseline-failed", { failed: 125, disconnected: 125 }],
  ["baseline-pending", { pending: 2 }],
  ["baseline-stopped", { attempted: 21, failed: 1, arrivalSeconds: 51, stopReason: "explicit_throttle" }]
].map(([path, options]) => ({ path, report: syntheticCountBaseline(options) })));
const minutePages = new Map(await Promise.all(minuteCases.map(async ({ path, report }) => [path,
  (await renderHtml(report, schema)).replace("<body>", '<body><aside aria-label="Offline QA warning">OFFLINE SYNTHETIC MINUTE RETEST - NOT OBSERVED RESULTS</aside>')])));
const capacityCases = ["two-hours", "one-hour", "no-candidate", "fallback", "hour-failure", "safety-stop"];
const capacityPages = new Map(await Promise.all(capacityCases.map(async (scenario) => [`capacity-${scenario}`,
  (await renderHtml(syntheticCapacityReport(scenario), schema)).replace("<body>", '<body><aside aria-label="Offline QA warning">OFFLINE SYNTHETIC CAPACITY FIXTURE - NOT OBSERVED RESULTS</aside>')])));
const rejectedHtml = html.replace('"schemaVersion":1', '"schemaVersion":999');
const rejectedWindowHtml = html.replace('"newAgentCalls":0', '"newAgentCalls":1');
const server = createServer((request, response) => {
  const path = new URL(request.url, "http://localhost").pathname;
  const json = path === "/report.json" ? report : path === "/report.schema.json" ? schema
    : path === "/window-evidence.json" ? evidence : path === "/window-evidence.schema.json" ? evidenceSchema : null;
  if (json) {
    response.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
    response.end(JSON.stringify(json));
    return;
  }
  const content = path === "/" ? html : path === "/empty" ? emptyHtml : path === "/synthetic" ? syntheticHtml : path === "/paced" ? pacedHtml : path === "/rejected" ? rejectedHtml : path === "/rejected-window" ? rejectedWindowHtml : minutePages.get(path.slice(1)) ?? capacityPages.get(path.slice(1)) ?? null;
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
  for (const width of (focused ? [390, 1440] : [320, 390, 1440])) {
    for (const theme of ["light", "dark"]) {
      if (focused && theme !== (width === 390 ? "dark" : "light")) continue;
      const context = await browser.newContext({ viewport: { width, height: 1000 }, colorScheme: theme === "light" ? "dark" : "light" });
      await context.route("**/*", (route) => {
        if (route.request().url().startsWith(origin)) return route.continue();
        return route.abort("blockedbyclient");
      });
      const page = await context.newPage();
      const errors = [];
      page.on("pageerror", (error) => errors.push(error.message));
      page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
      for (const view of (focused ? ["report"] : ["empty", "report"])) {
        await page.goto(`${origin}/${view === "empty" ? "empty" : ""}?scoutTheme=${theme}&keep=qa#overview`);
        const expectedStatus = view === "empty" ? "NOT MEASURED" : "REVIEWED AGGREGATES";
        await page.waitForFunction((expected) => document.querySelector("#publication-status").textContent === expected, expectedStatus);
        assert.equal(await page.locator("html").getAttribute("data-theme"), theme);
        const metrics = await page.locator("#overview-summary .metric-value").allTextContents();
        assert.deepEqual(metrics, view === "empty" ? Array(4).fill("NOT MEASURED") : ["20", "20", "0", "0", "50", "50", "0", "0", "100", "98", "2", "0", "214", "213", "1", "0", "21", "12", "9", "0", "50", "50", "0", "0", "41", "26", "15", "0", "100", "60", "40", "0", "1", "0", "1", "0", "125", "124", "1", "0", "100", "33", "67", "0", "3", "2", "1", "0"]);
        const background = await page.locator("body").evaluate((element) => getComputedStyle(element).backgroundColor);
        assert.equal(background, theme === "light" ? "rgb(242, 242, 248)" : "rgb(23, 23, 23)");
        for (const id of sectionIds) {
          await page.locator(`.section-nav a[href="#${id}"]`).click();
          await page.locator(`#${id}`).waitFor({ state: "visible" });
          assert.equal(await page.locator("main > section:visible").count(), 1);
          assert.equal(await page.locator(`.section-nav a[href="#${id}"]`).getAttribute("aria-current"), "page");
          assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true, `${view}/${width}/${theme}/${id}: no page overflow`);
          assert.equal(await page.locator(`#${id}`).evaluate((section) => section.querySelector("h2").getBoundingClientRect().top >= document.querySelector(".section-nav").getBoundingClientRect().bottom), true, "sticky navigation must not cover the destination heading");
          assert.deepEqual(await page.locator(`#${id} .benchmark-chart svg text`).evaluateAll((labels) => labels.filter((label) => {
            const box = label.getBBox();
            return box.x < -1 || box.x + box.width > 801;
          }).map((label) => label.textContent)), [], "chart labels must remain inside their scrollable SVG");
          await page.addScriptTag({ path: axePath });
          const violations = await page.evaluate(async () => (await window.axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa"] } })).violations.map(({ id, impact, nodes }) => ({ id, impact, count: nodes.length })));
          assert.deepEqual(violations, [], `${view}/${width}/${theme}/${id}: accessibility violations`);
        }
        if (view === "report") {
          assert.deepEqual(await page.locator("#benchmark-kpis .metric-value").allTextContents(), ["25/min", "50 / 51", "52", "126", "Not measured", "Pending"]);
          assert.equal(await page.locator(".benchmark-chart svg").count(), 8);
          const study = page.locator("#overview-charts [data-capacity-study]");
          const baseline = page.locator("#overview-charts [data-count-baseline]");
          assert.equal(await page.locator("#overview-charts > article").first().getAttribute("data-count-baseline"), "paced-125-25-baseline");
          assert.equal(await baseline.locator("h3").textContent(), "125-request baseline: 1 failed out of 125");
          assert.match(await baseline.textContent(), /124 successful greetings \/ 1 failed invocations \/ 0 pending/);
          assert.match(await baseline.textContent(), /303\.081 s; drain: 6\.062 s/);
          assert.match(await baseline.textContent(), /24\.746 client dispatches\/min/);
          assert.match(await baseline.textContent(), /99\.2% greeting success.*initial disconnect.*3\.081 s/);
          assert.match(await baseline.textContent(), /122 successful replies completed before.*2 completed afterward during drain/);
          assert.match(await baseline.textContent(), /First failed attempt: 1.*291\.735 ms.*all subsequent 124 requests/);
          assert.match(await baseline.textContent(), /clock: verified clean; evidence: verified complete.*peak: 6/);
          assert.match(await baseline.textContent(), /cannot qualify either validation hour/);
          assert.match(await baseline.textContent(), /1 disconnected\/invoke.*124 distinct returned conversations/);
          assert.equal(await page.getByLabel("Dispatch timeline / choose a cohort", { exact: true }).inputValue(), "paced-125-25-baseline");
          assert.equal(await study.locator("h3").textContent(), "No validated rate from this study");
          assert.match(await study.textContent(), /1 actual attempts \/ 0 greeting replies \/ 1 failed invocations \/ 0 pending/);
          assert.match(await study.textContent(), /No clean screen.*no eligible hour candidate/);
          assert.match(await study.textContent(), /1 \/ 125 planned slots actually sent; 124 unoffered \/ 0 skipped/);
          assert.match(await study.textContent(), /disconnected\/invoke.*Remote agent admission is unknown/);
          assert.match(await study.textContent(), /Observed spacing and offered rate are not measured/);
          assert.match(await study.textContent(), /1\.05 s local post-close bookkeeping.*not server-drain latency/);
          const actualCapacity = page.locator('.paced-summary[data-run-key="capacity-25-transport-stop"]');
          assert.match(await actualCapacity.textContent(), /Offered rate not measured.*partial window is not normalized/);
          assert.match(await actualCapacity.textContent(), /First non-success closed this stage; not a rate-limit finding/);
          assert.doesNotMatch(await actualCapacity.textContent(), /Qualification: qualified\.|1,202|1202/);
          const retest = page.locator("#overview-charts [data-minute-retest]");
          assert.equal(await retest.locator("h3").textContent(), "100-request retest: 40 failed out of 100");
          assert.match(await retest.textContent(), /60 successful greetings \/ 40 failed invocations \/ 0 pending/);
          assert.match(await retest.textContent(), /COUNT COMPLETE AND DRAINED.*All 100 planned requests were sent/);
          assert.match(await retest.textContent(), /63\.522 s; drain: 9\.271 s/);
          assert.match(await retest.textContent(), /94\.455 client dispatches\/min/);
          assert.match(await retest.textContent(), /39 generic server_error\/invoke results and 1 disconnected\/invoke/);
          assert.match(await retest.textContent(), /not 40 proven agent\/backend failures.*99 distinct returned conversations/);
          assert.doesNotMatch(await retest.textContent(), /FULL MINUTE AND DRAIN|Retest incomplete/);
          assert.match(await page.locator("#benchmark-kpis").textContent(), /7 reviewed native cohorts only.*Excludes 100\/min local stop.*100\/min target retest/);
          const windowOptions = page.getByLabel("Window cohort", { exact: true }).locator("option");
          assert.equal(await windowOptions.first().textContent(), "All reviewed window cohorts");
          assert.deepEqual(await windowOptions.evaluateAll((options) => options.map((option) => option.value)), ["all", ...orderedNativeKeys.filter((key) => !["paced-minute-100-local-stop", "paced-elastic-100-completed", "capacity-25-transport-stop", "paced-125-25-baseline"].includes(key))]);
          assert.deepEqual(await page.locator('#overview-charts [data-load-shape="paced"] [data-chart-key]').evaluateAll((rows) => rows.map((row) => row.dataset.chartKey)), orderedNativeKeys.slice(0, -1));
          assert.deepEqual(await page.locator('#overview-charts [data-load-shape="burst"] [data-chart-key]').evaluateAll((rows) => rows.map((row) => row.dataset.chartKey)), ["m365-native-burst-100"]);
          assert.match(await page.locator("#rate-success-explanation").textContent(), /every 2\.4 seconds.*every 0\.6 seconds/);
          assert.match(await page.locator("#rate-success-explanation").textContent(), /21 dispatches.*12 eventual greetings and 9 generic invocation errors.*did not complete a full minute/);
          assert.match(await page.locator("#rate-success-explanation").textContent(), /25\/min attempt was not 100% successful: 213\/214 eventual greetings/);
          assert.deepEqual(await page.locator("#reviewed-windows [data-series=dispatch]").evaluateAll((bars) => bars.map((bar) => Number(bar.dataset.value))), [33, 33, 50, 98, 126]);
          assert.deepEqual(await page.locator("#reviewed-windows [data-series=completion]").evaluateAll((bars) => bars.map((bar) => Number(bar.dataset.value))), [12, 27, 52, 98, 126]);
          assert.deepEqual(await page.locator("#window-evidence").evaluate((element) => JSON.parse(element.textContent)), evidence);
          assert.match(await page.locator("#error-timeline").textContent(), /8\.2365103-8\.2365161 s \(inclusive bound/);
          assert.match(await page.locator("#error-timeline").textContent(), /28\.5670088 s \(recorded native callback\)/);
          assert.match(await page.locator("#error-timeline").textContent(), /21 dispatched; 9 settled \(6 successful \/ 3 failed\); 12 client calls outstanding/);
          assert.match(await page.locator("#error-timeline").textContent(), /511\.2884434-511\.2895557 s.*512\.232996 s/);
          assert.deepEqual(await page.locator("#failure-charts [data-series=generic]").evaluateAll((bars) => bars.map((bar) => Number(bar.dataset.value))), [0, 0, 0, 2, 9, 15, 39, 67]);
          assert.deepEqual(await page.locator("#failure-charts [data-series=transport]").evaluateAll((bars) => bars.map((bar) => Number(bar.dataset.value))), [1, 0, 0, 0, 0, 0, 0, 0]);
          assert.deepEqual(await page.locator("#failure-charts [data-series=disconnected]").evaluateAll((bars) => bars.map((bar) => Number(bar.dataset.value))), [0, 1, 1, 0, 0, 0, 1, 0]);
          for (const id of ["overview-charts", "latency-charts", "concurrency-charts"]) {
            assert.deepEqual(await page.locator(`#${id} [data-chart-key]`).evaluateAll((rows) => rows.map((row) => row.dataset.chartKey)), orderedNativeKeys);
            assert.ok((await page.locator(`#${id} svg > desc`).allTextContents()).every((text) => text.length > 0));
          }
          const peaks = await page.locator("#concurrency-charts [data-series=peak]").evaluateAll((bars) => bars.map((bar) => Number(bar.dataset.value)));
          assert.deepEqual(peaks, [3, 5, 5, 5, 1, 6, 9, 18, 17, 15, 100]);
          const replyMedians = await page.locator("#latency-charts [data-series=p50]").evaluateAll((bars) => bars.map((bar) => Number(bar.dataset.value)));
          assert.deepEqual(replyMedians, orderedNativeKeys.map((key) => report.runs.find((run) => run.runKey === key)).filter((run) => run.counts.completed > 0).map((run) => (run.pacedMeasurement ?? run.nativeInvocation).success.p50Ms / 1000));
          assert.equal(await page.locator('#latency-charts [data-chart-key="capacity-25-transport-stop"] rect').count(), 0);
          assert.equal(await page.locator("#stages-content tbody tr").count(), 14);
          assert.equal(await page.locator("#conversations-content tbody tr").count(), 14);
          assert.equal(await page.locator(".capacity-group").count(), 1);
          const capacity = await page.locator("#capacity-summary").textContent();
          assert.match(capacity, /25 intended requests\/min; 2 qualified calibration cohort/);
          assert.match(capacity, /8 minutes \/ 200 \/ 200 \(100%\) eventual replies/);
          assert.match(capacity, /Longest completed paced trial5\.051 minutes/);
          assert.match(capacity, /Full hourly arrival trialNOT ESTABLISHED/);
          assert.match(capacity, /not arbitrary rolling maxima/);
          const capacityRows = await page.locator("#capacity-summary tbody tr").evaluateAll((rows) =>
            rows.map((row) => [row.cells[0].textContent, ...[1, 2].map((index) => row.cells[index].querySelector("strong")?.textContent ?? row.cells[index].textContent)]));
          assert.deepEqual(capacityRows, [
            ["10 seconds", "NOT ESTABLISHED", "NOT ESTABLISHED"],
            ["30 seconds", "NOT ESTABLISHED", "NOT ESTABLISHED"],
            ["1 minute", "55 / 95 (57.895%)", "25 / 25 (100%)"],
            ["2 minutes", "98 / 100 (98%)", "50 / 50 (100%)"],
            ["5 minutes", "125 / 125 (100%)", "125 / 125 (100%)"],
            ["8 minutes", "200 / 200 (100%)", "200 / 200 (100%)"],
            ["15 minutes", "NOT ESTABLISHED", "NOT ESTABLISHED"],
            ["1 hour", "NOT ESTABLISHED", "NOT ESTABLISHED"],
            ["1 day", "NOT ESTABLISHED", "NOT ESTABLISHED"]
          ]);
          const allReliabilityRows = await page.locator("#reliability-content tbody tr").evaluateAll((rows) => rows.map((row) => [...row.cells].map((cell) => cell.textContent)));
          assert.equal(allReliabilityRows.length, 11);
          assert.deepEqual(allReliabilityRows.map((row) => row[0].split(" / ")[0]), orderedNativeKeys);
          assert.deepEqual(allReliabilityRows[4].slice(2, 6), ["0 / 1 (0%)", "1 / 0", "No successful samples", "1 outstanding client calls"]);
          assert.deepEqual(allReliabilityRows[5].slice(2, 6), ["124 / 125 (99.2%)", "1 / 0", "10.427 s", "6 outstanding client calls"]);
          const reliabilityRows = allReliabilityRows.filter((row) => !["capacity-25-transport-stop", "paced-125-25-baseline"].some((key) => row[0].startsWith(key)));
          assert.equal(reliabilityRows.length, 9);
          assert.deepEqual(reliabilityRows.map((row) => [row[2], row[3], row[4]]), [
            ["20 / 20 (100%)", "0 / 0", "10.380 s"],
            ["50 / 50 (100%)", "0 / 0", "12.842 s"],
            ["213 / 214 (99.533%)", "1 / 0", "9.680 s"],
            ["50 / 50 (100%)", "0 / 0", "9.890 s"],
            ["98 / 100 (98%)", "2 / 0", "9.676 s"],
            ["12 / 21 (57.143%)", "9 / 0", "11.334 s"],
            ["26 / 41 (63.415%)", "15 / 0", "10.623 s"],
            ["60 / 100 (60%)", "40 / 0", "9.832 s"],
            ["33 / 100 (33%)", "67 / 0", "33.442 s"]
          ]);
          assert.match(reliabilityRows[2][6], /Arrival stopped.*WorkIQ MCP HTTP transport 429/);
          assert.match(reliabilityRows[5][6], /Generic invocation-error safety threshold/);
          const allFailureRows = await page.locator("#failure-summary tbody tr").evaluateAll((rows) => rows.map((row) => [...row.cells].map((cell) => cell.textContent)));
          assert.equal(allFailureRows.length, 8);
          assert.match(allFailureRows[1][4], /remote admission is unknown/);
          assert.match(allFailureRows[2][3], /Count-bound 303\.081 s.*No arrival stop/);
          assert.match(allFailureRows[2][4], /remote admission is unknown/);
          const failureRows = allFailureRows.filter((row) => !["capacity-25-transport-stop", "paced-125-25-baseline"].includes(row[0]));
          assert.equal(failureRows.length, 6);
          assert.match(failureRows[1][2], /0-60 s: 1 eventual failure among 50 dispatches/);
          assert.match(failureRows[0][2], /480-512\.233 s: 1 eventual failure among 14 dispatches/);
          assert.match(failureRows[0][4], /Harness attribution.*unknown.*Recovery not measured/);
          assert.match(failureRows[2][3], /Final error count.*not the guard's trigger count/);
          assert.match(failureRows[3][3], /Local client pacing\/admission stop; not provider throttling/);
          assert.match(failureRows[4][2], /0-60 s: 40 eventual failures among 95 dispatches/);
          assert.match(failureRows[4][3], /Count-bound 63\.522 s arrival window.*No arrival stop/);
          assert.match(failureRows[4][4], /remote admission is unknown.*not proven agent\/backend failures/);
          assert.match(failureRows[5][2], /exact first-error return time not available/);
          assert.equal(await page.locator(".paced-summary").count(), 10);
          assert.equal(await page.locator("#run-ledger .card").count(), 14);
          assert.equal(report.runs[9].runKey, "paced-spread-25-completed");
          assert.equal(report.runs[10].runKey, "paced-minute-100-local-stop");
          assert.equal(report.runs[11].runKey, "paced-elastic-100-completed");
          assert.equal(report.runs[12].runKey, "capacity-25-transport-stop");
          assert.equal(report.runs[13].runKey, "paced-125-25-baseline");
          const priorRetest = await page.locator('.paced-summary[data-run-key="paced-minute-100-local-stop"]').textContent();
          assert.match(priorRetest, /63\.415% greeting reply success.*41.*26.*15.*0/);
          assert.match(priorRetest, /1 skipped and 58 unoffered.*outside the 41 invocation attempts/);
          const spread = await page.locator('.campaign-summary[data-campaign-key="m365-spread-25"]').textContent();
          assert.match(spread, /PACED CAMPAIGN \/ COMPLETED CALIBRATION/);
          assert.match(spread, /Standalone 25 RPM \/ completed calibration/);
          assert.match(spread, /50 attempts \/ 50 greeting replies \/ 0 failures \/ 0 pending/);
          assert.match(spread, /100% eventual greeting success through drain/);
          assert.match(spread, /full arrival window covered 120 s of a planned 120 s \/ 50 calls; 0 were not offered and 0 were skipped/);
          assert.match(spread, /following 7\.065 s drain.*No hour or automatic continuation/);
          assert.match(spread, /50 distinct returned conversations.*Peak client outstanding: 5, not backend\/model concurrency/);
          assert.doesNotMatch(spread, /STOPPED EARLY|safety stop|Stopped on|No completed two-minute|Not even one full minute|no identifier/);
          const spreadCohort = await page.locator('.paced-summary[data-run-key="paced-spread-25-completed"]').textContent();
          assert.match(spreadCohort, /Campaign: m365-spread-25/);
          assert.match(spreadCohort, /25 achieved client dispatches\/min/);
          assert.match(spreadCohort, /Arrival status: full window; post-close observation: 7\.065 s drain \(complete\)/);
          assert.match(spreadCohort, /No arrival stop recorded.*Qualification: qualified/);
          assert.match(await page.locator("#methodology").textContent(), /configured client-outstanding cap of 100, not five/);
          assert.match(await page.locator("#methodology").textContent(), /Forty-seven replies completed before the observed arrival-end boundary and three during drain/);
          assert.match(await page.locator("#methodology").textContent(), /all 50 successful conversations matched.*150-row page.*hasMore=true/);
          assert.match(await page.locator("#methodology").textContent(), /Elapsed time, cooldown and background conditions could contribute; this is not causal proof/);
          const campaign = await page.locator('.campaign-summary[data-campaign-key="m365-paced-campaign"]').textContent();
          assert.match(campaign, /No full hourly result/);
          assert.match(campaign, /384 attempts \/ 381 greeting replies \/ 3 failures \/ 0 pending/);
          assert.match(campaign, /100 \/ 150 RPM calibration stages were not attempted in this campaign \(m365-paced-campaign\)/);
          assert.match(campaign, /383 distinct returned conversations/);
          assert.match(campaign, /1286|1,286/);
          assert.match(campaign, /213 eventual replies are counted through the following 6\.062 s drain/);
          assert.match(await page.locator("#methodology").textContent(), /150 metadata records.*partial corroboration/);
          assert.match(await page.locator("#methodology").textContent(), /150 of that cohort's 213 successes/);
          assert.match(await page.locator("#methodology").textContent(), /211 completed before the observed arrival-end boundary and two during drain/);
          assert.match(await page.locator("#methodology").textContent(), /100\/150 RPM was not attempted within that original campaign/);
          assert.match(await page.locator("#methodology").textContent(), /third consecutive generic failure stopped dispatch at nine settled outcomes/);
          assert.match(await page.locator("#methodology").textContent(), /all twelve successful conversations.*150-row snapshot.*partial coverage is not proof/);
          const standalone = await page.locator('.campaign-summary[data-campaign-key="m365-standalone-100"]').textContent();
          assert.match(standalone, /Standalone 100 RPM \/ safety stop/);
          assert.match(standalone, /21 attempts \/ 12 greeting replies \/ 9 failures \/ 0 pending/);
          assert.match(standalone, /generic invocation-error safety threshold, not HTTP 429/);
          assert.match(standalone, /57\.143% eventual greeting success through drain/);
          assert.match(standalone, /179 were not offered and 0 were skipped/);
          assert.match(standalone, /Not even one full minute completed/);
          assert.match(standalone, /21 distinct returned conversations/);
          assert.match(standalone, /Peak client outstanding: 18, not backend\/model concurrency/);
          assert.doesNotMatch(standalone, /Stopped on WorkIQ MCP HTTP transport 429|attempt returned no identifier|381 greeting|predeclared 99%/);
          const standaloneCohort = await page.locator('.paced-summary[data-run-key="paced-standalone-100-stopped"]').textContent();
          assert.match(standaloneCohort, /Campaign: m365-standalone-100/);
          assert.match(standaloneCohort, /12\.613 s of a planned 120 s/);
          assert.match(standaloneCohort, /Generic invocation-error safety threshold; not confirmed throttling/);
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
          const allNativeRows = await page.locator("#native-response-content tbody tr").evaluateAll((rows) => rows.map((row) => [...row.cells].map((cell) => cell.textContent)));
          assert.equal(allNativeRows.length, 33);
          assert.deepEqual(allNativeRows.slice(12, 15), [
            ["Successful greeting replies", "No samples", "Not reported", "Not reported", "Not reported", "Not reported"],
            ["Failed invocations", "1", "0.036 s", "0.036 s", "0.036 s", "0.036 s"],
            ["All invocation outcomes", "1", "0.036 s", "0.036 s", "0.036 s", "0.036 s"]
          ]);
          assert.deepEqual(allNativeRows.slice(15, 18), [
            ["Successful greeting replies", "124", "6.148 s", "8.141 s", "10.427 s", "17.592 s"],
            ["Failed invocations", "1", "0.242 s", "0.242 s", "0.242 s", "0.242 s"],
            ["All invocation outcomes", "125", "0.242 s", "8.141 s", "10.427 s", "17.592 s"]
          ]);
          const nativeRows = allNativeRows.filter((_, index) => index < 12 || index >= 18);
          assert.equal(nativeRows.length, 27);
          assert.deepEqual(nativeRows.slice(21, 24), [
            ["Successful greeting replies", "60", "6.535 s", "8.331 s", "9.832 s", "10.604 s"],
            ["Failed invocations", "40", "0.045 s", "3.266 s", "4.173 s", "5.584 s"],
            ["All invocation outcomes", "100", "0.045 s", "7.461 s", "9.753 s", "10.604 s"]
          ]);
          assert.deepEqual(nativeRows.slice(18, 21), [
            ["Successful greeting replies", "26", "7.011 s", "8.670 s", "10.623 s", "10.893 s"],
            ["Failed invocations", "15", "2.738 s", "3.501 s", "4.242 s", "4.242 s"],
            ["All invocation outcomes", "41", "2.738 s", "8.226 s", "10.405 s", "10.893 s"]
          ]);
          assert.deepEqual(nativeRows.slice(15, 18), [
            ["Successful greeting replies", "12", "7.863 s", "9.188 s", "11.334 s", "11.334 s"],
            ["Failed invocations", "9", "3.247 s", "4.054 s", "4.566 s", "4.566 s"],
            ["All invocation outcomes", "21", "3.247 s", "8.285 s", "10.841 s", "11.334 s"]
          ]);
          assert.deepEqual(nativeRows.slice(9, 12), [
            ["Successful greeting replies", "50", "6.687 s", "7.743 s", "9.890 s", "11.947 s"],
            ["Failed invocations", "No samples", "Not reported", "Not reported", "Not reported", "Not reported"],
            ["All invocation outcomes", "50", "6.687 s", "7.743 s", "9.890 s", "11.947 s"]
          ]);
          const spreadMinutes = page.getByRole("table", { name: "paced-spread-25-completed / Rate calibration cohort / outcomes by dispatch minute", exact: true, includeHidden: true });
          assert.deepEqual(await spreadMinutes.locator("tbody tr").evaluateAll((rows) => rows.map((row) => [...row.cells].map((cell) => cell.textContent))), [
            ["0", "60", "25", "25", "0", "0"], ["60", "60", "25", "25", "0", "0"]
          ]);
          const countMinutes = page.getByRole("table", { name: "paced-elastic-100-completed / Count-bound 100-request retest / outcomes by dispatch minute", exact: true, includeHidden: true });
          assert.deepEqual(await countMinutes.locator("tbody tr").evaluateAll((rows) => rows.map((row) => [...row.cells].map((cell) => cell.textContent))), [
            ["0", "60", "95", "55", "40", "0"], ["60", "3.522", "5", "5", "0", "0"]
          ]);
          const baselineMinutes = page.getByRole("table", { name: "paced-125-25-baseline / Count-bound 125-request baseline / outcomes by dispatch minute", exact: true, includeHidden: true });
          assert.deepEqual(await baselineMinutes.locator("tbody tr").evaluateAll((rows) => rows.map((row) => [...row.cells].map((cell) => cell.textContent))), [
            ["0", "60", "25", "24", "1", "0"], ["60", "60", "25", "25", "0", "0"], ["120", "60", "25", "25", "0", "0"],
            ["180", "60", "24", "24", "0", "0"], ["240", "60", "25", "25", "0", "0"], ["300", "3.081", "1", "1", "0", "0"]
          ]);
          assert.deepEqual(nativeRows.slice(-3), [
            ["Successful greeting replies", "33", "8.867 s", "17.299 s", "33.442 s", "34.379 s"],
            ["Failed invocations", "67", "8.235 s", "24.965 s", "37.947 s", "39.024 s"],
            ["All invocation outcomes", "100", "8.235 s", "24.526 s", "37.267 s", "39.024 s"]
          ]);
          assert.deepEqual(nativeRows.filter((_, index) => index < 18 && index % 3 === 0).map((row) => [row[1], row[3], row[4]]), [
            ["20", "8.431 s", "10.380 s"], ["50", "8.064 s", "12.842 s"], ["213", "7.858 s", "9.680 s"],
            ["50", "7.743 s", "9.890 s"], ["98", "7.644 s", "9.676 s"], ["12", "9.188 s", "11.334 s"]
          ]);
          assert.deepEqual(nativeRows[7], ["Failed invocations", "1", "0.065 s", "0.065 s", "0.065 s", "0.065 s"]);
          assert.doesNotMatch(await page.locator("#response-content").textContent(), /m365-native-burst-100|17\.299/);
          assert.equal((await page.locator("#costs-content").textContent()).match(/PENDING/g).length, 14);
          assert.match(await page.locator("#costs-content").textContent(), /updated 44 minutes earlier/);
          assert.match(await page.locator("#costs-content").textContent(), /stale preburst analytics, not this burst/);
          assert.match(await page.locator("#costs-content").textContent(), /36 old sessions/);
          assert.match(await page.locator("#costs-content").textContent(), /refresh 120 minutes earlier/);
          assert.match(await page.locator("#costs-content").textContent(), /417 old sessions.*refresh 60 minutes earlier/);
          assert.match(await page.locator("#costs-content").textContent(), /m365-spread-25.*2026-09-20T21:23:22Z.*417 old sessions.*refresh 60 minutes earlier/);
          assert.match(await page.locator("#observations-content").textContent(), /Transport throttling: 1/);
          assert.doesNotMatch(await page.locator("#costs-content").textContent(), /USD|GBP|EUR/);
          assert.deepEqual(await page.locator("#report-data").evaluate((element) => JSON.parse(element.textContent)), report);
          if (width === 1440 && theme === "light") {
            for (const [name, expected] of [["Public aggregate JSON", report], ["JSON schema", schema], ["Window evidence JSON", evidence], ["Window evidence schema", evidenceSchema]]) {
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
  assert.equal(await page.locator("html").getAttribute("data-theme"), "dark", "dark is the default without a query override");
  await page.emulateMedia({ colorScheme: "light" });
  assert.equal(await page.locator("html").getAttribute("data-theme"), "dark", "system changes do not override the dark default");
  await page.goto(`${origin}/?scoutTheme=invalid#costs`);
  await page.locator("#theme-toggle").waitFor({ state: "visible" });
  assert.equal(await page.locator("html").getAttribute("data-theme"), "dark", "invalid theme falls back to dark");
  await page.emulateMedia({ media: "print" });
  await page.evaluate(() => window.dispatchEvent(new Event("beforeprint")));
  assert.equal(await page.locator("main > section:visible").count(), sectionIds.length, "print includes every section");
  assert.equal(await page.locator("details:not([open])").count(), 0, "print expands detailed evidence");
  await page.evaluate(() => window.dispatchEvent(new Event("afterprint")));
  assert.equal(await page.locator("details[open]").count(), 0, "after print restores collapsed state");
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
  await page.keyboard.press("Tab");
  await page.keyboard.press("Enter");
  await page.locator("#response-time").waitFor({ state: "visible" });
  await page.locator('.section-nav a[href="#overview"]').click();
  await page.getByLabel("Window cohort", { exact: true }).selectOption("paced-standalone-100-stopped");
  assert.match(await page.locator("#reviewed-windows").textContent(), /12 \/ 17 eventual successes/);
  assert.equal(await page.locator("#reviewed-windows [data-series=completion]").getAttribute("data-value"), "12");
  await page.getByLabel("Window coverage", { exact: true }).selectOption("observed_arrival_only");
  assert.equal(await page.locator("#reviewed-windows [data-series=completion]").getAttribute("data-value"), "6");
  await page.getByLabel("Window cohort", { exact: true }).selectOption("m365-native-burst-100");
  assert.equal(await page.locator("#reviewed-windows svg").count(), 0);
  await page.getByLabel("Window coverage", { exact: true }).selectOption("observed_through_drain");
  assert.equal(await page.locator("#reviewed-windows [data-series=completion]").count(), 0);
  assert.deepEqual(await page.locator("#reviewed-windows [data-series=dispatch]").evaluateAll((bars) => bars.map((bar) => Number(bar.dataset.value))), [33, 33]);
  assert.match(await page.locator("#reviewed-windows").textContent(), /Completion unknown/);
  await page.getByLabel("Window cohort", { exact: true }).selectOption("paced-spread-25-completed");
  await page.getByLabel("Window coverage", { exact: true }).selectOption("observed_arrival_only");
  assert.equal(await page.locator('#reviewed-windows [data-chart-key="rolling-120"] [data-series=completion]').getAttribute("data-value"), "47");
  await page.getByLabel("Window coverage", { exact: true }).selectOption("observed_through_drain");
  assert.equal(await page.locator('#reviewed-windows [data-chart-key="rolling-120"] [data-series=completion]').getAttribute("data-value"), "50");
  await page.locator("#reviewed-windows .rolling-details > summary").focus();
  await page.keyboard.press("Enter");
  assert.equal(await page.locator("#reviewed-windows .rolling-details").getAttribute("open"), "");
  await page.locator('.section-nav a[href="#observations"]').click();
  await page.getByLabel("Search stage or model").fill("standalone-100");
  assert.equal(await page.locator("#stages-content tbody tr").count(), 1);
  assert.match(await page.locator("#stages-content tbody").textContent(), /12 \/ 21 \(57\.143%\).*Generic invocation-error safety threshold/);
  await page.getByLabel("Search stage or model").fill("no-such-stage");
  assert.match(await page.locator("#stages-content").textContent(), /No matching stages/);
  assert.equal(await page.locator("#stages-content tbody tr").count(), 0);
  await page.getByLabel("Search stage or model").fill("");
  await page.getByLabel("Surface", { exact: true }).selectOption("published_microsoft365_copilot");
  await page.getByLabel("Outcomes", { exact: true }).selectOption("failed");
  assert.equal(await page.locator("#stages-content tbody tr").count(), 8);
  await page.getByLabel("Sort stages").selectOption("failures");
  assert.match(await page.locator("#stages-content tbody tr").first().textContent(), /m365-native-burst-100/);
  await page.locator('.section-nav a[href="#throughput"]').click();
  await page.getByLabel("Dispatch timeline / choose a cohort").selectOption("paced-standalone-100-stopped");
  assert.equal(await page.locator(".timeline-chart [data-chart-key]").count(), 1);
  assert.match(await page.locator(".timeline-chart").textContent(), /12\.613 s partial bucket/);
  await page.getByLabel("Dispatch timeline / choose a cohort").selectOption("paced-spread-25-completed");
  assert.equal(await page.locator(".timeline-chart [data-chart-key]").count(), 2);
  assert.match(await page.locator("#timeline-content [role=status]").textContent(), /full window.*qualified.*0 unoffered \/ 0 skipped/);
  await page.getByLabel("Dispatch timeline / choose a cohort").selectOption("paced-elastic-100-completed");
  assert.equal(await page.locator(".timeline-chart [data-chart-key]").count(), 2);
  assert.match(await page.locator(".timeline-chart").textContent(), /3\.522 s partial bucket/);
  assert.match(await page.locator("#timeline-content [role=status]").textContent(), /100 \/ 100 planned dispatches.*count complete.*0 unoffered \/ 0 skipped/);
  await page.getByLabel("Dispatch timeline / choose a cohort").selectOption("paced-125-25-baseline");
  assert.equal(await page.locator(".timeline-chart [data-chart-key]").count(), 6);
  assert.match(await page.locator(".timeline-chart").textContent(), /3\.081 s partial bucket/);
  assert.match(await page.locator("#timeline-content [role=status]").textContent(), /125 \/ 125 planned dispatches.*count complete.*Not a two-minute calibration or a zero-error capacity screen.*0 unoffered \/ 0 skipped/);
  await page.locator('.section-nav a[href="#overview"]').click();
  await page.locator("#campaign-details > summary").waitFor({ state: "visible" });
  await page.locator("#campaign-details > summary").focus();
  await page.keyboard.press("Enter");
  assert.equal(await page.locator("#campaign-details").getAttribute("open"), "");
  await page.goto(`${origin}/synthetic#overview`);
  await page.waitForFunction(() => document.querySelector("#publication-status").textContent === "REVIEWED AGGREGATES");
  assert.match(await page.locator("#run-ledger").textContent(), /Published Teams/);
  assert.match(await page.locator("#run-ledger").textContent(), /Studio Preview/);
  for (const id of sectionIds) {
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
  for (const id of sectionIds) {
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
  for (const { path, report: minuteReport } of minuteCases) {
    const run = minuteReport.runs[0];
    const baseline = run.pacedMeasurement.phase === "count_baseline";
    const plan = run.pacedMeasurement.plannedSlots;
    await page.goto(`${origin}/${path}#overview`);
    await page.waitForFunction(() => document.querySelector("#publication-status").textContent === "REVIEWED AGGREGATES");
    assert.equal(await page.locator("#data-error").isVisible(), false);
    const card = page.locator(`#overview-charts [${baseline ? "data-count-baseline" : "data-minute-retest"}]`);
    assert.equal(await card.count(), 1);
    assert.match(await card.textContent(), new RegExp(`${run.counts.completed} successful greetings / ${run.counts.failed} failed invocations / ${run.counts.pending} pending`));
    assert.match(await card.textContent(), baseline ? /without first-error or three-error termination/ : /without the earlier three-error cutoff/);
    if (run.counts.attempted === plan && run.counts.pending === 0) {
      assert.equal(await card.locator("h3").textContent(), `${plan}-request ${baseline ? "baseline" : "retest"}: ${run.counts.failed} failed out of ${plan}`);
      assert.match(await card.textContent(), run.pacedMeasurement.phase !== "minute_retest" ? /COUNT COMPLETE AND DRAINED/ : /FULL MINUTE AND DRAIN/);
    } else {
      assert.match(await card.textContent(), /INCOMPLETE OR UNRESOLVED/);
      assert.doesNotMatch(await card.textContent(), new RegExp(`failed out of ${plan}`));
    }
    if (path === "minute-stopped") assert.match(await card.textContent(), /79 unoffered.*not sent and are not failures/);
    if (run.pacedMeasurement.phase === "count_retest") {
      assert.match(await card.textContent(), /rebased from actual dispatch with no catch-up/);
      assert.match(await card.textContent(), /not proof of 100 starts inside one minute/);
      assert.doesNotMatch(await card.textContent(), /FULL MINUTE AND DRAIN/);
      if (run.counts.attempted === 100) assert.match(await card.textContent(), /90\.909 client dispatches\/min/);
    }
    if (baseline) {
      assert.match(await card.textContent(), /125 total requests, nominally 25\/min.*at least 2400 ms.*300-second plan may extend/);
      assert.match(await card.textContent(), /not proof of sustained 25\/min.*cannot qualify either validation hour/);
      assert.match(await card.textContent(), /neither a resumed zero-error study nor a new 7,125-call campaign/);
      assert.equal(await page.locator("#overview-charts [data-capacity-study]").count(), 0);
      assert.equal(await page.locator("#overview-charts [data-minute-retest]").count(), 0);
      if (run.counts.attempted === 125) assert.match(await card.textContent(), /24\.038 client dispatches\/min/);
      if (path === "baseline-stopped") assert.match(await card.textContent(), /104 unoffered.*not 1\/125/);
      if (path === "baseline-failed") {
        assert.match(await card.textContent(), /125 disconnected\/invoke.*0 distinct returned conversations/);
        assert.equal(await page.locator("#latency-charts rect").count(), 0);
      }
      if (path === "baseline") {
        for (const width of [320, 390, 1440]) for (const theme of ["light", "dark"]) {
          await page.setViewportSize({ width, height: 1000 });
          await page.goto(`${origin}/baseline?scoutTheme=${theme}#overview`);
          assert.equal(await page.locator("html").getAttribute("data-theme"), theme);
          assert.equal(await page.locator("#data-error").isVisible(), false);
          assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
          await page.addScriptTag({ path: axePath });
          assert.deepEqual(await page.evaluate(async () => (await window.axe.run()).violations.map(({ id }) => id)), []);
          await card.screenshot({ path: resolve(artifacts, `synthetic-baseline-${width}-${theme}.png`) });
          snapshots++;
        }
        await page.setViewportSize({ width: 390, height: 900 });
      }
    }
    if (path === "count-disconnected") {
      assert.match(await card.textContent(), /39 generic server_error\/invoke results and 1 disconnected\/invoke/);
      assert.match(await card.textContent(), /99 distinct returned conversations/);
      assert.match(await card.textContent(), /not 40 proven agent\/backend failures/);
      assert.equal(await page.locator("#failure-charts [data-series=generic]").getAttribute("data-value"), "39");
      assert.equal(await page.locator("#failure-charts [data-series=disconnected]").getAttribute("data-value"), "1");
    }
    assert.equal(await page.locator("#benchmark-kpis .metric-value").first().textContent(), "Not measured");
    for (const id of ["overview", "response-time"]) {
      await page.locator(`.section-nav a[href="#${id}"]`).click();
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
      await page.addScriptTag({ path: axePath });
      assert.deepEqual(await page.evaluate(async () => (await window.axe.run()).violations.map(({ id }) => id)), []);
    }
    assert.doesNotMatch(await page.locator("main").textContent(), /NaN|Infinity/);
  }
  for (const scenario of capacityCases) {
    await page.goto(`${origin}/capacity-${scenario}#overview`);
    await page.waitForFunction(() => document.querySelector("#publication-status").textContent === "REVIEWED AGGREGATES");
    const card = page.locator("#overview-charts [data-capacity-study]");
    const expected = scenario === "two-hours" ? "50/min passed the screen and both hours"
      : scenario === "fallback" ? "25/min passed the screen and both hours" : "No validated rate from this study";
    assert.equal(await card.locator("h3").textContent(), expected);
    if (scenario === "two-hours") assert.match(await card.textContent(), /tested lower bound; the maximum remains unbracketed/);
    if (scenario === "one-hour") assert.match(await card.textContent(), /1 \/ 2 strictly qualifying full hours/);
    if (scenario === "no-candidate") assert.match(await card.textContent(), /No clean screen.*no eligible hour candidate/);
    await card.locator("summary").click();
    if (scenario === "two-hours") assert.match(await card.textContent(), /2,999 \/ 1/);
    assert.match(await card.textContent(), /same-session validation, not different-day replication/);
    assert.doesNotMatch(await page.locator("main").textContent(), /NaN|Infinity/);
    for (const id of ["overview", "throughput", "response-time"]) {
      await page.locator(`.section-nav a[href="#${id}"]`).click();
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
      await page.addScriptTag({ path: axePath });
      assert.deepEqual(await page.evaluate(async () => (await window.axe.run()).violations.map(({ id }) => id)), []);
    }
  }
  await page.goto(`${origin}/rejected#overview`);
  await page.locator("#data-error").waitFor({ state: "visible" });
  assert.equal(await page.locator("#publication-status").textContent(), "DATA REJECTED");
  assert.equal(await page.locator(".metric-value").count(), 0);
  assert.equal(await page.locator("#native-response-content").textContent(), "");
  assert.equal(await page.locator(".benchmark-chart").count(), 0);
  for (const id of ["benchmark-kpis", "overview-charts", "latency-charts", "concurrency-charts", "concurrency-content", "stages-content", "timeline-content", "answers-content", "conversations-content", "failure-charts"]) assert.equal(await page.locator(`#${id}`).textContent(), "");
  for (const id of ["capacity-summary", "reliability-content", "failure-summary"]) assert.equal(await page.locator(`#${id}`).textContent(), "");
  await page.goto(`${origin}/rejected-window#overview`);
  await page.locator("#data-error").waitFor({ state: "visible" });
  assert.equal(await page.locator("#publication-status").textContent(), "DATA REJECTED");
  assert.equal(await page.locator(".metric-value, .benchmark-chart").count(), 0);
  assert.equal(await page.locator("#reviewed-windows, #error-timeline").evaluateAll((elements) => elements.every((element) => !element.textContent)), true);
  await context.close();
  const offline = await browser.newContext({ offline: true });
  const offlinePage = await offline.newPage();
  await offlinePage.goto(pathToFileURL(fileURLToPath(new URL("../dist/index.html", import.meta.url))).href);
  const expectedStatus = report.publication.status === "reviewed" ? "REVIEWED AGGREGATES" : "NOT MEASURED";
  await offlinePage.waitForFunction((expected) => document.querySelector("#publication-status").textContent === expected, expectedStatus);
  assert.equal(await offlinePage.locator("#data-error").isVisible(), false, "published artifact works offline from disk");
  await offline.close();
  console.log(`Browser QA passed: ${focused ? "focused 390 dark / 1440 light" : "six viewport/theme combinations"}, ten sections, eight charts, fourteen actual records with prior thirteen preserved, actual125 denominator/duration/first-disconnect/completion boundaries, strict screen/two-hour and baseline synthetic states, four downloads, axe, keyboard, print, forced colors/reduced motion, dark default/explicit theme, offline artifact and rejection paths. ${snapshots} screenshots: ${artifacts}`);
} finally {
  if (browser) await browser.close();
  await new Promise((done, reject) => server.close((error) => error ? reject(error) : done()));
}
