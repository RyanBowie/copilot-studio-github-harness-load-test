import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { validateWindowEvidence, summarizeReviewedWindows } from "../src/window-evidence.mjs";
import { renderHtml } from "../scripts/build.mjs";

const readJson = async (path) => JSON.parse(await readFile(new URL(path, import.meta.url), "utf8"));
const report = await readJson("../data/report.json");
const reportSchema = await readJson("../schema/report.schema.json");
const evidence = await readJson("../data/window-evidence.json");
const schema = await readJson("../schema/window-evidence.schema.json");
const find = (key, data = evidence) => data.runs.find((run) => run.runKey === key);
const windows = (run, basis = "observed_through_drain") => run.bases.find((item) => item.basis === basis).windows;
const invalid = (edit) => {
  const data = structuredClone(evidence);
  edit(data);
  assert.notDeepEqual(validateWindowEvidence(data, schema, report), []);
};

test("reviewed supplement reconciles seven existing native cohorts, 46 eligible pairs and 90 independent maxima", () => {
  assert.deepEqual(validateWindowEvidence(evidence, schema, report), []);
  assert.deepEqual(validateWindowEvidence(null, schema, report), []);
  assert.equal(evidence.runs.length, 7);
  assert.equal(evidence.existingNativeAttemptsAnalyzed, 555);
  assert.equal(evidence.newAgentCalls, 0);
  const all = evidence.runs.flatMap((run) => run.bases.flatMap((basis) => basis.windows));
  assert.equal(all.filter((window) => window.dispatchCohortMaximum).length, 46);
  assert.equal(all.filter((window) => window.dispatchCohortMaximum).length + all.filter((window) => window.completionMaximum).length, 90);
  assert.ok(all.filter((window) => window.durationSeconds >= 900).every((window) => window.dispatchCohortMaximum === null && window.completionMaximum === null));
});

test("each through-drain maximum preserves dispatch versus actual-completion populations", () => {
  const expected = {
    "m365-native-burst-100": [[33, null], [33, null]],
    "paced-calibration-10": [[2, 3], [6, 6], [11, 11], [20, 20]],
    "paced-calibration-25": [[5, 6], [13, 15], [26, 27], [50, 50]],
    "paced-calibration-50": [[9, 11], [26, 27], [50, 52], [98, 98]],
    "paced-hour-25-stopped": [[5, 6], [13, 14], [26, 27], [51, 52], [126, 126]],
    "paced-standalone-100-stopped": [[12, 12]],
    "paced-spread-25-completed": [[5, 6], [13, 14], [26, 26], [50, 50]]
  };
  for (const [key, values] of Object.entries(expected)) {
    assert.deepEqual(windows(find(key)).filter((window) => window.dispatchCohortMaximum).map((window) => [
      window.dispatchCohortMaximum.dispatchCohort.eventualSuccesses, window.completionMaximum?.completionsInWindow.successes ?? null
    ]), values);
  }
  const minute = windows(find("paced-calibration-50"))[2].dispatchCohortMaximum.dispatchCohort;
  assert.equal(minute.dispatched, 51);
  assert.equal(minute.eventualFailures, 1);
  const short = windows(find("paced-standalone-100-stopped"))[0].dispatchCohortMaximum.dispatchCohort;
  assert.equal(short.dispatched, 17);
  assert.equal(short.eventualSuccesses, 12);
  assert.equal(short.eventualFailures, 5);
});

test("arrival-only maxima exclude late drain completions and never borrow planned duration", () => {
  for (const [key, arrival, drain] of [
    ["paced-calibration-10", 19, 20], ["paced-calibration-25", 48, 50],
    ["paced-calibration-50", 92, 98], ["paced-spread-25-completed", 47, 50]
  ]) {
    const run = find(key);
    assert.equal(windows(run, "observed_arrival_only")[3].completionMaximum.completionsInWindow.successes, arrival);
    assert.equal(windows(run)[3].completionMaximum.completionsInWindow.successes, drain);
  }
  const standalone = find("paced-standalone-100-stopped");
  assert.equal(windows(standalone, "observed_arrival_only")[0].completionMaximum.completionsInWindow.successes, 6);
  assert.equal(windows(standalone)[0].completionMaximum.completionsInWindow.successes, 12);
  invalid((data) => {
    const coverage = find("paced-calibration-25", data).bases[0].coverage;
    Object.assign(coverage, { endOffsetMs: 120000, durationMs: 120000, endOffsetMsExact: "120000", durationMsExact: "120000" });
  });
});

