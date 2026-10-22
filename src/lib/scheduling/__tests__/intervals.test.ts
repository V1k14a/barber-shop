import { describe, expect, it } from "vitest";
import { isContained, normalize, overlaps, subtract } from "../intervals";

const iv = (start: number, end: number) => ({ start, end });

describe("normalize", () => {
  it("sorts, merges overlapping and touching intervals, drops empty ones", () => {
    expect(normalize([iv(5, 7), iv(0, 2), iv(2, 3), iv(6, 9), iv(4, 4)])).toEqual([iv(0, 3), iv(5, 9)]);
  });
});

describe("subtract", () => {
  it("cuts a hole in the middle", () => {
    expect(subtract([iv(0, 10)], [iv(3, 5)])).toEqual([iv(0, 3), iv(5, 10)]);
  });
  it("cuts the edges", () => {
    expect(subtract([iv(0, 10)], [iv(-5, 2), iv(8, 20)])).toEqual([iv(2, 8)]);
  });
  it("removes everything when fully covered", () => {
    expect(subtract([iv(0, 10)], [iv(0, 10)])).toEqual([]);
  });
  it("ignores cuts outside the base", () => {
    expect(subtract([iv(0, 10)], [iv(10, 20), iv(-5, 0)])).toEqual([iv(0, 10)]);
  });
  it("handles several bases and overlapping cuts", () => {
    expect(subtract([iv(0, 10), iv(20, 30)], [iv(5, 25), iv(6, 7)])).toEqual([iv(0, 5), iv(25, 30)]);
  });
});

describe("overlaps / isContained", () => {
  it("treats intervals as half-open", () => {
    expect(overlaps(iv(0, 10), iv(10, 20))).toBe(false);
    expect(overlaps(iv(0, 10), iv(9, 20))).toBe(true);
  });
  it("checks containment", () => {
    expect(isContained(iv(2, 5), [iv(0, 5)])).toBe(true);
    expect(isContained(iv(2, 6), [iv(0, 5), iv(5, 10)])).toBe(false);
  });
});
