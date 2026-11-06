import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  HeightRule,
  PageNumber,
  Packer,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableLayoutType,
  TableRow,
  TextRun,
  VerticalAlignTable,
  WidthType,
  type ITableBordersOptions,
} from "docx";
import type { AgreementPdfData } from "@/lib/agreement-pdf.clean";

const PAGE_WIDTH_TWIPS = 12240;
const PAGE_HEIGHT_TWIPS = 15840;
const PAGE_MARGIN_TWIPS = 600;
const TABLE_WIDTH_TWIPS = PAGE_WIDTH_TWIPS - PAGE_MARGIN_TWIPS * 2;
const FONT_MALAYALAM = "Noto Sans Malayalam";
const FONT_LATIN = "Arial";
const BLACK_BORDER = { style: BorderStyle.SINGLE, size: 5, color: "333333" } as const;
const TABLE_BORDERS: ITableBordersOptions = {
  top: BLACK_BORDER,
  bottom: BLACK_BORDER,
  left: BLACK_BORDER,
  right: BLACK_BORDER,
  insideHorizontal: BLACK_BORDER,
  insideVertical: BLACK_BORDER,
};

function textRun(text: string, size = 20, bold = false) {
  return new TextRun({
    text,
    bold,
    size,
    font: {
      ascii: FONT_LATIN,
      hAnsi: FONT_LATIN,
      cs: FONT_MALAYALAM,
    },
  });
}

function paragraph(
  text: string,
  options: {
    size?: number;
    bold?: boolean;
    alignment?: (typeof AlignmentType)[keyof typeof AlignmentType];
    before?: number;
    after?: number;
    keepNext?: boolean;
    pageBreakBefore?: boolean;
  } = {},
) {
  return new Paragraph({
    children: [textRun(text, options.size ?? 20, options.bold ?? false)],
    alignment: options.alignment,
    spacing: { before: options.before ?? 0, after: options.after ?? 100 },
    keepNext: options.keepNext,
    pageBreakBefore: options.pageBreakBefore,
  });
}

function cell(
  content: string | string[],
  width: number,
  options: { bold?: boolean; size?: number; header?: boolean; minHeight?: number } = {},
) {
  const lines = Array.isArray(content) ? content : [content];
  return new TableCell({
    width: { size: width, type: WidthType.DXA },
    margins: { top: 85, bottom: 85, left: 100, right: 100 },
    verticalAlign: VerticalAlignTable.TOP,
    shading: options.header
      ? { type: ShadingType.CLEAR, fill: "E8E8E8", color: "auto" }
      : undefined,
    children: lines.length
      ? lines.map((line) => paragraph(line, {
          size: options.size ?? 19,
          bold: options.bold ?? false,
          after: 45,
        }))
      : [paragraph("", { size: options.size ?? 19, after: 45 })],
  });
}

function table(
  rows: Array<{
    cells: Array<{ text: string | string[]; bold?: boolean; header?: boolean }>;
    minHeight?: number;
  }>,
  columnWidths: number[],
  fontSize = 19,
) {
  return new Table({
    width: { size: TABLE_WIDTH_TWIPS, type: WidthType.DXA },
    columnWidths,
    layout: TableLayoutType.FIXED,
    borders: TABLE_BORDERS,
    rows: rows.map((row) => new TableRow({
      height: row.minHeight
        ? { value: row.minHeight, rule: HeightRule.ATLEAST }
        : undefined,
      cantSplit: true,
      children: row.cells.map((entry, index) => cell(entry.text, columnWidths[index], {
        bold: entry.bold,
        header: entry.header,
        size: fontSize,
      })),
    })),
  });
}

function heading(text: string, pageBreakBefore = false) {
  return paragraph(text, {
    size: 30,
    bold: true,
    alignment: AlignmentType.CENTER,
    before: 0,
    after: 200,
    keepNext: true,
    pageBreakBefore,
  });
}

function addressLines(
  prefix: string,
  fields: Array<[string, string | null | undefined]>,
  fallback: string | null | undefined,
) {
  const lines = fields
    .filter((entry): entry is [string, string] => Boolean(entry[1]?.trim()))
    .map(([label, value]) => `${label}: ${value.trim()}`);
  if (!lines.length && fallback?.trim()) lines.push(`വിലാസം: ${fallback.trim()}`);
  return [`പേര്: ${prefix}`, ...lines];
}

function indian(value: number) {
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(
    Number.isFinite(value) ? value : 0,
  );
}

