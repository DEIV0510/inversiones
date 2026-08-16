/**
 * Serialización segura de JSON-LD para incrustarlo en un <script>.
 *
 * JSON.stringify NO escapa "<": si un valor guardado en Configuración (el
 * nombre de la empresa, la ubicación, el WhatsApp visible…) contiene
 * "</script>", el navegador cierra ahí la etiqueta y todo lo que venga
 * detrás se ejecuta como JavaScript en la portada pública. Sería un XSS
 * persistente al alcance de cualquier usuario con permiso de Configuración.
 *
 * Cada carácter peligroso se sustituye por su secuencia \uXXXX, que dentro de
 * una cadena JSON sigue valiendo el mismo texto: el buscador lee el nombre
 * original y el navegador ya no ve ninguna etiqueta.
 */

// Los caracteres se nombran por su código: escribirlos como literales sería
// imposible para U+2028/U+2029, que ECMAScript trata como fin de línea y
// romperían este mismo archivo.
const BARRA = String.fromCharCode(92);
const CODIGOS = [0x3c, 0x3e, 0x26, 0x2028, 0x2029];

const PELIGROSOS = CODIGOS.map((c) => String.fromCharCode(c)).join("");
const ESCAPES = new Map(
  CODIGOS.map((codigo) => [
    String.fromCharCode(codigo),
    BARRA + "u" + codigo.toString(16).padStart(4, "0"),
  ])
);
const REGEX = new RegExp("[" + PELIGROSOS + "]", "g");

export function jsonLdSeguro(data: unknown): string {
  return JSON.stringify(data).replace(
    REGEX,
    (caracter) => ESCAPES.get(caracter) ?? caracter
  );
}
