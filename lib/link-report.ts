import { checkDoi, checkLink, type LinkCheck } from "@/lib/link-check";

/** The DOI and web link sent from a form, checked online (either may be left out). */
export async function linkReport(body: Record<string, unknown>) {
  const doi = typeof body.doi === "string" ? body.doi.trim().slice(0, 200) : "";
  const link = typeof body.link === "string" ? body.link.trim().slice(0, 500) : "";
  const [doiCheck, linkCheck]: (LinkCheck | null)[] = await Promise.all([
    doi ? checkDoi(doi) : null,
    link ? checkLink(link) : null,
  ]);
  return { doi: doiCheck, link: linkCheck };
}
