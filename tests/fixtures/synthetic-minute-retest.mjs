// OFFLINE SYNTHETIC FIXTURE ONLY. Never a publication input or observed result.
import { syntheticPacedReport, syntheticTiming } from "./synthetic-paced-report.mjs";

export function syntheticMinuteRetest({ attempted = 100, failed = 30, pending = 0, arrivalSeconds = 60, stopReason = null } = {}) {
  const report = syntheticPacedReport("calibration");
  const run = report.runs[0];
  const completed = attempted - failed - pending;
  const transportStop = stopReason === "explicit_throttle";
  const instant = (seconds) => new Date(Date.parse("2026-01-10T00:00:00.000Z") + seconds * 1000).toISOString();
  run.runKey = "offline-minute-retest";
  run.counts = { attempted, completed, failed, pending };
  run.units.conversations = attempted - pending - (transportStop ? failed : 0);
  run.windowSeconds = arrivalSeconds + 1;
  run.errors = failed ? [{ category: transportStop ? "throttling" : "unknown", count: failed, evidence: transportStop ? "workiq_mcp_transport_429" : "unclassified_invocation_failure" }] : [];
  Object.assign(run.pacedMeasurement, {
    campaignKey: "offline-minute-campaign", phase: "minute_retest", genericErrorPolicy: "count_without_early_stop",
    targetRpm: 100, plannedArrivalSeconds: 60, plannedSlots: 100, arrivalSeconds, arrivalEndObservedSeconds: arrivalSeconds,
    arrivalEndedAt: instant(arrivalSeconds), observedThroughAt: instant(arrivalSeconds + 1),
    unofferedSlots: 100 - attempted, arrivalStatus: stopReason ? "stopped" : "full_window", stopReason,
    drainStatus: pending ? "bounded_cutoff" : "complete", qualification: "not_evaluated",
    peakOutstanding: Math.min(attempted, 10), failedConversations: transportStop ? 0 : failed,
    success: syntheticTiming(completed), failure: syntheticTiming(failed), allOutcomes: syntheticTiming(attempted - pending),
    minutes: [{ offsetSeconds: 0, durationSeconds: arrivalSeconds, ...run.counts }]
  });
  Object.assign(run.pacedMeasurement.pacing, { intervalMs: 600, observedMinIntervalMs: 600 });
  report.pacedCampaigns = [{
    campaignKey: "offline-minute-campaign", runKeys: [run.runKey],
    startedAt: instant(0), endedAt: instant(arrivalSeconds + 2), status: "standalone_minute_retest",
    distinctReturnedConversations: run.units.conversations, clientPeakOutstanding: run.pacedMeasurement.peakOutstanding,
    notAttemptedCalibrationRpm: [],
    postCampaignMonitor: {
      checkedAt: "2026-01-10T00:02:00Z", updatedMinutesAgo: 10, sessions: 11,
      credits: "not_recorded", relevance: "stale_precampaign_analytics"
    }
  }];
  return report;
}
