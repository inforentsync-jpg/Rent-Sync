import { NextResponse } from "next/server";
import { generateAgreementPdf } from "@/lib/agreement-pdf.clean";
import {
  AgreementDownloadError,
  getOwnerAgreementPdfData,
} from "@/lib/owner-agreement-download";
import { agreementContentDisposition, agreementDownloadFilename } from "@/lib/agreement-download-filename";
import { getOwnerSession } from "@/lib/session";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getOwnerSession();
  if (!session) {
    return NextResponse.json({ error: "Owner sign-in is required." }, { status: 401 });
  }
  const { id } = await params;

  try {
    const { data } = await getOwnerAgreementPdfData(session.mobileNumber, id);
    const bytes = await generateAgreementPdf(data);
    return new Response(Buffer.from(bytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": agreementContentDisposition(
          agreementDownloadFilename(data.tenantName, data.tradeName, data.startDate, "pdf"),
        ),
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    if (error instanceof AgreementDownloadError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Unable to generate owner agreement PDF.", error);
    return NextResponse.json({ error: "Unable to generate the agreement PDF." }, { status: 503 });
  }
}
