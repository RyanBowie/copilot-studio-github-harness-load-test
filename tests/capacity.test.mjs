import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { summarizeCapacity } from "../src/capacity.mjs";
import { renderHtml } from "../scripts/build.mjs";

const report = JSON.parse(await readFile(new URL("../data/report.json", import.meta.url), "utf8"));
const schema = JSON.parse(await readFile(new URL("../schema/report.schema.json", import.meta.url), "utf8"));
const find = (key) => report.runs.find((run) => run.runKey === key);
const result = (group, seconds) => group.windows.find((window) => window.seconds === seconds);
const synthetic = (key, minutes) => {
  const run = structuredClone(find("paced-spread-25-completed"));
  run.runKey = `offline-capacity-${key}`;
  run.pacedMeasurement.campaignKey = `offline-campaign-${key}`;
  run.pacedMeasurement.minutes = minutes.map((counts, index) => ({ offsetSeconds: index * 60, durationSeconds: 60, ...counts }));
  return run;
};
const clean = (count = 25) => ({ attempted: count, completed: count, failed: 0, pending: 0 });

test("reviewed capacity windows retain exact successes, denominators, source offsets and clean alternatives", () => {
  const [group] = summarizeCapacity(report.runs);
  assert.equal(summarizeCapacity(report.runs).length, 1);
  for (const [seconds, most, offered, cleanCount] of [[60, 55, 95, 25], [120, 98, 100, 50], [300, 125, 125, 125], [480, 200, 200, 200]]) {
    const window = result(group, seconds);
    assert.equal(window.best.counts.completed, most);
    assert.equal(window.best.counts.attempted, offered);
    assert.equal(window.clean.counts.completed, cleanCount);
    assert.equal(window.clean.counts.failed, 0);
    assert.equal(window.clean.counts.pending, 0);
    assert.equal(window.best.offsetSeconds, 0);
    assert.equal(window.best.windowSeconds, seconds);
    assert.equal(window.best.campaignKey, seconds === 60 ? "m365-finite-elastic-100" : "m365-paced-campaign");
  }
  assert.equal(result(group, 60).best.runKey, "paced-elastic-100-completed");
  assert.equal(result(group, 120).best.runKey, "paced-calibration-50");
  assert.equal(result(group, 300).best.runKey, "paced-hour-25-stopped");
});

test("sub-minute and unobserved endurance windows stay null rather than extrapolated or zero", () => {
  const [group] = summarizeCapacity(report.runs);
  for (const seconds of [10, 30, 900, 3600, 86400]) {
    assert.equal(result(group, seconds).best, null);
    assert.equal(result(group, seconds).clean, null);
  }
  assert.equal(group.highestQualifiedRpm, 25);
  assert.deepEqual(group.highestQualifiedRuns.map((run) => run.runKey), ["paced-calibration-25", "paced-spread-25-completed"]);
  assert.equal(group.longestCompleted.runKey, "paced-125-25-baseline");
  assert.equal(group.longestCompleted.pacedMeasurement.arrivalSeconds, 303.08066709999997);
  assert.equal(group.longestClean.windowSeconds, 480);
  assert.equal(group.longestClean.counts.completed, 200);
  assert.equal(group.longestClean.runKey, "paced-hour-25-stopped");
});

test("capacity derivation leaves every reviewed record unchanged and needs no raw identifiers", () => {
  const before = structuredClone(report);
  summarizeCapacity(report.runs);
  assert.deepEqual(report, before);
  assert.equal(report.runs.length, 15);
  assert.deepEqual(summarizeCapacity([]), []);
  assert.deepEqual(summarizeCapacity(report.runs.filter((run) => !run.pacedMeasurement)), []);
});

test("partial 100 RPM calibration and burst cannot fabricate a complete minute", () => {
  const runs = [find("paced-standalone-100-stopped"), find("paced-minute-100-local-stop"), find("m365-native-burst-100")];
  const [group] = summarizeCapacity(runs);
  assert.equal(group.runs.length, 2);
  assert.ok(group.windows.every((window) => window.best === null && window.clean === null));
  assert.equal(group.highestQualifiedRpm, null);
  assert.equal(group.longestClean, null);
  assert.equal(group.longestCompleted, null);
});

