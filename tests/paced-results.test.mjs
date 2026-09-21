import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { validateReport } from "../src/validate.mjs";

const report = JSON.parse(await readFile(new URL("../data/report.json", import.meta.url), "utf8"));
const schema = JSON.parse(await readFile(new URL("../schema/report.schema.json", import.meta.url), "utf8"));
const cohorts = report.runs.filter((run) => run.pacedMeasurement?.campaignKey === "m365-paced-campaign");
const reject = (edit, expected) => {
  const data = structuredClone(report);
  edit(data.pacedCampaigns[0], data);
  const errors = validateReport(data, schema);
  assert.ok(errors.length);
  if (expected) assert.match(errors.join("\n"), expected);
};

test("the original four-cohort 384-request campaign stays separate from other reviewed runs", () => {
  assert.deepEqual(validateReport(report, schema), []);
  assert.equal(report.runs.filter((run) => !run.pacedMeasurement).length, 4);
  assert.deepEqual(cohorts.map((run) => run.runKey), ["paced-calibration-10", "paced-calibration-25", "paced-calibration-50", "paced-hour-25-stopped"]);
  assert.deepEqual(cohorts.map((run) => run.counts), [
    { attempted: 20, completed: 20, failed: 0, pending: 0 },
    { attempted: 50, completed: 50, failed: 0, pending: 0 },
    { attempted: 100, completed: 98, failed: 2, pending: 0 },
    { attempted: 214, completed: 213, failed: 1, pending: 0 }
  ]);
  assert.deepEqual(cohorts.reduce((sum, run) => sum.map((value, index) => value + run.counts[["attempted", "completed", "failed", "pending"][index]]), [0, 0, 0, 0]), [384, 381, 3, 0]);
  for (const run of cohorts) {
    assert.equal(run.authenticatedAccounts, 1);
    assert.equal(run.model, "GPT 5.6 Sol");
    assert.equal(run.environmentType, "developer");
    assert.equal(run.memory, "off");
    assert.equal(run.agentVersion, null);
    for (const key of ["nativeInvocation", "firstVisibleActivity", "firstVisibleLatency", "latency", "arrival", "concurrency"]) assert.equal(run[key], null);
    assert.equal(run.cost.status, "pending");
    assert.equal(run.cost.amount, null);
  }
});

test("25 RPM is qualified calibration, not a full-hour outcome or observed ceiling", () => {
  assert.deepEqual(cohorts.map((run) => run.pacedMeasurement.qualification), ["qualified", "qualified", "not_qualified", "not_evaluated"]);
  const hour = cohorts[3];
  const paced = hour.pacedMeasurement;
  assert.equal(paced.qualifyingRunKey, "paced-calibration-25");
  assert.equal(paced.arrivalStatus, "stopped");
  assert.equal(paced.drainStatus, "complete");
  assert.equal(paced.plannedArrivalSeconds, 3600);
  assert.equal(paced.arrivalSeconds, 512.2330114);
  assert.equal(paced.plannedSlots, 1500);
  assert.equal(paced.unofferedSlots, 1286);
  assert.ok(cohorts.every((run) => run.pacedMeasurement.skippedSlots === 0 && run.pacedMeasurement.runnerRetries === 0));
  assert.deepEqual(report.pacedCampaigns[0].notAttemptedCalibrationRpm, [100, 150]);
  assert.equal(paced.minutes.length, 9);
  assert.deepEqual(paced.minutes.at(-1), { offsetSeconds: 480, durationSeconds: 32.2330114, attempted: 14, completed: 13, failed: 1, pending: 0 });
});

test("arrival end offsets preserve timer overshoot and separate cutoff reads", () => {
  assert.deepEqual(cohorts.map((run) => run.pacedMeasurement.arrivalEndObservedSeconds), [120.01460379999992, 120.00120519999997, 120.00015639999998, 512.2329960000001]);
  assert.deepEqual(cohorts.map((run) => run.windowSeconds), [124.06412389999988, 126.05635489999992, 128.05042099999997, 518.2947663]);
  for (const run of cohorts) {
    const paced = run.pacedMeasurement;
    assert.ok(Math.abs(paced.arrivalEndObservedSeconds + paced.drainSeconds - run.windowSeconds) < 1e-9);
    assert.notEqual(paced.arrivalSeconds + paced.drainSeconds, run.windowSeconds);
  }
  reject((_, data) => {
    const run = data.runs.find((item) => item.runKey === "paced-calibration-10");
    run.windowSeconds = run.pacedMeasurement.arrivalSeconds + run.pacedMeasurement.drainSeconds;
  }, /arrival-end offset/);
});

