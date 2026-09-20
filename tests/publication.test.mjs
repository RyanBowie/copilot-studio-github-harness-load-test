import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, cp, writeFile, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const exec = promisify(execFile);
const root = fileURLToPath(new URL("../", import.meta.url));
const fixture = JSON.parse(await readFile(new URL("./fixtures/synthetic-report.json", import.meta.url), "utf8"));
const empty = {
  schemaVersion: 1, harness: "GitHub Copilot Harness",
  publication: { status: "awaiting_pilot", reviewedOn: null }, runs: [], documentedLimits: []
};

test("real CLI refuses fixtures, alternate inputs, invalid JSON and artifact contamination", async (t) => {
  const directory = await mkdtemp(resolve(tmpdir(), "github-harness-contract-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  await Promise.all(["src", "schema"].map((name) => cp(resolve(root, name), resolve(directory, name), { recursive: true })));
  await mkdir(resolve(directory, "scripts"));
  await mkdir(resolve(directory, "data"));
  await cp(resolve(root, "scripts/build.mjs"), resolve(directory, "scripts/build.mjs"));
  const input = resolve(directory, "data/report.json");
  const invoke = (...args) => exec(process.execPath, [resolve(directory, "scripts/build.mjs"), ...args], { cwd: directory });
  await writeFile(input, JSON.stringify(fixture));
  await assert.rejects(invoke(), (error) => /Offline\/synthetic keys/.test(error.stderr));
  await writeFile(input, JSON.stringify(empty));
  await assert.rejects(invoke("--input", "tests/fixtures/synthetic-report.json"), (error) => /Only --validate-only/.test(error.stderr));
  await invoke();
  assert.deepEqual((await readdir(resolve(directory, "dist"))).sort(), [".nojekyll", "index.html", "report.json", "report.schema.json"]);
  assert.deepEqual(JSON.parse(await readFile(resolve(directory, "dist/report.json"), "utf8")), empty);
  const stale = resolve(directory, "dist/do-not-publish.txt");
  await writeFile(stale, "unrelated artifact");
  await assert.rejects(invoke(), (error) => /Unexpected file or directory/.test(error.stderr));
  await rm(stale);
  await writeFile(input, '{"private-do-not-echo": ');
  await assert.rejects(invoke(), (error) => /Invalid JSON/.test(error.stderr) && !error.stderr.includes("private-do-not-echo"));
});

test("Pages deployment is manual, opt-in, main-only and separately requires reviewed runs", async () => {
  const workflow = await readFile(new URL("../.github/workflows/pages.yml", import.meta.url), "utf8");
  assert.match(workflow, /github\.event_name == 'workflow_dispatch' && inputs\.publish && github\.ref == 'refs\/heads\/main' && vars\.ENABLE_PAGES_DEPLOY == 'true'/);
  assert.match(workflow, /report\.publication\.status !== 'reviewed' \|\| !report\.runs\.length/);
  assert.match(workflow, /path: dist/);
  assert.doesNotMatch(workflow, /pull_request_target|pac |az |9334|shared.browser/);
});
