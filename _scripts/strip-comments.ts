import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import * as ts from "typescript";

const inputPath = process.argv[2];
if (!inputPath) {
  console.error("Missing input file path.");
  process.exit(1);
}

const absPath = resolve(process.cwd(), inputPath);
const text = readFileSync(absPath, "utf8");

const sf = ts.createSourceFile(absPath, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);

const printer = ts.createPrinter({
  newLine: ts.NewLineKind.LineFeed,
  removeComments: true,
});

process.stdout.write(printer.printFile(sf));