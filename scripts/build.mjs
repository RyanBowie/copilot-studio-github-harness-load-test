import { readFile, mkdir, lstat, readdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { assertReport } from "../src/validate.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const read = (path) => readFile(resolve(root, path), "utf8");
export const inlineJson = (value) => JSON.stringify(value).replaceAll("<", "\\u003c").replaceAll("\u2028", "\\u2028").replaceAll("\u2029", "\\u2029");

export async function loadPublicReport() {
  const [dataText, schemaText] = await Promise.all([read("data/report.json"), read("schema/report.schema.json")]);
  const schema = JSON.parse(schemaText);
  const report = assertReport(JSON.parse(dataText), schema);
  if ([...report.runs.map((run) => run.runKey), ...report.documentedLimits.map((limit) => limit.limitKey)]
    .some((key) => /(?:^|-)(?:offline|fixture|synthetic|example|fake|test)(?:-|$)/i.test(key))) {
    throw new Error("Offline/synthetic keys are forbidden in the publication input.");
  }
  return { report, schema };
}

export async function renderHtml(report, schema) {
  assertReport(report, schema);
  const [template, validator, capacity, charts, client] = await Promise.all([
    read("src/index.html"), read("src/validate.mjs"), read("src/capacity.mjs"), read("src/charts.mjs"), read("src/report.js")
  ]);
  const replacements = {
    REPORT_JSON: inlineJson(report),
    SCHEMA_JSON: inlineJson(schema),
    VALIDATOR_JS: validator.replaceAll("export function ", "function "),
    CAPACITY_JS: capacity.replaceAll("export function ", "function "),
    CHARTS_JS: charts.replaceAll("export function ", "function "),
    REPORT_JS: client
  };
  let html = template;
  for (const [marker, value] of Object.entries(replacements)) {
    const token = `<!-- ${marker} -->`;
    if (html.split(token).length !== 2) throw new Error(`Expected exactly one template marker: ${marker}`);
    html = html.replace(token, () => value);
  }
  return html;
}

export async function build() {
  const { report, schema } = await loadPublicReport();
  const html = await renderHtml(report, schema);
  await mkdir(resolve(root, "dist"), { recursive: true });
  if (!(await lstat(resolve(root, "dist"))).isDirectory()) throw new Error("dist must be a real directory, not a link.");
  const allowed = new Set(["index.html", "report.json", "report.schema.json", ".nojekyll"]);
  const existing = await readdir(resolve(root, "dist"), { withFileTypes: true });
  if (existing.some((entry) => !entry.isFile() || !allowed.has(entry.name))) {
    throw new Error("Unexpected file or directory in dist; inspect and remove it before publishing.");
  }
  await Promise.all([
    writeFile(resolve(root, "dist/index.html"), html),
    writeFile(resolve(root, "dist/report.json"), `${JSON.stringify(report, null, 2)}\n`),
    writeFile(resolve(root, "dist/report.schema.json"), `${JSON.stringify(schema, null, 2)}\n`),
    writeFile(resolve(root, "dist/.nojekyll"), "")
  ]);
  return { report, html };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    if (process.argv.slice(2).some((arg) => arg !== "--validate-only")) throw new Error("Only --validate-only is supported; the publication input is always data/report.json.");
    const { report } = process.argv.includes("--validate-only") ? await loadPublicReport() : await build();
    console.log(`Public contract valid: ${report.publication.status}; ${report.runs.length} reviewed runs.`);
  } catch (error) {
    // Values are never interpolated into validation errors.
    console.error(error instanceof SyntaxError ? "Invalid JSON in the public input or schema." : error.message);
    process.exitCode = 1;
  }
}
