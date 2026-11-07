import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/database";
import { getOwnerSession } from "@/lib/session";
import { requireAgreementReapprovalForAssets } from "@/lib/agreement-approval-invalidation";

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isIdList(value: unknown): value is string[] {
  return Array.isArray(value) &&
    value.length <= 1000 &&
    value.every((entry) => typeof entry === "string" && entry.length > 0) &&
    new Set(value).size === value.length;
}

async function invalidateMappedAgreements(
  transaction: Prisma.TransactionClient,
  templateId: string,
) {
  const mappings = await transaction.assetTermTemplate.findMany({
    where: { templateId },
    select: { assetId: true },
  });
  await requireAgreementReapprovalForAssets(
    transaction,
    mappings.map(({ assetId }) => assetId),
  );
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
        const created = await transaction.ownerTermItem.create({
          data: {
            id: randomUUID(),
            templateId: template.id,
            position: (lastItem?.position ?? 0) + 1,
            text,
            importantObligation: body.importantObligation === true,
          },
        });
        await invalidateMappedAgreements(transaction, template.id);
        return created;
      });
      return NextResponse.json({ item }, { status: 201 });
    }

    if (body.action === "update-template") {
      const name = typeof body.name === "string" ? body.name.trim() : "";
      if (!name || name.length > 120) {
        return NextResponse.json({ error: "Enter a heading of 1 to 120 characters." }, { status: 400 });
      }
      const updated = await prisma.$transaction(async (transaction) => {
        const current = await transaction.ownerTermTemplate.findUnique({
          where: { id: template.id },
          select: { name: true },
        });
        const result = await transaction.ownerTermTemplate.update({
          where: { id: template.id },
          data: { name },
        });
        if (current?.name !== name) await invalidateMappedAgreements(transaction, template.id);
        return result;
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
      const item = await prisma.$transaction(async (transaction) => {
        const current = await transaction.ownerTermItem.findFirst({
          where: { id: itemId, templateId: template.id },
          select: { text: true, importantObligation: true },
        });
        if (!current) return false;
        const nextImportantObligation = typeof body.importantObligation === "boolean"
          ? body.importantObligation
          : current.importantObligation;
        await transaction.ownerTermItem.update({
          where: { id: itemId },
          data: { text, importantObligation: nextImportantObligation },
        });
        if (current.text !== text || current.importantObligation !== nextImportantObligation) {
          await invalidateMappedAgreements(transaction, template.id);
        }
        return true;
      });
      if (!item) {
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
        await invalidateMappedAgreements(transaction, template.id);
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
      const requestedAssetIds = body.assetIds;
      const assets = await prisma.asset.findMany({
        where: {
          id: { in: requestedAssetIds },
          building: {
            OR: [
              { ownerId: owner.id },
              { company: { ownerId: owner.id } },
            ],
          },
        },
        select: { id: true },
      });
      if (assets.length !== requestedAssetIds.length) {
        return NextResponse.json({ error: "One or more selected properties are not in your account." }, { status: 404 });
      }
      await prisma.$transaction(async (transaction) => {
        const current = await transaction.assetTermTemplate.findMany({
          where: { templateId: template.id },
          select: { assetId: true },
        });
        const currentIds = new Set(current.map(({ assetId }) => assetId));
        const nextIds = new Set(requestedAssetIds);
        const changedIds = [
          ...current.filter(({ assetId }) => !nextIds.has(assetId)).map(({ assetId }) => assetId),
          ...requestedAssetIds.filter((assetId) => !currentIds.has(assetId)),
        ];
        await transaction.assetTermTemplate.deleteMany({
          where: { templateId: template.id, assetId: { notIn: requestedAssetIds } },
        });
        await transaction.assetTermTemplate.createMany({
          data: requestedAssetIds.map((assetId) => ({ assetId, templateId: template.id })),
          skipDuplicates: true,
        });
        await requireAgreementReapprovalForAssets(transaction, changedIds);
      });
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
      await prisma.$transaction(async (transaction) => {
        const current = await transaction.assetTermTemplate.findUnique({
          where: { assetId_templateId: { assetId: asset.id, templateId: template.id } },
          select: { assetId: true },
        });
        if (body.mapped && !current) {
          await transaction.assetTermTemplate.create({
            data: { assetId: asset.id, templateId: template.id },
          });
          await requireAgreementReapprovalForAssets(transaction, [asset.id]);
        } else if (!body.mapped && current) {
          await transaction.assetTermTemplate.delete({
            where: { assetId_templateId: { assetId: asset.id, templateId: template.id } },
          });
          await requireAgreementReapprovalForAssets(transaction, [asset.id]);
        }
      });
      return NextResponse.json({ success: true });
    }

    if (body.action === "delete-template") {
      await prisma.$transaction(async (transaction) => {
        await invalidateMappedAgreements(transaction, template.id);
        await transaction.ownerTermTemplate.delete({ where: { id: template.id } });
      });
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
