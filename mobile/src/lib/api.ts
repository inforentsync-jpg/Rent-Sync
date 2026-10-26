import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import type { MobileSession } from "./session";
import { readApiBaseUrl } from "./session";

type RequestOptions = {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  token?: string;
};

export async function apiRequest<T>(path: string, options: RequestOptions = {}) {
  const baseUrl = await readApiBaseUrl();
  if (!baseUrl) {
    throw new Error("Set the Rent-Sync server address before signing in.");
  }
  let response: Response;
  try {
    response = await fetch(`${baseUrl}${path}`, {
      method: options.method ?? "GET",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "x-rent-sync-client": "mobile",
        ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
      },
      ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
    });
  } catch {
    throw new Error("Could not reach Rent-Sync. Check the server address and connection.");
  }
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      payload && typeof payload === "object" && "error" in payload && typeof payload.error === "string"
        ? payload.error
        : "The request could not be completed.";
    throw new Error(message);
  }
  return payload as T;
}

const loginPath: Record<MobileSession["role"], string> = {
  OWNER: "/api/owner/login",
  TENANT: "/api/tenant/login",
  SUPER_ADMIN: "/api/auth/login",
};

export async function signIn(
  role: MobileSession["role"],
  mobileNumber: string,
  password: string,
) {
  const response = await apiRequest<{ success: boolean; token?: string }>(loginPath[role], {
    method: "POST",
    body:
      role === "SUPER_ADMIN"
        ? { mobileNumber, password }
        : { mobileNumber, password, method: "password" },
  });
  if (!response.token) {
    throw new Error("Sign-in succeeded but no mobile session was returned.");
  }
  return { token: response.token, role, mobileNumber: mobileNumber.replace(/\D/g, "") };
}

export async function registerOwner(
  fullName: string,
  mobileNumber: string,
  password: string,
) {
  const response = await apiRequest<{ success: boolean; token?: string }>("/api/owner/register", {
    method: "POST",
    body: { fullName, mobileNumber, password },
  });
  if (!response.token) {
    throw new Error("Registration succeeded but no mobile session was returned.");
  }
  return {
    token: response.token,
    role: "OWNER" as const,
    mobileNumber: mobileNumber.replace(/\D/g, ""),
  };
}

export function authenticatedRequest<T>(
  session: MobileSession,
  path: string,
  options: Omit<RequestOptions, "token"> = {},
) {
  return apiRequest<T>(path, { ...options, token: session.token });
}

export function getOwnerPortfolio<T>(session: MobileSession) {
  return authenticatedRequest<T>(session, "/api/owner/portfolio");
}

export function getTenantShareLinks<T>(session: MobileSession) {
  return authenticatedRequest<T>(session, "/api/owner/tenants/share-links");
}

export function createTenantShareLink<T>(session: MobileSession, tenantId: string) {
  return authenticatedRequest<T>(
    session,
    `/api/owner/tenants/${encodeURIComponent(tenantId)}/share`,
    { method: "POST" },
  );
}

export function revokeTenantShareLink<T>(session: MobileSession, tenantId: string) {
  return authenticatedRequest<T>(
    session,
    `/api/owner/tenants/${encodeURIComponent(tenantId)}/share`,
    { method: "DELETE" },
  );
}

export function getTenantAgreements<T>(session: MobileSession) {
  return authenticatedRequest<T>(session, "/api/tenant/agreements");
}

export function getAdminAccounts<T>(session: MobileSession) {
  return authenticatedRequest<T>(session, "/api/admin/accounts/password");
}

export function createPortfolioItem<T>(
  session: MobileSession,
  body: Record<string, unknown>,
) {
  return authenticatedRequest<T>(session, "/api/owner/portfolio", {
    method: "POST",
    body,
  });
}

export function updatePortfolioItem<T>(
  session: MobileSession,
  body: Record<string, unknown>,
) {
  return authenticatedRequest<T>(session, "/api/owner/portfolio", {
    method: "PATCH",
    body,
  });
}

export function deletePortfolioItem<T>(
  session: MobileSession,
  kind: string,
  id: string,
) {
  return authenticatedRequest<T>(session, "/api/owner/portfolio", {
    method: "DELETE",
    body: { kind, id },
  });
}

export function updateOwnerProfile<T>(
  session: MobileSession,
  body: Record<string, unknown>,
) {
  return authenticatedRequest<T>(session, "/api/owner/profile", {
    method: "PATCH",
    body,
  });
}

export function approveAgreement<T>(
  session: MobileSession,
  agreementId: string,
  body: Record<string, unknown>,
) {
  return authenticatedRequest<T>(session, `/api/agreements/${encodeURIComponent(agreementId)}/approval`, {
    method: "PATCH",
    body,
  });
}

export function resetAccountPassword<T>(
  session: MobileSession,
  accountType: "OWNER" | "TENANT",
  mobileNumber: string,
  password: string,
) {
  return authenticatedRequest<T>(session, "/api/admin/accounts/password", {
    method: "POST",
    body: { accountType, mobileNumber, password },
  });
}

export async function shareAgreementPdf(
  session: MobileSession,
  agreementId: string,
  agreementNumber: string,
) {
  const baseUrl = await readApiBaseUrl();
  if (!baseUrl) {
    throw new Error("Set the Rent-Sync server address before sharing this agreement.");
  }
  if (!(await Sharing.isAvailableAsync())) {
    throw new Error("Agreement sharing is not available on this device.");
  }
  const filename = `${agreementNumber.replace(/[^A-Za-z0-9_-]/g, "") || "rental-agreement"}.pdf`;
  const destination = new File(Paths.cache, filename);
  const file = await File.downloadFileAsync(
    `${baseUrl}/api/owner/agreements/${encodeURIComponent(agreementId)}/pdf`,
    destination,
    {
      idempotent: true,
      headers: {
        Authorization: `Bearer ${session.token}`,
        "x-rent-sync-client": "mobile",
      },
    },
  );
  await Sharing.shareAsync(file.uri, {
    mimeType: "application/pdf",
    dialogTitle: "Share rental agreement",
    UTI: "com.adobe.pdf",
  });
}
