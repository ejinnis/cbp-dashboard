import { differenceInMinutes, parseISO } from "date-fns";

export interface Team {
  id: string;
  alias?: string;
}

export interface HistoryElement {
  time: string; // Adjusted to match JSON
  images: Record<OS, number | null>;
}

export enum Tier {
  Platinum = "Platinum",
  Gold = "Gold",
  Silver = "Silver",
  HighSchool = "HighSchool",
  MiddleSchool = "MiddleSchool",
}

export enum Division {
  AllService = "AllService",
  Open = "Open",
  MiddleSchool = "MiddleSchool",
}

export enum OS {
  Windows = "Windows11_cp17_sf_pg",
  Server = "Server2022_cp17_sf_pgsms",
  Linux = "Mint21_cp17_sf_p",
}

export interface Ranking {
  place: number;
  total: number;
}

export interface Image {
  name: OS | null;
  runtime: number; // Converted from string to number (seconds)
  issues: { found: number; remaining: number };
  penalties: number;
  score: number;
  multiple: boolean;
  overtime: boolean;
}

export interface TeamInfoResponse {
   [teamId: string]: {
    images: Image[];
    ranking: { national: Ranking | null; state: Ranking | null };
    history: HistoryElement[];
    updated: string;
    location: string;
    division: Division | null;
    tier: Tier | null;
    runtime: string;
  } | null;
}



export function parseRuntime(runtime: string): number {
  const [hours, minutes, seconds] = runtime.split(":").map(Number);
  return hours * 3600 + minutes * 60 + seconds;
}

export function parseHistory(history: HistoryElement[]): HistoryElement[] {
  return history.map((h) => ({
    ...h,
    time: parseISO(`2025-01-25T${h.time}:00Z`).toISOString(), // Parsing `time` to ISO format
  }));
}

export function getTotalScore(data: TeamInfoResponse[string]) {
  return data?.images.reduce((a, b) => a + b.score, 0);
}

export interface RuntimeLog {
  [teamId: string]: {
    [image: string]: {
      runtime: number;
      since: Date;
    };
  };
}

export function getPercentile(ranking: Ranking) {
  return Math.floor((100 * (ranking.total - ranking.place)) / ranking.total);
}

export function formatPercentile(ranking: Ranking) {
  const percentile = getPercentile(ranking);

  return `${percentile}${getOrdinal(percentile)} Percentile`;
}

export function prepareHistory(history: HistoryElement[]) {
  if (history.length === 0) {
    return [];
  }

  const newHistory = history.map((h) => ({
    time: new Date(h.time).getTime(),
    ...h.images,
  }));


  return newHistory;
}
export function getOrdinal(n: number) {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
}
export function isStopped(data: TeamInfoResponse[string], teamRtl: RuntimeLog[string], image: Image | null) {
  const imageRtl = image?.name && teamRtl ? teamRtl[image.name] : undefined;

  return (
    (imageRtl &&
      image &&
      data?.updated &&
      imageRtl.runtime === image?.runtime &&
      differenceInMinutes(parseISO(data.updated), imageRtl.since) > 1) ?? 
    false
  );
}

export const imageDisplayOrder = [OS.Windows, OS.Server, OS.Linux];
