# Who can do what

## The sign-ins

| Role (sign-in)        | Page                | Sees                                                                           | Can change data                                                                 |
| --------------------- | ------------------- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------- |
| **Administrator**     | `/login/admin`      | Everything. The main one is named `admin`                                      | Everything, including users and fees                                            |
| **Staff**             | `/login/admin`      | Only the menus the administrator ticks                                         | What those menus allow                                                          |
| **Dean**              | `/login/admin`      | Only the menus the administrator ticks                                         | Gives the final approval; approves the RAC; checks evaluator nominees           |
| **Accounts**          | `/login/admin`      | The five fee menus                                                             | Approves or rejects payments                                                    |
| **Vice Chancellor**   | `/login/admin`      | Scholar register, Supervisor register, Thesis evaluators                       | Reads the registers; selects evaluators                                         |
| **COE: marks entry**  | `/login/admin`      | Marks entry                                                                    | Enters marks (any number of such sign-ins)                                      |
| **COE: verification** | `/login/admin`      | Verify and freeze marks                                                        | Sends back, freezes, submits to the office                                      |
| **Supervisor**        | `/login/supervisor` | Own scholars, their requests, committees, synopsis and thesis, RAC, evaluators | Approves or rejects the scholars' submissions; nominates the RAC and evaluators |
| **Scholar**           | `/login/scholar`    | Own record only                                                                | Own records and requests                                                        |

A scholar's sign-in is the **e-mail only**; it opens once the admission checklist is submitted. A supervisor's sign-in opens when the recognition is approved. The first password is issued by the office and must be changed at the first sign-in.

## Rights for staff and the Dean

The administrator opens **Administration, Users**, chooses the person and ticks the menus. Each menu has separate boxes: **open**, **edit**, **approve**, **download** and **upload**. Download and upload stay off until ticked. "All in this module" ticks a whole group; "Dashboard only" gives nothing else.

The main administrator (`admin`) always has everything and cannot be removed. The roles Accounts, Vice Chancellor and the two COE roles start with their fixed menus.

## Rules that hold for everyone

- Everything a scholar submits goes to the **Supervisor first**; the **Dean** decides only after the Supervisor has approved, and either can reject with comments. Only the Dean (or the administrator) gives the final approval.
- A payment is approved only by Accounts; the next step opens only after that.
- The Vice Chancellor and the COE roles cannot open scholar, supervisor or profile pages.
- The thesis evaluators are visible only to the supervisor who proposed them, the Dean, the Vice Chancellor and the administrator; never to the scholar.
- The guide history is visible only to the administrator and the Dean.
- **Clear test data** is for the main administrator only, and only while it is switched on.

## Good practice

- One person, one sign-in. Never share `admin`.
- Give staff only the menus their work needs; give "approve" rights sparingly.
- Remove or change a sign-in the day a person leaves or changes work.
- Review the list of users and their rights at the start of each admission session.
- Write in the audit-friendly way: approve and reject with real comments.
