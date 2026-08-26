import { describe, expect, it } from "vitest";
import { enMegas, MAX_SUBIDA_BYTES } from "@/lib/comprimir-imagen";

/**
 * El techo de subida no es un número cualquiera: Vercel corta las peticiones
 * a una función serverless por encima de ~4,5 MB EN SU BORDE, así que la
 * función ni se ejecuta y devuelve texto plano en vez de JSON. Medido en
 * producción: 2,03 MB → 201, 4,46 MB → 413, 7,03 MB → 413.
 *
 * Si alguien sube este tope por encima de ese corte, el panel volvería a
 * enseñar "No fue posible subir la imagen" sin explicación.
 */
describe("techo de subida", () => {
  it("se queda por debajo del corte de Vercel (4,5 MB)", () => {
    expect(MAX_SUBIDA_BYTES).toBeLessThan(4.5 * 1024 * 1024);
  });

  it("deja sitio suficiente para un flyer normal", () => {
    expect(MAX_SUBIDA_BYTES).toBeGreaterThanOrEqual(3 * 1024 * 1024);
  });

  it("los tamaños se le dicen al usuario en megas legibles", () => {
    expect(enMegas(4 * 1024 * 1024)).toBe("4.0");
    expect(enMegas(7_374_182)).toBe("7.0");
    expect(enMegas(0)).toBe("0.0");
  });
});
