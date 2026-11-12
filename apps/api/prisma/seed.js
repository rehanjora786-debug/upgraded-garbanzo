
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";

const prisma = new PrismaClient();

const SHOP_NAME = "Trio Tales";
const OWNER_NAME = "Md Samee I Jora";
const OWNER_EMAIL = "owner@trio-tales.com";
const OWNER_PASSWORD = "Samee1234";
const KITCHEN_EMAIL = "kitchen@trio-tales.com";
const KITCHEN_PASSWORD = "Kitchen1234";
const CASHIER_EMAIL = "cashier@trio-tales.com";
const CASHIER_PASSWORD = "Cashier1234";

async function main() {
  let cafe = await prisma.cafe.findFirst();

  if (!cafe) {
    cafe = await prisma.cafe.create({
      data: {
        name: SHOP_NAME,
        slug: "trio-tales",
        phone: "9380160062",
        currency: "INR"
      }
    });

    console.log(`Created default cafe: ${cafe.name}`);
  }

  const ownerUser = await prisma.user.findUnique({ where: { email: OWNER_EMAIL } });

  if (!ownerUser) {
    const passwordHash = await bcrypt.hash(OWNER_PASSWORD, 12);

    await prisma.user.create({
      data: {
        cafeId: cafe.id,
        name: OWNER_NAME,
        email: OWNER_EMAIL,
        passwordHash,
        role: "OWNER"
      }
    });

    console.log(`Created default owner: ${OWNER_EMAIL} / ${OWNER_PASSWORD}`);
  }

  const kitchenUser = await prisma.user.findUnique({ where: { email: KITCHEN_EMAIL } });

  if (!kitchenUser) {
    const passwordHash = await bcrypt.hash(KITCHEN_PASSWORD, 12);

    await prisma.user.create({
      data: {
        cafeId: cafe.id,
        name: "Kitchen Staff",
        email: KITCHEN_EMAIL,
        passwordHash,
        role: "KITCHEN"
      }
    });

    console.log(`Created default kitchen user: ${KITCHEN_EMAIL} / ${KITCHEN_PASSWORD}`);
  }

  const cashierUser = await prisma.user.findUnique({ where: { email: CASHIER_EMAIL } });

  if (!cashierUser) {
    const passwordHash = await bcrypt.hash(CASHIER_PASSWORD, 12);

    await prisma.user.create({
      data: {
        cafeId: cafe.id,
        name: "Cashier Staff",
        email: CASHIER_EMAIL,
        passwordHash,
        role: "CASHIER"
      }
    });

    console.log(`Created default cashier user: ${CASHIER_EMAIL} / ${CASHIER_PASSWORD}`);
  }

  const staleCategories = await prisma.menuCategory.findMany({
    where: { cafeId: cafe.id, name: { in: ["pizaa", "Pizaa", "pizza"] } }
  });

  for (const staleCategory of staleCategories) {
    const staleItems = await prisma.menuItem.findMany({ where: { cafeId: cafe.id, categoryId: staleCategory.id } });
    if (staleItems.length === 0) {
      await prisma.menuCategory.delete({ where: { id: staleCategory.id } });
    }
  }

  const categoryDefinitions = [
    { name: "Pizza", sortOrder: 1 },
    { name: "Burgers", sortOrder: 2 },
    { name: "Drinks", sortOrder: 3 },
    { name: "Desserts", sortOrder: 4 }
  ];

  const createdCategories = {};

  for (const definition of categoryDefinitions) {
    const existingCategory = await prisma.menuCategory.findFirst({
      where: {
        cafeId: cafe.id,
        name: definition.name
      }
    });

    if (existingCategory) {
      createdCategories[definition.name] = existingCategory;
      continue;
    }

    const category = await prisma.menuCategory.create({
      data: {
        cafeId: cafe.id,
        name: definition.name,
        sortOrder: definition.sortOrder
      }
    });

    createdCategories[definition.name] = category;
  }

  const menuItems = [
    { category: "Pizza", name: "Margherita Pizza", description: "Classic cheese pizza with fresh basil and tomato sauce.", pricePaise: 49900, imageUrl: "/images/menu/margherita.jpg" },
    { category: "Pizza", name: "Pepperoni Pizza", description: "Loaded with pepperoni and mozzarella.", pricePaise: 69900, imageUrl: "/images/menu/pepperoni.jpg" },
    { category: "Pizza", name: "BBQ Chicken Pizza", description: "Smoky BBQ chicken, red onion, and cheddar.", pricePaise: 74900, imageUrl: "/images/menu/bbq.jpg" },
    { category: "Pizza", name: "Veg Supreme", description: "Bell peppers, olives, onions, mushrooms, and mozzarella.", pricePaise: 72900, imageUrl: "/images/menu/veg.jpg" },
    { category: "Burgers", name: "Classic Beef Burger", description: "Juicy grilled beef patty with lettuce and cheddar.", pricePaise: 39900, imageUrl: "/images/menu/beef.jpg" },
    { category: "Burgers", name: "Crispy Chicken Burger", description: "Crunchy chicken fillet with burger sauce.", pricePaise: 35900, imageUrl: "/images/menu/chicken.jpg" },
    { category: "Drinks", name: "Coke", description: "Cold soft drink served chilled.", pricePaise: 9900, imageUrl: "/images/menu/coke.jpg" },
    { category: "Drinks", name: "Fresh Lime Soda", description: "Refreshing lime soda with mint.", pricePaise: 14900, imageUrl: "/images/menu/lime.jpg" },
    { category: "Desserts", name: "Chocolate Brownie", description: "Warm brownie with chocolate fudge.", pricePaise: 19900, imageUrl: "/images/menu/brownie.jpg" },
    { category: "Desserts", name: "Vanilla Sundae", description: "Creamy vanilla ice cream with sauce.", pricePaise: 17900, imageUrl: "/images/menu/sundae.jpg" }
  ];

  for (const item of menuItems) {
    const category = createdCategories[item.category];
    if (!category) continue;

    const existingItem = await prisma.menuItem.findFirst({
      where: {
        cafeId: cafe.id,
        name: item.name
      }
    });

    if (!existingItem) {
      await prisma.menuItem.create({
        data: {
          cafeId: cafe.id,
          categoryId: category.id,
          name: item.name,
          description: item.description,
          pricePaise: item.pricePaise,
          available: true,
          imageUrl: item.imageUrl || null
        }
      });
    } else {
      const shouldUpdateImage = !existingItem.imageUrl || !String(existingItem.imageUrl).startsWith("/images/") || existingItem.imageUrl !== item.imageUrl;

      if (shouldUpdateImage && item.imageUrl) {
        await prisma.menuItem.update({
          where: { id: existingItem.id },
          data: { imageUrl: item.imageUrl }
        });
      }
    }
  }

  for (let number = 1; number <= 8; number++) {
    const label = `Table ${number}`;

    await prisma.cafeTable.upsert({
      where: {
        cafeId_label: {
          cafeId: cafe.id,
          label,
        },
      },
      update: {},
      create: {
        cafeId: cafe.id,
        label,
        qrToken: crypto.randomBytes(24).toString("hex"),
        active: true,
      },
    });
  }

  console.log("Successfully created or verified the default cafe, owner, menu items, and Tables 1–8!");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });