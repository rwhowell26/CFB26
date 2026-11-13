import assert from "node:assert/strict";
import { test } from "node:test";
import {
  compareColumnColors,
  espnContrastLogo,
  logoAppearance,
  logoOrigin,
  logoScale,
  relativeLuminance,
  teamFillColors,
} from "./team-colors";

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

test("logo discs use primary color, not secondary", () => {
  const queens = logoAppearance("192c66", "857040", "https://a.espncdn.com/i/teamlogos/ncaa/500/2511.png", "2511");
  assert.equal(queens.style.backgroundColor.toLowerCase(), "#192c66");
  assert.match(queens.src ?? "", /\/ncaa\/500-dark\/2511\.png$/);

  const notreDame = logoAppearance("062340", "c99700", "https://a.espncdn.com/i/teamlogos/ncaa/500/87.png", "87");
  assert.equal(notreDame.style.backgroundColor.toLowerCase(), "#062340");
});

test("white primary falls back to secondary so the disc stays colored", () => {
  const look = logoAppearance("ffffff", "001a57", "https://a.espncdn.com/i/teamlogos/ncaa/500/150.png", "150");
  assert.equal(look.style.backgroundColor.toLowerCase(), "#001a57");
});

test("dark fills use the light ESPN mark so the logo stays visible", () => {
  const href = espnContrastLogo("https://a.espncdn.com/i/teamlogos/ncaa/500/150.png", "#001a57");
  assert.match(href, /\/ncaa\/500-dark\/150\.png$/);
});

test("tints that would vanish into the fill are skipped", () => {
  const navyOnNavy = logoAppearance("00225b", "ffffff", "https://a.espncdn.com/i/teamlogos/ncaa/500/2426.png", "2426");
  assert.equal(navyOnNavy.markColor, null);
  assert.match(navyOnNavy.src ?? "", /\/ncaa\/500-dark\/2426\.png$/);
});

test("Central Arkansas logo is scaled up to fill the disc", () => {
  assert.ok(logoScale("2110") >= 1.8);
  assert.ok(logoScale("2110") <= 2.4);
  assert.equal(logoOrigin("2110"), "center 62%");
  assert.equal(logoScale("2511"), 1);
  assert.equal(logoOrigin("2511"), "center");
});
