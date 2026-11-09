import { NextResponse } from "next/server";
import { prisma } from "@/lib/database";
import { requireAgreementReapprovalForTenant } from "@/lib/agreement-approval-invalidation";
import { resetDevTenantDetails } from "@/lib/dev-store";
import { getOwnerSession } from "@/lib/session";
import { shouldUseDatabase } from "@/lib/storage-mode";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_request: Request, { params }: RouteContext) {
  const session = await getOwnerSession();
  if (!session) {
    return NextResponse.json({ error: "Owner sign-in is required." }, { status: 401 });
  }

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "Choose a tenant to reset." }, { status: 400 });
  }

  if (!shouldUseDatabase()) {
    try {
      const reset = await resetDevTenantDetails(session.mobileNumber, id);
      if (!reset) {
        return NextResponse.json({ error: "Tenant not found in your account." }, { status: 404 });
      }
      return NextResponse.json({ success: true });
    } catch (error) {
      console.error("Unable to reset local tenant details.", error);
      return NextResponse.json({ error: "Unable to reset tenant details." }, { status: 503 });
    }
  }

  try {
    const owner = await prisma.propertyOwner.findUnique({
      where: { mobileNumber: session.mobileNumber },
      select: { id: true },
    });
    if (!owner) {
      return NextResponse.json({ error: "Owner account was not found." }, { status: 404 });
    }

    const reset = await prisma.$transaction(async (transaction) => {
      const result = await transaction.tenant.updateMany({
        where: { id, ownerId: owner.id },
        data: {
          mobileNumber: null,
          businessName: null,
          businessNature: null,
          fullAddress: null,
          addressLine1: null,
          addressLine2: null,
          district: null,
          state: null,
          city: null,
          postalCode: null,
          aadhaarNumber: null,
          fatherName: null,
          email: null,
          photoDataUrl: null,
        },
      });
      if (result.count) {
        await requireAgreementReapprovalForTenant(transaction, id);
      }
      return result.count > 0;
    });
    if (!reset) {
      return NextResponse.json({ error: "Tenant not found in your account." }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Unable to reset database tenant details.", error);
    return NextResponse.json({ error: "Unable to reset tenant details." }, { status: 503 });
  }
}