test("native latency retains success/failure/all populations, including the fast transport error", () => {
  const fields = ["minMs", "p50Ms", "p95Ms", "maxMs"];
  assert.deepEqual(cohorts.map((run) => fields.map((key) => run.pacedMeasurement.success[key])), [
    [7237.50820000004, 8430.715299999923, 10380.288100000005, 12436.311700000078],
    [6473.5156000000425, 8063.917299999972, 12842.208400000003, 21574.082199999946],
    [6142.836799999932, 7643.799399999902, 9676.129199999967, 11853.00820000004],
    [6324.690999999875, 7857.503999999957, 9680.295799999963, 13591.71390000009]
  ]);
  assert.deepEqual(cohorts[2].errors, [{ category: "unknown", count: 2, evidence: "unclassified_invocation_failure" }]);
  assert.deepEqual(cohorts[3].errors, [{ category: "throttling", count: 1, evidence: "workiq_mcp_transport_429" }]);
  assert.equal(cohorts[3].pacedMeasurement.failure.sampleCount, 1);
  assert.equal(cohorts[3].pacedMeasurement.failure.maxMs, 65.2273999999743);
  assert.equal(cohorts[3].pacedMeasurement.allOutcomes.sampleCount, 214);
  assert.equal(cohorts[3].pacedMeasurement.allOutcomes.p50Ms, 7849.779300000053);
});

test("campaign counts and stale Monitor do not infer a missing conversation or settled cost", () => {
  const campaign = report.pacedCampaigns[0];
  assert.equal(campaign.distinctReturnedConversations, 383);
  assert.deepEqual(cohorts.map((run) => run.units.conversations), [20, 50, 100, 213]);
  assert.deepEqual(cohorts.map((run) => run.pacedMeasurement.failedConversations), [0, 0, 2, 0]);
  assert.deepEqual(cohorts.map((run) => run.pacedMeasurement.peakOutstanding), [3, 5, 9, 5]);
  assert.equal(campaign.clientPeakOutstanding, 9);
  assert.equal(campaign.startedAt, "2026-09-20T19:15:38.150Z");
  assert.equal(campaign.endedAt, "2026-09-20T19:33:36.725Z");
  assert.deepEqual(campaign.postCampaignMonitor, {
    checkedAt: "2026-09-20T19:34:29Z", updatedMinutesAgo: 120, sessions: 36,
    credits: "not_recorded", relevance: "stale_precampaign_analytics"
  });
  reject((campaign) => { campaign.distinctReturnedConversations = 384; }, /distinct conversations/);
  reject((campaign) => { campaign.clientPeakOutstanding = 100; }, /cohort peaks/);
  reject((campaign) => { campaign.notAttemptedCalibrationRpm.push(50); }, /unattempted calibration/);
  reject((campaign) => { campaign.runKeys.pop(); }, /exactly its measured cohorts/);
  reject((campaign) => { campaign.status = "completed_full_hour"; });
  reject((campaign) => { campaign.postCampaignMonitor.updatedMinutesAgo = 1; }, /stale campaign Monitor/);
  reject((campaign) => { campaign.postCampaignMonitor.relevance = "attributed_campaign_usage"; });
});

test("campaign context remains closed and excludes private metadata", () => {
  for (const key of Object.keys(report.pacedCampaigns[0])) reject((campaign) => { delete campaign[key]; });
  for (const key of Object.keys(report.pacedCampaigns[0].postCampaignMonitor)) reject((campaign) => { delete campaign.postCampaignMonitor[key]; });
  reject((campaign) => { campaign.privateLedgerPath = "not-public"; });
  reject((campaign) => { campaign.postCampaignMonitor.account = "not-public"; });
});
