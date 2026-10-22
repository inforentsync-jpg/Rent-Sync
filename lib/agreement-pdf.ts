import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { readFile } from "node:fs/promises";
import path from "node:path";

type AgreementPdfData = {
  agreementNumber: string;
  startDate: string;
  endDate: string;
  monthlyRent: number;
  securityDeposit: number;
  isDraft: boolean;
  ownerName: string;
  ownerMobile: string;
  tenantName: string;
  tenantMobile: string | null;
  buildingName: string;
  buildingAddress: string;
  city: string;
  state: string;
  postalCode: string;
  assetName: string;
  unitNumber: string;
  assetType: string;
  ward: string | null;
};

function wrapText(text: string, font: PDFFont, fontSize: number, maxWidth: number) {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const candidate = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, fontSize) <= maxWidth) {
      line = candidate;
      continue;
    }
    if (line) lines.push(line);
    line = word;
  }
  if (line) lines.push(line);
  return lines;
}

function drawLines(
  page: PDFPage,
  lines: string[],
  font: PDFFont,
  x: number,
  y: number,
  fontSize: number,
  maxLines: number,
) {
  lines.slice(0, maxLines).forEach((line, index) => {
    page.drawText(line, {
      x,
      y: y - index * (fontSize + 2),
      font,
      size: fontSize,
      color: rgb(0.08, 0.12, 0.09),
      maxWidth: 205,
    });
  });
}

function drawField(
  page: PDFPage,
  text: string,
  x: number,
  y: number,
  font: PDFFont,
  maxWidth: number,
  fontSize = 8,
  maxLines = 1,
) {
  drawLines(page, wrapText(text, font, fontSize, maxWidth), font, x, y, fontSize, maxLines);
}

export async function generateAgreementPdf(data: AgreementPdfData) {
  const [template, malayalamFont] = await Promise.all([
    readFile(path.join(process.cwd(), "rentagrimentformat-blank.pdf")),
    readFile(path.join(
      process.cwd(),
      "assets",
      "fonts",
      "NotoSansMalayalam-Regular.ttf",
    )),
  ]);
  const document = await PDFDocument.load(template);
  document.registerFontkit(fontkit);
  const font = await document.embedFont(malayalamFont);
  const coverPage = document.getPage(0);
  const page = document.getPage(1);

  if (data.isDraft) {
    coverPage.drawText("DRAFT - NOT SIGNED", {
      x: 400,
      y: 744,
      font,
      size: 10,
      color: rgb(0.72, 0.12, 0.1),
    });
    page.drawText("DRAFT - NOT SIGNED", {
      x: 400,
      y: 744,
      font,
      size: 10,
      color: rgb(0.72, 0.12, 0.1),
    });
  }

  drawField(page, `Name: ${data.ownerName}`, 233, 711, font, 205, 8, 1);
  drawField(page, `Mobile: +${data.ownerMobile}`, 233, 694, font, 205, 8, 1);
  drawField(page, "Address: Not provided", 233, 668, font, 205, 8, 2);

  drawField(page, `Tenant: ${data.tenantName}`, 233, 602, font, 205, 8, 1);
  drawField(
    page,
    `Mobile: ${data.tenantMobile ? `+${data.tenantMobile}` : "Not provided"}`,
    233,
    588,
    font,
    205,
    8,
    1,
  );
  drawField(page, "ID: Not provided", 233, 562, font, 205, 8, 1);
  drawField(page, "Address: Not provided", 233, 548, font, 205, 8, 5);

  drawField(page, `Building: ${data.buildingName}`, 307, 395, font, 225, 8, 1);
  drawField(page, data.buildingAddress, 307, 382, font, 225, 8, 1);
  drawField(
    page,
    [data.city, data.state, data.postalCode].filter(Boolean).join(", "),
    307,
    368,
    font,
    225,
    8,
    1,
  );
  drawField(page, `Ward: ${data.ward ?? "Not provided"}`, 307, 351, font, 225, 8, 1);
  drawField(page, `Unit: ${data.unitNumber}`, 307, 335, font, 225, 8, 1);
  drawField(page, `Asset: ${data.assetName} (${data.assetType})`, 307, 319, font, 225, 8, 1);
  drawField(page, `Rent: Rs. ${data.monthlyRent}`, 307, 304, font, 225, 8, 1);
  drawField(page, `Advance: Rs. ${data.securityDeposit}`, 307, 274, font, 225, 8, 1);
  drawField(
    page,
    `Term: ${data.startDate.slice(0, 10)} to ${data.endDate.slice(0, 10)}`,
    307,
    244,
    font,
    225,
    8,
    1,
  );
  drawField(page, `Agreement: ${data.agreementNumber}`, 307, 189, font, 225, 8, 1);

  return document.save();
}
