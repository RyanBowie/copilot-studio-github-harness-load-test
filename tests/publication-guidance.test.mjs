import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { loadPublicReport, renderHtml } from "../scripts/build.mjs";
import { restoreHistoricalMetadata } from "./helpers/historical-metadata.mjs";

const loaded = await loadPublicReport();
const html = await renderHtml(loaded.report, loaded.schema, loaded.evidence);
const termsUrl = "https://learn.microsoft.com/en-us/legal/work-iq-apis/terms-of-use#3-work-iq-api-license-and-guidelines";
const element = (id, tag = "article") => {
  const match = html.match(new RegExp(`<${tag}[^>]*id="${id}"[^>]*>[\\s\\S]*?</${tag}>`));
  assert.ok(match, `${id} must be in the static artifact`);
  return match[0];
};
const textRows = (id) => [...element(id, "table").matchAll(/<tbody>([\s\S]*?)<\/tbody>/g)]
  .flatMap((body) => [...body[1].matchAll(/<tr>([\s\S]*?)<\/tr>/g)])
  .map((row) => [...row[1].matchAll(/<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/g)].map((cell) => cell[1]));

test("permission notice precedes results and separates the published rule from unverified agreement coverage", () => {
  const notice = element("permission-warning", "aside");
  assert.match(notice, /aria-labelledby="permission-heading"/);
  assert.ok(html.indexOf(notice) < html.indexOf('<section id="overview"'));
  assert.ok(notice.includes(`href="${termsUrl}"`));
  assert.match(notice, /section 3\(b\)\(7\).*April 2026/);
  assert.match(notice, /Do not replicate these performance tests unless Microsoft has expressly permitted them under a duly executed written agreement, or an applicable superseding agreement expressly authorizes the testing\./);
  assert.match(notice, /corporate account, valid license, tenant ownership, user consent or this report/);
  assert.match(notice, /has not verified applicable written-agreement coverage.*does not assert that Microsoft permission was obtained.*does not certify legal compliance/);
  assert.doesNotMatch(notice, /<button|\shidden|role="dialog"|role="alertdialog"/);
});

test("methodology, conclusions and future guidance retain the Microsoft-permission prerequisite", () => {
  for (const id of ["permission-method", "capacity-conclusion", "replication-guidance"]) {
    assert.match(element(id), /Microsoft/);
    assert.match(element(id), /permission/i);
  }
  assert.match(element("permission-method"), /testing owner's controls, not proof of Microsoft's written permission/);
  assert.match(element("replication-guidance"), /service owner.*representative multi-user.*SLOs/);
  assert.match(element("replication-guidance"), /No new tests, recovery probes, retries, account changes or load generation/);
});

test("horizon guidance keeps requests, conversations, active people and SLO capacity distinct", () => {
  const guidance = element("evidence-sufficiency");
  assert.match(guidance, /NOT ESTABLISHED for 60 seconds, 60 minutes or 24 hours/);
  for (const phrase of ["Simultaneous client outstanding requests", "Distinct conversations", "Unique users active over a period", "Sustainable users with an SLO"]) assert.ok(guidance.includes(phrase));
  assert.match(guidance, /independent multi-user workloads.*think time, roles, tenant\/quota isolation/);
  assert.match(guidance, /no defensible percentage.*fixed additional sample count/);
  assert.match(guidance, /Configured quota, counting window and reset remain unknown/);
  assert.ok(html.indexOf('assertWindowEvidence(evidence, JSON.parse(byId("window-schema").textContent), report)') < html.indexOf("renderEvidenceSufficiency(report.runs)"));
});

test("illustrative offered starts are exact arithmetic, not actual results or capacity predictions", () => {
  const rows = textRows("illustrative-volumes");
  assert.deepEqual(rows, [
    ["25 requests/minute", "25", "1,500", "36,000"],
    ["30 requests/minute", "30", "1,800", "43,200"],
    ["35 requests/minute", "35", "2,100", "50,400"]
  ]);
  for (const [rateLabel, ...volumes] of rows) {
    const rate = Number.parseInt(rateLabel, 10);
    assert.deepEqual(volumes.map((value) => Number(value.replaceAll(",", ""))), [1, 60, 1440].map((minutes) => rate * minutes));
  }
  const scenarios = element("illustrative-scenarios");
  assert.match(scenarios, /not forecasts, successful completions, quota, measured throughput or validated sustainable capacity/);
  assert.match(scenarios, /constant offered rate continuously maintained, full-interval availability, and no quota\/backoff or admission loss.*NOT established/);
  assert.match(scenarios, /prior HTTP 429 stops contradict assuming throttle-free hours or days/);
  assert.ok(html.indexOf('id="evidence-sufficiency"') < html.indexOf(scenarios));
  assert.ok(html.indexOf(scenarios) < html.indexOf('id="benchmark-kpis"'));
  assert.doesNotMatch(scenarios, /benchmark-chart|<input|<button|data-chart-key/);
});

test("hypothetical active-population examples generate the same average load without claiming tested users", () => {
  const rows = textRows("illustrative-populations");
  assert.deepEqual(rows, [
    ["35", "1 request per minute", "35 requests/minute"],
    ["175", "1 request per 5 minutes", "35 requests/minute"],
    ["350", "1 request per 10 minutes", "35 requests/minute"]
  ]);
  for (const [index, row] of rows.entries()) assert.equal(Number(row[0]) / [1, 5, 10][index], 35);
  const scenarios = element("illustrative-scenarios");
  assert.match(scenarios, /not numbers of tested, supported or concurrently executing users, or unique users observed/);
  assert.match(scenarios, /same people can repeat requests.*request totals cannot be multiplied into distinct-user counts/);
  assert.match(scenarios, /No inference applies Little's Law to p50\/p95 latency or client peaks/);
  assert.match(scenarios, /Mean request latency, user cadence, workload mix, multi-user behavior, quota scope and success\/latency SLOs are not established/);
});

test("load-only edition preserves sixteen records via the prior fingerprint and both window downloads exactly", () => {
  assert.equal(loaded.report.runs.length, 16);
  const previousHashes = {
    report: "f2751421e297d3628f46d2fbc01bd166358f813a9a5bf8928dab8f0e3ba82283",
    schema: "d279f6af92efa346852045976dfe25a812889cd80626822739e65040ed225d47",
    evidence: "21a8fc3b99dbc7a7325f7fde4cab6c1beb5387029f21f50ccee878b5a59b2d33",
    evidenceSchema: "55a9a6dea7457b5273f25e4bfc4952865193f213c030d09493c63a8176710adc"
  };
  for (const [key, hash] of Object.entries(previousHashes)) {
    const value = key === "report" ? restoreHistoricalMetadata(loaded.report) : loaded[key];
    assert.equal(createHash("sha256").update(`${JSON.stringify(value, null, 2)}\n`).digest("hex"), hash, key);
  }
});
