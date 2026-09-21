import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { validateReport } from "../src/validate.mjs";
import { summarizeCapacity, summarizeCapacityStudies } from "../src/capacity.mjs";
import { nativeChartRows, orderRunsByRate } from "../src/charts.mjs";
import { syntheticContinuousRamp } from "./fixtures/synthetic-continuous-ramp.mjs";
import { syntheticCountBaseline } from "./fixtures/synthetic-count-baseline.mjs";

const schema = JSON.parse(await readFile(new URL("../schema/report.schema.json", import.meta.url), "utf8"));
const reject = (change, pattern) => {
  const report = syntheticContinuousRamp();
  change(report.runs[0].rampMeasurement, report.runs[0], report);
  assert.match(validateReport(report, schema).join("\n"), pattern);
};

test("ramp preparation preserves fourteen historical runs and the seven-cohort supplement", async () => {
  const report = JSON.parse(await readFile(new URL("../data/report.json", import.meta.url), "utf8"));
  const history = { runs: report.runs.slice(0, 14), pacedCampaigns: report.pacedCampaigns.slice(0, 3), documentedLimits: report.documentedLimits, studyContext: report.studyContext };
  assert.equal(createHash("sha256").update(JSON.stringify(history)).digest("hex"), "a5aaedefc012f310d9a9685825ce531d397135b2e7532b16c70c0a7b2ea2045b");
  const windows = await readFile(new URL("../data/window-evidence.json", import.meta.url), "utf8");
  assert.equal(createHash("sha256").update(windows.replaceAll("\r\n", "\n")).digest("hex"), "21a8fc3b99dbc7a7325f7fde4cab6c1beb5387029f21f50ccee878b5a59b2d33");
});

test("one full variable-rate hour can offer fewer than the ceiling and cannot qualify fixed rates", () => {
  for (const options of [{}, { failed: 0 }, { disconnected: 1 }, { pending: 3 }]) {
    const report = syntheticContinuousRamp(options);
    assert.deepEqual(validateReport(report, schema), []);
    const run = report.runs[0], ramp = run.rampMeasurement;
    assert.equal(run.counts.attempted, 2190);
    assert.equal(ramp.unusedRequestBudget, 60);
    assert.equal(ramp.arrivalSeconds, 3600);
    assert.equal(ramp.arrivalStatus, "full_window");
    assert.equal(ramp.segments.length, 6);
    assert.deepEqual(summarizeCapacity(report.runs), []);
    assert.deepEqual(summarizeCapacityStudies(report.runs), []);
    assert.equal(ramp.successfulWithinArrivalWindow + ramp.successfulAfterArrivalWindow, run.counts.completed);
    assert.equal(ramp.segments[0].outstandingAtEnd, ramp.segments[1].outstandingAtStart);
  }
});

test("early stop, partial cutoff, and one disconnected failure retain actual prefixes and denominators", () => {
  for (const options of [
    { arrivalSeconds: 650, failed: 1, stopReason: "explicit_throttle" },
    { arrivalSeconds: 600, stopReason: "safety" },
    { arrivalSeconds: 2, failed: 1, disconnected: 1, stopReason: "safety" },
    { arrivalSeconds: 615, failed: 0, pending: 2, stopReason: "observation_cutoff" }
  ]) {
    const report = syntheticContinuousRamp(options);
    assert.deepEqual(validateReport(report, schema), []);
    assert.equal(report.runs[0].rampMeasurement.segments.length, Math.ceil(options.arrivalSeconds / 600));
    assert.equal(report.runs[0].counts.attempted + report.runs[0].rampMeasurement.unusedRequestBudget, 2250);
  }
});

test("ramp unknowns remain explicit, not observed zeros or success-shaped clock evidence", () => {
  const report = syntheticContinuousRamp(), run = report.runs[0], ramp = run.rampMeasurement;
  Object.assign(ramp, {
    clockStatus: "unknown", evidenceStatus: "unknown", peakOutstanding: null, concurrencyVerification: null,
    conversationEvidence: null, failedConversations: null, successfulWithinArrivalWindow: null, successfulAfterArrivalWindow: null
  });
  run.units.conversations = null;
  ramp.pacing.violatingIntervals = null;
  for (const segment of ramp.segments) segment.outstandingAtStart = segment.outstandingAtEnd = null;
  assert.deepEqual(validateReport(report, schema), []);
  assert.equal(nativeChartRows(report.runs)[0].peakOutstanding, null);
  assert.deepEqual(summarizeCapacityStudies(report.runs), []);
});

test("ramp windows and segment accounting reject extensions, reordering, missing and inflated traffic", () => {
  reject((ramp) => { ramp.arrivalSeconds = 3601; }, /must be <= 3600/);
  reject((ramp) => { ramp.arrivalSeconds = 3599; }, /requires 3600 seconds/);
  reject((ramp) => { ramp.arrivalEndObservedSeconds = 3599; }, /actual arrival-end offset/);
  reject((ramp) => { ramp.unusedRequestBudget++; }, /partition 2250/);
  reject((ramp) => { ramp.segments.pop(); }, /observed prefix/);
  reject((ramp) => { ramp.segments.reverse(); }, /contiguous 600-second/);
  reject((ramp) => { ramp.segments[1].targetRpm = 50; }, /contiguous 600-second/);
  reject((ramp) => { ramp.segments[1].durationSeconds = 599; }, /contiguous 600-second/);
  reject((ramp) => { ramp.segments[1].nominalRequests = 500; }, /contiguous 600-second/);
  reject((ramp) => { ramp.segments[1].counts.completed--; }, /partition actual dispatches/);
  reject((ramp) => { ramp.segments[1].counts.attempted--; ramp.segments[1].counts.completed--; }, /sum to the one run/);
  reject((ramp) => { ramp.segments[1].counts.attempted += 11; ramp.segments[1].counts.completed += 11; }, /sum to the one run/);
});

