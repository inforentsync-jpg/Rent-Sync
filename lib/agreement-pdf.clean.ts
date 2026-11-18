import "regenerator-runtime/runtime";
import { PDFDocument, rgb, type PDFPage, type PDFFont } from "pdf-lib";
import type { PDFDocument as PDFDocumentType } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { getAgreementTerms, type AgreementTerm } from "@/lib/agreement-terms";

export type AgreementPdfData = {
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
  tenantAddress?: string | null;
  tenantAddressLine1?: string | null;
  tenantAddressLine2?: string | null;
  tenantDistrict?: string | null;
  tenantState?: string | null;
  tenantCity?: string | null;
  tenantPostalCode?: string | null;
  tenantAadhaar?: string | null;
  buildingName: string;
  buildingAddress: string;
  city: string;
  state: string;
  postalCode: string;
  assetName: string;
  unitNumber: string;
  assetType: string;
  ward: string | null;
  panchayat?: string | null;
  ownerAadhaar?: string | null;
  ownerAddress?: string | null;
  ownerAddressLine1?: string | null;
  ownerAddressLine2?: string | null;
  ownerDistrict?: string | null;
  ownerState?: string | null;
  ownerCity?: string | null;
  ownerPostalCode?: string | null;
  ownerFatherName?: string | null;
  roomNumber?: string | null;
  usageDescription?: string | null;
  tradeName?: string | null;
  templateTerms?: Array<{ heading: string; items: Array<{ position: number; text: string; importantObligation: boolean }> }>;
};

const BLACK = rgb(0, 0, 0);
const BORDER = rgb(0.18, 0.18, 0.18);
const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const MARGIN = 30;
const TEXT_FONT_SCALE = 1.18;
const TEXT_LINE_SCALE = 1.12;
const TERMS_TOP = 694;
const TERMS_BOTTOM = 55;
const TERMS_HEADER_HEIGHT = 30;
const TERMS_FONT_SIZE = 9.6;
const TERMS_LINE_HEIGHT = 13.5;
const TERMS_ROW_PADDING = 9;

const embeddedFonts = new WeakMap<PDFDocumentType, PDFFont>();

async function drawUnicodeText(document: PDFDocumentType, page: PDFPage, text: string, _fontBytes: Buffer, x: number, topY: number, maxWidth: number, fontSize: number, _bold = true) {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return;
  const font = embeddedFonts.get(document);
  if (!font) throw new Error("Malayalam Unicode font is not embedded in the PDF document.");
  const displaySize = fontSize * TEXT_FONT_SCALE;
  page.drawText(clean, { x, y: topY - displaySize, font, size: displaySize, color: BLACK, maxWidth });
}

function wrapTextLines(document: PDFDocumentType, text: string, maxWidth: number, fontSize: number) {
  const clean = text.replace(/\s+/g, " ").trim();
  const font = embeddedFonts.get(document);
  if (!clean) return [];
  if (!font) throw new Error("Malayalam Unicode font is not embedded in the PDF document.");
  const displaySize = fontSize * TEXT_FONT_SCALE;
  const lines: string[] = [];
  let current = "";
  for (const word of clean.split(" ")) {
    const candidate = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, displaySize) <= maxWidth) {
      current = candidate;
      continue;
    }
    if (current) lines.push(current);
    if (font.widthOfTextAtSize(word, displaySize) <= maxWidth) {
      current = word;
      continue;
    }
    let part = "";
    for (const char of Array.from(word)) {
      const candidatePart = part + char;
      if (font.widthOfTextAtSize(candidatePart, displaySize) <= maxWidth) part = candidatePart;
      else { if (part) lines.push(part); part = char; }
    }
    current = part;
  }
  if (current) lines.push(current);
  return lines;
}

