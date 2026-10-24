import { parseCsv } from "@/lib/csv";

const controlCharacters = new RegExp(
  "[\\u0000-\\u0008\\u000B\\u000C\\u000E-\\u001F]",
  "g",
);

function xmlText(value: string) {
  return value
    .replace(controlCharacters, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function columnName(index: number) {
  let name = "";
  for (let value = index + 1; value > 0; value = Math.floor((value - 1) / 26)) {
    name = String.fromCharCode(65 + ((value - 1) % 26)) + name;
  }
  return name;
}

const xmlHeader = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';

/**
 * Saves a table as an Excel workbook (.xlsx) with a bold heading row, a frozen heading and
 * sensible column widths. A plain CSV file cannot carry bold text, so exports use this.
 */
export async function downloadSheet(
  filename: string,
  headers: readonly string[],
  rows: readonly (readonly string[])[],
) {
  const { default: JSZip } = await import("jszip");
  const table = [headers, ...rows];
  const widths = headers.map((_, column) =>
    Math.min(
      60,
      Math.max(
        8,
        ...table
          .slice(0, 300)
          .map((row) => (row[column] ?? "").split("\n")[0].length + 2),
      ),
    ),
  );
  const sheetRows = table
    .map((row, rowIndex) => {
      const cells = headers
        .map((_, column) => {
          const value = row[column] ?? "";
          const style = rowIndex === 0 ? ' s="1"' : "";
          return `<c r="${columnName(column)}${rowIndex + 1}" t="inlineStr"${style}><is><t xml:space="preserve">${xmlText(value)}</t></is></c>`;
        })
        .join("");
      return `<row r="${rowIndex + 1}">${cells}</row>`;
    })
    .join("");
  const cols = widths
    .map(
      (width, index) =>
        `<col min="${index + 1}" max="${index + 1}" width="${width}" customWidth="1"/>`,
    )
    .join("");

  const zip = new JSZip();
  const add = (name: string, data: string) =>
    zip.file(name, data, { createFolders: false });
  add(
    "[Content_Types].xml",
    `${xmlHeader}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`,
  );
  add(
    "_rels/.rels",
    `${xmlHeader}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
  );
  add(
    "xl/workbook.xml",
    `${xmlHeader}<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Export" sheetId="1" r:id="rId1"/></sheets></workbook>`,
  );
  add(
    "xl/_rels/workbook.xml.rels",
    `${xmlHeader}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`,
  );
  add(
    "xl/styles.xml",
    `${xmlHeader}<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFEDE7F6"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/></cellXfs></styleSheet>`,
  );
  add(
    "xl/worksheets/sheet1.xml",
    `${xmlHeader}<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols>${cols}</cols><sheetData>${sheetRows}</sheetData></worksheet>`,
  );
  const blob = await zip.generateAsync({
    type: "blob",
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${filename.replace(/\.(csv|xlsx)$/i, "")}.xlsx`;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

/** The same Excel export for a table that is already CSV text. */
export function downloadCsvAsSheet(filename: string, csv: string) {
  const table = parseCsv(csv);
  return downloadSheet(filename, table[0] ?? [], table.slice(1));
}
