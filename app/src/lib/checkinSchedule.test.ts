import { describe, expect, it } from "vitest";
import {
  getDateKey,
  getHongKongNow,
  getQuarterHourKey,
  normalizeQuarterCheckinTime,
} from "../../base44/functions/_shared/checkinSchedule";

describe("check-in schedule helpers", () => {
  it("converts UTC time to Hong Kong time", () => {
    const hkNow = getHongKongNow(new Date("2026-06-28T07:15:00.000Z"));
    expect(getDateKey(hkNow)).toBe("2026-06-28");
    expect(getQuarterHourKey(hkNow)).toBe("15:15");
  });

  it("floors late scheduler runs to the current 15-minute slot", () => {
    const hkNow = new Date("2026-06-28T15:17:32.000Z");
    expect(getQuarterHourKey(hkNow)).toBe("15:15");
  });

  it("normalizes only supported quarter-hour user selections", () => {
    expect(normalizeQuarterCheckinTime("5:00")).toBe("05:00");
    expect(normalizeQuarterCheckinTime("15:45")).toBe("15:45");
    expect(normalizeQuarterCheckinTime("15:10")).toBe("22:30");
    expect(normalizeQuarterCheckinTime("99:00")).toBe("22:30");
  });
});
