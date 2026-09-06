import { describe, expect, it } from "vitest";
import { distinctTags, filterPeopleBySelectedTags, filterPeopleByQuery } from "@/lib/peopleSearch";

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

describe("distinctTags", () => {
  it("returns each tag once, sorted alphabetically", () => {
    const dana = { name: "Dana", relationshipTags: ["coworker", "book club"] };
    expect(distinctTags([...all, dana])).toEqual([
      "book club",
      "climbing",
      "college friend",
      "coworker",
    ]);
  });

  it("returns an empty array when no one has tags", () => {
    expect(distinctTags([cleo])).toEqual([]);
  });
});

describe("filterPeopleBySelectedTags", () => {
  it("returns everyone when no tags are selected", () => {
    expect(filterPeopleBySelectedTags(all, [])).toEqual(all);
  });

  it("keeps only people carrying the selected tag, matched exactly", () => {
    expect(filterPeopleBySelectedTags(all, ["climbing"])).toEqual([ana]);
  });

  it("does not substring-match tags", () => {
    expect(filterPeopleBySelectedTags(all, ["climb"])).toEqual([]);
  });

  it("requires every selected tag (AND semantics)", () => {
    expect(filterPeopleBySelectedTags(all, ["climbing", "coworker"])).toEqual([ana]);
    expect(filterPeopleBySelectedTags(all, ["climbing", "college friend"])).toEqual([]);
  });
});
