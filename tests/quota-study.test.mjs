import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { validateReport } from "../src/validate.mjs";
import { nativeChartRows } from "../src/charts.mjs";
import { summarizeCapacity, summarizeCapacityStudies } from "../src/capacity.mjs";
import { renderHtml } from "../scripts/build.mjs";

const report = JSON.parse(await readFile(new URL("../data/report.json", import.meta.url), "utf8"));
const schema = JSON.parse(await readFile(new URL("../schema/report.schema.json", import.meta.url), "utf8"));
const key = "quota-recovery-35-local-stop";
const getRun = (data) => data.runs.find((run) => run.runKey === key);
const run = getRun(report), study = run.quotaStudyMeasurement;
const reject = (change, pattern) => {
  const data = structuredClone(report), item = getRun(data);
  change(item.quotaStudyMeasurement, item, data);
  assert.match(validateReport(data, schema).join("\n"), pattern);
};

test("sixteenth actual study preserves all fifteen previous records and the old window supplement", async () => {
  assert.deepEqual(validateReport(report, schema), []);
  assert.equal(report.runs.length, 16);
  const prior = structuredClone(report);
  prior.runs = prior.runs.slice(0, 15);
  assert.equal(createHash("sha256").update(JSON.stringify(prior)).digest("hex"), "bfec418432f7502143a1ea515ba9dd6d96bd57bf5edcfaabc189a549b80a6464");
  const windows = (await readFile(new URL("../data/window-evidence.json", import.meta.url), "utf8")).replace(/\r\n/g, "\n");
  assert.equal(createHash("sha256").update(windows).digest("hex"), "21a8fc3b99dbc7a7325f7fde4cab6c1beb5387029f21f50ccee878b5a59b2d33");
  assert.deepEqual(validateReport(prior, schema), []);
  assert.match(await renderHtml(prior, schema), /function quotaStudyCard/);
});

test("81 attempts retain one native disconnect, separate local stop and no phase2 or recovery observations", () => {
  assert.deepEqual(run.counts, { attempted: 81, completed: 80, failed: 1, pending: 0 });
  assert.deepEqual(run.errors, [{ category: "transport", count: 1, evidence: "native_disconnected_no_conversation" }]);
  assert.equal(run.units.conversations, 80);
  assert.equal(study.peakOutstanding, 8);
  assert.equal(study.firstFailedAttempt, 1);
  assert.equal(study.unofferedLoadSlots, 969);
  assert.equal(study.unusedStudyCeiling, 2479);
  assert.equal(study.identityReads, 1);
  assert.equal(study.recoveryCalls, 0);
  assert.equal(study.runnerRetries, 0);
  assert.equal(study.studyPlanCompleted, false);
  assert.equal(study.localObserverIncident.storedControllerReason, "manual_stop");
  assert.equal(study.localObserverIncident.exception, "PermissionError");
  assert.equal(study.localObserverIncident.errno, 13);
  assert.equal(study.localObserverIncident.notUserCancellation, true);
  assert.equal(study.localObserverIncident.notProviderThrottle, true);
  assert.equal(study.localObserverIncident.atomicReplacementContention, "hypothesis_not_proven");
  assert.equal(run.cost.status, "pending");
  assert.equal(run.cost.amount, null);
  assert.deepEqual(summarizeCapacity([run]), []);
  assert.deepEqual(summarizeCapacityStudies([run]), []);
  assert.equal(nativeChartRows([run])[0].loadShape, "quota_study");
  assert.equal(nativeChartRows([run])[0].targetRpm, 35);
});

test("full60s max-start and max-eventual-greeting windows keep distinct representative populations", () => {
  assert.equal(study.rollingDispatchWindows.length, 1);
  const window = study.rollingDispatchWindows[0];
  assert.equal(window.windowSeconds, 60);
  assert.equal(window.maximumStarts, 35);
  assert.equal(window.maximumEventualGreetings, 35);
  assert.equal(window.startsRepresentativeSeconds, 0);
  assert.equal(window.greetingsRepresentativeSeconds, 1.7535745000000025);
  assert.deepEqual(window.startsWindowCounts, { attempted: 35, completed: 34, failed: 1, pending: 0 });
  assert.deepEqual(window.greetingsWindowCounts, { attempted: 35, completed: 35, failed: 0, pending: 0 });
  assert.equal(window.candidateWindowsChecked, 49);
  assert.equal(window.successfulCallbacksInsideWindowNotInferred, true);
  assert.equal(window.intervalConvention, "start_inclusive_end_exclusive");
});

