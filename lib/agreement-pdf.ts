import { PDFDocument, rgb, StandardFonts, type PDFPage } from "pdf-lib";
import type { PDFDocument as PDFDocumentType } from "pdf-lib";
import sharp from "sharp";
import { readFile } from "node:fs/promises";
import path from "node:path";

type AgreementPdfData = {
  agreementNumber: string; startDate: string; endDate: string; monthlyRent: number; securityDeposit: number; isDraft: boolean;
  ownerName: string; ownerMobile: string; tenantName: string; tenantMobile: string | null; tenantAddress: string | null; tenantAadhaar: string | null;
  buildingName: string; buildingAddress: string; city: string; state: string; postalCode: string; assetName: string; unitNumber: string; assetType: string;
  ward: string | null; roomNumber: string | null; usageDescription: string | null; tradeName: string | null;
  templateTerms?: Array<{ heading: string; items: Array<{ position: number; text: string; importantObligation: boolean }> }>;
};

const BLACK = rgb(0, 0, 0);
const BORDER = rgb(0.15, 0.15, 0.15);
const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const MARGIN = 30;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

function escapeXml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

async function drawMalayalam(
  document: PDFDocumentType,
  page: PDFPage,
  text: string,
  fontBytes: Buffer,
  x: number,
  topY: number,
  maxWidth: number,
  fontSize: number,
  bold = false,
) {
  const clean = text.replace(/\s+/g, " ").trim() || "-";
  const pxWidth = Math.max(20, Math.ceil(maxWidth * 96 / 72));
  const pxFontSize = Math.max(8, Math.ceil(fontSize * 96 / 72));
  const pxHeight = Math.max(18, Math.ceil(pxFontSize * 1.55));
  const weight = bold ? 700 : 400;
  const stroke = bold ? "stroke:#000;stroke-width:.35px;paint-order:stroke" : "";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${pxWidth}" height="${pxHeight}"><defs><style>@font-face{font-family:NotoMalayalam;src:url(data:font/ttf;base64,${fontBytes.toString("base64")}) format('truetype')}text{font-family:NotoMalayalam;fill:#000;font-weight:${weight};${stroke}}</style></defs><text x="1" y="${pxHeight - 3}" font-size="${pxFontSize}">${escapeXml(clean)}</text></svg>`;
  const png = await sharp(Buffer.from(svg)).png().toBuffer();
  const image = await document.embedPng(png);
  const pdfHeight = Math.max(12, fontSize * 1.18);
  page.drawImage(image, { x, y: topY - pdfHeight, width: Math.min(maxWidth, pxWidth * 72 / 96), height: pdfHeight });
}

async function drawMalayalamWrapped(
  document: PDFDocumentType,
  page: PDFPage,
  text: string,
  fontBytes: Buffer,
  x: number,
  topY: number,
  maxWidth: number,
  fontSize: number,
  lineHeight: number,
  bold = false,
) {
  const clean = text.replace(/\s+/g, " ").trim() || "-";
  const estimatedChars = Math.max(12, Math.floor(maxWidth / (fontSize * 0.58)));
  const lines: string[] = [];
  let line = "";
  for (const word of clean.split(" ")) {
    const candidate = line ? `${line} ${word}` : word;
    if (candidate.length <= estimatedChars) {
      line = candidate;
    } else {
      if (line) lines.push(line);
      if (word.length <= estimatedChars) {
        line = word;
      } else {
        for (let index = 0; index < word.length; index += estimatedChars) lines.push(word.slice(index, index + estimatedChars));
        line = "";
      }
    }
  }
  if (line) lines.push(line);
  for (let index = 0; index < lines.length; index += 1) {
    await drawMalayalam(document, page, lines[index], fontBytes, x, topY - index * lineHeight, maxWidth, fontSize, bold);
  }
  return lines.length;
}

function formatIndianNumber(value: number) {
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(Number.isFinite(value) ? value : 0);
}

function formatDate(value: string) {
  const date = new Date(`${value.slice(0, 10)}T00:00:00`);
  return Number.isNaN(date.getTime()) ? value.slice(0, 10) : `${String(date.getDate()).padStart(2, "0")}-${String(date.getMonth() + 1).padStart(2, "0")}-${date.getFullYear()}`;
}

