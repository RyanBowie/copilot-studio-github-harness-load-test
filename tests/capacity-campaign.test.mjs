import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { validateReport } from "../src/validate.mjs";
import { summarizeCapacity, summarizeCapacityStudies } from "../src/capacity.mjs";
import { syntheticCapacityReport } from "./fixtures/synthetic-capacity-report.mjs";
import { syntheticPacedReport } from "./fixtures/synthetic-paced-report.mjs";

const schema = JSON.parse(await readFile(new URL("../schema/report.schema.json", import.meta.url), "utf8"));
const reject = (change, pattern, scenario = "two-hours") => {
  const report = syntheticCapacityReport(scenario);
  change(report);
  assert.match(validateReport(report, schema).join("\n"), pattern);
};

test("capacity additions preserve all twelve previously reviewed runs and campaign contexts", async () => {
  const report = JSON.parse(await readFile(new URL("../data/report.json", import.meta.url), "utf8"));
  const history = {
    runs: report.runs.slice(0, 12),
    pacedCampaigns: report.pacedCampaigns.slice(0, 3),
    documentedLimits: report.documentedLimits,
    studyContext: report.studyContext
  };
  assert.equal(createHash("sha256").update(JSON.stringify(history)).digest("hex"), "6a6ec17246a26cb0e6206066ffe8d245faf55c1e42ac88f3762cf304337f865a");
});

test("all capacity scenarios are explicitly synthetic valid aggregate shapes", () => {
  for (const scenario of ["two-hours", "one-hour", "screens", "fallback", "no-candidate", "hour-failure", "safety-stop", "progress"]) {
    const report = syntheticCapacityReport(scenario);
    assert.deepEqual(validateReport(report, schema), [], scenario);
    assert.ok(report.runs.every((run) => run.runKey.startsWith("offline-")));
  }
});

test("six strict five-minute screens plus two fixed-rate hours reach the 7125 maximum", () => {
  const report = syntheticCapacityReport();
  assert.equal(report.runs.reduce((sum, run) => sum + run.counts.attempted, 0), 7125);
  assert.deepEqual(report.runs.slice(0, 6).map((run) => run.pacedMeasurement.plannedSlots), [125, 150, 175, 200, 225, 250]);
  assert.deepEqual(report.runs.slice(0, 6).map((run) => run.pacedMeasurement.pacing.observedMinIntervalMs),
    [25, 30, 35, 40, 45, 50].map((rate) => 60000 / rate * 0.95));
  const [study] = summarizeCapacityStudies(report.runs);
  assert.equal(study.validatedRpm, 50);
  assert.equal(study.upperBoundaryUnbracketed, true);
  assert.equal(summarizeCapacity(report.runs)[0].highestQualifiedRpm, null, "strict screens are not historical 99% calibrations");
  assert.equal(study.hours[0].pacedMeasurement.capacityEvidence.successfulWithinArrivalWindow, 2999);
  assert.equal(study.hours[0].counts.completed, 3000, "inside-hour completions are distinct from eventual cohort successes");
});

test("no validated rate before both clean hours; an ordinary failed screen permits only its earlier clean candidate", () => {
  for (const scenario of ["one-hour", "screens", "no-candidate", "hour-failure", "safety-stop", "progress"]) {
    assert.equal(summarizeCapacityStudies(syntheticCapacityReport(scenario).runs)[0].validatedRpm, null, scenario);
  }
  const [fallback] = summarizeCapacityStudies(syntheticCapacityReport("fallback").runs);
  assert.equal(fallback.validatedRpm, 25);
  assert.equal(fallback.upperBoundaryUnbracketed, false);
  assert.equal(fallback.screens.at(-1).pacedMeasurement.qualification, "not_qualified");
  const [none] = summarizeCapacityStudies(syntheticCapacityReport("no-candidate").runs);
  assert.equal(none.highestCleanScreen, null);
  assert.equal(none.hours.length, 0);
});

test("one disconnected first attempt is reportable without manufactured conversation, success or pacing samples", () => {
  const report = syntheticCapacityReport("no-candidate");
  const run = report.runs[0], paced = run.pacedMeasurement;
  run.counts = { attempted: 1, completed: 0, failed: 1, pending: 0 };
  run.units.conversations = 0;
  run.errors = [{ category: "transport", count: 1, evidence: "native_disconnected_no_conversation" }];
  Object.assign(paced, { unofferedSlots: 124, failedConversations: 0, success: null, allOutcomes: { ...paced.failure } });
  Object.assign(paced.pacing, { observedMinIntervalMs: null, violatingIntervals: null });
  Object.assign(paced.capacityEvidence, {
    successfulWithinArrivalWindow: 0, successfulAfterArrivalWindow: 0,
    postCloseActivity: "local_bookkeeping_only", pendingAtClose: 0, postCloseNativeReturns: 0
  });
  Object.assign(paced.minutes[0], run.counts);
  assert.deepEqual(validateReport(report, schema), []);
  assert.equal(summarizeCapacityStudies(report.runs)[0].validatedRpm, null);
});

