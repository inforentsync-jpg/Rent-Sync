import { NextResponse } from "next/server";
import {
  createDevAgreement,
  DevAgreementConflictError,
  getDevTenantPortal,
} from "@/lib/dev-store";
import { prisma } from "@/lib/database";
import { hasValidElevenMonthTerm } from "@/lib/rental-agreement";
import { getTenantSession } from "@/lib/session";
import { shouldUseDatabase } from "@/lib/storage-mode";

type AgreementInput = {
  assetId: string;
  startDate: string;
  endDate: string;
  terms: string;
};

function isAgreementInput(value: unknown): value is AgreementInput {
  if (value === null || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.assetId === "string" &&
    typeof record.startDate === "string" &&
    typeof record.endDate === "string" &&
    typeof record.terms === "string"
  );
}

export async function GET() {
  const session = await getTenantSession();
  if (!session) return NextResponse.json({ error: "Tenant sign-in is required." }, { status: 401 });
  try {
    if (!shouldUseDatabase()) {
      const portal = await getDevTenantPortal(session.mobileNumber);
      if (!portal) return NextResponse.json({ error: "Tenant account was not found." }, { status: 404 });
      return NextResponse.json({
        tenant: portal.tenant,
        agreements: portal.agreements,
        assets: portal.assets,
        buildings: portal.buildings,
      });
    }
    const tenant = await prisma.tenant.findUnique({
      where: { mobileNumber: session.mobileNumber },
      include: {
        agreements: {
          orderBy: { createdAt: "desc" },
          include: {
            asset: {
              include: {
                termTemplates: {
                  orderBy: { template: { name: "asc" } },
                  include: {
                    template: { include: { items: { orderBy: { position: "asc" } } } },
                  },
                },
              },
            },
          },
        },
        assets: {
          include: {
            asset: {
              include: {
                building: { include: { company: true } },
                termTemplates: {
                  orderBy: { template: { name: "asc" } },
                  include: {
                    template: { include: { items: { orderBy: { position: "asc" } } } },
                  },
                },
                agreements: {
                  where: { status: "ACTIVE" },
                  select: { startDate: true, endDate: true },
                },
              },
            },
          },
        },
      },
    });
    if (!tenant) return NextResponse.json({ error: "Tenant account was not found." }, { status: 404 });
    return NextResponse.json({
      agreements: tenant.agreements.map(({ asset, ...agreement }) => ({
        ...agreement,
        templateTerms: asset.termTemplates.map(({ template }) => ({
          templateId: template.id,
          heading: template.name,
          items: template.items.map(({ id, position, text, importantObligation }) => ({
            id,
            position,
            text,
            importantObligation,
          })),
        })),
      })),
      assets: tenant.assets.map(({ asset }) => ({
        ...asset,
        termTemplates: asset.termTemplates.map(({ template }) => template),
        buildingName: asset.building.name,
        buildingAddress: asset.building.address,
        city: asset.building.city,
        state: asset.building.state,
        postalCode: asset.building.postalCode,
        companyName: asset.building.company?.name ?? null,
      })),
      tenant,
    });
  } catch (error) {
    console.error("Unable to load tenant agreements.", error);
    return NextResponse.json({ error: "Unable to load your rental agreements." }, { status: 503 });
  }
}

export async function POST(request: Request) {
  const session = await getTenantSession();
  if (!session) return NextResponse.json({ error: "Tenant sign-in is required." }, { status: 401 });
  if (shouldUseDatabase()) {
    return NextResponse.json(
      { error: "Agreement creation using the test flow is disabled in production." },
      { status: 503 },
    );
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  if (!isAgreementInput(body)) {
    return NextResponse.json({ error: "Complete the agreement details." }, { status: 400 });
  }
  if (!hasValidElevenMonthTerm(body.startDate, body.endDate)) {
    return NextResponse.json(
      { error: "Rental agreements must run for 11 months. Choose the start date and keep the calculated end date." },
      { status: 400 },
    );
  }
  if (body.terms.trim().length > 2000) {
    return NextResponse.json({ error: "Agreement notes must be 2,000 characters or fewer." }, { status: 400 });
  }
  try {
    const agreement = await createDevAgreement({
      ...body,
      tenantMobile: session.mobileNumber,
    });
    return NextResponse.json({ agreement }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to create agreement.";
    console.error("Unable to create development rental agreement.", error);
    return NextResponse.json(
      { error: message },
      { status: error instanceof DevAgreementConflictError ? 409 : 400 },
    );
  }
}
