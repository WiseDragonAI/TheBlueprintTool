#!/usr/bin/env node
import { pathToFileURL } from "node:url";
import path from "node:path";

function readArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) continue;
    const key = token.slice(2);
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) {
      args[key] = "true";
    } else {
      args[key] = value;
      index += 1;
    }
  }
  return args;
}

function usage() {
  return `Usage:
node render-html-screenshots.mjs --input <file-or-url> --output <png> --width <px> --height <px> [--device-scale-factor <n>] [--selector <css>]

Example:
node render-html-screenshots.mjs --input mockups/screen.html --output mockups/screenshots/screen.png --width 390 --height 844`;
}

function resolveInput(input) {
  if (/^https?:\/\//.test(input) || input.startsWith("file://")) return input;
  return pathToFileURL(path.resolve(input)).href;
}

const args = readArgs(process.argv.slice(2));

if (args.help === "true") {
  console.log(usage());
  process.exit(0);
}

const width = Number.parseInt(args.width, 10);
const height = Number.parseInt(args.height, 10);
const scale = args["device-scale-factor"] ? Number.parseFloat(args["device-scale-factor"]) : 1;

if (!args.input || !args.output || !Number.isFinite(width) || !Number.isFinite(height)) {
  console.error(usage());
  process.exit(1);
}

const { chromium } = await import("playwright");
const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width, height },
  deviceScaleFactor: scale,
});

try {
  await page.goto(resolveInput(args.input), { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts?.ready);
  await page.waitForTimeout(150);

  if (args.selector) {
    const target = page.locator(args.selector).first();
    await target.waitFor({ state: "visible", timeout: 5000 });
    await target.screenshot({ path: args.output });
  } else {
    await page.screenshot({ path: args.output, fullPage: false });
  }
} finally {
  await browser.close();
}
