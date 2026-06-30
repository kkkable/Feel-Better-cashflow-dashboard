export type TutorialPage = "dashboard" | "record" | "telegram" | "feel-better";

type TutorialSettings = {
  tutorial_dismissed?: unknown;
  active_tutorial_page?: unknown;
  dashboard_tutorial_step?: unknown;
  record_tutorial_step?: unknown;
  connect_bot_tutorial_step?: unknown;
  feel_better_tutorial_step?: unknown;
};

type VisibleTutorial = {
  page: TutorialPage;
  step: number;
  shouldPersistStart: boolean;
};

const STEP_FIELDS: Record<TutorialPage, keyof TutorialSettings> = {
  dashboard: "dashboard_tutorial_step",
  record: "record_tutorial_step",
  telegram: "connect_bot_tutorial_step",
  "feel-better": "feel_better_tutorial_step",
};

const STEP_COUNTS: Record<TutorialPage, number> = {
  dashboard: 3,
  record: 4,
  telegram: 3,
  "feel-better": 2,
};

export const TUTORIAL_PAGES = Object.keys(STEP_FIELDS) as TutorialPage[];

export function normalizeTutorialStep(value: unknown) {
  const numericValue =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim() !== ""
        ? Number(value)
        : Number.NaN;

  if (!Number.isFinite(numericValue)) return 0;
  return Math.trunc(numericValue);
}

function normalizeTutorialPage(value: unknown): TutorialPage | "" {
  return TUTORIAL_PAGES.includes(value as TutorialPage) ? (value as TutorialPage) : "";
}

export function getVisibleTutorial(
  currentPage: string,
  settings: TutorialSettings | null | undefined,
): VisibleTutorial | null {
  const page = normalizeTutorialPage(currentPage);
  if (!page || settings?.tutorial_dismissed === true) return null;

  const stepField = STEP_FIELDS[page];
  const savedStep = normalizeTutorialStep(settings?.[stepField]);
  if (savedStep === -1) return null;

  if (savedStep <= 0) {
    return {
      page,
      step: 1,
      shouldPersistStart: true,
    };
  }

  return {
    page,
    step: Math.min(savedStep, STEP_COUNTS[page]),
    shouldPersistStart: false,
  };
}

export function buildStartTutorialPatch(pageInput: unknown) {
  const page = normalizeTutorialPage(pageInput);
  if (!page) return {};

  return {
    active_tutorial_page: page,
    [STEP_FIELDS[page]]: 1,
  };
}

export function buildAdvanceTutorialPatch(pageInput: unknown, currentStep: unknown) {
  const page = normalizeTutorialPage(pageInput);
  if (!page) return {};

  const normalizedCurrentStep = Math.max(0, normalizeTutorialStep(currentStep));
  const nextStep = normalizedCurrentStep + 1;
  if (nextStep > STEP_COUNTS[page]) {
    return {
      active_tutorial_page: "",
      [STEP_FIELDS[page]]: -1,
    };
  }

  return {
    active_tutorial_page: page,
    [STEP_FIELDS[page]]: nextStep,
  };
}

export function buildBackTutorialPatch(pageInput: unknown, currentStep: unknown) {
  const page = normalizeTutorialPage(pageInput);
  if (!page) return {};

  const normalizedCurrentStep = Math.max(1, normalizeTutorialStep(currentStep));
  return {
    active_tutorial_page: page,
    [STEP_FIELDS[page]]: Math.max(1, normalizedCurrentStep - 1),
  };
}

export function buildSkipTutorialPatch() {
  return {
    tutorial_dismissed: true,
    active_tutorial_page: "",
  };
}

export function buildResetTutorialPatch() {
  return {
    tutorial_dismissed: false,
    active_tutorial_page: "",
    dashboard_tutorial_step: 0,
    record_tutorial_step: 0,
    connect_bot_tutorial_step: 0,
    feel_better_tutorial_step: 0,
  };
}
