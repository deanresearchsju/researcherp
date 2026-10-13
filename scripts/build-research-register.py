"""Build data/research-register.ts from the office workbook and vacancy list."""

import json
import re
import zipfile
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
XLSX = ROOT / "phd supervisors and scholars data base.xlsx"
DOCX = ROOT / "Research_Supervisors_Vacancy_Research area (1).docx"
OUT = ROOT / "data" / "research-register.ts"

NS = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"
W = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"

BATCHES = {
    "2025-01-01": {
        "id": "2025-january",
        "name": "January 2025",
        "session": "January",
        "year": 2025,
        "order": 1,
        "needsRegistrationNumber": False,
        "note": "Registration numbers are allotted.",
    },
    "2025-06-01": {
        "id": "2025-june",
        "name": "June 2025",
        "session": "June",
        "year": 2025,
        "order": 2,
        "needsRegistrationNumber": False,
        "note": "Registration numbers are allotted.",
    },
    "2026-01-01": {
        "id": "2026-january",
        "name": "January 2026",
        "session": "January",
        "year": 2026,
        "order": 3,
        "needsRegistrationNumber": True,
        "note": "Selected. The file number is on the register. The registration number is still to be allotted.",
    },
    "2026-06-01": {
        "id": "2026-june",
        "name": "June 2026",
        "session": "June",
        "year": 2026,
        "order": 4,
        "needsRegistrationNumber": True,
        "note": "Newly selected. Admission is complete. The registration number is still to be allotted.",
    },
}


def excel_date(value: str) -> str:
    if not value or not value.replace(".", "", 1).isdigit():
        return ""
    number = int(float(value))
    return (datetime(1899, 12, 30) + timedelta(days=number)).date().isoformat()


def tokens(value: str) -> list[str]:
    text = value.lower().replace(".", " ")
    return [part for part in re.split(r"[^a-z0-9]+", text) if part and part != "dr"]


def cell_text(cell, strings: list[str]) -> str:
    kind = cell.attrib.get("t")
    value = cell.find(NS + "v")
    inline = cell.find(NS + "is")
    if kind == "s" and value is not None and value.text:
        return strings[int(value.text)].replace("\n", " ").strip()
    if kind == "inlineStr" and inline is not None:
        return "".join(item.text or "" for item in inline.iter(NS + "t")).replace("\n", " ").strip()
    if value is not None and value.text:
        return value.text.strip()
    return ""


def col_index(ref: str) -> tuple[int, int]:
    letters = "".join(ch for ch in ref if ch.isalpha())
    row = int("".join(ch for ch in ref if ch.isdigit()))
    number = 0
    for ch in letters:
        number = number * 26 + ord(ch) - 64
    return number, row


def sheet_rows(book: zipfile.ZipFile, strings: list[str], path: str) -> list[dict[int, str]]:
    root = ET.fromstring(book.read(path))
    rows: dict[int, dict[int, str]] = {}
    for cell in root.iter(NS + "c"):
        ref = cell.attrib.get("r")
        if not ref:
            continue
        column, row = col_index(ref)
        rows.setdefault(row, {})[column] = cell_text(cell, strings)
    ordered = []
    for row in sorted(rows):
        if row == 1:
            continue
        ordered.append(rows[row])
    return ordered


def load_book():
    book = zipfile.ZipFile(XLSX)
    shared = ET.fromstring(book.read("xl/sharedStrings.xml"))
    strings = []
    for item in shared.findall(NS + "si"):
        strings.append("".join(part.text or "" for part in item.iter(NS + "t")))
    return (
        sheet_rows(book, strings, "xl/worksheets/sheet1.xml"),
        sheet_rows(book, strings, "xl/worksheets/sheet2.xml"),
        sheet_rows(book, strings, "xl/worksheets/sheet3.xml"),
        sheet_rows(book, strings, "xl/worksheets/sheet4.xml"),
    )


