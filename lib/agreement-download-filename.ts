function safeFilenamePart(value: string) {
  return value
    .normalize("NFKC")
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, " ")
    .replace(/\s+/g, " ")
    .replace(/[. ]+$/g, "")
    .trim()
    .slice(0, 100) || "Tenant";
}

export function agreementDownloadFilename(
  tenantName: string,
  startDate: string | Date,
  extension: "pdf" | "docx",
) {
  const date = startDate instanceof Date ? startDate.toISOString() : startDate;
  const year = /^\d{4}/.exec(date)?.[0] ?? "Agreement";
  return `${safeFilenamePart(tenantName)} ${year}.${extension}`;
}

export function agreementContentDisposition(filename: string) {
  const asciiFallback = filename
    .replace(/[^\x20-\x7e]/g, "_")
    .replace(/["\\;]/g, "_");
  const encodedFilename = encodeURIComponent(filename).replace(/['()*]/g, (character) =>
    `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
  );
  return `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encodedFilename}`;
}
