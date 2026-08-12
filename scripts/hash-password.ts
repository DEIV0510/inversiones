// Genera el hash bcrypt (codificado en base64) de una contraseña para
// ADMIN_PASSWORD_HASH (.env). Se usa base64 porque el hash contiene "$",
// que el cargador de variables de entorno de Next.js corrompería.
// Uso: npm run hash-password -- "MiNuevaContraseña"
import bcrypt from "bcryptjs";

const password = process.argv[2];
if (!password || password.length < 8) {
  console.error("Uso: npm run hash-password -- \"contraseña de mínimo 8 caracteres\"");
  process.exit(1);
}

const hash = bcrypt.hashSync(password, 12);
const encoded = Buffer.from(hash, "utf8").toString("base64");
console.log("\nCopia esta línea en tu archivo .env:\n");
console.log(`ADMIN_PASSWORD_HASH="${encoded}"`);
