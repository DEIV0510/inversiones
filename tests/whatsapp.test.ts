import { describe, expect, it } from "vitest";
import { normalizeWhatsApp, waLink } from "@/lib/whatsapp";

describe("normalizeWhatsApp", () => {
  it("normaliza formatos colombianos", () => {
    expect(normalizeWhatsApp("3106930187")).toBe("573106930187");
    expect(normalizeWhatsApp("310 693 0187")).toBe("573106930187");
    expect(normalizeWhatsApp("573106930187")).toBe("573106930187");
    expect(normalizeWhatsApp("03106930187")).toBe("573106930187"); // cero troncal
  });

  it("rechaza typos ambiguos y basura", () => {
    expect(normalizeWhatsApp("31069301879")).toBeNull(); // 11 dígitos con 3
    expect(normalizeWhatsApp("123")).toBeNull();
    expect(normalizeWhatsApp("")).toBeNull();
  });
});

describe("waLink", () => {
  it("codifica el mensaje", () => {
    const url = waLink("573106930187", "Hola, quiero el número 00042 & más");
    expect(url.startsWith("https://wa.me/573106930187?text=")).toBe(true);
    expect(url).toContain("%26"); // & codificado
    expect(url).not.toContain(" ");
  });
});
