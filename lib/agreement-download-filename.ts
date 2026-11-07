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
  tradeName: string | null | undefined,
  startDate: string | Date,
  extension: "pdf" | "docx",
) {
  const date = startDate instanceof Date ? startDate.toISOString() : startDate;
  const year = /^\d{4}/.exec(date)?.[0] ?? "Agreement";
  const names = [tenantName, tradeName?.trim()]
    .filter((name): name is string => Boolean(name))
    .map(safeFilenamePart)
    .filter((name, index, parts) =>
      parts.findIndex((part) => part.toLocaleLowerCase() === name.toLocaleLowerCase()) === index,
    );
  return `${names.join(" ")} ${year}.${extension}`;
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
