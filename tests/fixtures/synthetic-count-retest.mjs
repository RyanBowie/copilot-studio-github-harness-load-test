// OFFLINE SYNTHETIC FIXTURE ONLY. Never a publication input or observed result.
import { syntheticMinuteRetest } from "./synthetic-minute-retest.mjs";

export function syntheticCountRetest(options = {}) {
  const report = syntheticMinuteRetest({ arrivalSeconds: 66, ...options });
  const run = report.runs[0];
  const paced = run.pacedMeasurement;
  run.runKey = "offline-count-retest";
  paced.campaignKey = "offline-count-campaign";
  paced.phase = "count_retest";
  paced.arrivalStatus = paced.stopReason ? "stopped" : "count_complete";
  Object.assign(paced.pacing, { schedule: "dispatch_rebased", missedSlotPolicy: "defer_without_catchup", jitterAllowance: 0 });
  const remaining = { ...run.counts };
  paced.minutes = [];
  for (let offset = 0; offset < paced.arrivalSeconds; offset += 60) {
    const durationSeconds = Math.min(60, paced.arrivalSeconds - offset);
    const last = offset + durationSeconds === paced.arrivalSeconds;
    const counts = Object.fromEntries(["completed", "failed", "pending"].map((field) =>
      [field, last ? remaining[field] : Math.floor(run.counts[field] * durationSeconds / paced.arrivalSeconds)]));
    counts.attempted = counts.completed + counts.failed + counts.pending;
    for (const field of Object.keys(remaining)) remaining[field] -= counts[field];
    paced.minutes.push({ offsetSeconds: offset, durationSeconds, ...counts });
  }
  Object.assign(report.pacedCampaigns[0], {
    campaignKey: paced.campaignKey, runKeys: [run.runKey], status: "standalone_count_retest"
  });
  return report;
}
