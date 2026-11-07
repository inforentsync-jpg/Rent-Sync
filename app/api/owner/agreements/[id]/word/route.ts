import { NextResponse } from "next/server";
import { generateAgreementWord } from "@/lib/agreement-word";
import { agreementContentDisposition, agreementDownloadFilename } from "@/lib/agreement-download-filename";
import { AgreementDownloadError, getOwnerAgreementPdfData } from "@/lib/owner-agreement-download";
import { getOwnerSession } from "@/lib/session";

export const runtime = "nodejs";

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
    const wordBytes = await generateAgreementWord(data);
    return new Response(new Uint8Array(wordBytes), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": agreementContentDisposition(
          agreementDownloadFilename(data.tenantName, data.tradeName, data.startDate, "docx"),
        ),
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    if (error instanceof AgreementDownloadError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Unable to generate owner agreement Word document.", error);
    return NextResponse.json({ error: "Unable to generate the agreement Word document." }, { status: 503 });
  }
}
