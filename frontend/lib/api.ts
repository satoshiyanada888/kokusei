import { Indicator, UpdateHistory } from "./types";

const apiUrl = () => process.env.INTERNAL_API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

async function request<T>(path: string): Promise<T> {
  const response = await fetch(`${apiUrl()}${path}`, { next: { revalidate: 300 } });
  if (!response.ok) throw new Error(`API request failed: ${response.status}`);
  const body = (await response.json()) as { data: T };
  return body.data;
}

export const getIndicators = () => request<Indicator[]>("/api/indicators");
export const getIndicator = (slug: string) => request<Indicator>(`/api/indicators/${encodeURIComponent(slug)}`);
export const getUpdates = () => request<UpdateHistory[]>("/api/updates");

