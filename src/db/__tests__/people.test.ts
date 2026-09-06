import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { createDb, type AppDatabase } from "@/db/client";
import { touchpoints } from "@/db/schema";
import {
  addTouchpoint,
  createPerson,
  deletePerson,
  deleteTouchpoint,
  getPerson,
  listPeopleWithStaleness,
  listTouchpoints,
  upcomingBirthdays,
  updatePerson,
} from "@/db/repo/people";

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

describe("people repo", () => {
  let db: AppDatabase;

  beforeEach(async () => {
    db = await createDb(":memory:");
  });

  it("round-trips a created person through typed DTOs", async () => {
    const created = await createPerson(db, {
      name: "Ada Lovelace",
      relationshipTags: ["colleague", "mentor"],
      howWeMet: "conference",
      notes: "brilliant",
    });

    expect(created).toMatchObject({
      name: "Ada Lovelace",
      relationshipTags: ["colleague", "mentor"],
      howWeMet: "conference",
      notes: "brilliant",
    });

    const fetched = await getPerson(db, created.id);
    expect(fetched).toEqual(created);
  });

  it("defaults relationshipTags, howWeMet, and notes when omitted", async () => {
    const created = await createPerson(db, { name: "Minimal Person" });
    expect(created.relationshipTags).toEqual([]);
    expect(created.howWeMet).toBe("");
    expect(created.notes).toBe("");
  });

  it("defaults birthday to null when omitted", async () => {
    const created = await createPerson(db, { name: "No Birthday" });
    expect(created.birthday).toBeNull();
  });

  it("round-trips birthdays in both formats", async () => {
    const withYear = await createPerson(db, { name: "With Year", birthday: "1998-03-14" });
    expect((await getPerson(db, withYear.id))!.birthday).toBe("1998-03-14");

    const noYear = await createPerson(db, { name: "No Year", birthday: "--03-14" });
    expect((await getPerson(db, noYear.id))!.birthday).toBe("--03-14");
  });

  it("updates a birthday and clears it with null", async () => {
    const created = await createPerson(db, { name: "Birthday Person" });

    const set = await updatePerson(db, created.id, { birthday: "--06-01" });
    expect(set.birthday).toBe("--06-01");

    const untouched = await updatePerson(db, created.id, { name: "Renamed" });
    expect(untouched.birthday).toBe("--06-01");

    const cleared = await updatePerson(db, created.id, { birthday: null });
    expect(cleared.birthday).toBeNull();
  });

  it("updates a person and bumps updatedAt", async () => {
    const created = await createPerson(db, { name: "Original Name" });
    const updated = await updatePerson(db, created.id, {
      name: "New Name",
      relationshipTags: ["friend"],
    });

    expect(updated.name).toBe("New Name");
    expect(updated.relationshipTags).toEqual(["friend"]);
    expect(updated.updatedAt >= created.updatedAt).toBe(true);
  });

  it("adds and deletes touchpoints for a person", async () => {
    const person = await createPerson(db, { name: "Grace Hopper" });

    const touchpoint = await addTouchpoint(db, {
      personId: person.id,
      date: "2026-08-01",
      summary: "Caught up over coffee",
    });

    expect(await listTouchpoints(db, person.id)).toEqual([touchpoint]);

    await deleteTouchpoint(db, touchpoint.id);
    expect(await listTouchpoints(db, person.id)).toEqual([]);
  });

  it("cascades touchpoint deletion when a person is deleted", async () => {
    const person = await createPerson(db, { name: "Alan Turing" });
    await addTouchpoint(db, { personId: person.id, date: "2026-08-01", summary: "Chat" });

    await deletePerson(db, person.id);

    const remaining = await db.select().from(touchpoints).where(eq(touchpoints.personId, person.id)).all();
    expect(remaining).toEqual([]);
  });

  it("computes staleness ordering: never-contacted first, then longest-since-contact", async () => {
    const neverContacted = await createPerson(db, { name: "Never Contacted" });
    const staleContact = await createPerson(db, { name: "Stale Contact" });
    const recentContact = await createPerson(db, { name: "Recent Contact" });

    // Multiple touchpoints for staleContact - lastTouchpointDate must be the MAX (most recent).
    await addTouchpoint(db, { personId: staleContact.id, date: daysAgo(30), summary: "old chat" });
    await addTouchpoint(db, { personId: staleContact.id, date: daysAgo(10), summary: "recent-ish chat" });

    await addTouchpoint(db, { personId: recentContact.id, date: daysAgo(2), summary: "just talked" });

    const results = await listPeopleWithStaleness(db, Intl.DateTimeFormat().resolvedOptions().timeZone);
    const order = results.map((p) => p.name);

    expect(order).toEqual(["Never Contacted", "Stale Contact", "Recent Contact"]);

    const never = results.find((p) => p.id === neverContacted.id)!;
    expect(never.lastTouchpointDate).toBeNull();
    expect(never.daysSinceContact).toBeNull();

    const stale = results.find((p) => p.id === staleContact.id)!;
    expect(stale.lastTouchpointDate).toBe(daysAgo(10));
    expect(stale.daysSinceContact).toBe(10);

    const recent = results.find((p) => p.id === recentContact.id)!;
    expect(recent.lastTouchpointDate).toBe(daysAgo(2));
    expect(recent.daysSinceContact).toBe(2);
  });

  describe("upcomingBirthdays", () => {
    const today = "2026-06-15";

    it("keeps the window inclusive and sorts by daysUntil then name", async () => {
      await createPerson(db, { name: "Zoe Today", birthday: "--06-15" });
      await createPerson(db, { name: "Cara Edge", birthday: "1990-06-20" });
      await createPerson(db, { name: "Ben Edge", birthday: "--06-20" });
      await createPerson(db, { name: "Out Of Window", birthday: "--06-21" });
      await createPerson(db, { name: "No Birthday" });

      const results = await upcomingBirthdays(db, today, 5);

      expect(results.map((r) => [r.name, r.daysUntil, r.turningAge])).toEqual([
        ["Zoe Today", 0, null],
        ["Ben Edge", 5, null],
        ["Cara Edge", 5, 36],
      ]);
      expect(results[0].birthday).toBe("--06-15");
    });

    it("includes a birthday today even with windowDays 0", async () => {
      await createPerson(db, { name: "Today Person", birthday: "1998-06-15" });
      await createPerson(db, { name: "Tomorrow Person", birthday: "--06-16" });

      const results = await upcomingBirthdays(db, today, 0);
      expect(results.map((r) => r.name)).toEqual(["Today Person"]);
      expect(results[0].turningAge).toBe(28);
    });

    it("wraps across the year boundary", async () => {
      await createPerson(db, { name: "January Person", birthday: "--01-02" });

      const results = await upcomingBirthdays(db, "2026-12-28", 7);
      expect(results.map((r) => [r.name, r.daysUntil])).toEqual([["January Person", 5]]);
    });
  });
});
