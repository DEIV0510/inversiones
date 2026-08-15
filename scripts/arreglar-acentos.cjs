/**
 * Repara textos con doble codificación (mojibake tipo "nÃºmero").
 *
 * Ocurre cuando un archivo UTF-8 sin BOM se lee como Windows-1252 y se vuelve
 * a guardar como UTF-8. El arreglo se hace TRAMO A TRAMO: se localiza cada
 * secuencia dañada, se codifica de vuelta a cp1252 y se decodifica como UTF-8.
 * Los tramos ya correctos del archivo no se tocan, así que un archivo mixto
 * (parte sana, parte rota) también se repara.
 */
const fs = require("fs");
const path = require("path");

// Tramo 0x80-0x9F de Windows-1252 (el resto coincide con latin1).
const CP1252_ALTOS = new Map([
  ["€", 0x80], ["‚", 0x82], ["ƒ", 0x83], ["„", 0x84],
  ["…", 0x85], ["†", 0x86], ["‡", 0x87], ["ˆ", 0x88],
  ["‰", 0x89], ["Š", 0x8a], ["‹", 0x8b], ["Œ", 0x8c],
  ["Ž", 0x8e], ["‘", 0x91], ["’", 0x92], ["“", 0x93],
  ["”", 0x94], ["•", 0x95], ["–", 0x96], ["—", 0x97],
  ["˜", 0x98], ["™", 0x99], ["š", 0x9a], ["›", 0x9b],
  ["œ", 0x9c], ["ž", 0x9e], ["Ÿ", 0x9f],
]);

/** Caracteres que puede producir un byte de continuación UTF-8 leído como cp1252. */
const CONT =
  "\\u0080-\\u00BF" +
  "\\u20AC\\u201A\\u0192\\u201E\\u2026\\u2020\\u2021\\u02C6\\u2030\\u0160" +
  "\\u2039\\u0152\\u017D\\u2018\\u2019\\u201C\\u201D\\u2022\\u2013\\u2014" +
  "\\u02DC\\u2122\\u0161\\u203A\\u0153\\u017E\\u0178";

// Un tramo roto empieza en Â/Ã/â (los bytes guía C2/C3/E2) y sigue con
// caracteres de continuación.
const TRAMO = new RegExp(`[\\u00C2\\u00C3\\u00E2][${CONT}]+`, "g");
const SOSPECHA = new RegExp(`[\\u00C2\\u00C3\\u00E2][${CONT}]`);

const EXTENSIONES = /\.(tsx?|css|mjs|json|md)$/;
const OMITIR = new Set(["node_modules", ".next", ".git", "_backup"]);

/** Bytes cp1252 de una cadena, o null si algún carácter no cabe. */
function aCp1252(texto) {
  const bytes = Buffer.alloc(texto.length);
  for (let i = 0; i < texto.length; i++) {
    const code = texto.charCodeAt(i);
    if (code <= 0xff) {
      bytes[i] = code;
      continue;
    }
    const alto = CP1252_ALTOS.get(texto[i]);
    if (alto === undefined) return null;
    bytes[i] = alto;
  }
  return bytes;
}

/** Decodifica un tramo dañado; devuelve null si no queda limpio. */
function repararTramo(tramo) {
  const bytes = aCp1252(tramo);
  if (!bytes) return null;
  const limpio = bytes.toString("utf8");
  if (limpio.includes("�")) return null;
  if (SOSPECHA.test(limpio)) return null;
  return limpio;
}

function recorrer(dir, salida) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (OMITIR.has(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) recorrer(p, salida);
    else if (EXTENSIONES.test(e.name)) salida.push(p);
  }
}

const raiz = process.cwd();
const archivos = [];
for (const d of ["src", "scripts", "prisma"]) {
  const full = path.join(raiz, d);
  if (fs.existsSync(full)) recorrer(full, archivos);
}

let arreglados = 0;
let tramosOk = 0;
let tramosFallidos = 0;

for (const p of archivos) {
  const texto = fs.readFileSync(p, "utf8");
  if (!SOSPECHA.test(texto)) continue;
  let cambios = 0;
  const nuevo = texto.replace(TRAMO, (tramo) => {
    const limpio = repararTramo(tramo);
    if (limpio === null) {
      tramosFallidos++;
      return tramo;
    }
    cambios++;
    tramosOk++;
    return limpio;
  });
  if (cambios === 0) continue;
  fs.writeFileSync(p, nuevo, "utf8");
  arreglados++;
  console.log(`${String(cambios).padStart(3)} tramos  ${path.relative(raiz, p)}`);
}

console.log(
  `\n${arreglados} archivos reparados · ${tramosOk} tramos corregidos · ${tramosFallidos} sin resolver`
);
