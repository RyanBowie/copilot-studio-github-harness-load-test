import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { validateReport } from "../src/validate.mjs";
import { summarizeCapacityStudies, summarizeCapacity, observedPacedRpm } from "../src/capacity.mjs";

const report = JSON.parse(await readFile(new URL("../data/report.json", import.meta.url), "utf8"));
const schema = JSON.parse(await readFile(new URL("../schema/report.schema.json", import.meta.url), "utf8"));
const run = report.runs.find((item) => item.runKey === "capacity-25-transport-stop");
const paced = run.pacedMeasurement;
const reject = (change, pattern) => {
  const changed = structuredClone(report);
  change(changed.runs.find((item) => item.runKey === run.runKey));
  assert.match(validateReport(changed, schema).join("\n"), pattern);
};

test("reviewed capacity study preserves its one actual disconnected attempt and no clean candidate", () => {
  assert.deepEqual(validateReport(report, schema), []);
  assert.equal(report.runs.length, 16);
  assert.deepEqual(run.counts, { attempted: 1, completed: 0, failed: 1, pending: 0 });
  assert.deepEqual(run.errors, [{ category: "transport", count: 1, evidence: "native_disconnected_no_conversation" }]);
  assert.deepEqual(run.units, { conversations: 0, sessions: null });
  assert.equal(paced.phase, "capacity_screen");
  assert.equal(paced.plannedArrivalSeconds, 300);
  assert.equal(paced.plannedSlots, 125);
  assert.equal(paced.unofferedSlots, 124);
  assert.equal(paced.skippedSlots + paced.runnerRetries, 0);
  assert.equal(paced.stopReason, "native_error");
  assert.equal(paced.peakOutstanding, 1);
  assert.equal(paced.failedConversations, 0);
  assert.equal(paced.qualification, "not_qualified");
  const [study] = summarizeCapacityStudies(report.runs);
  assert.equal(study.screens.length, 1);
  assert.equal(study.hours.length, 0);
  assert.equal(study.highestCleanScreen, null);
  assert.equal(study.validatedRpm, null);
  assert.equal(Object.hasOwn(run, "cost"), false);
});

test("single native failure timing is not successful reply latency or local post-close bookkeeping", () => {
  assert.equal(paced.success, null);
  for (const population of [paced.failure, paced.allOutcomes]) {
    assert.deepEqual(population, {
      sampleCount: 1, minMs: 36.30919999999605, p50Ms: 36.30919999999605,
      p95Ms: 36.30919999999605, maxMs: 36.30919999999605
    });
  }
  assert.equal(paced.arrivalSeconds, 0.04990869999999995);
  assert.equal(paced.arrivalEndObservedSeconds, paced.arrivalSeconds);
  assert.equal(paced.drainSeconds, 1.0497488000000013);
  assert.equal(run.windowSeconds, 1.099657500000001);
  const evidence = paced.capacityEvidence;
  assert.equal(evidence.postCloseActivity, "local_bookkeeping_only");
  assert.equal(evidence.pendingAtClose, 0);
  assert.equal(evidence.postCloseNativeReturns, 0);
  assert.equal(evidence.successfulWithinArrivalWindow + evidence.successfulAfterArrivalWindow, 0);
  assert.equal(evidence.clockStatus, "unknown", "no separate positive clock attestation was supplied");
  assert.equal(evidence.evidenceStatus, "verified_complete");
});

test("exact returned-error and dispatch-close clocks are preserved independently of the later observation loop", () => {
  assert.deepEqual(paced.capacityEvidence.stopTiming, {
    basis: "single_campaign_monotonic_milliseconds",
    stageStartOffsetMs: 3095.5332000000053,
    firstDispatchOffsetMs: 3105.9699000000037,
    firstNonSuccessReturnOffsetMs: 3142.2790999999997,
    stageDispatchCloseOffsetMs: 3145.4419000000053,
    arrivalObservationLoopEndOffsetMs: 4150.018200000006,
    observationEndOffsetMs: 4195.1907000000065,
    campaignFinishedOffsetMs: 4262.225100000003,
    firstDispatchAt: "2026-09-21T17:00:01.656Z",
    firstNonSuccessReturnAt: "2026-09-21T17:00:01.692Z",
    globalSafetyStopTriggered: false
  });
  assert.equal(paced.startedAt, "2026-09-21T17:00:01.646Z");
  assert.equal(paced.arrivalEndedAt, "2026-09-21T17:00:01.696Z");
  assert.equal(paced.observedThroughAt, "2026-09-21T17:00:02.745Z");
});

test("one dispatch cannot manufacture spacing, RPM, a full minute or a new rolling maximum", async () => {
  assert.equal(observedPacedRpm(run), null);
  assert.equal(paced.pacing.observedMinIntervalMs, null);
  assert.equal(paced.pacing.violatingIntervals, null);
  assert.deepEqual(paced.minutes, [{ offsetSeconds: 0, durationSeconds: 0.04990869999999995, attempted: 1, completed: 0, failed: 1, pending: 0 }]);
  assert.ok(summarizeCapacity([run])[0].windows.every((window) => window.best === null && window.clean === null));
  const evidence = await readFile(new URL("../data/window-evidence.json", import.meta.url), "utf8");
  assert.equal(createHash("sha256").update(evidence.replace(/\r\n/g, "\n")).digest("hex"), "21a8fc3b99dbc7a7325f7fde4cab6c1beb5387029f21f50ccee878b5a59b2d33");
  assert.equal(JSON.parse(evidence).runs.some((item) => item.runKey === run.runKey), false);
});

test("altered clocks, invented drain requests and false global-stop/qualification claims are rejected", () => {
  reject((item) => { item.pacedMeasurement.capacityEvidence.stopTiming.firstNonSuccessReturnOffsetMs++; }, /stop clocks/);
  reject((item) => { item.pacedMeasurement.capacityEvidence.stopTiming.stageDispatchCloseOffsetMs++; }, /stop clocks/);
  reject((item) => { item.pacedMeasurement.capacityEvidence.stopTiming.globalSafetyStopTriggered = true; }, /global safety stop/);
  reject((item) => { item.pacedMeasurement.capacityEvidence.stopTiming.firstNonSuccessReturnAt = "2026-99-21T17:00:01.692Z"; }, /real ordered instants/);
  reject((item) => { item.pacedMeasurement.capacityEvidence.postCloseActivity = "draining_requests"; }, /post-close activity/);
  reject((item) => { item.pacedMeasurement.capacityEvidence.postCloseNativeReturns = 1; }, /post-close activity/);
  reject((item) => { item.pacedMeasurement.capacityEvidence.stopTiming.rawResponse = "forbidden"; }, /unknown field/);
  reject((item) => { item.pacedMeasurement.qualification = "qualified"; }, /capacity qualification/);
  reject((item) => { item.units.conversations = 1; }, /no returned conversation identifier/);
});
