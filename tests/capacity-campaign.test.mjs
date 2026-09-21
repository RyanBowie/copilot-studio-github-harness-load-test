import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";

test("capacity additions preserve all twelve previously reviewed runs and campaign contexts", async () => {
  const report = JSON.parse(await readFile(new URL("../data/report.json", import.meta.url), "utf8"));
  const history = {
    runs: report.runs.slice(0, 12),
    pacedCampaigns: report.pacedCampaigns.slice(0, 3),
    documentedLimits: report.documentedLimits,
    studyContext: report.studyContext
  };
  assert.equal(createHash("sha256").update(JSON.stringify(history)).digest("hex"), "6a6ec17246a26cb0e6206066ffe8d245faf55c1e42ac88f3762cf304337f865a");
});
