import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { validateReport } from "../src/validate.mjs";
import { renderHtml, loadPublicReport } from "../scripts/build.mjs";
import { syntheticPacedReport, syntheticTiming } from "./fixtures/synthetic-paced-report.mjs";

const schema = JSON.parse(await readFile(new URL("../schema/report.schema.json", import.meta.url), "utf8"));
const reject = (edit, expected, scenario = "full") => {
  const report = syntheticPacedReport(scenario);
  const run = report.runs.at(-1);
  edit(run.pacedMeasurement, run, report);
  const errors = validateReport(report, schema);
  assert.ok(errors.length, "unsupported paced facts must fail closed");
  if (expected) assert.match(errors.join("\n"), expected);
};

test("optional paced support keeps the four earlier runs separate from reviewed campaign cohorts", async () => {
  const { report } = await loadPublicReport();
  assert.equal(report.runs.filter((run) => !Object.hasOwn(run, "pacedMeasurement")).length, 4);
  assert.equal(report.runs.find((run) => run.nativeInvocation).counts.attempted, 100);
});

test("synthetic calibration, full hour, stopped and partial cohorts validate independently", async () => {
  for (const scenario of ["calibration", "full", "stopped", "partial", "transport-stop"]) {
    const report = syntheticPacedReport(scenario);
    assert.deepEqual(validateReport(report, schema), [], scenario);
    const html = await renderHtml(report, schema);
    assert.match(html, /offline-paced-calibration/);
  }
});

test("WorkIQ HTTP 429 is a scoped transport throttle, not a harness quota attribution", () => {
  const report = syntheticPacedReport("transport-stop");
  assert.deepEqual(validateReport(report, schema), []);
  const run = report.runs.at(-1);
  assert.equal(run.counts.attempted, 14);
  assert.equal(run.units.conversations, 13);
  assert.equal(run.pacedMeasurement.failedConversations, 0);
  reject((_, run) => { run.errors[0].evidence = "confirmed_throttle"; }, undefined, "transport-stop");
  reject((_, run) => { run.errors[0].category = "agent"; }, /transport-throttling evidence/, "transport-stop");
  reject((_, run) => { run.errors[0].harnessAttribution = "confirmed"; }, undefined, "transport-stop");
  reject((_, run) => { run.errors[0].rawTransportStack = "private"; }, undefined, "transport-stop");
  reject((_, run) => { run.units.conversations = run.counts.attempted; }, /no returned conversation identifier/, "transport-stop");
  reject((paced) => { paced.failedConversations = 1; }, /no returned conversation identifier/, "transport-stop");
});

test("paced surface and endpoint cannot be relabelled as a burst, UI timing or backend overlap", () => {
  reject((_, run) => { run.surface = "published_teams"; }, /exclusive/);
  reject((_, run) => { run.nativeInvocation = {}; });
  reject((paced) => { paced.endpoint = "backend_ttfa"; });
  reject((paced) => { paced.concurrencyBasis = "backend_model_executions"; });
  reject((_, run) => { run.arrival = { attempts: 1, windowSeconds: 1 }; }, /exclude/);
  reject((_, run) => { run.workflow = "involved"; }, /exclude/);
  reject((_, run) => { run.authenticatedAccounts = 2; });
});

test("intended slots, achieved arrivals and drain cannot be conflated", () => {
  reject((paced) => { paced.targetRpm = 151; });
  reject((paced) => { paced.plannedArrivalSeconds = 120; }, /phase duration/);
  reject((paced) => { paced.plannedSlots = 601; }, /planned slots/);
  reject((paced) => { paced.skippedSlots = 1; }, /partition the bounded plan/);
  reject((paced) => { paced.arrivalSeconds = 3601; }, /bounded plan/);
  reject((paced) => { paced.arrivalSeconds = 3599; }, /full arrival window/);
  reject((paced) => { paced.drainSeconds = 0; }, /arrival-end offset plus drain/);
  reject((paced) => { paced.drainStatus = "complete"; }, /pending invocations/, "stopped");
  reject((paced) => { paced.arrivalStatus = "full_window"; }, /full arrival window/, "stopped");
  reject((paced) => { paced.stopReason = null; }, /explicit reason/, "partial");
  reject((paced) => { paced.observedThroughAt = "2026-01-10T00:00:00.000Z"; }, /markers must be ordered/);
  reject((paced) => { paced.startedAt = "2026-02-30T00:00:00.000Z"; }, /real millisecond UTC/);
});

test("per-minute outcomes belong to dispatched requests and reconcile at the same cutoff", () => {
  reject((paced) => { paced.minuteBasis = "completion_clock_minute"; });
  reject((paced) => { paced.minutes.pop(); }, /cover exactly/);
  reject((paced) => { paced.minutes[1].offsetSeconds = 61; }, /contiguous/);
  reject((paced) => { paced.minutes[0].durationSeconds = 59; }, /contiguous/);
  reject((paced) => { paced.minutes[0].completed--; }, /partition actual dispatches/);
  reject((paced) => { paced.minutes[0].attempted++; paced.minutes[0].completed++; }, /totals must equal/);
});

