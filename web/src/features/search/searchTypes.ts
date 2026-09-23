import type { SearchFileType } from "../../api/api";

export type FilterKey = "all" | SearchFileType;
export type SearchMode = "name" | "smart";

export const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "image", label: "Images" },
  { key: "video", label: "Video" },
  { key: "audio", label: "Audio" },
  { key: "pdf", label: "PDF" },
  { key: "text", label: "Text" },
];
