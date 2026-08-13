// Confirma manualmente el pago de una orden (simula la acción del admin).
// Uso: node scripts/dev-confirm.cjs CODIGO
const { execSync } = require("node:child_process");
const code = process.argv[2];
if (!code) {
  console.error("Uso: node scripts/dev-confirm.cjs CODIGO");
  process.exit(1);
}
execSync(
  `npx tsx -e "import { prisma } from './src/lib/db'; import { confirmOrderPayment } from './src/lib/engine/orders'; (async () => { const o = await prisma.order.findUnique({ where: { code: '${code}' } }); if (!o) throw new Error('orden no existe'); const r = await confirmOrderPayment({ orderId: o.id, provider: 'manual' }); console.log(JSON.stringify(r.ok ? { ok: true } : r)); await prisma.$disconnect(); })()"`,
  { stdio: "inherit" }
);
