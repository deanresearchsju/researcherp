import type { School } from "@/types";

export const schools: School[] = [
  {
    id: "engineering",
    name: "School of Engineering and Technology",
    summary: "",
    icon: "cpu",
    areas: [
      "Civil Engineering",
      "Computer Science and Engineering",
      "Electronics and Communication Engineering",
      "Mechanical Engineering",
      "Electrical and Electronics Engineering",
      ],
  },
  {
    id: "science",
    name: "School of Science and Humanities",
    summary: "",
    icon: "flask",
    areas: [
      "Biochemistry",
      "Chemistry",
      "Computer Science",
      "Economics",
      "English",
      "Mathematics",
      "Microbiology",
      "Physical Education",
      "Physics",
      "Tamil",
    ],
  },
  {
    id: "medicine",
    name: "School of Medicine and Health Sciences",
    summary: "",
    icon: "heart-pulse",
    areas: ["Medical Biochemistry", "Medical Biotechnology", "Medicine (Anatomy)"],
  },
  {
    id: "agriculture",
    name: "School of Agriculture",
    summary: "",
    icon: "sprout",
    areas: ["Horticulture"],
  },
  {
    id: "law",
    name: "School of Law",
    summary: "",
    icon: "scale",
    areas: [],
  },
  {
    id: "management",
    name: "School of Management",
    summary: "",
    icon: "briefcase",
    areas: ["Management"],
  },
];
