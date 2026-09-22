import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { validateReport, assertReport } from "../src/validate.mjs";
import { loadPublicReport, renderHtml, inlineJson } from "../scripts/build.mjs";

const readJson = async (path) => JSON.parse(await readFile(new URL(path, import.meta.url), "utf8"));
const schema = await readJson("../schema/report.schema.json");
const fixture = await readJson("./fixtures/synthetic-report.json");
const seed = await readJson("../data/report.json");
const sample = () => structuredClone(fixture);
const reject = (edit, expected) => {
  const data = sample();
  edit(data, data.runs[0]);
  const errors = validateReport(data, schema);
  assert.ok(errors.length, "invalid aggregate must be rejected");
  if (expected) assert.match(errors.join("\n"), expected);
};

test("public input conforms to the schema and excludes offline fixtures", () => {
  assert.deepEqual(validateReport(seed, schema), []);
  assert.ok(seed.runs.every((run) => !run.runKey.includes("offline")));
});

test("awaiting-pilot shape contains no observations or review date", () => {
  const empty = {
    schemaVersion: 1, harness: "GitHub Copilot Harness", outcomeBasis: "requested_operation",
    publication: { status: "awaiting_pilot", reviewedOn: null }, studyContext: null, runs: [], documentedLimits: []
  };
  assert.deepEqual(validateReport(empty, schema), []);
  empty.publication.reviewedOn = "2026-09-20";
  assert.ok(validateReport(empty, schema).length);
});

test("clearly named offline synthetic fixture exercises the reviewed shape", () => {
  assert.equal(fixture.runs[0].runKey, "offline-fixture-only");
  assert.deepEqual(validateReport(fixture, schema), []);
});

test("unreviewed facts, review without date, and success-shaped empty review fail", () => {
  reject((data) => { data.publication.status = "awaiting_pilot"; }, /awaiting_pilot/);
  reject((data) => { data.publication.reviewedOn = null; }, /reviewed requires/);
  reject((data) => { data.runs = []; }, /at least one fact/);
});

function objectPaths(value, prefix = []) {
  if (value === null || typeof value !== "object") return [];
  const result = Array.isArray(value) ? [] : [prefix];
  for (const [key, child] of Object.entries(value)) result.push(...objectPaths(child, [...prefix, key]));
  return result;
}
const at = (value, path) => path.reduce((current, key) => current[key], value);

test("all populated object boundaries reject unknown fields and missing required fields", () => {
  for (const path of objectPaths(fixture)) {
    const data = sample();
    at(data, path).privateTranscript = "must never be public";
    assert.ok(validateReport(data, schema).length, `unknown field at ${path.join(".")}`);
    for (const key of Object.keys(at(fixture, path))) {
      const missing = sample();
      delete at(missing, path)[key];
      assert.ok(validateReport(missing, schema).length, `missing ${[...path, key].join(".")}`);
    }
  }
});

test("fixed identity, single account and surfaces cannot be relabelled", () => {
  reject((data) => { data.harness = "GitHub coding agent"; });
  reject((data) => { data.schemaVersion = 2; });
  reject((_, run) => { run.authenticatedAccounts = 2; });
  reject((_, run) => { run.surface = "direct_to_engine"; });
  reject((_, run) => { run.environmentType = "customer-name"; });
});

test("attempts partition exactly and reject zero-observation runs", () => {
  reject((_, run) => { run.counts.completed++; }, /attempted must equal/);
  reject((_, run) => { run.counts.attempted = 0; });
  for (const value of [-1, 1.5, NaN, Infinity, "8", Number.MAX_SAFE_INTEGER]) {
    reject((_, run) => { run.counts.attempted = value; });
  }
  reject((data) => { data.runs.push(structuredClone(data.runs[0])); }, /runKey must be unique/);
  reject((_, run) => { run.units.conversations = 9; }, /cannot exceed/);
  reject((_, run) => { run.units.sessions = 0; });
});

test("visible latency requires coherent observed samples", () => {
  reject((_, run) => { run.latency.sampleCount = 6; }, /samples cannot exceed/);
  reject((_, run) => { run.latency.p50Ms = 2600; }, /p50 <= p95 <= max/);
  reject((_, run) => { run.latency.maxMs = 2000; }, /p50 <= p95 <= max/);
  reject((_, run) => { run.latency.sampleCount = 1; }, /one sample/);
  reject((_, run) => { run.latency.kind = "backend_ttfa"; });
  reject((_, run) => { run.latency.percentileMethod = "linear_interpolation"; });
  reject((_, run) => { run.windowSeconds = 2; }, /latency cannot exceed/);
  const data = sample();
  data.runs[0].latency = null;
  assert.deepEqual(validateReport(data, schema), []);
});

