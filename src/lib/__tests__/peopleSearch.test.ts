import { describe, expect, it } from "vitest";
import { filterPeopleByQuery } from "@/lib/peopleSearch";

const ana = { name: "Ana Lopez", relationshipTags: ["climbing", "coworker"] };
const ben = { name: "Ben Chu", relationshipTags: ["college friend"] };
const cleo = { name: "Cleo", relationshipTags: [] };
const all = [ana, ben, cleo];

describe("filterPeopleByQuery", () => {
  it("returns everyone for an empty query", () => {
    expect(filterPeopleByQuery(all, "")).toEqual(all);
  });

  it("returns everyone for a whitespace-only query", () => {
    expect(filterPeopleByQuery(all, "   ")).toEqual(all);
  });

  it("matches a name substring case-insensitively", () => {
    expect(filterPeopleByQuery(all, "LOPez")).toEqual([ana]);
  });

  it("matches a tag substring case-insensitively", () => {
    expect(filterPeopleByQuery(all, "CLIMB")).toEqual([ana]);
  });

  it("matches a query hitting one person's tag and another's name", () => {
    expect(filterPeopleByQuery(all, "le")).toEqual([ben, cleo]);
  });

  it("trims surrounding whitespace before matching", () => {
    expect(filterPeopleByQuery(all, "  climbing  ")).toEqual([ana]);
  });

  it("returns an empty array when nothing matches", () => {
    expect(filterPeopleByQuery(all, "zzz")).toEqual([]);
  });

  it("preserves the input order of matches", () => {
    expect(filterPeopleByQuery(all, "c")).toEqual([ana, ben, cleo]);
  });
});
