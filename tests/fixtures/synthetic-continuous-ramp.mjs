// OFFLINE SYNTHETIC FIXTURE ONLY. Never a publication input or observed result.
import { syntheticPacedReport, syntheticTiming } from "./synthetic-paced-report.mjs";

export function syntheticContinuousRamp({ arrivalSeconds = 3600, failed = 7, pending = 0, disconnected = 0, stopReason = null } = {}) {
  const report = syntheticPacedReport("calibration");
  const run = report.runs[0];
  const instant = (seconds) => new Date(Date.parse("2026-01-10T00:00:00.000Z") + seconds * 1000).toISOString();
  const segments = [];
  for (let offset = 0; offset < arrivalSeconds; offset += 600) {
    const targetRpm = 25 + offset / 600 * 5;
    const durationSeconds = Math.min(600, arrivalSeconds - offset);
    const attempted = Math.max(1, Math.floor(targetRpm * durationSeconds / 60) - (durationSeconds === 600 ? 10 : 0));
    const segmentFailed = offset === 0 ? failed : 0;
    const segmentPending = offset + durationSeconds === arrivalSeconds ? pending : 0;
    segments.push({
      offsetSeconds: offset, durationSeconds, targetRpm, nominalRequests: targetRpm * 10,
      counts: { attempted, completed: attempted - segmentFailed - segmentPending, failed: segmentFailed, pending: segmentPending },
      outstandingAtStart: offset === 0 ? 0 : 5, outstandingAtEnd: 5
    });
  }
  const counts = { attempted: 0, completed: 0, failed: 0, pending: 0 };
  for (const segment of segments) for (const field of Object.keys(counts)) counts[field] += segment.counts[field];
  const transportStop = stopReason === "explicit_throttle";
  const noId = transportStop ? failed : disconnected;
  const after = Math.min(1, counts.completed);
  segments.at(-1).outstandingAtEnd = after + pending;
  Object.assign(run, {
    runKey: "offline-continuous-ramp", counts, windowSeconds: arrivalSeconds + 1.01,
    units: { conversations: counts.attempted - pending - noId, sessions: null },
    errors: [
      ...(failed - disconnected ? [{ category: transportStop ? "throttling" : "unknown", count: failed - disconnected, evidence: transportStop ? "workiq_mcp_transport_429" : "unclassified_invocation_failure" }] : []),
      ...(disconnected ? [{ category: "transport", count: disconnected, evidence: "native_disconnected_no_conversation" }] : [])
    ],
    rampMeasurement: {
      campaignKey: "offline-ramp-campaign", protocol: "continuous_hour_ramp_25_to_50",
      path: "workiq_ask_via_native_tool_rpc", endpoint: "invocation_completion", requestKind: "greeting_only",
      timingBasis: "calibrated_native_rpc_completion",
      startedAt: instant(0), arrivalEndedAt: instant(arrivalSeconds + 0.01), observedThroughAt: instant(arrivalSeconds + 1.01),
      plannedArrivalSeconds: 3600, requestCeiling: 2250, arrivalSeconds, arrivalEndObservedSeconds: arrivalSeconds + 0.01,
      arrivalStatus: stopReason === "observation_cutoff" ? "partial" : stopReason ? "stopped" : "full_window", stopReason,
      drainSeconds: 1, drainStatus: pending ? "bounded_cutoff" : "complete",
      unusedRequestBudget: 2250 - counts.attempted,
      pacing: { schedule: "dispatch_rebased", intervalBasis: "current_segment_rate", missedSlotPolicy: "defer_without_catchup", genericErrorPolicy: "count_without_early_stop", violatingIntervals: 0 },
      runnerRetries: 0, managedServiceRetries: "unknown", configuredClientCap: 100, requestTimeoutSeconds: 180, drainTimeoutSeconds: 180,
      clockStatus: "verified_clean", evidenceStatus: "verified_complete",
      peakOutstanding: Math.min(6, counts.attempted), concurrencyBasis: "outstanding_client_invocations", concurrencyVerification: "reviewed_client_peak",
      conversationEvidence: "returned_ids_checked_unique", failedConversations: failed - noId,
      percentileMethod: "nearest_rank", success: syntheticTiming(counts.completed), failure: syntheticTiming(failed), allOutcomes: syntheticTiming(counts.completed + failed),
      successfulWithinArrivalWindow: counts.completed - after, successfulAfterArrivalWindow: after,
      segmentBasis: "elapsed_dispatch_segment_outcomes_at_final_cutoff", segments
    }
  });
  delete run.pacedMeasurement;
  return report;
}
