import { beforeEach, describe, expect, it } from "vitest";
import { createDb, type AppDatabase } from "@/db/client";
import {
  createGoal,
  deleteGoal,
  getGoal,
  listActiveGoals,
  listGoals,
  moveGoal,
  nextGoalSortOrder,
  setGoalStatus,
  updateGoal,
} from "@/db/repo/goals";
import { deleteCategory, listCategories } from "@/db/repo/todos";

describe("goals repo", () => {
  let db: AppDatabase;
  let categoryId: number;

  beforeEach(async () => {
    db = await createDb(":memory:");
    categoryId = (await listCategories(db))[0].id;
  });

  it("round-trips a created goal through typed DTOs", async () => {
    const created = await createGoal(db, {
      title: "Run a 10k",
      horizon: "short",
      categoryId,
      targetDate: "2026-12-01",
      notes: "because I want to finish something hard",
      sortOrder: 10,
    });

    expect(created).toMatchObject({
      title: "Run a 10k",
      horizon: "short",
      categoryId,
      targetDate: "2026-12-01",
      notes: "because I want to finish something hard",
      status: "active",
      sortOrder: 10,
      achievedAt: null,
    });
    expect(typeof created.id).toBe("number");
    expect(typeof created.createdAt).toBe("string");

    expect(await getGoal(db, created.id)).toEqual(created);
  });

  it("defaults notes, status, category and target date when omitted", async () => {
    const created = await createGoal(db, { title: "Minimal goal", horizon: "long" });

    expect(created.notes).toBe("");
    expect(created.status).toBe("active");
    expect(created.categoryId).toBeNull();
    expect(created.targetDate).toBeNull();
  });

  it("returns null for a goal that does not exist", async () => {
    expect(await getGoal(db, 999)).toBeNull();
  });

  it("orders goals short-term first, then by sort order", async () => {
    await createGoal(db, { title: "Long B", horizon: "long", sortOrder: 20 });
    await createGoal(db, { title: "Short B", horizon: "short", sortOrder: 20 });
    await createGoal(db, { title: "Long A", horizon: "long", sortOrder: 10 });
    await createGoal(db, { title: "Short A", horizon: "short", sortOrder: 10 });

    expect((await listGoals(db)).map((g) => g.title)).toEqual(["Short A", "Short B", "Long A", "Long B"]);
  });

  it("excludes achieved and dropped goals from the active list", async () => {
    const keep = await createGoal(db, { title: "Active", horizon: "short", sortOrder: 10 });
    const done = await createGoal(db, { title: "Achieved", horizon: "short", sortOrder: 20 });
    const gone = await createGoal(db, { title: "Dropped", horizon: "short", sortOrder: 30 });

    await setGoalStatus(db, done.id, "achieved");
    await setGoalStatus(db, gone.id, "dropped");

    expect((await listActiveGoals(db)).map((g) => g.id)).toEqual([keep.id]);
    expect(await listGoals(db)).toHaveLength(3);
  });

  it("stamps achievedAt when achieved and clears it when reactivated", async () => {
    const goal = await createGoal(db, { title: "Ship v1", horizon: "short" });

    const achieved = await setGoalStatus(db, goal.id, "achieved");
    expect(achieved.status).toBe("achieved");
    expect(achieved.achievedAt).toEqual(expect.any(String));

    const reactivated = await setGoalStatus(db, goal.id, "active");
    expect(reactivated.status).toBe("active");
    expect(reactivated.achievedAt).toBeNull();
  });

  it("does not stamp achievedAt when a goal is dropped", async () => {
    const goal = await createGoal(db, { title: "Learn banjo", horizon: "long" });
    expect((await setGoalStatus(db, goal.id, "dropped")).achievedAt).toBeNull();
  });

  it("updates editable fields and can clear the category and target date", async () => {
    const goal = await createGoal(db, {
      title: "Old title",
      horizon: "short",
      categoryId,
      targetDate: "2026-01-01",
    });

    const updated = await updateGoal(db, goal.id, {
      title: "New title",
      horizon: "long",
      categoryId: null,
      targetDate: null,
      notes: "revised why",
    });

    expect(updated).toMatchObject({
      title: "New title",
      horizon: "long",
      categoryId: null,
      targetDate: null,
      notes: "revised why",
    });
  });

  it("throws when updating or restatusing a missing goal", async () => {
    await expect(updateGoal(db, 999, { title: "nope" })).rejects.toThrow(/not found/);
    await expect(setGoalStatus(db, 999, "achieved")).rejects.toThrow(/not found/);
  });

  it("deletes a goal", async () => {
    const goal = await createGoal(db, { title: "Temporary", horizon: "short" });
    await deleteGoal(db, goal.id);
    expect(await getGoal(db, goal.id)).toBeNull();
  });

  it("spaces new sort orders by 10 per horizon", async () => {
    expect(await nextGoalSortOrder(db, "short")).toBe(10);

    await createGoal(db, { title: "First", horizon: "short", sortOrder: 10 });
    expect(await nextGoalSortOrder(db, "short")).toBe(20);
    // The long-term block numbers independently.
    expect(await nextGoalSortOrder(db, "long")).toBe(10);
  });

  it("swaps sort order with the neighbour when moved", async () => {
    const a = await createGoal(db, { title: "A", horizon: "short", sortOrder: 10 });
    const b = await createGoal(db, { title: "B", horizon: "short", sortOrder: 20 });

    await moveGoal(db, b.id, "up");
    expect((await listActiveGoals(db)).map((g) => g.title)).toEqual(["B", "A"]);

    await moveGoal(db, b.id, "down");
    expect((await listActiveGoals(db)).map((g) => g.title)).toEqual(["A", "B"]);
    expect((await getGoal(db, a.id))!.sortOrder).toBe(10);
  });

  it("reorders goals that share a sort order instead of no-oping", async () => {
    await createGoal(db, { title: "A", horizon: "short" });
    const b = await createGoal(db, { title: "B", horizon: "short" });

    await moveGoal(db, b.id, "up");
    expect((await listActiveGoals(db)).map((g) => g.title)).toEqual(["B", "A"]);
  });

  it("never swaps a short-term goal with a long-term one", async () => {
    const short = await createGoal(db, { title: "Short", horizon: "short", sortOrder: 10 });
    const long = await createGoal(db, { title: "Long", horizon: "long", sortOrder: 10 });

    await moveGoal(db, short.id, "down");
    await moveGoal(db, long.id, "up");

    expect((await getGoal(db, short.id))!.horizon).toBe("short");
    expect((await getGoal(db, long.id))!.horizon).toBe("long");
    expect((await listGoals(db)).map((g) => g.title)).toEqual(["Short", "Long"]);
  });

  it("no-ops when moving a missing goal or one already at the edge", async () => {
    const only = await createGoal(db, { title: "Only", horizon: "short", sortOrder: 10 });

    await expect(moveGoal(db, 999, "up")).resolves.not.toThrow();
    await moveGoal(db, only.id, "up");
    await moveGoal(db, only.id, "down");

    expect((await getGoal(db, only.id))!.sortOrder).toBe(10);
  });

  it("lets a category be deleted, nulling the goal's category instead of blocking", async () => {
    const goal = await createGoal(db, { title: "Run a 10k", horizon: "short", categoryId });

    await expect(deleteCategory(db, categoryId)).resolves.not.toThrow();
    expect((await getGoal(db, goal.id))!.categoryId).toBeNull();
  });

  it("rejects an invalid horizon or status at the database level", async () => {
    // @ts-expect-error -- exercising the CHECK constraint with a bad value
    await expect(createGoal(db, { title: "Bad", horizon: "medium" })).rejects.toThrow();

    const goal = await createGoal(db, { title: "Good", horizon: "short" });
    // @ts-expect-error -- exercising the CHECK constraint with a bad value
    await expect(setGoalStatus(db, goal.id, "paused")).rejects.toThrow();
  });
});
