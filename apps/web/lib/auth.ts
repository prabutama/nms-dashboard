"use client";

import type { AuthResponse } from "@/lib/types";

const STORAGE_KEY = "nms-auth";

export type StoredAuth = {
  token: string;
  refreshToken: string;
  user: AuthResponse["user"];
};

export function readStoredAuth(): StoredAuth | null {
  if (typeof window === "undefined") {
    return null;
  }
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw) as StoredAuth;
  } catch {
    return null;
  }
}

export function writeStoredAuth(auth: StoredAuth | null) {
  if (typeof window === "undefined") {
    return;
  }
  if (!auth) {
    window.localStorage.removeItem(STORAGE_KEY);
    return;
  }
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(auth));
}

export function getAccessToken() {
  return readStoredAuth()?.token || "";
}
