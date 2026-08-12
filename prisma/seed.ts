import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const DEFAULT_SETTINGS: Record<string, string> = {
  company_name: "INVERSIONES D Y S",
  whatsapp_number: "573106930187",
  whatsapp_display: "310 693 0187",
  location: "Sincelejo, Sucre, Colombia",
  facebook_url: "",
  instagram_url: "",
  tiktok_url: "",
};

async function main() {
  for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
    await prisma.setting.upsert({
      where: { key },
      update: {},
      create: { key, value },
    });
  }

  const raffleCount = await prisma.raffle.count();
  if (raffleCount === 0) {
    await prisma.raffle.createMany({
      data: [
        // Las rifas de ejemplo se crean OCULTAS (isPublished: false) y con
        // avance 0 para no publicar sorteos ni porcentajes inventados: el
        // administrador las edita con datos reales y las activa desde el
        // panel.
        {
          title: "Gran Sorteo Motocicleta 0 KM",
          prize: "Motocicleta 0 KM",
          description:
            "Contenido de ejemplo: edita este sorteo desde el panel administrativo con la información real (premio, precio, fecha y condiciones) y actívalo cuando esté listo.",
          imageUrl: "/img/premio-moto.svg",
          priceCop: 10000,
          drawDateText: "Fecha por anunciar",
          progressPct: 0,
          status: "active",
          isPublished: false,
          displayOrder: 1,
        },
        {
          title: "Sorteo Dinero en Efectivo",
          prize: "Dinero en efectivo",
          description:
            "Contenido de ejemplo: edita este sorteo desde el panel administrativo con la información real (premio, precio, fecha y condiciones) y actívalo cuando esté listo.",
          imageUrl: "/img/premio-dinero.svg",
          priceCop: 5000,
          drawDateText: "Fecha por anunciar",
          progressPct: 0,
          status: "active",
          isPublished: false,
          displayOrder: 2,
        },
        {
          title: "Próximo Gran Sorteo",
          prize: "Premio por anunciar",
          description:
            "Muy pronto anunciaremos un nuevo premio. Mantente atento a nuestras redes y a esta página.",
          imageUrl: "/img/premio-proximo.svg",
          priceCop: null,
          drawDateText: "Próximamente",
          progressPct: 0,
          status: "coming_soon",
          isPublished: true,
          displayOrder: 3,
        },
      ],
    });
    console.log("Rifas de ejemplo creadas.");
  }

  console.log("Seed completado.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
