import { NextResponse } from "next/server";
import { prisma } from "@/lib/database";
import { listDevAdminAccounts, setDevOwnerPassword, setDevTenantPassword } from "@/lib/dev-store";
import { hashPassword } from "@/lib/password";
import { getAdminSession } from "@/lib/session";

type AccountType = "OWNER" | "TENANT";

export async function GET() {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: "Super-admin sign-in is required." }, { status: 401 });
  }

  try {
    if (process.env.NODE_ENV !== "production") {
      return NextResponse.json(await listDevAdminAccounts(), {
        headers: { "Cache-Control": "no-store" },
      });
    }
    const [owners, tenants] = await Promise.all([
      prisma.propertyOwner.findMany({
        select: { id: true, fullName: true, mobileNumber: true, createdAt: true },
        orderBy: { createdAt: "desc" },
      }),
      prisma.tenant.findMany({
        where: { mobileNumber: { not: null } },
        select: { id: true, fullName: true, mobileNumber: true, createdAt: true },
        orderBy: { createdAt: "desc" },
      }),
    ]);
    return NextResponse.json(
      {
        owners,
        tenants: tenants.filter(
          (tenant): tenant is typeof tenant & { mobileNumber: string } =>
            tenant.mobileNumber !== null,
        ),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("Unable to load owner and tenant accounts.", error);
    return NextResponse.json({ error: "Unable to load accounts." }, { status: 503 });
  }
}

export async function POST(request: Request) {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: "Super-admin sign-in is required." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (
    !body ||
    typeof body !== "object" ||
    !("accountType" in body) ||
    (body.accountType !== "OWNER" && body.accountType !== "TENANT") ||
    !("mobileNumber" in body) ||
    typeof body.mobileNumber !== "string" ||
    !("password" in body) ||
    typeof body.password !== "string"
  ) {
    return NextResponse.json(
      { error: "Account type, mobile number and new password are required." },
      { status: 400 },
    );
  }

  const accountType: AccountType = body.accountType;
  const mobileNumber = body.mobileNumber.replace(/\D/g, "");
  if (!/^\d{10,15}$/.test(mobileNumber)) {
    return NextResponse.json({ error: "Enter a valid account mobile number." }, { status: 400 });
  }
  if (body.password.length < 8 || body.password.length > 128) {
    return NextResponse.json(
      { error: "Password must be between 8 and 128 characters." },
      { status: 400 },
    );
  }

  try {
    const passwordHash = await hashPassword(body.password);
    let updated: boolean;
    if (process.env.NODE_ENV !== "production") {
      updated =
        accountType === "OWNER"
          ? await setDevOwnerPassword(mobileNumber, passwordHash)
          : await setDevTenantPassword(mobileNumber, passwordHash);
      if (!updated) {
        return NextResponse.json(
          { error: `${accountType === "OWNER" ? "Owner" : "Tenant"} account was not found.` },
          { status: 404 },
        );
      }
    } else if (accountType === "OWNER") {
      await prisma.propertyOwner.update({
        where: { mobileNumber },
        data: { passwordHash },
      });
    } else {
      await prisma.tenant.update({
        where: { mobileNumber },
        data: { passwordHash },
      });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "P2025"
    ) {
      return NextResponse.json(
        { error: `${accountType === "OWNER" ? "Owner" : "Tenant"} account was not found.` },
        { status: 404 },
      );
    }
    console.error(`Unable to reset ${accountType.toLowerCase()} password.`, error);
    return NextResponse.json(
      { error: `Unable to reset the ${accountType.toLowerCase()} password.` },
      { status: 503 },
    );
  }
}
