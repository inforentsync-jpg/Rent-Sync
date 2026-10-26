import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/database";
import { getOwnerSession } from "@/lib/session";

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isIdList(value: unknown): value is string[] {
  return Array.isArray(value) &&
    value.length <= 1000 &&
    value.every((entry) => typeof entry === "string" && entry.length > 0) &&
    new Set(value).size === value.length;
}

export async function GET() {
  const session = await getOwnerSession();
  if (!session) {
    return NextResponse.json({ error: "Owner sign-in is required." }, { status: 401 });
  }

  try {
    const owner = await prisma.propertyOwner.findUnique({
      where: { mobileNumber: session.mobileNumber },
      select: { id: true },
    });
    if (!owner) {
      return NextResponse.json({ error: "Owner account was not found." }, { status: 404 });
    }

    const [templates, assets] = await Promise.all([
      prisma.ownerTermTemplate.findMany({
        where: { ownerId: owner.id },
        orderBy: { createdAt: "desc" },
        include: {
          items: { orderBy: { position: "asc" } },
          assets: { select: { assetId: true } },
        },
      }),
      prisma.asset.findMany({
        where: {
          building: {
            OR: [
              { ownerId: owner.id },
              { company: { ownerId: owner.id } },
            ],
          },
        },
        orderBy: [{ building: { name: "asc" } }, { unitNumber: "asc" }],
        select: {
          id: true,
          name: true,
          unitNumber: true,
          buildingId: true,
          building: { select: { name: true } },
          termTemplates: { select: { templateId: true } },
        },
      }),
    ]);

    return NextResponse.json({
      templates: templates.map(({ assets: mappedAssets, ...template }) => ({
        ...template,
        assetIds: mappedAssets.map(({ assetId }) => assetId),
      })),
      assets: assets.map(({ building, termTemplates, ...asset }) => ({
        ...asset,
        buildingName: building.name,
        templateIds: termTemplates.map(({ templateId }) => templateId),
      })),
    });
  } catch (error) {
    console.error("Unable to load owner terms.", error);
    return NextResponse.json({ error: "Unable to load your terms." }, { status: 503 });
  }
}

