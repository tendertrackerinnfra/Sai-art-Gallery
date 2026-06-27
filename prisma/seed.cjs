const { PrismaClient } = require("@prisma/client");
const { randomBytes, scryptSync } = require("node:crypto");

const prisma = new PrismaClient();

async function main() {
  const roles = [
    ["Owner", "Full access, including backup and restore."],
    ["Manager", "Operational management without backup restore access."],
    ["Staff", "Daily sales and inventory operations with restricted reporting."],
    ["Accountant", "Financial records, payments, expenses, and reports."],
  ];

  for (const [name, description] of roles) {
    await prisma.role.upsert({
      where: { name },
      update: { description },
      create: { name, description },
    });
  }

  const ownerPassword = process.env.DEFAULT_OWNER_PASSWORD;
  const ownerEmail = (process.env.DEFAULT_OWNER_EMAIL || "owner@saiartgallery.local").toLowerCase();
  const existingOwner = await prisma.user.findUnique({ where: { email: ownerEmail } });

  if (!existingOwner && ownerPassword) {
    if (ownerPassword.length < 12 || ownerPassword.length > 128) {
      throw new Error("DEFAULT_OWNER_PASSWORD must be between 12 and 128 characters.");
    }
    const ownerRole = await prisma.role.findUniqueOrThrow({ where: { name: "Owner" } });
    const salt = randomBytes(16);
    const passwordHash = `scrypt:${salt.toString("hex")}:${scryptSync(ownerPassword, salt, 64).toString("hex")}`;

    await prisma.user.create({
      data: {
        name: "Sai Art Gallery Owner",
        email: ownerEmail,
        passwordHash,
        roleId: ownerRole.id,
      },
    });
    console.log(`Created local Owner account: ${ownerEmail}`);
  } else if (!existingOwner) {
    console.log("Owner account skipped. Set DEFAULT_OWNER_PASSWORD before the first seed.");
  } else {
    console.log(`Owner account already exists: ${ownerEmail}`);
  }

  const categories = [
    ["Earrings", "EAR"],
    ["Necklaces", "NEC"],
    ["Bracelets", "BRA"],
    ["Rings", "RNG"],
  ];

  for (const [name, skuPrefix] of categories) {
    await prisma.productCategory.upsert({
      where: { name },
      update: { skuPrefix },
      create: { name, skuPrefix },
    });
  }

  await prisma.setting.upsert({
    where: { key: "invoice_prefix" },
    update: { value: "SAG" },
    create: {
      key: "invoice_prefix",
      value: "SAG",
      description: "Prefix used for invoice numbers.",
    },
  });

  console.log("Seeded roles, product categories, and initial settings.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
