import { NextResponse } from "next/server";
import { getPublicTenantData } from "@/lib/public-tenant";
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
