import { describe, expect, it } from "vitest";
import { settingsSchema } from "@/lib/validation";

/**
 * Píxel de Meta.
 *
 * El id acaba dentro de una llamada de JavaScript en el navegador, así que la
 * validación NO es cosmética: aceptar texto libre sería dejar que quien entre
 * al panel inyecte código en todas las páginas públicas.
 */
describe("id del píxel de Meta", () => {
  it("acepta el id real del dueño", () => {
    const r = settingsSchema.safeParse({ meta_pixel_id: "2211697406447993" });
    expect(r.success).toBe(true);
  });

  it("la cadena vacía lo apaga y es válida", () => {
    const r = settingsSchema.safeParse({ meta_pixel_id: "" });
    expect(r.success).toBe(true);
  });

  it("RECHAZA cualquier cosa que no sean dígitos", () => {
    for (const malo of [
      "abc",
      "221169</script><script>alert(1)</script>",
      "2211697406447993'); alert(1);//",
      "221 169",
      "<img onerror=alert(1)>",
      "javascript:alert(1)",
      "22116974064479931234567890123",
    ]) {
      const r = settingsSchema.safeParse({ meta_pixel_id: malo });
      expect(r.success, `deberia rechazar: ${malo}`).toBe(false);
    }
  });

  it("rechaza un id demasiado corto", () => {
    expect(settingsSchema.safeParse({ meta_pixel_id: "123" }).success).toBe(false);
  });
});