test("ramp carry-over and completion-time counts cannot be replaced by cohort outcomes", () => {
  reject((ramp) => { ramp.segments[1].outstandingAtStart = 0; }, /no invented inter-segment drain/);
  reject((ramp) => { ramp.segments[0].outstandingAtStart = 1; }, /share outstanding calls/);
  reject((ramp) => { ramp.segments[0].outstandingAtEnd = 100; }, /observed client peak/);
  reject((ramp) => { ramp.successfulWithinArrivalWindow++; }, /partition eventual successes/);
  reject((ramp) => { ramp.successfulAfterArrivalWindow = null; }, /must be paired/);
  reject((ramp) => { ramp.segments.at(-1).outstandingAtEnd = 0; }, /post-arrival successful returns/);
  reject((ramp) => {
    ramp.segments.at(-1).outstandingAtEnd = null;
    ramp.successfulWithinArrivalWindow -= 10; ramp.successfulAfterArrivalWindow += 10;
  }, /cannot exceed the observed client peak/);
  reject((ramp) => {
    ramp.peakOutstanding = null; ramp.concurrencyVerification = null;
    ramp.segments.at(-1).outstandingAtEnd = null;
    ramp.successfulWithinArrivalWindow -= 100; ramp.successfulAfterArrivalWindow += 100;
  }, /configured bound/);
  reject((ramp) => {
    const first = ramp.segments[0], second = ramp.segments[1];
    first.counts.completed--; first.counts.pending++;
    second.counts.completed++; second.counts.pending = 0;
    first.outstandingAtEnd = null; second.outstandingAtStart = 0;
  }, /share outstanding calls/);
  reject((ramp) => { ramp.drainStatus = "bounded_cutoff"; }, /no pending invocations/);
});

test("ramp native timings, client evidence and transport identities remain separate", () => {
  reject((ramp) => { ramp.success.sampleCount++; }, /samples must match/);
  reject((ramp) => { ramp.success.p50Ms = 2000; }, /min <= p50 <= p95 <= max/);
  reject((ramp) => { ramp.peakOutstanding = null; }, /matching measurement evidence/);
  reject((ramp) => { ramp.conversationEvidence = null; }, /returned-ID evidence/);
  reject((_, run) => { run.errors[0] = { category: "transport", count: run.counts.failed, evidence: "native_disconnected_no_conversation" }; }, /no returned conversation identifier/);
  reject((ramp) => { ramp.successfulWithinArrivalWindow = 0; }, /partition eventual successes/);
});

test("ramp contract rejects retries, ordinary-error termination, qualification, private fields and mixed phases", () => {
  reject((ramp) => { ramp.pacing.schedule = "absolute_slots"; }, /contract constant/);
  reject((ramp) => { ramp.pacing.intervalBasis = "previous_segment_rate"; }, /contract constant/);
  reject((ramp) => { ramp.pacing.violatingIntervals = 1; }, /explicit safety stop/);
  reject((ramp) => { ramp.runnerRetries = 1; }, /contract constant/);
  reject((ramp) => { ramp.qualification = "qualified"; }, /unknown field/);
  reject((ramp) => { ramp.rawEvents = []; }, /unknown field/);
  reject((ramp) => { ramp.campaignKey = "private@example.com"; }, /unsupported format/);
  reject((ramp) => { ramp.stopReason = "native_error"; }, /not an allowed value/);
  reject((ramp) => { ramp.stopReason = "explicit_throttle"; ramp.arrivalStatus = "stopped"; }, /classified evidence/);
  reject((ramp) => { ramp.stopReason = "authentication"; ramp.arrivalStatus = "stopped"; }, /classified evidence/);
  reject((_, run) => { run.pacedMeasurement = syntheticCountBaseline().runs[0].pacedMeasurement; }, /cannot also be a burst/);
  reject((_, run, report) => { const second = structuredClone(run); second.runKey = "offline-resumed-ramp"; report.runs.push(second); }, /one separate run/);
  reject((ramp, _, report) => {
    const baseline = syntheticCountBaseline().runs[0];
    baseline.pacedMeasurement.campaignKey = ramp.campaignKey;
    report.runs.push(baseline);
  }, /one separate run/);
});

test("ramp charts explicitly distinguish variable-rate runs from fixed-rate cohorts and bursts", async () => {
  const report = JSON.parse(await readFile(new URL("../data/report.json", import.meta.url), "utf8"));
  const ramp = syntheticContinuousRamp().runs[0];
  const runs = [...report.runs, ramp];
  const ordered = orderRunsByRate(runs), rows = nativeChartRows(ordered);
  assert.equal(rows.filter((row) => row.loadShape === "ramp").length, 1);
  assert.equal(rows.filter((row) => row.loadShape === "burst").length, 1);
  assert.equal(rows.filter((row) => row.loadShape === "paced").length, 10);
  assert.equal(rows.at(-2).runKey, ramp.runKey);
  assert.equal(rows.at(-2).targetRpm, null);
  assert.equal(rows.at(-1).loadShape, "burst");
  assert.deepEqual(runs.at(-1), ramp);
  assert.deepEqual(summarizeCapacity(runs), summarizeCapacity(report.runs));
});