test("independent maxima retain their own anchors, paired outcomes and boundary-local outstanding counts", () => {
  const window = windows(find("paced-calibration-25"), "observed_arrival_only")[0];
  const d = window.dispatchCohortMaximum, c = window.completionMaximum;
  assert.notEqual(d.window.startOffsetMsExact, c.window.startOffsetMsExact);
  assert.equal(d.dispatchCohort.eventualSuccesses, 5);
  assert.equal(d.completionsInWindow.successes, 1);
  assert.equal(d.dispatchCohort.pendingImmediatelyBeforeWindowEnd, 4);
  assert.equal(d.dispatchCohort.pendingAtEvidenceCutoff, 0);
  assert.equal(c.completionsInWindow.successes, 6);
  assert.equal(c.dispatchCohort.eventualSuccesses, 4);
  assert.equal(c.clientStateBeforeWindowStart.outstandingClientCalls, 5);
  invalid((data) => { windows(find("paced-calibration-25", data))[0].completionMaximum.completionsInWindow.successes++; });
  invalid((data) => { windows(find("paced-calibration-25", data))[0].dispatchCohortMaximum.dispatchCohort.pendingImmediatelyBeforeWindowEnd = 0; });
});

test("exact decimal checks reject sub-floating-point boundary drift and missing full coverage", () => {
  invalid((data) => { windows(find("paced-calibration-10", data))[0].dispatchCohortMaximum.window.endOffsetMsExact = "10000.00000000000000000001"; });
  invalid((data) => { windows(find("paced-calibration-10", data))[0].dispatchCohortMaximum.window.endOffsetMs = 9999; });
  invalid((data) => { const list = windows(find("paced-standalone-100-stopped", data)); list[1].dispatchCohortMaximum = structuredClone(list[0].dispatchCohortMaximum); });
  invalid((data) => { find("paced-calibration-10", data).bases[0].windows.reverse(); });
});

test("burst exact completion maxima remain unavailable and its first-error bound is not duration", () => {
  const burst = find("m365-native-burst-100");
  assert.equal(burst.nativeCompletionOffsetsExact, false);
  assert.equal(burst.firstError.completion.precision, "bounded");
  assert.equal(burst.firstError.completion.lowerMs, 8236.510299999965);
  assert.equal(burst.firstError.completion.upperMs, 8236.516100000008);
  assert.deepEqual(burst.firstError.client, { dispatched: 100, settled: 1, successes: 0, failures: 1, outstandingClientCalls: 99 });
  assert.equal(burst.safetyTrigger, null);
  assert.ok(burst.bases.every((basis) => basis.windows.every((window) => window.completionMaximum === null)));
  invalid((data) => { find("m365-native-burst-100", data).nativeCompletionOffsetsExact = true; });
  invalid((data) => { find("m365-native-burst-100", data).firstError.completion.precision = "exact"; });
  invalid((data) => { windows(find("m365-native-burst-100", data))[0].dispatchCohortMaximum.completionsInWindow = { successes: 1, failures: 1, settled: 2 }; });
});

test("first errors, actual stop triggers and subsequent drain preserve distinct reviewed counts", () => {
  const fifty = find("paced-calibration-50");
  assert.equal(fifty.firstError.completion.lowerMs, 28567.008799999952);
  assert.deepEqual(fifty.firstError.client, { dispatched: 24, settled: 18, successes: 17, failures: 1, outstandingClientCalls: 6 });
  assert.equal(fifty.safetyTrigger, null);
  const hour = find("paced-hour-25-stopped");
  assert.equal(hour.firstError.evidence, "workiq_mcp_transport_429");
  assert.equal(hour.firstError.completion.lowerMs, 511288.4434);
  assert.deepEqual(hour.safetyTrigger.client, { dispatched: 214, settled: 211, successes: 210, failures: 1, outstandingClientCalls: 3 });
  assert.deepEqual(hour.safetyTrigger.settlementsAfterTrigger, { successes: 3, failures: 0, pendingAtFinalCutoff: 0 });
  const short = find("paced-standalone-100-stopped");
  assert.equal(short.firstError.completion.lowerMs, 11802.457199999997);
  assert.deepEqual(short.firstError.client, { dispatched: 20, settled: 7, successes: 6, failures: 1, outstandingClientCalls: 13 });
  assert.equal(short.safetyTrigger.completion.lowerMs, 12473.140500000001);
  assert.deepEqual(short.safetyTrigger.client, { dispatched: 21, settled: 9, successes: 6, failures: 3, outstandingClientCalls: 12 });
  assert.deepEqual(short.safetyTrigger.settlementsAfterTrigger, { successes: 6, failures: 6, pendingAtFinalCutoff: 0 });
  invalid((data) => { find("paced-standalone-100-stopped", data).safetyTrigger.consecutiveGenericFailures = 9; });
  invalid((data) => { find("paced-hour-25-stopped", data).safetyTrigger.reason = "confirmed_throttle"; });
  invalid((data) => { find("paced-hour-25-stopped", data).safetyTrigger.newDispatchesAfterTrigger = 1; });
  invalid((data) => { find("paced-hour-25-stopped", data).safetyTrigger.dispatchClose.precision = "exact"; });
});

