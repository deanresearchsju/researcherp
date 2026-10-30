# Uploading the real data from Excel

When the website and the ERP are approved, the test data is deleted and the University's details are uploaded from Excel. Whatever the sheet holds is taken and kept; what it does not hold is entered by hand afterwards.

Only the **main administrator** sees the upload boxes.

## The order

1. **Back up** the database (BACKUP-AND-RESTORE), then **clear the test data** (Administration, Clear test data). See TESTING.
2. **Research areas** (Website): check that every school and department is there, so that supervisors and scholars can be placed.
3. **Supervisors**: Registers, **Supervisor register**, box _Import supervisors from Excel_.
4. **Scholars**: Registers, **Scholar register**, **Entering details**, box _Import scholars and their details from Excel_.
5. **Sign-ins**: Administration, **Users**, to give each supervisor and scholar a sign-in (the upload does not create sign-ins or passwords).
6. **Check** the counts and a few records (below), then hand out the sign-ins.

## How an upload works

1. Press **Download the blank sheet** to see the headings, or use your own sheet. The headings of the University's own sheet (for example _Guide Name, Supervisor ID, Phone No, Mail ID_, and _Reg No, Name, Department, Batch, Phone, Mail, Title, Category, Working Institution, 1st DC ..._) are understood as they are.
2. Choose the file: an Excel workbook (`.xlsx`) or a `.csv`. If the workbook has several sheets, choose the sheet to read. (Save an old `.xls` as `.xlsx` first.)
3. The page shows what **would** happen, row by row: **Add**, **Update**, **No change**, **Skipped**, and what to check. Nothing is saved yet.
4. Press **Save**. The register is saved in one step; scholars' personal details and the vacancy list follow.

An empty cell **never** removes what is stored. A filled cell replaces the stored value. Only rows that really change something are saved.

## Supervisors

| Column (any of these headings)           | Used for                                                                     |
| ---------------------------------------- | ---------------------------------------------------------------------------- |
| Name, Guide Name                         | **Required.** Matching, and the name                                         |
| Supervisor ID                            | Matching and the ID                                                          |
| Department, Designation, Campus          | The supervisor register                                                      |
| Area of research                         | The key research areas shown on the website                                  |
| Phone, Phone No, Mobile / Email, Mail ID | Contact (10 digits; `+91` and spaces are removed). The e-mail is the sign-in |
| Vidwan ID, Biography                     | The profile (not shown to the public until the office ticks it)              |
| Quota, Current Scholars, Active          | Used only for a **new** supervisor (see below)                               |

- A supervisor is matched by **ID or e-mail**, then by the same name. A name that nearly matches is used only when it can be nobody else, and never when the ID or e-mail says it is another person.
- **New supervisors** are added with the **quota of the designation** (Professor 8, Associate 6, Assistant 4). A designation with "Prof." counts as Professor, "Assoc." as Associate, "Asst." as Assistant. The sheet's _Current Scholars_ sets how many they already guide, so the vacancy is right. They are also put on the vacancy list that Selection uses.
- A supervisor listed twice in the sheet is read once; the second row is shown as skipped.

## Scholars

| Column (any of these headings)                                                                                                                                                                                                              | Used for                                                                           |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Name                                                                                                                                                                                                                                        | **Required**                                                                       |
| Mail, Email / Reg No, Application number, File number                                                                                                                                                                                       | Matching a scholar already on the register; for a new one, the e-mail is required  |
| Phone, Department, Batch, Category (mode of study), Guide, Working institution, Title                                                                                                                                                       | The scholar register                                                               |
| 1st DC, 2nd DC, Confirmation, Colloq 1, Colloq 2, Synopsis, Thesis, Viva                                                                                                                                                                    | The milestones before the ERP (dates)                                              |
| Date of birth, Gender, Nationality, Blood group, Father name, Mother name, Parent contact, Parent email, Address, Pincode, District, State, Community, Date of admission, Area of research, UG / PG degree and university, NET / SET / GATE | **Scholar information** (locked, and it then changes the register and the reports) |

- A scholar is matched by e-mail, registration number, application number or file number. One **not on the register** is **added** if the sheet gives an e-mail and a recognised **batch** (for example `July 2026`, `2026-07-01` or `2026-june`); otherwise the row is skipped and says why.
- **Dates** may be Excel dates or typed (`27.5.25`, `19/6/2025`, `4 Mar 2026`). What cannot be read as a date is left empty and listed under "to check" for hand entry.
- **Mode of study** is read as Full time, Part time (Internal) or Part time (External).
- **Registration numbers** of scholars already on the register are not changed by an upload: they are permanent, and are recorded under Registers, Registration numbers. A registration number in the sheet is kept for a scholar who is **added**.
- A guide is matched to the supervisor register by the exact name, or by a near name that fits only one supervisor; otherwise the name is kept as typed and flagged.
- Existing Scholar information that was locked can be replaced by an upload only because you are the main administrator.

## After the upload

- Compare the counts on the Scholar register and the Supervisor register with the sheet.
- Open three or four scholars and supervisors and check the details.
- Anything flagged "to check" is entered by hand: Scholar information (the office), or **Edit** on the register.
- Create the sign-ins (Users). A scholar's sign-in is the e-mail. Each person sets a new password at the first sign-in and then checks their own basic details (below).
- Keep the original Excel file with the backup.

## Not uploaded

Passwords and sign-ins, uploaded files and photographs, fee payments and receipts, registration numbers of existing scholars, and the records of the ERP itself (committees, reports, results). Those are entered in the ERP.

## At the first sign-in

- A **scholar** sets a new password and is taken to **My details** to check the basic details from the application or the upload and complete what is missing. What the scholar sends goes to the Research Office to confirm; once confirmed it changes the register, the reports and the exports.
- A **supervisor** sets a new password and is taken to **My details**: phone, campus, area of research, Vidwan ID and biography. These are saved at once; the name, designation and department stay with the Research Office. The public page shows the profile only when the office ticks it.
