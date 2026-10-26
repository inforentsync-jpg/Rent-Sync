"use client";

import Link from "next/link";
import Image from "next/image";
import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import {
  Building2,
  BookOpenText,
  Clock3,
  ChevronLeft,
  ChevronRight,
  FileDown,
  FileText,
  Home,
  Menu,
  Plus,
  UserRound,
  Users,
  X,
} from "lucide-react";
import { addElevenMonthTerm, getAgreementStatus, type AgreementStatus } from "@/lib/rental-agreement";
import AgreementFacts from "@/components/agreement-facts";
import AgreementApprovalWizard, {
  type ReviewableAgreement,
} from "@/components/agreement-approval-wizard";

type Company = { id: string; name: string };
type Building = {
  id: string;
  companyId?: string | null;
  name: string;
  address: string;
  city: string;
  state: string;
  postalCode: string;
};
type TermItem = { id: string; position: number; text: string; importantObligation: boolean };
type TermTemplate = {
  id: string;
  name: string;
  items: TermItem[];
  assetIds: string[];
};
type AgreementTermGroup = {
  templateId: string;
  heading: string;
  items: TermItem[];
};
type Asset = {
  id: string;
  buildingId: string;
  name: string;
  assetType: string;
  unitNumber: string;
  monthlyRent: number;
  securityDeposit: number;
  externalBuildingId?: string | null;
  ward?: string | null;
  roomNumber?: string | null;
  ksmartBuildingId?: string | null;
  ksrbId?: string | null;
};
type Tenant = {
  id: string;
  fullName: string;
  mobileNumber: string | null;
  businessName?: string | null;
  fullAddress?: string | null;
  aadhaarNumber?: string | null;
  fatherName?: string | null;
  email?: string | null;
  photoDataUrl?: string | null;
  publicShareEnabled?: boolean;
  assetIds: string[];
};
type Agreement = {
  id: string;
  agreementNumber: string;
  assetId: string;
  tenantId: string;
  startDate: string;
  endDate: string;
  monthlyRent: number;
  securityDeposit?: number;
  terms?: string;
  importantTerms?: string;
  templateTerms?: AgreementTermGroup[];
  status?: string;
  agreementYear?: number;
  ownerApprovedAt?: string | null;
  tenantApprovedAt?: string | null;
  createdAt: string;
};
type ArchivedAgreement = {
  id: string;
  originalAgreementId: string;
  agreementNumber: string;
  agreementYear: number;
  startDate: string;
  endDate: string;
  monthlyRent: number;
  securityDeposit: number;
  terms: string;
  importantTerms: string;
  status: string;
  ownerApprovedAt: string | null;
  tenantApprovedAt: string | null;
  tenantName: string;
  tenantMobileNumber: string | null;
  assetName: string;
  assetType: string;
  unitNumber: string;
  buildingName: string;
  buildingAddress: string;
  city: string;
  state: string;
  templateTerms: AgreementTermGroup[];
  createdAt: string;
  archivedAt: string;
};
type Portfolio = {
  companies: Company[];
  buildings: Building[];
  assets: Asset[];
  tenants: Tenant[];
  agreements: Agreement[];
  deletedAgreements: ArchivedAgreement[];
  termsTemplates: TermTemplate[];
};
type FormKind = "company" | "building" | "asset" | "tenant" | "agreement";
type ModuleKey = "companies" | "buildings" | "assets" | "tenants" | "agreements" | "terms" | "deleted-agreements";
type AgreementTab = "kyc" | "rent" | "expiry" | "advance" | "terms" | "important-terms";
type TenantTab = "kyc" | "assets" | "agreements";

const tenantTabs: Array<{ id: TenantTab; label: string }> = [
  { id: "kyc", label: "KYC" },
  { id: "assets", label: "Assets" },
  { id: "agreements", label: "Agreements" },
];

const agreementTabs: Array<{ id: AgreementTab; label: string }> = [
  { id: "kyc", label: "KYC" },
  { id: "rent", label: "Rent" },
  { id: "expiry", label: "Expiry" },
  { id: "advance", label: "Advance" },
  { id: "terms", label: "Terms" },
  { id: "important-terms", label: "Important Terms" },
];
const moduleKeys: ModuleKey[] = ["companies", "buildings", "assets", "tenants", "agreements", "terms", "deleted-agreements"];

function isModuleKey(value: string | null): value is ModuleKey {
  return value !== null && moduleKeys.includes(value as ModuleKey);
}

function subscribeToDashboardRoute(callback: () => void) {
  window.addEventListener("popstate", callback);
  window.addEventListener("rent-sync-route-change", callback);
  return () => {
    window.removeEventListener("popstate", callback);
    window.removeEventListener("rent-sync-route-change", callback);
  };
}

function getDashboardRouteState() {
  return `${window.location.pathname}${window.location.search}`;
}

const emptyPortfolio: Portfolio = {
  companies: [],
  buildings: [],
  assets: [],
  tenants: [],
  agreements: [],
  deletedAgreements: [],
  termsTemplates: [],
};

const formLabels: Record<FormKind, string> = {
  company: "Add company",
  building: "Add building",
  asset: "Add rentable asset",
  tenant: "Add tenant",
  agreement: "Add rental agreement",
};

function getLocalDateInputValue() {
  const today = new Date();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `${today.getFullYear()}-${month}-${day}`;
}

