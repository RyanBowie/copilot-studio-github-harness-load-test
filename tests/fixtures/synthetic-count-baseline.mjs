// OFFLINE SYNTHETIC FIXTURE ONLY. Never a publication input or observed result.
import { syntheticCountRetest } from "./synthetic-count-retest.mjs";

export function syntheticCountBaseline(options = {}) {
  const report = syntheticCountRetest({ attempted: 125, failed: 20, arrivalSeconds: 312, ...options });
  const run = report.runs[0];
  const paced = run.pacedMeasurement;
  run.runKey = "offline-count-baseline";
  Object.assign(paced, {
    phase: "count_baseline", campaignKey: "offline-baseline-campaign",
    targetRpm: 25, plannedArrivalSeconds: 300, plannedSlots: 125, unofferedSlots: 125 - run.counts.attempted
  });
  Object.assign(paced.pacing, {
    intervalMs: 2400, observedMinIntervalMs: run.counts.attempted > 1 ? 2400 : null,
    violatingIntervals: run.counts.attempted > 1 ? 0 : null
  });
  delete report.pacedCampaigns;
  return report;
}