test("first-answer and UI-settled timing rules cannot be conflated", () => {
  reject((_, run) => { run.latency.end = "backend_complete"; });
  reject((_, run) => { run.firstVisibleLatency.end = "feedback_controls_and_text_stable"; });
  reject((_, run) => { run.latency.stabilitySeconds = 2; }, /stability interval/);
  reject((_, run) => { run.latency.stabilitySeconds = 0; });
  reject((_, run) => { run.firstVisibleLatency.p95Ms = 1100; }, /nearest-rank p95/);
  reject((_, run) => { run.firstVisibleLatency.p50Ms = 1100; }, /cannot precede first answer/);
  reject((_, run) => { run.firstVisibleLatency.end = "first_status_or_answer"; });
  reject((_, run) => { run.firstVisibleLatency.end = "first_visible_response"; });
});

test("first activity is not an answer and may precede a still-pending turn", () => {
  const data = sample();
  const run = data.runs[0];
  run.counts = { attempted: 8, completed: 0, failed: 0, pending: 8 };
  run.errors = [];
  run.firstVisibleLatency = null;
  run.latency = null;
  assert.deepEqual(validateReport(data, schema), [], "activity alone must not force a success or failure");
  run.firstVisibleActivity.sampleCount = 9;
  assert.match(validateReport(data, schema).join("\n"), /samples cannot exceed sent/);
  reject((_, item) => { item.firstVisibleActivity.kind = "visible_response"; });
  reject((_, item) => { item.firstVisibleActivity.end = "first_visible_answer"; });
});

test("first activity cannot follow an actual answer when full sample sets match", () => {
  reject((_, run) => {
    run.counts = { attempted: 5, completed: 5, failed: 0, pending: 0 };
    run.errors = [];
    run.arrival = null;
    run.firstVisibleActivity.sampleCount = 5;
    run.firstVisibleActivity.p50Ms = 1300;
    run.firstVisibleActivity.p95Ms = 1300;
    run.firstVisibleActivity.maxMs = 1300;
  }, /first activity cannot follow first answer/);
});

test("unsent drafts stay outside agent outcomes and configuration observations are not tool success", () => {
  const data = sample();
  data.runs[0].clientIssues[0].count = 10;
  data.runs[0].observations = ["standalone_teams_send_tool_missing", "human_review_workflow_attached"];
  data.runs[0].memory = "off";
  assert.deepEqual(validateReport(data, schema), []);
  data.runs[0].clientIssues[0].category = "agent_failure";
  assert.ok(validateReport(data, schema).length);
});

test("concurrency and arrival require observations bounded by run attempts and window", () => {
  reject((_, run) => { run.concurrency.maxInFlight = 9; }, /cannot exceed/);
  reject((_, run) => { run.concurrency.basis = "configured_workers"; });
  reject((_, run) => { run.arrival.attempts = 9; }, /cannot exceed/);
  reject((_, run) => { run.arrival.windowSeconds = 121; }, /cannot exceed/);
  reject((_, run) => { run.arrival.windowSeconds = 0; });
  const data = sample();
  Object.assign(data.runs[0], { windowSeconds: null, concurrency: null, arrival: null });
  assert.deepEqual(validateReport(data, schema), []);
});

test("structured error counts cover failures without inferring root cause", () => {
  reject((_, run) => { run.errors = []; }, /exactly cover/);
  reject((_, run) => { run.errors[1].category = "throttling"; }, /categories must be unique/);
  reject((_, run) => { run.errors[1].category = "timeout"; }, /must be paired/);
  reject((_, run) => { run.errors[0].category = "unknown"; }, /must be paired/);
  reject((_, run) => { run.observations.push("manual_timing"); }, /duplicates/);
});

test("the load-only closed contract rejects retired monetary metadata rather than publishing zeros", () => {
  for (const status of ["pending", "unknown", "settled"]) {
    reject((_, run) => { run.cost = { status, amount: 0 }; }, /unknown field/);
  }
  reject((data) => { data.billing = {}; }, /unknown field/);
});

