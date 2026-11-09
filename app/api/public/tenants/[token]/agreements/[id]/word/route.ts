import { NextResponse } from "next/server";
import { generateAgreementWord } from "@/lib/agreement-word";
import { agreementContentDisposition, agreementDownloadFilename } from "@/lib/agreement-download-filename";
import { getPublicTenantAgreementDownloadData } from "@/lib/public-tenant-agreement-download";
import { getPublicTenantData } from "@/lib/public-tenant";
import { shouldUseDatabase } from "@/lib/storage-mode";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string; id: string }> },
) {
  if (!shouldUseDatabase()) {
    return NextResponse.json(
      { error: "Public agreement downloads are unavailable in local demo storage." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  try {
    const { token, id } = await params;
    const sharedProfile = await getPublicTenantData(token);
    if (!sharedProfile) {
      return NextResponse.json(
        { error: "This shared tenant page is unavailable." },
        { status: 404, headers: { "Cache-Control": "no-store" } },
      );
    }
    if (!sharedProfile.profileComplete) {
      return NextResponse.json(
        { error: "Complete the tenant profile before viewing shared agreements." },
        { status: 403, headers: { "Cache-Control": "no-store" } },
      );
    }
    const result = await getPublicTenantAgreementDownloadData(token, id);
    if (!result) {
      return NextResponse.json(
        { error: "Agreement not found on this shared tenant page." },
        { status: 404, headers: { "Cache-Control": "no-store" } },
      );
    }
    if (result.agreement.status === "ACTIVE" && !result.agreement.mandatoryDetailsApprovedAt) {
      return NextResponse.json(
        { error: "This agreement is being updated and will be available after re-approval." },
        { status: 409, headers: { "Cache-Control": "no-store" } },
      );
    }

    const bytes = await generateAgreementWord(result.data);
    return new Response(new Uint8Array(bytes), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": agreementContentDisposition(
          agreementDownloadFilename(
            result.data.tenantName,
            result.data.tradeName,
            result.data.startDate,
            "docx",
          ),
        ),
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    console.error("Unable to generate a public agreement Word document.", error);
    return NextResponse.json(
      { error: "Unable to generate the agreement Word document." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