test("matching monotonic duration populations remain separate from paired event reads and UTC markers", () => {
  assert.equal(study.arrivalSeconds, 140.1724152);
  assert.equal(study.drainSeconds, 6.336280900000013);
  assert.equal(run.windowSeconds, 146.5086961);
  assert.equal(study.pairedClockEvidence.maximumStartReadDeltaMs, 0.03779999999096617);
  assert.equal(study.pairedClockEvidence.maximumCompletionReadDeltaMs, 0.014499999990221113);
  assert.notEqual(Date.parse(study.arrivalEndedAt) - Date.parse(study.startedAt), study.arrivalSeconds * 1000);
  assert.deepEqual(study.success, { sampleCount: 80, minMs: 6577.441099999996, p50Ms: 8240.337799999994, p95Ms: 11816.659800000023, maxMs: 15073.041900000011 });
  assert.equal(study.failure.sampleCount, 1);
  assert.equal(study.failure.maxMs, 24.416700000001583);
  assert.equal(study.allOutcomes.sampleCount, 81);
});

test("study contract rejects invented quota, restart, throttle, user cancellation and duplicate campaign facts", () => {
  reject((study) => { study.numericQuota = 35; }, /unknown field/);
  reject((study) => { study.phase = 2; }, /contract constant/);
  reject((study) => { study.recoveryCalls = 1; }, /contract constant/);
  reject((study) => { study.localObserverIncident.notUserCancellation = false; }, /contract constant/);
  reject((study) => { study.localObserverIncident.atomicReplacementContention = "confirmed"; }, /contract constant/);
  reject((_, run) => { run.errors[0] = { category: "throttling", count: 1, evidence: "workiq_mcp_transport_429" }; }, /no provider throttle/);
  reject((study) => { study.unusedStudyCeiling++; }, /reconcile separately/);
  reject((study) => { study.unofferedLoadSlots--; }, /reconcile separately/);
  reject((_, run) => { run.units.conversations++; }, /verified returned conversations/);
  reject((_, run) => { run.counts.completed--; run.counts.pending++; }, /settled greetings/);
  reject((_, run, data) => { const duplicate = structuredClone(run); duplicate.runKey = "offline-duplicate-study"; data.runs.push(duplicate); }, /one separate run/);
});

test("study contract rejects invalid clocks and success-shaped rolling or partial-window placeholders", () => {
  reject((study) => { study.arrivalSeconds = 1800; }, /ordered monotonic intervals/);
  reject((study) => { study.phaseClock.arrivalObservationLoopEndOffsetMs = study.phaseClock.arrivalEndOffsetMs - 1; }, /ordered monotonic intervals/);
  reject((study) => { study.pairedClockEvidence.maximumStartReadDeltaMs = 1; }, /strictly below/);
  reject((study) => { study.initialQuietEvidence.earliestPermittedIdentityAt = study.initialQuietEvidence.previousControlledRunFinishedAt; }, /quiet eligibility/);
  reject((study) => { study.rollingDispatchWindows[0].windowSeconds = 300; }, /full coverage/);
  reject((study) => { study.rollingDispatchWindows[0].greetingsRepresentativeSeconds = 100; }, /full coverage/);
  reject((study) => { study.rollingDispatchWindows[0].maximumStarts = 34; }, /start\/greeting maxima/);
  reject((study) => { study.rollingDispatchWindows[0].startsWindowCounts.completed = 35; }, /partition its dispatches/);
  reject((study) => { study.rollingDispatchWindows[0].successfulCallbacksInsideWindowNotInferred = false; }, /contract constant/);
  reject((study) => { study.rollingDispatchWindows.push(structuredClone(study.rollingDispatchWindows[0])); }, /durations must be unique/);
  reject((study) => { study.failure = null; }, /must be object/);
});