function wrapPageOneText(document: PDFDocumentType, text: string, maxWidth: number, fontSize: number) {
  const clean = text.replace(/\s+/g, " ").trim();
  const font = embeddedFonts.get(document);
  if (!font) throw new Error("Malayalam Unicode font is not embedded in the PDF document.");
  if (!clean) return [];

  const safeWidth = maxWidth * 0.98;
  const displaySize = fontSize * TEXT_FONT_SCALE;
  const lines: string[] = [];
  let current = "";
  for (const word of clean.split(" ")) {
    const candidate = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, displaySize) <= safeWidth) {
      current = candidate;
      continue;
    }
    if (current) lines.push(current);
    if (font.widthOfTextAtSize(word, displaySize) <= safeWidth) {
      current = word;
      continue;
    }
    let part = "";
    for (const char of Array.from(word)) {
      const candidatePart = part + char;
      if (font.widthOfTextAtSize(candidatePart, displaySize) <= safeWidth) part = candidatePart;
      else {
        if (part) lines.push(part);
        part = char;
      }
    }
    current = part;
  }
  if (current) lines.push(current);
  return lines;
}

function drawPageOneLines(document: PDFDocumentType, page: PDFPage, lines: string[], x: number, topY: number, maxWidth: number, fontSize: number, lineHeight: number) {
  const font = embeddedFonts.get(document);
  if (!font) throw new Error("Malayalam Unicode font is not embedded in the PDF document.");
  const displaySize = fontSize * TEXT_FONT_SCALE;
  const displayLineHeight = lineHeight * TEXT_LINE_SCALE;
  for (const [index, text] of lines.entries()) {
    const words = text.split(" ");
    const wordWidths = words.map((word) => font.widthOfTextAtSize(word, displaySize));
    const naturalSpaceWidth = font.widthOfTextAtSize(" ", displaySize);
    const lineWidth = wordWidths.reduce((sum, wordWidth) => sum + wordWidth, 0) + naturalSpaceWidth * (words.length - 1);
    const extraSpace = index < lines.length - 1 && words.length > 1
      ? Math.max(0, (maxWidth - lineWidth) / (words.length - 1))
      : 0;
    let wordX = x;
    const y = topY - index * displayLineHeight - displaySize;
    for (const [wordIndex, word] of words.entries()) {
      page.drawText(word, { x: wordX, y, font, size: displaySize, color: BLACK });
      wordX += wordWidths[wordIndex] + naturalSpaceWidth + extraSpace;
    }
  }
}

async function drawWrapped(document: PDFDocumentType, page: PDFPage, text: string, fontBytes: Buffer, x: number, topY: number, maxWidth: number, fontSize: number, lineHeight: number, bold = false, maxLines = 0) {
  const lines = wrapTextLines(document, text, maxWidth, fontSize);
  if (!lines.length) return 0;
  const font = embeddedFonts.get(document);
  if (!font) throw new Error("Malayalam Unicode font is not embedded in the PDF document.");

  const displaySize = fontSize * TEXT_FONT_SCALE;
  const displayLineHeight = lineHeight * TEXT_LINE_SCALE;
  if (maxLines > 0 && lines.length > maxLines) {
    lines.splice(maxLines);
    lines[maxLines - 1] = `${lines[maxLines - 1]}…`;
  }

  for (let i = 0; i < lines.length; i++) {
    page.drawText(lines[i], { x, y: topY - i * displayLineHeight - displaySize, font, size: displaySize, color: BLACK, maxWidth });
  }
  void bold;
  void fontBytes;
  return lines.length;
}

