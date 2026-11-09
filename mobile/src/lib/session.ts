import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

export type AccountRole = "OWNER" | "TENANT" | "SUPER_ADMIN";

export type MobileSession = {
  token: string;
  role: AccountRole;
  mobileNumber: string;
};

const sessionKey = "rent-sync-session";
const apiBaseUrl = "https://rentsync-theta.vercel.app";

async function readValue(key: string) {
  if (Platform.OS !== "web") return SecureStore.getItemAsync(key);
  return typeof globalThis.sessionStorage === "undefined"
    ? null
    : globalThis.sessionStorage.getItem(key);
}

async function writeValue(key: string, value: string) {
  if (Platform.OS !== "web") {
    await SecureStore.setItemAsync(key, value);
  } else {
    if (typeof globalThis.sessionStorage === "undefined") {
      throw new Error("Browser storage is unavailable.");
    }
    globalThis.sessionStorage.setItem(key, value);
  }
}

async function deleteValue(key: string) {
  if (Platform.OS !== "web") {
    await SecureStore.deleteItemAsync(key);
  } else if (typeof globalThis.sessionStorage !== "undefined") {
    globalThis.sessionStorage.removeItem(key);
  }
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
  return __DEV__ && Platform.OS === "web" ? "http://localhost:3001" : apiBaseUrl;
}