def docx_areas() -> dict[str, str]:
    document = ET.fromstring(zipfile.ZipFile(DOCX).read("word/document.xml"))
    lines = []
    for paragraph in document.iter(W + "p"):
        text = "".join(part.text or "" for part in paragraph.iter(W + "t")).strip()
        if text:
            lines.append(text)
    areas: dict[str, str] = {}
    index = 0
    while index < len(lines):
        if lines[index].isdigit() and index + 5 < len(lines) and lines[index + 5].isdigit():
            name = lines[index + 1]
            area = lines[index + 4]
            if not area.lower().startswith("department of"):
                areas[" ".join(tokens(name))] = area
                index += 6
                continue
        index += 1
    return areas


def number(value: str) -> int:
    try:
        return int(float(value))
    except ValueError:
        return 0


def official_registration(value: str) -> bool:
    return "CR" in value.upper()


def match_supervisor(guide: str, supervisors: list[dict]) -> dict | None:
    guide_tokens = tokens(guide.replace("selwyn", "selvin"))
    if not guide_tokens or len("".join(guide_tokens)) < 5:
        return None
    exact = [item for item in supervisors if tokens(item["name"]) == guide_tokens]
    if len(exact) == 1:
        return exact[0]
    hits = [
        item
        for item in supervisors
        if all(token in tokens(item["name"]) for token in guide_tokens)
    ]
    if len(hits) == 1:
        return hits[0]
    return None


