const capacityWindows = [10, 30, 60, 120, 300, 480, 900, 3600, 86400];
const countKeys = ["attempted", "completed", "failed", "pending"];

function capacityContext(run) {
  const measurement = run.pacedMeasurement;
  return {
    surface: run.surface,
    environmentType: run.environmentType,
    model: run.model,
    agentVersion: run.agentVersion,
    authenticatedAccounts: run.authenticatedAccounts,
    memory: run.memory,
    workload: run.workload,
    workflow: run.workflow,
    connectors: run.connectors,
    path: measurement.path,
    endpoint: measurement.endpoint,
    requestKind: measurement.requestKind
  };
}

function preferCapacityWindow(candidate, current) {
  if (!current) return true;
  if (candidate.counts.completed !== current.counts.completed) return candidate.counts.completed > current.counts.completed;
  if (candidate.counts.failed !== current.counts.failed) return candidate.counts.failed < current.counts.failed;
  return candidate.counts.pending < current.counts.pending;
}

function isCleanCapacityWindow(candidate) {
  return candidate.counts.attempted > 0 && candidate.counts.failed === 0 && candidate.counts.pending === 0;
}

export function summarizeCapacity(runs) {
  const groups = new Map();
  const cohorts = runs.filter((run) => run.pacedMeasurement).sort((a, b) =>
    a.pacedMeasurement.startedAt.localeCompare(b.pacedMeasurement.startedAt) || a.runKey.localeCompare(b.runKey));
  for (const run of cohorts) {
    const context = capacityContext(run);
    const key = JSON.stringify(context);
    if (!groups.has(key)) groups.set(key, { context, runs: [] });
    groups.get(key).runs.push(run);
  }
  return [...groups.values()].map((group) => {
    const windows = capacityWindows.map((seconds) => ({ seconds, best: null, clean: null }));
    let longestClean = null;
    for (const run of group.runs) {
      const paced = run.pacedMeasurement;
      for (let start = 0; start < paced.minutes.length; start++) {
        const counts = { attempted: 0, completed: 0, failed: 0, pending: 0 };
        let duration = 0;
        let everyMinuteActive = true;
        for (let end = start; end < paced.minutes.length; end++) {
          const minute = paced.minutes[end];
          if (minute.durationSeconds !== 60 || minute.offsetSeconds !== paced.minutes[start].offsetSeconds + duration) break;
          duration += minute.durationSeconds;
          everyMinuteActive &&= minute.attempted > 0;
          for (const name of countKeys) counts[name] += minute[name];
          const candidate = {
            runKey: run.runKey,
            campaignKey: paced.campaignKey,
            targetRpm: paced.targetRpm,
            offsetSeconds: paced.minutes[start].offsetSeconds,
            windowSeconds: duration,
            counts: { ...counts }
          };
          const clean = everyMinuteActive && isCleanCapacityWindow(candidate);
          const window = windows.find((item) => item.seconds === duration);
          if (window && counts.attempted > 0) {
            if (preferCapacityWindow(candidate, window.best)) window.best = candidate;
            if (clean && preferCapacityWindow(candidate, window.clean)) window.clean = candidate;
          }
          if (clean && (!longestClean || duration > longestClean.windowSeconds
            || (duration === longestClean.windowSeconds && preferCapacityWindow(candidate, longestClean)))) longestClean = candidate;
        }
      }
    }
    const qualified = group.runs.filter((run) => run.pacedMeasurement.phase === "calibration"
      && run.pacedMeasurement.qualification === "qualified");
    const highestQualifiedRpm = qualified.length ? Math.max(...qualified.map((run) => run.pacedMeasurement.targetRpm)) : null;
    const completedTrials = group.runs.filter((run) => run.pacedMeasurement.arrivalStatus === "full_window"
      && run.pacedMeasurement.drainStatus === "complete");
    const longestCompleted = completedTrials.reduce((best, run) =>
      !best || run.pacedMeasurement.arrivalSeconds > best.pacedMeasurement.arrivalSeconds ? run : best, null);
    return {
      ...group, windows, longestClean, longestCompleted, highestQualifiedRpm,
      highestQualifiedRuns: qualified.filter((run) => run.pacedMeasurement.targetRpm === highestQualifiedRpm)
    };
  });
}
