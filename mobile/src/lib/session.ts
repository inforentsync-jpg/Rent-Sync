import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

export type AccountRole = "OWNER" | "TENANT" | "SUPER_ADMIN";

export type MobileSession = {
  token: string;
  role: AccountRole;
  mobileNumber: string;
};

const sessionKey = "rent-sync-session";
const apiUrlKey = "rent-sync-api-url";

async function readValue(key: string) {
  if (Platform.OS === "web") {
    const storage = key === sessionKey ? globalThis.sessionStorage : globalThis.localStorage;
    return typeof storage === "undefined" ? null : storage.getItem(key);
  }
  return SecureStore.getItemAsync(key);
}

async function writeValue(key: string, value: string) {
  if (Platform.OS === "web") {
    const storage = key === sessionKey ? globalThis.sessionStorage : globalThis.localStorage;
    if (typeof storage === "undefined") {
      throw new Error("Browser storage is unavailable.");
    }
    storage.setItem(key, value);
    return;
  }
  await SecureStore.setItemAsync(key, value);
}

async function deleteValue(key: string) {
  if (Platform.OS === "web") {
    const storage = key === sessionKey ? globalThis.sessionStorage : globalThis.localStorage;
    if (typeof storage !== "undefined") storage.removeItem(key);
    return;
  }
  await SecureStore.deleteItemAsync(key);
}

export async function readSession(): Promise<MobileSession | null> {
  const value = await readValue(sessionKey);
  if (!value) return null;
  try {
    const session: unknown = JSON.parse(value);
    if (
      session &&
      typeof session === "object" &&
      "token" in session &&
      typeof session.token === "string" &&
      "mobileNumber" in session &&
      typeof session.mobileNumber === "string" &&
      "role" in session &&
      (session.role === "OWNER" ||
        session.role === "TENANT" ||
        session.role === "SUPER_ADMIN")
    ) {
      return session as MobileSession;
    }
    await deleteValue(sessionKey);
    return null;
  } catch (error) {
    await deleteValue(sessionKey);
    console.warn("Stored mobile session could not be read.", error);
    return null;
  }
}

export async function writeSession(session: MobileSession) {
  await writeValue(sessionKey, JSON.stringify(session));
}

export async function clearSession() {
  await deleteValue(sessionKey);
}

export async function readApiBaseUrl() {
  const configured = process.env.EXPO_PUBLIC_API_URL;
  const saved = await readValue(apiUrlKey);
  const fallback = __DEV__
    ? Platform.OS === "android"
      ? "http://10.0.2.2:3000"
      : "http://localhost:3000"
    : "";
  return (saved || configured || fallback).replace(/\/+$/, "");
}

export async function saveApiBaseUrl(value: string) {
  const url = value.trim().replace(/\/+$/, "");
  if (!/^https?:\/\/[^/\s]+$/i.test(url)) {
    throw new Error("Enter a valid server address, such as https://your-domain.com.");
  }
  await writeValue(apiUrlKey, url);
  return url;
}
