import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { loadPublicReport, renderHtml } from "../scripts/build.mjs";
import { validateReport } from "../src/validate.mjs";

const { report, schema, evidence, evidenceSchema } = await loadPublicReport();
const html = await renderHtml(report, schema, evidence);
const monetary = /\b(?:costs?|billing|pricing|credits|monetary|currency)\b/i;

test("all public presentation, embedded contracts, downloads and README are load-only", async () => {
  assert.doesNotMatch(html, monetary);
  for (const value of [report, schema, evidence, evidenceSchema]) assert.doesNotMatch(JSON.stringify(value), monetary);
  assert.doesNotMatch(await readFile(new URL("../README.md", import.meta.url), "utf8"), monetary);
  assert.equal(report.runs.length, 16);
  assert.equal(evidence.runs.length, 7);
  assert.equal((html.match(/<a\b[^>]*\bdownload(?:\s|>)/g) ?? []).length, 4);
});

test("nine remaining sections retain load metrics and no orphan cost controls", () => {
  const ids = [...html.matchAll(/<section id="([^"]+)"/g)].map((match) => match[1]);
  assert.deepEqual(ids, ["overview", "concurrency", "response-time", "throughput", "observations", "answers", "failures", "conversations", "methodology"]);
  for (const id of ids) assert.ok(html.includes(`href="#${id}"`));
  assert.ok(html.includes("permission-warning"));
  assert.ok(html.includes("illustrative-scenarios"));
  assert.ok(html.includes("evidence-sufficiency"));
  assert.equal(report.runs.find((run) => run.runKey === "m365-native-burst-100").counts.attempted, 100);
});

test("session-only Monitor evidence stays intact and rejects retired fields", () => {
  assert.equal(report.studyContext.prePilotMonitor, "no_sessions_recorded");
  assert.equal(report.studyContext.postPilotMonitor, "no_sessions_recorded");
  const burst = report.runs.find((run) => run.nativeInvocation);
  assert.equal(burst.nativeInvocation.postRunMonitor.sessions, 1);
  assert.equal(burst.nativeInvocation.postRunMonitor.messages, 7);
  assert.deepEqual(report.pacedCampaigns.map((campaign) => campaign.postCampaignMonitor.sessions), [36, 417, 417]);
  for (const locate of [
    (data) => data.runs.find((run) => run.nativeInvocation).nativeInvocation.postRunMonitor,
    (data) => data.pacedCampaigns[0].postCampaignMonitor
  ]) {
    const invalid = structuredClone(report);
    locate(invalid).credits = "not_recorded";
    assert.match(validateReport(invalid, schema).join("\n"), /unknown field|allowed shape/);
  }
});