def main() -> None:
    supervisors_raw, guides_raw, selected_raw, scholars_raw = load_book()
    areas = docx_areas()
    supervisors = []
    for row in supervisors_raw:
        name = row.get(2, "").strip()
        if not name:
            continue
        key = " ".join(tokens(name.replace("Neethimanikam", "Neethi Manickam")))
        name_tokens = key.split()
        area = areas.get(key, "")
        if not area and name_tokens:
            hits = [
                value
                for area_key, value in areas.items()
                if all(token in area_key.split() for token in name_tokens)
                or all(token in name_tokens for token in area_key.split())
            ]
            if len(hits) == 1:
                area = hits[0]
        supervisors.append(
            {
                "serialNo": number(row.get(1, "")),
                "name": name,
                "supervisorId": row.get(3, "").strip(),
                "department": row.get(4, "").strip(),
                "designation": row.get(5, "").strip(),
                "researchArea": area,
                "active": row.get(6, "").strip().lower() == "yes",
                "currentScholars": number(row.get(7, "")),
                "quota": number(row.get(8, "")),
                "vacancy": number(row.get(9, "")),
                "june2026Allotment": number(row.get(10, "")),
                "balance": number(row.get(11, "")),
                "campus": row.get(12, "").strip(),
                "onVacancyList": bool(area),
            }
        )

    guide_by_serial: dict[str, str] = {}
    current_guide = ""
    for row in guides_raw:
        if row.get(1, "").strip():
            current_guide = row.get(1, "").strip()
        serial = row.get(3, "").strip()
        if serial and current_guide:
            guide_by_serial[serial] = current_guide

    scholars = []
    for row in scholars_raw:
        serial = number(row.get(1, ""))
        batch_date = excel_date(row.get(5, ""))
        batch = BATCHES[batch_date]
        raw_number = row.get(2, "").strip()
        official = official_registration(raw_number)
        guide = guide_by_serial.get(str(serial), "")
        matched = match_supervisor(guide, supervisors) if guide else None
        scholars.append(
            {
                "id": f"{batch['id']}-{serial}",
                "serialNo": serial,
                "registrationNumber": raw_number if official else "",
                "fileNumber": "" if official else raw_number,
                "applicationNumber": "",
                "name": row.get(3, "").strip(),
                "department": row.get(4, "").strip(),
                "batchId": batch["id"],
                "phone": row.get(6, "").strip(),
                "email": row.get(7, "").strip(),
                "title": row.get(8, "").strip(),
                "category": row.get(9, "").strip(),
                "institution": row.get(10, "").strip(),
                "guideName": matched["name"] if matched else guide,
                "firstDc": row.get(11, "").strip(),
                "secondDc": row.get(12, "").strip(),
                "confirmation": row.get(13, "").strip(),
                "colloquium1": row.get(14, "").strip(),
                "colloquium2": row.get(15, "").strip(),
                "synopsis": row.get(16, "").strip(),
                "thesis": row.get(17, "").strip(),
                "viva": row.get(18, "").strip(),
            }
        )

    known = {item["name"] for item in supervisors}
    extra_serial = max(item["serialNo"] for item in supervisors)
    for scholar in scholars:
        if scholar["guideName"] and scholar["guideName"] not in known:
            extra_serial += 1
            supervisors.append(
                {
                    "serialNo": extra_serial,
                    "name": scholar["guideName"],
                    "supervisorId": "",
                    "department": scholar["department"],
                    "designation": "",
                    "researchArea": "",
                    "active": True,
                    "currentScholars": 0,
                    "quota": 0,
                    "vacancy": 0,
                    "june2026Allotment": 0,
                    "balance": 0,
                    "campus": "",
                    "onVacancyList": False,
                }
            )
            known.add(scholar["guideName"])

    for row in selected_raw:
        serial = number(row.get(1, ""))
        guide = row.get(8, "").strip()
        matched = match_supervisor(guide, supervisors)
        scholars.append(
            {
                "id": f"2026-june-{serial}",
                "serialNo": serial,
                "registrationNumber": "",
                "fileNumber": "",
                "applicationNumber": row.get(3, "").strip(),
                "name": row.get(2, "").strip(),
                "department": row.get(6, "").strip(),
                "batchId": "2026-june",
                "phone": row.get(5, "").strip(),
                "email": row.get(4, "").strip(),
                "title": "",
                "category": "",
                "institution": "",
                "guideName": matched["name"] if matched else guide,
                "firstDc": "",
                "secondDc": "",
                "confirmation": "",
                "colloquium1": "",
                "colloquium2": "",
                "synopsis": "",
                "thesis": "",
                "viva": "",
            }
        )

    batches = [BATCHES[key] for key in ("2025-01-01", "2025-06-01", "2026-01-01", "2026-06-01")]
    payload = {
        "batches": batches,
        "supervisors": supervisors,
        "scholars": scholars,
    }
    body = json.dumps(payload, ensure_ascii=False, indent=2)
    OUT.write_text(
        "export type ResearchBatch = {\n"
        "  id: string;\n"
        "  name: string;\n"
        "  session: string;\n"
        "  year: number;\n"
        "  order: number;\n"
        "  needsRegistrationNumber: boolean;\n"
        "  note: string;\n"
        "};\n\n"
        "export type ResearchSupervisor = {\n"
        "  serialNo: number;\n"
        "  name: string;\n"
        "  supervisorId: string;\n"
        "  department: string;\n"
        "  designation: string;\n"
        "  researchArea: string;\n"
        "  active: boolean;\n"
        "  currentScholars: number;\n"
        "  quota: number;\n"
        "  vacancy: number;\n"
        "  june2026Allotment: number;\n"
        "  balance: number;\n"
        "  campus: string;\n"
        "  onVacancyList: boolean;\n"
        "};\n\n"
        "export type ResearchScholar = {\n"
        "  id: string;\n"
        "  serialNo: number;\n"
        "  registrationNumber: string;\n"
        "  fileNumber: string;\n"
        "  applicationNumber: string;\n"
        "  name: string;\n"
        "  department: string;\n"
        "  batchId: string;\n"
        "  phone: string;\n"
        "  email: string;\n"
        "  title: string;\n"
        "  category: string;\n"
        "  institution: string;\n"
        "  guideName: string;\n"
        "  firstDc: string;\n"
        "  secondDc: string;\n"
        "  confirmation: string;\n"
        "  colloquium1: string;\n"
        "  colloquium2: string;\n"
        "  synopsis: string;\n"
        "  thesis: string;\n"
        "  viva: string;\n"
        "};\n\n"
        f"export const researchRegister = {body} as {{\n"
        "  batches: ResearchBatch[];\n"
        "  supervisors: ResearchSupervisor[];\n"
        "  scholars: ResearchScholar[];\n"
        "};\n",
        encoding="utf-8",
    )
    print("supervisors", len(supervisors))
    print("scholars", len(scholars))
    print("areas", len(areas))
    missing = [item["name"] for item in supervisors if item["onVacancyList"] is False and item["supervisorId"]]
    print("no area match", [item["name"] for item in supervisors if item["supervisorId"] and not item["researchArea"]][:20])
    for batch in batches:
        count = sum(1 for item in scholars if item["batchId"] == batch["id"])
        print(batch["name"], count)


if __name__ == "__main__":
    main()