function shortDate(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value.slice(0, 10)
    : date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

export default function OwnerDashboard() {
  const routeState = useSyncExternalStore(
    subscribeToDashboardRoute,
    getDashboardRouteState,
    () => "",
  );
  const routeUrl = new URL(routeState || "/owner/dashboard", "http://localhost");
  const routeParams = routeUrl.searchParams;
  const agreementYearMatch = routeUrl.pathname.match(
    /^\/owner\/dashboard\/agreements\/(\d{4})\/?$/,
  );
  const routeModule = agreementYearMatch ? "agreements" : routeParams.get("module");
  const selectedModule: ModuleKey = isModuleKey(routeModule) ? routeModule : "companies";
  const approvalModule = routeModule === "approve-agreements";
  const selectedRecordId = routeParams.get("id");
  const selectedAgreementYear = agreementYearMatch?.[1] ?? null;
  const [portfolio, setPortfolio] = useState(emptyPortfolio);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [deletingRecordId, setDeletingRecordId] = useState<string | null>(null);
  const [recordSelection, setRecordSelection] = useState<{ scope: string; ids: string[] }>({
    scope: "",
    ids: [],
  });
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [formKind, setFormKind] = useState<FormKind | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [mobileMenu, setMobileMenu] = useState(false);
  const [recordEditMode, setRecordEditMode] = useState(false);
  const [assetEditForm, setAssetEditForm] = useState<Record<string, string>>({});
  const [assetEditError, setAssetEditError] = useState("");
  const [assetEditSaving, setAssetEditSaving] = useState(false);
  const [recordEditForm, setRecordEditForm] = useState<Record<string, string>>({});
  const [recordEditError, setRecordEditError] = useState("");
  const [recordEditSaving, setRecordEditSaving] = useState(false);
  const [agreementTab, setAgreementTab] = useState<AgreementTab>("kyc");
  const [reviewingAgreementId, setReviewingAgreementId] = useState<string | null>(null);
  const [tenantTab, setTenantTab] = useState<TenantTab>("kyc");
  const [tenantShareLink, setTenantShareLink] = useState<{ tenantId: string; url: string } | null>(null);
  const [tenantShareError, setTenantShareError] = useState<{ tenantId: string; message: string } | null>(null);
  const [tenantShareBusy, setTenantShareBusy] = useState(false);
  const [tenantShareCopiedFor, setTenantShareCopiedFor] = useState<string | null>(null);
  const selectionScope = `${selectedModule}:${selectedAgreementYear ?? "all"}`;
  const selectedRecordIds =
    recordSelection.scope === selectionScope ? recordSelection.ids : [];

  const loadPortfolio = useCallback(async () => {
    try {
      const response = await fetch("/api/owner/portfolio", { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Unable to load your portfolio.");
      setPortfolio({
        companies: payload.companies ?? [],
        buildings: payload.buildings ?? [],
        assets: payload.assets ?? [],
        tenants: payload.tenants ?? [],
        agreements: payload.agreements ?? [],
        deletedAgreements: payload.deletedAgreements ?? [],
        termsTemplates: payload.termsTemplates ?? [],
      });
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load your portfolio.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadPortfolio(), 0);
    return () => window.clearTimeout(timer);
  }, [loadPortfolio]);

  async function createTenantShareLink(tenantId: string) {
    setTenantShareBusy(true);
    setTenantShareError(null);
    setTenantShareLink(null);
    setTenantShareCopiedFor(null);
    try {
      const response = await fetch(`/api/owner/tenants/${encodeURIComponent(tenantId)}/share`, {
        method: "POST",
      });
      const payload = await response.json();
      if (!response.ok || typeof payload.token !== "string") {
        throw new Error(payload.error || "Unable to create a public tenant page.");
      }
      const publicOrigin = new URL(window.location.origin);
      if (["localhost", "127.0.0.1"].includes(publicOrigin.hostname)) {
        publicOrigin.port = "8081";
      }
      setTenantShareLink({
        tenantId,
        url: `${publicOrigin.origin}/tenent/${encodeURIComponent(payload.token)}`,
      });
      await loadPortfolio();
    } catch (cause) {
      setTenantShareError({
        tenantId,
        message: cause instanceof Error ? cause.message : "Unable to create a public tenant page.",
      });
    } finally {
      setTenantShareBusy(false);
    }
  }

  async function revokeTenantShareLink(tenantId: string) {
    setTenantShareBusy(true);
    setTenantShareError(null);
    setTenantShareLink(null);
    setTenantShareCopiedFor(null);
    try {
      const response = await fetch(`/api/owner/tenants/${encodeURIComponent(tenantId)}/share`, {
        method: "DELETE",
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Unable to disable the public tenant page.");
      await loadPortfolio();
    } catch (cause) {
      setTenantShareError({
        tenantId,
        message: cause instanceof Error ? cause.message : "Unable to disable the public tenant page.",
      });
    } finally {
      setTenantShareBusy(false);
    }
  }

  async function copyTenantShareLink() {
    if (!tenantShareLink || tenantShareLink.tenantId !== selectedRecordId) return;
    try {
      await navigator.clipboard.writeText(tenantShareLink.url);
      setTenantShareCopiedFor(tenantShareLink.tenantId);
      setTenantShareError(null);
    } catch {
      setTenantShareError({ tenantId: tenantShareLink.tenantId, message: "Unable to copy the link. Select and copy the URL shown below." });
    }
  }

  function openForm(kind: FormKind) {
    setFormKind(kind);
    setForm(kind === "agreement"
      ? {
          assetId: portfolio.assets.length === 1 ? portfolio.assets[0].id : "",
          tenantId: portfolio.assets.length === 1
            ? portfolio.tenants.find((tenant) => tenant.assetIds.includes(portfolio.assets[0].id))?.id ?? ""
            : "",
          startDate: `${new Date().getFullYear() + 1}-01-01`,
        }
      : kind === "building" && portfolio.companies.length === 1
      ? { companyId: portfolio.companies[0].id }
      : kind === "asset" && portfolio.buildings.length === 1
        ? { buildingId: portfolio.buildings[0].id }
        : kind === "tenant" && portfolio.assets.length === 1
        ? {
            assetId: portfolio.assets[0].id,
            startDate: getLocalDateInputValue(),
          }
        : kind === "tenant"
          ? {}
        : {});
    setFormError("");
  }

  async function saveItem(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!formKind) return;
    setSaving(true);
    setFormError("");
    const body: Record<string, unknown> = { ...form, kind: formKind };
    if (formKind === "asset") {
      body.monthlyRent = Number(form.monthlyRent);
      body.securityDeposit = Number(form.securityDeposit || "0");
    }
    if (formKind === "agreement") {
      body.endDate = form.startDate ? addElevenMonthTerm(form.startDate) : null;
    }
    try {
      const response = await fetch("/api/owner/portfolio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Unable to save.");
      setFormKind(null);
      setForm({});
      await loadPortfolio();
    } catch (cause) {
      setFormError(cause instanceof Error ? cause.message : "Unable to save this item.");
    } finally {
      setSaving(false);
    }
  }

  const selectedDetail: {
    title: string;
    actionLabel?: string;
    formKind?: FormKind;
    empty: string;
    columns: string[];
    rows: Array<{ key: string; cells: Array<{ value: string; className?: string; badge?: boolean; status?: AgreementStatus | null }> }>;
  } = {
    companies: {
      title: "Companies",
      actionLabel: "Add company",
      formKind: "company" as const,
      empty: "No companies yet.",
      columns: ["Company", "Buildings", "Assets"],
      rows: portfolio.companies.map((company) => {
        const companyBuildings = portfolio.buildings.filter((building) => building.companyId === company.id);
        const buildingIds = new Set(companyBuildings.map((building) => building.id));
        const assetCount = portfolio.assets.filter((asset) => buildingIds.has(asset.buildingId)).length;
        return {
          key: company.id,
          cells: [
            { value: company.name, className: "font-semibold text-[#203328]" },
            { value: String(companyBuildings.length) },
            { value: String(assetCount) },
          ],
        };
      }),
    },
    buildings: {
      title: "Buildings",
      actionLabel: "Add building",
      formKind: "building" as const,
      empty: "No buildings yet.",
      columns: ["Building", "Company", "Location", "Assets", "Tenants", "Total rent / month", "Total advance"],
      rows: portfolio.buildings.map((building) => {
        const buildingAssets = portfolio.assets.filter((asset) => asset.buildingId === building.id);
        const assignedTenantIds = new Set(
          portfolio.tenants
            .filter((tenant) => tenant.assetIds.some((assetId) => buildingAssets.some((asset) => asset.id === assetId)))
            .map((tenant) => tenant.id),
        );
        const company = portfolio.companies.find((entry) => entry.id === building.companyId);
        const buildingTotals = buildingAssets.reduce(
          (totals, asset) => ({
            monthlyRent: totals.monthlyRent + asset.monthlyRent,
            advance: totals.advance + asset.securityDeposit,
          }),
          { monthlyRent: 0, advance: 0 },
        );
        return {
          key: building.id,
          cells: [
            { value: building.name, className: "font-semibold text-[#203328]" },
            { value: company?.name ?? "—" },
            { value: [building.address, building.city, building.state, building.postalCode].filter(Boolean).join(", ") || "—" },
            { value: String(buildingAssets.length) },
            { value: String(assignedTenantIds.size) },
            { value: `₹${buildingTotals.monthlyRent.toLocaleString("en-IN")}`, className: "font-semibold text-[#234b34]" },
            { value: `₹${buildingTotals.advance.toLocaleString("en-IN")}`, className: "font-semibold text-[#234b34]" },
          ],
        };
      }),
    },
    assets: {
      title: "Assets",
      actionLabel: "Add asset",
      formKind: "asset" as const,
      empty: "No assets yet.",
      columns: ["Asset ID", "Building name", "Rent / month", "Advance", "Current tenant"],
      rows: portfolio.assets.map((asset) => {
        const building = portfolio.buildings.find((entry) => entry.id === asset.buildingId);
        const tenant = portfolio.tenants.find((entry) => entry.assetIds.includes(asset.id));
        return {
          key: asset.id,
          cells: [
            { value: asset.unitNumber, className: "font-semibold text-[#203328]" },
            { value: building?.name ?? "—" },
            { value: `₹${asset.monthlyRent.toLocaleString("en-IN")}` },
            { value: `₹${asset.securityDeposit.toLocaleString("en-IN")}` },
            { value: tenant?.fullName ?? "Vacant", className: tenant ? "" : "text-[#849188]" },
          ],
        };
      }),
    },
    tenants: {
      title: "Tenants",
      actionLabel: "Add tenant",
      formKind: "tenant" as const,
      empty: "No tenants yet.",
      columns: ["Tenant", "Phone", "Assigned assets", "Agreements"],
      rows: portfolio.tenants.map((tenant) => ({
        key: tenant.id,
        cells: [
          { value: tenant.fullName, className: "font-semibold text-[#203328]" },
          { value: tenant.mobileNumber ? `+${tenant.mobileNumber}` : "Phone not provided" },
          { value: tenant.assetIds.map((assetId) => {
            const asset = portfolio.assets.find((entry) => entry.id === assetId);
            return asset ? asset.unitNumber : null;
          }).filter(Boolean).join(", ") || "None" },
          { value: String(portfolio.agreements.filter((agreement) => agreement.tenantId === tenant.id).length) },
        ],
      })),
    },
    agreements: {
      title: "Agreements",
      actionLabel: "Add agreement",
      formKind: "agreement" as const,
      empty: "No agreements yet.",
      columns: ["Year", "Tenant", "Status", "Asset", "Rent / month", "Advance", "PDF"],
      rows: portfolio.agreements.map((agreement) => {
        const tenant = portfolio.tenants.find((entry) => entry.id === agreement.tenantId);
        const asset = portfolio.assets.find((entry) => entry.id === agreement.assetId);
        const status = agreement.status === "DRAFT"
          ? agreement.ownerApprovedAt ? "Awaiting tenant approval" : "Awaiting owner approval"
          : agreement.ownerApprovedAt && agreement.tenantApprovedAt
            ? "Approved"
            : getAgreementStatus(agreement.endDate);
        return {
          key: agreement.id,
          cells: [
            { value: getAgreementYear(agreement.startDate), className: "font-semibold text-[#176b4b]" },
            { value: tenant?.fullName ?? "Tenant", className: "font-semibold text-[#203328]" },
            { value: status ?? "—", badge: true, status },
            { value: asset ? `${asset.name} · ${asset.unitNumber}` : "—" },
            { value: `₹${agreement.monthlyRent.toLocaleString("en-IN")}` },
            { value: `₹${(agreement.securityDeposit ?? 0).toLocaleString("en-IN")}` },
            { value: "" },
          ],
        };
      }),
    },
    "deleted-agreements": {
      title: "Deleted agreements",
      empty: "Archived agreements will appear here.",
      columns: ["Agreement", "Tenant", "Asset", "Rental period", "Status", "Rent / month", "Archived"],
      rows: portfolio.deletedAgreements.map((agreement) => ({
        key: agreement.id,
        cells: [
          { value: agreement.agreementNumber, className: "font-semibold text-[#203328]" },
          { value: agreement.tenantName },
          { value: `${agreement.assetName} · ${agreement.unitNumber}` },
          { value: `${shortDate(agreement.startDate)} – ${shortDate(agreement.endDate)}` },
          { value: agreement.status },
          { value: `₹${agreement.monthlyRent.toLocaleString("en-IN")}` },
          { value: shortDate(agreement.archivedAt) },
        ],
      })),
    },
    terms: {
      title: "Terms",
      empty: "Create reusable terms for your properties.",
      columns: ["Main heading", "Terms", "Mapped assets"],
      rows: portfolio.termsTemplates.map((template) => ({
        key: template.id,
        cells: [
          { value: template.name, className: "font-semibold text-[#203328]" },
          { value: String(template.items.length) },
          { value: String(template.assetIds.length) },
        ],
      })),
    },
  }[selectedModule];
  const pendingOwnerApprovals = portfolio.agreements.filter(
    (agreement) => agreement.status === "DRAFT" && !agreement.ownerApprovedAt,
  );
  const agreementYears = [...new Set(
    portfolio.agreements.map((agreement) => getAgreementYear(agreement.startDate)),
  )].sort((left, right) => Number(right) - Number(left));
  const displayRows =
    selectedModule === "agreements" && selectedAgreementYear !== null
      ? selectedDetail.rows.filter((row) => row.cells[0]?.value === selectedAgreementYear)
      : selectedDetail.rows;
  const visibleRecordIds = displayRows.map((row) => row.key);
  const allVisibleRecordsSelected =
    visibleRecordIds.length > 0 &&
    visibleRecordIds.every((id) => selectedRecordIds.includes(id));
  const selectedVisibleRecordIds = selectedRecordIds.filter((id) => visibleRecordIds.includes(id));
  const buildingAssetTotals = portfolio.assets.reduce(
    (totals, asset) => ({
      monthlyRent: totals.monthlyRent + asset.monthlyRent,
      advance: totals.advance + asset.securityDeposit,
    }),
    { monthlyRent: 0, advance: 0 },
  );

  function syncModuleUrl(
    module: ModuleKey,
    recordId: string | null = null,
    year?: string | null,
  ) {
    setDeleteError("");
    const targetYear =
      module === "agreements" ? year ?? (recordId ? selectedAgreementYear : null) : null;
    setRecordSelection({
      scope: `${module}:${targetYear ?? "all"}`,
      ids: [],
    });
    const params = new URLSearchParams(window.location.search);
    params.set("module", module);
    if (recordId) {
      params.set("id", recordId);
    } else {
      params.delete("id");
    }
    params.delete("year");
    let pathname = window.location.pathname;
    if (module !== "agreements" || year === null || (recordId === null && year === undefined)) {
      pathname = "/owner/dashboard";
    } else if (year) {
      pathname = `/owner/dashboard/agreements/${year}`;
    }
    const nextUrl = `${pathname}?${params.toString()}`;
    window.history.pushState({}, "", nextUrl);
    window.dispatchEvent(new Event("rent-sync-route-change"));
  }

  function handleSelectModule(module: ModuleKey) {
    syncModuleUrl(module);
  }

  function toggleVisibleSelection() {
    setRecordSelection((selection) => {
      const current = selection.scope === selectionScope ? selection.ids : [];
      if (allVisibleRecordsSelected) {
        return {
          scope: selectionScope,
          ids: current.filter((id) => !visibleRecordIds.includes(id)),
        };
      }
      return {
        scope: selectionScope,
        ids: [...new Set([...current, ...visibleRecordIds])],
      };
    });
  }

  function toggleRecordSelection(recordId: string) {
    setRecordSelection((selection) => {
      const current = selection.scope === selectionScope ? selection.ids : [];
      return {
        scope: selectionScope,
        ids: current.includes(recordId)
          ? current.filter((id) => id !== recordId)
          : [...current, recordId],
      };
    });
  }

  function openApprovalQueue() {
    setDeleteError("");
    const params = new URLSearchParams(window.location.search);
    params.set("module", "approve-agreements");
    params.delete("id");
    window.history.pushState({}, "", `/owner/dashboard?${params.toString()}`);
    window.dispatchEvent(new Event("rent-sync-route-change"));
    setMobileMenu(false);
  }

  function openAgreementReview(agreementId: string) {
    setReviewingAgreementId(agreementId);
  }

  function handleEditRecord(recordId: string) {
    setRecordEditMode(false);
    syncModuleUrl(selectedModule, recordId);
  }

  function startRecordEdit() {
    if (selectedModule === "assets" && selectedRecordId) {
      const asset = portfolio.assets.find((entry) => entry.id === selectedRecordId);
      if (asset) {
        setAssetEditForm({
          buildingId: asset.buildingId,
          name: asset.name,
          assetType: asset.assetType,
          unitNumber: asset.unitNumber,
          monthlyRent: String(asset.monthlyRent),
          securityDeposit: String(asset.securityDeposit),
          externalBuildingId: asset.externalBuildingId ?? "",
          ward: asset.ward ?? "",
          roomNumber: asset.roomNumber ?? "",
          ksmartBuildingId: asset.ksmartBuildingId ?? "",
          ksrbId: asset.ksrbId ?? "",
        });
        setAssetEditError("");
      }
    } else if (selectedModule === "companies" && selectedCompany) {
      setRecordEditForm({ name: selectedCompany.name });
    } else if (selectedModule === "buildings" && selectedBuilding) {
      setRecordEditForm({
        companyId: selectedBuilding.companyId ?? "",
        name: selectedBuilding.name,
        address: selectedBuilding.address,
        city: selectedBuilding.city,
        state: selectedBuilding.state,
        postalCode: selectedBuilding.postalCode,
      });
    } else if (selectedModule === "tenants" && selectedTenant) {
      setRecordEditForm({
        fullName: selectedTenant.fullName,
        mobileNumber: selectedTenant.mobileNumber ?? "",
        businessName: selectedTenant.businessName ?? "",
        fullAddress: selectedTenant.fullAddress ?? "",
        aadhaarNumber: selectedTenant.aadhaarNumber ?? "",
        fatherName: selectedTenant.fatherName ?? "",
        email: selectedTenant.email ?? "",
        photoDataUrl: selectedTenant.photoDataUrl ?? "",
      });
    }
    setRecordEditError("");
    setRecordEditMode(true);
  }

  async function saveRecordEdits() {
    if (!selectedRecordId) return;
    const kind = selectedModule === "companies" ? "company"
      : selectedModule === "buildings" ? "building"
        : selectedModule === "tenants" ? "tenant" : null;
    if (!kind) return;
    setRecordEditSaving(true);
    setRecordEditError("");
    try {
      const response = await fetch("/api/owner/portfolio", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...recordEditForm, kind, id: selectedRecordId }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Unable to save these changes.");
      await loadPortfolio();
      setRecordEditMode(false);
    } catch (cause) {
      setRecordEditError(cause instanceof Error ? cause.message : "Unable to save these changes.");
    } finally {
      setRecordEditSaving(false);
    }
  }

  async function saveAssetEdits() {
    if (!selectedRecordId) return;
    setAssetEditSaving(true);
    setAssetEditError("");
    try {
      const response = await fetch("/api/owner/portfolio", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...assetEditForm,
          kind: "asset",
          id: selectedRecordId,
          monthlyRent: Number(assetEditForm.monthlyRent),
          securityDeposit: Number(assetEditForm.securityDeposit || "0"),
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Unable to update asset.");
      await loadPortfolio();
      setRecordEditMode(false);
    } catch (cause) {
      setAssetEditError(cause instanceof Error ? cause.message : "Unable to update asset.");
    } finally {
      setAssetEditSaving(false);
    }
  }

  async function handleDeleteRecord(recordId: string) {
    if (deletingRecordId || bulkDeleting || selectedModule === "terms" || selectedModule === "deleted-agreements") return;

    const kindByModule: Partial<Record<ModuleKey, string>> = {
      companies: "company",
      buildings: "building",
      assets: "asset",
      tenants: "tenant",
      agreements: "agreement",
    };
    const recordName =
      portfolio.companies.find((record) => record.id === recordId)?.name ??
      portfolio.buildings.find((record) => record.id === recordId)?.name ??
      portfolio.assets.find((record) => record.id === recordId)?.name ??
      portfolio.tenants.find((record) => record.id === recordId)?.fullName ??
      portfolio.agreements.find((record) => record.id === recordId)?.agreementNumber ??
      "this record";
    const deleteGuidance: Record<ModuleKey, string> = {
      agreements: "This moves the agreement and its approval and terms snapshot to Deleted agreements. Its tenant and property stay, and this agreement year will not be generated again.",
      tenants: "Tenants with agreements cannot be deleted. Archive their agreements first; the archived history remains available in Deleted agreements.",
      assets: "Units with agreements or assigned tenants cannot be deleted. Archive their agreements first; the archived history remains available in Deleted agreements.",
      buildings: "Delete this property’s units first.",
      companies: "Move or delete this company’s properties first.",
      terms: "Remove this heading from the Terms module.",
      "deleted-agreements": "Archived agreements are read-only and cannot be deleted.",
    };
    const kind = kindByModule[selectedModule];
    if (!kind) return;
    const action = selectedModule === "agreements" ? "Archive" : "Delete";
    if (!window.confirm(`${action} ${kind} “${recordName}”?\n\n${deleteGuidance[selectedModule]}${selectedModule === "agreements" ? "" : "\n\nThis cannot be undone."}`)) {
      return;
    }

    setDeletingRecordId(recordId);
    setDeleteError("");
    try {
      const response = await fetch("/api/owner/portfolio", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, id: recordId }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(
          payload && typeof payload === "object" && "error" in payload && typeof payload.error === "string"
            ? payload.error
            : `Unable to delete ${kind}.`,
        );
      }
      await loadPortfolio();
      if (selectedRecordId === recordId) syncModuleUrl(selectedModule);
    } catch (cause) {
      setDeleteError(cause instanceof Error ? cause.message : `Unable to delete ${kind}.`);
    } finally {
      setDeletingRecordId(null);
    }
  }

  async function handleBulkDelete() {
    if (deletingRecordId || bulkDeleting || selectedVisibleRecordIds.length === 0 || selectedModule === "terms") return;

    const kindByModule: Partial<Record<ModuleKey, FormKind>> = {
      companies: "company",
      buildings: "building",
      assets: "asset",
      tenants: "tenant",
      agreements: "agreement",
    };
    const deleteGuidance: Record<ModuleKey, string> = {
      agreements: "This moves the selected agreements and their approval and terms snapshots to Deleted agreements. Tenants and properties stay, and those agreement years will not be generated again.",
      tenants: "Tenants with agreements stay in place. Archive their agreements first; their history remains available in Deleted agreements.",
      assets: "Units with agreements or assigned tenants cannot be deleted.",
      buildings: "Properties with units cannot be deleted.",
      companies: "Companies with properties cannot be deleted.",
      terms: "Remove terms from the Terms module.",
      "deleted-agreements": "Archived agreements are read-only and cannot be deleted.",
    };
    const kind = kindByModule[selectedModule];
    if (!kind) return;
    const count = selectedVisibleRecordIds.length;
    if (!window.confirm(
      `${selectedModule === "agreements" ? "Archive" : "Delete"} ${count} selected ${kind}${count === 1 ? "" : "s"}?\n\n${deleteGuidance[selectedModule]}${selectedModule === "agreements" ? "" : "\n\nIf any selected record cannot be deleted, none will be removed. This cannot be undone."}`,
    )) {
      return;
    }

    setBulkDeleting(true);
    setDeleteError("");
    try {
      const response = await fetch("/api/owner/portfolio", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, ids: selectedVisibleRecordIds }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(
          payload && typeof payload === "object" && "error" in payload && typeof payload.error === "string"
            ? payload.error
            : `Unable to delete selected ${kind} records.`,
        );
      }
      setRecordSelection({ scope: selectionScope, ids: [] });
      await loadPortfolio();
      if (selectedRecordId && selectedVisibleRecordIds.includes(selectedRecordId)) {
        syncModuleUrl(selectedModule);
      }
    } catch (cause) {
      setDeleteError(cause instanceof Error ? cause.message : `Unable to delete selected ${kind} records.`);
    } finally {
      setBulkDeleting(false);
    }
  }

  const selectedRecord = (() => {
    if (!selectedRecordId) return null;
    switch (selectedModule) {
      case "companies":
        return portfolio.companies.find((record) => record.id === selectedRecordId) ?? null;
      case "buildings":
        return portfolio.buildings.find((record) => record.id === selectedRecordId) ?? null;
      case "assets":
        return portfolio.assets.find((record) => record.id === selectedRecordId) ?? null;
      case "tenants":
        return portfolio.tenants.find((record) => record.id === selectedRecordId) ?? null;
      case "terms":
        return null;
      case "deleted-agreements":
        return portfolio.deletedAgreements.find((record) => record.id === selectedRecordId) ?? null;
      default:
        return portfolio.agreements.find((record) => record.id === selectedRecordId) ?? null;
    }
  })();
  const selectedAgreement =
    selectedModule === "agreements" && selectedRecord
      ? portfolio.agreements.find((agreement) => agreement.id === selectedRecordId) ?? null
      : null;
  const selectedArchivedAgreement =
    selectedModule === "deleted-agreements" && selectedRecord
      ? portfolio.deletedAgreements.find((agreement) => agreement.id === selectedRecordId) ?? null
      : null;
  const selectedAgreementAsset = selectedAgreement
    ? portfolio.assets.find((asset) => asset.id === selectedAgreement.assetId)
    : null;
  const selectedAgreementBuilding = selectedAgreementAsset
    ? portfolio.buildings.find((building) => building.id === selectedAgreementAsset.buildingId)
    : null;
  const selectedAgreementTenant = selectedAgreement
    ? portfolio.tenants.find((tenant) => tenant.id === selectedAgreement.tenantId)
    : null;
  const selectedAsset =
    selectedModule === "assets" && selectedRecord
      ? portfolio.assets.find((asset) => asset.id === selectedRecordId) ?? null
      : null;
  const selectedAssetBuilding = selectedAsset
    ? portfolio.buildings.find((building) => building.id === selectedAsset.buildingId)
    : null;
  const selectedAssetTenant = selectedAsset
    ? portfolio.tenants.find((tenant) => tenant.assetIds.includes(selectedAsset.id))
    : null;
  const selectedCompany =
    selectedModule === "companies" && selectedRecord
      ? portfolio.companies.find((company) => company.id === selectedRecordId) ?? null
      : null;
  const selectedBuilding =
    selectedModule === "buildings" && selectedRecord
      ? portfolio.buildings.find((building) => building.id === selectedRecordId) ?? null
      : null;
  const selectedTenant =
    selectedModule === "tenants" && selectedRecord
      ? portfolio.tenants.find((tenant) => tenant.id === selectedRecordId) ?? null
      : null;
  const selectedTenantAgreements = selectedTenant
    ? portfolio.agreements.filter((agreement) => agreement.tenantId === selectedTenant.id)
    : [];
  const selectedTenantAssets = selectedTenant
    ? portfolio.assets.filter((asset) => selectedTenant.assetIds.includes(asset.id))
    : [];

  function handleOpenAgreement(agreementId: string) {
    syncModuleUrl("agreements", agreementId);
  }

  function handleOpenAsset(assetId: string) {
    syncModuleUrl("assets", assetId);
  }

  return (
    <div className="min-h-screen bg-[#f4f6f3] text-[#16251d]">
      <aside className={`fixed inset-y-0 left-0 z-30 flex w-[258px] flex-col bg-[#123d2c] text-white transition-transform duration-200 lg:translate-x-0 ${mobileMenu ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="flex h-[76px] items-center justify-between border-b border-white/10 px-6">
          <a href="/owner/dashboard" className="flex items-center gap-3">
            <span className="grid size-9 place-items-center rounded-xl bg-[#e5f0e7] text-[#176b4b]"><Building2 size={19} /></span>
            <span className="text-[18px] font-bold tracking-[-0.06em]">rent<span className="text-[#9bd0ad]">sync</span></span>
          </a>
          <button type="button" aria-label="Close menu" onClick={() => setMobileMenu(false)} className="lg:hidden"><X size={18} /></button>
        </div>
        <nav className="mt-6 flex-1 px-4">
          {[
            { key: "companies", label: "Companies", icon: Building2 },
            { key: "buildings", label: "Buildings", icon: Home },
            { key: "assets", label: "Assets", icon: FileText },
            { key: "tenants", label: "Tenants", icon: Users },
            { key: "agreements", label: "Agreements", icon: FileText },
            { key: "deleted-agreements", label: "Deleted agreements", icon: Clock3 },
            { key: "terms", label: "Terms", icon: BookOpenText },
          ].map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              type="button"
              onClick={() => handleSelectModule(key as ModuleKey)}
              className={`mt-2 flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-[12px] font-medium transition ${!approvalModule && selectedModule === key ? "bg-[#e9f3eb] text-[#154b34]" : "text-white/70 hover:bg-white/[0.07] hover:text-white"}`}
            >
              <Icon size={16} /> {label}
            </button>
          ))}
          {pendingOwnerApprovals.length > 0 ? (
            <button
              type="button"
              onClick={openApprovalQueue}
              className={`mt-2 flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-[12px] font-medium transition ${approvalModule ? "bg-[#e9f3eb] text-[#154b34]" : "text-white/70 hover:bg-white/[0.07] hover:text-white"}`}
            >
              <FileText size={16} /> Approve agreements
              <span className="ml-auto rounded-full bg-white/15 px-2 py-0.5 text-[9px]">{pendingOwnerApprovals.length}</span>
            </button>
          ) : null}
        </nav>
        <div className="border-t border-white/10 p-4">
          <a href="/owner/profile" onClick={() => setMobileMenu(false)} className="mb-2 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[11px] text-white/65 transition hover:bg-white/[0.07] hover:text-white"><UserRound size={15} /> Profile</a>
        </div>
      </aside>

      {mobileMenu ? <button type="button" aria-label="Close sidebar" onClick={() => setMobileMenu(false)} className="fixed inset-0 z-20 bg-black/30 lg:hidden" /> : null}

      <div className="min-h-screen lg:pl-[258px]">
        <header className="sticky top-0 z-10 flex h-[70px] items-center justify-between border-b border-[#e6ebe6] bg-white/90 px-5 backdrop-blur-md sm:px-8 lg:px-10">
          <div className="flex items-center gap-3">
            <button type="button" aria-label="Open menu" onClick={() => setMobileMenu(true)} className="grid size-9 place-items-center rounded-lg border border-[#e4eae5] text-[#53675a] lg:hidden"><Menu size={17} /></button>
            <h1 className="text-[16px] font-semibold tracking-[-0.03em] text-[#1b2c22]">Your property portfolio</h1>
          </div>
          <div className="flex items-center gap-2">
            <a href="/owner/profile" className="flex h-9 items-center gap-2 rounded-lg border border-[#e4eae5] bg-white px-3 text-[11px] font-medium text-[#315b41] transition hover:bg-[#f1f6f2]"><UserRound size={15} /><span>Profile</span></a>
          </div>
        </header>

        <main className="mx-auto max-w-[1450px] px-5 py-7 sm:px-8 sm:py-9 lg:px-10">
          {deleteError ? (
            <p role="alert" className="mb-5 rounded-xl border border-[#f1d9ce] bg-[#fff8f4] px-4 py-3 text-[12px] leading-5 text-[#995634]">
              {deleteError}
            </p>
          ) : null}
          {approvalModule ? (
            <section className="rounded-2xl border border-[#e7ece7] bg-white shadow-[0_4px_20px_-12px_rgba(28,53,37,0.12)]">
              <div className="border-b border-[#edf0ed] px-5 py-5 sm:px-6">
                <h2 className="text-[20px] font-semibold text-[#203328]">Approve agreements</h2>
                <p className="mt-1 text-[11px] text-[#819087]">Review each draft through KYC, Rent, Expiry, Advance, Terms and Important Terms before approving it.</p>
              </div>
              {pendingOwnerApprovals.length ? (
                <div className="divide-y divide-[#f0f2f0]">
                  {pendingOwnerApprovals.map((agreement) => {
                    const tenant = portfolio.tenants.find((entry) => entry.id === agreement.tenantId);
                    const asset = portfolio.assets.find((entry) => entry.id === agreement.assetId);
                    const building = asset
                      ? portfolio.buildings.find((entry) => entry.id === asset.buildingId)
                      : null;
                    return (
                      <article key={agreement.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                        <div>
                          <h3 className="text-[12px] font-semibold text-[#294034]">{tenant?.fullName ?? "Tenant"} · {agreement.agreementNumber}</h3>
                          <p className="mt-1 text-[10px] text-[#79867e]">{asset ? `${asset.name} · ${asset.unitNumber}` : "Property"}{building ? ` · ${building.name}` : ""} · ₹{agreement.monthlyRent.toLocaleString("en-IN")}/month</p>
                        </div>
                        <button type="button" onClick={() => openAgreementReview(agreement.id)} className="h-9 rounded-lg bg-[#176b4b] px-4 text-[10px] font-semibold text-white hover:bg-[#10583c]">
                          Review agreement
                        </button>
                      </article>
                    );
                  })}
                </div>
              ) : (
                <p className="px-5 py-8 text-[12px] text-[#849188]">There are no draft agreements awaiting owner approval.</p>
              )}
            </section>
          ) : selectedModule === "terms" ? (
            <OwnerTermsManager
              templates={portfolio.termsTemplates}
              selectedTemplateId={selectedRecordId}
              onSelectTemplate={(id) => syncModuleUrl("terms", id)}
              onBack={() => syncModuleUrl("terms")}
              onRefresh={loadPortfolio}
            />
          ) : selectedArchivedAgreement ? (
            <article className="overflow-hidden rounded-2xl border border-[#e7ece7] bg-white shadow-[0_4px_20px_-12px_rgba(28,53,37,0.12)]">
              <div className="flex flex-col justify-between gap-3 border-b border-[#edf0ed] px-5 py-4 sm:flex-row sm:items-center sm:px-6">
                <div>
                  <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-[#6b8a76]">Read-only archive · archived {shortDate(selectedArchivedAgreement.archivedAt)}</p>
                  <h2 className="mt-1 text-[20px] font-semibold tracking-[-0.04em] text-[#17271e]">{selectedArchivedAgreement.agreementNumber}</h2>
                  <p className="mt-1 text-[10px] text-[#718078]">{selectedArchivedAgreement.tenantName} · {selectedArchivedAgreement.assetName} · Unit {selectedArchivedAgreement.unitNumber}</p>
                </div>
                <button type="button" onClick={() => syncModuleUrl("deleted-agreements")} className="h-9 rounded-lg border border-[#dfe8e1] bg-[#f5f8f5] px-3 text-[10px] font-semibold text-[#355942]">Back to archive</button>
              </div>
              <div className="grid gap-4 p-5 sm:grid-cols-2 sm:p-6">
                <DetailField label="Agreement year" value={String(selectedArchivedAgreement.agreementYear)} />
                <DetailField label="Status when archived" value={selectedArchivedAgreement.status} />
                <DetailField label="Tenant" value={selectedArchivedAgreement.tenantName} />
                <DetailField label="Tenant mobile" value={selectedArchivedAgreement.tenantMobileNumber ? `+${selectedArchivedAgreement.tenantMobileNumber}` : "—"} />
                <DetailField label="Asset type" value={selectedArchivedAgreement.assetType} />
                <DetailField label="Building" value={selectedArchivedAgreement.buildingName} />
                <DetailField label="Building address" value={[selectedArchivedAgreement.buildingAddress, selectedArchivedAgreement.city, selectedArchivedAgreement.state].filter(Boolean).join(", ") || "—"} />
                <DetailField label="Start date" value={shortDate(selectedArchivedAgreement.startDate)} />
                <DetailField label="End date" value={shortDate(selectedArchivedAgreement.endDate)} />
                <DetailField label="Monthly rent" value={`₹${selectedArchivedAgreement.monthlyRent.toLocaleString("en-IN")}`} />
                <DetailField label="Security deposit" value={`₹${selectedArchivedAgreement.securityDeposit.toLocaleString("en-IN")}`} />
                <DetailField label="Owner approved" value={selectedArchivedAgreement.ownerApprovedAt ? shortDate(selectedArchivedAgreement.ownerApprovedAt) : "Not approved"} />
                <DetailField label="Tenant approved" value={selectedArchivedAgreement.tenantApprovedAt ? shortDate(selectedArchivedAgreement.tenantApprovedAt) : "Not approved"} />
                <DetailField label="Additional terms" value={selectedArchivedAgreement.terms || "—"} />
                <DetailField label="Additional important terms" value={selectedArchivedAgreement.importantTerms || "—"} />
              </div>
              <div className="border-t border-[#edf0ed] p-5 sm:p-6">
                <h3 className="text-[13px] font-semibold text-[#203328]">Mapped agreement terms</h3>
                {selectedArchivedAgreement.templateTerms.flatMap((group) => group.items).length ? (
                  <ol className="mt-3 space-y-2">
                    {selectedArchivedAgreement.templateTerms.flatMap((group) => group.items).map((item, index) => (
                      <li key={item.id} className="flex items-start gap-3 rounded-xl border border-[#e7ece7] bg-[#fbfcfb] p-3">
                        <span className="grid size-7 shrink-0 place-items-center rounded-full bg-[#e9f3eb] text-[10px] font-bold text-[#176b4b]">{index + 1}</span>
                        <span className="text-[11px] leading-5 text-[#53675a]">
                          {item.importantObligation ? <strong className="mb-1 block text-[9px] uppercase tracking-wide text-[#805b13]">Important obligation</strong> : null}
                          {item.text}
                        </span>
                      </li>
                    ))}
                  </ol>
                ) : <p className="mt-3 text-[11px] text-[#849188]">No mapped reusable terms were saved with this snapshot.</p>}
              </div>
            </article>
          ) : selectedAgreement && !recordEditMode ? (
            <article className="rounded-2xl border border-[#e7ece7] bg-white shadow-[0_4px_20px_-12px_rgba(28,53,37,0.12)]">
              <div className="flex flex-col justify-between gap-3 border-b border-[#edf0ed] px-5 py-4 sm:flex-row sm:items-center sm:px-6">
                <div>
                  <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-[#6b8a76]">Rental agreement</p>
                  <h2 className="mt-1 text-[20px] font-semibold tracking-[-0.04em] text-[#17271e]">{selectedAgreementTenant?.fullName ?? "Tenant not found"}</h2>
                  <p className="mt-1 text-[10px] font-semibold text-[#718078]">{selectedAgreement.agreementNumber}</p>
                  <div className="mt-2">
                    <AgreementStatusBadge
                      status={selectedAgreement.status === "DRAFT" ? "Draft" : getAgreementStatus(selectedAgreement.endDate)}
                    />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {selectedAgreement.status === "DRAFT" && !selectedAgreement.ownerApprovedAt ? (
                    <button type="button" onClick={() => openAgreementReview(selectedAgreement.id)} className="rounded-lg border border-[#dfe8e1] bg-[#f7faf7] px-3 py-2 text-[10px] font-semibold text-[#355942]">Review & approve</button>
                  ) : null}
                  <button type="button" onClick={() => void handleDeleteRecord(selectedAgreement.id)} disabled={deletingRecordId !== null} className="rounded-lg border border-[#f0d9d2] bg-[#fff8f7] px-3 py-2 text-[10px] font-semibold text-[#9a4a3d] disabled:cursor-not-allowed disabled:opacity-60">Archive</button>
                  <button
                    type="button"
                    onClick={() => syncModuleUrl("agreements", null, selectedAgreementYear)}
                    className="rounded-lg border border-[#dfe8e1] bg-[#f5f8f5] px-3 py-2 text-[10px] font-semibold text-[#355942]"
                  >
                    Back to agreements
                  </button>
                </div>
              </div>
              <div role="tablist" aria-label="Agreement sections" className="flex gap-2 overflow-x-auto border-b border-[#edf0ed] px-4 sm:gap-4 sm:px-6">
                {agreementTabs.map((tab) => (
                  <button
                    key={tab.id}
                    id={`agreement-tab-${tab.id}`}
                    type="button"
                    role="tab"
                    aria-selected={agreementTab === tab.id}
                    aria-controls="agreement-tab-panel"
                    onClick={() => setAgreementTab(tab.id)}
                    className={`shrink-0 border-b-2 px-3 py-4 text-[12px] font-semibold transition sm:px-4 ${agreementTab === tab.id ? "border-[#176b4b] text-[#176b4b]" : "border-transparent text-[#849188] hover:text-[#355942]"}`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
              <div id="agreement-tab-panel" role="tabpanel" aria-labelledby={`agreement-tab-${agreementTab}`} className="grid gap-5 p-6 sm:grid-cols-2 sm:gap-6 sm:p-8 lg:p-10">
                {agreementTab === "kyc" ? <>
                  <div className="sm:col-span-2">
                    <TabPanelHeading title="Tenant and property details" description="The people and property covered by this agreement." />
                  </div>
                  <DetailField label="Tenant" value={selectedAgreementTenant?.fullName ?? "Tenant not found"} />
                  <DetailField label="Tenant mobile" value={selectedAgreementTenant?.mobileNumber ? `+${selectedAgreementTenant.mobileNumber}` : "Phone not provided"} />
                  <DetailField label="Asset" value={selectedAgreementAsset ? `${selectedAgreementAsset.name} · Unit ${selectedAgreementAsset.unitNumber}` : "Asset not found"} />
                  <DetailField label="Building" value={selectedAgreementBuilding?.name ?? "—"} />
                  <DetailField label="Property address" value={selectedAgreementBuilding ? `${selectedAgreementBuilding.address}, ${selectedAgreementBuilding.city}, ${selectedAgreementBuilding.state} ${selectedAgreementBuilding.postalCode}` : "—"} />
                  <div className="sm:col-span-2"><PanelMessage>KYC documents are not available for this tenant yet.</PanelMessage></div>
                </> : null}
                {agreementTab === "rent" ? (
                  <>
                    <div className="sm:col-span-2">
                      <TabPanelHeading title="Monthly rent" description="The agreed rent due each month." />
                    </div>
                    <AgreementMetric label="Agreement year" value={getAgreementYear(selectedAgreement.startDate)} />
                    <AgreementMetric label="Monthly rent" value={`₹${selectedAgreement.monthlyRent.toLocaleString("en-IN")}`} />
                  </>
                ) : null}
                {agreementTab === "expiry" ? (
                  <>
                    <div className="sm:col-span-2">
                      <TabPanelHeading title="Agreement expiry" description="The start and end dates for the 11-month agreement." />
                    </div>
                    <AgreementMetric label="Agreement start date" value={formatAgreementDate(selectedAgreement.startDate)} />
                    <AgreementMetric label="Agreement end date" value={formatAgreementDate(selectedAgreement.endDate)} />
                  </>
                ) : null}
                {agreementTab === "terms" ? (
                  <div className="sm:col-span-2 space-y-5">
                    <TabPanelHeading title="Agreement terms" description="Property terms mapped to this unit, followed by any additional conditions recorded for this rental." />
                    {selectedAgreement.templateTerms?.map((template) => (
                      <div key={template.templateId} className="rounded-xl border border-[#e7ece7] bg-[#fbfcfb] p-4">
                        <h3 className="text-[12px] font-semibold text-[#294034]">{template.heading}</h3>
                        {template.items.length ? (
                          <ol className="mt-3 list-decimal space-y-2 pl-5 text-[11px] leading-5 text-[#53675a]">
                            {template.items.map((item) => (
                              <li key={item.id}>
                                {item.importantObligation ? <strong className="mr-1 text-[#805b13]">Important obligation:</strong> : null}
                                {item.text}
                              </li>
                            ))}
                          </ol>
                        ) : <p className="mt-2 text-[10px] text-[#849188]">No terms in this heading yet.</p>}
                      </div>
                    ))}
                    {selectedAgreement.terms ? (
                      <DetailField label="Terms and notes" value={selectedAgreement.terms} />
                    ) : !selectedAgreement.templateTerms?.length ? (
                      <PanelMessage>No terms have been recorded for this agreement.</PanelMessage>
                    ) : null}
                  </div>
                ) : null}
                {agreementTab === "advance" ? (
                  <>
                    <div className="sm:col-span-2">
                      <TabPanelHeading title="Advance and security deposit" description="The upfront deposit recorded for this agreement." />
                    </div>
                    <div className="sm:col-span-2">
                      <AgreementMetric
                        label="Security deposit"
                        value={selectedAgreement.securityDeposit === undefined ? "Not recorded" : `₹${selectedAgreement.securityDeposit.toLocaleString("en-IN")}`}
                      />
                      <p className="mt-4 text-[12px] text-[#849188]">A separate advance amount is not stored for this agreement.</p>
                    </div>
                  </>
                ) : null}
                {agreementTab === "important-terms" ? (
                  <div className="sm:col-span-2 space-y-5">
                    <TabPanelHeading title="Important terms" description="Terms marked as important obligations, plus any additional key conditions recorded for this rental." />
                    {selectedAgreement.templateTerms?.flatMap((template) => template.items).filter((item) => item.importantObligation).length ? (
                      <section className="rounded-xl border border-[#f1dfb4] bg-[#fffaf0] p-4">
                        <h3 className="text-[12px] font-semibold text-[#805b13]">Marked important obligations</h3>
                        <ol className="mt-3 list-decimal space-y-2 pl-5 text-[11px] leading-5 text-[#53675a]">
                          {selectedAgreement.templateTerms.flatMap((template) => template.items).map((item, index) => ({ ...item, serialNumber: index + 1 })).filter((item) => item.importantObligation).map((item) => (
                            <li key={item.id}>{item.text}</li>
                          ))}
                        </ol>
                      </section>
                    ) : <PanelMessage>No mapped terms have been marked as important obligations.</PanelMessage>}
                    {selectedAgreement.importantTerms ? (
                      <DetailField label="Additional important terms" value={selectedAgreement.importantTerms} />
                    ) : (
                      <PanelMessage>No additional important terms have been recorded for this agreement.</PanelMessage>
                    )}
                  </div>
                ) : null}
              </div>
              <div className="grid gap-3 border-t border-[#edf0ed] bg-[#fbfcfb] p-5 sm:grid-cols-2 sm:p-6">
                <AgreementApprovalStatus label="Owner approved" value={selectedAgreement.ownerApprovedAt} status={selectedAgreement.status} />
                <AgreementApprovalStatus label="Tenant approved" value={selectedAgreement.tenantApprovedAt} status={selectedAgreement.status} />
              </div>
            </article>
          ) : selectedTenant && !recordEditMode ? (
            <section className="rounded-2xl border border-[#e7ece7] bg-white shadow-[0_4px_20px_-12px_rgba(28,53,37,0.12)]">
              <div className="flex flex-col justify-between gap-3 border-b border-[#edf0ed] px-5 py-4 sm:flex-row sm:items-center sm:px-6">
                <div>
                  <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-[#6b8a76]">Tenant</p>
                  <h2 className="mt-1 text-[20px] font-semibold tracking-[-0.04em] text-[#17271e]">{selectedTenant.fullName}</h2>
                </div>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={startRecordEdit} className="rounded-lg border border-[#dfe8e1] bg-[#f7faf7] px-3 py-2 text-[10px] font-semibold text-[#355942]">Edit</button>
                  <button type="button" onClick={() => void handleDeleteRecord(selectedTenant.id)} disabled={deletingRecordId !== null} className="rounded-lg border border-[#f0d9d2] bg-[#fff8f7] px-3 py-2 text-[10px] font-semibold text-[#9a4a3d] disabled:cursor-not-allowed disabled:opacity-60">Delete</button>
                  <button type="button" onClick={() => syncModuleUrl("tenants")} className="rounded-lg border border-[#dfe8e1] bg-[#f5f8f5] px-3 py-2 text-[10px] font-semibold text-[#355942]">Back to tenants</button>
                </div>
              </div>

              <div role="tablist" aria-label="Tenant sections" className="flex gap-1 border-b border-[#edf0ed] px-4 sm:px-6">
                {tenantTabs.map((tab) => (
                  <button
                    key={tab.id}
                    id={`tenant-tab-${tab.id}`}
                    type="button"
                    role="tab"
                    aria-selected={tenantTab === tab.id}
                    aria-controls="tenant-tab-panel"
                    onClick={() => setTenantTab(tab.id)}
                    className={`shrink-0 border-b-2 px-3 py-3 text-[10px] font-semibold transition ${tenantTab === tab.id ? "border-[#176b4b] text-[#176b4b]" : "border-transparent text-[#849188] hover:text-[#355942]"}`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
              <section className="border-b border-[#edf0ed] bg-[#f9fbf9] px-5 py-4 sm:px-6">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-[11px] font-semibold text-[#294034]">Public tenant page</h3>
                      <span className={`rounded-full px-2 py-0.5 text-[8px] font-semibold ${selectedTenant.publicShareEnabled ? "bg-[#e9f3eb] text-[#286244]" : "bg-[#eef1ee] text-[#718078]"}`}>
                        {selectedTenant.publicShareEnabled ? "Link active" : "Not shared"}
                      </span>
                    </div>
                    <p className="mt-1 max-w-2xl text-[9px] leading-4 text-[#7b8980]">
                      Anyone with this link can view tenant contact and KYC details, assigned properties, and current agreement, rent, deposit, approval, and terms information. The link works until you disable or regenerate it.
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => void createTenantShareLink(selectedTenant.id)}
                      disabled={tenantShareBusy}
                      className="rounded-lg bg-[#176b4b] px-3 py-2 text-[9px] font-semibold text-white disabled:opacity-60"
                    >
                      {tenantShareBusy ? "Working..." : selectedTenant.publicShareEnabled ? "Regenerate link" : "Create share link"}
                    </button>
                    {selectedTenant.publicShareEnabled ? (
                      <button
                        type="button"
                        onClick={() => void revokeTenantShareLink(selectedTenant.id)}
                        disabled={tenantShareBusy}
                        className="rounded-lg border border-[#e4eae5] bg-white px-3 py-2 text-[9px] font-semibold text-[#596b5e] disabled:opacity-60"
                      >
                        Disable page
                      </button>
                    ) : null}
                  </div>
                </div>
                {tenantShareError?.tenantId === selectedTenant.id ? <p role="alert" className="mt-3 rounded-lg bg-[#fff4ed] px-3 py-2 text-[10px] text-[#995634]">{tenantShareError.message}</p> : null}
                {tenantShareLink?.tenantId === selectedTenant.id ? (
                  <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                    <input
                      aria-label="Public tenant page link"
                      readOnly
                      value={tenantShareLink.url}
                      onFocus={(event) => event.currentTarget.select()}
                      className="h-10 min-w-0 flex-1 rounded-lg border border-[#dfe8e1] bg-white px-3 text-[10px] text-[#53675a] outline-none"
                    />
                    <button type="button" onClick={() => void copyTenantShareLink()} className="h-10 rounded-lg border border-[#dfe8e1] bg-white px-3 text-[9px] font-semibold text-[#355942]">
                      {tenantShareCopiedFor === selectedTenant.id ? "Copied" : "Copy link"}
                    </button>
                    <a href={tenantShareLink.url} target="_blank" rel="noreferrer" className="inline-flex h-10 items-center justify-center rounded-lg border border-[#dfe8e1] bg-white px-3 text-[9px] font-semibold text-[#355942]">
                      Open page
                    </a>
                  </div>
                ) : null}
              </section>
              <div id="tenant-tab-panel" role="tabpanel" aria-labelledby={`tenant-tab-${tenantTab}`}>
                {tenantTab === "kyc" ? (
                  <div className="grid gap-4 p-5 sm:grid-cols-2 sm:p-6">
                    <h3 className="sm:col-span-2 text-[12px] font-semibold text-[#203328]">KYC</h3>
                    {selectedTenant.photoDataUrl ? <Image src={selectedTenant.photoDataUrl} alt={`${selectedTenant.fullName} tenant profile`} width={112} height={112} unoptimized className="size-28 rounded-xl object-cover" /> : null}
                    <DetailField label="Tenant name" value={selectedTenant.fullName} />
                    <DetailField label="Business name" value={selectedTenant.businessName || "—"} />
                    <DetailField label="Full address" value={selectedTenant.fullAddress || "—"} />
                    <DetailField label="Mobile number" value={selectedTenant.mobileNumber ? `+${selectedTenant.mobileNumber}` : "—"} />
                    <DetailField label="Aadhaar number" value={selectedTenant.aadhaarNumber || "—"} />
                    <DetailField label="Father's name" value={selectedTenant.fatherName || "—"} />
                    <DetailField label="Email address" value={selectedTenant.email || "—"} />
                  </div>
                ) : null}
                {tenantTab === "assets" ? (
                  selectedTenantAssets.length ? (
                    <div className="overflow-x-auto">
                      <table aria-label="Currently assigned tenant assets" className="w-full min-w-[680px] border-collapse text-left">
                        <thead className="bg-[#f7faf7] text-[9px] font-semibold uppercase tracking-[0.1em] text-[#718078]">
                          <tr>
                            <th scope="col" className="px-5 py-3">Asset ID</th>
                            <th scope="col" className="px-5 py-3">Asset</th>
                            <th scope="col" className="px-5 py-3">Building</th>
                            <th scope="col" className="px-5 py-3">Rent / month</th>
                            <th scope="col" className="px-5 py-3">Advance</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#edf0ed]">
                          {selectedTenantAssets.map((asset) => {
                            const building = portfolio.buildings.find((entry) => entry.id === asset.buildingId);
                            return (
                              <tr
                                key={asset.id}
                                role="link"
                                tabIndex={0}
                                onClick={() => handleOpenAsset(asset.id)}
                                onKeyDown={(event) => {
                                  if (event.key === "Enter" || event.key === " ") {
                                    event.preventDefault();
                                    handleOpenAsset(asset.id);
                                  }
                                }}
                                className="cursor-pointer text-[11px] text-[#33473a] transition hover:bg-[#f7faf7] focus:bg-[#f7faf7] focus:outline-none"
                              >
                                <td className="px-5 py-4 font-semibold text-[#203328]">{asset.unitNumber}</td>
                                <td className="px-5 py-4">{asset.name}</td>
                                <td className="px-5 py-4">{building?.name ?? "—"}</td>
                                <td className="px-5 py-4">₹{asset.monthlyRent.toLocaleString("en-IN")}</td>
                                <td className="px-5 py-4">₹{asset.securityDeposit.toLocaleString("en-IN")}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="px-5 py-6 text-[11px] text-[#849188]">No assets are currently assigned to this tenant.</p>
                  )
                ) : null}
                {tenantTab === "agreements" ? (
                  <div>
                    <div className="px-5 py-4 sm:px-6">
                      <h3 className="text-[14px] font-semibold text-[#203328]">Rental agreements</h3>
                      <p className="mt-1 text-[10px] text-[#849188]">All agreements associated with this tenant.</p>
                    </div>
                    {selectedTenantAgreements.length ? (
                      <div className="divide-y divide-[#edf0ed]">
                        {selectedTenantAgreements.map((agreement) => {
                          const asset = portfolio.assets.find((entry) => entry.id === agreement.assetId);
                          return (
                            <div key={agreement.id} className="flex flex-col gap-2 px-5 py-4 sm:px-6">
                              <div>
                                <div className="flex flex-wrap items-center gap-2">
                                  <button type="button" onClick={() => handleOpenAgreement(agreement.id)} className="text-left text-[12px] font-semibold text-[#203328] hover:text-[#176b4b] hover:underline">{agreement.agreementNumber}</button>
                                  <AgreementStatusBadge status={getAgreementStatus(agreement.endDate)} />
                                </div>
                                <p className="mt-1 text-[10px] text-[#849188]">{asset ? `${asset.name} · Unit ${asset.unitNumber}` : "Asset not found"}</p>
                              </div>
                              <AgreementFacts
                                startDate={agreement.startDate}
                                endDate={agreement.endDate}
                                monthlyRent={agreement.monthlyRent}
                                advanceAmount={agreement.securityDeposit}
                                compact
                              />
                            </div>
                          );
                        })}
                      </div>
                    ) : <p className="px-5 pb-5 text-[11px] text-[#849188] sm:px-6">No agreements for this tenant yet.</p>}
                  </div>
                ) : null}
              </div>
            </section>
          ) : selectedAsset && !recordEditMode ? (
            <article className="rounded-2xl border border-[#e7ece7] bg-white shadow-[0_4px_20px_-12px_rgba(28,53,37,0.12)]">
              <div className="flex flex-col justify-between gap-3 border-b border-[#edf0ed] px-5 py-4 sm:flex-row sm:items-center sm:px-6">
                <div>
                  <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-[#6b8a76]">Asset details</p>
                  <h2 className="mt-1 text-[20px] font-semibold tracking-[-0.04em] text-[#17271e]">{selectedAsset.name}</h2>
                  <p className="mt-1 text-[10px] font-semibold text-[#718078]">Asset ID: {selectedAsset.unitNumber}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={startRecordEdit} className="rounded-lg border border-[#dfe8e1] bg-[#f7faf7] px-3 py-2 text-[10px] font-semibold text-[#355942]">Edit</button>
                  <button type="button" onClick={() => void handleDeleteRecord(selectedAsset.id)} disabled={deletingRecordId !== null} className="rounded-lg border border-[#f0d9d2] bg-[#fff8f7] px-3 py-2 text-[10px] font-semibold text-[#9a4a3d] disabled:cursor-not-allowed disabled:opacity-60">Delete</button>
                  <button type="button" onClick={() => syncModuleUrl("assets")} className="rounded-lg border border-[#dfe8e1] bg-[#f5f8f5] px-3 py-2 text-[10px] font-semibold text-[#355942]">Back to assets</button>
                </div>
              </div>
              <div className="grid gap-4 p-5 sm:grid-cols-2 sm:p-6">
                <DetailField label="Asset ID" value={selectedAsset.unitNumber} />
                <DetailField label="Building name" value={selectedAssetBuilding?.name ?? "—"} />
                <DetailField label="Room number" value={selectedAsset.roomNumber || "—"} />
                <DetailField label="Ward number" value={selectedAsset.ward || "—"} />
                <DetailField label="K-SMART building ID" value={selectedAsset.ksmartBuildingId || "—"} />
                <DetailField label="KSRB ID" value={selectedAsset.ksrbId || "—"} />
                <DetailField label="Rent / month" value={`₹${selectedAsset.monthlyRent.toLocaleString("en-IN")}`} />
                <DetailField label="Advance" value={`₹${selectedAsset.securityDeposit.toLocaleString("en-IN")}`} />
                <DetailField label="Current tenant" value={selectedAssetTenant?.fullName ?? "Vacant"} />
              </div>
              <div className="px-5 pb-5 sm:px-6 sm:pb-6">
                <AssetTermsMapping
                  asset={selectedAsset}
                  templates={portfolio.termsTemplates}
                  onRefresh={loadPortfolio}
                />
              </div>
            </article>
          ) : selectedCompany && !recordEditMode ? (
            <article className="rounded-2xl border border-[#e7ece7] bg-white shadow-[0_4px_20px_-12px_rgba(28,53,37,0.12)]">
              <RecordDetailHeader title={selectedCompany.name} label="Company details" onBack={() => syncModuleUrl("companies")} onEdit={startRecordEdit} onDelete={() => void handleDeleteRecord(selectedCompany.id)} deleteDisabled={deletingRecordId !== null} />
              <div className="grid gap-4 p-5 sm:grid-cols-2 sm:p-6">
                <DetailField label="Company name" value={selectedCompany.name} />
                <DetailField label="Buildings" value={String(portfolio.buildings.filter((building) => building.companyId === selectedCompany.id).length)} />
              </div>
            </article>
          ) : selectedBuilding && !recordEditMode ? (
            <article className="rounded-2xl border border-[#e7ece7] bg-white shadow-[0_4px_20px_-12px_rgba(28,53,37,0.12)]">
              <RecordDetailHeader title={selectedBuilding.name} label="Building details" onBack={() => syncModuleUrl("buildings")} onEdit={startRecordEdit} onDelete={() => void handleDeleteRecord(selectedBuilding.id)} deleteDisabled={deletingRecordId !== null} />
              <div className="grid gap-4 p-5 sm:grid-cols-2 sm:p-6">
                <DetailField label="Building name" value={selectedBuilding.name} />
                <DetailField label="Address" value={`${selectedBuilding.address}, ${selectedBuilding.city}, ${selectedBuilding.state} ${selectedBuilding.postalCode}`} />
                <DetailField label="Assets" value={String(portfolio.assets.filter((asset) => asset.buildingId === selectedBuilding.id).length)} />
              </div>
            </article>
          ) : selectedRecord ? (
            <div className="rounded-2xl border border-[#e7ece7] bg-white shadow-[0_4px_20px_-12px_rgba(28,53,37,0.12)]">
              <div className="flex flex-col justify-between gap-3 border-b border-[#edf0ed] px-5 py-4 sm:flex-row sm:items-center sm:px-6">
                <div>
                  <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-[#6b8a76]">{selectedModule === "assets" ? "Edit asset" : "Edit record"}</p>
                  <h2 className="mt-1 text-[20px] font-semibold tracking-[-0.04em] text-[#17271e]">{selectedModule === "assets" ? (selectedRecord as Asset).name : selectedDetail.title}</h2>
                </div>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => void handleDeleteRecord(selectedRecord.id)} disabled={deletingRecordId !== null} className="rounded-lg border border-[#f0d9d2] bg-[#fff8f7] px-3 py-2 text-[10px] font-semibold text-[#9a4a3d] disabled:cursor-not-allowed disabled:opacity-60">Delete</button>
                  <button type="button" onClick={() => { setRecordEditMode(false); syncModuleUrl(selectedModule); }} className="rounded-lg border border-[#dfe8e1] bg-[#f5f8f5] px-3 py-2 text-[10px] font-semibold text-[#355942]">Back to list</button>
                </div>
              </div>

              <div className="space-y-4 p-5 sm:p-6">
                {selectedModule === "companies" ? (
                  <TextField label="Company name" name="name" value={recordEditForm.name ?? ""} placeholder="Company name" setForm={setRecordEditForm} />
                ) : null}
                {selectedModule === "buildings" ? (
                  <>
                    <SelectField label="Company" name="companyId" value={recordEditForm.companyId ?? ""} options={portfolio.companies.map((company) => [company.id, company.name])} setForm={setRecordEditForm} />
                    <TextField label="Building name" name="name" value={recordEditForm.name ?? ""} placeholder="Building name" setForm={setRecordEditForm} />
                    <TextField label="Street address" name="address" value={recordEditForm.address ?? ""} placeholder="Street address" setForm={setRecordEditForm} />
                    <div className="grid grid-cols-2 gap-3">
                      <TextField label="City" name="city" value={recordEditForm.city ?? ""} placeholder="City" setForm={setRecordEditForm} />
                      <TextField label="State" name="state" value={recordEditForm.state ?? ""} placeholder="State" setForm={setRecordEditForm} />
                    </div>
                    <TextField label="Postal code" name="postalCode" value={recordEditForm.postalCode ?? ""} placeholder="Postal code" setForm={setRecordEditForm} />
                  </>
                ) : null}
                {selectedModule === "assets" ? (
                  <>
                    <label className="block text-[10px] font-semibold text-[#465a4c]">
                      Building
                      <select value={assetEditForm.buildingId ?? ""} onChange={(event) => setAssetEditForm((current) => ({ ...current, buildingId: event.target.value }))} className="mt-1.5 h-10 w-full rounded-lg border border-[#e4eae5] bg-[#fcfdfc] px-3 text-[11px] text-[#33473a] outline-none focus:border-[#8cbd9b]">
                        <option value="">Select building</option>
                        {portfolio.buildings.map((building) => (
                          <option key={building.id} value={building.id}>{building.name} · {building.id}</option>
                        ))}
                      </select>
                    </label>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <TextField label="Asset name" name="name" value={assetEditForm.name ?? ""} placeholder="Asset name" setForm={setAssetEditForm} />
                      <TextField label="Unit / Asset ID" name="unitNumber" value={assetEditForm.unitNumber ?? ""} placeholder="Unit number" setForm={setAssetEditForm} />
                      <TextField label="Asset type" name="assetType" value={assetEditForm.assetType ?? ""} placeholder="Apartment, room, shop..." setForm={setAssetEditForm} />
                      <TextField label="Monthly rent (₹)" name="monthlyRent" value={assetEditForm.monthlyRent ?? ""} placeholder="15000" type="number" setForm={setAssetEditForm} />
                      <TextField label="Advance / security deposit (₹)" name="securityDeposit" value={assetEditForm.securityDeposit ?? ""} placeholder="30000" type="number" setForm={setAssetEditForm} />
                      <TextField label="External building ID (optional)" name="externalBuildingId" value={assetEditForm.externalBuildingId ?? ""} placeholder="External reference" required={false} setForm={setAssetEditForm} />
                      <TextField label="Ward (optional)" name="ward" value={assetEditForm.ward ?? ""} placeholder="Ward" required={false} setForm={setAssetEditForm} />
                      <TextField label="Room number (optional)" name="roomNumber" value={assetEditForm.roomNumber ?? ""} placeholder="Room number" required={false} setForm={setAssetEditForm} />
                      <TextField label="K-SMART building ID (optional)" name="ksmartBuildingId" value={assetEditForm.ksmartBuildingId ?? ""} placeholder="K-SMART ID" required={false} setForm={setAssetEditForm} />
                      <TextField label="KSRB ID (optional)" name="ksrbId" value={assetEditForm.ksrbId ?? ""} placeholder="KSRB ID" required={false} setForm={setAssetEditForm} />
                    </div>
                  </>
                ) : null}
                {selectedModule === "tenants" ? (
                  <>
                    <TextField label="Tenant name" name="fullName" value={recordEditForm.fullName ?? ""} placeholder="Tenant name" setForm={setRecordEditForm} />
                    <TextField label="Business name (optional)" name="businessName" value={recordEditForm.businessName ?? ""} placeholder="Business or employer" required={false} setForm={setRecordEditForm} />
                    <TextField label="Full address (optional)" name="fullAddress" value={recordEditForm.fullAddress ?? ""} placeholder="Tenant full address" required={false} setForm={setRecordEditForm} />
                    <TextField label="Mobile number (optional)" name="mobileNumber" value={recordEditForm.mobileNumber ?? ""} placeholder="Mobile number" type="tel" required={false} setForm={setRecordEditForm} />
                    <div className="grid grid-cols-2 gap-3">
                      <TextField label="Aadhaar number (optional)" name="aadhaarNumber" value={recordEditForm.aadhaarNumber ?? ""} placeholder="Aadhaar number" required={false} setForm={setRecordEditForm} />
                      <TextField label="Father's name (optional)" name="fatherName" value={recordEditForm.fatherName ?? ""} placeholder="Father's name" required={false} setForm={setRecordEditForm} />
                    </div>
                    <TextField label="Email address (optional)" name="email" value={recordEditForm.email ?? ""} placeholder="name@example.com" type="email" required={false} setForm={setRecordEditForm} />
                    <label className="block text-[10px] font-semibold text-[#465a4c]">
                      Tenant photo (optional)
                      <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (!file) return;
                        if (file.size > 1_000_000) {
                          setRecordEditError("Tenant photo must be 1 MB or smaller.");
                          event.target.value = "";
                          return;
                        }
                        const reader = new FileReader();
                        reader.onload = () => setRecordEditForm((current) => ({ ...current, photoDataUrl: String(reader.result ?? "") }));
                        reader.onerror = () => setRecordEditError("Unable to read the selected tenant photo.");
                        reader.readAsDataURL(file);
                      }} className="mt-1.5 block w-full text-[11px] text-[#53675a]" />
                    </label>
                  </>
                ) : null}
                {selectedModule === "agreements" ? (
                  <>
                    <label className="block text-[10px] font-semibold text-[#465a4c]">
                      Agreement number
                      <input defaultValue={(selectedRecord as Agreement).agreementNumber} className="mt-1.5 h-10 w-full rounded-lg border border-[#e4eae5] bg-[#fcfdfc] px-3 text-[11px] text-[#33473a] outline-none focus:border-[#8cbd9b]" />
                    </label>
                    <label className="block text-[10px] font-semibold text-[#465a4c]">
                      Dates
                      <input defaultValue={`${(selectedRecord as Agreement).startDate.slice(0, 10)} to ${(selectedRecord as Agreement).endDate.slice(0, 10)}`} className="mt-1.5 h-10 w-full rounded-lg border border-[#e4eae5] bg-[#fcfdfc] px-3 text-[11px] text-[#33473a] outline-none focus:border-[#8cbd9b]" />
                    </label>
                  </>
                ) : null}

                {(selectedModule === "assets" ? assetEditError : recordEditError) ? (
                  <p role="alert" className="rounded-lg bg-[#fff4ed] px-3 py-2 text-[11px] text-[#995634]">{selectedModule === "assets" ? assetEditError : recordEditError}</p>
                ) : null}
                <div className="flex justify-end gap-2 pt-2">
                  <button type="button" onClick={() => {
                    setRecordEditMode(false);
                    setAssetEditError("");
                    setRecordEditError("");
                  }} className="h-10 rounded-lg border border-[#e3e9e4] px-4 text-[11px] font-semibold text-[#58695e]">Cancel</button>
                  {selectedModule === "assets" ? (
                    <button type="button" onClick={() => void saveAssetEdits()} disabled={assetEditSaving} className="h-10 rounded-lg bg-[#176b4b] px-4 text-[11px] font-semibold text-white disabled:opacity-60">{assetEditSaving ? "Saving..." : "Save changes"}</button>
                  ) : (
                    <button type="button" onClick={() => void saveRecordEdits()} disabled={recordEditSaving} className="h-10 rounded-lg bg-[#176b4b] px-4 text-[11px] font-semibold text-white disabled:opacity-60">{recordEditSaving ? "Saving..." : "Save changes"}</button>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-[#e7ece7] bg-white shadow-[0_4px_20px_-12px_rgba(28,53,37,0.12)]">
              <div className="flex flex-col justify-between gap-3 border-b border-[#edf0ed] px-5 py-4 sm:flex-row sm:items-center sm:px-6">
                <h2 className="text-[20px] font-semibold tracking-[-0.04em] text-[#17271e]">{selectedDetail.title}</h2>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  {selectedVisibleRecordIds.length > 0 ? (
                    <button
                      type="button"
                      onClick={() => void handleBulkDelete()}
                      disabled={bulkDeleting || deletingRecordId !== null}
                      className="h-9 rounded-lg border border-[#f0d9d2] bg-[#fff8f7] px-3 text-[11px] font-semibold text-[#9a4a3d] transition hover:bg-[#fff0ee] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {bulkDeleting ? (selectedModule === "agreements" ? "Archiving..." : "Deleting...") : `${selectedModule === "agreements" ? "Archive" : "Delete"} selected (${selectedVisibleRecordIds.length})`}
                    </button>
                  ) : null}
                  {selectedModule === "agreements" && selectedAgreementYear !== null && (
                    <Link
                      href="/owner/dashboard?module=agreements"
                      onClick={() => setRecordSelection({ scope: "agreements:all", ids: [] })}
                      className="h-9 rounded-lg border border-[#e3eae4] bg-white px-3 text-[11px] font-semibold text-[#315b41] transition hover:bg-[#f1f6f2]"
                    >
                      All years
                    </Link>
                  )}
                  {selectedDetail.actionLabel && selectedDetail.formKind ? (
                    <ActionButton onClick={() => openForm(selectedDetail.formKind!)} label={selectedDetail.actionLabel} />
                  ) : null}
                </div>
              </div>

              {selectedModule === "buildings" && !loading && !error && (
                <div className="grid gap-4 border-b border-[#edf0ed] bg-[#fbfcfb] p-5 sm:grid-cols-2 sm:p-6">
                  <AgreementMetric
                    label="Total monthly rent"
                    value={`₹${buildingAssetTotals.monthlyRent.toLocaleString("en-IN")}`}
                  />
                  <AgreementMetric
                    label="Total advance / security deposit"
                    value={`₹${buildingAssetTotals.advance.toLocaleString("en-IN")}`}
                  />
                </div>
              )}

              {loading ? (
                <div className="px-5 py-7"><PanelMessage>Loading your portfolio...</PanelMessage></div>
              ) : error ? (
                <div className="px-5 py-7"><PanelMessage error>{error}</PanelMessage></div>
              ) : selectedModule === "agreements" && selectedAgreementYear === null ? (
                agreementYears.length ? (
                  <>
                    <div className="flex justify-end border-b border-[#edf0ed] px-5 py-3 sm:px-6">
                      <button
                        type="button"
                        onClick={toggleVisibleSelection}
                        aria-pressed={allVisibleRecordsSelected}
                        className="rounded-lg border border-[#dfe8e1] bg-[#f7faf7] px-3 py-2 text-[11px] font-semibold text-[#355942] transition hover:bg-[#edf5ee]"
                      >
                        {allVisibleRecordsSelected ? "Clear agreement selection" : "Select all agreements"}
                      </button>
                    </div>
                    <div aria-label="Agreement years" className="grid gap-3 p-5 sm:grid-cols-2 sm:p-6 lg:grid-cols-3">
                      {agreementYears.map((year) => {
                        const count = portfolio.agreements.filter(
                          (agreement) => getAgreementYear(agreement.startDate) === year,
                        ).length;
                        return (
                          <Link
                            key={year}
                            href={`/owner/dashboard/agreements/${year}`}
                            onClick={() => setRecordSelection({ scope: `agreements:${year}`, ids: [] })}
                            className="group flex min-h-28 items-center justify-between rounded-2xl border border-[#e3eae4] bg-gradient-to-br from-white to-[#f7faf7] p-5 text-left shadow-[0_4px_20px_-16px_rgba(28,53,37,0.2)] transition hover:-translate-y-0.5 hover:border-[#b9d6c3] hover:shadow-md sm:p-6"
                          >
                            <span>
                              <span className="block text-[10px] font-semibold uppercase tracking-[0.14em] text-[#849188]">Agreement year</span>
                              <span className="mt-2 block text-[26px] font-semibold tracking-[-0.04em] text-[#176b4b]">{year}</span>
                            </span>
                            <span className="rounded-full bg-[#eaf3ec] px-3 py-1.5 text-[11px] font-semibold text-[#315b41] group-hover:bg-[#dcebe0]">
                              {count} {count === 1 ? "agreement" : "agreements"}
                            </span>
                          </Link>
                        );
                      })}
                    </div>
                  </>
                ) : (
                  <p className="px-5 py-7 text-[13px] text-[#849188]">{selectedDetail.empty}</p>
                )
              ) : (
                <>
                  {selectedModule === "agreements" && selectedAgreementYear !== null && (
                    <div className="border-b border-[#edf0ed] bg-[#fbfcfb] px-5 py-3 sm:px-6">
                      <p className="text-[12px] font-semibold text-[#315b41]">{selectedAgreementYear} agreements</p>
                    </div>
                  )}
                  {displayRows.length ? (
                    <div className="overflow-x-auto">
                      <table aria-label={`${selectedDetail.title} report`} className="w-full min-w-[760px] border-collapse text-left">
                        <thead className="bg-[#f7faf7] text-[9px] font-semibold uppercase tracking-[0.1em] text-[#718078]">
                          <tr>
                            {selectedModule !== "deleted-agreements" ? (
                              <th scope="col" className="w-12 px-4 py-3">
                                <input
                                  type="checkbox"
                                  aria-label={`Select all visible ${selectedDetail.title}`}
                                  checked={allVisibleRecordsSelected}
                                  onChange={toggleVisibleSelection}
                                  className="size-4 cursor-pointer accent-[#176b4b]"
                                />
                              </th>
                            ) : null}
                            {selectedDetail.columns.map((column) => (
                              <th key={column} scope="col" className="px-5 py-3">{column}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#edf0ed]">
                          {displayRows.map((row) => (
                            <tr
                              key={row.key}
                              role="link"
                              tabIndex={0}
                              onClick={() => handleEditRecord(row.key)}
                              onKeyDown={(event) => {
                                if (event.target !== event.currentTarget) return;
                                if (event.key === "Enter" || event.key === " ") {
                                  event.preventDefault();
                                  handleEditRecord(row.key);
                                }
                              }}
                              className="cursor-pointer text-[11px] text-[#33473a] transition hover:bg-[#f7faf7] focus:bg-[#f7faf7] focus:outline-none"
                            >
                              {selectedModule !== "deleted-agreements" ? (
                                <td className="px-4 py-4">
                                  <input
                                    type="checkbox"
                                    aria-label={`Select ${selectedDetail.title.toLowerCase()} record`}
                                    checked={selectedRecordIds.includes(row.key)}
                                    onChange={() => toggleRecordSelection(row.key)}
                                    onClick={(event) => event.stopPropagation()}
                                    className="size-4 cursor-pointer accent-[#176b4b]"
                                  />
                                </td>
                              ) : null}
                              {row.cells.map((cell, index) => (
                                <td key={`${row.key}-${selectedDetail.columns[index]}`} className={`px-5 py-4 ${cell.className ?? ""}`}>
                                  {selectedModule === "agreements" && index === row.cells.length - 1 ? (
                                    <a
                                      href={`/api/owner/agreements/${encodeURIComponent(row.key)}/pdf`}
                                      download
                                      aria-label={`Download PDF for ${portfolio.agreements.find((agreement) => agreement.id === row.key)?.agreementNumber ?? "agreement"}`}
                                      title="Download agreement PDF"
                                      onClick={(event) => event.stopPropagation()}
                                      className="inline-flex size-8 items-center justify-center rounded-lg border border-[#dfe9e1] bg-white text-[#286244] transition hover:bg-[#eff6f0] focus:outline-none focus:ring-2 focus:ring-[#8cbd9b]"
                                    >
                                      <FileDown size={15} />
                                    </a>
                                  ) : cell.badge
                                    ? <AgreementStatusBadge status={cell.status ?? null} />
                                    : cell.value}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="px-5 py-7 text-[13px] text-[#849188]">
                      {selectedModule === "agreements" && selectedAgreementYear !== null
                        ? `No agreements for ${selectedAgreementYear}.`
                        : selectedDetail.empty}
                    </p>
                  )}
                </>
              )}
            </div>
          )}
        </main>
      </div>

      {formKind && (
        <div className="fixed inset-0 z-40 grid place-items-center overflow-y-auto bg-[#10281c]/45 p-4 backdrop-blur-[2px]">
          <section role="dialog" aria-modal="true" aria-labelledby="owner-form-title" className="my-auto w-full max-w-[560px] rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#edf0ed] px-6 py-5"><div><p className="text-[9px] font-bold uppercase tracking-[0.14em] text-[#6b8a76]">Owner portfolio</p><h3 id="owner-form-title" className="mt-1 text-[17px] font-semibold text-[#203328]">{formLabels[formKind]}</h3></div><button type="button" aria-label="Close form" onClick={() => setFormKind(null)} className="grid size-8 place-items-center rounded-lg text-[#809087] hover:bg-[#f1f5f1]"><X size={16} /></button></div>
            <form onSubmit={saveItem} className="px-6 py-5">
              {formKind === "company" && <TextField label="Company name" name="name" value={form.name ?? ""} placeholder="Your registered company name" setForm={setForm} />}
              {formKind === "building" && <>
                <SelectField label="Company" name="companyId" value={form.companyId ?? ""} options={portfolio.companies.map((entry) => [entry.id, entry.name])} setForm={setForm} />
                <TextField label="Building name" name="name" value={form.name ?? ""} placeholder="e.g. Greenview Residency" setForm={setForm} />
                <TextField label="Street address" name="address" value={form.address ?? ""} placeholder="Door number and street" setForm={setForm} />
                <div className="mt-3 grid grid-cols-2 gap-3"><TextField label="City" name="city" value={form.city ?? ""} placeholder="City" setForm={setForm} /><TextField label="State" name="state" value={form.state ?? ""} placeholder="State" setForm={setForm} /></div>
                <TextField label="PIN code" name="postalCode" value={form.postalCode ?? ""} placeholder="PIN code" setForm={setForm} />
              </>}
              {formKind === "asset" && <>
                <SelectField label="Building" name="buildingId" value={form.buildingId ?? ""} options={portfolio.buildings.map((entry) => [entry.id, entry.name])} setForm={setForm} />
                <div className="mt-3 grid grid-cols-2 gap-3"><TextField label="Asset name" name="name" value={form.name ?? ""} placeholder="Apartment 3B" setForm={setForm} /><TextField label="Unit number" name="unitNumber" value={form.unitNumber ?? ""} placeholder="3B" setForm={setForm} /></div>
                <TextField label="Asset type" name="assetType" value={form.assetType ?? ""} placeholder="Apartment, room, shop..." setForm={setForm} />
                <div className="mt-3 grid grid-cols-2 gap-3"><TextField label="Room number (optional)" name="roomNumber" value={form.roomNumber ?? ""} placeholder="Room number" required={false} setForm={setForm} /><TextField label="Ward number (optional)" name="ward" value={form.ward ?? ""} placeholder="Ward number" required={false} setForm={setForm} /><TextField label="K-SMART building ID (optional)" name="ksmartBuildingId" value={form.ksmartBuildingId ?? ""} placeholder="K-SMART ID" required={false} setForm={setForm} /><TextField label="KSRB ID (optional)" name="ksrbId" value={form.ksrbId ?? ""} placeholder="KSRB ID" required={false} setForm={setForm} /><TextField label="Monthly rent (₹)" name="monthlyRent" value={form.monthlyRent ?? ""} placeholder="15000" type="number" setForm={setForm} /><TextField label="Security deposit (₹)" name="securityDeposit" value={form.securityDeposit ?? ""} placeholder="30000" type="number" setForm={setForm} /></div>
              </>}
              {formKind === "tenant" && <>
                <SelectField label="Asset (optional)" name="assetId" value={form.assetId ?? ""} options={portfolio.assets.map((entry) => [`${entry.id}`, `${entry.name} · ${entry.unitNumber}`])} required={false} setForm={setForm} />
                <TextField label="Tenant full name" name="fullName" value={form.fullName ?? ""} placeholder="Tenant's full name" setForm={setForm} />
                <TextField label="Tenant mobile (optional)" name="mobileNumber" value={form.mobileNumber ?? ""} placeholder="919876543210" type="tel" required={false} setForm={setForm} />
                <TextField label="Business name (optional)" name="businessName" value={form.businessName ?? ""} placeholder="Business or employer" required={false} setForm={setForm} />
                <TextField label="Full address (optional)" name="fullAddress" value={form.fullAddress ?? ""} placeholder="Tenant's full address" required={false} setForm={setForm} />
                <div className="grid grid-cols-2 gap-3">
                  <TextField label="Aadhaar number (optional)" name="aadhaarNumber" value={form.aadhaarNumber ?? ""} placeholder="Aadhaar number" required={false} setForm={setForm} />
                  <TextField label="Father's name (optional)" name="fatherName" value={form.fatherName ?? ""} placeholder="Father's name" required={false} setForm={setForm} />
                </div>
                <TextField label="Email address (optional)" name="email" value={form.email ?? ""} placeholder="name@example.com" type="email" required={false} setForm={setForm} />
                <label className="mt-3 block text-[10px] font-semibold text-[#465a4c]">
                  Tenant photo (optional)
                  <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (!file) return;
                    if (file.size > 1_000_000) {
                      setFormError("Tenant photo must be 1 MB or smaller.");
                      event.target.value = "";
                      return;
                    }
                    const reader = new FileReader();
                    reader.onload = () => setForm((current) => ({ ...current, photoDataUrl: String(reader.result ?? "") }));
                    reader.onerror = () => setFormError("Unable to read the selected tenant photo.");
                    reader.readAsDataURL(file);
                  }} className="mt-1.5 block w-full text-[11px] text-[#53675a]" />
                </label>
                <TextField label="Agreement start date (optional)" name="startDate" value={form.startDate ?? ""} placeholder="" type="date" required={false} setForm={setForm} />
                <p className="mt-3 text-[10px] text-[#849188]">Tenants without a mobile number can be recorded, but cannot sign in until one is added.</p>
                <p className="mt-2 text-[10px] text-[#849188]">Tenant name is the only required field. Select both an asset and agreement start date to also create an unsigned 11-month draft.</p>
              </>}
              {formKind === "agreement" && <>
                <label className="block text-[10px] font-semibold text-[#465a4c]">Asset<select required value={form.assetId ?? ""} onChange={(event) => setForm((current) => ({ ...current, assetId: event.target.value, tenantId: "" }))} className="mt-1.5 h-10 w-full rounded-lg border border-[#e4eae5] bg-[#fcfdfc] px-3 text-[11px] font-normal text-[#33473a] outline-none focus:border-[#8cbd9b]"><option value="">Select asset</option>{portfolio.assets.map((asset) => <option key={asset.id} value={asset.id}>{asset.name} · {asset.unitNumber}</option>)}</select></label>
                <label className="mt-3 block text-[10px] font-semibold text-[#465a4c]">Tenant<select required value={form.tenantId ?? ""} onChange={(event) => setForm((current) => ({ ...current, tenantId: event.target.value }))} className="mt-1.5 h-10 w-full rounded-lg border border-[#e4eae5] bg-[#fcfdfc] px-3 text-[11px] font-normal text-[#33473a] outline-none focus:border-[#8cbd9b]"><option value="">Select tenant</option>{portfolio.tenants.filter((tenant) => tenant.assetIds.includes(form.assetId ?? "")).map((tenant) => <option key={tenant.id} value={tenant.id}>{tenant.fullName}{tenant.mobileNumber ? ` · +${tenant.mobileNumber}` : ""}</option>)}</select></label>
                <label className="mt-3 block text-[10px] font-semibold text-[#465a4c]">Agreement start date<input required type="date" value={form.startDate ?? ""} onChange={(event) => setForm((current) => ({ ...current, startDate: event.target.value }))} className="mt-1.5 h-10 w-full rounded-lg border border-[#e4eae5] bg-[#fcfdfc] px-3 text-[11px] font-normal text-[#33473a] outline-none focus:border-[#8cbd9b]" /></label>
                <p className="mt-2 rounded-lg bg-[#f7faf7] px-3 py-2.5 text-[10px] text-[#55705f]">Agreement end date: <strong>{form.startDate ? addElevenMonthTerm(form.startDate) ?? "Choose a valid start date" : "Choose a start date"}</strong> · 11 months. Upcoming-year defaults run January 1 through November 30; November 31 is not a valid date. Only one agreement is allowed for the same tenant, asset, and year.</p>
                <label className="mt-3 block text-[10px] font-semibold text-[#465a4c]">Additional terms or notes (optional)<textarea rows={3} maxLength={2000} value={form.terms ?? ""} onChange={(event) => setForm((current) => ({ ...current, terms: event.target.value }))} placeholder="Additional agreed terms..." className="mt-1.5 w-full rounded-lg border border-[#e4eae5] bg-[#fcfdfc] px-3 py-2 text-[11px] font-normal text-[#33473a] outline-none focus:border-[#8cbd9b]" /></label>
              </>}
              {formError && <p role="alert" className="mt-4 rounded-lg bg-[#fff4ed] px-3 py-2 text-[11px] text-[#995634]">{formError}</p>}
              <div className="mt-6 flex justify-end gap-2 border-t border-[#edf0ed] pt-4"><button type="button" onClick={() => setFormKind(null)} className="h-10 rounded-lg border border-[#e3e9e4] px-4 text-[11px] font-semibold text-[#58695e]">Cancel</button><button type="submit" disabled={saving} className="flex h-10 items-center gap-2 rounded-lg bg-[#176b4b] px-4 text-[11px] font-semibold text-white disabled:opacity-60">{saving ? "Saving..." : "Save"} <Plus size={13} /></button></div>
            </form>
          </section>
        </div>
      )}
      {reviewingAgreementId ? (() => {
        const agreement = portfolio.agreements.find((entry) => entry.id === reviewingAgreementId);
        if (!agreement) return null;
        const tenant = portfolio.tenants.find((entry) => entry.id === agreement.tenantId);
        const asset = portfolio.assets.find((entry) => entry.id === agreement.assetId);
        const building = asset
          ? portfolio.buildings.find((entry) => entry.id === asset.buildingId)
          : null;
        return (
          <AgreementApprovalWizard
            agreement={agreement as ReviewableAgreement}
            party="OWNER"
            tenantName={tenant?.fullName ?? "Tenant not found"}
            tenantMobile={tenant?.mobileNumber ?? null}
            propertyName={asset ? `${asset.name} · ${asset.unitNumber}` : "Property not found"}
            buildingAddress={building ? [building.address, building.city, building.state, building.postalCode].filter(Boolean).join(", ") : ""}
            onClose={() => setReviewingAgreementId(null)}
            onApproved={() => {
              setReviewingAgreementId(null);
              void loadPortfolio();
            }}
          />
        );
      })() : null}
    </div>
  );
}

function ActionButton({ onClick, label, disabled = false }: { onClick: () => void; label: string; disabled?: boolean }) {
  return <button type="button" onClick={onClick} disabled={disabled} className="flex h-10 items-center justify-center gap-1.5 rounded-xl border border-[#dce8de] bg-white px-3 text-[10px] font-semibold text-[#286244] transition hover:bg-[#f2f7f3] disabled:cursor-not-allowed disabled:opacity-50"><Plus size={13} />{label}</button>;
}

function PanelMessage({ children, error = false }: { children: React.ReactNode; error?: boolean }) {
  return <div role={error ? "alert" : undefined} className={`rounded-xl border p-5 text-[13px] leading-6 ${error ? "border-[#f1d9ce] bg-[#fff8f4] text-[#995634]" : "border-[#e7ece7] bg-[#f9fbf9] text-[#718078]"}`}>{children}</div>;
}

function OwnerTermsManager({
  templates,
  selectedTemplateId,
  onSelectTemplate,
  onBack,
  onRefresh,
}: {
  templates: TermTemplate[];
  selectedTemplateId: string | null;
  onSelectTemplate: (id: string) => void;
  onBack: () => void;
  onRefresh: () => Promise<void>;
}) {
  const [creating, setCreating] = useState(false);
  const [heading, setHeading] = useState("");
  const [termText, setTermText] = useState("");
  const [termImportantObligation, setTermImportantObligation] = useState(false);
  const [editingHeading, setEditingHeading] = useState(false);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editingItemText, setEditingItemText] = useState("");
  const [editingItemImportantObligation, setEditingItemImportantObligation] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const template = templates.find((entry) => entry.id === selectedTemplateId);

  async function saveAction(body: Record<string, unknown>) {
    return saveOwnerTermsRequest(body);
  }

  async function createTemplate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const payload = await saveAction({ action: "create-template", name: heading });
      if (!payload.template?.id) throw new Error("The new terms heading was not returned.");
      setHeading("");
      setCreating(false);
      await onRefresh();
      onSelectTemplate(payload.template.id);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to create this heading.");
    } finally {
      setSaving(false);
    }
  }

  async function addTerm(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!template) return;
    setSaving(true);
    setError("");
    try {
      await saveAction({
        action: "add-item",
        templateId: template.id,
        text: termText,
        importantObligation: termImportantObligation,
      });
      setTermText("");
      setTermImportantObligation(false);
      await onRefresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to add this term.");
    } finally {
      setSaving(false);
    }
  }

  async function removeTerm(item: TermItem) {
    if (!template || !window.confirm(`Remove term ${item.position} from “${template.name}”?`)) return;
    setSaving(true);
    setError("");
    try {
      await saveAction({ action: "delete-item", templateId: template.id, itemId: item.id });
      await onRefresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to remove this term.");
    } finally {
      setSaving(false);
    }
  }

  async function updateHeading() {
    if (!template || !heading.trim()) return;
    setSaving(true);
    setError("");
    try {
      await saveAction({ action: "update-template", templateId: template.id, name: heading });
      setEditingHeading(false);
      await onRefresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to update this heading.");
    } finally {
      setSaving(false);
    }
  }

  async function updateTerm(item: TermItem) {
    if (!template || !editingItemText.trim()) return;
    setSaving(true);
    setError("");
    try {
      await saveAction({
        action: "update-item",
        templateId: template.id,
        itemId: item.id,
        text: editingItemText,
        importantObligation: editingItemImportantObligation,
      });
      setEditingItemId(null);
      setEditingItemText("");
      setEditingItemImportantObligation(false);
      await onRefresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to update this term.");
    } finally {
      setSaving(false);
    }
  }

  async function removeTemplate() {
    if (!template || !window.confirm(`Delete “${template.name}”, its terms, and its property mappings? This also removes those terms from agreement reviews and downloads.`)) return;
    setSaving(true);
    setError("");
    try {
      await saveAction({ action: "delete-template", templateId: template.id });
      await onRefresh();
      onBack();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to delete this heading.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-[#e7ece7] bg-white shadow-[0_4px_20px_-12px_rgba(28,53,37,0.12)]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#edf0ed] px-5 py-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          {template ? (
            <button type="button" onClick={onBack} className="grid size-9 shrink-0 place-items-center rounded-lg border border-[#dfe8e1] text-[#355942]" aria-label="Back to terms list">
              <ChevronLeft size={16} />
            </button>
          ) : null}
          <div>
            <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-[#6b8a76]">Reusable agreement terms</p>
            <h2 className="mt-1 text-[20px] font-semibold tracking-[-0.04em] text-[#17271e]">{template?.name ?? "Terms"}</h2>
          </div>
        </div>
        {template ? (
          <div className="flex gap-2">
            <button type="button" onClick={() => { setHeading(template.name); setEditingHeading((value) => !value); }} disabled={saving} className="rounded-lg border border-[#dfe8e1] bg-[#f7faf7] px-3 py-2 text-[10px] font-semibold text-[#355942] disabled:opacity-60">
              {editingHeading ? "Cancel edit" : "Edit heading"}
            </button>
            <button type="button" onClick={() => void removeTemplate()} disabled={saving} className="rounded-lg border border-[#f0d9d2] bg-[#fff8f7] px-3 py-2 text-[10px] font-semibold text-[#9a4a3d] disabled:opacity-60">
              Delete heading
            </button>
          </div>
        ) : (
          <button type="button" onClick={() => { setCreating(true); setError(""); }} className="rounded-lg bg-[#176b4b] px-4 py-2.5 text-[11px] font-semibold text-white hover:bg-[#10583c]">
            Add
          </button>
        )}
      </div>

      {error ? <p role="alert" className="mx-5 mt-4 rounded-lg bg-[#fff4ed] px-3 py-2 text-[11px] text-[#995634] sm:mx-6">{error}</p> : null}

      {!template ? (
        <>
          {creating ? (
            <form onSubmit={(event) => void createTemplate(event)} className="m-5 rounded-xl border border-[#e5ebe6] bg-[#f9fbf9] p-4 sm:m-6">
              <label className="block text-[11px] font-semibold text-[#465a4c]">
                Main heading
                <input autoFocus required maxLength={120} value={heading} onChange={(event) => setHeading(event.target.value)} placeholder="e.g. Apartment terms, Room rules" className="mt-2 h-11 w-full rounded-lg border border-[#dfe8e1] bg-white px-3 text-[12px] font-normal text-[#33473a] outline-none focus:border-[#8cbd9b]" />
              </label>
              <div className="mt-3 flex justify-end gap-2">
                <button type="button" onClick={() => setCreating(false)} className="rounded-lg border border-[#dfe8e1] px-3 py-2 text-[10px] font-semibold text-[#58695e]">Cancel</button>
                <button type="submit" disabled={saving} className="rounded-lg bg-[#176b4b] px-4 py-2 text-[10px] font-semibold text-white disabled:opacity-60">{saving ? "Creating..." : "Create heading"}</button>
              </div>
            </form>
          ) : null}
          {!creating && templates.length ? (
            <div className="divide-y divide-[#edf0ed]">
              {templates.map((entry) => (
                <button key={entry.id} type="button" onClick={() => onSelectTemplate(entry.id)} className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition hover:bg-[#f7faf7] sm:px-6">
                  <span>
                    <span className="block text-[12px] font-semibold text-[#203328]">{entry.name}</span>
                    <span className="mt-1 block text-[10px] text-[#849188]">{entry.items.length} terms</span>
                  </span>
                  <ChevronRight size={17} className="shrink-0 text-[#849188]" />
                </button>
              ))}
            </div>
          ) : !creating ? (
            <p className="px-5 py-8 text-[12px] leading-5 text-[#849188] sm:px-6">
              Create a main heading such as “Apartment terms” or “Room rules”, then add its terms one at a time.
            </p>
          ) : null}
        </>
      ) : (
        <div className="p-5 sm:p-6">
          {editingHeading ? (
            <form onSubmit={(event) => { event.preventDefault(); void updateHeading(); }} className="mb-5 flex flex-wrap gap-2">
              <input required maxLength={120} value={heading} onChange={(event) => setHeading(event.target.value)} aria-label="Edit main terms heading" className="h-10 min-w-0 flex-1 rounded-lg border border-[#e4eae5] px-3 text-[11px] text-[#33473a] outline-none focus:border-[#8cbd9b]" />
              <button type="submit" disabled={saving} className="rounded-lg bg-[#176b4b] px-3 py-2 text-[10px] font-semibold text-white disabled:opacity-60">Save heading</button>
            </form>
          ) : null}
          <div>
            <div>
              <h3 className="text-[13px] font-semibold text-[#203328]">Terms in this heading</h3>
              <p className="mt-1 text-[10px] leading-5 text-[#849188]">Each added term is saved immediately and numbered automatically.</p>
            </div>
            <form onSubmit={(event) => void addTerm(event)} className="mt-4 space-y-3">
              <label className="block text-[10px] font-semibold text-[#465a4c]">
                Add a term
                <textarea required maxLength={1000} rows={3} value={termText} onChange={(event) => setTermText(event.target.value)} placeholder="Write one agreement term..." className="mt-1.5 w-full rounded-lg border border-[#e4eae5] bg-[#fcfdfc] px-3 py-2.5 text-[11px] font-normal text-[#33473a] outline-none focus:border-[#8cbd9b]" />
              </label>
              <label className="flex w-fit cursor-pointer items-center gap-2 text-[10px] font-semibold text-[#465a4c]">
                <input
                  type="checkbox"
                  checked={termImportantObligation}
                  onChange={(event) => setTermImportantObligation(event.target.checked)}
                  className="size-4 accent-[#176b4b]"
                />
                Important obligation
              </label>
              <div className="flex items-center justify-between gap-3">
                <span className="text-[9px] text-[#849188]">{termText.length}/1000</span>
                <button type="submit" disabled={saving || !termText.trim()} className="rounded-lg bg-[#176b4b] px-4 py-2.5 text-[10px] font-semibold text-white disabled:opacity-60">{saving ? "Saving..." : "Add term"}</button>
              </div>
            </form>
            {template.items.length ? (
              <ol className="mt-4 space-y-2">
                {template.items.map((item) => (
                  <li key={item.id} className="flex items-start gap-3 rounded-xl border border-[#e7ece7] bg-[#fbfcfb] p-3">
                    <span className="grid size-7 shrink-0 place-items-center rounded-full bg-[#e9f3eb] text-[10px] font-bold text-[#176b4b]">{item.position}</span>
                    {editingItemId === item.id ? (
                      <div className="min-w-0 flex-1 space-y-2">
                        <textarea autoFocus maxLength={1000} rows={3} value={editingItemText} onChange={(event) => setEditingItemText(event.target.value)} className="w-full rounded-lg border border-[#e4eae5] px-3 py-2 text-[11px] leading-5 text-[#33473a] outline-none focus:border-[#8cbd9b]" />
                        <label className="flex w-fit cursor-pointer items-center gap-2 text-[10px] font-semibold text-[#465a4c]">
                          <input
                            type="checkbox"
                            checked={editingItemImportantObligation}
                            onChange={(event) => setEditingItemImportantObligation(event.target.checked)}
                            className="size-4 accent-[#176b4b]"
                          />
                          Important obligation
                        </label>
                        <div className="flex gap-2">
                          <button type="button" onClick={() => void updateTerm(item)} disabled={saving || !editingItemText.trim()} className="rounded-md bg-[#176b4b] px-3 py-1.5 text-[10px] font-semibold text-white disabled:opacity-50">Save</button>
                          <button type="button" onClick={() => { setEditingItemId(null); setEditingItemText(""); }} className="rounded-md px-2 py-1.5 text-[10px] font-semibold text-[#58695e]">Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <div className="min-w-0 flex-1">
                        {item.importantObligation ? <span className="mb-1 inline-flex rounded-full bg-[#fff3d6] px-2 py-0.5 text-[9px] font-semibold text-[#805b13]">Important obligation</span> : null}
                        <p className="whitespace-pre-wrap text-[11px] leading-5 text-[#33473a]">{item.text}</p>
                      </div>
                    )}
                    {editingItemId !== item.id ? (
                      <button type="button" aria-label={`Edit term ${item.position}`} onClick={() => { setEditingItemId(item.id); setEditingItemText(item.text); setEditingItemImportantObligation(item.importantObligation); }} disabled={saving} className="rounded-md px-2 py-1 text-[10px] font-semibold text-[#355942] disabled:opacity-50">Edit</button>
                    ) : null}
                    <button type="button" aria-label={`Remove term ${item.position}`} onClick={() => void removeTerm(item)} disabled={saving} className="rounded-md px-2 py-1 text-[10px] font-semibold text-[#9a4a3d] disabled:opacity-50">Remove</button>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="mt-4 rounded-xl bg-[#f7faf7] p-4 text-[10px] leading-5 text-[#849188]">No terms added yet. Add the first term above.</p>
            )}
          </div>

        </div>
      )}
    </section>
  );
}

function DetailField({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-[#e7ece7] bg-[#fbfcfb] p-5 sm:p-6">
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#849188]">{label}</p>
      <p className="mt-2 whitespace-pre-wrap text-[15px] font-medium leading-6 text-[#263c2e]">{value}</p>
    </div>
  );
}

async function saveOwnerTermsRequest(body: Record<string, unknown>) {
  const response = await fetch("/api/owner/terms", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error || "Unable to save terms.");
  }
  return payload;
}

function AssetTermsMapping({
  asset,
  templates,
  onRefresh,
}: {
  asset: Asset;
  templates: TermTemplate[];
  onRefresh: () => Promise<void>;
}) {
  const [savingTemplateId, setSavingTemplateId] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function setMapped(template: TermTemplate, mapped: boolean) {
    setSavingTemplateId(template.id);
    setError("");
    try {
      await saveOwnerTermsRequest({
        action: "map-asset",
        templateId: template.id,
        assetId: asset.id,
        mapped,
      });
      await onRefresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to update this property's terms.");
    } finally {
      setSavingTemplateId(null);
    }
  }

  return (
    <section className="rounded-xl border border-[#e7ece7] bg-[#fbfcfb] p-4">
      <h3 className="text-[13px] font-semibold text-[#203328]">Agreement terms for this property</h3>
      <p className="mt-1 text-[10px] leading-5 text-[#849188]">Choose which reusable term headings apply to this asset.</p>
      {error ? <p role="alert" className="mt-3 rounded-lg bg-[#fff4ed] px-3 py-2 text-[10px] text-[#995634]">{error}</p> : null}
      {templates.length ? (
        <div className="mt-3 space-y-2">
          {templates.map((template) => (
            <label key={template.id} className="flex items-center gap-2 rounded-lg border border-[#edf0ed] bg-white px-3 py-2.5 text-[11px] text-[#465a4c]">
              <input
                type="checkbox"
                checked={template.assetIds.includes(asset.id)}
                disabled={savingTemplateId !== null}
                onChange={(event) => void setMapped(template, event.target.checked)}
                className="size-4 accent-[#176b4b]"
              />
              <span className="min-w-0 flex-1">{template.name}</span>
              <span className="text-[9px] text-[#849188]">{template.items.length} terms</span>
            </label>
          ))}
        </div>
      ) : (
        <p className="mt-3 text-[10px] leading-5 text-[#849188]">Create a terms heading in the Terms module to map it to this property.</p>
      )}
    </section>
  );
}

function formatAgreementDate(value: string) {
  const date = new Date(`${value.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value.slice(0, 10);
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

function getAgreementYear(value: string) {
  return value.slice(0, 4);
}

function TabPanelHeading({ title, description }: { title: string; description: string }) {
  return (
    <div className="border-b border-[#edf0ed] pb-4">
      <h3 className="text-[17px] font-semibold tracking-[-0.03em] text-[#203328] sm:text-[19px]">{title}</h3>
      <p className="mt-1.5 text-[12px] leading-5 text-[#849188] sm:text-[13px]">{description}</p>
    </div>
  );
}

function AgreementMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-2xl border border-[#e1ebe3] bg-gradient-to-br from-[#f6faf6] to-white p-5 sm:p-6">
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#6b8a76]">{label}</p>
      <p className="mt-3 break-words text-[19px] font-semibold tracking-[-0.03em] text-[#234b34] sm:text-[22px]">{value}</p>
    </div>
  );
}

function AgreementApprovalStatus({
  label,
  value,
  status,
}: {
  label: string;
  value?: string | null;
  status?: string;
}) {
  return (
    <div className="rounded-xl border border-[#e7ece7] bg-white px-4 py-3">
      <p className="text-[9px] font-bold uppercase tracking-[0.1em] text-[#829087]">{label}</p>
      <p className="mt-1 text-[11px] text-[#31483a]">
        {value
          ? new Date(value).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })
          : status === "DRAFT" ? "Awaiting approval" : "Not recorded for this agreement"}
      </p>
    </div>
  );
}

function AgreementStatusBadge({ status }: { status: AgreementStatus | null }) {
  const colorClass = status === "Expired"
    ? "bg-[#fff0ee] text-[#a8322a]"
    : status === "Expiring soon"
      ? "bg-[#fff7e8] text-[#9a6500]"
      : status === "Active" || status === "Approved"
        ? "bg-[#eaf5ed] text-[#286244]"
        : status === "Awaiting owner approval" || status === "Awaiting tenant approval"
          ? "bg-[#fff7e8] text-[#9a6500]"
        : "bg-[#f1f4f1] text-[#849188]";

  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-[9px] font-semibold ${colorClass}`}>
      {status ?? "—"}
    </span>
  );
}

function RecordDetailHeader({
  title,
  label,
  onBack,
  onEdit,
  onDelete,
  deleteDisabled = false,
}: {
  title: string;
  label: string;
  onBack: () => void;
  onEdit: () => void;
  onDelete: () => void;
  deleteDisabled?: boolean;
}) {
  return (
    <div className="flex flex-col justify-between gap-3 border-b border-[#edf0ed] px-5 py-4 sm:flex-row sm:items-center sm:px-6">
      <div>
        <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-[#6b8a76]">{label}</p>
        <h2 className="mt-1 text-[20px] font-semibold tracking-[-0.04em] text-[#17271e]">{title}</h2>
      </div>
      <div className="flex items-center gap-2">
        <button type="button" onClick={onEdit} className="rounded-lg border border-[#dfe8e1] bg-[#f7faf7] px-3 py-2 text-[10px] font-semibold text-[#355942]">Edit</button>
        <button type="button" onClick={onDelete} disabled={deleteDisabled} className="rounded-lg border border-[#f0d9d2] bg-[#fff8f7] px-3 py-2 text-[10px] font-semibold text-[#9a4a3d] disabled:cursor-not-allowed disabled:opacity-60">Delete</button>
        <button type="button" onClick={onBack} className="rounded-lg border border-[#dfe8e1] bg-[#f5f8f5] px-3 py-2 text-[10px] font-semibold text-[#355942]">Back to list</button>
      </div>
    </div>
  );
}

function TextField({ label, name, value, placeholder, setForm, type = "text", required = true }: { label: string; name: string; value: string; placeholder: string; setForm: React.Dispatch<React.SetStateAction<Record<string, string>>>; type?: string; required?: boolean }) {
  return <label className="mt-3 block text-[10px] font-semibold text-[#465a4c]">{label}<input required={required} name={name} type={type} min={type === "number" ? 0 : undefined} value={value} onChange={(event) => setForm((current) => ({ ...current, [name]: event.target.value }))} placeholder={placeholder} className="mt-1.5 h-10 w-full rounded-lg border border-[#e4eae5] bg-[#fcfdfc] px-3 text-[11px] font-normal text-[#33473a] outline-none placeholder:text-[#a8b1aa] focus:border-[#8cbd9b]" /></label>;
}

function SelectField({ label, name, value, options, setForm, required = true }: { label: string; name: string; value: string; options: string[][]; setForm: React.Dispatch<React.SetStateAction<Record<string, string>>>; required?: boolean }) {
  return <label className="block text-[10px] font-semibold text-[#465a4c]">{label}<select required={required} name={name} value={value} onChange={(event) => setForm((current) => ({ ...current, [name]: event.target.value }))} className="mt-1.5 h-10 w-full rounded-lg border border-[#e4eae5] bg-[#fcfdfc] px-3 text-[11px] font-normal text-[#33473a] outline-none focus:border-[#8cbd9b]"><option value="">Select {label.toLowerCase()}</option>{options.map(([optionValue, optionLabel]) => <option key={optionValue} value={optionValue}>{optionLabel}</option>)}</select></label>;
}
