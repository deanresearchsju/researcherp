import { Container } from "@/components/ui/container";
import { vacancyNote } from "@/data/vacancies";
import { groupVacancies, vacancyTotal, type Vacancy } from "@/lib/vacancies";

export function VacancyList({ rows }: { rows: Vacancy[] }) {
  const groups = groupVacancies(rows);
  const total = vacancyTotal(rows);

  return (
    <Container className="py-10">
      <p className="text-sm text-muted-foreground">{vacancyNote}</p>
      <p className="mt-2 text-sm font-semibold text-primary">
        {rows.length} supervisors · {total} vacancies
      </p>
      <div className="mt-6 overflow-x-auto rounded-xl border border-border bg-card shadow-card">
        <table className="w-full min-w-[44rem] border-collapse text-left text-sm">
          <thead className="bg-muted text-primary">
            <tr>
              <th scope="col" className="px-4 py-3 font-semibold">
                S. No.
              </th>
              <th scope="col" className="px-4 py-3 font-semibold">
                Name of the Supervisor, Designation, Department
              </th>
              <th scope="col" className="px-4 py-3 font-semibold">
                Area of Research
              </th>
              <th scope="col" className="px-4 py-3 font-semibold">
                No. of Vacancy
              </th>
            </tr>
          </thead>
          {groups.map((group) => (
            <tbody key={group.department}>
              <tr className="border-t border-border bg-primary/5">
                <th
                  colSpan={4}
                  scope="colgroup"
                  className="px-4 py-3 text-left font-semibold text-primary"
                >
                  Department of {group.department}
                </th>
              </tr>
              {group.rows.map((row) => (
                <tr key={row.id} className="border-t border-border">
                  <td className="px-4 py-3 align-top">{row.serialNo}</td>
                  <td className="px-4 py-3 align-top">
                    <span className="font-semibold text-primary">
                      {row.supervisorName}
                    </span>
                    <span className="mt-1 block text-muted-foreground">
                      {row.designation}
                    </span>
                    <span className="mt-1 block text-muted-foreground">
                      Department of {row.department}
                    </span>
                  </td>
                  <td className="px-4 py-3 align-top">{row.researchArea}</td>
                  <td className="px-4 py-3 align-top font-semibold">
                    {row.vacancyCount}
                  </td>
                </tr>
              ))}
            </tbody>
          ))}
        </table>
      </div>
    </Container>
  );
}