test("dates must exist and cannot postdate review", () => {
  reject((_, run) => { run.observedOn = "2026-02-30"; }, /real date/);
  reject((_, run) => { run.observedOn = "2026-09-21"; }, /later than/);
  reject((data) => { data.publication.reviewedOn = "0000-01-01"; }, /real date/);
  reject((_, run) => { run.observedOn = "2026-9-19"; });
});

test("public string safeguards reject identifiers, private URLs and placeholders", () => {
  for (const value of [
    "user@example.com", "https://example.sharepoint.com/private", "example.com",
    "12345678-1234-1234-1234-123456789abc", "12345678123412341234123456789abc",
    "ghp_fakecredential", "github_pat_fakecredential", "Bearer token",
    "N/A", "TBD", "unknown", "synthetic", "<script>alert(1)</script>"
  ]) reject((_, run) => { run.model = value; });
  const data = sample();
  data.runs[0].model = "GPT-5.4";
  data.runs[0].agentVersion = "v1.2 (reviewed)";
  assert.deepEqual(validateReport(data, schema), []);
});

test("unknown keys and invalid values never get echoed into validator diagnostics", () => {
  const data = sample();
  data["sensitive-user@private.example"] = "private-value";
  assert.doesNotMatch(validateReport(data, schema).join("\n"), /sensitive-user|private-value/);
  delete data["sensitive-user@private.example"];
  data.runs[0].model = "sensitive-user@private.example";
  assert.doesNotMatch(validateReport(data, schema).join("\n"), /sensitive-user/);
});

test("documentation limits remain separate and allow only reviewed public documentation links", () => {
  const data = sample();
  data.documentedLimits = [{
    limitKey: "offline-documentation-fixture", harnessScope: "standard_harness", scope: "per_agent", metric: "requests_per_minute",
    value: 12, sourceUrl: "https://learn.microsoft.com/en-us/microsoft-copilot-studio/requirements-quotas",
    retrievedOn: "2026-09-19", applicability: "unverified"
  }];
  assert.deepEqual(validateReport(data, schema), []);
  for (const url of [
    "https://private.sharepoint.com/item", "https://learn.microsoft.com.evil.example/path",
    "javascript:alert(1)", "https://learn.microsoft.com/path?token=private",
    "https://user@learn.microsoft.com/path", "https://learn.microsoft.com/path/12345678-1234-1234-1234-123456789abc"
  ]) {
    data.documentedLimits[0].sourceUrl = url;
    assert.ok(validateReport(data, schema).length);
  }
});

test("schema interpreter fails closed when an unsupported keyword or reference is introduced", () => {
  const unsupported = structuredClone(schema);
  unsupported.properties.runs.contains = { type: "object" };
  assert.throws(() => validateReport(fixture, unsupported), /Unsupported schema keyword/);
  unsupported.properties.runs = { $ref: "https://remote.example/schema" };
  assert.throws(() => validateReport(fixture, unsupported), /Only existing local/);
});

test("assertReport rejects invalid data rather than returning a success-shaped default", () => {
  assert.throws(() => assertReport({}, schema), /Public report rejected/);
});

test("HTML build is deterministic, self-contained and embeds only the fixed public input", async () => {
  const loaded = await loadPublicReport();
  const html = await renderHtml(loaded.report, loaded.schema);
  assert.equal(html, await renderHtml(loaded.report, loaded.schema));
  assert.doesNotMatch(html, /offline-fixture-only|<!-- (REPORT|SCHEMA|VALIDATOR)_/);
  assert.doesNotMatch(html, /<script[^>]+src=|<link[^>]+(?:stylesheet|fonts)|\bfetch\(/);
  const dataText = html.match(/<script type="application\/json" id="report-data">([\s\S]*?)<\/script>/)[1];
  assert.deepEqual(JSON.parse(dataText), seed);
  const script = html.match(/<script type="module">([\s\S]*?)<\/script>/)[1];
  assert.doesNotThrow(() => new Function(script), "generated client and validator must parse");
  assert.match(html, /prefers-reduced-motion/);
  assert.match(html, /forced-colors/);
  assert.match(html, /@media print/);
});

test("inline JSON cannot terminate a script element", () => {
  const unsafe = { value: "</script><script>alert(1)</script>\u2028\u2029" };
  const serialized = inlineJson(unsafe);
  assert.doesNotMatch(serialized, /</);
  assert.deepEqual(JSON.parse(serialized), unsafe);
});

test("invalid public input cannot render an artifact", async () => {
  await assert.rejects(renderHtml({}, schema), /Public report rejected/);
});