test("closed supplemental boundaries reject private metadata, omitted fields and invalid cross-references", () => {
  const shapes = new Map();
  const visit = (value, path = []) => {
    if (!value || typeof value !== "object") return;
    if (!Array.isArray(value)) {
      const shape = Object.keys(value).sort().join("|");
      if (!shapes.has(shape)) shapes.set(shape, path);
    }
    for (const [key, child] of Object.entries(value)) visit(child, [...path, key]);
  };
  visit(evidence);
  for (const path of shapes.values()) {
    invalid((data) => { path.reduce((value, key) => value[key], data)["private-do-not-echo"] = "private-do-not-echo"; });
    invalid((data) => {
      const object = path.reduce((value, key) => value[key], data);
      delete object[Object.keys(object)[0]];
    });
  }
  invalid((data) => { data.runs[0].runKey = "greeting-pilot"; });
  invalid((data) => { data.runs.push(structuredClone(data.runs[0])); });
  invalid((data) => { data.runs[1].campaignKey = "unknown-campaign"; });
  invalid((data) => { data.existingNativeAttemptsAnalyzed++; });
  invalid((data) => { data.reviewedOn = "2026-02-30"; });
  const text = JSON.stringify(evidence);
  assert.doesNotMatch(text, /sourceFingerprint|sha256|confirmed_throttle|conversationId|sharepoint|onmicrosoft|[a-z]:\\\\|https?:|@/i);
  const privateField = structuredClone(evidence);
  privateField["private-do-not-echo"] = "private-do-not-echo";
  assert.doesNotMatch(validateWindowEvidence(privateField, schema, report).join(" "), /private-do-not-echo/);
});

test("cross-run comparison selects independent compatible-cohort maxima without rewriting data", () => {
  const before = structuredClone({ report, evidence });
  const [group] = summarizeReviewedWindows(evidence, report);
  assert.equal(summarizeReviewedWindows(evidence, report).length, 1);
  assert.deepEqual(group.windows.map((window) => [window.seconds, window.dispatch?.successes ?? null, window.completion?.successes ?? null]), [
    [10, 33, 12], [30, 33, 27], [60, 50, 52], [120, 98, 98], [300, 126, 126], [900, null, null], [3600, null, null]
  ]);
  assert.equal(group.windows[0].dispatch.runKey, "m365-native-burst-100");
  assert.equal(group.windows[0].completion.runKey, "paced-standalone-100-stopped");
  const filtered = summarizeReviewedWindows(evidence, report, "observed_arrival_only", "paced-standalone-100-stopped");
  assert.equal(filtered[0].windows[0].completion.successes, 6);
  const alternate = structuredClone(report);
  alternate.runs.find((run) => run.runKey === "paced-calibration-50").model = "Different model";
  assert.equal(summarizeReviewedWindows(evidence, alternate).length, 2);
  assert.deepEqual({ report, evidence }, before);
  assert.deepEqual(summarizeReviewedWindows(null, report), []);
});

test("build embeds the earlier supplemental contract separately from all reviewed primary records", async () => {
  const html = await renderHtml(report, reportSchema, evidence);
  assert.deepEqual(JSON.parse(html.match(/id="window-evidence">([\s\S]*?)<\/script>/)[1]), evidence);
  assert.deepEqual(JSON.parse(html.match(/id="report-data">([\s\S]*?)<\/script>/)[1]), report);
  assert.doesNotMatch(html, /<!-- WINDOW_|import \{ validateAggregateShape/);
  const bad = structuredClone(evidence);
  bad.newAgentCalls = 1;
  await assert.rejects(renderHtml(report, reportSchema, bad), /Supplemental evidence rejected/);
});