function indian(value: number) { return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(Number.isFinite(value) ? value : 0); }
function period(startDate: string, endDate: string) {
  const start = new Date(`${startDate.slice(0, 10)}T00:00:00`);
  const end = new Date(`${endDate.slice(0, 10)}T00:00:00`);
  if (!startDate || !endDate || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return "";
  const months = (end.getFullYear() - start.getFullYear()) * 12 + end.getMonth() - start.getMonth() + 1;
  return `${Math.max(1, months)} മാസം`;
}

function line(page: PDFPage, x1: number, y1: number, x2: number, y2: number, width = 0.65) {
  page.drawLine({ start: { x: x1, y: y1 }, end: { x: x2, y: y2 }, thickness: width, color: BORDER });
}

export async function generateAgreementPdf(data: AgreementPdfData) {
  const template = await readFile(path.join(process.cwd(), "rentagrimentformat-blank.pdf"));
  const document = await PDFDocument.load(template);
  const fontBytes = await readFile(path.join(process.cwd(), "assets", "fonts", "Manjari-Bold.ttf"));
  document.registerFontkit(fontkit);
  const malayalamFont = await document.embedFont(fontBytes, { subset: true });
  embeddedFonts.set(document, malayalamFont);
  const termPages = paginateAgreementTerms(document, getAgreementTerms(data));
  const totalPages = termPages.length + 3;
  while (document.getPageCount() < totalPages) document.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  while (document.getPageCount() > totalPages) document.removePage(document.getPageCount() - 1);

  document.getPage(0).drawRectangle({ x: 0, y: 0, width: PAGE_WIDTH, height: PAGE_HEIGHT, color: rgb(1, 1, 1) });
  for (let i = 1; i < totalPages; i++) document.getPage(i).drawRectangle({ x: 0, y: 0, width: PAGE_WIDTH, height: PAGE_HEIGHT, color: rgb(1, 1, 1) });

  await drawPageOne(document, document.getPage(0), data, fontBytes);
  await drawPageTwo(document, document.getPage(1), data, fontBytes, totalPages);
  for (const [index, rows] of termPages.entries()) {
    await drawTermsPage(document, document.getPage(index + 2), rows, fontBytes, index > 0);
  }
  await drawPageFour(document, document.getPage(totalPages - 1), data, fontBytes, totalPages);

  for (let index = 0; index < totalPages; index++) {
    const page = document.getPage(index);
    if (index > 0) {
      const borderX = 24;
      const borderY = 24;
      const borderWidth = PAGE_WIDTH - borderX * 2;
      const borderHeight = PAGE_HEIGHT - borderY * 2;
      line(page, borderX, borderY + borderHeight, borderX + borderWidth, borderY + borderHeight, 0.8);
      line(page, borderX, borderY, borderX + borderWidth, borderY, 0.8);
      line(page, borderX, borderY, borderX, borderY + borderHeight, 0.8);
      line(page, borderX + borderWidth, borderY, borderX + borderWidth, borderY + borderHeight, 0.8);
    }

    await drawUnicodeText(document, page, `${index + 1} / ${totalPages}`, fontBytes, PAGE_WIDTH / 2 - 24, 18, 48, 8.5, true);
  }

  return document.save();
}

async function drawPageOne(document: PDFDocumentType, page: PDFPage, data: AgreementPdfData, fontBytes: Buffer) {
  const font = embeddedFonts.get(document);
  if (!font) throw new Error("Malayalam Unicode font is not embedded in the PDF document.");

  const title = "വാടകക്കരാർ";
  const titleSize = 14 * TEXT_FONT_SCALE;
  const titleWidth = font.widthOfTextAtSize(title, titleSize);

  const duration = period(data.startDate, data.endDate);
  if (!duration) throw new Error("Agreement duration cannot be determined for the first page.");
  const secondPartyName = data.tenantName.trim();
  if (!secondPartyName) throw new Error("Tenant name is required for the agreement's second party.");

  const firstParagraph = `ഒന്നാം പാർട്ടിയുടെ ഉടമസ്ഥതയിലുള്ളതും ${data.buildingName.trim()} എന്ന പേരിൽ അറിയപ്പെടുന്നതുമായ കെട്ടിടം, താഴെ പറയുന്ന നിബന്ധനകളും വ്യവസ്ഥകളും അനുസരിച്ച്, ഉടമയായ ${data.ownerName.trim()}, രണ്ടാം കക്ഷിയായ വാടകക്കാരൻ ${secondPartyName}-ന് ${duration} വാടകയ്ക്ക് ഉപയോഗിക്കാൻ സമ്മതിച്ചിരിക്കുന്നു.`;
  const secondParagraph = "ഈ വാടകക്കരാർ, സ്റ്റാമ്പ് പേപ്പർ വാങ്ങിയ തീയതി പ്രകാരം പ്രാബല്യത്തിൽ വരുന്നതും, പാർട്ടികളുടെ വിവരം, വസ്തുവിന്റെ വിശദാംശങ്ങൾ എന്നിവ താഴെ ചേർക്കുന്ന പട്ടികയിൽ വ്യക്തമാക്കിയിരിക്കുന്നു.";
  const x = 52;
  const width = PAGE_WIDTH - x * 2;
  const fontSize = 9.5;
  const lineHeight = 15;
  const firstLines = wrapPageOneText(document, firstParagraph, width, fontSize);
  const secondLines = wrapPageOneText(document, secondParagraph, width, fontSize);
  const displaySize = fontSize * TEXT_FONT_SCALE;
  const displayLineHeight = lineHeight * TEXT_LINE_SCALE;
  const paragraphGap = 12;
  const titleGap = 6;
  const secondTop = 48 + displaySize + (secondLines.length - 1) * displayLineHeight;
  const firstTop = secondTop + (firstLines.length - 1) * displayLineHeight + displaySize + paragraphGap;
  page.drawText(title, {
    x: (PAGE_WIDTH - titleWidth) / 2,
    y: firstTop + titleSize * 0.2 + titleGap,
    font,
    size: titleSize,
    color: BLACK,
  });

  drawPageOneLines(document, page, firstLines, x, firstTop, width, fontSize, lineHeight);
  drawPageOneLines(document, page, secondLines, x, secondTop, width, fontSize, lineHeight);
}

async function drawPageTwo(document: PDFDocumentType, page: PDFPage, data: AgreementPdfData, fontBytes: Buffer, totalPages: number) {
  await drawUnicodeText(document, page, "പാർട്ടികളുടെ വിവരം", fontBytes, 30, 744, 220, 15, true);
  const x = 30, right = 582, top = 708, bottom = 330;
  const labelRight = 150, detailRight = 422, dividerY = 490;
  line(page, x, top, right, top, 0.7);
  line(page, x, dividerY, right, dividerY, 0.7);
  line(page, x, bottom, right, bottom, 0.7);
  line(page, x, top, x, bottom, 0.7);
  line(page, labelRight, top, labelRight, bottom, 0.7);
  line(page, detailRight, top, detailRight, bottom, 0.7);
  line(page, right, top, right, bottom, 0.7);

  await drawUnicodeText(document, page, "വാടകദാതാവ്", fontBytes, 38, 684, 104, 10.5, true);
  await drawUnicodeText(document, page, "(LESSOR)", fontBytes, 38, 666, 104, 8.5, true);
  await drawUnicodeText(document, page, "ഒന്നാം പാർട്ടിയായും", fontBytes, 38, 552, 104, 8.7, false);
  await drawUnicodeText(document, page, "വാടകക്കാരൻ", fontBytes, 38, 470, 104, 10.5, true);
  await drawUnicodeText(document, page, "(LESSEE)", fontBytes, 38, 452, 104, 8.5, true);
  await drawUnicodeText(document, page, "രണ്ടാം പാർട്ടിയായും", fontBytes, 38, 390, 104, 8.7, false);

  const ownerFields = [
    ["വിലാസം 1", data.ownerAddressLine1],
    ["വിലാസം 2", data.ownerAddressLine2],
    ["ജില്ല", data.ownerDistrict],
    ["സംസ്ഥാനം", data.ownerState],
    ["നഗരം", data.ownerCity],
    ["പിൻകോഡ്", data.ownerPostalCode],
  ] as const;
  const tenantFields = [
    ["വിലാസം 1", data.tenantAddressLine1],
    ["വിലാസം 2", data.tenantAddressLine2],
    ["ജില്ല", data.tenantDistrict],
    ["സംസ്ഥാനം", data.tenantState],
    ["നഗരം", data.tenantCity],
    ["പിൻകോഡ്", data.tenantPostalCode],
  ] as const;
  const hasOwnerStructuredAddress = ownerFields.some(([, value]) => value?.trim());
  const hasTenantStructuredAddress = tenantFields.some(([, value]) => value?.trim());
  let ownerY = 684;
  for (const [text, fontSize] of [
    [`പേര്: ${data.ownerName || ""}`, 8.0],
    [`ആധാർ നമ്പർ: ${data.ownerAadhaar || ""}`, 8.0],
    [`പിതാവിന്റെ പേര്: ${data.ownerFatherName || ""}`, 7.8],
    [`മൊബൈൽ: ${data.ownerMobile || ""}`, 7.8],
  ] as const) {
    const lineCount = await drawWrapped(document, page, text, fontBytes, 158, ownerY, 252, fontSize, 10);
    ownerY -= lineCount * 10 * TEXT_LINE_SCALE + 2;
  }
  if (hasOwnerStructuredAddress) {
    for (const [label, value] of ownerFields) {
      if (!value?.trim()) continue;
      const lineCount = await drawWrapped(document, page, `${label}: ${value.trim()}`, fontBytes, 158, ownerY, 252, 6.0, 6.6);
      ownerY -= lineCount * 6.6 * TEXT_LINE_SCALE + 1.5;
    }
  } else {
    const lineCount = await drawWrapped(document, page, `വിലാസം: ${data.ownerAddress?.replace(/\s+/g, " ").trim() || ""}`, fontBytes, 158, ownerY, 252, 6.0, 6.6, false, 9);
    ownerY -= lineCount * 6.6 * TEXT_LINE_SCALE + 1.5;
  }

  let tenantY = 476;
  for (const [text, fontSize] of [
    [`പേര്: ${data.tenantName || ""}`, 8.0],
    [`ആധാർ നമ്പർ: ${data.tenantAadhaar || ""}`, 8.0],
    [`മൊബൈൽ: ${data.tenantMobile || ""}`, 7.8],
  ] as const) {
    const lineCount = await drawWrapped(document, page, text, fontBytes, 158, tenantY, 252, fontSize, 10);
    tenantY -= lineCount * 10 * TEXT_LINE_SCALE + 2;
  }
  if (hasTenantStructuredAddress) {
    for (const [label, value] of tenantFields) {
      if (!value?.trim()) continue;
      const lineCount = await drawWrapped(document, page, `${label}: ${value.trim()}`, fontBytes, 158, tenantY, 252, 6.0, 6.6);
      tenantY -= lineCount * 6.6 * TEXT_LINE_SCALE + 1.5;
    }
  } else {
    const lineCount = await drawWrapped(document, page, `വിലാസം: ${data.tenantAddress || ""}`, fontBytes, 158, tenantY, 252, 6.0, 6.6, false, 7);
    tenantY -= lineCount * 6.6 * TEXT_LINE_SCALE + 1.5;
  }

  await drawUnicodeText(document, page, "ഒപ്പ്:", fontBytes, 430, 684, 144, 10, true);
  await drawUnicodeText(document, page, "ഒപ്പ്:", fontBytes, 430, 476, 144, 10, true);

  await drawUnicodeText(document, page, "കെട്ടിടവിവരം", fontBytes, 30, 314, 220, 15, true);
  const buildingTop = 290, buildingBottom = 90, rowHeight = 20, valueX = 310;
  line(page, x, buildingTop, right, buildingTop); line(page, x, buildingBottom, right, buildingBottom);
  line(page, x, buildingTop, x, buildingBottom); line(page, valueX, buildingTop, valueX, buildingTop - rowHeight * 10); line(page, right, buildingTop, right, buildingBottom);
  const address = [data.buildingAddress, data.city, data.postalCode].filter((value) => value?.trim()).join(", ");
  const rows: Array<[string, string]> = [
    ["വിലാസം", address || ""],
    ["പഞ്ചായത്ത്", data.panchayat?.trim() || ""],
    ["വാർഡ്", data.ward?.trim() || ""],
    ["റൂം നമ്പർ", data.roomNumber?.trim() || data.unitNumber?.trim() || ""],
    ["നിലവിലെ വാടക", data.monthlyRent > 0 ? `₹ ${indian(data.monthlyRent)}-/ മാസം` : ""],
    ["അഡ്വാൻസ് / സെക്യൂരിറ്റി ഡിപ്പോസിറ്റ്", data.securityDeposit > 0 ? `₹ ${indian(data.securityDeposit)}/-` : ""],
    ["കരാർ കാലാവധി", period(data.startDate, data.endDate)],
    ["ഉപയോഗം", data.usageDescription?.trim() || ""],
    ["ബിസിനസ്സ് ട്രേഡ് നെയിം", data.tradeName?.trim() || ""],
    ["വാടക അടയ്ക്കേണ്ട തീയതി", "ഓരോ മാസവും മൂന്നാം തീയതിക്ക് മുമ്പ്"],
  ];
  let y = buildingTop;
  for (const [label, value] of rows) {
    const bottomY = y - rowHeight;
    line(page, x, bottomY, right, bottomY, 0.55);
    await drawWrapped(document, page, label, fontBytes, x + 8, y - 9, valueX - x - 16, 8.4, 10);
    await drawWrapped(document, page, value, fontBytes, valueX + 8, y - 9, right - valueX - 16, 8.4, 10);
    y = bottomY;
  }

}

type PdfTermRow = { number: string; lines: string[] };

function paginateAgreementTerms(document: PDFDocumentType, terms: AgreementTerm[]): PdfTermRow[][] {
  const contentWidth = PAGE_WIDTH - MARGIN * 2 - 62 - 16;
  const lineHeight = TERMS_LINE_HEIGHT * TEXT_LINE_SCALE;
  const bodyHeight = TERMS_TOP - TERMS_HEADER_HEIGHT - TERMS_BOTTOM;
  const maxLinesPerPage = Math.floor((bodyHeight - TERMS_ROW_PADDING) / lineHeight);
  const pages: PdfTermRow[][] = [];
  let rows: PdfTermRow[] = [];
  let usedHeight = 0;
  const finishPage = () => {
    pages.push(rows);
    rows = [];
    usedHeight = 0;
  };

  for (const term of terms) {
    let remainingLines = wrapTextLines(document, term.text, contentWidth, TERMS_FONT_SIZE);
    let firstFragment = true;
    while (remainingLines.length) {
      const availableHeight = bodyHeight - usedHeight;
      let availableLines = Math.floor((availableHeight - TERMS_ROW_PADDING) / lineHeight);
      if (availableLines < 1 || (availableLines === 1 && availableHeight < 27)) {
        finishPage();
        availableLines = maxLinesPerPage;
      }

      if (remainingLines.length > availableLines && rows.length && remainingLines.length <= maxLinesPerPage) {
        finishPage();
        continue;
      }

      const lineCount = Math.min(remainingLines.length, availableLines);
      rows.push({
        number: firstFragment ? String(term.number) : "",
        lines: remainingLines.slice(0, lineCount),
      });
      firstFragment = false;
      usedHeight += Math.max(27, lineCount * lineHeight + TERMS_ROW_PADDING);
      remainingLines = remainingLines.slice(lineCount);
      if (remainingLines.length) finishPage();
    }
  }

  if (rows.length || !pages.length) finishPage();
  return pages;
}

async function drawTermsPage(
  document: PDFDocumentType,
  page: PDFPage,
  rows: PdfTermRow[],
  fontBytes: Buffer,
  continuation: boolean,
) {
  const title = continuation
    ? "പ്രധാന നിബന്ധനകളും വ്യവസ്ഥകളും (തുടർച്ച)"
    : "പ്രധാന നിബന്ധനകളും വ്യവസ്ഥകളും";
  await drawUnicodeText(document, page, title, fontBytes, 30, 744, 552, 15, true);

  const x = 30;
  const right = 582;
  const numberRight = 62;
  const textWidth = right - numberRight - 16;
  const lineHeight = TERMS_LINE_HEIGHT * TEXT_LINE_SCALE;
  const rowHeights = rows.map((row) => Math.max(27, row.lines.length * lineHeight + TERMS_ROW_PADDING));
  const tableBottom = TERMS_TOP - TERMS_HEADER_HEIGHT - rowHeights.reduce((sum, height) => sum + height, 0);

  line(page, x, TERMS_TOP, right, TERMS_TOP, 0.7);
  line(page, x, TERMS_TOP - TERMS_HEADER_HEIGHT, right, TERMS_TOP - TERMS_HEADER_HEIGHT, 0.7);
  line(page, x, TERMS_TOP, x, tableBottom, 0.7);
  line(page, numberRight, TERMS_TOP, numberRight, tableBottom, 0.7);
  line(page, right, TERMS_TOP, right, tableBottom, 0.7);
  await drawUnicodeText(document, page, "ക്രമം", fontBytes, x + 5, TERMS_TOP - 8, 27, 10.2, true);
  await drawUnicodeText(document, page, "നിബന്ധനകൾ", fontBytes, numberRight + 10, TERMS_TOP - 8, 240, 10.2, true);

  let y = TERMS_TOP - TERMS_HEADER_HEIGHT;
  for (const [index, row] of rows.entries()) {
    const rowHeight = rowHeights[index];
    const bottom = y - rowHeight;
    if (row.number) {
      await drawUnicodeText(document, page, row.number, fontBytes, x + 8, y - rowHeight / 2 + 7, 22, 10.5, true);
    }
    const font = embeddedFonts.get(document);
    if (!font) throw new Error("Malayalam Unicode font is not embedded in the PDF document.");
    const displaySize = TERMS_FONT_SIZE * TEXT_FONT_SCALE;
    for (const [lineIndex, text] of row.lines.entries()) {
      page.drawText(text, {
        x: numberRight + 8,
        y: y - 8 - lineIndex * lineHeight - displaySize,
        font,
        size: displaySize,
        color: BLACK,
        maxWidth: textWidth,
      });
    }
    line(page, x, bottom, right, bottom, 0.55);
    y = bottom;
  }
  line(page, x, tableBottom, right, tableBottom, 0.7);
  if (!rows.length) {
    await drawUnicodeText(document, page, "ഈ കരാറിനായി നിബന്ധനകൾ ചേർത്തിട്ടില്ല.", fontBytes, numberRight + 8, TERMS_TOP - TERMS_HEADER_HEIGHT - 8, textWidth, 9.6, false);
  }
}

async function drawPageFour(document: PDFDocumentType, page: PDFPage, data: AgreementPdfData, fontBytes: Buffer, totalPages: number) {
  await drawUnicodeText(document, page, "സാക്ഷികൾ", fontBytes, 30, 744, 220, 15, true);
  const top = 714, bottom = 364;
  line(page, 30, top, 582, top); line(page, 30, bottom, 582, bottom); line(page, 30, top, 30, bottom); line(page, 306, top, 306, bottom); line(page, 582, top, 582, bottom);
  await drawUnicodeText(document, page, "സാക്ഷി 1", fontBytes, 38, 692, 260, 10, true);
  await drawUnicodeText(document, page, "പേര്: __________________________", fontBytes, 38, 654, 260, 9, false);
  await drawUnicodeText(document, page, "വിലാസം: _______________________", fontBytes, 38, 602, 260, 9, false);
  await drawUnicodeText(document, page, "ഒപ്പ്: __________________________", fontBytes, 38, 402, 260, 9, false);
  await drawUnicodeText(document, page, "സാക്ഷി 2", fontBytes, 314, 692, 260, 10, true);
  await drawUnicodeText(document, page, "പേര്: __________________________", fontBytes, 314, 654, 260, 9, false);
  await drawUnicodeText(document, page, "വിലാസം: _______________________", fontBytes, 314, 602, 260, 9, false);
  await drawUnicodeText(document, page, "ഒപ്പ്: __________________________", fontBytes, 314, 402, 260, 9, false);
}
