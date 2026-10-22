import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { generateAnnualAgreementDrafts } from "@/lib/annual-agreement-drafts";

function isAuthorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  const authorization = request.headers.get("authorization");
  if (!secret || !authorization?.startsWith("Bearer ")) return false;

  const provided = Buffer.from(authorization.slice("Bearer ".length));
  const expected = Buffer.from(secret);
  return provided.length === expected.length && timingSafeEqual(provided, expected);
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const generated = await generateAnnualAgreementDrafts();
    return NextResponse.json({ generated });
  } catch (error) {
    console.error("Unable to generate annual agreement drafts.", error);
    return NextResponse.json(
      { error: "Unable to generate annual agreement drafts." },
      { status: 503 },
    );
  }
}
