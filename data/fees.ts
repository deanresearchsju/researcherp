import type { FeePlan } from "@/types";

export const applicationFee = {
  amount: "₹500",
  detail:
    "The application fee is ₹500, payable to the college account. Upload the fee receipt with the application.",
};

export const feeGlance = [
  {
    id: "full-time",
    name: "Full Time",
    line: "Minimum 3 years",
    fee: "₹70,000 per year",
  },
  {
    id: "part-time",
    name: "Part Time",
    line: "Minimum 4 years",
    fee: "₹50,000 per year",
  },
  {
    id: "application",
    name: "Application fee",
    line: "Paid with the application",
    fee: "₹500",
  },
];

export const feePlans: FeePlan[] = [
  {
    id: "full-time",
    name: "Full Time",
    duration: "Minimum 3 years",
    annualFee: "₹70,000",
    period: "per year",
    summary:
      "For candidates who pursue the doctorate as their primary academic commitment.",
    points: [
      "Minimum duration of 3 years",
      "Annual research fee of ₹70,000",
      "Course work within four semesters",
      "Regular contact with the allotted supervisor",
    ],
    featured: true,
  },
  {
    id: "part-time-internal",
    name: "Part Time Internal",
    duration: "Minimum 4 years",
    annualFee: "₹50,000",
    period: "per year",
    summary: "A part-time pathway for candidates associated with the University.",
    points: [
      "Minimum duration of 4 years",
      "Annual research fee of ₹50,000",
      "Same course work and milestone sequence",
      "Category confirmed in the admission notification",
    ],
  },
  {
    id: "part-time-external",
    name: "Part Time External",
    duration: "Minimum 4 years",
    annualFee: "₹50,000",
    period: "per year",
    summary: "A part-time pathway for candidates based outside the University.",
    points: [
      "Minimum duration of 4 years",
      "Annual research fee of ₹50,000",
      "Same course work and milestone sequence",
      "Category confirmed in the admission notification",
    ],
  },
];
