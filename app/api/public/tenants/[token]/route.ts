import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/database";
import { requireAgreementReapprovalForTenant } from "@/lib/agreement-approval-invalidation";
import { formatPartyAddress } from "@/lib/party-address";
import { getPublicTenantData } from "@/lib/public-tenant";
import {
  getMissingPublicTenantProfileFields as getMissingFields,
  publicTenantProfileFields,
  type PublicTenantProfileField,
} from "@/lib/public-tenant-profile-fields";
import { shouldUseDatabase } from "@/lib/storage-mode";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  if (!shouldUseDatabase()) {
    return NextResponse.json(
      { error: "Public tenant pages are unavailable in local demo storage." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  try {
    const { token } = await params;
    const data = await getPublicTenantData(token);
    if (!data) {
      return NextResponse.json({ error: "This shared tenant page is unavailable." }, { status: 404 });
    }
    return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Unable to load a public tenant page.", error);
    return NextResponse.json(
      { error: "This tenant page is temporarily unavailable." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ token: string }> }) {
  if (!shouldUseDatabase()) {
    return NextResponse.json(
      { error: "Public tenant profile updates are unavailable in local demo storage." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  try {
    const { token } = await params;
    if (!/^[A-Za-z0-9_-]{43}$/.test(token)) {
      return NextResponse.json({ error: "This shared tenant page is unavailable." }, { status: 404 });
    }

    const tokenHash = createHash("sha256").update(token).digest("hex");
    const tenant = await prisma.tenant.findUnique({
      where: { publicShareTokenHash: tokenHash },
      select: {
        id: true,
        fullName: true,
        mobileNumber: true,
        businessName: true,
        businessNature: true,
        addressLine1: true,
        addressLine2: true,
        district: true,
        state: true,
        city: true,
        postalCode: true,
        aadhaarNumber: true,
        fatherName: true,
      },
    });
    if (!tenant) {
      return NextResponse.json({ error: "This shared tenant page is unavailable." }, { status: 404 });
    }

    const missingFields = getMissingFields(tenant);
    if (!missingFields.length) {
      return NextResponse.json(
        { error: "This tenant profile is already complete. Contact the property owner to change saved details." },
        { status: 409, headers: { "Cache-Control": "no-store" } },
      );
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
    }
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json({ error: "Submit the missing tenant profile fields." }, { status: 400 });
    }
    const submitted = body as Record<string, unknown>;
    const allowedFields = new Set<PublicTenantProfileField>(missingFields);
    const updates: Partial<Record<PublicTenantProfileField, string>> = {};

    for (const [field, rawValue] of Object.entries(submitted)) {
      if (!Object.hasOwn(publicTenantProfileFields, field) || !allowedFields.has(field as PublicTenantProfileField)) {
        return NextResponse.json(
          { error: "Only incomplete tenant profile fields can be updated from this link." },
          { status: 400 },
        );
      }
      if (typeof rawValue !== "string") {
        return NextResponse.json({ error: `${publicTenantProfileFields[field as PublicTenantProfileField].label} must be text.` }, { status: 400 });
      }

      const fieldName = field as PublicTenantProfileField;
      const value = rawValue.trim();
      const fieldRule = publicTenantProfileFields[fieldName];
      if (!value || value.length > fieldRule.maxLength) {
        return NextResponse.json(
          { error: `Enter ${fieldRule.label.toLowerCase()} (maximum ${fieldRule.maxLength} characters).` },
          { status: 400 },
        );
      }
      const normalized = fieldName === "mobileNumber" || fieldName === "aadhaarNumber"
        ? value.replace(/\D/g, "")
        : value;
      if (fieldName === "mobileNumber" && !/^\d{10,15}$/.test(normalized)) {
        return NextResponse.json({ error: "Enter a valid mobile number with 10 to 15 digits." }, { status: 400 });
      }
      if (fieldName === "aadhaarNumber" && !/^\d{12}$/.test(normalized)) {
        return NextResponse.json({ error: "Aadhaar number must contain exactly 12 digits." }, { status: 400 });
      }
      updates[fieldName] = normalized;
    }

    const updatedTenant = { ...tenant, ...updates };
    const remainingFields = getMissingFields(updatedTenant);
    if (remainingFields.length) {
      return NextResponse.json(
        { error: `Complete these fields: ${remainingFields.map((field) => publicTenantProfileFields[field].label).join(", ")}.` },
        { status: 400 },
      );
    }

    const address = {
      addressLine1: updatedTenant.addressLine1,
      addressLine2: updatedTenant.addressLine2,
      district: updatedTenant.district,
      state: updatedTenant.state,
      city: updatedTenant.city,
      postalCode: updatedTenant.postalCode,
    };
    await prisma.$transaction(async (transaction) => {
      await transaction.tenant.update({
        where: { id: tenant.id },
        data: { ...updates, fullAddress: formatPartyAddress(address) },
      });
      await requireAgreementReapprovalForTenant(transaction, tenant.id);
    });

    const data = await getPublicTenantData(token);
    if (!data) {
      return NextResponse.json({ error: "This shared tenant page is unavailable." }, { status: 404 });
    }
    return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "P2002") {
      return NextResponse.json(
        { error: "That mobile number is already used by another tenant. Contact the property owner to update it." },
        { status: 409, headers: { "Cache-Control": "no-store" } },
      );
    }
    console.error("Unable to update a public tenant profile.", error);
    return NextResponse.json(
      { error: "Unable to update this tenant profile right now." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
