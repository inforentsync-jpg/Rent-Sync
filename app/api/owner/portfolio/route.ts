import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/database";
import {
  createDevAgreement,
  createDevAsset,
  createDevCompany,
  createDevOwnerBuilding,
  createDevTenant,
  DevAgreementConflictError,
  generateDevAnnualAgreementDrafts,
  getDevOwnerPortfolio,
  updateDevAsset,
} from "@/lib/dev-store";
import { getOwnerSession } from "@/lib/session";
import { hasValidElevenMonthTerm } from "@/lib/rental-agreement";
import { generateAnnualAgreementDrafts } from "@/lib/annual-agreement-drafts";

type PortfolioInput = Record<string, unknown>;

function isRecord(value: unknown): value is PortfolioInput {
  return value !== null && typeof value === "object";
}

function text(input: PortfolioInput, key: string, maxLength = 255) {
  const value = input[key];
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 && trimmed.length <= maxLength ? trimmed : null;
}

function positiveAmount(input: PortfolioInput, key: string, allowZero = false) {
  const value = input[key];
  if (typeof value !== "number" || !Number.isInteger(value)) return null;
  if (allowZero ? value < 0 : value <= 0) return null;
  return value;
}

export async function GET() {
  const session = await getOwnerSession();
  if (!session) {
    return NextResponse.json({ error: "Owner sign-in is required." }, { status: 401 });
  }

  if (process.env.NODE_ENV !== "production") {
    try {
      await generateDevAnnualAgreementDrafts(session.mobileNumber);
      const portfolio = await getDevOwnerPortfolio(session.mobileNumber);
      if (!portfolio) {
        return NextResponse.json({ error: "Owner account was not found." }, { status: 404 });
      }
      return NextResponse.json(portfolio);
    } catch (error) {
      console.error("Unable to load owner portfolio.", error);
      return NextResponse.json({ error: "Unable to load your portfolio." }, { status: 503 });
    }
  }

  try {
    await generateAnnualAgreementDrafts();
    const owner = await prisma.propertyOwner.findUnique({
      where: { mobileNumber: session.mobileNumber },
      include: {
        companies: {
          orderBy: { createdAt: "desc" },
          include: {
            buildings: {
              orderBy: { createdAt: "desc" },
              include: {
                assets: {
                  orderBy: { createdAt: "desc" },
                  include: {
                    tenants: { include: { tenant: true } },
                    agreements: { orderBy: { startDate: "desc" } },
                  },
                },
              },
            },
          },
        },
        buildings: {
          where: { companyId: null },
          orderBy: { createdAt: "desc" },
          include: {
            assets: {
              orderBy: { createdAt: "desc" },
              include: {
                tenants: { include: { tenant: true } },
                agreements: { orderBy: { startDate: "desc" } },
              },
            },
          },
        },
        tenants: { orderBy: { createdAt: "desc" } },
      },
    });
    if (!owner) {
      return NextResponse.json({ error: "Owner account was not found." }, { status: 404 });
    }
    const buildings = [
      ...owner.companies.flatMap((company) =>
        company.buildings.map((building) => ({ ...building, companyId: company.id })),
      ),
      ...owner.buildings,
    ];
    const assets = buildings.flatMap((building) =>
      building.assets.map((asset) => ({
        ...asset,
        buildingId: building.id,
        tenantIds: asset.tenants.map((link) => link.tenantId),
      })),
    );
    const agreements = assets.flatMap((asset) =>
      asset.agreements.map((agreement) => ({ ...agreement, assetId: asset.id })),
    );
    const tenants = owner.tenants.map((tenant) => ({
      ...tenant,
      assetIds: assets
        .filter((asset) => asset.tenantIds.includes(tenant.id))
        .map((asset) => asset.id),
    }));
    return NextResponse.json({
      owner,
      companies: owner.companies.map((company) => ({
        id: company.id,
        ownerId: company.ownerId,
        name: company.name,
        createdAt: company.createdAt,
        updatedAt: company.updatedAt,
      })),
      buildings: buildings.map((building) => ({
        id: building.id,
        companyId: building.companyId,
        name: building.name,
        address: building.address,
        city: building.city,
        state: building.state,
        postalCode: building.postalCode,
        ownerId: building.ownerId,
        ownerName: building.ownerName,
        ownerMobile: building.ownerMobile,
        createdAt: building.createdAt,
        updatedAt: building.updatedAt,
      })),
      assets: assets.map((asset) => ({
        id: asset.id,
        buildingId: asset.buildingId,
        name: asset.name,
        assetType: asset.assetType,
        unitNumber: asset.unitNumber,
        monthlyRent: asset.monthlyRent,
        securityDeposit: asset.securityDeposit,
        externalBuildingId: asset.externalBuildingId ?? null,
        ward: asset.ward ?? null,
        createdAt: asset.createdAt,
        updatedAt: asset.updatedAt,
      })),
      tenants,
      agreements,
    });
  } catch (error) {
    console.error("Unable to load database owner portfolio.", error);
    return NextResponse.json(
      { error: "Unable to load your portfolio. Check the database connection and migrations." },
      { status: 503 },
    );
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
  if (!isRecord(body)) {
    return NextResponse.json({ error: "Invalid portfolio request." }, { status: 400 });
  }
  const kind = text(body, "kind", 20);

  if (kind === "agreement") {
    const assetId = text(body, "assetId", 100);
    const tenantId = text(body, "tenantId", 100);
    const startDate = text(body, "startDate", 10);
    const endDate = text(body, "endDate", 10);
    const terms = typeof body.terms === "string" ? body.terms.trim() : "";
    if (!assetId || !tenantId || !startDate || !endDate || !hasValidElevenMonthTerm(startDate, endDate)) {
      return NextResponse.json(
        { error: "Select an asset and tenant, and enter a valid 11-month agreement term." },
        { status: 400 },
      );
    }
    if (terms.length > 2000) {
      return NextResponse.json({ error: "Agreement notes must be 2,000 characters or fewer." }, { status: 400 });
    }

    if (process.env.NODE_ENV !== "production") {
      try {
        const portfolio = await getDevOwnerPortfolio(session.mobileNumber);
        const asset = portfolio?.assets.find((entry) => entry.id === assetId);
        const tenant = portfolio?.tenants.find(
          (entry) => entry.id === tenantId && entry.assetIds.includes(assetId),
        );
        if (!asset || !tenant) {
          return NextResponse.json(
            { error: "Choose an asset and a tenant assigned to that asset in your account." },
            { status: 404 },
          );
        }
        const agreement = await createDevAgreement({
          assetId,
          tenantId: tenant.id,
          startDate,
          endDate,
          terms,
        });
        return NextResponse.json({ agreement }, { status: 201 });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unable to create agreement.";
        console.error("Unable to create local owner rental agreement.", error);
        return NextResponse.json(
          { error: message },
          { status: error instanceof DevAgreementConflictError ? 409 : 400 },
        );
      }
    }

    try {
      const owner = await prisma.propertyOwner.findUnique({
        where: { mobileNumber: session.mobileNumber },
        select: { id: true },
      });
      if (!owner) return NextResponse.json({ error: "Owner account was not found." }, { status: 404 });

      const asset = await prisma.asset.findFirst({
        where: {
          id: assetId,
          building: { ownerId: owner.id },
          tenants: { some: { tenantId } },
        },
      });
      if (!asset) {
        return NextResponse.json(
          { error: "Choose an asset and a tenant assigned to that asset in your account." },
          { status: 404 },
        );
      }

      const startsAt = new Date(`${startDate}T00:00:00.000Z`);
      const endsAt = new Date(`${endDate}T00:00:00.000Z`);
      const agreementYear = Number(startDate.slice(0, 4));
      const agreementForYear = await prisma.rentalAgreement.findFirst({
        where: { assetId, tenantId, agreementYear },
        select: { id: true },
      });
      if (agreementForYear) {
        return NextResponse.json(
          { error: "An agreement already exists for this tenant, asset, and year." },
          { status: 409 },
        );
      }
      const overlappingAgreement = await prisma.rentalAgreement.findFirst({
        where: {
          assetId,
          status: "ACTIVE",
          startDate: { lte: endsAt },
          endDate: { gte: startsAt },
        },
        select: { id: true },
      });
      if (overlappingAgreement) {
        return NextResponse.json(
          { error: "This asset already has an agreement for those dates." },
          { status: 409 },
        );
      }

      const agreement = await prisma.rentalAgreement.create({
        data: {
          agreementNumber: `RS-${new Date().getFullYear()}-${randomUUID().slice(0, 8).toUpperCase()}`,
          assetId,
          tenantId,
          agreementYear,
          startDate: startsAt,
          endDate: endsAt,
          monthlyRent: asset.monthlyRent,
          securityDeposit: asset.securityDeposit,
          terms,
        },
      });
      return NextResponse.json({ agreement }, { status: 201 });
    } catch (error) {
      if (
        error &&
        typeof error === "object" &&
        "code" in error &&
        error.code === "P2002"
      ) {
        return NextResponse.json(
          { error: "An agreement already exists for this tenant, asset, and year." },
          { status: 409 },
        );
      }
      console.error("Unable to create database owner rental agreement.", error);
      return NextResponse.json(
        { error: "Unable to create agreement. Check the database connection and migrations." },
        { status: 503 },
      );
    }
  }

  if (process.env.NODE_ENV !== "production") {
    try {
      if (kind === "company") {
        const name = text(body, "name", 160);
        if (!name) return NextResponse.json({ error: "Enter a company name." }, { status: 400 });
        const company = await createDevCompany(session.mobileNumber, name);
        return NextResponse.json({ company }, { status: 201 });
      }
      if (kind === "building") {
        const companyId = text(body, "companyId", 100);
        const name = text(body, "name", 160);
        const address = text(body, "address");
        const city = text(body, "city", 100);
        const state = text(body, "state", 100);
        const postalCode = text(body, "postalCode", 12);
        if (!companyId || !name || !address || !city || !state || !postalCode) {
          return NextResponse.json({ error: "Complete all building fields." }, { status: 400 });
        }
        const building = await createDevOwnerBuilding(session.mobileNumber, companyId, {
          name,
          address,
          city,
          state,
          postalCode,
        });
        return NextResponse.json({ building }, { status: 201 });
      }
      if (kind === "asset") {
        const buildingId = text(body, "buildingId", 100);
        const name = text(body, "name", 120);
        const assetType = text(body, "assetType", 60);
        const unitNumber = text(body, "unitNumber", 40);
        const monthlyRent = positiveAmount(body, "monthlyRent", true);
        const securityDeposit = positiveAmount(body, "securityDeposit", true);
        const externalBuildingId = text(body, "externalBuildingId", 40);
        const ward = text(body, "ward", 20);
        if (
          !buildingId ||
          !name ||
          !assetType ||
          !unitNumber ||
          monthlyRent === null ||
          securityDeposit === null
        ) {
          return NextResponse.json({ error: "Complete asset details using valid rent and deposit amounts." }, { status: 400 });
        }
        const asset = await createDevAsset(session.mobileNumber, {
          buildingId,
          name,
          assetType,
          unitNumber,
          monthlyRent,
          securityDeposit,
          externalBuildingId,
          ward,
        });
        return NextResponse.json({ asset }, { status: 201 });
      }
      if (kind === "tenant") {
        const assetId = text(body, "assetId", 100);
        const fullName = text(body, "fullName", 120);
        const rawMobile = text(body, "mobileNumber", 20);
        const mobileNumber = rawMobile?.replace(/\D/g, "");
        if (!assetId || !fullName || (mobileNumber && !/^\d{10,15}$/.test(mobileNumber))) {
          return NextResponse.json({ error: "Enter the tenant name and asset. If provided, the mobile number must be valid." }, { status: 400 });
        }
        const tenant = await createDevTenant(
          session.mobileNumber,
          assetId,
          fullName,
          mobileNumber ?? null,
        );
        return NextResponse.json({ tenant }, { status: 201 });
      }
      return NextResponse.json({ error: "Unknown portfolio item type." }, { status: 400 });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to save portfolio item.";
      console.error("Unable to save local owner portfolio item.", error);
      return NextResponse.json({ error: message }, { status: 400 });
    }
  }

  try {
    const owner = await prisma.propertyOwner.findUnique({
      where: { mobileNumber: session.mobileNumber },
      select: { id: true },
    });
    if (!owner) return NextResponse.json({ error: "Owner account was not found." }, { status: 404 });

    if (kind === "company") {
      const name = text(body, "name", 160);
      if (!name) return NextResponse.json({ error: "Enter a company name." }, { status: 400 });
      const company = await prisma.company.create({ data: { ownerId: owner.id, name } });
      return NextResponse.json({ company }, { status: 201 });
    }
    if (kind === "building") {
      const companyId = text(body, "companyId", 100);
      const name = text(body, "name", 160);
      const address = text(body, "address");
      const city = text(body, "city", 100);
      const state = text(body, "state", 100);
      const postalCode = text(body, "postalCode", 12);
      if (!companyId || !name || !address || !city || !state || !postalCode) {
        return NextResponse.json({ error: "Complete all building fields." }, { status: 400 });
      }
      const company = await prisma.company.findFirst({ where: { id: companyId, ownerId: owner.id } });
      if (!company) return NextResponse.json({ error: "Company not found in your account." }, { status: 404 });
      const building = await prisma.building.create({
        data: {
          name,
          address,
          city,
          state,
          postalCode,
          ownerId: owner.id,
          ownerName: (await prisma.propertyOwner.findUniqueOrThrow({ where: { id: owner.id }, select: { fullName: true } })).fullName,
          ownerMobile: session.mobileNumber,
          companyId,
        },
      });
      return NextResponse.json({ building }, { status: 201 });
    }
    if (kind === "asset") {
      const buildingId = text(body, "buildingId", 100);
      const name = text(body, "name", 120);
      const assetType = text(body, "assetType", 60);
      const unitNumber = text(body, "unitNumber", 40);
      const monthlyRent = positiveAmount(body, "monthlyRent", true);
      const securityDeposit = positiveAmount(body, "securityDeposit", true);
      const externalBuildingId = text(body, "externalBuildingId", 40);
      const ward = text(body, "ward", 20);
      if (!buildingId || !name || !assetType || !unitNumber || monthlyRent === null || securityDeposit === null) {
        return NextResponse.json({ error: "Complete asset details using valid rent and deposit amounts." }, { status: 400 });
      }
      const building = await prisma.building.findFirst({ where: { id: buildingId, ownerId: owner.id } });
      if (!building) return NextResponse.json({ error: "Building not found in your account." }, { status: 404 });
      const asset = await prisma.asset.create({ data: { buildingId, name, assetType, unitNumber, monthlyRent, securityDeposit, externalBuildingId, ward } });
      return NextResponse.json({ asset }, { status: 201 });
    }
    if (kind === "tenant") {
      const assetId = text(body, "assetId", 100);
      const fullName = text(body, "fullName", 120);
      const rawMobile = text(body, "mobileNumber", 20);
      const mobileNumber = rawMobile?.replace(/\D/g, "");
      if (!assetId || !fullName || (mobileNumber && !/^\d{10,15}$/.test(mobileNumber))) {
        return NextResponse.json({ error: "Enter the tenant name and asset. If provided, the mobile number must be valid." }, { status: 400 });
      }
      const asset = await prisma.asset.findFirst({
        where: { id: assetId, building: { ownerId: owner.id } },
      });
      if (!asset) return NextResponse.json({ error: "Asset not found in your account." }, { status: 404 });
      const tenant = mobileNumber
        ? await prisma.tenant.upsert({
            where: { mobileNumber },
            update: { fullName },
            create: { ownerId: owner.id, fullName, mobileNumber },
          })
        : await prisma.tenant.create({
            data: { ownerId: owner.id, fullName },
          });
      await prisma.assetTenant.upsert({
        where: { assetId_tenantId: { assetId, tenantId: tenant.id } },
        update: {},
        create: { assetId, tenantId: tenant.id },
      });
      return NextResponse.json({ tenant }, { status: 201 });
    }

    return NextResponse.json({ error: "Unknown portfolio item type." }, { status: 400 });
  } catch (error) {
    console.error("Unable to save database owner portfolio item.", error);
    return NextResponse.json(
      { error: "Unable to save item. Check the database connection and migrations." },
      { status: 503 },
    );
  }
}

export async function PATCH(request: Request) {
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
  if (!isRecord(body) || text(body, "kind", 20) !== "asset") {
    return NextResponse.json({ error: "Invalid asset update request." }, { status: 400 });
  }

  const assetId = text(body, "id", 100);
  const buildingId = text(body, "buildingId", 100);
  const name = text(body, "name", 120);
  const assetType = text(body, "assetType", 60);
  const unitNumber = text(body, "unitNumber", 40);
  const monthlyRent = positiveAmount(body, "monthlyRent", true);
  const securityDeposit = positiveAmount(body, "securityDeposit", true);
  const externalBuildingId = text(body, "externalBuildingId", 40);
  const ward = text(body, "ward", 20);
  if (
    !assetId ||
    !buildingId ||
    !name ||
    !assetType ||
    !unitNumber ||
    monthlyRent === null ||
    securityDeposit === null
  ) {
    return NextResponse.json({ error: "Complete all asset fields using valid rent and deposit amounts." }, { status: 400 });
  }

  const input = {
    buildingId,
    name,
    assetType,
    unitNumber,
    monthlyRent,
    securityDeposit,
    externalBuildingId,
    ward,
  };

  if (process.env.NODE_ENV !== "production") {
    try {
      const asset = await updateDevAsset(session.mobileNumber, assetId, input);
      return NextResponse.json({ asset });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to update asset.";
      console.error("Unable to update local owner asset.", error);
      return NextResponse.json({ error: message }, { status: 400 });
    }
  }

  try {
    const owner = await prisma.propertyOwner.findUnique({
      where: { mobileNumber: session.mobileNumber },
      select: { id: true },
    });
    if (!owner) return NextResponse.json({ error: "Owner account was not found." }, { status: 404 });

    const [asset, building, duplicateUnit] = await Promise.all([
      prisma.asset.findFirst({
        where: { id: assetId, building: { ownerId: owner.id } },
        select: { id: true },
      }),
      prisma.building.findFirst({
        where: { id: buildingId, ownerId: owner.id },
        select: { id: true },
      }),
      prisma.asset.findFirst({
        where: { id: { not: assetId }, buildingId, unitNumber },
        select: { id: true },
      }),
    ]);
    if (!asset) return NextResponse.json({ error: "Asset not found in your account." }, { status: 404 });
    if (!building) return NextResponse.json({ error: "Building not found in your account." }, { status: 404 });
    if (duplicateUnit) {
      return NextResponse.json({ error: "This unit number already exists in that building." }, { status: 409 });
    }

    const updatedAsset = await prisma.asset.update({
      where: { id: assetId },
      data: input,
    });
    return NextResponse.json({ asset: updatedAsset });
  } catch (error) {
    console.error("Unable to update database owner asset.", error);
    return NextResponse.json(
      { error: "Unable to update asset. Check the database connection and migrations." },
      { status: 503 },
    );
  }
}
