import { describe, expect, it } from "vitest";
import {
  digitsForTotal,
  formatNumber,
  formatNumbers,
  parseNumberInput,
  validateSelection,
} from "@/lib/numbers";

describe("formatNumber", () => {
  it("rellena con ceros según los dígitos", () => {
    expect(formatNumber(42, 5)).toBe("00042");
    expect(formatNumber(0, 4)).toBe("0000");
    expect(formatNumber(99999, 5)).toBe("99999");
    expect(formatNumbers([1, 2], 3)).toEqual(["001", "002"]);
  });
});

describe("digitsForTotal", () => {
  it("calcula dígitos para cada escala", () => {
    expect(digitsForTotal(100)).toBe(2); // 00-99
    expect(digitsForTotal(10000)).toBe(4); // 0000-9999
    expect(digitsForTotal(100000)).toBe(5);
    expect(digitsForTotal(1000000)).toBe(6);
  });
});

describe("parseNumberInput", () => {
  it("acepta entradas válidas con y sin ceros", () => {
    expect(parseNumberInput("00042", 10000)).toBe(42);
    expect(parseNumberInput("42", 10000)).toBe(42);
    expect(parseNumberInput("9999", 10000)).toBe(9999);
  });
  it("rechaza fuera de rango y basura", () => {
    expect(parseNumberInput("10000", 10000)).toBeNull();
    expect(parseNumberInput("-1", 10000)).toBeNull();
    expect(parseNumberInput("abc", 10000)).toBeNull();
    expect(parseNumberInput("", 10000)).toBeNull();
    expect(parseNumberInput("12.5", 10000)).toBeNull();
  });
});

describe("validateSelection", () => {
  it("acepta selecciones válidas", () => {
    expect(validateSelection([1, 2, 3], 10000, 20)).toBeNull();
  });
  it("rechaza vacías, repetidas, fuera de rango y exceso", () => {
    expect(validateSelection([], 10000, 20)).toBeTruthy();
    expect(validateSelection([1, 1], 10000, 20)).toBeTruthy();
    expect(validateSelection([10000], 10000, 20)).toBeTruthy();
    expect(validateSelection([1, 2, 3], 10000, 2)).toBeTruthy();
  });
});
