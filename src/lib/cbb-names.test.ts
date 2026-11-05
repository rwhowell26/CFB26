import assert from "node:assert/strict";
import { test } from "node:test";
import { buildTeamNameIndex, lookupTeamByName, normalizeTeamName } from "./cbb-names";

test("normalizes common college basketball aliases", () => {
  assert.equal(normalizeTeamName("UConn"), "connecticut");
  assert.equal(normalizeTeamName("Connecticut"), "connecticut");
  assert.equal(normalizeTeamName("Miami FL"), normalizeTeamName("Miami (FL)"));
  assert.equal(normalizeTeamName("St. Mary's"), "saint marys");
  assert.equal(normalizeTeamName("Saint-Marys-College"), "saint marys");
  assert.equal(normalizeTeamName("Texas A&M"), "texas am");
  assert.equal(normalizeTeamName("Texas-AM"), "texas am");
  assert.equal(normalizeTeamName("St. John's"), normalizeTeamName("Saint-Johns"));
  assert.equal(normalizeTeamName("Boston U"), normalizeTeamName("Boston-University"));
});

test("looks up ESPN teams from KenPom-style names", () => {
  const teams = [
    {
      id: "41",
      name: "UConn Huskies",
      shortName: "UConn",
      abbreviation: "CONN",
    },
    {
      id: "2390",
      name: "Miami Hurricanes",
      shortName: "Miami",
      abbreviation: "MIA",
    },
  ];
  const index = buildTeamNameIndex(teams);
  assert.equal(lookupTeamByName("Connecticut", index)?.id, "41");
  assert.equal(lookupTeamByName("UConn", index)?.id, "41");
  assert.equal(lookupTeamByName("Miami FL", index)?.id, "2390");
});

test("maps KenPom and Warren Nolan slugs onto ESPN short names", () => {
  const teams = [
    { id: "245", name: "Texas A&M Aggies", shortName: "Texas A&M", abbreviation: "TA&M" },
    { id: "2599", name: "St. John's Red Storm", shortName: "St John's", abbreviation: "SJU" },
    { id: "104", name: "Boston University Terriers", shortName: "Boston U", abbreviation: "BU" },
    { id: "2608", name: "Saint Mary's Gaels", shortName: "Saint Mary's", abbreviation: "SMC" },
  ];
  const index = buildTeamNameIndex(teams);
  assert.equal(lookupTeamByName("Texas-AM", index)?.id, "245");
  assert.equal(lookupTeamByName("Saint-Johns", index)?.id, "2599");
  assert.equal(lookupTeamByName("Boston-University", index)?.id, "104");
  assert.equal(lookupTeamByName("Saint-Marys-College", index)?.id, "2608");
});
