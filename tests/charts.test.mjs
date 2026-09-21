import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { nativeChartRows, orderRunsByRate } from "../src/charts.mjs";
import { renderHtml } from "../scripts/build.mjs";

const report = JSON.parse(await readFile(new URL("../data/report.json", import.meta.url), "utf8"));
const schema = JSON.parse(await readFile(new URL("../schema/report.schema.json", import.meta.url), "utf8"));

test("paced comparisons increase by intended rate, keep chronological ties and leave burst outside the rate ordering", () => {
  const before = structuredClone(report);
  const expected = [
    "paced-calibration-10", "paced-calibration-25", "paced-hour-25-stopped",
    "paced-spread-25-completed", "capacity-25-transport-stop", "paced-125-25-baseline", "paced-calibration-50", "paced-standalone-100-stopped", "paced-minute-100-local-stop", "paced-elastic-100-completed", "m365-native-burst-100"
  ];
  for (const input of [report.runs, [...report.runs].reverse()]) {
    const ordered = orderRunsByRate(input);
    assert.deepEqual(ordered.filter((run) => run.pacedMeasurement || run.nativeInvocation).map((run) => run.runKey), expected);
    assert.deepEqual(ordered.filter((run) => run.pacedMeasurement).map((run) => run.pacedMeasurement.targetRpm), [10, 25, 25, 25, 25, 25, 50, 100, 100, 100]);
  }
  assert.deepEqual(report, before);
  assert.deepEqual(orderRunsByRate([]), []);
});

test("chart inputs retain every native cohort separately and exclude visible-channel timings", () => {
  const before = structuredClone(report);
  const rows = nativeChartRows(report.runs);
  assert.equal(rows.length, 11);
  assert.deepEqual(rows.map((row) => row.runKey), report.runs.filter((run) => run.nativeInvocation || run.pacedMeasurement).map((run) => run.runKey));
  for (const row of rows) {
    const run = report.runs.find((run) => run.runKey === row.runKey);
    const measurement = run.pacedMeasurement ?? run.nativeInvocation;
    assert.deepEqual(row.counts, run.counts);
    assert.deepEqual(row.percentages, ["completed", "failed", "pending"].map((key) => run.counts[key] / run.counts.attempted * 100));
    assert.deepEqual(row.latencySeconds, measurement.success ? [measurement.success.p50Ms / 1000, measurement.success.p95Ms / 1000] : [null, null]);
    assert.equal(row.successfulSamples, run.counts.completed);
    assert.equal(row.peakOutstanding, measurement.peakOutstanding);
  }
  assert.deepEqual(report, before);
});

test("burst is never labelled as 100 RPM and failed durations never enter reply-percentile bars", () => {
  const rows = nativeChartRows(report.runs);
  const burst = rows.find((row) => row.runKey === "m365-native-burst-100");
  assert.equal(burst.targetRpm, null);
  assert.equal(burst.percentages[0], 33);
  assert.equal(burst.peakOutstanding, 100);
  assert.deepEqual(burst.latencySeconds, [17.2990789, 33.4423959]);
  const stopped = rows.find((row) => row.runKey === "paced-standalone-100-stopped");
  assert.equal(stopped.targetRpm, 100);
  assert.equal(stopped.counts.attempted, 21);
  assert.equal(stopped.successfulSamples, 12);
  assert.equal(stopped.peakOutstanding, 18);
  const spread = rows.find((row) => row.runKey === "paced-spread-25-completed");
  assert.equal(spread.counts.completed, 50);
  assert.equal(spread.peakOutstanding, 5);
});

test("missing native timing and overlap stay unavailable rather than zero-valued chart data", () => {
  assert.deepEqual(nativeChartRows([]), []);
  const synthetic = structuredClone(report.runs.find((run) => run.pacedMeasurement));
  synthetic.runKey = "offline-chart-no-samples";
  synthetic.counts = { attempted: 0, completed: 0, failed: 0, pending: 0 };
  synthetic.pacedMeasurement.success = null;
  synthetic.pacedMeasurement.peakOutstanding = null;
  const [row] = nativeChartRows([synthetic]);
  assert.deepEqual(row.percentages, [null, null, null]);
  assert.deepEqual(row.latencySeconds, [null, null]);
  assert.equal(row.peakOutstanding, null);
});

test("self-contained report embeds charts and Standard-format aggregate sections without altering input", async () => {
  const html = await renderHtml(report, schema);
  assert.match(html, /function nativeChartRows/);
  assert.match(html, /function barChart/);
  assert.doesNotMatch(html, /<!-- CHARTS_JS -->|export function barChart|<canvas/);
  const navigation = html.match(/<nav class="section-nav"[\s\S]*?<\/nav>/)[0];
  assert.deepEqual([...navigation.matchAll(/href="#([^"]+)"/g)].map((match) => match[1]), [
    "overview", "concurrency", "response-time", "throughput", "observations", "answers", "failures", "conversations", "methodology", "costs"
  ]);
  assert.match(html, /identifiers, transcripts, internal citations and screenshots are deliberately not published/);
  const embedded = JSON.parse(html.match(/<script type="application\/json" id="report-data">([\s\S]*?)<\/script>/)[1]);
  assert.deepEqual(embedded, report);
});
