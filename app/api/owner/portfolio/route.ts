import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/database";
import {
  createDevAgreement,
  createDevAsset,
  createDevCompany,
  createDevOwnerBuilding,
  createDevTenant,
  deleteDevPortfolioItem,
  DevAgreementConflictError,
  generateDevAnnualAgreementDrafts,
  getDevOwnerPortfolio,
  updateDevAsset,
  updateDevDraftAgreement,
  updateDevPortfolioItem,
} from "@/lib/dev-store";
import { getOwnerSession } from "@/lib/session";
import { addElevenMonthTerm, hasValidElevenMonthTerm } from "@/lib/rental-agreement";
import { getRenewalAgreementTerm } from "@/lib/agreement-year";
import { generateAnnualAgreementDrafts } from "@/lib/annual-agreement-drafts";
import { shouldUseDatabase } from "@/lib/storage-mode";

type PortfolioInput = Record<string, unknown>;

class PortfolioConflictError extends Error {}

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

  if (!shouldUseDatabase()) {
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

    if (!shouldUseDatabase()) {
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
          importantTerms: "",
          status: "DRAFT",
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

  if (!shouldUseDatabase()) {
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
        const startDate = text(body, "startDate", 10);
        if (!assetId || !fullName || !startDate || !addElevenMonthTerm(startDate) || (mobileNumber && !/^\d{10,15}$/.test(mobileNumber))) {
          return NextResponse.json({ error: "Enter the tenant name, asset, and a valid agreement start date. If provided, the mobile number must be valid." }, { status: 400 });
        }
        const tenant = await createDevTenant(
          session.mobileNumber,
          assetId,
          fullName,
          mobileNumber ?? null,
          startDate,
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
      const startDate = text(body, "startDate", 10);
      const endDate = startDate ? addElevenMonthTerm(startDate) : null;
      if (!assetId || !fullName || !startDate || !endDate || (mobileNumber && !/^\d{10,15}$/.test(mobileNumber))) {
        return NextResponse.json({ error: "Enter the tenant name, asset, and a valid agreement start date. If provided, the mobile number must be valid." }, { status: 400 });
      }
      const asset = await prisma.asset.findFirst({
        where: { id: assetId, building: { ownerId: owner.id } },
      });
      if (!asset) return NextResponse.json({ error: "Asset not found in your account." }, { status: 404 });
      const startsAt = new Date(`${startDate}T00:00:00.000Z`);
      const endsAt = new Date(`${endDate}T00:00:00.000Z`);
      const agreementYear = Number(startDate.slice(0, 4));
      const result = await prisma.$transaction(async (transaction) => {
        const existingAssignment = await transaction.assetTenant.findFirst({
          where: { assetId },
          select: { id: true },
        });
        if (existingAssignment) {
          throw new PortfolioConflictError("This unit is already assigned to a tenant.");
        }
        const existingTenant = mobileNumber
          ? await transaction.tenant.findUnique({ where: { mobileNumber } })
          : null;
        if (existingTenant && existingTenant.ownerId !== owner.id) {
          throw new PortfolioConflictError("This mobile number is already registered with a different owner.");
        }
        const tenant = existingTenant
          ? await transaction.tenant.update({
              where: { id: existingTenant.id },
              data: { fullName },
            })
          : await transaction.tenant.create({
              data: { ownerId: owner.id, fullName, mobileNumber },
            });
        const existingAgreement = await transaction.rentalAgreement.findFirst({
          where: { assetId, tenantId: tenant.id, agreementYear },
          select: { id: true },
        });
        if (existingAgreement) {
          throw new PortfolioConflictError("An agreement already exists for this tenant, asset, and year.");
        }
        const overlappingAgreement = await transaction.rentalAgreement.findFirst({
          where: {
            assetId,
            status: "ACTIVE",
            startDate: { lte: endsAt },
            endDate: { gte: startsAt },
          },
          select: { id: true },
        });
        if (overlappingAgreement) {
          throw new PortfolioConflictError("This asset already has an agreement for those dates.");
        }
        await transaction.assetTenant.upsert({
          where: { assetId_tenantId: { assetId, tenantId: tenant.id } },
          update: {},
          create: { assetId, tenantId: tenant.id },
        });
        const agreement = await transaction.rentalAgreement.create({
          data: {
            agreementNumber: `RS-${agreementYear}-${randomUUID().slice(0, 8).toUpperCase()}`,
            assetId,
            tenantId: tenant.id,
            agreementYear,
            startDate: startsAt,
            endDate: endsAt,
            monthlyRent: asset.monthlyRent,
            securityDeposit: asset.securityDeposit,
            terms: "",
            status: "DRAFT",
          },
        });
        let renewalAgreement = null;
        const renewalTerm = getRenewalAgreementTerm(startDate, endDate);
        if (renewalTerm) {
          const existingRenewal = await transaction.rentalAgreement.findFirst({
            where: {
              assetId,
              tenantId: tenant.id,
              agreementYear: renewalTerm.year,
            },
            select: { id: true },
          });
          if (!existingRenewal) {
            renewalAgreement = await transaction.rentalAgreement.create({
              data: {
                agreementNumber: `RS-${renewalTerm.year}-${randomUUID().slice(0, 8).toUpperCase()}`,
                assetId,
                tenantId: tenant.id,
                agreementYear: renewalTerm.year,
                startDate: new Date(`${renewalTerm.startDate}T00:00:00.000Z`),
                endDate: new Date(`${renewalTerm.endDate}T00:00:00.000Z`),
                monthlyRent: asset.monthlyRent,
                securityDeposit: asset.securityDeposit,
                terms: "",
                status: "DRAFT",
              },
            });
          }
        }
        return { tenant, agreement, renewalAgreement };
      });
      return NextResponse.json(result, { status: 201 });
    }

    return NextResponse.json({ error: "Unknown portfolio item type." }, { status: 400 });
  } catch (error) {
    if (error instanceof PortfolioConflictError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    if (
      kind === "tenant" &&
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
  if (!isRecord(body)) {
    return NextResponse.json({ error: "Invalid portfolio update request." }, { status: 400 });
  }

  const kind = text(body, "kind", 20);
  if (kind === "agreement") {
    const id = text(body, "id", 100);
    const startDate = text(body, "startDate", 10);
    const endDate = text(body, "endDate", 10);
    const monthlyRent = positiveAmount(body, "monthlyRent", true);
    const securityDeposit = positiveAmount(body, "securityDeposit", true);
    const terms = typeof body.terms === "string" ? body.terms.trim() : null;
    const importantTerms = typeof body.importantTerms === "string" ? body.importantTerms.trim() : "";
    if (
      !id ||
      !startDate ||
      !endDate ||
      monthlyRent === null ||
      securityDeposit === null ||
      terms === null ||
      terms.length > 2000 ||
      importantTerms.length > 4000 ||
      !hasValidElevenMonthTerm(startDate, endDate)
    ) {
      return NextResponse.json({ error: "Enter valid 11-month draft agreement details." }, { status: 400 });
    }
    if (!shouldUseDatabase()) {
      try {
        const agreement = await updateDevDraftAgreement(session.mobileNumber, id, {
          startDate,
          endDate,
          monthlyRent,
          securityDeposit,
          terms,
          importantTerms,
        });
        return NextResponse.json({ agreement });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unable to update draft agreement.";
        console.error("Unable to update local owner draft agreement.", error);
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
      const agreement = await prisma.rentalAgreement.findFirst({
        where: { id, asset: { building: { ownerId: owner.id } } },
        select: { id: true, status: true, ownerApprovedAt: true, tenantApprovedAt: true },
      });
      if (!agreement) return NextResponse.json({ error: "Agreement not found in your account." }, { status: 404 });
      if (
        agreement.status !== "DRAFT" ||
        agreement.ownerApprovedAt ||
        agreement.tenantApprovedAt
      ) {
        return NextResponse.json({ error: "Only unapproved draft agreements can be edited." }, { status: 409 });
      }
      const updated = await prisma.rentalAgreement.update({
        where: { id },
        data: {
          startDate: new Date(`${startDate}T00:00:00.000Z`),
          endDate: new Date(`${endDate}T00:00:00.000Z`),
          agreementYear: Number(startDate.slice(0, 4)),
          monthlyRent,
          securityDeposit,
          terms,
          importantTerms,
        },
      });
      return NextResponse.json({ agreement: updated });
    } catch (error) {
      if (error && typeof error === "object" && "code" in error && error.code === "P2002") {
        return NextResponse.json({ error: "An agreement already exists for this tenant, unit, and year." }, { status: 409 });
      }
      console.error("Unable to update database owner draft agreement.", error);
      return NextResponse.json({ error: "Unable to update draft agreement. Check the database connection." }, { status: 503 });
    }
  }
  if (kind === "company" || kind === "building" || kind === "tenant") {
    const id = text(body, "id", 100);
    if (!id) return NextResponse.json({ error: "Choose an item to update." }, { status: 400 });
    const input: Record<string, string | null> = {};

    if (kind === "company") {
      const name = text(body, "name", 160);
      if (!name) return NextResponse.json({ error: "Enter a company name." }, { status: 400 });
      input.name = name;
    } else if (kind === "building") {
      const companyId = text(body, "companyId", 100);
      const name = text(body, "name", 160);
      const address = text(body, "address");
      const city = text(body, "city", 100);
      const state = text(body, "state", 100);
      const postalCode = text(body, "postalCode", 12);
      if (!companyId || !name || !address || !city || !state || !postalCode) {
        return NextResponse.json({ error: "Complete all property fields." }, { status: 400 });
      }
      Object.assign(input, { companyId, name, address, city, state, postalCode });
    } else {
      const fullName = text(body, "fullName", 120);
      const rawMobile = body.mobileNumber;
      if (!fullName || (rawMobile !== null && rawMobile !== undefined && typeof rawMobile !== "string")) {
        return NextResponse.json({ error: "Enter the tenant name and a valid mobile number." }, { status: 400 });
      }
      const mobileNumber = typeof rawMobile === "string" ? rawMobile.replace(/\D/g, "") : "";
      if (mobileNumber && !/^\d{10,15}$/.test(mobileNumber)) {
        return NextResponse.json({ error: "Enter a valid tenant mobile number." }, { status: 400 });
      }
      Object.assign(input, { fullName, mobileNumber: mobileNumber || null });
    }

    if (!shouldUseDatabase()) {
      try {
        const item = await updateDevPortfolioItem(session.mobileNumber, kind, id, input);
        return NextResponse.json({ item });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unable to update portfolio item.";
        console.error("Unable to update local owner portfolio item.", error);
        return NextResponse.json({ error: message }, { status: 400 });
      }
    }

    try {
      const owner = await prisma.propertyOwner.findUnique({
        where: { mobileNumber: session.mobileNumber },
        select: { id: true, fullName: true },
      });
      if (!owner) return NextResponse.json({ error: "Owner account was not found." }, { status: 404 });

      if (kind === "company") {
        const company = await prisma.company.updateMany({
          where: { id, ownerId: owner.id },
          data: { name: input.name! },
        });
        if (!company.count) return NextResponse.json({ error: "Company not found in your account." }, { status: 404 });
      } else if (kind === "building") {
        const company = await prisma.company.findFirst({
          where: { id: input.companyId!, ownerId: owner.id },
          select: { id: true },
        });
        if (!company) return NextResponse.json({ error: "Company not found in your account." }, { status: 404 });
        const building = await prisma.building.updateMany({
          where: { id, ownerId: owner.id },
          data: {
            companyId: input.companyId,
            name: input.name!,
            address: input.address!,
            city: input.city!,
            state: input.state!,
            postalCode: input.postalCode!,
            ownerName: owner.fullName,
            ownerMobile: session.mobileNumber,
          },
        });
        if (!building.count) return NextResponse.json({ error: "Property not found in your account." }, { status: 404 });
      } else {
        const duplicate = input.mobileNumber
          ? await prisma.tenant.findFirst({
              where: { id: { not: id }, mobileNumber: input.mobileNumber },
              select: { id: true },
            })
          : null;
        if (duplicate) return NextResponse.json({ error: "This mobile number is already registered." }, { status: 409 });
        const tenant = await prisma.tenant.updateMany({
          where: { id, ownerId: owner.id },
          data: { fullName: input.fullName!, mobileNumber: input.mobileNumber },
        });
        if (!tenant.count) return NextResponse.json({ error: "Tenant not found in your account." }, { status: 404 });
      }
      return NextResponse.json({ success: true });
    } catch (error) {
      console.error(`Unable to update database owner ${kind}.`, error);
      return NextResponse.json({ error: `Unable to update ${kind}. Check the database connection.` }, { status: 503 });
    }
  }

  if (kind !== "asset") {
    return NextResponse.json({ error: "Unknown portfolio update type." }, { status: 400 });
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

  if (!shouldUseDatabase()) {
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

export async function DELETE(request: Request) {
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
    return NextResponse.json({ error: "Invalid portfolio delete request." }, { status: 400 });
  }
  const kind = text(body, "kind", 20);
  const id = text(body, "id", 100);
  if (
    !id ||
    (kind !== "company" && kind !== "building" && kind !== "asset" && kind !== "tenant" && kind !== "agreement")
  ) {
    return NextResponse.json({ error: "Choose a valid portfolio item to delete." }, { status: 400 });
  }

  if (!shouldUseDatabase()) {
    try {
      await deleteDevPortfolioItem(session.mobileNumber, kind, id);
      return NextResponse.json({ success: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to delete portfolio item.";
      console.error("Unable to delete local owner portfolio item.", error);
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
      const company = await prisma.company.findFirst({
        where: { id, ownerId: owner.id },
        select: { id: true, buildings: { select: { id: true } } },
      });
      if (!company) return NextResponse.json({ error: "Company not found in your account." }, { status: 404 });
      if (company.buildings.length) {
        return NextResponse.json({ error: "Move or delete this company's properties before deleting the company." }, { status: 409 });
      }
      await prisma.company.delete({ where: { id: company.id } });
    } else if (kind === "building") {
      const building = await prisma.building.findFirst({
        where: { id, ownerId: owner.id },
        select: { id: true, assets: { select: { id: true } } },
      });
      if (!building) return NextResponse.json({ error: "Property not found in your account." }, { status: 404 });
      if (building.assets.length) {
        return NextResponse.json({ error: "Delete this property's units before deleting the property." }, { status: 409 });
      }
      await prisma.building.delete({ where: { id: building.id } });
    } else if (kind === "asset") {
      const asset = await prisma.asset.findFirst({
        where: { id, building: { ownerId: owner.id } },
        select: { id: true, agreements: { select: { id: true } } },
      });
      if (!asset) return NextResponse.json({ error: "Unit not found in your account." }, { status: 404 });
      if (asset.agreements.length) {
        return NextResponse.json({ error: "This unit has agreement history and cannot be deleted." }, { status: 409 });
      }
      await prisma.asset.delete({ where: { id: asset.id } });
    } else if (kind === "tenant") {
      const tenant = await prisma.tenant.findFirst({
        where: { id, ownerId: owner.id },
        select: { id: true, agreements: { select: { id: true } } },
      });
      if (!tenant) return NextResponse.json({ error: "Tenant not found in your account." }, { status: 404 });
      if (tenant.agreements.length) {
        return NextResponse.json({ error: "This tenant has agreement history and cannot be deleted." }, { status: 409 });
      }
      await prisma.tenant.delete({ where: { id: tenant.id } });
    } else {
      const agreement = await prisma.rentalAgreement.findFirst({
        where: { id, asset: { building: { ownerId: owner.id } } },
        select: { id: true, status: true, ownerApprovedAt: true, tenantApprovedAt: true },
      });
      if (!agreement) return NextResponse.json({ error: "Agreement not found in your account." }, { status: 404 });
      if (
        agreement.status !== "DRAFT" ||
        agreement.ownerApprovedAt ||
        agreement.tenantApprovedAt
      ) {
        return NextResponse.json({ error: "Only unapproved draft agreements can be deleted." }, { status: 409 });
      }
      await prisma.rentalAgreement.delete({ where: { id: agreement.id } });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(`Unable to delete database owner ${kind}.`, error);
    return NextResponse.json({ error: `Unable to delete ${kind}. Check the database connection.` }, { status: 503 });
  }
}