export async function POST(request: Request) {
  const session = await getOwnerSession();
  if (!session) {
    return NextResponse.json({ error: "Owner sign-in is required." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  if (!isRecord(body) || typeof body.action !== "string") {
    return NextResponse.json({ error: "Invalid terms request." }, { status: 400 });
  }

  try {
    const owner = await prisma.propertyOwner.findUnique({
      where: { mobileNumber: session.mobileNumber },
      select: { id: true },
    });
    if (!owner) {
      return NextResponse.json({ error: "Owner account was not found." }, { status: 404 });
    }

    if (body.action === "create-template") {
      const name = typeof body.name === "string" ? body.name.trim() : "";
      if (!name || name.length > 120) {
        return NextResponse.json({ error: "Enter a heading of 1 to 120 characters." }, { status: 400 });
      }
      const template = await prisma.ownerTermTemplate.create({
        data: { id: randomUUID(), ownerId: owner.id, name },
        include: { items: true },
      });
      return NextResponse.json({ template }, { status: 201 });
    }

    if (typeof body.templateId !== "string" || !body.templateId) {
      return NextResponse.json({ error: "Choose a terms heading." }, { status: 400 });
    }
    const template = await prisma.ownerTermTemplate.findFirst({
      where: { id: body.templateId, ownerId: owner.id },
      select: { id: true },
    });
    if (!template) {
      return NextResponse.json({ error: "Terms heading not found in your account." }, { status: 404 });
    }

    if (body.action === "add-item") {
      const text = typeof body.text === "string" ? body.text.trim() : "";
      if (body.importantObligation !== undefined && typeof body.importantObligation !== "boolean") {
        return NextResponse.json({ error: "Choose whether this term is an important obligation." }, { status: 400 });
      }
      if (!text || text.length > 1000) {
        return NextResponse.json({ error: "Enter a term of 1 to 1,000 characters." }, { status: 400 });
      }
      const item = await prisma.$transaction(async (transaction) => {
        const count = await transaction.ownerTermItem.count({ where: { templateId: template.id } });
        if (count >= 100) throw new Error("A heading can contain at most 100 terms.");
        const lastItem = await transaction.ownerTermItem.findFirst({
          where: { templateId: template.id },
          orderBy: { position: "desc" },
          select: { position: true },
        });
        return transaction.ownerTermItem.create({
          data: {
            id: randomUUID(),
            templateId: template.id,
            position: (lastItem?.position ?? 0) + 1,
            text,
            importantObligation: body.importantObligation === true,
          },
        });
      });
      return NextResponse.json({ item }, { status: 201 });
    }

    if (body.action === "update-template") {
      const name = typeof body.name === "string" ? body.name.trim() : "";
      if (!name || name.length > 120) {
        return NextResponse.json({ error: "Enter a heading of 1 to 120 characters." }, { status: 400 });
      }
      const updated = await prisma.ownerTermTemplate.update({
        where: { id: template.id },
        data: { name },
      });
      return NextResponse.json({ template: updated });
    }

    if (body.action === "update-item") {
      const itemId = typeof body.itemId === "string" ? body.itemId : "";
      const text = typeof body.text === "string" ? body.text.trim() : "";
      if (body.importantObligation !== undefined && typeof body.importantObligation !== "boolean") {
        return NextResponse.json({ error: "Choose whether this term is an important obligation." }, { status: 400 });
      }
      if (!itemId || !text || text.length > 1000) {
        return NextResponse.json({ error: "Enter a term of 1 to 1,000 characters." }, { status: 400 });
      }
      const item = await prisma.ownerTermItem.updateMany({
        where: { id: itemId, templateId: template.id },
        data: {
          text,
          ...(typeof body.importantObligation === "boolean"
            ? { importantObligation: body.importantObligation }
            : {}),
        },
      });
      if (!item.count) {
        return NextResponse.json({ error: "Term not found in this heading." }, { status: 404 });
      }
      return NextResponse.json({ success: true });
    }

    if (body.action === "delete-item") {
      if (typeof body.itemId !== "string" || !body.itemId) {
        return NextResponse.json({ error: "Choose a term to remove." }, { status: 400 });
      }
      const itemId = body.itemId;
      const removed = await prisma.$transaction(async (transaction) => {
        const item = await transaction.ownerTermItem.findFirst({
          where: { id: itemId, templateId: template.id },
        });
        if (!item) return false;
        await transaction.ownerTermItem.delete({ where: { id: item.id } });
        const remaining = await transaction.ownerTermItem.findMany({
          where: { templateId: template.id },
          orderBy: { position: "asc" },
          select: { id: true },
        });
        for (const [index, entry] of remaining.entries()) {
          await transaction.ownerTermItem.update({
            where: { id: entry.id },
            data: { position: -(index + 1) },
          });
        }
        for (const [index, entry] of remaining.entries()) {
          await transaction.ownerTermItem.update({
            where: { id: entry.id },
            data: { position: index + 1 },
          });
        }
        return true;
      });
      if (!removed) {
        return NextResponse.json({ error: "Term not found in this heading." }, { status: 404 });
      }
      return NextResponse.json({ success: true });
    }

    if (body.action === "map-assets") {
      if (!isIdList(body.assetIds)) {
        return NextResponse.json({ error: "Select up to 1,000 valid properties." }, { status: 400 });
      }
      const assets = await prisma.asset.findMany({
        where: {
          id: { in: body.assetIds },
          building: {
            OR: [
              { ownerId: owner.id },
              { company: { ownerId: owner.id } },
            ],
          },
        },
        select: { id: true },
      });
      if (assets.length !== body.assetIds.length) {
        return NextResponse.json({ error: "One or more selected properties are not in your account." }, { status: 404 });
      }
      await prisma.$transaction([
        prisma.assetTermTemplate.deleteMany({
          where: { templateId: template.id, assetId: { notIn: body.assetIds } },
        }),
        prisma.assetTermTemplate.createMany({
          data: body.assetIds.map((assetId) => ({ assetId, templateId: template.id })),
          skipDuplicates: true,
        }),
      ]);
      return NextResponse.json({ success: true });
    }

    if (body.action === "map-asset") {
      if (typeof body.assetId !== "string" || !body.assetId || typeof body.mapped !== "boolean") {
        return NextResponse.json({ error: "Choose a property and whether to include this heading." }, { status: 400 });
      }
      const asset = await prisma.asset.findFirst({
        where: {
          id: body.assetId,
          building: {
            OR: [
              { ownerId: owner.id },
              { company: { ownerId: owner.id } },
            ],
          },
        },
        select: { id: true },
      });
      if (!asset) {
        return NextResponse.json({ error: "Property not found in your account." }, { status: 404 });
      }
      if (body.mapped) {
        await prisma.assetTermTemplate.upsert({
          where: { assetId_templateId: { assetId: asset.id, templateId: template.id } },
          create: { assetId: asset.id, templateId: template.id },
          update: {},
        });
      } else {
        await prisma.assetTermTemplate.deleteMany({
          where: { assetId: asset.id, templateId: template.id },
        });
      }
      return NextResponse.json({ success: true });
    }

    if (body.action === "delete-template") {
      await prisma.ownerTermTemplate.delete({ where: { id: template.id } });
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Unknown terms action." }, { status: 400 });
  } catch (error) {
    if (error instanceof Error && error.message === "A heading can contain at most 100 terms.") {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("Unable to save owner terms.", error);
    return NextResponse.json({ error: "Unable to save your terms." }, { status: 503 });
  }
}
