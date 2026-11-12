import assert from "node:assert/strict";
import { test } from "node:test";
import { compareColumnColors, relativeLuminance, teamFillColors } from "./team-colors";

test("light primary fills darken until text can sit on them", () => {
  const maize = compareColumnColors("ffcb05", "00274c");
  assert.ok(relativeLuminance(maize.background) <= 0.28);
  assert.notEqual(maize.background.toLowerCase(), "#ffcb05");
});

test("dark primary fills keep the brand color and secondary text when they contrast", () => {
  const duke = compareColumnColors("001A57", "FFFFFF");
  assert.equal(duke.background.toLowerCase(), "#001a57");
  assert.equal(duke.color.toLowerCase(), "#ffffff");
});

test("teamFillColors uses the logo disc fill and picks contrasting ink", () => {
  const duke = teamFillColors("001A57", "FFFFFF");
  assert.equal(duke.backgroundColor.toLowerCase(), "#001a57");
  assert.equal(duke.color.toLowerCase(), "#f8fafc");

  const carolina = teamFillColors("7bafd4", "13294b", "153");
  assert.equal(carolina.backgroundColor.toLowerCase(), "#7bafd4");
  assert.equal(carolina.color.toLowerCase(), "#0f172a");
});