test("capacity evidence is closed, required and cannot silently qualify missing or compromised evidence", () => {
  reject((report) => { delete report.runs[0].pacedMeasurement.capacityEvidence; }, /explicit clock and evidence/);
  for (const [key, value] of [["clockStatus", "unknown"], ["clockStatus", "compromised"], ["evidenceStatus", "incomplete"], ["evidenceStatus", "unknown"]]) {
    reject((report) => { report.runs[0].pacedMeasurement.capacityEvidence[key] = value; }, /capacity qualification/, "progress");
  }
  reject((report) => { report.runs[0].pacedMeasurement.capacityEvidence.raw = "forbidden"; }, /unknown field/);
  reject((report) => { report.runs[0].pacedMeasurement.capacityEvidence.successfulWithinArrivalWindow--; }, /partition eventual successes/);
  reject((report) => { report.runs[0].pacedMeasurement.capacityEvidence.successfulAfterArrivalWindow = null; }, /must be paired/);
  const unknown = syntheticCapacityReport("progress");
  Object.assign(unknown.runs[0].pacedMeasurement.capacityEvidence, { successfulWithinArrivalWindow: null, successfulAfterArrivalWindow: null });
  assert.deepEqual(validateReport(unknown, schema), [], "unknown completion clocks remain null, never inferred from dispatch buckets");
});

test("strict qualification does not round nonzero failures or substitute intended units for verified counts", () => {
  for (const change of [
    (run) => { run.units.conversations--; },
    (run) => { run.pacedMeasurement.arrivalEndObservedSeconds--; run.windowSeconds--; },
    (run) => { run.pacedMeasurement.failedConversations = null; },
    (run) => { run.pacedMeasurement.pacing.observedMinIntervalMs = null; run.pacedMeasurement.pacing.violatingIntervals = null; },
    (run) => { run.counts.completed--; run.counts.failed++; },
    (run) => { run.counts.completed--; run.counts.pending++; },
    (run) => { run.pacedMeasurement.skippedSlots++; },
    (run) => { run.pacedMeasurement.unofferedSlots++; }
  ]) reject((report) => change(report.runs[0]), /capacity qualification/, "progress");
  reject((report) => { report.runs[0].pacedMeasurement.runnerRetries = 1; }, /contract constant/);
  reject((report) => { report.runs[0].pacedMeasurement.qualification = "not_evaluated"; }, /capacity qualification/);
  reject((report) => { report.runs[0].pacedMeasurement.genericErrorPolicy = "count_without_early_stop"; }, /only to a separate retest/);
});

test("stage order, same configuration, fixed selection and quiet period are enforced", () => {
  reject((report) => { report.runs.splice(0, 1); }, /ordered rate prefix/);
  reject((report) => { report.runs.splice(1, 1); }, /ordered rate prefix/);
  reject((report) => { report.runs[6].pacedMeasurement.qualifyingRunKey = report.runs[0].runKey; }, /highest prior clean screen/);
  reject((report) => { report.runs[7].pacedMeasurement.targetRpm = 45; }, /highest prior clean screen/);
  reject((report) => { report.runs[1].memory = "on"; }, /recorded target configuration/);
  reject((report) => { report.runs[1].pacedMeasurement.startedAt = report.runs[0].pacedMeasurement.observedThroughAt; }, /60 seconds of quiet/);
  reject((report) => { report.runs.splice(5, 1); }, /unfinished clean screening sequence/);
  reject((report) => { report.runs[7].pacedMeasurement.qualification = "not_evaluated"; }, /capacity qualification/);
  reject((report) => { const copy = structuredClone(report.runs[7]); copy.runKey = "offline-third-hour"; report.runs.push(copy); }, /two hours within 7125/);
  reject((report) => { report.runs[7].pacedMeasurement.campaignKey = "offline-isolated-hour"; }, /highest prior clean screen/);
  reject((report) => { report.runs[7].pacedMeasurement.observedThroughAt = "2026-01-10T06:00:00.000Z"; }, /12600-second/);
});