function duration(data: AgreementPdfData) {
  const start = new Date(`${data.startDate.slice(0, 10)}T00:00:00`);
  const end = new Date(`${data.endDate.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return "";
  const months = (end.getFullYear() - start.getFullYear()) * 12
    + end.getMonth() - start.getMonth() + 1;
  return `${Math.max(1, months)} മാസം`;
}

const FALLBACK_TERMS: Array<[number, string]> = [
  [1, "കറന്റ്, വെള്ളം: വാടകക്കാരൻ നേരിട്ട് അടയ്ക്കണം."],
  [2, "സേഫ്റ്റി ലൈസൻസ്: വാടകക്കാരൻ എടുക്കണം."],
  [3, "ഉപയോഗം: ഈ സ്ഥലം ആവശ്യത്തിനായി ഉപയോഗിക്കേണ്ടതാണ്."],
  [4, "ഉപ വാടക: ലീസുകാരന് ഈ ഉടമ്പടിയിലെ കെട്ടിടം മുഴുവനായോ ഭാഗികമായോ മറ്റാർക്കും വാടകയ്ക്ക് നൽകാനോ അനുവാദമില്ല."],
  [5, "ഷെഡ്യൂൾ ആസ്തിയിൽ ലീസുകാരൻ മൂലമോ വാടകക്കാരൻ മൂലമോ സംഭവിക്കുന്ന നാശനഷ്ടങ്ങൾക്കും ഉത്തരവാദിത്തങ്ങൾക്കും ലീസുകാരൻ പൂർണമായും ഉത്തരവാദിയാകും."],
  [6, "വാടകക്കാരൻ ഒഴിഞ്ഞതിന് ശേഷം, നാശനഷ്ടങ്ങൾ കുറച്ച ശേഷമുള്ള സുരക്ഷാദ്രവ്യം 15 ദിവസത്തിനുള്ളിൽ തിരിച്ചുനൽകപ്പെടും."],
  [7, "വാടകക്കാരൻ തീയതിക്ക് മുൻപ് വാടക അടയ്ക്കാൻ കഴിയാതെ വന്നാൽ ഉടമയ്ക്ക് അഡ്വാൻസിൽ നിന്ന് തുക പിൻവലിക്കാനും ഒഴിപ്പിക്കാനും അവകാശമുണ്ട്."],
  [8, "24 മണിക്കൂർ മുൻകൂട്ടി അറിയിപ്പിലൂടെ, ഉടമക്ക് അകത്തു പരിശോധന നടത്താം."],
  [9, "ഗ്രൗണ്ട് ഫ്ളോറും ഫസ്റ്റ് ഫ്ളോറും ഉൾപ്പെടെ എല്ലാ ഷോപ്പ് ഉടമകൾക്കും പാർക്കിംഗ് മേഖല സമമായും പങ്കിട്ടായിരിക്കും."],
  [10, "വാടകസ്ഥലം മുൻപേതുപോലെ കടയുടെ നെയിം ബോർഡ് സ്ഥാപിക്കുന്നതിനും നിർമ്മിക്കുന്നതിനും ഉടമയുടെ അനുമതി ആവശ്യമാണ്. അനുമതി ലഭിക്കാതെ ബോർഡുകൾ മാറ്റുകയോ സ്ഥാപിക്കുകയോ ചെയ്യരുത്."],
  [11, "ഈ കരാർ പ്രകാരം ബാക്കിയുള്ള നിയമനിബന്ധനകൾക്കും പ്രവർത്തനത്തിനു അനുസൃതമായ നടപടികൾക്കും രണ്ട് പാർട്ടികളും ബാധ്യസ്ഥരാണ്. നിലവിലുള്ള നിയമങ്ങൾക്കും സർക്കാരിന്‍റെ ഉത്തരവുകൾക്കും ഇവ വിധേയമായിരിക്കും."],
];

function getTerms(data: AgreementPdfData) {
  const dynamicTerms = new Map<number, string>();
  for (const group of data.templateTerms ?? []) {
    for (const item of group.items) {
      const text = item.text?.trim();
      if (text) dynamicTerms.set(item.position, text.replace(/^\s*\d+[.)]\s*/, ""));
    }
  }
  return FALLBACK_TERMS.map(([number, text]) => ({
    number,
    text: dynamicTerms.get(number)
      ?? (number === 3 && data.usageDescription?.trim()
        ? `ഉപയോഗം: ഈ സ്ഥലം ${data.usageDescription.trim()} ആവശ്യത്തിനായി ഉപയോഗിക്കേണ്ടതാണ്.`
        : text),
  }));
}

export async function generateAgreementWord(data: AgreementPdfData) {
  const ownerLines = addressLines("വാടകദാതാവ്", [
    ["ആധാർ നമ്പർ", data.ownerAadhaar],
    ["പിതാവിന്റെ പേര്", data.ownerFatherName],
    ["മൊബൈൽ", data.ownerMobile],
    ["വിലാസം 1", data.ownerAddressLine1],
    ["വിലാസം 2", data.ownerAddressLine2],
    ["ജില്ല", data.ownerDistrict],
    ["സംസ്ഥാനം", data.ownerState],
    ["നഗരം", data.ownerCity],
    ["പിൻകോഡ്", data.ownerPostalCode],
  ], data.ownerAddress);
  const tenantLines = addressLines("വാടകക്കാരൻ", [
    ["ആധാർ നമ്പർ", data.tenantAadhaar],
    ["മൊബൈൽ", data.tenantMobile],
    ["വിലാസം 1", data.tenantAddressLine1],
    ["വിലാസം 2", data.tenantAddressLine2],
    ["ജില്ല", data.tenantDistrict],
    ["സംസ്ഥാനം", data.tenantState],
    ["നഗരം", data.tenantCity],
    ["പിൻകോഡ്", data.tenantPostalCode],
  ], data.tenantAddress);

  const partyTable = table([
    {
      cells: [
        { text: "പാർട്ടി", bold: true, header: true },
        { text: "വ്യക്തിഗത വിവരങ്ങളും വിലാസവും", bold: true, header: true },
        { text: "ഒപ്പ്", bold: true, header: true },
      ],
    },
    {
      minHeight: 2400,
      cells: [
        { text: ["ഒന്നാം കക്ഷി", "വാടകദാതാവ് (LESSOR)"], bold: true },
        { text: [`പേര്: ${data.ownerName}`, ...ownerLines.slice(1)] },
        { text: ["ഒപ്പ്:", "", "", "തീയതി:" ] },
      ],
    },
    {
      minHeight: 2400,
      cells: [
        { text: ["രണ്ടാം കക്ഷി", "വാടകക്കാരൻ (LESSEE)"], bold: true },
        { text: [`പേര്: ${data.tenantName}`, ...tenantLines.slice(1)] },
        { text: ["ഒപ്പ്:", "", "", "തീയതി:"] },
      ],
    },
  ], [2200, 6800, 2040]);

  const propertyAddress = [
    data.buildingAddress,
    data.city,
    data.state,
    data.postalCode,
  ].filter((value) => value?.trim()).join(", ");
  const buildingRows: Array<[string, string]> = [
    ["കെട്ടിടത്തിന്റെ പേര്", data.buildingName],
    ["വിലാസം", propertyAddress],
    ["പഞ്ചായത്ത്", data.panchayat?.trim() || ""],
    ["വാർഡ്", data.ward?.trim() || ""],
    ["റൂം നമ്പർ", data.roomNumber?.trim() || data.unitNumber?.trim() || ""],
    ["നിലവിലെ വാടക", data.monthlyRent > 0 ? `₹ ${indian(data.monthlyRent)}-/ മാസം` : ""],
    ["അഡ്വാൻസ് / സെക്യൂരിറ്റി ഡിപ്പോസിറ്റ്", data.securityDeposit > 0 ? `₹ ${indian(data.securityDeposit)}/-` : ""],
    ["കരാർ കാലാവധി", duration(data)],
    ["ഉപയോഗം", data.usageDescription?.trim() || ""],
    ["ബിസിനസ്സ് ട്രേഡ് നെയിം", data.tradeName?.trim() || ""],
    ["വാടക അടയ്ക്കേണ്ട തീയതി", "ഓരോ മാസവും മൂന്നാം തീയതിക്ക് മുമ്പ്"],
  ];
  const buildingTable = table(buildingRows.map(([label, value]) => ({
    cells: [{ text: label }, { text: value }],
  })), [3600, 7440]);

  const termRows = getTerms(data);
  const termTable = table([
    { cells: [{ text: "ക്രമം", bold: true, header: true }, { text: "നിബന്ധനകൾ", bold: true, header: true }] },
    ...termRows.map((term) => ({
      minHeight: 560,
      cells: [{ text: String(term.number) }, { text: term.text }],
    })),
  ], [1150, TABLE_WIDTH_TWIPS - 1150], 19);

  const witnessTable = table([
    {
      minHeight: 7200,
      cells: [
        { text: ["സാക്ഷി 1", "", "പേര്: __________________________________", "", "വിലാസം:", "", "", "ഒപ്പ്: __________________________________"] },
        { text: ["സാക്ഷി 2", "", "പേര്: __________________________________", "", "വിലാസം:", "", "", "ഒപ്പ്: __________________________________"] },
      ],
    },
  ], [TABLE_WIDTH_TWIPS / 2, TABLE_WIDTH_TWIPS / 2], 20);

  const firstParagraph = `ഒന്നാം പാർട്ടിയുടെ ഉടമസ്ഥതയിലുള്ളതും ${data.buildingName.trim()} എന്ന പേരിൽ അറിയപ്പെടുന്നതുമായ കെട്ടിടം, താഴെ പറയുന്ന നിബന്ധനകളും വ്യവസ്ഥകളും അനുസരിച്ച്, ഉടമയായ ${data.ownerName.trim()}, രണ്ടാം കക്ഷിയായ വാടകക്കാരൻ ${data.tenantName.trim()}-ന് ${duration(data)} വാടകയ്ക്ക് ഉപയോഗിക്കാൻ സമ്മതിച്ചിരിക്കുന്നു.`;
  const secondParagraph = "ഈ വാടകക്കരാർ, സ്റ്റാമ്പ് പേപ്പർ വാങ്ങിയ തീയതി പ്രകാരം പ്രാബല്യത്തിൽ വരുന്നതും, പാർട്ടികളുടെ വിവരം, വസ്തുവിന്റെ വിശദാംശങ്ങൾ എന്നിവ താഴെ ചേർക്കുന്ന പട്ടികയിൽ വ്യക്തമാക്കിയിരിക്കുന്നു.";
  const renewal = "വാടകക്കാരൻ 11 മാസം കഴിഞ്ഞ് വാടക തുടരാൻ ആഗ്രഹിച്ചാൽ അടുത്ത വർഷവും പുതുക്കാവുന്നതാണ്. പുതുക്കുന്ന കരാറിൽ വാടക തുക മുൻവർഷത്തിന്റെ വാടകയിൽ കുറഞ്ഞത് 5% വരേക്കും വർധിപ്പിക്കാവുന്നതാണ്. കരാറിന്റെ പ്രവർത്തനം കൂടാതെ മൂന്ന് വർഷം വരെ ഉടമസ്ഥാവകാശത്തിന്റെ വിവേചനാധികാരത്തിൽ തുടർ നിബന്ധനകൾ നിശ്ചയിക്കാവുന്നതാണ്";

  const document = new Document({
    styles: {
      default: {
        document: {
          run: { font: FONT_MALAYALAM, size: 20 },
          paragraph: { spacing: { after: 90 } },
        },
      },
    },
    sections: [{
      properties: {
        page: {
          size: { width: PAGE_WIDTH_TWIPS, height: PAGE_HEIGHT_TWIPS },
          margin: {
            top: PAGE_MARGIN_TWIPS,
            right: PAGE_MARGIN_TWIPS,
            bottom: PAGE_MARGIN_TWIPS,
            left: PAGE_MARGIN_TWIPS,
            header: 0,
            footer: 0,
            gutter: 0,
          },
        },
      },
      footers: {
        default: new Footer({
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [
                new TextRun({
                  children: [PageNumber.CURRENT],
                  size: 16,
                  font: FONT_LATIN,
                }),
                textRun(" / 4", 16),
              ],
            }),
          ],
        }),
      },
      children: [
        new Paragraph({ spacing: { before: 10000, after: 0 }, children: [textRun("")] }),
        heading("വാടകക്കരാർ"),
        paragraph(firstParagraph, { size: 19, after: 200 }),
        paragraph(secondParagraph, { size: 19, after: 0 }),

        heading("പാർട്ടികളുടെ വിവരം", true),
        partyTable,
        paragraph("കെട്ടിടവിവരം", { size: 26, bold: true, before: 220, after: 100, keepNext: true }),
        buildingTable,

        heading("പ്രധാന നിബന്ധനകളും വ്യവസ്ഥകളും", true),
        paragraph(renewal, { size: 20, bold: true, after: 180 }),
        termTable,

        heading("സാക്ഷികൾ", true),
        witnessTable,
      ],
    }],
  });

  return Packer.toBuffer(document);
}
