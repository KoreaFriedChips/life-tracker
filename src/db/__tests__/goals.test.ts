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

  beforeEach(() => {
    db = createDb(":memory:");
    categoryId = listCategories(db)[0].id;
  });

  it("round-trips a created goal through typed DTOs", () => {
    const created = createGoal(db, {
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

    expect(getGoal(db, created.id)).toEqual(created);
  });

  it("defaults notes, status, category and target date when omitted", () => {
    const created = createGoal(db, { title: "Minimal goal", horizon: "long" });

    expect(created.notes).toBe("");
    expect(created.status).toBe("active");
    expect(created.categoryId).toBeNull();
    expect(created.targetDate).toBeNull();
  });

  it("returns null for a goal that does not exist", () => {
    expect(getGoal(db, 999)).toBeNull();
  });

  it("orders goals short-term first, then by sort order", () => {
    createGoal(db, { title: "Long B", horizon: "long", sortOrder: 20 });
    createGoal(db, { title: "Short B", horizon: "short", sortOrder: 20 });
    createGoal(db, { title: "Long A", horizon: "long", sortOrder: 10 });
    createGoal(db, { title: "Short A", horizon: "short", sortOrder: 10 });

    expect(listGoals(db).map((g) => g.title)).toEqual(["Short A", "Short B", "Long A", "Long B"]);
  });

  it("excludes achieved and dropped goals from the active list", () => {
    const keep = createGoal(db, { title: "Active", horizon: "short", sortOrder: 10 });
    const done = createGoal(db, { title: "Achieved", horizon: "short", sortOrder: 20 });
    const gone = createGoal(db, { title: "Dropped", horizon: "short", sortOrder: 30 });

    setGoalStatus(db, done.id, "achieved");
    setGoalStatus(db, gone.id, "dropped");

    expect(listActiveGoals(db).map((g) => g.id)).toEqual([keep.id]);
    expect(listGoals(db)).toHaveLength(3);
  });

  it("stamps achievedAt when achieved and clears it when reactivated", () => {
    const goal = createGoal(db, { title: "Ship v1", horizon: "short" });

    const achieved = setGoalStatus(db, goal.id, "achieved");
    expect(achieved.status).toBe("achieved");
    expect(achieved.achievedAt).toEqual(expect.any(String));

    const reactivated = setGoalStatus(db, goal.id, "active");
    expect(reactivated.status).toBe("active");
    expect(reactivated.achievedAt).toBeNull();
  });

  it("does not stamp achievedAt when a goal is dropped", () => {
    const goal = createGoal(db, { title: "Learn banjo", horizon: "long" });
    expect(setGoalStatus(db, goal.id, "dropped").achievedAt).toBeNull();
  });

  it("updates editable fields and can clear the category and target date", () => {
    const goal = createGoal(db, {
      title: "Old title",
      horizon: "short",
      categoryId,
      targetDate: "2026-01-01",
    });

    const updated = updateGoal(db, goal.id, {
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

  it("throws when updating or restatusing a missing goal", () => {
    expect(() => updateGoal(db, 999, { title: "nope" })).toThrow(/not found/);
    expect(() => setGoalStatus(db, 999, "achieved")).toThrow(/not found/);
  });

  it("deletes a goal", () => {
    const goal = createGoal(db, { title: "Temporary", horizon: "short" });
    deleteGoal(db, goal.id);
    expect(getGoal(db, goal.id)).toBeNull();
  });

  it("spaces new sort orders by 10 per horizon", () => {
    expect(nextGoalSortOrder(db, "short")).toBe(10);

    createGoal(db, { title: "First", horizon: "short", sortOrder: 10 });
    expect(nextGoalSortOrder(db, "short")).toBe(20);
    // The long-term block numbers independently.
    expect(nextGoalSortOrder(db, "long")).toBe(10);
  });

  it("swaps sort order with the neighbour when moved", () => {
    const a = createGoal(db, { title: "A", horizon: "short", sortOrder: 10 });
    const b = createGoal(db, { title: "B", horizon: "short", sortOrder: 20 });

    moveGoal(db, b.id, "up");
    expect(listActiveGoals(db).map((g) => g.title)).toEqual(["B", "A"]);

    moveGoal(db, b.id, "down");
    expect(listActiveGoals(db).map((g) => g.title)).toEqual(["A", "B"]);
    expect(getGoal(db, a.id)!.sortOrder).toBe(10);
  });

  it("reorders goals that share a sort order instead of no-oping", () => {
    createGoal(db, { title: "A", horizon: "short" });
    const b = createGoal(db, { title: "B", horizon: "short" });

    moveGoal(db, b.id, "up");
    expect(listActiveGoals(db).map((g) => g.title)).toEqual(["B", "A"]);
  });

  it("never swaps a short-term goal with a long-term one", () => {
    const short = createGoal(db, { title: "Short", horizon: "short", sortOrder: 10 });
    const long = createGoal(db, { title: "Long", horizon: "long", sortOrder: 10 });

    moveGoal(db, short.id, "down");
    moveGoal(db, long.id, "up");

    expect(getGoal(db, short.id)!.horizon).toBe("short");
    expect(getGoal(db, long.id)!.horizon).toBe("long");
    expect(listGoals(db).map((g) => g.title)).toEqual(["Short", "Long"]);
  });

  it("no-ops when moving a missing goal or one already at the edge", () => {
    const only = createGoal(db, { title: "Only", horizon: "short", sortOrder: 10 });

    expect(() => moveGoal(db, 999, "up")).not.toThrow();
    moveGoal(db, only.id, "up");
    moveGoal(db, only.id, "down");

    expect(getGoal(db, only.id)!.sortOrder).toBe(10);
  });

  it("lets a category be deleted, nulling the goal's category instead of blocking", () => {
    const goal = createGoal(db, { title: "Run a 10k", horizon: "short", categoryId });

    expect(() => deleteCategory(db, categoryId)).not.toThrow();
    expect(getGoal(db, goal.id)!.categoryId).toBeNull();
  });

  it("rejects an invalid horizon or status at the database level", () => {
    // @ts-expect-error -- exercising the CHECK constraint with a bad value
    expect(() => createGoal(db, { title: "Bad", horizon: "medium" })).toThrow();

    const goal = createGoal(db, { title: "Good", horizon: "short" });
    // @ts-expect-error -- exercising the CHECK constraint with a bad value
    expect(() => setGoalStatus(db, goal.id, "paused")).toThrow();
  });
});
