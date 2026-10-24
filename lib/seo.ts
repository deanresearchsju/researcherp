import { university } from "@/lib/constants";
import type { PublicSupervisor } from "@/lib/public-supervisors";

export const siteUrl = university.siteUrl;

export const universityNode = {
  "@type": "CollegeOrUniversity",
  "@id": `${siteUrl}/#university`,
  name: university.name,
  alternateName: university.shortName,
  url: siteUrl,
  logo: `${siteUrl}/assets/logo-full.jpeg`,
  slogan: university.tagline,
  email: university.email,
  address: { "@type": "PostalAddress", addressRegion: "Tamil Nadu", addressCountry: "IN" },
  parentOrganization: { "@type": "Organization", name: university.unit.replace(/^A Unit of /i, "") },
};

export function siteJsonLd() {
  return {
    "@context": "https://schema.org",
    "@graph": [
      universityNode,
      {
        "@type": "WebSite",
        "@id": `${siteUrl}/#website`,
        url: siteUrl,
        name: `${university.name} ${university.researchOffice}`,
        inLanguage: "en-IN",
        publisher: { "@id": `${siteUrl}/#university` },
      },
    ],
  };
}

export function breadcrumbNode(trail: { name: string; path: string }[]) {
  return {
    "@type": "BreadcrumbList",
    itemListElement: trail.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: `${siteUrl}${item.path}`,
    })),
  };
}

export function personNode(profile: PublicSupervisor) {
  const url = `${siteUrl}/supervisors/${profile.slug}`;
  const areas = profile.researchArea
    .split(/[,;]/)
    .map((part) => part.trim())
    .filter(Boolean);
  return {
    "@type": "Person",
    "@id": `${url}#person`,
    name: profile.name.replace(/^dr\.?\s+/i, ""),
    ...(/^dr\.?\s/i.test(profile.name) ? { honorificPrefix: "Dr." } : {}),
    url,
    ...(profile.designation ? { jobTitle: profile.designation } : {}),
    worksFor: { "@id": `${siteUrl}/#university` },
    ...(profile.department
      ? { memberOf: { "@type": "Organization", name: profile.department, parentOrganization: { "@id": `${siteUrl}/#university` } } }
      : {}),
    ...(areas.length ? { knowsAbout: areas } : {}),
    ...(profile.bio ? { description: profile.bio } : {}),
    ...(profile.hasPhoto ? { image: `${siteUrl}/supervisors/photo/${profile.slug}` } : {}),
    ...(profile.vidwanUrl ? { sameAs: [profile.vidwanUrl] } : {}),
  };
}

export function supervisorJsonLd(supervisors: PublicSupervisor[]) {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "CollectionPage",
        "@id": `${siteUrl}/supervisors#page`,
        url: `${siteUrl}/supervisors`,
        name: `Ph.D. Research Supervisors | ${university.name}`,
        inLanguage: "en-IN",
        isPartOf: { "@id": `${siteUrl}/#website` },
        about: { "@id": `${siteUrl}/#university` },
        mainEntity: {
          "@type": "ItemList",
          numberOfItems: supervisors.length,
          itemListElement: supervisors.map((profile, index) => ({
            "@type": "ListItem",
            position: index + 1,
            url: `${siteUrl}/supervisors/${profile.slug}`,
            item: personNode(profile),
          })),
        },
      },
      breadcrumbNode([
        { name: "Home", path: "/" },
        { name: "Research supervisors", path: "/supervisors" },
      ]),
    ],
  };
}

/** Meta descriptions read best at about 155 characters. */
export function clip(text: string, max = 155) {
  const flat = text.replace(/\s+/g, " ").trim();
  if (flat.length <= max) return flat;
  const cut = flat.slice(0, max - 1);
  return `${cut.slice(0, cut.lastIndexOf(" ")).replace(/[,;:.\s]+$/, "")}…`;
}