test("ordinary first non-success stops escalation; explicit safety or a failed hour forbids fallback and continuation", () => {
  for (const reason of ["safety", "client_pacing", "authentication", "explicit_throttle", "account_guard", "observation_cutoff", "manual_stop"]) {
    reject((report) => { report.runs[1].pacedMeasurement.stopReason = reason; }, /whole-study safety/, "fallback");
  }
  reject((report) => { report.runs[1].pacedMeasurement.capacityEvidence.evidenceStatus = "incomplete"; }, /whole-study safety/, "fallback");
  reject((report) => { report.runs[1].pacedMeasurement.capacityEvidence.clockStatus = "compromised"; }, /whole-study safety/, "fallback");
  reject((report) => { report.runs[1].pacedMeasurement.stopReason = "generic_error_threshold"; }, /first non-success/, "fallback");
  reject((report) => { report.runs[1].errors[0].category = "throttling"; }, /cannot disguise|whole-study safety/, "fallback");
  reject((report) => { report.runs[2].pacedMeasurement.phase = "capacity_screen"; }, /ordered rate prefix|whole-study safety/, "fallback");
  const failedHour = syntheticCapacityReport("hour-failure");
  const second = structuredClone(failedHour.runs.at(-1));
  second.runKey = "offline-forbidden-second";
  failedHour.runs.push(second);
  assert.match(validateReport(failedHour, schema).join("\n"), /second requires a strictly qualified first hour/);
});

test("first-call failure in a later screen has no spacing samples but can select an earlier clean screen", () => {
  const report = syntheticCapacityReport("fallback");
  const run = report.runs[1], paced = run.pacedMeasurement;
  run.counts = { attempted: 1, completed: 0, failed: 1, pending: 0 };
  run.units.conversations = 0;
  run.errors = [{ category: "transport", count: 1, evidence: "native_disconnected_no_conversation" }];
  Object.assign(paced, { unofferedSlots: 149, failedConversations: 0, success: null, allOutcomes: { ...paced.failure } });
  Object.assign(paced.minutes[0], run.counts);
  Object.assign(paced.pacing, { observedMinIntervalMs: null, violatingIntervals: null });
  Object.assign(paced.capacityEvidence, {
    successfulWithinArrivalWindow: 0, successfulAfterArrivalWindow: 0,
    postCloseActivity: "local_bookkeeping_only", pendingAtClose: 0, postCloseNativeReturns: 0
  });
  assert.deepEqual(validateReport(report, schema), []);
  assert.equal(summarizeCapacityStudies(report.runs)[0].validatedRpm, 25);
  paced.drainSeconds = 181;
  run.windowSeconds = paced.arrivalEndObservedSeconds + paced.drainSeconds;
  assert.match(validateReport(report, schema).join("\n"), /whole-study safety/, "deadline overrun must not use ordinary-error fallback");
});

test("request/drain overrun and altered minimum-gap policy cannot qualify", () => {
  reject((report) => { report.runs[0].pacedMeasurement.drainSeconds = 181; report.runs[0].windowSeconds = 481; }, /capacity qualification/, "progress");
  reject((report) => {
    for (const timing of ["success", "allOutcomes"]) report.runs[0].pacedMeasurement[timing].maxMs = 180001;
  }, /capacity qualification/, "progress");
  reject((report) => { report.runs[0].pacedMeasurement.pacing.jitterAllowance = 0; }, /5% allowance/);
  reject((report) => { report.runs[0].pacedMeasurement.pacing.observedMinIntervalMs--; }, /pacing violations/);
  reject((report) => { report.runs[0].pacedMeasurement.targetRpm = 100; }, /this phase's protocol/);
  reject((report) => { report.runs[0].pacedMeasurement.plannedArrivalSeconds = 120; }, /phase duration/);
});

test("historical calibration and hour rules are not relaxed by new phases or their expanded rate enum", () => {
  const legacy = syntheticPacedReport();
  legacy.runs[0].pacedMeasurement.targetRpm = 30;
  assert.match(validateReport(legacy, schema).join("\n"), /this phase's protocol/);
  const mixed = syntheticCapacityReport("progress");
  mixed.runs.push(syntheticPacedReport("calibration").runs[0]);
  mixed.runs[1].pacedMeasurement.campaignKey = mixed.runs[0].pacedMeasurement.campaignKey;
  assert.match(validateReport(mixed, schema).join("\n"), /only up to six screens and two hours/);
  const legacyEvidence = syntheticPacedReport("calibration");
  legacyEvidence.runs[0].pacedMeasurement.capacityEvidence = mixed.runs[0].pacedMeasurement.capacityEvidence;
  assert.match(validateReport(legacyEvidence, schema).join("\n"), /only to the distinct zero-error study/);
});