function contractPeriod(startDate: string, endDate: string) {
  const start = new Date(`${startDate.slice(0, 10)}T00:00:00`);
  const end = new Date(`${endDate.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return "-";
  const months = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth()) + 1;
  return `${Math.max(1, months)} മാസം`;
}

export async function generateAgreementPdf(data: AgreementPdfData) {
  const template = await readFile(path.join(process.cwd(), "rentagrimentformat-blank.pdf"));
  const document = await PDFDocument.load(template);
  const fontBytes = await readFile(path.join(process.cwd(), "assets", "fonts", "NotoSansMalayalam-Regular.ttf"));
  const helvetica = await document.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await document.embedFont(StandardFonts.HelveticaBold);

  while (document.getPageCount() < 4) document.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  if (document.getPageCount() > 4) {
    while (document.getPageCount() > 4) document.removePage(document.getPageCount() - 1);
  }

  // Page 1 is intentionally preserved as the government stamp-paper template area.
  const page2 = document.getPage(1);
  page2.drawRectangle({ x: 0, y: 0, width: PAGE_WIDTH, height: PAGE_HEIGHT, color: rgb(1, 1, 1) });
  await drawPageTwo(document, page2, data, fontBytes, helvetica, helveticaBold);

  const page3 = document.getPage(2);
  page3.drawRectangle({ x: 0, y: 0, width: PAGE_WIDTH, height: PAGE_HEIGHT, color: rgb(1, 1, 1) });
  await drawTermsPage(document, page3, data, fontBytes, helvetica, helveticaBold);

  const page4 = document.getPage(3);
  page4.drawRectangle({ x: 0, y: 0, width: PAGE_WIDTH, height: PAGE_HEIGHT, color: rgb(1, 1, 1) });
  await drawSignaturesPage(document, page4, data, fontBytes, helvetica, helveticaBold);

  return document.save();
}

function drawGridLines(page: PDFPage) {
  const drawLine = (x1: number, y1: number, x2: number, y2: number, width = 0.65) => {
    page.drawLine({ start: { x: x1, y: y1 }, end: { x: x2, y: y2 }, thickness: width, color: BORDER });
  };
  return drawLine;
}

async function drawPageHeader(document: PDFDocumentType, page: PDFPage, pageNumber: number, data: AgreementPdfData, helvetica: any, helveticaBold: any, fontBytes: Buffer) {
  const drawLine = drawGridLines(page);
  drawLine(MARGIN, 746, PAGE_WIDTH - MARGIN, 746, 0.6);
  await drawMalayalam(document, page, "റന്റ് സിങ്ക് വാടക കരാർ", fontBytes, MARGIN, 764, 210, 11.5, true);
  page.drawText(data.agreementNumber, { x: PAGE_WIDTH - 150, y: 754, font: helveticaBold, size: 9, color: BLACK });
  page.drawText(`Page ${pageNumber} / 4`, { x: PAGE_WIDTH - 85, y: 28, font: helvetica, size: 8, color: BLACK });
  drawLine(MARGIN, 38, PAGE_WIDTH - MARGIN, 38, 0.5);
}

async function drawPageTwo(document: PDFDocumentType, page: PDFPage, data: AgreementPdfData, fontBytes: Buffer, helvetica: any, helveticaBold: any) {
  const drawLine = drawGridLines(page);
  page.drawText("Page 2 / 4", { x: PAGE_WIDTH - 85, y: 28, font: helvetica, size: 8, color: BLACK });
  drawLine(MARGIN, 38, PAGE_WIDTH - MARGIN, 38, 0.5);
  await drawMalayalam(document, page, "പാർട്ടികളുടെ വിവരം", fontBytes, MARGIN, 731, 220, 15, true);

  const x = MARGIN;
  const right = PAGE_WIDTH - MARGIN;
  const top = 704;
  const bottom = 506;
  const labelRight = 170;
  const detailRight = 430;
  const divider = 605;
  drawLine(x, top, right, top); drawLine(x, divider, right, divider); drawLine(x, bottom, right, bottom);
  drawLine(x, top, x, bottom); drawLine(labelRight, top, labelRight, bottom); drawLine(detailRight, top, detailRight, bottom); drawLine(right, top, right, bottom);

  await drawMalayalam(document, page, "വാടകദാതാവ്", fontBytes, 38, 677, 124, 10.5, true);
  page.drawText("(LESSOR)", { x: 38, y: 659, font: helveticaBold, size: 8.5, color: BLACK });
  await drawMalayalam(document, page, "ഒന്നാം പാർട്ടിയായും", fontBytes, 38, 620, 124, 8.8, false);
  const ownerAddress = [data.buildingAddress, data.city, data.postalCode].filter(Boolean).join(", ");
  await drawMalayalamWrapped(document, page, `പേര്: ${data.ownerName}`, fontBytes, 178, 677, 244, 8.8, 13);
  await drawMalayalamWrapped(document, page, "ആധാർ നമ്പർ: -", fontBytes, 178, 662, 244, 8.8, 13);
  await drawMalayalamWrapped(document, page, `വിലാസം: ${ownerAddress}`, fontBytes, 178, 647, 244, 8.2, 11);
  await drawMalayalamWrapped(document, page, `മൊബൈൽ: ${data.ownerMobile}`, fontBytes, 178, 625, 244, 8.8, 13);
  await drawMalayalam(document, page, "ഒപ്പ്:", fontBytes, 438, 677, 136, 8.8, true);
  drawLine(438, 650, 570, 650, 0.55);

  await drawMalayalam(document, page, "വാടകക്കാരൻ", fontBytes, 38, 578, 124, 10.5, true);
  page.drawText("(LESSEE)", { x: 38, y: 560, font: helveticaBold, size: 8.5, color: BLACK });
  await drawMalayalam(document, page, "രണ്ടാം പാർട്ടിയായും", fontBytes, 38, 521, 124, 8.8, false);
  const tenantAddress = data.tenantAddress?.trim() || "-";
  await drawMalayalamWrapped(document, page, `പേര്: ${data.tenantName}`, fontBytes, 178, 578, 244, 8.8, 13);
  await drawMalayalamWrapped(document, page, `ആധാർ നമ്പർ: ${data.tenantAadhaar || "-"}`, fontBytes, 178, 563, 244, 8.8, 13);
  await drawMalayalamWrapped(document, page, `വിലാസം: ${tenantAddress}${data.city ? `, ${data.city}` : ""}${data.postalCode ? `, ${data.postalCode}` : ""}`, fontBytes, 178, 548, 244, 8.2, 11);
  await drawMalayalamWrapped(document, page, `മൊബൈൽ: ${data.tenantMobile || "-"}`, fontBytes, 178, 526, 244, 8.8, 13);
  await drawMalayalam(document, page, "ഒപ്പ്:", fontBytes, 438, 578, 136, 8.8, true);
  drawLine(438, 536, 570, 536, 0.55);

  await drawMalayalam(document, page, "കെട്ടിടവിവരം", fontBytes, MARGIN, 482, 220, 15, true);
  const buildingTop = 456;
  const rowHeight = 26;
  const valueX = 310;
  const cancellationHeight = 100;
  const buildingBottom = buildingTop - 10 * rowHeight - cancellationHeight;
  drawLine(x, buildingTop, right, buildingTop); drawLine(x, buildingBottom, right, buildingBottom);
  drawLine(x, buildingTop, x, buildingBottom); drawLine(valueX, buildingTop, valueX, buildingBottom); drawLine(right, buildingTop, right, buildingBottom);
  const fullAddress = [data.buildingAddress, data.city, data.postalCode].filter(Boolean).join(", ");
  const rows: Array<[string, string]> = [
    ["വിലാസം", fullAddress],
    ["പഞ്ചായത്ത്", "-"],
    ["വാർഡ്", data.ward?.trim() || "-"],
    ["റൂം നമ്പർ", data.roomNumber?.trim() || data.unitNumber?.trim() || "-"],
    ["നിലവിലെ വാടക", `₹ ${formatIndianNumber(data.monthlyRent)}/- മാസം`],
    ["അഡ്വാൻസ് / സെക്യൂരിറ്റി ഡിപ്പോസിറ്റ്", `₹ ${formatIndianNumber(data.securityDeposit)}/-`],
    ["കരാർ കാലാവധി", `${contractPeriod(data.startDate, data.endDate)} (${formatDate(data.startDate)} മുതൽ)`],
    ["ഉപയോഗം", data.usageDescription?.trim() || data.assetType?.trim() || "-"],
    ["ബിസിനസ്സ് ട്രേഡ് നെയീം", data.tradeName?.trim() || data.assetName?.trim() || "-"],
    ["വാടക അടയ്ക്കേണ്ട തീയതി", "ഓരോ മാസം 2-ാം തീയതിക്ക് മുൻപ്"],
  ];
  let rowTop = buildingTop;
  for (const [label, value] of rows) {
    const rowBottom = rowTop - rowHeight;
    drawLine(x, rowBottom, right, rowBottom, 0.55);
    await drawMalayalamWrapped(document, page, label, fontBytes, x + 8, rowTop - 10, valueX - x - 16, 8.6, 10);
    await drawMalayalamWrapped(document, page, value, fontBytes, valueX + 8, rowTop - 10, right - valueX - 16, 8.2, 10);
    rowTop = rowBottom;
  }
  await drawMalayalamWrapped(document, page, "കരാർ റദ്ദാക്കൽ നിബന്ധന:", fontBytes, x + 8, rowTop - 10, valueX - x - 16, 8.6, 10, true);
  await drawMalayalamWrapped(document, page, "രണ്ടു പാർട്ടികൾക്കും തമ്മിലുള്ള സമ്മതമനുസരിച്ച് കരാർ റദ്ദാക്കാം. കരാർ കാലാവധിക്ക് മുമ്പ് വാടകക്കാരൻ വസ്തു ഒഴിഞ്ഞുകൊടുക്കേണ്ടിവരുകയാണെങ്കിൽ കുറഞ്ഞത് ഒരു മാസത്തെ മുൻകൂർ വിവരം നൽകേണ്ടതാണ്.", fontBytes, valueX + 8, rowTop - 10, right - valueX - 16, 8, 10);
}

async function drawTermsPage(document: PDFDocumentType, page: PDFPage, data: AgreementPdfData, fontBytes: Buffer, helvetica: any, helveticaBold: any) {
  await drawPageHeader(document, page, 3, data, helvetica, helveticaBold, fontBytes);
  await drawMalayalam(document, page, "കരാർ നിബന്ധനകൾ", fontBytes, MARGIN, 718, 220, 15, true);
  const drawLine = drawGridLines(page);
  drawLine(MARGIN, 694, PAGE_WIDTH - MARGIN, 694);
  drawLine(MARGIN, 694, MARGIN, 650);
  drawLine(MARGIN + 276, 694, MARGIN + 276, 650);
  drawLine(PAGE_WIDTH - MARGIN, 694, PAGE_WIDTH - MARGIN, 650);
  page.drawText("Agreement", { x: 40, y: 672, font: helveticaBold, size: 9, color: BLACK });
  page.drawText(data.agreementNumber, { x: 326, y: 672, font: helvetica, size: 9, color: BLACK });

  const items = (data.templateTerms ?? []).flatMap((section) => section.items.map((item) => ({ heading: section.heading, text: item.text, important: item.importantObligation, position: item.position })));
  const fallback = [
    "വാടകക്കാരൻ കൂടിച്ചേർന്ന മാസവാടക നിശ്ചയിച്ച തീയതിക്ക് മുൻപായി അടയ്ക്കേണ്ടതാണ്.",
    "വാടകസ്ഥലം കരാർക്കുള്ള ഉദ്ദേശ്യത്തിനായി മാത്രമേ ഉപയോഗിക്കാവൂ; നിയമ വിരുദ്ധ പ്രവർത്തനങ്ങൾ അനുവദിക്കുകയില്ല.",
    "വാടകവസ്തുവിന്റെ സൗകര്യങ്ങളെയും ഫലകങ്ങളെയും വാടകക്കാരൻ നല്ല രീതിയിൽ പരിപാലിക്കണം.",
    "കരാർ കാലാവധിക്ക് മുമ്പ് റദ്ദാക്കേണ്ടതെങ്കിൽ ഒരു മാസത്തെ മുൻകൂർ അറിയിപ്പ് നൽകേണ്ടതാണ്.",
    "വാടക നിബന്ധനകളിൽ മാറ്റം വരുത്തേണ്ടതെങ്കിൽ രണ്ട് പാർട്ടികളുടെയും സമ്മതം ആവശ്യമാണ്.",
  ];
  const content = items.length > 0 ? items.map((item, index) => `${item.position || index + 1}. ${item.text}`) : fallback.map((text, index) => `${index + 1}. ${text}`);
  let y = 626;
  for (const text of content.slice(0, 14)) {
    const lines = await drawMalayalamWrapped(document, page, text, fontBytes, MARGIN + 8, y, CONTENT_WIDTH - 16, 8.8, 11);
    y -= Math.max(1, lines) * 12 + 8;
    if (y < 70) break;
  }
  drawLine(MARGIN, 48, PAGE_WIDTH - MARGIN, 48, 0.5);
}

async function drawSignaturesPage(document: PDFDocumentType, page: PDFPage, data: AgreementPdfData, fontBytes: Buffer, helvetica: any, helveticaBold: any) {
  await drawPageHeader(document, page, 4, data, helvetica, helveticaBold, fontBytes);
  await drawMalayalam(document, page, "ഒപ്പും সাক্ষികളും", fontBytes, MARGIN, 718, 220, 15, true);

  await drawMalayalamWrapped(document, page, `മുകളിൽ നൽകിയ വിവരങ്ങളും നിബന്ധനകളും ശരിയെന്ന് രണ്ട് പാർട്ടികളും അംഗീകരിക്കുന്നു. ഈ കരാർ ${formatDate(data.startDate)} മുതൽ പ്രാബല്യത്തിൽ വരുന്നു.`, fontBytes, MARGIN, 680, CONTENT_WIDTH, 9, 12);
  const drawLine = drawGridLines(page);
  const top = 620;
  const bottom = 470;
  const left = MARGIN;
  const right = PAGE_WIDTH - MARGIN;
  const center = 306;
  drawLine(left, top, right, top); drawLine(left, bottom, right, bottom);
  drawLine(left, top, left, bottom); drawLine(center, top, center, bottom); drawLine(right, top, right, bottom);
  await drawMalayalam(document, page, "വാടകദാതാവ് (LESSOR)", fontBytes, 38, 598, 250, 9.2, true);
  await drawMalayalam(document, page, `പേര്: ${data.ownerName}`, fontBytes, 38, 558, 250, 9, false);
  await drawMalayalam(document, page, "തീയതി:", fontBytes, 38, 520, 250, 9, false);
  await drawMalayalam(document, page, "ഒപ്പ്:", fontBytes, 38, 480, 250, 9, false);
  await drawMalayalam(document, page, "വാടകക്കാരൻ (LESSEE)", fontBytes, 314, 598, 250, 9.2, true);
  await drawMalayalam(document, page, `പേര്: ${data.tenantName}`, fontBytes, 314, 558, 250, 9, false);
  await drawMalayalam(document, page, "തീയതി:", fontBytes, 314, 520, 250, 9, false);
  await drawMalayalam(document, page, "ഒപ്പ്:", fontBytes, 314, 480, 250, 9, false);

  await drawMalayalam(document, page, "സാക്ഷികൾ", fontBytes, MARGIN, 430, 220, 12.5, true);
  const witnessTop = 405;
  const witnessBottom = 255;
  drawLine(left, witnessTop, right, witnessTop); drawLine(left, witnessBottom, right, witnessBottom);
  drawLine(left, witnessTop, left, witnessBottom); drawLine(center, witnessTop, center, witnessBottom); drawLine(right, witnessTop, right, witnessBottom);
  await drawMalayalam(document, page, "സാക്ഷി 1", fontBytes, 38, 382, 250, 9.2, true);
  await drawMalayalam(document, page, "പേര്:", fontBytes, 38, 344, 250, 9, false);
  await drawMalayalam(document, page, "വിലാസം:", fontBytes, 38, 306, 250, 9, false);
  await drawMalayalam(document, page, "ഒപ്പ്:", fontBytes, 38, 268, 250, 9, false);
  await drawMalayalam(document, page, "സാക്ഷി 2", fontBytes, 314, 382, 250, 9.2, true);
  await drawMalayalam(document, page, "പേര്:", fontBytes, 314, 344, 250, 9, false);
  await drawMalayalam(document, page, "വിലാസം:", fontBytes, 314, 306, 250, 9, false);
  await drawMalayalam(document, page, "ഒപ്പ്:", fontBytes, 314, 268, 250, 9, false);
}