test("full dispatch windows never join separate cohorts, even in the same campaign", () => {
  const first = synthetic("first", [clean()]);
  const second = synthetic("second", [clean()]);
  second.pacedMeasurement.campaignKey = first.pacedMeasurement.campaignKey;
  const [group] = summarizeCapacity([first, second]);
  assert.equal(result(group, 60).best.counts.completed, 25);
  assert.equal(result(group, 120).best, null);
  assert.equal(group.longestClean.windowSeconds, 60);
});

test("gaps, partial buckets and zero-offer minutes do not lengthen a clean segment", () => {
  const gap = synthetic("gap", [clean(), clean()]);
  gap.pacedMeasurement.minutes[1].offsetSeconds = 120;
  assert.equal(result(summarizeCapacity([gap])[0], 120).best, null);
  const partial = synthetic("partial", [clean(), clean()]);
  partial.pacedMeasurement.minutes[1].durationSeconds = 32;
  assert.equal(result(summarizeCapacity([partial])[0], 120).best, null);
  const idle = synthetic("idle", [clean(), clean(0), clean()]);
  const [group] = summarizeCapacity([idle]);
  assert.equal(group.longestClean.windowSeconds, 60);
  assert.equal(result(group, 120).clean, null);
  const inactive = synthetic("inactive", [clean(0)]);
  assert.equal(result(summarizeCapacity([inactive])[0], 60).best, null);
});

test("pending and failed outcomes remain in denominators and cannot be called clean", () => {
  for (const [failed, pending] of [[0, 1], [1, 0]]) {
    const run = synthetic("unsettled", [{ attempted: 25, completed: 24, failed, pending }]);
    const [group] = summarizeCapacity([run]);
    assert.deepEqual(result(group, 60).best.counts, { attempted: 25, completed: 24, failed, pending });
    assert.equal(result(group, 60).clean, null);
    assert.equal(group.longestClean, null);
  }
  const interrupted = synthetic("interrupted", [clean(), clean(), { attempted: 25, completed: 24, failed: 1, pending: 0 }, clean(), clean()]);
  assert.equal(summarizeCapacity([interrupted])[0].longestClean.windowSeconds, 120);
});

test("recorded model, environment, revision and memory changes are ranked separately", () => {
  for (const [key, value] of [["model", "Different model"], ["environmentType", "production"], ["agentVersion", "2.0"], ["memory", "on"]]) {
    const first = synthetic("first", [clean()]);
    const second = synthetic("second", [clean(50)]);
    second[key] = value;
    const groups = summarizeCapacity([first, second]);
    assert.equal(groups.length, 2);
    assert.ok(groups.every((group) => result(group, 120).best === null));
  }
});

test("equal success counts prefer fewer failures, then pending, with deterministic chronological ties", () => {
  const later = synthetic("later", [clean()]);
  const earlier = synthetic("earlier", [clean()]);
  earlier.pacedMeasurement.startedAt = "2026-09-20T20:00:00.000Z";
  const failed = synthetic("failed", [{ attempted: 26, completed: 25, failed: 1, pending: 0 }]);
  const pending = synthetic("pending", [{ attempted: 26, completed: 25, failed: 0, pending: 1 }]);
  for (const runs of [[failed, pending, later, earlier], [earlier, later, pending, failed]]) {
    assert.equal(result(summarizeCapacity(runs)[0], 60).best.runKey, earlier.runKey);
  }
});

test("offline build embeds the derived helper without changing the downloaded measurement contract", async () => {
  const html = await renderHtml(report, schema);
  assert.match(html, /function summarizeCapacity\(runs\)/);
  assert.doesNotMatch(html, /<!-- CAPACITY_JS -->|export function summarizeCapacity/);
  assert.match(html, /id="capacity-summary"/);
  assert.match(html, /id="reliability-content"/);
  assert.match(html, /id="failure-summary"/);
  const embedded = JSON.parse(html.match(/<script type="application\/json" id="report-data">([\s\S]*?)<\/script>/)[1]);
  assert.deepEqual(embedded, report);
});
