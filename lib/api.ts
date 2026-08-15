import { headers } from "next/headers";

export async function apiFetch(path: string, init?: RequestInit) {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3001";
  const proto = h.get("x-forwarded-proto") ?? "http";
  const cookie = h.get("cookie");

  return fetch(`${proto}://${host}${path}`, {
    ...init,
    headers: {
      ...(cookie ? { cookie } : {}),
      ...(init?.headers ?? {}),
    },
  });
}