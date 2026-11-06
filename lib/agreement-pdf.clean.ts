import "regenerator-runtime/runtime";
import { PDFDocument, rgb, type PDFPage, type PDFFont } from "pdf-lib";
import type { PDFDocument as PDFDocumentType } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { readFile } from "node:fs/promises";
import path from "node:path";

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
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const TEXT_FONT_SCALE = 1.18;
const TEXT_LINE_SCALE = 1.12;

const embeddedFonts = new WeakMap<PDFDocumentType, PDFFont>();

async function drawUnicodeText(document: PDFDocumentType, page: PDFPage, text: string, _fontBytes: Buffer, x: number, topY: number, maxWidth: number, fontSize: number, _bold = true) {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return;
  const font = embeddedFonts.get(document);
  if (!font) throw new Error("Malayalam Unicode font is not embedded in the PDF document.");
  const displaySize = fontSize * TEXT_FONT_SCALE;
  page.drawText(clean, { x, y: topY - displaySize, font, size: displaySize, color: BLACK, maxWidth });
}

function countWrappedLines(document: PDFDocumentType, text: string, maxWidth: number, fontSize: number) {
  const clean = text.replace(/\s+/g, " ").trim();
  const font = embeddedFonts.get(document);
  if (!clean || !font) return 0;
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
  return lines.length;
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
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return 0;
  const font = embeddedFonts.get(document);
  if (!font) throw new Error("Malayalam Unicode font is not embedded in the PDF document.");

  const displaySize = fontSize * TEXT_FONT_SCALE;
  const displayLineHeight = lineHeight * TEXT_LINE_SCALE;
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
  while (document.getPageCount() < 4) document.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  while (document.getPageCount() > 4) document.removePage(document.getPageCount() - 1);

  document.getPage(0).drawRectangle({ x: 0, y: 0, width: PAGE_WIDTH, height: PAGE_HEIGHT, color: rgb(1, 1, 1) });
  for (let i = 1; i < 4; i++) document.getPage(i).drawRectangle({ x: 0, y: 0, width: PAGE_WIDTH, height: PAGE_HEIGHT, color: rgb(1, 1, 1) });

  const totalPages = document.getPageCount();
  await drawPageOne(document, document.getPage(0), data, fontBytes);
  await drawPageTwo(document, document.getPage(1), data, fontBytes, totalPages);
  await drawPageThree(document, document.getPage(2), data, fontBytes, totalPages);
  await drawPageFour(document, document.getPage(3), data, fontBytes, totalPages);

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

async function drawPageThree(document: PDFDocumentType, page: PDFPage, data: AgreementPdfData, fontBytes: Buffer, totalPages: number) {
  void totalPages;
  await drawUnicodeText(document, page, "പ്രധാന നിബന്ധനകളും വ്യവസ്ഥകളും", fontBytes, 30, 744, 552, 15, true);

  const renewal = "വാടകക്കാരൻ 11 മാസം കഴിഞ്ഞ് വാടക തുടരാൻ ആഗ്രഹിച്ചാൽ അടുത്ത വർഷവും പുതുക്കാവുന്നതാണ്. പുതുക്കുന്ന കരാറിൽ വാടക തുക മുൻവർഷത്തിന്റെ വാടകയിൽ കുറഞ്ഞത് 5% വരേക്കും വർധിപ്പിക്കാവുന്നതാണ്. കരാറിന്റെ പ്രവർത്തനം കൂടാതെ മൂന്ന് വർഷം വരെ ഉടമസ്ഥാവകാശത്തിന്റെ വിവേചനാധികാരത്തിൽ തുടർ നിബന്ധനകൾ നിശ്ചയിക്കാവുന്നതാണ്";
  let y = 694;
  const renewalCount = await drawWrapped(document, page, renewal, fontBytes, 30, y, 552, 12, 16, true);
  y -= renewalCount * (16 * TEXT_LINE_SCALE) + 16;

  const dynamicMap = new Map<number, string>();
  for (const group of data.templateTerms ?? []) {
    for (const item of group.items) {
      const text = item.text?.trim();
      if (text) dynamicMap.set(item.position, text.replace(/^\s*\d+[.)]\s*/, ""));
    }
  }

  const fallback: Array<[number, string]> = [
    [1, "കറന്റ്, വെള്ളം: വാടകക്കാരൻ നേരിട്ട് അടയ്ക്കണം."],
    [2, "സേഫ്റ്റി ലൈസൻസ്: വാടകക്കാരൻ എടുക്കണം."],
    [3, `ഉപയോഗം: ഈ സ്ഥലം ${data.usageDescription?.trim() || ""} ആവശ്യത്തിനായി ഉപയോഗിക്കേണ്ടതാണ്.`],
    [4, "ഉപ വാടക: ലീസുകാരന് ഈ ഉടമ്പടിയിലെ കെട്ടിടം മുഴുവനായോ ഭാഗികമായോ മറ്റാർക്കും വാടകയ്ക്ക് നൽകാനോ അനുവാദമില്ല."],
    [5, "ഷെഡ്യൂൾ ആസ്തിയിൽ ലീസുകാരൻ മൂലമോ വാടകക്കാരൻ മൂലമോ സംഭവിക്കുന്ന നാശനഷ്ടങ്ങൾക്കും ഉത്തരവാദിത്തങ്ങൾക്കും ലീസുകാരൻ പൂർണമായും ഉത്തരവാദിയാകും."],
    [6, "വാടകക്കാരൻ ഒഴിഞ്ഞതിന് ശേഷം, നാശനഷ്ടങ്ങൾ കുറച്ച ശേഷമുള്ള സുരക്ഷാദ്രവ്യം 15 ദിവസത്തിനുള്ളിൽ തിരിച്ചുനൽകപ്പെടും."],
    [7, "വാടകക്കാരൻ തീയതിക്ക് മുൻപ് വാടക അടയ്ക്കാൻ കഴിയാതെ വന്നാൽ ഉടമയ്ക്ക് അഡ്വാൻസിൽ നിന്ന് തുക പിൻവലിക്കാനും ഒഴിപ്പിക്കാനും അവകാശമുണ്ട്."],
    [8, "24 മണിക്കൂർ മുൻകൂട്ടി അറിയിപ്പിലൂടെ, ഉടമക്ക് അകത്തു പരിശോധന നടത്താം."],
    [9, "ഗ്രൗണ്ട് ഫ്ളോറും ഫസ്റ്റ് ഫ്ളോറും ഉൾപ്പെടെ എല്ലാ ഷോപ്പ് ഉടമകൾക്കും പാർക്കിംഗ് മേഖല സമമായും പങ്കിട്ടായിരിക്കും."],
    [10, "വാടകസ്ഥലം മുൻപേതുപോലെ കടയുടെ നെയിം ബോർഡ് സ്ഥാപിക്കുന്നതിനും നിർമ്മിക്കുന്നതിനും ഉടമയുടെ അനുമതി ആവശ്യമാണ്. അനുമതി ലഭിക്കാതെ ബോർഡുകൾ മാറ്റുകയോ സ്ഥാപിക്കുകയോ ചെയ്യരുത്."],
    [11, "ഈ കരാർ പ്രകാരം ബാക്കിയുള്ള നിയമനിബന്ധനകൾക്കും പ്രവർത്തനത്തിനു അനുസൃതമായ നടപടികൾക്കും രണ്ട് പാർട്ടികളും ബാധ്യസ്ഥരാണ്. നിലവിലുള്ള നിയമങ്ങൾക്കും സർക്കാരിന്‍റെ ഉത്തരവുകൾക്കും ഇവ വിധേയമായിരിക്കും."],
  ];

  const clauses = fallback.map(([number, fallbackText]) => [number, dynamicMap.get(number) || fallbackText] as [number, string]);
  const x = 30;
  const right = 582;
  const numberRight = 62;
  const headerHeight = 30;
  const rowsWithHeight = clauses.map(([number, text]) => {
    const count = countWrappedLines(document, text, right - numberRight - 16, 9.6);
    const rowHeight = Math.max(27, count * (13.5 * TEXT_LINE_SCALE) + 9);
    return { number, text, rowHeight };
  });
  const tableBottom = y - headerHeight - rowsWithHeight.reduce((sum, row) => sum + row.rowHeight, 0);

  line(page, x, y, right, y, 0.7);
  line(page, x, y - headerHeight, right, y - headerHeight, 0.7);
  line(page, x, y, x, tableBottom, 0.7);
  line(page, numberRight, y, numberRight, tableBottom, 0.7);
  line(page, right, y, right, tableBottom, 0.7);
  await drawUnicodeText(document, page, "ക്രമം", fontBytes, x + 5, y - 8, 27, 10.2, true);
  await drawUnicodeText(document, page, "നിബന്ധനകൾ", fontBytes, numberRight + 10, y - 8, 240, 10.2, true);
  y -= headerHeight;

  for (const row of rowsWithHeight) {
    const bottom = y - row.rowHeight;
    await drawUnicodeText(document, page, String(row.number), fontBytes, x + 8, y - row.rowHeight / 2 + 7, 22, 10.5, true);
    await drawWrapped(document, page, row.text, fontBytes, numberRight + 8, y - 8, right - numberRight - 16, 9.6, 13.5, true);
    line(page, x, bottom, right, bottom, 0.55);
    y = bottom;
  }
  line(page, x, tableBottom, right, tableBottom, 0.7);
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
