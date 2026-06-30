import { describe, expect, it } from "vitest";
import {
  buildAdvanceTutorialPatch,
  buildBackTutorialPatch,
  buildResetTutorialPatch,
  buildSkipTutorialPatch,
  buildStartTutorialPatch,
  getVisibleTutorial,
  normalizeTutorialStep,
} from "./tutorialState";

describe("tutorial state helpers", () => {
  it("normalizes missing and invalid steps to 0", () => {
    expect(normalizeTutorialStep(undefined)).toBe(0);
    expect(normalizeTutorialStep("2")).toBe(2);
    expect(normalizeTutorialStep(Number.NaN)).toBe(0);
    expect(normalizeTutorialStep(-1)).toBe(-1);
  });

  it("does not coerce non-numeric values when normalizing steps", () => {
    expect(normalizeTutorialStep(true)).toBe(0);
    expect(normalizeTutorialStep(false)).toBe(0);
    expect(normalizeTutorialStep(null)).toBe(0);
    expect(normalizeTutorialStep("")).toBe(0);
    expect(normalizeTutorialStep("   ")).toBe(0);
    expect(normalizeTutorialStep([])).toBe(0);
    expect(normalizeTutorialStep({})).toBe(0);
    expect(normalizeTutorialStep(Infinity)).toBe(0);
  });

  it("starts the current page at step 1 when no tutorial is active", () => {
    expect(getVisibleTutorial("dashboard", {})).toEqual({
      page: "dashboard",
      step: 1,
      shouldPersistStart: true,
    });
  });

  it("shows the current page even when another page was previously active", () => {
    expect(
      getVisibleTutorial("record", {
        tutorial_dismissed: false,
        active_tutorial_page: "dashboard",
        dashboard_tutorial_step: 3,
        record_tutorial_step: 0,
      }),
    ).toEqual({
      page: "record",
      step: 1,
      shouldPersistStart: true,
    });
  });

  it("resumes the active page at its saved step", () => {
    expect(
      getVisibleTutorial("dashboard", {
        active_tutorial_page: "dashboard",
        dashboard_tutorial_step: 3,
      }),
    ).toEqual({
      page: "dashboard",
      step: 3,
      shouldPersistStart: false,
    });
  });

  it("hides completed pages", () => {
    expect(
      getVisibleTutorial("dashboard", {
        active_tutorial_page: "",
        dashboard_tutorial_step: -1,
      }),
    ).toBeNull();
  });

  it("builds a next-step patch and completes the page at the final step", () => {
    expect(buildAdvanceTutorialPatch("dashboard", 1)).toEqual({
      active_tutorial_page: "dashboard",
      dashboard_tutorial_step: 2,
    });

    expect(buildAdvanceTutorialPatch("dashboard", 3)).toEqual({
      active_tutorial_page: "",
      dashboard_tutorial_step: -1,
    });
  });

  it("builds a previous-step patch without leaving the current page guide", () => {
    expect(buildBackTutorialPatch("record", 3)).toEqual({
      active_tutorial_page: "record",
      record_tutorial_step: 2,
    });

    expect(buildBackTutorialPatch("record", 1)).toEqual({
      active_tutorial_page: "record",
      record_tutorial_step: 1,
    });
  });

  it("builds an empty start patch for invalid pages", () => {
    const patch = buildStartTutorialPatch("settings");

    expect(patch).toEqual({});
    expect(patch).not.toHaveProperty("undefined");
  });

  it("builds an empty advance patch for invalid pages", () => {
    const patch = buildAdvanceTutorialPatch("settings", 1);

    expect(patch).toEqual({});
    expect(patch).not.toHaveProperty("undefined");
  });

  it("normalizes current step before advancing", () => {
    expect(buildAdvanceTutorialPatch("dashboard", 1.8)).toEqual({
      active_tutorial_page: "dashboard",
      dashboard_tutorial_step: 2,
    });

    expect(buildAdvanceTutorialPatch("dashboard", Number.NaN)).toEqual({
      active_tutorial_page: "dashboard",
      dashboard_tutorial_step: 1,
    });

    expect(buildAdvanceTutorialPatch("dashboard", Infinity)).toEqual({
      active_tutorial_page: "dashboard",
      dashboard_tutorial_step: 1,
    });
  });

  it("builds a patch that skips all tips", () => {
    expect(buildSkipTutorialPatch()).toEqual({
      tutorial_dismissed: true,
      active_tutorial_page: "",
    });
  });

  it("builds a reset patch for Account", () => {
    expect(buildResetTutorialPatch()).toEqual({
      tutorial_dismissed: false,
      active_tutorial_page: "",
      dashboard_tutorial_step: 0,
      record_tutorial_step: 0,
      connect_bot_tutorial_step: 0,
      feel_better_tutorial_step: 0,
    });
  });
});