test("qualification enforces all slots, >=99% greeting success and measured healthy pacing", () => {
  const report = syntheticPacedReport("calibration");
  const run = report.runs[0];
  const paced = run.pacedMeasurement;
  run.counts = { attempted: 200, completed: 198, failed: 2, pending: 0 };
  run.units.conversations = 200;
  run.errors = [{ category: "unknown", count: 2, evidence: "unclassified_invocation_failure" }];
  Object.assign(paced, { targetRpm: 100, plannedSlots: 200, failedConversations: 2, success: syntheticTiming(198), failure: syntheticTiming(2), allOutcomes: syntheticTiming(200) });
  paced.pacing.intervalMs = 600;
  paced.pacing.observedMinIntervalMs = 570;
  paced.minutes = [0, 60].map((offsetSeconds) => ({ offsetSeconds, durationSeconds: 60, attempted: 100, completed: 99, failed: 1, pending: 0 }));
  assert.deepEqual(validateReport(report, schema), [], "99% at the 5% pacing boundary can qualify");
  run.counts.completed--;
  run.counts.failed++;
  run.errors[0].count++;
  paced.success = syntheticTiming(197);
  paced.failure = syntheticTiming(3);
  paced.minutes[0].completed--;
  paced.minutes[0].failed++;
  assert.match(validateReport(report, schema).join("\n"), /qualification requires/);
  paced.qualification = "not_qualified";
  assert.deepEqual(validateReport(report, schema), [], "a measured sub-threshold stage stays reportable");
  reject((paced) => { paced.pacing.observedMinIntervalMs = null; paced.pacing.violatingIntervals = null; }, /qualification requires/, "calibration");
  reject((paced) => { paced.qualification = "qualified"; }, /prior qualified calibration/);
});

test("measured pacing violations stay reportable but cannot qualify", () => {
  const report = syntheticPacedReport("calibration");
  const paced = report.runs[0].pacedMeasurement;
  paced.pacing.observedMinIntervalMs = 5699;
  paced.pacing.violatingIntervals = 1;
  paced.qualification = "not_qualified";
  assert.deepEqual(validateReport(report, schema), []);
  reject((paced) => { paced.pacing.observedMinIntervalMs = 0; }, /pacing violations/);
  reject((paced) => { paced.pacing.intervalMs = 400; }, /intended RPM/);
  reject((paced) => { paced.pacing.missedSlotPolicy = "replay_missed"; });
  reject((paced) => { paced.peakOutstanding = 101; });
  reject((paced) => { paced.concurrencyVerification = null; }, /interval-sweep/);
  reject((paced) => { paced.runnerRetries = 1; });
});

test("hour selection requires its own campaign's highest prior qualified rate", () => {
  reject((paced) => { paced.qualifyingRunKey = "missing-stage"; }, /highest prior/);
  reject((paced) => { paced.campaignKey = "different-campaign"; }, /highest prior/);
  reject((_, __, report) => { report.runs[0].pacedMeasurement.qualification = "not_evaluated"; }, /highest prior/);
  reject((_, run, report) => { const duplicate = structuredClone(run); duplicate.runKey = "offline-second-hour"; report.runs.push(duplicate); }, /at most one hour/);
  reject((_, __, report) => { const duplicate = structuredClone(report.runs[0]); duplicate.runKey = "offline-duplicate-stage"; report.runs.push(duplicate); }, /distinct calibration rates/);
  reject((_, __, report) => { report.runs[0].pacedMeasurement.stopReason = "account_guard"; }, /terminal campaign guard/);
  reject((_, __, report) => {
    const earlier = structuredClone(report.runs[0]);
    earlier.runKey = "offline-higher-calibration";
    earlier.counts = { attempted: 50, completed: 50, failed: 0, pending: 0 };
    earlier.units.conversations = 50;
    Object.assign(earlier.pacedMeasurement, {
      startedAt: "2026-01-09T23:55:00.000Z", arrivalEndedAt: "2026-01-09T23:57:00.000Z", observedThroughAt: "2026-01-09T23:57:01.000Z",
      targetRpm: 25, plannedSlots: 50, success: syntheticTiming(50), allOutcomes: syntheticTiming(50),
      minutes: [0, 60].map((offsetSeconds) => ({ offsetSeconds, durationSeconds: 60, attempted: 25, completed: 25, failed: 0, pending: 0 }))
    });
    earlier.observedOn = "2026-01-09";
    earlier.pacedMeasurement.pacing.intervalMs = 2400;
    earlier.pacedMeasurement.pacing.observedMinIntervalMs = 2400;
    report.runs.unshift(earlier);
  }, /highest prior/);
});

test("the full bounded protocol supports 670 calibration plus 9000 hourly requests and 380 ms minimum gaps", () => {
  const report = syntheticPacedReport();
  const stageTemplate = report.runs[0];
  const hourTemplate = report.runs[1];
  const instant = (seconds) => new Date(Date.parse("2026-01-10T00:00:00.000Z") + seconds * 1000).toISOString();
  const cohort = (template, rate, start, duration) => {
    const run = structuredClone(template);
    const count = rate * duration / 60;
    const paced = run.pacedMeasurement;
    run.counts = { attempted: count, completed: count, failed: 0, pending: 0 };
    run.units.conversations = count;
    run.windowSeconds = duration + 1;
    Object.assign(paced, {
      targetRpm: rate, plannedSlots: count, plannedArrivalSeconds: duration, arrivalSeconds: duration, arrivalEndObservedSeconds: duration,
      startedAt: instant(start), arrivalEndedAt: instant(start + duration), observedThroughAt: instant(start + duration + 1),
      peakOutstanding: Math.ceil(rate / 60), success: syntheticTiming(count), allOutcomes: syntheticTiming(count),
      minutes: Array.from({ length: duration / 60 }, (_, index) => ({
        offsetSeconds: index * 60, durationSeconds: 60, attempted: rate, completed: rate, failed: 0, pending: 0
      }))
    });
    paced.pacing.intervalMs = 60000 / rate;
    paced.pacing.observedMinIntervalMs = paced.pacing.intervalMs * 0.95;
    return run;
  };
  report.runs = [10, 25, 50, 100, 150].map((rate, index) => {
    const run = cohort(stageTemplate, rate, index * 181, 120);
    run.runKey = `offline-calibration-${rate}`;
    return run;
  });
  const hour = cohort(hourTemplate, 150, 5 * 181, 3600);
  hour.pacedMeasurement.qualifyingRunKey = report.runs.at(-1).runKey;
  report.runs.push(hour);
  assert.equal(report.runs.reduce((sum, run) => sum + run.counts.attempted, 0), 9670);
  assert.equal(hour.pacedMeasurement.pacing.intervalMs, 400);
  assert.equal(hour.pacedMeasurement.pacing.observedMinIntervalMs, 380);
  assert.deepEqual(validateReport(report, schema), []);
  hour.pacedMeasurement.pacing.observedMinIntervalMs = 379.999;
  assert.match(validateReport(report, schema).join("\n"), /pacing violations/);
});

test("pending invocations are not silently timed or failed; absent observations remain null", () => {
  reject((paced) => { paced.allOutcomes.sampleCount = 14; }, /group's count/, "partial");
  reject((paced) => { paced.failure = null; }, /requires timing/, "partial");
  reject((paced) => { paced.stopReason = "explicit_throttle"; }, /classified throttle/, "stopped");
  reject((paced) => { paced.failedConversations = 2; }, /returned conversation evidence/, "stopped");
  reject((paced) => { paced.conversationEvidence = null; }, /returned conversation evidence/);
  reject((_, run) => { run.cost.amount = 0; }, /unknown costs as zero/);
  const report = syntheticPacedReport("calibration");
  const run = report.runs[0];
  run.counts = { attempted: 1, completed: 0, failed: 0, pending: 1 };
  run.units.conversations = null;
  run.windowSeconds = 1;
  Object.assign(run.pacedMeasurement, {
    arrivalSeconds: 1, arrivalEndObservedSeconds: 1, arrivalEndedAt: "2026-01-10T00:00:01.000Z", observedThroughAt: "2026-01-10T00:00:01.000Z",
    arrivalStatus: "partial", stopReason: "observation_cutoff", unofferedSlots: 19, drainStatus: "bounded_cutoff", drainSeconds: 0,
    qualification: "not_evaluated", conversationEvidence: null, failedConversations: null, success: null, failure: null, allOutcomes: null,
    peakOutstanding: null, concurrencyVerification: null,
    minutes: [{ offsetSeconds: 0, durationSeconds: 1, attempted: 1, completed: 0, failed: 0, pending: 1 }]
  });
  run.pacedMeasurement.pacing.observedMinIntervalMs = null;
  run.pacedMeasurement.pacing.violatingIntervals = null;
  assert.deepEqual(validateReport(report, schema), [], "a partial observation can have no settled latency samples");
});

test("paced nested shapes reject unknown private fields and missing required evidence", () => {
  function paths(value, path = []) {
    if (value === null || typeof value !== "object") return [];
    return [...(Array.isArray(value) ? [] : [path]), ...Object.entries(value).flatMap(([key, child]) => paths(child, [...path, key]))];
  }
  const at = (value, path) => path.reduce((current, key) => current[key], value);
  const template = syntheticPacedReport("stopped").runs.at(-1).pacedMeasurement;
  for (const path of paths(template)) {
    reject((paced) => { at(paced, path).privateRawResponse = "do-not-publish"; }, undefined, "stopped");
    for (const key of Object.keys(at(template, path))) reject((paced) => { delete at(paced, path)[key]; }, undefined, "stopped");
  }
});
