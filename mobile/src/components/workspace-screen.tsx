import { useCallback, useEffect, useMemo, useState } from "react";
import { Contact, ContactField } from "expo-contacts";
import { File, Paths } from "expo-file-system";
import { readAsStringAsync, StorageAccessFramework } from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import * as ImagePicker from "expo-image-picker";
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Modal,
  Pressable,
  Platform,
  RefreshControl,
  ScrollView,
  Share,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  ArrowLeft,
  Building2,
  BookOpenText,
  Check,
  ChevronRight,
  CircleUserRound,
  Clock3,
  DoorOpen,
  ExternalLink,
  FileCheck2,
  KeyRound,
  LogOut,
  Menu,
  Plus,
  Pencil,
  ShieldCheck,
  Share2,
  Copy,
  UsersRound,
  X,
  Download,
  Folder,
} from "lucide-react-native";
import {
  ActionButton,
  Choice,
  Divider,
  EmptyState,
  Field,
  Heading,
  Notice,
  Page,
  Panel,
} from "@/components/ui";
import {
  approveAgreement,
  authenticatedRequest,
  createTenantPublicProfileLink,
  createPortfolioItem,
  downloadOwnerAgreementDocument,
  getAdminAccounts,
  getOwnerPortfolio,
  getTenantAgreements,
  getTenantPublicProfileLinks,
  mergeOwnerAgreements,
  resetAccountPassword,
  resetTenantProfileDetails,
  saveOwnerTerms,
  splitOwnerAgreement,
  shareAgreementPdf,
  updateOwnerProfile,
} from "@/lib/api";
import { clearSession, readApiBaseUrl, type MobileSession } from "@/lib/session";
import {
  addAgreementDuration,
  DEFAULT_AGREEMENT_DURATION_UNIT,
  DEFAULT_AGREEMENT_DURATION_VALUE,
  type AgreementDurationUnit,
} from "@/lib/agreement-duration";
import { colors } from "@/theme";

type Agreement = {
  id: string;
  agreementNumber: string;
  assetId?: string;
  tenantId?: string;
  startDate: string;
  endDate: string;
  monthlyRent: number;
  securityDeposit: number;
  terms: string;
  templateTerms?: AgreementTermGroup[];
  status: string;
  ownerApprovedAt?: string | null;
  mandatoryDetailsApprovedAt?: string | null;
  tenantApprovedAt?: string | null;
  agreementYear?: number;
  agreementDurationUnit?: AgreementDurationUnit;
  agreementDurationValue?: number;
  mergedIntoAgreementId?: string | null;
  mergedAssetIds?: string[];
  createdAt?: string;
};

type Company = { id: string; name: string };
type Building = {
  id: string;
  companyId?: string | null;
  name: string;
  address: string;
  city: string;
  state: string;
  postalCode: string;
  panchayat?: string | null;
};
type Asset = {
  id: string;
  buildingId?: string;
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
  tenantIds?: string[];
  buildingName?: string;
  buildingAddress?: string;
  city?: string;
  state?: string;
  templateIds?: string[];
  agreementDurationUnit?: AgreementDurationUnit;
  agreementDurationValue?: number;
  agreementStartDate?: string | null;
};
type TermItem = { id: string; position: number; text: string; importantObligation: boolean };
type AgreementTermGroup = {
  templateId: string;
  heading: string;
  items: TermItem[];
};

function dedupeAgreementTermGroups(groups: AgreementTermGroup[] | undefined) {
  if (!groups?.length) return [] as AgreementTermGroup[];
  const deduped = new Map<string, AgreementTermGroup>();
  for (const group of groups) {
    const heading = group.heading.trim();
    const existing = deduped.get(heading) ?? { ...group, items: [] };
    const seen = new Set(existing.items.map((item) => item.text.trim()));
    const nextItems = [...existing.items];
    for (const item of group.items) {
      const text = item.text.trim();
      if (!text || seen.has(text)) continue;
      nextItems.push({ ...item, text });
      seen.add(text);
    }
    deduped.set(heading, { ...existing, items: nextItems });
  }
  return [...deduped.values()].map((group) => ({
    ...group,
    items: group.items.map((item, index) => ({ ...item, position: index + 1 })),
  }));
}
type TermTemplate = {
  id: string;
  name: string;
  items: TermItem[];
  assetIds: string[];
};
type Tenant = {
  id: string;
  fullName: string;
  mobileNumber?: string | null;
  businessName?: string | null;
  businessNature?: string | null;
  fullAddress?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  district?: string | null;
  state?: string | null;
  city?: string | null;
  postalCode?: string | null;
  aadhaarNumber?: string | null;
  fatherName?: string | null;
  email?: string | null;
  photoDataUrl?: string | null;
  assetIds?: string[];
  publicShareEnabled?: boolean;
};
type Portfolio = {
  owner: { id: string; fullName: string; mobileNumber: string; email?: string | null };
  companies: Company[];
  buildings: Building[];
  assets: Asset[];
  tenants: Tenant[];
  agreements: Agreement[];
  deletedAgreements: ArchivedAgreement[];
  termsTemplates: TermTemplate[];
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
type TenantPortal = {
  tenant: Tenant;
  agreements: Agreement[];
  assets: Asset[];
  buildings?: Building[];
};
type Account = {
  id: string;
  fullName: string;
  mobileNumber: string;
  createdAt: string;
};
type AdminAccounts = { owners: Account[]; tenants: Account[] };
type Profile = {
  id: string;
  fullName: string;
  mobileNumber: string;
  email: string | null;
  aadhaarNumber?: string | null;
  fullAddress?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  district?: string | null;
  state?: string | null;
  city?: string | null;
  postalCode?: string | null;
  fatherName?: string | null;
  passwordConfigured: boolean;
};

type ReviewValues = {
  startDate: string;
  monthlyRent: string;
  securityDeposit: string;
  terms: string;
};
type ApprovalDetails = {
  ownerFullName: string;
  ownerAadhaarNumber: string;
  ownerAddressLine1: string;
  ownerAddressLine2: string;
  ownerDistrict: string;
  ownerState: string;
  ownerCity: string;
  ownerPostalCode: string;
  ownerFatherName: string;
  tenantFullName: string;
  tenantMobileNumber: string;
  tenantBusinessName: string;
  tenantBusinessNature: string;
  tenantAddressLine1: string;
  tenantAddressLine2: string;
  tenantDistrict: string;
  tenantState: string;
  tenantCity: string;
  tenantPostalCode: string;
  tenantAadhaarNumber: string;
  buildingAddress: string;
  buildingCity: string;
  buildingState: string;
  buildingPostalCode: string;
  buildingPanchayat: string;
  assetWard: string;
  assetRoomNumber: string;
};

function initialApprovalDetails(
  agreement: Agreement | null,
  owner: Profile | null | undefined,
  portfolio: Portfolio | null,
  portal: TenantPortal | null,
  tenantOverride?: Pick<Tenant, "fullName" | "mobileNumber"> &
    Partial<Pick<Tenant, "businessName" | "businessNature" | "addressLine1" | "addressLine2" | "district" | "state" | "city" | "postalCode" | "aadhaarNumber">>,
  assetOverride?: Pick<Asset, "name" | "unitNumber" | "buildingName" | "buildingAddress" | "city" | "state">,
): ApprovalDetails {
  const asset = agreement
    ? portfolio?.assets.find((item) => item.id === agreement.assetId)
      ?? portal?.assets.find((item) => item.id === agreement.assetId)
    : undefined;
  const tenant = tenantOverride ?? (agreement
    ? portfolio?.tenants.find((item) => item.id === agreement.tenantId) ?? portal?.tenant
    : undefined);
  const building = asset && portfolio
    ? portfolio.buildings.find((item) => item.id === asset.buildingId)
    : undefined;
  return {
    ownerFullName: owner?.fullName ?? "",
    ownerAadhaarNumber: owner?.aadhaarNumber ?? "",
    ownerAddressLine1: owner?.addressLine1 ?? "",
    ownerAddressLine2: owner?.addressLine2 ?? "",
    ownerDistrict: owner?.district ?? "",
    ownerState: owner?.state ?? "",
    ownerCity: owner?.city ?? "",
    ownerPostalCode: owner?.postalCode ?? "",
    ownerFatherName: owner?.fatherName ?? "",
    tenantFullName: tenant?.fullName ?? "",
    tenantMobileNumber: tenant?.mobileNumber ?? "",
    tenantBusinessName: tenant?.businessName ?? "",
    tenantBusinessNature: tenant?.businessNature ?? "",
    tenantAddressLine1: tenant?.addressLine1 ?? "",
    tenantAddressLine2: tenant?.addressLine2 ?? "",
    tenantDistrict: tenant?.district ?? "",
    tenantState: tenant?.state ?? "",
    tenantCity: tenant?.city ?? "",
    tenantPostalCode: tenant?.postalCode ?? "",
    tenantAadhaarNumber: tenant?.aadhaarNumber ?? "",
    buildingAddress: building?.address ?? assetOverride?.buildingAddress ?? asset?.buildingAddress ?? "",
    buildingCity: building?.city ?? assetOverride?.city ?? asset?.city ?? "",
    buildingState: building?.state ?? assetOverride?.state ?? asset?.state ?? "",
    buildingPostalCode: building?.postalCode ?? "",
    buildingPanchayat: building?.panchayat ?? "",
    assetWard: asset?.ward ?? "",
    assetRoomNumber: asset?.roomNumber ?? "",
  };
}

type CreateKind = "company" | "building" | "asset" | "tenant";
type AdminType = "OWNER" | "TENANT";
type OwnerModule = "companies" | "buildings" | "assets" | "tenants" | "agreements" | "terms" | "approvals" | "deletedAgreements";
type TenantDetailTab = "kyc" | "assets" | "agreements";
type AgreementDetailTab = "kyc" | "rent" | "expiry" | "advance" | "terms";
type CompanyDetailTab = "details" | "buildings";
type BuildingDetailTab = "details" | "assets";
type AssetDetailTab = "details" | "tenants" | "agreements";

const ownerModules: { id: OwnerModule; label: string; createKind: CreateKind | null }[] = [
  { id: "companies", label: "Companies", createKind: "company" },
  { id: "buildings", label: "Buildings", createKind: "building" },
  { id: "assets", label: "Assets", createKind: "asset" },
  { id: "tenants", label: "Tenants", createKind: "tenant" },
  { id: "agreements", label: "Agreements", createKind: null },
  { id: "terms", label: "Terms", createKind: null },
  { id: "approvals", label: "Approvals", createKind: null },
  { id: "deletedAgreements", label: "Deleted agreements", createKind: null },
];

function dateOnly(value?: string | null) {
  if (!value) return "";
  return value.slice(0, 10);
}

function localToday() {
  const today = new Date();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `${today.getFullYear()}-${month}-${day}`;
}

function normalizeOwnerPortfolio(portfolio: Portfolio): Portfolio {
  return {
    ...portfolio,
    companies: portfolio.companies ?? [],
    buildings: portfolio.buildings ?? [],
    assets: portfolio.assets ?? [],
    tenants: portfolio.tenants ?? [],
    agreements: portfolio.agreements ?? [],
    deletedAgreements: portfolio.deletedAgreements ?? [],
    termsTemplates: (portfolio.termsTemplates ?? []).map((template) => ({
      ...template,
      items: template.items ?? [],
      assetIds: template.assetIds ?? [],
    })),
  };
}

function money(value?: number | null) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value ?? 0);
}

function shortDate(value?: string | null) {
  if (!value) return "—";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? dateOnly(value)
    : parsed.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

async function buildTenantProfileUrl(token: string) {
  const encodedToken = encodeURIComponent(token);
  if (Platform.OS === "web" && typeof window !== "undefined") {
    return `${window.location.origin}/share/tenant/${encodedToken}`;
  }
  const baseUrl = await readApiBaseUrl();
  const publicUrl = new URL(baseUrl);
  if (
    ["localhost", "127.0.0.1"].includes(publicUrl.hostname) &&
    publicUrl.port === "3001"
  ) {
    publicUrl.port = "3000";
  }
  publicUrl.pathname = `/share/tenant/${encodedToken}`;
  return publicUrl.toString();
}

function titleCase(value: string) {
  return value.toLowerCase().replace(/(^|\s)\S/g, (match) => match.toUpperCase());
}

function getAgreementState(agreement: Agreement) {
  if (agreement.status === "CANCELLED") return "Cancelled";
  if (agreement.status === "ACTIVE") return "Active";
  if (agreement.ownerApprovedAt) return "Approved";
  return "Draft";
}

function isApprovedAgreement(agreement: Agreement) {
  return agreement.status === "ACTIVE" &&
    Boolean(agreement.ownerApprovedAt) &&
    Boolean(agreement.mandatoryDetailsApprovedAt);
}

function pendingOwnerApprovals(portfolio: Portfolio) {
  return portfolio.agreements.filter(
    (agreement) =>
      agreement.status === "DRAFT" ||
      (agreement.status === "ACTIVE" && !agreement.mandatoryDetailsApprovedAt),
  );
}

export default function WorkspaceScreen({
  session,
  onSignedOut,
}: {
  session: MobileSession;
  onSignedOut: () => void;
}) {
  const [section, setSection] = useState(
    session.role === "SUPER_ADMIN"
      ? "Owners"
      : session.role === "TENANT"
        ? "Home"
        : "Home",
  );
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [tenantPortal, setTenantPortal] = useState<TenantPortal | null>(null);
  const [accounts, setAccounts] = useState<AdminAccounts>({ owners: [], tenants: [] });
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [createKind, setCreateKind] = useState<CreateKind | null>(null);
  const [editingRecordId, setEditingRecordId] = useState<string | null>(null);
  const [reviewing, setReviewing] = useState<{
    agreement: Agreement;
    readOnly: boolean;
    portfolio?: Portfolio;
    profile?: Profile;
  } | null>(null);
  const [openingReview, setOpeningReview] = useState(false);
  const [resetAccount, setResetAccount] = useState<{ account: Account; type: AdminType } | null>(null);

  async function openReview(agreement: Agreement, readOnly = false) {
    if (session.role !== "OWNER" || readOnly) {
      setReviewing({ agreement, readOnly: true });
      return;
    }

    setOpeningReview(true);
    setError("");
    try {
      const [portfolioResponse, nextProfile] = await Promise.all([
        getOwnerPortfolio<Portfolio>(session),
        authenticatedRequest<{ profile: Profile }>(session, "/api/owner/profile", { cache: "no-store" }),
      ]);
      const nextPortfolio = normalizeOwnerPortfolio(portfolioResponse);
      const currentAgreement = nextPortfolio.agreements.find((item) => item.id === agreement.id);
      if (!currentAgreement) {
        throw new Error("This agreement is no longer available. Refresh your workspace and try again.");
      }

      setPortfolio(nextPortfolio);
      setProfile(nextProfile.profile);
      setReviewing({
        agreement: currentAgreement,
        readOnly: false,
        portfolio: nextPortfolio,
        profile: nextProfile.profile,
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to refresh agreement details.");
    } finally {
      setOpeningReview(false);
    }
  }

  const loadData = useCallback(async () => {
    try {
      if (session.role === "OWNER") {
        const [portfolioResponse, nextProfile] = await Promise.all([
          getOwnerPortfolio<Portfolio>(session),
          authenticatedRequest<{ profile: Profile }>(session, "/api/owner/profile"),
        ]);
        const nextPortfolio = normalizeOwnerPortfolio(portfolioResponse);
        setError("");
        setPortfolio(nextPortfolio);
        setProfile(nextProfile.profile);
      } else if (session.role === "TENANT") {
        const nextPortal = await getTenantAgreements<TenantPortal>(session);
        setError("");
        setTenantPortal(nextPortal);
      } else {
        const nextAccounts = await getAdminAccounts<AdminAccounts>(session);
        setError("");
        setAccounts(nextAccounts);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load your workspace.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [session]);

  useEffect(() => {
    const request = setTimeout(() => void loadData(), 0);
    return () => clearTimeout(request);
  }, [loadData]);

  const refresh = useCallback(() => {
    setRefreshing(true);
    setError("");
    void loadData();
  }, [loadData]);

  async function signOut() {
    await clearSession();
    onSignedOut();
  }

  return (
    <View style={styles.screen}>
      {session.role === "OWNER" ? (
        portfolio ? (
          <OwnerPortfolio
            portfolio={portfolio}
            profile={profile}
            session={session}
            error={error}
            refreshing={refreshing}
            onRefresh={refresh}
            onCreate={setCreateKind}
            onEdit={(kind, id) => {
              setCreateKind(kind);
              setEditingRecordId(id);
            }}
            onReview={openReview}
            onProfileSaved={loadData}
            onPortfolioChanged={loadData}
            onSignOut={() => void signOut()}
          />
        ) : loading ? (
          <WorkspaceLoading />
        ) : (
          <Page>
            {error ? <Notice message={error} /> : null}
            <EmptyState title="Portfolio unavailable" text="Check your internet connection, then try again." />
          </Page>
        )
      ) : (
        <>
          <View style={styles.topBar}>
            <View style={styles.brandLine}>
              <View style={styles.brandIcon}>
                {session.role === "SUPER_ADMIN" ? (
                  <ShieldCheck size={18} color={colors.white} />
                ) : (
                  <Building2 size={18} color={colors.white} />
                )}
              </View>
              <View style={styles.brandTextWrap}>
                <Text style={styles.brandTitle}>Rent-Sync</Text>
                <Text style={styles.brandRole}>
                  {session.role === "SUPER_ADMIN" ? "Platform" : titleCase(session.role)}
                </Text>
              </View>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel="Sign out" onPress={() => void signOut()} style={styles.signOut}>
              <LogOut size={17} color={colors.forest} />
            </Pressable>
          </View>

          {session.role === "SUPER_ADMIN" ? (
            <View style={styles.adminNotice}>
              <ShieldCheck size={15} color={colors.forest} />
              <Text style={styles.adminNoticeText}>Account access</Text>
            </View>
          ) : null}

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.sectionTabs}
          >
            {(session.role === "SUPER_ADMIN" ? ["Owners", "Tenants"] : ["Home", "Agreements"]).map((item) => (
              <Pressable
                key={item}
                accessibilityRole="button"
                accessibilityState={{ selected: section === item }}
                onPress={() => setSection(item)}
                style={[styles.sectionTab, section === item && styles.sectionTabSelected]}
              >
                <Text style={[styles.sectionTabText, section === item && styles.sectionTabTextSelected]}>
                  {item}
                </Text>
              </Pressable>
            ))}
          </ScrollView>

          {loading ? (
            <WorkspaceLoading />
          ) : (
            <Page
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={refresh}
                  tintColor={colors.forest}
                  colors={[colors.forest]}
                />
              }
            >
              {error ? <Notice message={error} /> : null}
              {session.role === "TENANT" && tenantPortal ? (
                <TenantWorkspace
                  section={section}
                  portal={tenantPortal}
                  onReview={openReview}
                />
              ) : null}
              {session.role === "TENANT" && !tenantPortal && error ? (
                <EmptyState title="Workspace unavailable" text="Check your internet connection, then pull down to retry." />
              ) : null}
              {session.role === "SUPER_ADMIN" ? (
                <AdminWorkspace
                  type={section === "Tenants" ? "TENANT" : "OWNER"}
                  accounts={accounts}
                  hasLoadError={Boolean(error)}
                  onReset={setResetAccount}
                />
              ) : null}
            </Page>
          )}
        </>
      )}

      <CreateSheet
        key={`${createKind ?? "create-closed"}:${editingRecordId ?? "new"}`}
        kind={createKind}
        recordId={editingRecordId}
        portfolio={portfolio}
        session={session}
        onClose={() => {
          setCreateKind(null);
          setEditingRecordId(null);
        }}
        onCreated={() => {
          setCreateKind(null);
          setEditingRecordId(null);
          refresh();
        }}
      />
      <AgreementReviewSheet
        key={reviewing ? `${reviewing.agreement.id}:${reviewing.readOnly}` : "review-closed"}
        agreement={reviewing?.agreement ?? null}
        readOnly={reviewing?.readOnly ?? false}
        session={session}
        portal={tenantPortal}
        portfolio={reviewing?.portfolio ?? portfolio}
        ownerProfile={reviewing?.profile ?? profile}
        onClose={() => setReviewing(null)}
        onSignOut={() => void signOut()}
        onApproved={() => {
          setReviewing(null);
          refresh();
        }}
      />
      {openingReview ? (
        <View style={styles.reviewRefreshingOverlay} accessibilityRole="progressbar">
          <ActivityIndicator size="small" color={colors.forest} />
          <Text style={styles.reviewRefreshingText}>Refreshing latest agreement details...</Text>
        </View>
      ) : null}
      <PasswordSheet
        key={resetAccount?.account.id ?? "password-closed"}
        selected={resetAccount}
        session={session}
        onClose={() => setResetAccount(null)}
        onReset={() => {
          setResetAccount(null);
          refresh();
        }}
      />
    </View>
  );
}

function WorkspaceLoading() {
  return (
    <View style={styles.loading}>
      <ActivityIndicator color={colors.forest} size="large" />
      <Text style={styles.loadingText}>Opening your workspace</Text>
    </View>
  );
}

function OwnerPortfolio({
  portfolio,
  profile,
  session,
  error,
  refreshing,
  onRefresh,
  onCreate,
  onEdit,
  onReview,
  onProfileSaved,
  onPortfolioChanged,
  onSignOut,
}: {
  portfolio: Portfolio;
  profile: Profile | null;
  session: MobileSession;
  error: string;
  refreshing: boolean;
  onRefresh: () => void;
  onCreate: (kind: CreateKind) => void;
  onEdit: (kind: CreateKind, id: string) => void;
  onReview: (agreement: Agreement, readOnly?: boolean) => void;
  onProfileSaved: () => Promise<void>;
  onPortfolioChanged: () => Promise<void>;
  onSignOut: () => void;
}) {
  const [module, setModule] = useState<OwnerModule>("companies");
  const [recordId, setRecordId] = useState<string | null>(null);
  const [selectedAgreementYear, setSelectedAgreementYear] = useState<number | null>(null);
  const [selectedAgreementBuildingId, setSelectedAgreementBuildingId] = useState<string | null>(null);
  const [selectedApprovalYear, setSelectedApprovalYear] = useState<number | null>(null);
  const [selectedApprovalBuildingId, setSelectedApprovalBuildingId] = useState<string | null>(null);
  const [selectedAssetBuildingId, setSelectedAssetBuildingId] = useState<string | null>(null);
  const [selectedTenantBuildingId, setSelectedTenantBuildingId] = useState<string | null>(null);
  const [companySection, setCompanySection] = useState<"owner" | "company">("owner");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [createTermOpen, setCreateTermOpen] = useState(false);
  const [resettingTenantId, setResettingTenantId] = useState<string | null>(null);
  const [tenantResetError, setTenantResetError] = useState<{ tenantId: string; message: string } | null>(null);
  const moduleConfig = ownerModules.find((item) => item.id === module) ?? ownerModules[0];
  const recordTitle = recordId ? ownerRecordTitle(module, recordId, portfolio) : null;
  const title = profileOpen
    ? "Profile"
    : recordId
      ? recordTitle ?? "Record"
      : module === "agreements" && selectedAgreementYear !== null
        ? `Agreements · ${selectedAgreementYear}`
        : module === "approvals" && selectedApprovalYear !== null
        ? `Approvals · ${selectedApprovalYear}`
        : moduleConfig.label;

  function selectModule(next: OwnerModule) {
    setModule(next);
    setRecordId(null);
    setSelectedAgreementYear(null);
    setSelectedApprovalYear(null);
    if (next === "companies") setCompanySection("owner");
    setProfileOpen(false);
    setDrawerOpen(false);
  }

  function goBack() {
    if (profileOpen) {
      setProfileOpen(false);
    } else if (selectedAgreementYear !== null) {
      setSelectedAgreementYear(null);
    } else if (selectedApprovalYear !== null) {
      setSelectedApprovalYear(null);
    } else {
      setRecordId(null);
    }
  }

  async function resetTenantFromList(tenant: Tenant) {
    if (resettingTenantId) return;
    const message = `Clear all details for ${tenant.fullName} except the tenant name? Assigned assets and agreement details will stay unchanged. Current agreements will return to approval after the tenant details are completed again.`;
    const confirmed = Platform.OS === "web" && typeof window !== "undefined"
      ? window.confirm(message)
      : await new Promise<boolean>((resolve) => {
          Alert.alert(
            "Reset tenant details?",
            message,
            [
              { text: "Cancel", style: "cancel", onPress: () => resolve(false) },
              { text: "Reset details", style: "destructive", onPress: () => resolve(true) },
            ],
            { cancelable: true, onDismiss: () => resolve(false) },
          );
        });
    if (!confirmed) return;

    setResettingTenantId(tenant.id);
    setTenantResetError(null);
    try {
      await resetTenantProfileDetails<{ success: boolean }>(session, tenant.id);
      await onPortfolioChanged();
    } catch (cause) {
      setTenantResetError({
        tenantId: tenant.id,
        message: cause instanceof Error ? cause.message : "Unable to reset tenant details.",
      });
    } finally {
      setResettingTenantId(null);
    }
  }

  const allRows = ownerModuleRows(module, portfolio);
  const approvedAgreements = module === "agreements"
    ? portfolio.agreements.filter(isApprovedAgreement)
    : [];
  const agreementYears = module === "agreements"
    ? Array.from(new Set(approvedAgreements.map(
      (agreement) => Number(agreement.startDate.slice(0, 4)),
    ))).sort((left, right) => right - left)
    : [];
  const pendingApprovals = module === "approvals" ? pendingOwnerApprovals(portfolio) : [];
  const approvalYears = module === "approvals"
    ? Array.from(new Set(pendingApprovals.map(
      (agreement) => Number(agreement.startDate.slice(0, 4)),
    ))).sort((left, right) => right - left)
    : [];
  const rows = module === "agreements" && selectedAgreementYear !== null
    ? allRows.filter((row) => {
      const agreement = approvedAgreements.find((item) => item.id === row.id);
      return agreement && Number(agreement.startDate.slice(0, 4)) === selectedAgreementYear;
    })
    : module === "agreements"
      ? agreementYears.map((year) => ({
        id: `year-${year}`,
        title: String(year),
        subtitle: `${approvedAgreements.filter((agreement) =>
          Number(agreement.startDate.slice(0, 4)) === year,
        ).length} agreements`,
      }))
    : module === "approvals" && selectedApprovalYear !== null
      ? allRows.filter((row) => {
        const agreement = pendingApprovals.find((item) => item.id === row.id);
        return agreement && Number(agreement.startDate.slice(0, 4)) === selectedApprovalYear;
      })
      : module === "approvals"
        ? approvalYears.map((year) => ({
          id: `approval-year-${year}`,
          title: String(year),
          subtitle: `${pendingApprovals.filter((agreement) =>
            Number(agreement.startDate.slice(0, 4)) === year,
          ).length} pending approvals`,
        }))
        : module === "companies" && companySection === "owner"
          ? []
          : allRows;
  const buildingTabs = [
    ...portfolio.buildings.map((building) => ({ id: building.id, label: building.name })),
    { id: module === "assets" ? "__vacant__" : "__unassigned__", label: module === "assets" ? "Vacant" : "Unassigned" },
  ];
  const visibleRows = module === "assets" && selectedAssetBuildingId !== null
    ? rows.filter((row) => {
      const asset = portfolio.assets.find((item) => item.id === row.id);
      if (!asset) return false;
      if (selectedAssetBuildingId === "__vacant__") return !(asset.tenantIds ?? []).length;
      return asset.buildingId === selectedAssetBuildingId;
    })
    : module === "tenants" && selectedTenantBuildingId !== null
      ? rows.filter((row) => {
        const tenant = portfolio.tenants.find((item) => item.id === row.id);
        if (!tenant) return false;
        if (selectedTenantBuildingId === "__unassigned__") return !(tenant.assetIds ?? []).length;
        return (tenant.assetIds ?? []).some((assetId) => {
          const asset = portfolio.assets.find((item) => item.id === assetId);
          return Boolean(asset && asset.buildingId === selectedTenantBuildingId);
        });
      })
      : module === "agreements" && selectedAgreementYear !== null && selectedAgreementBuildingId !== null
        ? rows.filter((row) => {
          const agreement = approvedAgreements.find((item) => item.id === row.id);
          if (!agreement) return false;
          const asset = agreement.assetId ? portfolio.assets.find((item) => item.id === agreement.assetId) : undefined;
          if (selectedAgreementBuildingId === "__unassigned__") return !asset?.buildingId;
          return asset?.buildingId === selectedAgreementBuildingId;
        })
        : module === "approvals" && selectedApprovalYear !== null && selectedApprovalBuildingId !== null
          ? rows.filter((row) => {
            const agreement = pendingApprovals.find((item) => item.id === row.id);
            if (!agreement) return false;
            const asset = agreement.assetId ? portfolio.assets.find((item) => item.id === agreement.assetId) : undefined;
            if (selectedApprovalBuildingId === "__unassigned__") return !asset?.buildingId;
            return asset?.buildingId === selectedApprovalBuildingId;
          })
          : rows;

  useEffect(() => {
    if (module === "assets" && selectedAssetBuildingId === null && portfolio.buildings.length) {
      setSelectedAssetBuildingId(portfolio.buildings[0].id);
    }
    if (module === "tenants" && selectedTenantBuildingId === null && portfolio.buildings.length) {
      setSelectedTenantBuildingId(portfolio.buildings[0].id);
    }
    if (module === "agreements" && selectedAgreementYear !== null && selectedAgreementBuildingId === null && portfolio.buildings.length) {
      setSelectedAgreementBuildingId(portfolio.buildings[0].id);
    }
    if (module === "approvals" && selectedApprovalYear !== null && selectedApprovalBuildingId === null && pendingApprovals.length && portfolio.buildings.length) {
      setSelectedApprovalBuildingId(portfolio.buildings[0].id);
    }
  }, [module, pendingApprovals, portfolio.buildings, selectedAgreementBuildingId, selectedAgreementYear, selectedApprovalBuildingId, selectedApprovalYear, selectedAssetBuildingId, selectedTenantBuildingId]);

  const emptyTitle: Record<OwnerModule, string> = {
    companies: "No companies yet",
    buildings: "No buildings yet",
    assets: "No assets yet",
    tenants: "No tenants yet",
    agreements: "No approved agreements yet",
    terms: "No reusable terms headings yet",
    approvals: "No pending approvals",
    deletedAgreements: "No deleted agreements",
  };

  return (
    <View style={styles.ownerRoot}>
      <View style={styles.ownerHeader}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={recordId || profileOpen || selectedAgreementYear !== null || selectedApprovalYear !== null ? "Back" : "Open navigation"}
          onPress={() => (recordId || profileOpen || selectedAgreementYear !== null || selectedApprovalYear !== null ? goBack() : setDrawerOpen(true))}
          style={styles.ownerHeaderButton}
        >
          {recordId || profileOpen || selectedAgreementYear !== null || selectedApprovalYear !== null
            ? <ArrowLeft size={20} color={colors.forest} />
            : <Menu size={21} color={colors.forest} />}
        </Pressable>
        <Text numberOfLines={1} style={styles.ownerHeaderTitle}>{title}</Text>
        {profileOpen ? (
          <View style={styles.ownerHeaderButton} />
        ) : !recordId && module === "terms" ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Create main terms"
            onPress={() => setCreateTermOpen(true)}
            style={styles.ownerHeaderButton}
          >
            <Plus size={20} color={colors.forest} />
          </Pressable>
        ) : !recordId && moduleConfig.createKind ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Add ${moduleConfig.createKind}`}
            onPress={() => {
              if (moduleConfig.createKind) onCreate(moduleConfig.createKind);
            }}
            style={styles.ownerHeaderButton}
          >
            <Plus size={20} color={colors.forest} />
          </Pressable>
        ) : recordId && (module === "companies" || module === "buildings" || module === "assets" || module === "tenants") ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Edit ${module === "companies" ? "company" : module === "buildings" ? "building" : module === "assets" ? "asset" : "tenant"}`}
            onPress={() => onEdit(
              module === "companies" ? "company" : module === "buildings" ? "building" : module === "assets" ? "asset" : "tenant",
              recordId,
            )}
            style={styles.ownerHeaderButton}
          >
            <Pencil size={18} color={colors.forest} />
          </Pressable>
        ) : (
          <View style={styles.ownerHeaderButton} />
        )}
      </View>

      {error ? <View style={styles.ownerError}><Notice message={error} /></View> : null}
      <ScrollView
        style={styles.ownerScroll}
        contentContainerStyle={styles.ownerContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.forest}
            colors={[colors.forest]}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {!profileOpen && !recordId && module === "companies" ? (
          <>
            <OwnerDetailTabs
              value={companySection}
              tabs={[
                { id: "owner", label: "Owner Details" },
                { id: "company", label: "Company Details" },
              ]}
              onChange={(value) => setCompanySection(value as "owner" | "company")}
            />
            {companySection === "owner" ? (
              <ProfilePanel
                key={profile?.id ?? "owner-details-loading"}
                session={session}
                profile={profile}
                onSaved={onProfileSaved}
              />
            ) : null}
          </>
        ) : null}
        {profileOpen ? (
          <>
            <ProfilePanel
              key={profile?.id ?? "profile-loading"}
              session={session}
              profile={profile}
              onSaved={onProfileSaved}
            />
            <Panel style={styles.ownerPanel}>
              <Fact label="Sign-in number" value={profile?.mobileNumber ?? session.mobileNumber} />
            </Panel>
          </>
        ) : recordId ? (
          module === "deletedAgreements" ? (
            <ArchivedAgreementDetail
              agreement={portfolio.deletedAgreements.find((item) => item.id === recordId) ?? null}
              onBack={() => setRecordId(null)}
            />
          ) : module === "terms" ? (
            <OwnerTermsPage
              template={portfolio.termsTemplates.find((item) => item.id === recordId) ?? null}
              session={session}
              onChanged={onPortfolioChanged}
            />
          ) : (
            <OwnerRecordDetail
              key={`${module}:${recordId}`}
              module={module}
              recordId={recordId}
              portfolio={portfolio}
              session={session}
              onReview={onReview}
              onChanged={onPortfolioChanged}
              onNavigate={(nextModule, id) => {
                setModule(nextModule);
                setRecordId(id);
              }}
            />
          )
        ) : (
          <>
            {module === "buildings" ? (
              <BuildingTotalsDashboard assets={portfolio.assets} />
            ) : null}
            {((module === "assets" && selectedAssetBuildingId !== null) || (module === "tenants" && selectedTenantBuildingId !== null) || (module === "agreements" && selectedAgreementYear !== null) || (module === "approvals" && selectedApprovalYear !== null)) && buildingTabs.length ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.ownerDetailTabs}>
                {buildingTabs.map((tab) => {
                  const selected = module === "assets"
                    ? selectedAssetBuildingId === tab.id
                    : module === "tenants"
                      ? selectedTenantBuildingId === tab.id
                      : module === "agreements"
                      ? selectedAgreementBuildingId === tab.id
                      : selectedApprovalBuildingId === tab.id;
                  return (
                    <Pressable
                      key={tab.id}
                      accessibilityRole="tab"
                      accessibilityState={{ selected }}
                      onPress={() => {
                      if (module === "assets") setSelectedAssetBuildingId(tab.id);
                      if (module === "tenants") setSelectedTenantBuildingId(tab.id);
                      if (module === "agreements") setSelectedAgreementBuildingId(tab.id);
                      if (module === "approvals") setSelectedApprovalBuildingId(tab.id);
                      }}
                      style={[styles.ownerDetailTab, selected && styles.ownerDetailTabSelected]}
                    >
                      <Text style={[styles.ownerDetailTabText, selected && styles.ownerDetailTabTextSelected]}>{tab.label}</Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            ) : null}
            <Text style={styles.ownerRecordCount}>
              {visibleRows.length} {visibleRows.length === 1 ? "record" : "records"}
            </Text>
            {visibleRows.length ? visibleRows.map((row) => {
              const asset = module === "assets" ? portfolio.assets.find((item) => item.id === row.id) : undefined;
              const tenant = module === "tenants" ? portfolio.tenants.find((item) => item.id === row.id) : undefined;
              const missingFields = module === "assets"
                ? getAssetCompletionIssues(asset)
                : module === "tenants"
                  ? getTenantCompletionIssues(tenant)
                  : [];
              const completeLabel = module === "assets" ? "Complete entry" : module === "tenants" ? "Complete profile" : "Review";
              const completeAction = missingFields.length
                ? () => {
                    const missingText = missingFields.map((field) => field.replace(/\b\w/g, (letter) => letter.toUpperCase())).join(", ");
                    const openForm = () => {
                      if (module === "assets") onEdit("asset", row.id);
                      if (module === "tenants") onEdit("tenant", row.id);
                    };
                    if (Platform.OS === "web" && typeof window !== "undefined") {
                      if (window.confirm(`Missing required fields: ${missingText}.\n\nOpen the form to complete them?`)) openForm();
                      return;
                    }
                    Alert.alert(
                      module === "assets" ? "Complete unit entry" : "Complete tenant profile",
                      `Missing required fields: ${missingText}`,
                      [
                        { text: "Cancel", style: "cancel" },
                        { text: "Open form", onPress: openForm },
                      ],
                    );
                  }
                : undefined;
              if (module === "agreements" && selectedAgreementYear === null) {
                return (
                  <Pressable
                    key={row.id}
                    accessibilityRole="button"
                    accessibilityLabel={`Open agreements for ${row.title}`}
                    onPress={() => setSelectedAgreementYear(Number(row.title))}
                    style={({ pressed }) => [styles.ownerRow, pressed && styles.pressed]}
                  >
                    <View style={styles.ownerRowIcon}><Folder size={19} color={colors.forest} /></View>
                    <View style={styles.flexOne}>
                      <Text numberOfLines={1} style={styles.ownerRowTitle}>{row.title}</Text>
                      <Text numberOfLines={2} style={styles.ownerRowSubtitle}>{row.subtitle}</Text>
                    </View>
                    <ChevronRight size={17} color={colors.muted} />
                  </Pressable>
                );
              }
              if (module === "approvals" && selectedApprovalYear === null) {
                return (
                  <Pressable
                    key={row.id}
                    accessibilityRole="button"
                    accessibilityLabel={`Open approvals for ${row.title}`}
                    onPress={() => setSelectedApprovalYear(Number(row.title))}
                    style={({ pressed }) => [styles.ownerRow, pressed && styles.pressed]}
                  >
                    <View style={styles.ownerRowIcon}><Folder size={19} color={colors.forest} /></View>
                    <View style={styles.flexOne}>
                      <Text numberOfLines={1} style={styles.ownerRowTitle}>{row.title}</Text>
                      <Text numberOfLines={2} style={styles.ownerRowSubtitle}>{row.subtitle}</Text>
                    </View>
                    <ChevronRight size={17} color={colors.muted} />
                  </Pressable>
                );
              }
              if (module === "approvals") {
                return (
                  <View key={row.id} style={styles.approvalQueueRow}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`View ${row.title}`}
                      onPress={() => setRecordId(row.id)}
                      style={({ pressed }) => [styles.approvalQueueRecord, pressed && styles.pressed]}
                    >
                      <View style={styles.ownerRowIcon}>{ownerModuleIcon(module, 18)}</View>
                      <View style={styles.flexOne}>
                        <Text numberOfLines={1} style={styles.ownerRowTitle}>{row.title}</Text>
                        {row.subtitle ? <Text numberOfLines={2} style={styles.ownerRowSubtitle}>{row.subtitle}</Text> : null}
                      </View>
                      <ChevronRight size={17} color={colors.muted} />
                    </Pressable>
                    <ActionButton
                      label="Review"
                      compact
                      onPress={() => {
                        const agreement = portfolio.agreements.find((item) => item.id === row.id);
                        if (agreement) onReview(agreement);
                      }}
                    />
                  </View>
                );
              }
              if (module === "agreements") {
                return (
                  <View key={row.id} style={styles.approvalQueueRow}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`View ${row.title}`}
                      onPress={() => setRecordId(row.id)}
                      style={({ pressed }) => [styles.approvalQueueRecord, pressed && styles.pressed]}
                    >
                      <View style={styles.ownerRowIcon}>{ownerModuleIcon(module, 18)}</View>
                      <View style={styles.flexOne}>
                        <Text numberOfLines={1} style={styles.ownerRowTitle}>{row.title}</Text>
                        {row.subtitle ? <Text numberOfLines={2} style={styles.ownerRowSubtitle}>{row.subtitle}</Text> : null}
                      </View>
                      <ChevronRight size={17} color={colors.muted} />
                    </Pressable>
                    <ActionButton
                      label="Review"
                      compact
                      onPress={() => {
                        const agreement = portfolio.agreements.find((item) => item.id === row.id);
                        if (agreement) onReview(agreement, true);
                      }}
                    />
                  </View>
                );
              }
              return (
                <View
                  key={row.id}
                  style={[
                    styles.approvalQueueRow,
                    module === "tenants" && { flexDirection: "column", alignItems: "stretch" },
                  ]}
                >
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => setRecordId(row.id)}
                    style={({ pressed }) => [styles.ownerRow, pressed && styles.pressed]}
                  >
                    <View style={styles.ownerRowIcon}>{ownerModuleIcon(module, 18)}</View>
                    <View style={styles.flexOne}>
                      <Text numberOfLines={1} style={styles.ownerRowTitle}>{row.title}</Text>
                      {row.subtitle ? <Text numberOfLines={2} style={styles.ownerRowSubtitle}>{row.subtitle}</Text> : null}
                    </View>
                    <ChevronRight size={17} color={colors.muted} />
                  </Pressable>
                  {module === "tenants" ? (
                    <>
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                      {missingFields.length && completeAction ? (
                        <ActionButton
                          label={completeLabel}
                          compact
                          variant="secondary"
                          onPress={completeAction}
                        />
                      ) : null}
                      {tenant ? (
                        <ActionButton
                          label={resettingTenantId === tenant.id ? "Resetting..." : "Reset tenant details"}
                          compact
                          variant="danger"
                          busy={resettingTenantId === tenant.id}
                          disabled={Boolean(resettingTenantId)}
                          onPress={() => void resetTenantFromList(tenant)}
                        />
                      ) : null}
                    </View>
                    {tenantResetError?.tenantId === row.id ? (
                      <Notice message={tenantResetError.message} />
                    ) : null}
                    </>
                  ) : missingFields.length && completeAction ? (
                    <ActionButton
                    label={completeLabel}
                    compact
                    variant="secondary"
                    onPress={completeAction}
                    />
                  ) : null}
                </View>
              );
            }) : (
              <EmptyState
                title={emptyTitle[module]}
                text={module === "approvals"
                  ? "No agreements are waiting for your approval."
                  : module === "agreements"
                      ? "Only agreements that completed approval appear here."
                      : module === "deletedAgreements"
                      ? "Deleted agreements are kept here as read-only snapshots. They are not included in the active portfolio."
                      : `Add a ${moduleConfig.createKind} to get started.`}
              />
            )}
          </>
        )}
      </ScrollView>

      <Modal
        visible={drawerOpen}
        transparent
        animationType="none"
        onRequestClose={() => setDrawerOpen(false)}
      >
        <View style={styles.drawerRoot}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close navigation"
            style={styles.drawerShade}
            onPress={() => setDrawerOpen(false)}
          />
          <View style={styles.drawer}>
            <View style={styles.drawerBrand}>
              <View style={styles.brandIcon}><Building2 size={18} color={colors.white} /></View>
              <View style={styles.brandTextWrap}>
                <Text style={styles.brandTitle}>Rent-Sync</Text>
                <Text style={styles.brandRole}>Property workspace</Text>
              </View>
            </View>
            <View style={styles.drawerLinks}>
              {ownerModules.map((item) => (
                <Pressable
                  key={item.id}
                  accessibilityRole="button"
                  accessibilityState={{ selected: module === item.id && !profileOpen }}
                  onPress={() => selectModule(item.id)}
                  style={[styles.drawerLink, module === item.id && !profileOpen && styles.drawerLinkSelected]}
                >
                  {ownerModuleIcon(item.id, 17)}
                  <Text style={[styles.drawerLinkText, module === item.id && !profileOpen && styles.drawerLinkTextSelected]}>
                    {item.label}
                  </Text>
                  <Text style={styles.drawerCount}>{ownerModuleCount(item.id, portfolio)}</Text>
                </Pressable>
              ))}
            </View>
            <View style={styles.drawerFooter}>
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  setProfileOpen(true);
                  setRecordId(null);
                  setDrawerOpen(false);
                }}
                style={styles.drawerFooterAction}
              >
                <CircleUserRound size={17} color={colors.forest} />
                <Text style={styles.drawerFooterText}>Profile</Text>
              </Pressable>
              <Pressable accessibilityRole="button" onPress={onSignOut} style={styles.drawerFooterAction}>
                <LogOut size={17} color={colors.forest} />
                <Text style={styles.drawerFooterText}>Sign out</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
      <CreateTermHeadingSheet
        visible={createTermOpen}
        session={session}
        onClose={() => setCreateTermOpen(false)}
        onCreated={(id) => {
          setCreateTermOpen(false);
          setRecordId(id);
          void onPortfolioChanged();
        }}
      />
    </View>
  );
}

function BuildingTotalsDashboard({ assets }: { assets: Asset[] }) {
  const totals = assets.reduce(
    (current, asset) => ({
      monthlyRent: current.monthlyRent + asset.monthlyRent,
      advance: current.advance + asset.securityDeposit,
    }),
    { monthlyRent: 0, advance: 0 },
  );
  return (
    <View style={styles.buildingTotals}>
      <View style={styles.buildingTotalCard}>
        <Text style={styles.buildingTotalLabel}>TOTAL MONTHLY RENT</Text>
        <Text style={styles.buildingTotalValue}>{money(totals.monthlyRent)}</Text>
      </View>
      <View style={styles.buildingTotalCard}>
        <Text style={styles.buildingTotalLabel}>TOTAL ADVANCE / DEPOSIT</Text>
        <Text style={styles.buildingTotalValue}>{money(totals.advance)}</Text>
      </View>
    </View>
  );
}

function CreateTermHeadingSheet({
  visible,
  session,
  onClose,
  onCreated,
}: {
  visible: boolean;
  session: MobileSession;
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function create() {
    if (!name.trim()) {
      setError("Enter a main terms heading.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const response = await saveOwnerTerms<{ template: TermTemplate }>(session, {
        action: "create-template",
        name,
      });
      if (!response.template?.id) throw new Error("The new terms heading was not returned.");
      setName("");
      onCreated(response.template.id);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to create this heading.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
      <View style={[styles.reviewPage, Platform.OS === "android" && { paddingTop: StatusBar.currentHeight ?? 0 }]}>
        <View style={styles.reviewHeader}>
          <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={onClose} style={styles.ownerHeaderButton}>
            <ArrowLeft size={20} color={colors.forest} />
          </Pressable>
          <View style={styles.flexOne}>
            <Text style={styles.reviewHeaderTitle}>New main terms</Text>
            <Text style={styles.mutedSmall}>Create a reusable heading for your properties</Text>
          </View>
        </View>
        <View style={styles.reviewContent}>
          <Panel style={styles.ownerPanel}>
            <Field
              label="Main terms heading"
              value={name}
              onChangeText={setName}
              maxLength={120}
              placeholder="e.g. Apartment terms, Room rules"
              autoCapitalize="sentences"
            />
            <Text style={styles.ownerHint}>You can add numbered terms to this heading after creating it.</Text>
            {error ? <Notice message={error} /> : null}
            <ActionButton
              label="Create heading"
              busy={busy}
              onPress={() => void create()}
              icon={<Plus size={16} color={colors.white} />}
            />
          </Panel>
        </View>
      </View>
    </Modal>
  );
}

function AssetTermsMapping({
  asset,
  templates,
  session,
  onChanged,
}: {
  asset: Asset;
  templates: TermTemplate[];
  session: MobileSession;
  onChanged: () => Promise<void>;
}) {
  const [savingTemplateId, setSavingTemplateId] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function setMapped(template: TermTemplate, mapped: boolean) {
    setSavingTemplateId(template.id);
    setError("");
    try {
      await saveOwnerTerms(session, {
        action: "map-asset",
        templateId: template.id,
        assetId: asset.id,
        mapped,
      });
      await onChanged();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to update this property's terms.");
    } finally {
      setSavingTemplateId(null);
    }
  }

  return (
    <Panel style={styles.ownerPanel}>
      <Text style={styles.cardTitle}>Agreement terms for this property</Text>
      <Text style={styles.ownerHint}>Choose which reusable term headings apply to this asset.</Text>
      {error ? <Notice message={error} /> : null}
      {templates.length ? templates.map((template) => {
        const selected = template.assetIds.includes(asset.id);
        return (
          <Pressable
            key={template.id}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: selected, disabled: savingTemplateId !== null }}
            disabled={savingTemplateId !== null}
            onPress={() => void setMapped(template, !selected)}
            style={styles.ownerTermAsset}
          >
            <View style={[styles.ownerTermCheck, selected && styles.ownerTermCheckSelected]}>
              {selected ? <Check size={14} color={colors.white} /> : null}
            </View>
            <Text style={[styles.ownerRowSubtitle, styles.flexOne]}>{template.name}</Text>
            <Text style={styles.ownerTermMappedCount}>{template.items.length} terms</Text>
          </Pressable>
        );
      }) : (
        <Text style={styles.ownerHint}>Create a heading in the Terms module to map it to this property.</Text>
      )}
    </Panel>
  );
}

function OwnerTermsPage({
  template,
  session,
  onChanged,
}: {
  template: TermTemplate | null;
  session: MobileSession;
  onChanged: () => Promise<void>;
}) {
  const [termText, setTermText] = useState("");
  const [termImportantObligation, setTermImportantObligation] = useState(false);
  const [headingText, setHeadingText] = useState("");
  const [editingHeading, setEditingHeading] = useState(false);
  const [editingItem, setEditingItem] = useState<{ id: string; text: string; importantObligation: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  if (!template) {
    return <EmptyState title="Terms heading unavailable" text="Return to the Terms list and refresh the workspace." />;
  }

  const templateId = template.id;

  async function addTerm() {
    if (!termText.trim()) {
      setError("Enter a term to add.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await saveOwnerTerms(session, {
        action: "add-item",
        templateId,
        text: termText,
        importantObligation: termImportantObligation,
      });
      setTermText("");
      setTermImportantObligation(false);
      await onChanged();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to add this term.");
    } finally {
      setBusy(false);
    }
  }

  async function saveHeading() {
    if (!template || !headingText.trim()) {
      setError("Enter a heading.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await saveOwnerTerms(session, { action: "update-template", templateId, name: headingText });
      setEditingHeading(false);
      await onChanged();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to update this heading.");
    } finally {
      setBusy(false);
    }
  }

  async function saveItem(itemId: string, text: string, importantObligation: boolean) {
    if (!text.trim()) {
      setError("Enter a term.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await saveOwnerTerms(session, { action: "update-item", templateId, itemId, text, importantObligation });
      setEditingItem(null);
      await onChanged();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to update this term.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
        <Panel style={styles.ownerPanel}>
          <Text style={styles.cardTitle}>Terms in {template.name}</Text>
          <Text style={styles.ownerHint}>Each term is saved as soon as you add it. Serial numbers are assigned automatically.</Text>
          {editingHeading ? (
            <>
              <Field label="Main terms heading" value={headingText} onChangeText={setHeadingText} maxLength={120} />
              <ActionButton label="Save heading" onPress={() => void saveHeading()} busy={busy} />
            </>
          ) : (
            <ActionButton label="Edit heading" variant="secondary" onPress={() => {
              setHeadingText(template.name);
              setEditingHeading(true);
            }} />
          )}
          <Field
            label="Add one term"
            value={termText}
            onChangeText={setTermText}
            multiline
            numberOfLines={3}
            maxLength={1000}
            placeholder="Write an agreement condition..."
            style={styles.multilineField}
          />
          <Text style={styles.reviewCharacterCount}>{termText.length}/1000 characters</Text>
          <Pressable
            accessibilityRole="checkbox"
            accessibilityState={{ checked: termImportantObligation }}
            onPress={() => setTermImportantObligation((value) => !value)}
            style={styles.ownerTermImportantToggle}
          >
            <View style={[styles.ownerTermCheck, termImportantObligation && styles.ownerTermCheckSelected]}>
              {termImportantObligation ? <Check size={14} color={colors.white} /> : null}
            </View>
            <Text style={styles.ownerRowSubtitle}>Important obligation</Text>
          </Pressable>
          {error ? <Notice message={error} /> : null}
          <ActionButton label="Add term" onPress={() => void addTerm()} busy={busy} icon={<Plus size={16} color={colors.white} />} />
        </Panel>

        {template.items.length ? template.items.map((item) => (
          <Panel key={item.id} style={styles.ownerLinkedRow}>
            <View style={styles.ownerRowIcon}>
              <Text style={styles.ownerTermNumber}>{item.position}</Text>
            </View>
            {editingItem?.id === item.id ? (
              <View style={styles.flexOne}>
              <Field label={`Edit term ${item.position}`} value={editingItem.text} onChangeText={(text) => setEditingItem({ ...editingItem, text })} multiline maxLength={1000} />
              <Pressable
                accessibilityRole="checkbox"
                accessibilityState={{ checked: editingItem.importantObligation }}
                onPress={() => setEditingItem({ ...editingItem, importantObligation: !editingItem.importantObligation })}
                style={styles.ownerTermImportantToggle}
              >
                <View style={[styles.ownerTermCheck, editingItem.importantObligation && styles.ownerTermCheckSelected]}>
                  {editingItem.importantObligation ? <Check size={14} color={colors.white} /> : null}
                </View>
                <Text style={styles.ownerRowSubtitle}>Important obligation</Text>
              </Pressable>
              <ActionButton label="Save term" onPress={() => void saveItem(item.id, editingItem.text, editingItem.importantObligation)} busy={busy} />
            </View>
            ) : (
            <View style={styles.flexOne}>
              {item.importantObligation ? (
                <Text style={styles.ownerImportantObligationBadge}>Important obligation</Text>
              ) : null}
              <Text style={styles.ownerRowSubtitle}>{item.text}</Text>
            </View>
            )}
            {editingItem?.id !== item.id ? (
            <Pressable accessibilityRole="button" accessibilityLabel={`Edit term ${item.position}`} onPress={() => setEditingItem({ id: item.id, text: item.text, importantObligation: item.importantObligation })} style={styles.ownerHeaderButton}>
              <Pencil size={15} color={colors.forest} />
            </Pressable>
            ) : null}
          </Panel>
        )) : (
          <EmptyState title="No terms added yet" text="Add your first numbered term above." />
        )}

    </>
  );
}

function ownerModuleIcon(module: OwnerModule, size: number) {
  switch (module) {
    case "companies":
    case "buildings":
      return <Building2 size={size} color={colors.forest} />;
    case "assets":
      return <DoorOpen size={size} color={colors.forest} />;
    case "tenants":
      return <UsersRound size={size} color={colors.forest} />;
    case "agreements":
      return <FileCheck2 size={size} color={colors.forest} />;
    case "terms":
      return <BookOpenText size={size} color={colors.forest} />;
    case "approvals":
      return <Check size={size} color={colors.forest} />;
    case "deletedAgreements":
      return <Clock3 size={size} color={colors.forest} />;
  }
}

function getAssetCompletionIssues(asset: Asset | undefined) {
  if (!asset) return [] as string[];
  const issues: string[] = [];
  if (!asset.buildingId) issues.push("property");
  if (!asset.name?.trim()) issues.push("unit name");
  if (!asset.unitNumber?.trim()) issues.push("unit number");
  if (!(asset.monthlyRent > 0)) issues.push("rent");
  if (!(asset.securityDeposit >= 0)) issues.push("deposit");
  if (!asset.agreementDurationUnit) issues.push("duration unit");
  if (!(asset.agreementDurationValue && asset.agreementDurationValue > 0)) issues.push("duration");
  if (!asset.agreementStartDate) issues.push("start date");
  return issues;
}

function getTenantCompletionIssues(tenant: Tenant | undefined) {
  if (!tenant) return [] as string[];
  const issues: string[] = [];
  if (!tenant.fullName?.trim()) issues.push("tenant name");
  if (!tenant.mobileNumber?.trim()) issues.push("mobile number");
  return issues;
}

function ownerModuleCount(module: OwnerModule, portfolio: Portfolio) {
  if (module === "approvals") return pendingOwnerApprovals(portfolio).length;
  if (module === "terms") return portfolio.termsTemplates.length;
  if (module === "agreements") return portfolio.agreements.filter(isApprovedAgreement).length;
  return portfolio[module].length;
}

function ownerModuleRows(module: OwnerModule, portfolio: Portfolio) {
  switch (module) {
    case "companies":
      return portfolio.companies.map((company) => ({
        id: company.id,
        title: company.name,
        subtitle: `${portfolio.buildings.filter((building) => building.companyId === company.id).length} buildings`,
      }));
    case "buildings":
      return portfolio.buildings.map((building) => ({
        id: building.id,
        title: building.name,
        subtitle: [building.city, building.state].filter(Boolean).join(", "),
      }));
    case "assets":
      return portfolio.assets.map((asset) => ({
        id: asset.id,
        title: `${asset.name}${asset.unitNumber ? ` · ${asset.unitNumber}` : ""}`,
        subtitle: `${asset.buildingName ?? portfolio.buildings.find((building) => building.id === asset.buildingId)?.name ?? "Building"} · ${money(asset.monthlyRent)}/month`,
      }));
    case "tenants":
      return portfolio.tenants.map((tenant) => ({
        id: tenant.id,
        title: tenant.fullName,
        subtitle: tenant.mobileNumber ? `+${tenant.mobileNumber}` : "No mobile number",
      }));
    case "agreements":
      return portfolio.agreements.filter(isApprovedAgreement).map((agreement) => {
        const tenant = portfolio.tenants.find((item) => item.id === agreement.tenantId);
        return {
          id: agreement.id,
          title: agreement.agreementNumber || `Agreement ${agreement.agreementYear ?? ""}`,
          subtitle: `${tenant?.fullName ?? "Tenant"} · ${money(agreement.monthlyRent)}/month · ${getAgreementState(agreement)}`,
        };
      });
    case "terms":
      return portfolio.termsTemplates.map((template) => ({
        id: template.id,
        title: template.name,
        subtitle: `${template.items.length} terms`,
      }));
    case "deletedAgreements":
      return portfolio.deletedAgreements.map((agreement) => ({
        id: agreement.id,
        title: agreement.agreementNumber || `Agreement ${agreement.agreementYear}`,
        subtitle: `${agreement.tenantName} · ${agreement.assetName} · Archived ${shortDate(agreement.archivedAt)}`,
      }));
    case "approvals":
      return pendingOwnerApprovals(portfolio).map((agreement) => {
        const tenant = portfolio.tenants.find((item) => item.id === agreement.tenantId);
        const asset = portfolio.assets.find((item) => item.id === agreement.assetId);
        return {
          id: agreement.id,
          title: agreement.agreementNumber || `Agreement ${agreement.agreementYear ?? ""}`.trim(),
          subtitle: `${tenant?.fullName ?? "Tenant"} · ${asset?.name ?? "Asset"} · ${money(agreement.monthlyRent)}/month`,
        };
      });
  }
}

function ownerRecordTitle(module: OwnerModule, recordId: string, portfolio: Portfolio) {
  if (module === "companies") return portfolio.companies.find((item) => item.id === recordId)?.name;
  if (module === "buildings") return portfolio.buildings.find((item) => item.id === recordId)?.name;
  if (module === "assets") {
    const asset = portfolio.assets.find((item) => item.id === recordId);
    return asset ? `${asset.name}${asset.unitNumber ? ` · ${asset.unitNumber}` : ""}` : undefined;
  }
  if (module === "tenants") return portfolio.tenants.find((item) => item.id === recordId)?.fullName;
  if (module === "terms") return portfolio.termsTemplates.find((item) => item.id === recordId)?.name;
  if (module === "deletedAgreements") {
    const archived = portfolio.deletedAgreements.find((item) => item.id === recordId);
    return archived?.agreementNumber || (archived ? `Agreement ${archived.agreementYear}` : undefined);
  }
  const agreement = portfolio.agreements.find((item) => item.id === recordId);
  return agreement
    ? agreement.agreementNumber || `Agreement ${agreement.agreementYear ?? ""}`.trim()
    : undefined;
}

function ArchivedAgreementDetail({
  agreement,
  onBack,
}: {
  agreement: ArchivedAgreement | null;
  onBack: () => void;
}) {
  if (!agreement) {
    return <EmptyState title="Archived agreement unavailable" text="Return to the archive list and refresh the workspace." />;
  }

  const terms = dedupeAgreementTermGroups(agreement.templateTerms).flatMap((group) => group.items);
  return (
    <>
      <View style={styles.agreementDetailHeading}>
        <View style={styles.flexOne}>
          <Text style={styles.cardTitle}>Archived agreement</Text>
          <Text style={styles.ownerHint}>Read-only snapshot · archived {shortDate(agreement.archivedAt)}</Text>
        </View>
        <Pressable accessibilityRole="button" onPress={onBack} style={styles.ownerHeaderButton}>
          <ArrowLeft size={19} color={colors.forest} />
        </Pressable>
      </View>
      <Panel style={styles.ownerPanel}>
        <Fact label="Agreement number" value={agreement.agreementNumber} />
        <Fact label="Agreement year" value={String(agreement.agreementYear)} />
        <Fact label="Status when archived" value={agreement.status} />
        <Fact label="Tenant" value={agreement.tenantName} />
        <Fact label="Tenant mobile" value={agreement.tenantMobileNumber ? `+${agreement.tenantMobileNumber}` : "—"} />
        <Fact label="Asset" value={`${agreement.assetName} · Unit ${agreement.unitNumber}`} />
        <Fact label="Asset type" value={agreement.assetType || "—"} />
        <Fact label="Building" value={agreement.buildingName} />
        <Fact label="Building address" value={[agreement.buildingAddress, agreement.city, agreement.state].filter(Boolean).join(", ") || "—"} />
        <Fact label="Start date" value={shortDate(agreement.startDate)} />
        <Fact label="End date" value={shortDate(agreement.endDate)} />
        <Fact label="Monthly rent" value={money(agreement.monthlyRent)} />
        <Fact label="Security deposit" value={money(agreement.securityDeposit)} />
        <Fact label="Owner approved" value={agreement.ownerApprovedAt ? shortDate(agreement.ownerApprovedAt) : "Not approved"} />
        <Fact label="Additional terms" value={agreement.terms || "—"} />
      </Panel>
      <Panel style={styles.ownerPanel}>
        <Text style={styles.cardTitle}>Mapped agreement terms</Text>
        {terms.length ? terms.map((item, index) => (
          <View key={item.id} style={styles.ownerTermAsset}>
            <View style={styles.ownerTermCheck}><Text style={styles.ownerTermMappedCount}>{index + 1}</Text></View>
            <View style={styles.flexOne}>
              <Text style={styles.ownerRowSubtitle}>{item.text}</Text>
            </View>
          </View>
        )) : <Text style={styles.ownerHint}>No mapped reusable terms were saved with this snapshot.</Text>}
      </Panel>
    </>
  );
}

function OwnerRecordDetail({
  module,
  recordId,
  portfolio,
  session,
  onReview,
  onChanged,
  onNavigate,
}: {
  module: OwnerModule;
  recordId: string;
  portfolio: Portfolio;
  session: MobileSession;
  onReview: (agreement: Agreement, readOnly?: boolean) => void;
  onChanged: () => Promise<void>;
  onNavigate: (module: OwnerModule, id: string | null) => void;
}) {
  const [tenantTab, setTenantTab] = useState<TenantDetailTab>("kyc");
  const [tenantPublicUrl, setTenantPublicUrl] = useState("");
  const [tenantPublicBusy, setTenantPublicBusy] = useState(false);
  const [tenantPublicLoading, setTenantPublicLoading] = useState(false);
  const [tenantPublicError, setTenantPublicError] = useState("");
  const [tenantPublicCopied, setTenantPublicCopied] = useState(false);
  const [tenantResetBusy, setTenantResetBusy] = useState(false);
  const [tenantResetError, setTenantResetError] = useState("");
  const [agreementTab, setAgreementTab] = useState<AgreementDetailTab>("kyc");
  const [companyTab, setCompanyTab] = useState<CompanyDetailTab>("details");
  const [buildingTab, setBuildingTab] = useState<BuildingDetailTab>("details");
  const [assetTab, setAssetTab] = useState<AssetDetailTab>("details");
  const [selectedMergeAssets, setSelectedMergeAssets] = useState<string[]>([]);
  const [mergeBusy, setMergeBusy] = useState(false);
  const [mergeError, setMergeError] = useState("");
  const [archiveBusy, setArchiveBusy] = useState(false);
  const [archiveError, setArchiveError] = useState("");
  const [buildingDeleteBusy, setBuildingDeleteBusy] = useState(false);
  const [buildingDeleteError, setBuildingDeleteError] = useState("");
  const record = module === "companies" ? portfolio.companies.find((item) => item.id === recordId)
    : module === "buildings" ? portfolio.buildings.find((item) => item.id === recordId)
      : module === "assets" ? portfolio.assets.find((item) => item.id === recordId)
        : module === "tenants" ? portfolio.tenants.find((item) => item.id === recordId)
          : portfolio.agreements.find((item) => item.id === recordId);

  useEffect(() => {
    if (module !== "tenants") return;
    let cancelled = false;
    setTenantPublicLoading(true);
    setTenantPublicUrl("");
    setTenantPublicError("");
    setTenantPublicCopied(false);
    void getTenantPublicProfileLinks<{ links: { tenantId: string; token: string | null }[] }>(session)
      .then(async ({ links }) => {
        const token = links.find((link) => link.tenantId === recordId)?.token;
        if (token) {
          const url = await buildTenantProfileUrl(token);
          if (!cancelled) setTenantPublicUrl(url);
        }
      })
      .catch((cause: unknown) => {
        if (!cancelled) {
          setTenantPublicError(cause instanceof Error ? cause.message : "Unable to load the existing public profile link.");
        }
      })
      .finally(() => {
        if (!cancelled) setTenantPublicLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [module, recordId, session]);

  if (!record) {
    return <EmptyState title="Record unavailable" text="It may have been removed. Return to the list and refresh." />;
  }

  const linkedAsset = module === "agreements" || module === "approvals"
    ? portfolio.assets.find((asset) => asset.id === (record as Agreement).assetId)
    : undefined;
  const linkedTenant = module === "agreements" || module === "approvals"
    ? portfolio.tenants.find((tenant) => tenant.id === (record as Agreement).tenantId)
    : undefined;

  async function confirmAction(title: string, message: string, actionLabel: string) {
    if (Platform.OS === "web" && typeof window !== "undefined") {
      return window.confirm(`${title}\n\n${message}`);
    }
    return new Promise<boolean>((resolve) => {
      Alert.alert(
        title,
        message,
        [
          { text: "Cancel", style: "cancel", onPress: () => resolve(false) },
          { text: actionLabel, style: "destructive", onPress: () => resolve(true) },
        ],
        { cancelable: true, onDismiss: () => resolve(false) },
      );
    });
  }

  async function resetTenantProfile() {
    if (tenantResetBusy || module !== "tenants") return;
    const tenant = record as Tenant;
    const confirmed = await confirmAction(
      "Reset tenant details?",
      `This clears the tenant's contact, address, business, identity, and photo details. The name "${tenant.fullName}" stays unchanged. Assigned assets and all agreements will be left untouched.`,
      "Reset details",
    );
    if (!confirmed) return;

    setTenantResetBusy(true);
    setTenantResetError("");
    try {
      await resetTenantProfileDetails<{ success: boolean }>(session, tenant.id);
      await onChanged();
    } catch (cause) {
      setTenantResetError(cause instanceof Error ? cause.message : "Unable to reset tenant details.");
    } finally {
      setTenantResetBusy(false);
    }
  }

  async function mergeTenantAssets(
    assets: Asset[],
    agreementsToMerge: Agreement[],
  ) {
    if (mergeBusy || assets.length < 2 || agreementsToMerge.length !== assets.length) return;
    const assetDescription = assets.map((asset) =>
      `${asset.name} · Unit ${asset.unitNumber} (${agreementsToMerge.find((agreement) => agreement.assetId === asset.id)?.agreementNumber ?? "agreement"})`,
    ).join("\n");
    const confirmed = await confirmAction(
      "Create one combined agreement?",
      `The selected assets' current agreements will be cancelled and a new draft will be opened for approval.\n\n${assetDescription}\n\nYou can split the combined agreement later from an asset record.`,
      "Create draft",
    );
    if (!confirmed) return;

    setMergeBusy(true);
    setMergeError("");
    try {
      const result = await mergeOwnerAgreements<{ agreement?: Agreement }>(
        session,
        agreementsToMerge.map((agreement) => agreement.id),
      );
      if (!result.agreement) throw new Error("The combined agreement was not returned.");
      setSelectedMergeAssets([]);
      await onChanged();
      onReview({
        ...result.agreement,
        mergedAssetIds: assets.map((asset) => asset.id).filter((assetId) => assetId !== result.agreement?.assetId),
      });
    } catch (cause) {
      setMergeError(cause instanceof Error ? cause.message : "Unable to create the combined agreement.");
    } finally {
      setMergeBusy(false);
    }
  }

  async function splitMergedAgreement(agreement: Agreement) {
    if (mergeBusy) return;
    const confirmed = await confirmAction(
      "Split combined agreement?",
      `Cancel ${agreement.agreementNumber} and restore the original agreements for its assets? If the combined agreement was approved, restored agreements will need approval again.`,
      "Split agreement",
    );
    if (!confirmed) return;

    setMergeBusy(true);
    setMergeError("");
    try {
      await splitOwnerAgreement<{ success: boolean }>(session, agreement.id);
      setSelectedMergeAssets([]);
      await onChanged();
    } catch (cause) {
      setMergeError(cause instanceof Error ? cause.message : "Unable to split this agreement.");
    } finally {
      setMergeBusy(false);
    }
  }

  async function archiveAgreement() {
    if (module !== "agreements" || archiveBusy) return;
    const confirmed = Platform.OS === "web"
      ? window.confirm("Archive this agreement?\n\nThe agreement will move to Deleted agreements with its approval and terms history. It will no longer appear in active agreement workflows.")
      : await new Promise<boolean>((resolve) => {
        Alert.alert(
          "Archive agreement?",
          "The agreement will move to Deleted agreements with its approval and terms history.",
          [
            { text: "Cancel", style: "cancel", onPress: () => resolve(false) },
            { text: "Archive", style: "destructive", onPress: () => resolve(true) },
          ],
          { cancelable: true, onDismiss: () => resolve(false) },
        );
      });
    if (!confirmed) return;

    setArchiveBusy(true);
    setArchiveError("");
    try {
      await authenticatedRequest<{ success: boolean }>(session, "/api/owner/portfolio", {
        method: "DELETE",
        body: { kind: "agreement", id: recordId },
      });
      await onChanged();
      onNavigate("agreements", null);
    } catch (cause) {
      setArchiveError(cause instanceof Error ? cause.message : "Unable to archive this agreement.");
    } finally {
      setArchiveBusy(false);
    }
  }

  async function deleteBuilding() {
    if (module !== "buildings" || buildingDeleteBusy) return;
    const confirmed = await confirmAction(
      "Delete this building?",
      "The building can only be deleted after all its assets have been removed.",
      "Delete building",
    );
    if (!confirmed) return;
    setBuildingDeleteBusy(true);
    setBuildingDeleteError("");
    try {
      await authenticatedRequest<{ success: boolean }>(session, "/api/owner/portfolio", {
        method: "DELETE",
        body: { kind: "building", id: recordId },
      });
      await onChanged();
      onNavigate("buildings", null);
    } catch (cause) {
      setBuildingDeleteError(cause instanceof Error ? cause.message : "Unable to delete this building.");
    } finally {
      setBuildingDeleteBusy(false);
    }
  }

  async function createTenantProfileLink(tenantId: string) {
    setTenantPublicBusy(true);
    setTenantPublicError("");
    setTenantPublicUrl("");
    setTenantPublicCopied(false);
    try {
      const response = await createTenantPublicProfileLink<{ token?: string }>(session, tenantId);
      if (!response.token) throw new Error("The public profile link was not returned.");
      setTenantPublicUrl(await buildTenantProfileUrl(response.token));
    } catch (cause) {
      setTenantPublicError(cause instanceof Error ? cause.message : "Unable to create a public tenant profile link.");
    } finally {
      setTenantPublicBusy(false);
    }
  }

  async function copyTenantProfileLink() {
    if (!tenantPublicUrl) return;
    setTenantPublicError("");
    try {
      if (Platform.OS === "web") {
        if (!navigator.clipboard?.writeText) throw new Error("Clipboard access is unavailable. Select and copy the URL.");
        await navigator.clipboard.writeText(tenantPublicUrl);
      } else {
        await Share.share({ message: tenantPublicUrl });
      }
      setTenantPublicCopied(true);
    } catch (cause) {
      setTenantPublicError(cause instanceof Error ? cause.message : "Unable to share the public profile link.");
    }
  }

  if (module === "companies") {
    const company = record as Company;
    const buildings = portfolio.buildings.filter((building) => building.companyId === company.id);
    return (
      <>
        <OwnerDetailTabs
          value={companyTab}
          tabs={[{ id: "details", label: "Details" }, { id: "buildings", label: "Buildings" }]}
          onChange={setCompanyTab}
        />
        {companyTab === "details" ? (
          <Panel style={styles.ownerPanel}>
            <Fact label="Company name" value={company.name} />
            <Fact label="Buildings" value={String(buildings.length)} />
          </Panel>
        ) : buildings.length ? buildings.map((building) => (
          <OwnerLinkedRow
            key={building.id}
            title={building.name}
            subtitle={[building.city, building.state].filter(Boolean).join(", ")}
            onPress={() => onNavigate("buildings", building.id)}
          />
        )) : <EmptyState title="No buildings yet" text="Buildings added under this company will appear here." />}
      </>
    );
  }

  if (module === "buildings") {
    const building = record as Building;
    const company = portfolio.companies.find((item) => item.id === building.companyId);
    const assets = portfolio.assets.filter((asset) => asset.buildingId === building.id);
    return (
      <>
        <OwnerDetailTabs
          value={buildingTab}
          tabs={[{ id: "details", label: "Details" }, { id: "assets", label: "Assets" }]}
          onChange={setBuildingTab}
        />
        {buildingTab === "details" ? (
          <>
            <Panel style={styles.ownerPanel}>
              <Fact label="Building name" value={building.name} />
              <Fact label="Company" value={company?.name ?? "—"} />
              <Fact label="Address" value={[building.address, building.city, building.state, building.postalCode].filter(Boolean).join(", ") || "—"} />
              <Fact label="Assets" value={String(assets.length)} />
            </Panel>
            {buildingDeleteError ? <Notice message={buildingDeleteError} /> : null}
            <ActionButton
              label="Delete building"
              variant="secondary"
              busy={buildingDeleteBusy}
              onPress={() => void deleteBuilding()}
            />
          </>
        ) : assets.length ? assets.map((asset) => (
          <OwnerLinkedRow
            key={asset.id}
            title={`${asset.name} · ${asset.unitNumber}`}
            subtitle={`${money(asset.monthlyRent)}/month`}
            onPress={() => onNavigate("assets", asset.id)}
          />
        )) : <EmptyState title="No assets yet" text="Assets linked to this building will appear here." />}
      </>
    );
  }

  if (module === "assets") {
    const asset = record as Asset;
    const building = portfolio.buildings.find((item) => item.id === asset.buildingId);
    const mergedAgreement = portfolio.agreements.find((agreement) =>
      agreement.mergedAssetIds?.length &&
      (agreement.assetId === asset.id || agreement.mergedAssetIds.includes(asset.id)),
    );
    const tenants = portfolio.tenants.filter((tenant) =>
      (asset.tenantIds ?? []).includes(tenant.id) || (tenant.assetIds ?? []).includes(asset.id),
    );
    const agreements = portfolio.agreements.filter(
      (agreement) => agreement.assetId === asset.id && isApprovedAgreement(agreement),
    );
    return (
      <>
        <OwnerDetailTabs
          value={assetTab}
          tabs={[
            { id: "details", label: "Details" },
            { id: "tenants", label: "Tenants" },
            { id: "agreements", label: "Agreements" },
          ]}
          onChange={setAssetTab}
        />
        {mergedAgreement ? (
          <Panel style={styles.ownerPanel}>
            <Text style={styles.cardTitle}>Combined agreement</Text>
            <Text style={styles.ownerRowSubtitle}>
              {mergedAgreement.agreementNumber} · {getAgreementState(mergedAgreement)}
            </Text>
            <Text style={styles.ownerHint}>
              This asset is part of a combined agreement. Splitting restores separate agreements for all included assets.
            </Text>
            <ActionButton
              label="Split combined agreement"
              variant="secondary"
              busy={mergeBusy}
              onPress={() => void splitMergedAgreement(mergedAgreement)}
            />
            {mergeError ? <Notice message={mergeError} /> : null}
          </Panel>
        ) : null}
        {assetTab === "details" ? (
          <>
            <Panel style={styles.ownerPanel}>
              <Fact label="Asset name" value={asset.name} />
              <Fact label="Unit number" value={asset.unitNumber || "—"} />
              <Fact label="Type" value={asset.assetType || "—"} />
              <Fact label="Building" value={building?.name ?? asset.buildingName ?? "—"} />
              <Fact label="Monthly rent" value={money(asset.monthlyRent)} />
              <Fact label="Security deposit" value={money(asset.securityDeposit)} />
              <Fact label="Ward number" value={asset.ward || "—"} />
              <Fact label="Room number" value={asset.roomNumber || "—"} />
              <Fact label="K-SMART building ID" value={asset.ksmartBuildingId || "—"} />
              <Fact label="KSRB ID" value={asset.ksrbId || "—"} />
              <Fact label="Current tenant" value={tenants.map((tenant) => tenant.fullName).join(", ") || "Vacant"} />
            </Panel>
            <AssetTermsMapping
              asset={asset}
              templates={portfolio.termsTemplates}
              session={session}
              onChanged={onChanged}
            />
          </>
        ) : null}
        {assetTab === "tenants" ? tenants.length ? tenants.map((tenant) => (
          <OwnerLinkedRow
            key={tenant.id}
            title={tenant.fullName}
            subtitle={tenant.mobileNumber ? `+${tenant.mobileNumber}` : "Tenant"}
            onPress={() => onNavigate("tenants", tenant.id)}
          />
        )) : <EmptyState title="No tenants assigned" text="Tenants assigned to this asset will appear here." /> : null}
        {assetTab === "agreements" ? agreements.length ? agreements.map((agreement) => (
          <OwnerLinkedRow
            key={agreement.id}
            title={agreement.agreementNumber || `Agreement ${agreement.agreementYear ?? ""}`.trim()}
            subtitle={`${getAgreementState(agreement)} · ${money(agreement.monthlyRent)}/month`}
            onPress={() => onNavigate("agreements", agreement.id)}
          />
        )) : <EmptyState title="No approved agreements" text="Approved rental agreements for this asset will appear here." /> : null}
      </>
    );
  }

  if (module === "tenants") {
    const tenant = record as Tenant;
    const tenantAssets = portfolio.assets.filter((asset) =>
      (tenant.assetIds ?? []).includes(asset.id) || (asset.tenantIds ?? []).includes(tenant.id),
    );
    const tenantAgreements = portfolio.agreements.filter((agreement) => agreement.tenantId === tenant.id);
    const agreements = tenantAgreements.filter(isApprovedAgreement);
    const agreementByAsset = new Map<string, Agreement>();
    for (const agreement of tenantAgreements) {
      if (
        (agreement.status !== "ACTIVE" && agreement.status !== "DRAFT") ||
        agreement.mergedAssetIds?.length
      ) continue;
      const current = agreementByAsset.get(agreement.assetId ?? "");
      const year = Number(agreement.startDate.slice(0, 4));
      const currentYear = current?.agreementYear ?? (current ? new Date(current.startDate).getFullYear() : 0);
      if (
        !current ||
        year > currentYear ||
        (year === currentYear && (agreement.createdAt ?? agreement.startDate) > (current.createdAt ?? current.startDate))
      ) {
        if (agreement.assetId) agreementByAsset.set(agreement.assetId, agreement);
      }
    }
    const combinedAgreementByAsset = new Map<string, Agreement>();
    for (const agreement of tenantAgreements) {
      if (!agreement.mergedAssetIds?.length) continue;
      combinedAgreementByAsset.set(agreement.assetId ?? "", agreement);
      for (const assetId of agreement.mergedAssetIds) combinedAgreementByAsset.set(assetId, agreement);
    }
    const selectedAssets = selectedMergeAssets
      .map((assetId) => tenantAssets.find((asset) => asset.id === assetId))
      .filter((asset): asset is Asset => Boolean(asset));
    const selectedAgreements = selectedAssets
      .map((asset) => agreementByAsset.get(asset.id))
      .filter((agreement): agreement is Agreement => Boolean(agreement));
    const firstSelectedAsset = selectedAssets[0];
    const compatibleAssets = Boolean(firstSelectedAsset) && selectedAssets.every((asset) =>
      asset.buildingId === firstSelectedAsset.buildingId &&
      asset.agreementDurationUnit === firstSelectedAsset.agreementDurationUnit &&
      asset.agreementDurationValue === firstSelectedAsset.agreementDurationValue,
    );
    const canCreateCombinedAgreement =
      selectedAssets.length >= 2 &&
      selectedAgreements.length === selectedAssets.length &&
      compatibleAssets;
    return (
      <>
        <OwnerDetailTabs
          value={tenantTab}
          tabs={[
            { id: "kyc", label: "KYC" },
            { id: "assets", label: "Assets" },
            { id: "agreements", label: "Agreements" },
          ]}
          onChange={(value) => setTenantTab(value as TenantDetailTab)}
        />
        {tenantTab === "kyc" ? (
          <Panel style={styles.ownerPanel}>
            {tenant.photoDataUrl ? <Image source={{ uri: tenant.photoDataUrl }} style={{ width: 112, height: 112, borderRadius: 14, marginBottom: 12 }} /> : null}
            <View style={styles.tenantPublicShare}>
              <View style={styles.tenantPublicHeader}>
                <View style={styles.tenantPublicIcon}>
                  <Share2 size={18} color={colors.forest} />
                </View>
                <View style={styles.flexOne}>
                  <Text style={styles.cardTitle}>Public tenant profile</Text>
                  <Text style={styles.ownerHint}>Share a read-only view of tenant details, assigned assets and current agreements.</Text>
                </View>
              </View>
              <View style={[styles.tenantPublicStatus, tenantPublicUrl ? styles.tenantPublicStatusActive : null]}>
                {tenantPublicLoading || tenantPublicBusy ? (
                  <ActivityIndicator size="small" color={colors.forest} />
                ) : (
                  <View style={[styles.tenantPublicStatusDot, tenantPublicUrl ? styles.tenantPublicStatusDotActive : null]} />
                )}
                <Text style={[styles.tenantPublicStatusText, tenantPublicUrl ? styles.tenantPublicStatusTextActive : null]}>
                  {tenantPublicLoading ? "Checking link" : tenantPublicBusy ? "Updating link" : tenantPublicUrl ? "Link active" : "Not shared"}
                </Text>
              </View>
              <Text style={styles.tenantPublicPrivacy}>
                Anyone with the link can view tenant contact and KYC information. No sign-in is required.
              </Text>
              {tenantPublicUrl ? (
                <>
                  <View style={styles.tenantPublicUrlBox}>
                    <Text style={styles.tenantPublicUrlLabel}>SHARE LINK</Text>
                    <Text selectable numberOfLines={2} style={styles.tenantPublicUrl}>{tenantPublicUrl}</Text>
                  </View>
                  <View style={styles.tenantPublicActions}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={Platform.OS === "web" ? "Copy tenant profile link" : "Share tenant profile link"}
                      onPress={() => void copyTenantProfileLink()}
                      style={({ pressed }) => [styles.tenantPublicAction, styles.tenantPublicActionPrimary, pressed && styles.pressed]}
                    >
                      {tenantPublicCopied && Platform.OS === "web" ? (
                        <Check size={15} color={colors.white} />
                      ) : Platform.OS === "web" ? (
                        <Copy size={15} color={colors.white} />
                      ) : (
                        <Share2 size={15} color={colors.white} />
                      )}
                      <Text style={[styles.tenantPublicActionText, styles.tenantPublicActionTextPrimary]}>
                        {tenantPublicCopied && Platform.OS === "web" ? "Copied" : Platform.OS === "web" ? "Copy link" : "Share link"}
                      </Text>
                    </Pressable>
                    <Pressable
                      accessibilityRole="link"
                      accessibilityLabel="Open shared tenant profile"
                      onPress={() => void Linking.openURL(tenantPublicUrl).catch((cause: unknown) => {
                        setTenantPublicError(cause instanceof Error ? cause.message : "Unable to open the public tenant profile.");
                      })}
                      style={({ pressed }) => [styles.tenantPublicAction, pressed && styles.pressed]}
                    >
                      <ExternalLink size={15} color={colors.forest} />
                      <Text style={styles.tenantPublicActionText}>Open profile</Text>
                    </Pressable>
                  </View>
                </>
              ) : (
                <ActionButton
                  label={tenantPublicBusy ? "Creating..." : "Create public link"}
                  busy={tenantPublicBusy}
                  disabled={tenantPublicLoading}
                  onPress={() => void createTenantProfileLink(tenant.id)}
                  icon={<Share2 size={15} color={colors.white} />}
                />
              )}
              {tenantPublicUrl ? (
                <Pressable
                  accessibilityRole="button"
                  disabled={tenantPublicBusy}
                  onPress={() => void createTenantProfileLink(tenant.id)}
                  style={({ pressed }) => [styles.tenantPublicRegenerate, pressed && styles.pressed]}
                >
                  <Text style={styles.tenantPublicRegenerateText}>
                    {tenantPublicBusy ? "Regenerating link..." : "Regenerate link"}
                  </Text>
                </Pressable>
              ) : null}
              {tenantPublicError ? <Notice message={tenantPublicError} /> : null}
            </View>
            <Fact label="Tenant name" value={tenant.fullName} />
            <Fact label="Business name" value={tenant.businessName || "—"} />
            <Fact label="Full address" value={tenant.fullAddress || "—"} />
            <Fact label="Mobile number" value={tenant.mobileNumber ? `+${tenant.mobileNumber}` : "—"} />
            <Fact label="Aadhaar number" value={tenant.aadhaarNumber || "—"} />
            <Fact label="Father's name" value={tenant.fatherName || "—"} />
            <Fact label="Email address" value={tenant.email || "—"} />
            <View style={{ borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 14, gap: 9 }}>
              <Text style={styles.cardTitle}>Reset tenant details</Text>
              <Text style={styles.ownerHint}>
                Clears tenant profile details except the name. Assigned assets and agreements stay unchanged.
              </Text>
              <ActionButton
                label="Reset tenant details"
                variant="danger"
                busy={tenantResetBusy}
                disabled={tenantPublicBusy}
                onPress={() => void resetTenantProfile()}
              />
              {tenantResetError ? <Notice message={tenantResetError} /> : null}
            </View>
          </Panel>
        ) : null}
        {tenantTab === "assets" ? tenantAssets.length ? (
          <>
            <Panel style={styles.ownerPanel}>
              <Text style={styles.cardTitle}>Create one agreement from selected assets</Text>
              <Text style={styles.ownerHint}>
                Select 2–12 assets in this list. Their current agreements will be cancelled and a new combined draft will open for approval.
              </Text>
              {selectedAssets.length >= 2 ? (
                <ActionButton
                  label={`Create one agreement · ${selectedAssets.length} assets`}
                  busy={mergeBusy}
                  disabled={!canCreateCombinedAgreement}
                  onPress={() => void mergeTenantAssets(selectedAssets, selectedAgreements)}
                />
              ) : null}
              {selectedAssets.length >= 2 && !compatibleAssets ? (
                <Notice message="Choose assets from the same building with matching agreement duration settings." />
              ) : null}
              {selectedAssets.length >= 2 && selectedAgreements.length !== selectedAssets.length ? (
                <Notice message="Each selected asset must have an active or draft agreement. Assets already in a combined agreement must be split first." />
              ) : null}
              {mergeError ? <Notice message={mergeError} /> : null}
            </Panel>
            {tenantAssets.map((asset) => {
              const building = portfolio.buildings.find((item) => item.id === asset.buildingId);
              const currentAgreement = agreementByAsset.get(asset.id);
              const combinedAgreement = combinedAgreementByAsset.get(asset.id);
              const selectable = Boolean(currentAgreement) && !combinedAgreement;
              const selected = selectedMergeAssets.includes(asset.id);
              return (
                <View key={asset.id} style={styles.tenantAssetMergeRow}>
                  <Pressable
                    accessibilityRole="checkbox"
                    accessibilityLabel={`Select asset ${asset.unitNumber} for combined agreement`}
                    accessibilityState={{ checked: selected, disabled: !selectable || mergeBusy }}
                    disabled={!selectable || mergeBusy}
                    onPress={() => setSelectedMergeAssets((current) =>
                      selected
                        ? current.filter((id) => id !== asset.id)
                        : current.length < 12 ? [...current, asset.id] : current,
                    )}
                    style={[styles.tenantAssetMergeCheckbox, selected && styles.tenantAssetMergeCheckboxSelected]}
                  >
                    {selected ? <Check size={15} color={colors.white} /> : null}
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => onNavigate("assets", asset.id)}
                    style={({ pressed }) => [styles.tenantAssetMergeDetails, pressed && styles.pressed]}
                  >
                    <Text numberOfLines={1} style={styles.ownerRowTitle}>{asset.name} · Unit {asset.unitNumber}</Text>
                    <Text numberOfLines={2} style={styles.ownerRowSubtitle}>
                      {building?.name ?? asset.buildingName ?? "Building"} · {money(asset.monthlyRent)}/month · Advance {money(asset.securityDeposit)}
                    </Text>
                    {combinedAgreement && asset.id !== combinedAgreement.assetId ? (
                      <Text style={styles.ownerHint}>Part of {combinedAgreement.agreementNumber}</Text>
                    ) : currentAgreement ? (
                      <Text style={styles.ownerHint}>Current agreement: {currentAgreement.agreementNumber}</Text>
                    ) : (
                      <Text style={styles.ownerHint}>No active agreement</Text>
                    )}
                  </Pressable>
                  {combinedAgreement ? (
                    <Pressable
                      accessibilityRole="button"
                      disabled={mergeBusy}
                      onPress={() => void splitMergedAgreement(combinedAgreement)}
                      style={[styles.tenantAssetSplitButton, mergeBusy && { opacity: 0.55 }]}
                    >
                      <Text style={styles.tenantAssetSplitText}>{mergeBusy ? "Working..." : "Split"}</Text>
                    </Pressable>
                  ) : null}
                </View>
              );
            })}
          </>
        ) : <EmptyState title="No assigned assets" text="Assets assigned to this tenant will appear here." /> : null}
        {tenantTab === "agreements" ? agreements.length ? agreements.map((agreement) => (
          <OwnerLinkedRow
            key={agreement.id}
            title={agreement.agreementNumber}
            subtitle={`${getAgreementState(agreement)} · ${shortDate(agreement.startDate)} – ${shortDate(agreement.endDate)}`}
            onPress={() => onNavigate("agreements", agreement.id)}
          />
        )) : <EmptyState title="No approved agreements" text="Approved agreements for this tenant will appear here." /> : null}
      </>
    );
  }

  const agreement = record as Agreement;
  const building = linkedAsset
    ? portfolio.buildings.find((item) => item.id === linkedAsset.buildingId)
    : undefined;
  return (
    <>
      <View style={styles.agreementDetailHeading}>
        <StatePill state={getAgreementState(agreement)} />
        <AgreementDownloadActions session={session} agreement={agreement} />
        {module === "agreements" ? (
          <ActionButton
            label="Archive agreement"
            variant="secondary"
            compact
            busy={archiveBusy}
            onPress={() => void archiveAgreement()}
          />
        ) : null}
        {archiveError ? <Notice message={archiveError} /> : null}
      </View>
      <OwnerDetailTabs
        value={agreementTab}
        tabs={[
          { id: "kyc", label: "KYC" },
          { id: "rent", label: "Rent" },
          { id: "expiry", label: "Expiry" },
          { id: "advance", label: "Advance" },
          { id: "terms", label: "Terms" },
        ]}
        onChange={(value) => setAgreementTab(value as AgreementDetailTab)}
      />
      {agreementTab === "kyc" ? (
        <Panel style={styles.ownerPanel}>
          <Fact label="Tenant" value={linkedTenant?.fullName ?? "Tenant not found"} />
          <Fact label="Tenant mobile" value={linkedTenant?.mobileNumber ? `+${linkedTenant.mobileNumber}` : "Phone not provided"} />
          <Fact label="Asset" value={linkedAsset ? `${linkedAsset.name} · Unit ${linkedAsset.unitNumber}` : "Asset not found"} />
          <Fact label="Building" value={building?.name ?? "—"} />
          <Fact label="Property address" value={building ? [building.address, building.city, building.state, building.postalCode].filter(Boolean).join(", ") : "—"} />
          <Text style={styles.ownerHint}>KYC documents are not available for this tenant yet.</Text>
        </Panel>
      ) : null}
      {agreementTab === "rent" ? (
        <Panel style={styles.ownerPanel}>
          <Fact label="Agreement year" value={agreement.startDate.slice(0, 4)} />
          <Fact label="Monthly rent" value={money(agreement.monthlyRent)} />
        </Panel>
      ) : null}
      {agreementTab === "expiry" ? (
        <Panel style={styles.ownerPanel}>
          <Fact label="Start date" value={shortDate(agreement.startDate)} />
          <Fact label="End date" value={shortDate(agreement.endDate)} />
        </Panel>
      ) : null}
      {agreementTab === "advance" ? (
        <Panel style={styles.ownerPanel}>
          <Fact label="Security deposit" value={money(agreement.securityDeposit)} />
          <Text style={styles.ownerHint}>A separate advance amount is not stored for this agreement.</Text>
        </Panel>
      ) : null}
      {agreementTab === "terms" ? (
        <>
          {dedupeAgreementTermGroups(agreement.templateTerms).map((template) => (
            <Panel key={template.templateId} style={styles.ownerPanel}>
              <Text style={styles.cardTitle}>{template.heading}</Text>
              {template.items.length ? template.items.map((item) => (
                <View key={item.id} style={styles.ownerTermAsset}>
                  <View style={styles.ownerRowIcon}>
                    <Text style={styles.ownerTermNumber}>{item.position}</Text>
                  </View>
                  <View style={styles.flexOne}>
                    <Text style={styles.ownerRowSubtitle}>{item.text}</Text>
                  </View>
                </View>
              )) : <Text style={styles.ownerHint}>No terms in this heading yet.</Text>}
            </Panel>
          ))}
          <Panel style={styles.ownerPanel}>
            <Fact
              label="Additional terms and notes"
              value={agreement.terms || (!agreement.templateTerms?.length ? "No terms have been recorded for this agreement." : "No additional terms recorded.")}
            />
          </Panel>
        </>
      ) : null}
      <Panel style={styles.ownerPanel}>
        <ApprovalLine role="Owner" time={agreement.ownerApprovedAt} />
      </Panel>
    </>
  );
}

function OwnerLinkedRow({
  title,
  subtitle,
  onPress,
}: {
  title: string;
  subtitle: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.ownerLinkedRow, pressed && styles.pressed]}
    >
      <View style={styles.flexOne}>
        <Text numberOfLines={1} style={styles.ownerRowTitle}>{title}</Text>
        <Text numberOfLines={2} style={styles.ownerRowSubtitle}>{subtitle}</Text>
      </View>
      <ChevronRight size={17} color={colors.muted} />
    </Pressable>
  );
}

function OwnerDetailTabs<T extends string>({
  value,
  tabs,
  onChange,
}: {
  value: T;
  tabs: { id: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.ownerDetailTabs}
    >
      {tabs.map((tab) => (
        <Pressable
          key={tab.id}
          accessibilityRole="tab"
          accessibilityState={{ selected: value === tab.id }}
          onPress={() => onChange(tab.id)}
          style={[styles.ownerDetailTab, value === tab.id && styles.ownerDetailTabSelected]}
        >
          <Text style={[styles.ownerDetailTabText, value === tab.id && styles.ownerDetailTabTextSelected]}>
            {tab.label}
          </Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

function AgreementDownloadActions({
  session,
  agreement,
}: {
  session: MobileSession;
  agreement: Agreement;
}) {
  const [sharing, setSharing] = useState(false);
  const [downloading, setDownloading] = useState<"pdf" | "word" | null>(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  async function download(format: "pdf" | "word") {
    setDownloading(format);
    setNotice("");
    setError("");
    try {
      const { blob, filename } = await downloadOwnerAgreementDocument(session, agreement.id, format);
      const mimeType = format === "word"
        ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        : "application/pdf";
      if (Platform.OS === "web") {
        const objectUrl = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = objectUrl;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
        setNotice(`Agreement ${format === "word" ? "Word" : "PDF"} downloaded.`);
        return;
      }
      const file = new File(Paths.cache, filename);
      await file.write(await blob.arrayBuffer());
      if (Platform.OS === "android") {
        const permission = await StorageAccessFramework.requestDirectoryPermissionsAsync();
        if (!permission.granted) return;
        const destination = await StorageAccessFramework.createFileAsync(
          permission.directoryUri,
          filename,
          mimeType,
        );
        const base64 = await readAsStringAsync(file.uri, { encoding: "base64" });
        await StorageAccessFramework.writeAsStringAsync(destination, base64, { encoding: "base64" });
        setNotice(`Agreement ${format === "word" ? "Word" : "PDF"} saved to the selected folder.`);
        return;
      }
      if (!(await Sharing.isAvailableAsync())) {
        throw new Error("Document sharing is not available on this device.");
      }
      await Sharing.shareAsync(file.uri, { mimeType, dialogTitle: `Save agreement ${format.toUpperCase()}` });
      setNotice(`Agreement ${format === "word" ? "Word" : "PDF"} is ready to save.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : `Unable to download the agreement ${format} document.`);
    } finally {
      setDownloading(null);
    }
  }

  async function share() {
    setSharing(true);
    setNotice("");
    setError("");
    try {
      await shareAgreementPdf(session, agreement.id, agreement.agreementNumber);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to share the agreement PDF.");
    } finally {
      setSharing(false);
    }
  }
  return (
    <>
      <ActionButton
        label="Download PDF"
        variant="secondary"
        compact
        busy={downloading === "pdf"}
        icon={<Download size={15} color={colors.forest} />}
        onPress={() => void download("pdf")}
      />
      <ActionButton
        label="Download Word"
        variant="secondary"
        compact
        busy={downloading === "word"}
        icon={<Download size={15} color={colors.forest} />}
        onPress={() => void download("word")}
      />
      {Platform.OS !== "web" ? (
        <ActionButton
          label="Share PDF"
          variant="secondary"
          compact
          busy={sharing}
          icon={<Share2 size={15} color={colors.forest} />}
          onPress={() => void share()}
        />
      ) : null}
      {notice ? <Text style={styles.downloadNotice}>{notice}</Text> : null}
      {error ? <Notice message={error} /> : null}
    </>
  );
}

function TenantWorkspace({
  section,
  portal,
  onReview,
}: {
  section: string;
  portal: TenantPortal;
  onReview: (agreement: Agreement) => void;
}) {
  const [selectedAgreementYear, setSelectedAgreementYear] = useState<number | null>(null);
  const assetById = useMemo(
    () => new Map(portal.assets.map((asset) => [asset.id, asset])),
    [portal.assets],
  );
  const approvedAgreements = portal.agreements.filter(isApprovedAgreement);
  const agreementYears = [...new Set(approvedAgreements.map(
    (agreement) => Number(agreement.startDate.slice(0, 4)),
  ))].sort((left, right) => right - left);
  const yearAgreements = selectedAgreementYear === null
    ? []
    : approvedAgreements.filter(
      (agreement) => Number(agreement.startDate.slice(0, 4)) === selectedAgreementYear,
    );

  if (section === "Agreements") {
    return (
      <>
        <Heading
          title={selectedAgreementYear === null ? "My agreements" : `${selectedAgreementYear} agreements`}
          subtitle={selectedAgreementYear === null ? `${approvedAgreements.length} records` : `${yearAgreements.length} records`}
          right={selectedAgreementYear === null ? undefined : (
            <ActionButton
              label="All years"
              variant="secondary"
              compact
              onPress={() => setSelectedAgreementYear(null)}
            />
          )}
        />
        {selectedAgreementYear === null ? agreementYears.length ? agreementYears.map((year) => {
          const count = approvedAgreements.filter(
            (agreement) => Number(agreement.startDate.slice(0, 4)) === year,
          ).length;
          return (
            <Pressable
              key={year}
              accessibilityRole="button"
              onPress={() => setSelectedAgreementYear(year)}
              style={({ pressed }) => [styles.yearFolder, pressed && styles.pressed]}
            >
              <View style={styles.yearFolderIcon}><Folder size={22} color={colors.forest} /></View>
              <View style={styles.flexOne}>
                <Text style={styles.yearFolderLabel}>AGREEMENT YEAR</Text>
                <Text style={styles.yearFolderTitle}>{year}</Text>
              </View>
              <Text style={styles.yearFolderCount}>{count} {count === 1 ? "agreement" : "agreements"}</Text>
              <ChevronRight size={17} color={colors.leaf} />
            </Pressable>
          );
        }) : <EmptyState title="No approved agreements yet" text="Approved rental agreements will appear here when available." /> : yearAgreements.length ? yearAgreements.map((agreement) => (
          <AgreementCard
            key={agreement.id}
            agreement={agreement}
            asset={assetById.get(agreement.assetId ?? "")}
            onReview={() => onReview(agreement)}
          />
        )) : <EmptyState title={`No approved agreements in ${selectedAgreementYear}`} text="Choose another year or return to all agreement years." />}
      </>
    );
  }

  const currentAgreement = approvedAgreements.find((agreement) => agreement.status === "ACTIVE");
  const currentAsset = currentAgreement ? assetById.get(currentAgreement.assetId ?? "") : portal.assets[0];

  return (
    <>
      <Heading title={`Welcome, ${portal.tenant.fullName.split(" ")[0]}`} subtitle="Your rental home" />
      {currentAsset ? (
        <Panel style={styles.tenantHomeCard}>
          <View style={styles.tenantHomeTop}>
            <View style={styles.propertyIcon}><Building2 size={19} color={colors.forest} /></View>
            <View style={styles.flexOne}>
              <Text style={styles.mutedSmall}>YOUR RENTAL HOME</Text>
              <Text style={styles.tenantHomeTitle}>{currentAsset.buildingName ?? currentAsset.name}</Text>
              <Text style={styles.mutedSmall}>{currentAsset.buildingAddress ?? [currentAsset.city, currentAsset.state].filter(Boolean).join(", ")}</Text>
            </View>
          </View>
          <Divider />
          <View style={styles.tenantLeaseRow}>
            <View>
              <Text style={styles.mutedSmall}>Monthly rent</Text>
              <Text style={styles.tenantRent}>{money(currentAgreement?.monthlyRent ?? currentAsset.monthlyRent)}</Text>
            </View>
            <View style={styles.tenantLeaseRight}>
              <Text style={styles.mutedSmall}>Agreement ends</Text>
              <Text style={styles.tenantRent}>{shortDate(currentAgreement?.endDate)}</Text>
            </View>
          </View>
          <Text style={styles.unitHint}>Unit {currentAsset.unitNumber}{currentAsset.name ? ` · ${currentAsset.name}` : ""}</Text>
        </Panel>
      ) : (
        <Panel><EmptyState title="Your home will show here" text="A property owner can link your account to a unit and agreement." /></Panel>
      )}
      <Heading title="Agreement status" subtitle="Approval is recorded by the property owner" />
      {approvedAgreements.length ? approvedAgreements.slice(0, 3).map((agreement) => (
        <AgreementCard
          key={agreement.id}
          agreement={agreement}
          asset={assetById.get(agreement.assetId ?? "")}
          onReview={() => onReview(agreement)}
        />
      )) : <EmptyState title="No approved agreements yet" text="Approved agreement details will appear here." />}
    </>
  );
}

function AdminWorkspace({
  type,
  accounts,
  hasLoadError,
  onReset,
}: {
  type: AdminType;
  accounts: AdminAccounts;
  hasLoadError: boolean;
  onReset: (selected: { account: Account; type: AdminType }) => void;
}) {
  const [query, setQuery] = useState("");
  const list = type === "OWNER" ? accounts.owners : accounts.tenants;
  const filtered = list.filter((account) =>
    `${account.fullName} ${account.mobileNumber}`.toLowerCase().includes(query.trim().toLowerCase()),
  );

  return (
    <>
      <Heading
        title={type === "OWNER" ? "Owners" : "Tenants"}
        subtitle={`${list.length} accounts`}
      />
      <Field
        label="Search accounts"
        value={query}
        onChangeText={setQuery}
        placeholder="Name or mobile number"
        autoCapitalize="none"
      />
      {hasLoadError ? (
        <Panel><EmptyState title="Accounts unavailable" text="Check your internet connection and pull down to retry." /></Panel>
      ) : filtered.length ? filtered.map((account) => (
        <Panel key={account.id} style={styles.accountPanel}>
          <View style={styles.personRow}>
            <View style={styles.avatar}><CircleUserRound size={18} color={colors.forest} /></View>
            <View style={styles.flexOne}>
              <Text style={styles.cardTitle}>{account.fullName}</Text>
              <Text style={styles.mutedSmall}>{account.mobileNumber}</Text>
              <Text style={styles.unitHint}>Joined {shortDate(account.createdAt)}</Text>
            </View>
          </View>
          <ActionButton
            label="Reset password"
            variant="secondary"
            compact
            icon={<KeyRound size={15} color={colors.forest} />}
            onPress={() => onReset({ account, type })}
          />
        </Panel>
      )) : (
        <Panel><EmptyState title={query ? "No matching accounts" : "No accounts yet"} text={query ? "Try another name or mobile number." : "New accounts will appear here."} /></Panel>
      )}
    </>
  );
}

function AgreementCard({
  agreement,
  asset,
  tenant,
  onReview,
}: {
  agreement: Agreement;
  asset?: Asset;
  tenant?: Tenant;
  onReview: () => void;
}) {
  const state = getAgreementState(agreement);
  return (
    <Panel style={styles.agreementPanel}>
      <View style={styles.agreementHeading}>
        <View style={styles.agreementIcon}><FileCheck2 size={17} color={colors.forest} /></View>
        <View style={styles.flexOne}>
          <Text style={styles.cardTitle}>{agreement.agreementNumber || `Agreement ${agreement.agreementYear ?? ""}`}</Text>
          <Text style={styles.mutedSmall}>{asset?.name ?? asset?.buildingName ?? "Rental agreement"}{asset?.unitNumber ? ` · ${asset.unitNumber}` : ""}</Text>
          {tenant ? <Text style={styles.mutedSmall}>Tenant · {tenant.fullName}</Text> : null}
        </View>
        <StatePill state={state} />
      </View>
      <View style={styles.agreementFacts}>
        <Fact label="Monthly rent" value={money(agreement.monthlyRent)} />
        <Fact label="Term ends" value={shortDate(agreement.endDate)} />
      </View>
      <Divider />
      <ApprovalLine role="Owner" time={agreement.ownerApprovedAt} />
      <ActionButton label="View agreement" onPress={onReview} compact variant="secondary" />
    </Panel>
  );
}

function StatePill({ state }: { state: string }) {
  const positive = state === "Active" || state === "Approved";
  return (
    <View style={[styles.statePill, positive ? styles.statePillPositive : styles.statePillPending]}>
      <Text style={[styles.stateText, positive ? styles.stateTextPositive : styles.stateTextPending]}>{state}</Text>
    </View>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.fact}>
      <Text style={styles.factLabel}>{label}</Text>
      <Text style={styles.factValue}>{value}</Text>
    </View>
  );
}

function ReviewFact({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.reviewFact}>
      <Text style={styles.reviewFactLabel}>{label}</Text>
      <Text style={styles.reviewFactValue}>{value}</Text>
    </View>
  );
}

function ApprovalLine({ role, time }: { role: string; time?: string | null }) {
  return (
    <View style={styles.approvalLine}>
      {time ? <Check size={14} color={colors.leaf} /> : <Clock3 size={14} color={colors.gold} />}
      <Text style={styles.approvalText}>{role} {time ? `approved ${shortDate(time)}` : "approval pending"}</Text>
    </View>
  );
}

function ProfilePanel({
  session,
  profile,
  onSaved,
}: {
  session: MobileSession;
  profile: Profile | null;
  onSaved: () => Promise<void>;
}) {
  const [fullName, setFullName] = useState(profile?.fullName ?? "");
  const [email, setEmail] = useState(profile?.email ?? "");
  const [aadhaarNumber, setAadhaarNumber] = useState(profile?.aadhaarNumber ?? "");
  const [addressLine1, setAddressLine1] = useState(profile?.addressLine1 ?? "");
  const [addressLine2, setAddressLine2] = useState(profile?.addressLine2 ?? "");
  const [district, setDistrict] = useState(profile?.district ?? "");
  const [state, setState] = useState(profile?.state ?? "");
  const [city, setCity] = useState(profile?.city ?? "");
  const [postalCode, setPostalCode] = useState(profile?.postalCode ?? "");
  const [fatherName, setFatherName] = useState(profile?.fatherName ?? "");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [noticeTone, setNoticeTone] = useState<"error" | "success">("error");

  async function save() {
    setBusy(true);
    setNotice("");
    try {
      await updateOwnerProfile(session, {
        fullName,
        email,
        aadhaarNumber,
        addressLine1,
        addressLine2,
        district,
        state,
        city,
        postalCode,
        fatherName,
      });
      setNoticeTone("success");
      setNotice("Profile updated.");
      await onSaved();
    } catch (cause) {
      setNoticeTone("error");
      setNotice(cause instanceof Error ? cause.message : "Unable to save profile.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Panel>
      <Field label="Owner full name" value={fullName} onChangeText={setFullName} autoCapitalize="words" maxLength={120} />
      <Field label="Mobile number" value={profile?.mobileNumber ?? session.mobileNumber} editable={false} />
      <Field
        label="Aadhaar number"
        value={aadhaarNumber}
        onChangeText={(value) => setAadhaarNumber(value.replace(/\D/g, "").slice(0, 12))}
        keyboardType="number-pad"
        maxLength={12}
      />
      <Field label="Father / guardian name" value={fatherName} onChangeText={setFatherName} autoCapitalize="words" maxLength={120} />
      <Field label="Address line 1" value={addressLine1} onChangeText={setAddressLine1} maxLength={180} />
      <Field label="Address line 2" value={addressLine2} onChangeText={setAddressLine2} maxLength={120} />
      <Field label="District" value={district} onChangeText={setDistrict} maxLength={100} />
      <Field label="State" value={state} onChangeText={setState} maxLength={100} />
      <Field label="City" value={city} onChangeText={setCity} maxLength={100} />
      <Field
        label="Postal code"
        value={postalCode}
        onChangeText={(value) => setPostalCode(value.replace(/\D/g, "").slice(0, 12))}
        keyboardType="number-pad"
        maxLength={12}
      />
      <Field label="Email address" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" maxLength={254} />
      {notice ? <Notice message={notice} tone={noticeTone} /> : null}
      <ActionButton label="Save profile" onPress={() => void save()} busy={busy} />
    </Panel>
  );
}

function CreateSheet({
  kind,
  recordId,
  portfolio,
  session,
  onClose,
  onCreated,
}: {
  kind: CreateKind | null;
  recordId: string | null;
  portfolio: Portfolio | null;
  session: MobileSession;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [fields, setFields] = useState<Record<string, string>>((): Record<string, string> => {
    if (!recordId || !portfolio || !kind) return {};
    if (kind === "company") {
      const record = portfolio.companies.find((item) => item.id === recordId);
      return record ? { name: record.name } : {};
    }
    if (kind === "building") {
      const record = portfolio.buildings.find((item) => item.id === recordId);
      if (!record) return {};
      return {
      companyId: record.companyId ?? "",
      name: record.name,
      address: record.address,
      city: record.city,
      state: record.state,
      postalCode: record.postalCode,
      };
    }
    if (kind === "asset") {
      const record = portfolio.assets.find((item) => item.id === recordId);
      if (!record) return {};
      return {
      buildingId: record.buildingId ?? "",
      name: record.name,
      assetType: record.assetType,
      unitNumber: record.unitNumber,
      monthlyRent: String(record.monthlyRent),
      securityDeposit: String(record.securityDeposit),
      agreementDurationUnit: record.agreementDurationUnit ?? DEFAULT_AGREEMENT_DURATION_UNIT,
      agreementDurationValue: String(record.agreementDurationValue ?? DEFAULT_AGREEMENT_DURATION_VALUE),
      agreementStartDate: dateOnly(record.agreementStartDate) || localToday(),
      externalBuildingId: record.externalBuildingId ?? "",
      ward: record.ward ?? "",
      roomNumber: record.roomNumber ?? "",
      ksmartBuildingId: record.ksmartBuildingId ?? "",
      ksrbId: record.ksrbId ?? "",
      };
    }
    const record = portfolio.tenants.find((item) => item.id === recordId);
    if (!record) return {};
    return {
      fullName: record.fullName,
      mobileNumber: record.mobileNumber ?? "",
      businessName: record.businessName ?? "",
      businessNature: record.businessNature ?? "",
      fullAddress: record.fullAddress ?? "",
      addressLine1: record.addressLine1 ?? "",
      addressLine2: record.addressLine2 ?? "",
      district: record.district ?? "",
      state: record.state ?? "",
      city: record.city ?? "",
      postalCode: record.postalCode ?? "",
      aadhaarNumber: record.aadhaarNumber ?? "",
      fatherName: record.fatherName ?? "",
      email: record.email ?? "",
      photoDataUrl: record.photoDataUrl ?? "",
    };
  });
  const [busy, setBusy] = useState(false);
  const [contactBusy, setContactBusy] = useState(false);
  const [contactPhones, setContactPhones] = useState<{ id: string; label: string; number: string }[]>([]);
  const [error, setError] = useState("");
  const availableRentalUnits = useMemo(() => {
    if (!portfolio) return [];
    const assignedAssetIds = new Set(
      portfolio.tenants.flatMap((tenant) => tenant.assetIds ?? []),
    );
    for (const asset of portfolio.assets) {
      if (asset.tenantIds?.length) assignedAssetIds.add(asset.id);
    }
    return portfolio.assets.filter((asset) => !assignedAssetIds.has(asset.id));
  }, [portfolio]);

  function set(key: string, value: string) {
    setFields((current) => ({ ...current, [key]: value }));
  }

  async function chooseTenantPhoto() {
    setError("");
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        quality: 0.5,
        base64: true,
      });
      if (result.canceled) return;
      const photo = result.assets[0];
      if (!photo.base64 || !["image/jpeg", "image/png", "image/webp"].includes(photo.mimeType ?? "")) {
        throw new Error("Choose a JPEG, PNG, or WebP photo.");
      }
      if (photo.fileSize && photo.fileSize > 1_000_000) {
        throw new Error("Tenant photo must be 1 MB or smaller.");
      }
      set("photoDataUrl", `data:${photo.mimeType};base64,${photo.base64}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to choose the tenant photo.");
    }
  }

  async function chooseTenantContact() {
    setContactBusy(true);
    setError("");
    try {
      const contact = await Contact.presentPicker();
      if (!contact) return;
      const details = await contact.getDetails([
        ContactField.FULL_NAME,
        ContactField.GIVEN_NAME,
        ContactField.FAMILY_NAME,
        ContactField.PHONES,
      ]);
      const name =
        details.fullName?.trim() ||
        [details.givenName, details.familyName].filter(Boolean).join(" ").trim();
      const phones = (details.phones ?? []).flatMap((phone, index) =>
        typeof phone.number === "string" && phone.number.trim()
          ? [{
              id: `${index}-${phone.number}`,
              label: phone.label ? `${phone.label} · ${phone.number}` : phone.number,
              number: phone.number,
            }]
          : [],
      );
      setContactPhones(phones);
      setFields((current) => ({
        ...current,
        fullName: name || current.fullName || "",
        mobileNumber: phones[0]?.number ?? current.mobileNumber ?? "",
      }));
      if (!phones.length) setError("No saved phone number found for this contact. Enter it manually.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to open the selected contact.");
    } finally {
      setContactBusy(false);
    }
  }

  async function submit() {
    if (!kind) return;
    setBusy(true);
    setError("");
    try {
      let body: Record<string, unknown>;
      if (kind === "company") {
        body = { kind, name: fields.name ?? "" };
      } else if (kind === "building") {
        body = {
          kind,
          companyId: fields.companyId ?? "",
          name: fields.name ?? "",
          address: fields.address ?? "",
          city: fields.city ?? "",
          state: fields.state ?? "",
          postalCode: fields.postalCode ?? "",
        };
      } else if (kind === "asset") {
        const durationUnit: AgreementDurationUnit =
          fields.agreementDurationUnit === "YEAR" ? "YEAR" : DEFAULT_AGREEMENT_DURATION_UNIT;
        const durationValue = Number(fields.agreementDurationValue ?? DEFAULT_AGREEMENT_DURATION_VALUE);
        const agreementStartDate = fields.agreementStartDate ?? localToday();
        if (!addAgreementDuration(agreementStartDate, durationUnit, durationValue)) {
          throw new Error(`Enter a valid start date and duration (1-${durationUnit === "YEAR" ? 10 : 120} ${durationUnit.toLowerCase()}s).`);
        }
        body = {
          kind,
          buildingId: fields.buildingId ?? "",
          name: fields.name ?? "",
          assetType: fields.assetType || "Residential",
          unitNumber: fields.unitNumber ?? "",
          monthlyRent: Number(fields.monthlyRent),
          securityDeposit: Number(fields.securityDeposit || 0),
          agreementDurationUnit: durationUnit,
          agreementDurationValue: durationValue,
          agreementStartDate,
          externalBuildingId: fields.externalBuildingId ?? "",
          ward: fields.ward ?? "",
          roomNumber: fields.roomNumber ?? "",
          ksmartBuildingId: fields.ksmartBuildingId ?? "",
          ksrbId: fields.ksrbId ?? "",
        };
      } else {
        if (!recordId && fields.assetId && !availableRentalUnits.some((asset) => asset.id === fields.assetId)) {
          throw new Error("Choose an available rental unit that is not already assigned to a tenant.");
        }
        const digits = (fields.mobileNumber ?? "").replace(/\D/g, "");
        const mobile = digits.length === 10 ? `91${digits}` : digits;
        body = {
          kind,
          fullName: fields.fullName ?? "",
          ...(mobile ? { mobileNumber: mobile } : {}),
          businessName: fields.businessName ?? "",
          businessNature: fields.businessNature ?? "",
          fullAddress: fields.fullAddress ?? "",
          addressLine1: fields.addressLine1 ?? "",
          addressLine2: fields.addressLine2 ?? "",
          district: fields.district ?? "",
          state: fields.state ?? "",
          city: fields.city ?? "",
          postalCode: fields.postalCode ?? "",
          aadhaarNumber: fields.aadhaarNumber ?? "",
          fatherName: fields.fatherName ?? "",
          email: fields.email ?? "",
          photoDataUrl: fields.photoDataUrl ?? "",
          ...(fields.assetId && fields.startDate ? { assetId: fields.assetId, startDate: fields.startDate } : {}),
        };
      }
      if (recordId) {
        await authenticatedRequest(session, "/api/owner/portfolio", {
          method: "PATCH",
          body: { ...body, id: recordId },
        });
      } else {
        await createPortfolioItem(session, body);
      }
      onCreated();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to create this item.");
    } finally {
      setBusy(false);
    }
  }

  const title = `${recordId ? "Edit" : "Add"} ${
    kind === "company" ? "company" :
      kind === "building" ? "property" :
        kind === "asset" ? "unit" :
          kind === "tenant" ? "tenant" : ""
  }`;

  return (
    <Modal visible={Boolean(kind)} animationType="slide" transparent={false} onRequestClose={onClose}>
      <View style={[styles.createPage, Platform.OS === "android" && { paddingTop: StatusBar.currentHeight ?? 0 }]}>
        <View style={styles.createHeader}>
          <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={onClose} style={styles.ownerHeaderButton}>
            <ArrowLeft size={20} color={colors.forest} />
          </Pressable>
          <Text style={styles.createTitle}>{title}</Text>
          <View style={styles.ownerHeaderButton} />
        </View>
        <ScrollView
          style={styles.createScroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.createFields}
        >
            {kind === "company" ? (
              <Field label="Company name" value={fields.name ?? ""} onChangeText={(value) => set("name", value)} />
            ) : null}
            {kind === "building" ? (
              <>
                <SelectField label="Company" options={portfolio?.companies.map((item) => ({ id: item.id, label: item.name })) ?? []} value={fields.companyId ?? ""} onChange={(value) => set("companyId", value)} />
                <Field label="Property name" value={fields.name ?? ""} onChangeText={(value) => set("name", value)} />
                <Field label="Address" value={fields.address ?? ""} onChangeText={(value) => set("address", value)} />
                <View style={styles.formRow}>
                  <Field label="City" value={fields.city ?? ""} onChangeText={(value) => set("city", value)} style={styles.halfField} />
                  <Field label="State" value={fields.state ?? ""} onChangeText={(value) => set("state", value)} style={styles.halfField} />
                </View>
                <Field label="Postal code" value={fields.postalCode ?? ""} onChangeText={(value) => set("postalCode", value)} keyboardType="number-pad" maxLength={12} />
              </>
            ) : null}
            {kind === "asset" ? (
              <>
                <SelectField label="Property" options={portfolio?.buildings.map((item) => ({ id: item.id, label: item.name })) ?? []} value={fields.buildingId ?? ""} onChange={(value) => set("buildingId", value)} />
                <Field label="Unit name" value={fields.name ?? ""} onChangeText={(value) => set("name", value)} placeholder="Apartment 1B" />
                <View style={styles.formRow}>
                  <Field label="Unit number" value={fields.unitNumber ?? ""} onChangeText={(value) => set("unitNumber", value)} style={styles.halfField} />
                  <Field label="Type" value={fields.assetType ?? "Residential"} onChangeText={(value) => set("assetType", value)} style={styles.halfField} />
                </View>
                <View style={styles.formRow}>
                  <Field label="Monthly rent (₹)" value={fields.monthlyRent ?? ""} onChangeText={(value) => set("monthlyRent", value.replace(/\D/g, ""))} keyboardType="number-pad" style={styles.halfField} />
                  <Field label="Deposit (₹)" value={fields.securityDeposit ?? ""} onChangeText={(value) => set("securityDeposit", value.replace(/\D/g, ""))} keyboardType="number-pad" style={styles.halfField} />
                </View>
                <SelectField
                  label="Agreement duration unit"
                  options={[{ id: "MONTH", label: "Months" }, { id: "YEAR", label: "Years" }]}
                  value={fields.agreementDurationUnit ?? DEFAULT_AGREEMENT_DURATION_UNIT}
                  onChange={(value) => set("agreementDurationUnit", value)}
                />
                <Field
                  label={`Duration (${fields.agreementDurationUnit === "YEAR" ? "years" : "months"})`}
                  value={fields.agreementDurationValue ?? String(DEFAULT_AGREEMENT_DURATION_VALUE)}
                  onChangeText={(value) => set("agreementDurationValue", value.replace(/\D/g, ""))}
                  keyboardType="number-pad"
                  placeholder={String(DEFAULT_AGREEMENT_DURATION_VALUE)}
                />
                <Field
                  label="Agreement start date"
                  value={fields.agreementStartDate ?? localToday()}
                  onChangeText={(value) => set("agreementStartDate", value)}
                  placeholder="YYYY-MM-DD"
                />
                <Field label="Ward number (optional)" value={fields.ward ?? ""} onChangeText={(value) => set("ward", value)} />
                <Field label="Room number (optional)" value={fields.roomNumber ?? ""} onChangeText={(value) => set("roomNumber", value)} />
                <Field label="K-SMART building ID (optional)" value={fields.ksmartBuildingId ?? ""} onChangeText={(value) => set("ksmartBuildingId", value)} />
                <Field label="KSRB ID (optional)" value={fields.ksrbId ?? ""} onChangeText={(value) => set("ksrbId", value)} />
                <Field label="External building ID (optional)" value={fields.externalBuildingId ?? ""} onChangeText={(value) => set("externalBuildingId", value)} />
              </>
            ) : null}
            {kind === "tenant" ? (
              <>
                {!recordId && availableRentalUnits.length ? (
                  <SelectField
                    label="Rental unit (optional)"
                    options={availableRentalUnits.map((item) => ({ id: item.id, label: `${item.name} · ${item.unitNumber}` }))}
                    value={fields.assetId ?? ""}
                    onChange={(value) => set("assetId", value)}
                  />
                ) : !recordId && portfolio?.assets.length ? (
                  <Notice message="All units are assigned. You can still save the tenant profile without a rental assignment." />
                ) : null}
                {!recordId ? <Pressable
                  accessibilityRole="button"
                  disabled={contactBusy}
                  onPress={() => void chooseTenantContact()}
                  style={[styles.contactPickerButton, contactBusy && styles.contactPickerButtonDisabled]}
                >
                  {contactBusy ? (
                    <ActivityIndicator size="small" color={colors.forest} />
                  ) : (
                    <UsersRound size={17} color={colors.forest} />
                  )}
                  <Text style={styles.contactPickerText}>
                    {contactBusy ? "Opening contacts…" : "Choose from contacts"}
                  </Text>
                </Pressable> : null}
                <Field label="Tenant name" value={fields.fullName ?? ""} onChangeText={(value) => set("fullName", value)} autoCapitalize="words" />
                {contactPhones.length > 1 ? (
                  <SelectField
                    label="Saved phone numbers"
                    options={contactPhones.map(({ id, label }) => ({ id, label }))}
                    value={contactPhones.find((phone) => phone.number === fields.mobileNumber)?.id ?? ""}
                    onChange={(id) => {
                      const selected = contactPhones.find((phone) => phone.id === id);
                      if (selected) set("mobileNumber", selected.number);
                    }}
                  />
                ) : null}
                <Field label="Business name (optional)" value={fields.businessName ?? ""} onChangeText={(value) => set("businessName", value)} />
                <Field label="Business nature (optional)" value={fields.businessNature ?? ""} onChangeText={(value) => set("businessNature", value)} />
                <Field label="Address line 1 (optional)" value={fields.addressLine1 ?? ""} onChangeText={(value) => set("addressLine1", value)} maxLength={60} />
                <Field label="Address line 2 (optional)" value={fields.addressLine2 ?? ""} onChangeText={(value) => set("addressLine2", value)} maxLength={60} />
                <Field label="District (optional)" value={fields.district ?? ""} onChangeText={(value) => set("district", value)} maxLength={40} />
                <Field label="State (optional)" value={fields.state ?? ""} onChangeText={(value) => set("state", value)} maxLength={40} />
                <Field label="City (optional)" value={fields.city ?? ""} onChangeText={(value) => set("city", value)} maxLength={40} />
                <Field label="Postal code (optional)" value={fields.postalCode ?? ""} onChangeText={(value) => set("postalCode", value.replace(/\D/g, "").slice(0, 12))} keyboardType="number-pad" maxLength={12} />
                <Field label="Mobile number (optional)" value={fields.mobileNumber ?? ""} onChangeText={(value) => set("mobileNumber", value)} keyboardType="phone-pad" maxLength={15} />
                <Field label="Aadhaar number (optional)" value={fields.aadhaarNumber ?? ""} onChangeText={(value) => set("aadhaarNumber", value.replace(/\D/g, "").slice(0, 12))} keyboardType="number-pad" maxLength={12} />
                <Field label="Father's name (optional)" value={fields.fatherName ?? ""} onChangeText={(value) => set("fatherName", value)} maxLength={120} />
                <Field label="Email address (optional)" value={fields.email ?? ""} onChangeText={(value) => set("email", value)} keyboardType="email-address" autoCapitalize="none" />
                <Pressable accessibilityRole="button" onPress={() => void chooseTenantPhoto()} style={styles.contactPickerButton}>
                  <UsersRound size={17} color={colors.forest} />
                  <Text style={styles.contactPickerText}>{fields.photoDataUrl ? "Change tenant photo" : "Add tenant photo (optional)"}</Text>
                </Pressable>
                {fields.photoDataUrl ? <Image source={{ uri: fields.photoDataUrl }} style={{ width: 96, height: 96, borderRadius: 12 }} /> : null}
                {!recordId ? (
                  <>
                    <Field label="Agreement start date (optional)" value={fields.startDate ?? ""} onChangeText={(value) => set("startDate", value)} placeholder="YYYY-MM-DD" />
                    <Text style={styles.formHint}>The agreement draft will use the selected unit&apos;s duration and start date. Tenant name is the only required tenant field.</Text>
                  </>
                ) : null}
              </>
            ) : null}
            {kind && ((kind === "building" && !portfolio?.companies.length) || (kind === "asset" && !portfolio?.buildings.length) || (kind === "tenant" && !portfolio?.assets.length)) ? (
              <Notice message={kind === "building" ? "Add a company before creating a property." : kind === "asset" ? "Add a property before creating a unit." : "Add a unit before creating a tenant."} />
            ) : null}
            {error ? <Notice message={error} /> : null}
            <ActionButton label={title} onPress={() => void submit()} busy={busy} disabled={
              Boolean(kind === "building" && !portfolio?.companies.length) ||
              Boolean(kind === "asset" && !portfolio?.buildings.length) ||
              Boolean(kind === "tenant" && !recordId && fields.assetId &&
                !availableRentalUnits.some((asset) => asset.id === fields.assetId))
            } />
        </ScrollView>
      </View>
    </Modal>
  );
}

function SelectField({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { id: string; label: string }[];
  value: string;
  onChange: (id: string) => void;
}) {
  if (!options.length) return <Notice message={`No ${label.toLowerCase()} options are available yet.`} />;
  return (
    <View style={styles.selectField}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.choiceList}>
        {options.map((option) => (
          <Choice
            key={option.id}
            value={option.id}
            label={option.label}
            selected={value === option.id}
            onPress={onChange}
          />
        ))}
      </View>
    </View>
  );
}

export function AgreementReviewSheet({
  agreement,
  readOnly,
  session,
  portal,
  portfolio,
  ownerProfile,
  tenantOverride,
  assetOverride,
  onClose,
  onSignOut,
  onApproved,
}: {
  agreement: Agreement | null;
  readOnly: boolean;
  session: MobileSession | null;
  portal: TenantPortal | null;
  portfolio: Portfolio | null;
  ownerProfile?: Profile | null;
  tenantOverride?: Pick<Tenant, "fullName" | "mobileNumber"> &
    Partial<Pick<Tenant, "businessName" | "businessNature" | "addressLine1" | "addressLine2" | "district" | "state" | "city" | "postalCode" | "aadhaarNumber">>;
  assetOverride?: Pick<Asset, "name" | "unitNumber" | "buildingName" | "buildingAddress" | "city" | "state">;
  onClose: () => void;
  onSignOut?: () => void;
  onApproved?: () => void;
}) {
  const [step, setStep] = useState(0);
  const [furthestStep, setFurthestStep] = useState(0);
  const [values, setValues] = useState<ReviewValues>(() => ({
    startDate: dateOnly(agreement?.startDate),
    monthlyRent: agreement ? String(agreement.monthlyRent) : "",
    securityDeposit: agreement ? String(agreement.securityDeposit) : "",
    terms: agreement?.terms ?? "",
  }));
  const [approvalDetails, setApprovalDetails] = useState<ApprovalDetails>(() =>
    initialApprovalDetails(agreement, ownerProfile, portfolio, portal, tenantOverride, assetOverride),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const assetId = agreement?.assetId;
  const tenantId = agreement?.tenantId;
  const asset = agreement
    ? portfolio?.assets.find((item) => item.id === assetId)
      ?? portal?.assets.find((item) => item.id === assetId)
    : undefined;
  const tenant = agreement
    ? tenantOverride ?? portfolio?.tenants.find((item) => item.id === tenantId)
      ?? portal?.tenant
    : undefined;
  const agreementAssets = agreement && asset
    ? [...new Map(
      [asset, ...(agreement.mergedAssetIds ?? [])
        .map((mergedAssetId) => portfolio?.assets.find((item) => item.id === mergedAssetId))
        .filter((item): item is Asset => Boolean(item))]
        .map((item) => [item.id, item]),
    ).values()]
    : [];
  const assetDetails = assetOverride ?? asset;
  const durationUnit: AgreementDurationUnit =
    asset?.agreementDurationUnit === "YEAR" ? "YEAR" : DEFAULT_AGREEMENT_DURATION_UNIT;
  const durationValue = asset?.agreementDurationValue ?? DEFAULT_AGREEMENT_DURATION_VALUE;
  const endDate = readOnly && agreement?.endDate
    ? dateOnly(agreement.endDate)
    : addAgreementDuration(values.startDate, durationUnit, durationValue);
  const mappedTerms = dedupeAgreementTermGroups(agreement?.templateTerms).flatMap((template) => template.items);
  const isOwner = session?.role === "OWNER";
  const steps = [
    { label: "Name", title: "Confirm the people and property" },
    { label: "Rent", title: "Review the monthly rent" },
    { label: "Expiry", title: "Confirm the agreement period" },
    { label: "Advance", title: "Confirm the security deposit" },
    { label: "Terms", title: "Read the agreement terms" },
    { label: readOnly ? "Review" : "Owner approval", title: "Review the complete agreement" },
  ];

  function update(key: keyof ReviewValues, value: string) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  function updateApprovalDetail(key: keyof ApprovalDetails, value: string) {
    setApprovalDetails((current) => ({ ...current, [key]: value }));
  }

  function validateApprovalDetails() {
    const required: Array<keyof ApprovalDetails> = [
      "ownerFullName", "ownerAadhaarNumber", "ownerAddressLine1", "ownerDistrict",
      "ownerState", "ownerCity", "ownerPostalCode", "ownerFatherName",
      "tenantFullName", "tenantMobileNumber", "tenantBusinessName", "tenantBusinessNature",
      "tenantAddressLine1", "tenantDistrict", "tenantState", "tenantCity",
      "tenantPostalCode", "tenantAadhaarNumber", "buildingAddress", "buildingCity",
      "buildingState", "buildingPostalCode", "buildingPanchayat", "assetWard",
      "assetRoomNumber",
    ];
    if (required.some((key) => !approvalDetails[key].trim())) {
      return "Complete every required owner, tenant, and property field before continuing.";
    }
    if (!/^\d{12}$/.test(approvalDetails.ownerAadhaarNumber.trim())) {
      return "Owner Aadhaar must contain exactly 12 digits.";
    }
    if (!/^\d{12}$/.test(approvalDetails.tenantAadhaarNumber.trim())) {
      return "Tenant Aadhaar must contain exactly 12 digits.";
    }
    if (!/^\d{10,15}$/.test(approvalDetails.tenantMobileNumber.replace(/\D/g, ""))) {
      return "Enter a valid tenant mobile number.";
    }
    return "";
  }

  function continueReview() {
    setError("");
    if (readOnly) {
      if (step < steps.length - 1) {
        const nextStep = step + 1;
        setStep(nextStep);
        setFurthestStep((furthest) => Math.max(furthest, nextStep));
      }
      return;
    }
    if (step === 0 && isOwner) {
      const detailsError = validateApprovalDetails();
      if (detailsError) {
        setError(detailsError);
        return;
      }
    }
    if (step === 1) {
      const rent = Number(values.monthlyRent);
      if (!Number.isSafeInteger(rent) || rent <= 0) {
        setError("Enter a whole-number monthly rent greater than zero.");
        return;
      }
    }
    if (step === 2 && (!values.startDate || !endDate)) {
      setError(`Choose a valid start date for the ${durationValue}-${durationUnit.toLowerCase()} agreement period.`);
      return;
    }
    if (step === 3) {
      const deposit = Number(values.securityDeposit);
      if (!Number.isSafeInteger(deposit) || deposit < 0) {
        setError("Enter a whole-number security deposit of zero or more.");
        return;
      }
    }
    if (step < steps.length - 1) {
      const nextStep = step + 1;
      setStep(nextStep);
      setFurthestStep((furthest) => Math.max(furthest, nextStep));
    }
  }

  async function approve() {
    if (readOnly || !agreement || !session) return;
    const rent = Number(values.monthlyRent);
    const deposit = Number(values.securityDeposit);
    if (!endDate || !Number.isSafeInteger(rent) || rent <= 0 || !Number.isSafeInteger(deposit) || deposit < 0) {
      setError("Review the start date, monthly rent, and security deposit before approving.");
      return;
    }
    if (values.terms.length > 2000) {
      setError("Agreement terms exceed the allowed length.");
      return;
    }
    if (session.role !== "OWNER") {
      setError("Only the owner can approve this agreement.");
      return;
    }
    const detailsError = validateApprovalDetails();
    if (detailsError) {
      setStep(0);
      setFurthestStep((furthest) => Math.max(furthest, 0));
      setError(detailsError);
      return;
    }
    setBusy(true);
    setError("");
    try {
      await approveAgreement(session, agreement.id, {
        startDate: values.startDate,
        endDate,
        monthlyRent: rent,
        securityDeposit: deposit,
        terms: values.terms,
        ownerFullName: approvalDetails.ownerFullName.trim(),
        ownerAadhaarNumber: approvalDetails.ownerAadhaarNumber.trim(),
        ownerAddressLine1: approvalDetails.ownerAddressLine1.trim(),
        ownerAddressLine2: approvalDetails.ownerAddressLine2.trim(),
        ownerDistrict: approvalDetails.ownerDistrict.trim(),
        ownerState: approvalDetails.ownerState.trim(),
        ownerCity: approvalDetails.ownerCity.trim(),
        ownerPostalCode: approvalDetails.ownerPostalCode.trim(),
        ownerFatherName: approvalDetails.ownerFatherName.trim(),
        tenantFullName: approvalDetails.tenantFullName.trim(),
        tenantMobileNumber: approvalDetails.tenantMobileNumber.replace(/\D/g, ""),
        tenantBusinessName: approvalDetails.tenantBusinessName.trim(),
        tenantBusinessNature: approvalDetails.tenantBusinessNature.trim(),
        tenantAddressLine1: approvalDetails.tenantAddressLine1.trim(),
        tenantAddressLine2: approvalDetails.tenantAddressLine2.trim(),
        tenantDistrict: approvalDetails.tenantDistrict.trim(),
        tenantState: approvalDetails.tenantState.trim(),
        tenantCity: approvalDetails.tenantCity.trim(),
        tenantPostalCode: approvalDetails.tenantPostalCode.trim(),
        tenantAadhaarNumber: approvalDetails.tenantAadhaarNumber.trim(),
        buildingAddress: approvalDetails.buildingAddress.trim(),
        buildingCity: approvalDetails.buildingCity.trim(),
        buildingState: approvalDetails.buildingState.trim(),
        buildingPostalCode: approvalDetails.buildingPostalCode.trim(),
        buildingPanchayat: approvalDetails.buildingPanchayat.trim(),
        assetWard: approvalDetails.assetWard.trim(),
        assetRoomNumber: approvalDetails.assetRoomNumber.trim(),
      });
      onApproved?.();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to approve this agreement.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal visible={Boolean(agreement)} animationType="slide" transparent={false} onRequestClose={onClose}>
      <View style={[styles.reviewPage, Platform.OS === "android" && { paddingTop: StatusBar.currentHeight ?? 0 }]}>
        <View style={styles.reviewHeader}>
          <Pressable accessibilityRole="button" accessibilityLabel="Close agreement review" onPress={onClose} style={styles.ownerHeaderButton}>
            <ArrowLeft size={20} color={colors.forest} />
          </Pressable>
          <View style={styles.flexOne}>
            <Text style={styles.reviewHeaderTitle}>
              {readOnly ? "Agreement review" : isOwner ? "Owner approval" : "Tenant approval"}
            </Text>
            <Text numberOfLines={1} style={styles.mutedSmall}>{agreement?.agreementNumber || "Rental agreement"}</Text>
          </View>
          <StatePill state={agreement ? getAgreementState(agreement) : "Draft"} />
          {onSignOut ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Log out"
              disabled={busy}
              onPress={onSignOut}
              style={styles.reviewLogoutButton}
            >
              <LogOut size={15} color={colors.forest} />
              <Text style={styles.reviewLogoutText}>Log out</Text>
            </Pressable>
          ) : null}
        </View>
        <View style={styles.reviewProgress}>
          {steps.map((item, index) => (
            <Pressable
              key={item.label}
              accessibilityRole="tab"
              accessibilityLabel={`Step ${index + 1}: ${item.label}`}
              accessibilityState={{ selected: step === index, disabled: index > furthestStep }}
              disabled={index > furthestStep}
              onPress={() => setStep(index)}
              style={styles.reviewProgressButton}
            >
              <View
                style={[
                  styles.reviewProgressSegment,
                  index < step && styles.reviewProgressComplete,
                  index === step && styles.reviewProgressCurrent,
                ]}
              >
                <Text
                  numberOfLines={1}
                  style={[
                    styles.reviewProgressLabel,
                    index < step && styles.reviewProgressLabelComplete,
                    index === step && styles.reviewProgressLabelCurrent,
                  ]}
                >
                  {item.label}
                </Text>
              </View>
            </Pressable>
          ))}
        </View>
        <ScrollView
          style={styles.reviewScroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.reviewContent}
        >
          {readOnly && step === 4 ? null : (
            <>
              <Text style={styles.reviewEyebrow}>STEP {step + 1} OF {steps.length}</Text>
              <Text style={styles.reviewStepTitle}>{steps[step]?.title}</Text>
            </>
          )}

          {step === 0 ? (
            <>
              <View style={styles.reviewFactsGrid}>
                <ReviewFact label="Tenant" value={tenant?.fullName ?? "Tenant account"} />
                <ReviewFact label="Mobile number" value={readOnly ? "Private on this page" : tenant?.mobileNumber ? `+${tenant.mobileNumber}` : "Not provided"} />
                <ReviewFact label="Property" value={assetDetails?.buildingName ?? assetDetails?.name ?? "Rental property"} />
                <ReviewFact label="Unit" value={assetDetails?.unitNumber ?? "—"} />
                <ReviewFact label="Address" value={assetDetails?.buildingAddress ?? ([assetDetails?.city, assetDetails?.state].filter(Boolean).join(", ") || "Not recorded")} />
                <ReviewFact label="Agreement" value={agreement?.agreementNumber || "—"} />
              </View>
              {isOwner && !readOnly ? (
                <>
                  <Panel style={styles.reviewInfo}>
                    <Text style={styles.cardTitle}>Owner details</Text>
                    <Field label="Owner full name *" value={approvalDetails.ownerFullName} onChangeText={(value) => updateApprovalDetail("ownerFullName", value)} maxLength={120} />
                    <Field label="Aadhaar number *" value={approvalDetails.ownerAadhaarNumber} onChangeText={(value) => updateApprovalDetail("ownerAadhaarNumber", value.replace(/\D/g, "").slice(0, 12))} keyboardType="number-pad" maxLength={12} />
                    <Field label="Address line 1 *" value={approvalDetails.ownerAddressLine1} onChangeText={(value) => updateApprovalDetail("ownerAddressLine1", value)} maxLength={60} />
                    <Field label="Address line 2" value={approvalDetails.ownerAddressLine2} onChangeText={(value) => updateApprovalDetail("ownerAddressLine2", value)} maxLength={60} />
                    <Field label="District *" value={approvalDetails.ownerDistrict} onChangeText={(value) => updateApprovalDetail("ownerDistrict", value)} maxLength={40} />
                    <Field label="State *" value={approvalDetails.ownerState} onChangeText={(value) => updateApprovalDetail("ownerState", value)} maxLength={40} />
                    <Field label="City *" value={approvalDetails.ownerCity} onChangeText={(value) => updateApprovalDetail("ownerCity", value)} maxLength={40} />
                    <Field label="Postal code *" value={approvalDetails.ownerPostalCode} onChangeText={(value) => updateApprovalDetail("ownerPostalCode", value.replace(/\D/g, "").slice(0, 12))} keyboardType="number-pad" maxLength={12} />
                    <Field label="Father / guardian name *" value={approvalDetails.ownerFatherName} onChangeText={(value) => updateApprovalDetail("ownerFatherName", value)} maxLength={120} />
                  </Panel>
                  <Panel style={styles.reviewInfo}>
                    <Text style={styles.cardTitle}>Tenant details</Text>
                    <Text style={styles.reviewSavedProfileNote}>Latest saved tenant profile loaded. Review it and edit only if needed.</Text>
                    <Field label="Tenant full name *" value={approvalDetails.tenantFullName} onChangeText={(value) => updateApprovalDetail("tenantFullName", value)} maxLength={120} />
                    <Field label="Mobile number *" value={approvalDetails.tenantMobileNumber} onChangeText={(value) => updateApprovalDetail("tenantMobileNumber", value)} keyboardType="phone-pad" maxLength={15} />
                    <Field label="Business name *" value={approvalDetails.tenantBusinessName} onChangeText={(value) => updateApprovalDetail("tenantBusinessName", value)} maxLength={160} />
                    <Field label="Business nature *" value={approvalDetails.tenantBusinessNature} onChangeText={(value) => updateApprovalDetail("tenantBusinessNature", value)} maxLength={160} />
                    <Field label="Address line 1 *" value={approvalDetails.tenantAddressLine1} onChangeText={(value) => updateApprovalDetail("tenantAddressLine1", value)} maxLength={60} />
                    <Field label="Address line 2" value={approvalDetails.tenantAddressLine2} onChangeText={(value) => updateApprovalDetail("tenantAddressLine2", value)} maxLength={60} />
                    <Field label="District *" value={approvalDetails.tenantDistrict} onChangeText={(value) => updateApprovalDetail("tenantDistrict", value)} maxLength={40} />
                    <Field label="State *" value={approvalDetails.tenantState} onChangeText={(value) => updateApprovalDetail("tenantState", value)} maxLength={40} />
                    <Field label="City *" value={approvalDetails.tenantCity} onChangeText={(value) => updateApprovalDetail("tenantCity", value)} maxLength={40} />
                    <Field label="Postal code *" value={approvalDetails.tenantPostalCode} onChangeText={(value) => updateApprovalDetail("tenantPostalCode", value.replace(/\D/g, "").slice(0, 12))} keyboardType="number-pad" maxLength={12} />
                    <Field label="Aadhaar number *" value={approvalDetails.tenantAadhaarNumber} onChangeText={(value) => updateApprovalDetail("tenantAadhaarNumber", value.replace(/\D/g, "").slice(0, 12))} keyboardType="number-pad" maxLength={12} />
                  </Panel>
                  <Panel style={styles.reviewInfo}>
                    <Text style={styles.cardTitle}>Building and unit details</Text>
                    <Field label="Building address *" value={approvalDetails.buildingAddress} onChangeText={(value) => updateApprovalDetail("buildingAddress", value)} maxLength={255} />
                    <Field label="City *" value={approvalDetails.buildingCity} onChangeText={(value) => updateApprovalDetail("buildingCity", value)} maxLength={100} />
                    <Field label="State *" value={approvalDetails.buildingState} onChangeText={(value) => updateApprovalDetail("buildingState", value)} maxLength={100} />
                    <Field label="Postal code *" value={approvalDetails.buildingPostalCode} onChangeText={(value) => updateApprovalDetail("buildingPostalCode", value.replace(/\D/g, "").slice(0, 12))} keyboardType="number-pad" maxLength={12} />
                    <Field label="Panchayat *" value={approvalDetails.buildingPanchayat} onChangeText={(value) => updateApprovalDetail("buildingPanchayat", value)} maxLength={120} />
                    <Field label="Ward number *" value={approvalDetails.assetWard} onChangeText={(value) => updateApprovalDetail("assetWard", value)} maxLength={20} />
                    <Field label="Room / unit number *" value={approvalDetails.assetRoomNumber} onChangeText={(value) => updateApprovalDetail("assetRoomNumber", value)} maxLength={40} />
                  </Panel>
                </>
              ) : null}
            </>
          ) : null}

          {step === 1 ? (
            <Panel style={styles.reviewInfo}>
              <Text style={styles.reviewCardEyebrow}>MONTHLY RENT</Text>
              <Field
                label="Monthly rent (₹)"
                value={values.monthlyRent}
                onChangeText={(value) => update("monthlyRent", value.replace(/\D/g, ""))}
                editable={!readOnly}
                keyboardType="number-pad"
                placeholder="Enter monthly rent"
                labelStyle={styles.reviewFieldLabel}
                inputStyle={styles.reviewFieldInput}
              />
              <View style={styles.reviewDepositSummary}>
                <Text style={styles.reviewDepositLabel}>Monthly rent</Text>
                <Text style={styles.reviewDepositValue}>
                  {values.monthlyRent ? money(Number(values.monthlyRent)) : "Enter rent amount"}
                </Text>
                <Text style={styles.reviewDepositHint}>Payable each month during the agreement term.</Text>
              </View>
            </Panel>
          ) : null}

          {step === 2 ? (
            <Panel style={styles.reviewInfo}>
              <Text style={styles.reviewCardEyebrow}>AGREEMENT EXPIRY · 11 MONTHS</Text>
              <Field
                label="Agreement start date"
                value={values.startDate}
                onChangeText={(value) => update("startDate", value)}
                editable={!readOnly}
                placeholder="YYYY-MM-DD"
                labelStyle={styles.reviewFieldLabel}
                inputStyle={styles.reviewFieldInput}
              />
              <View style={styles.reviewRentPeriod}>
                <View style={styles.reviewRentDate}>
                  <Text style={styles.reviewRentDateLabel}>START DATE</Text>
                  <Text style={styles.reviewRentDateValue}>{values.startDate ? shortDate(values.startDate) : "Not set"}</Text>
                </View>
                <View style={styles.reviewRentDate}>
                  <Text style={styles.reviewRentDateLabel}>END DATE</Text>
                  <Text style={styles.reviewRentDateValue}>{endDate ? shortDate(endDate) : "Choose a valid date"}</Text>
                </View>
              </View>
            </Panel>
          ) : null}

          {step === 3 ? (
            <Panel style={styles.reviewInfo}>
              <Text style={styles.reviewCardEyebrow}>PAYMENT DETAILS</Text>
              <Field
                label="Security deposit (₹)"
                value={values.securityDeposit}
                onChangeText={(value) => update("securityDeposit", value.replace(/\D/g, ""))}
                editable={!readOnly}
                keyboardType="number-pad"
                placeholder="0"
                labelStyle={styles.reviewFieldLabel}
                inputStyle={styles.reviewFieldInput}
              />
              <View style={styles.reviewDepositSummary}>
                <Text style={styles.reviewDepositLabel}>Security deposit</Text>
                <Text style={styles.reviewDepositValue}>{money(Number(values.securityDeposit))}</Text>
                <Text style={styles.reviewDepositHint}>Confirm the agreed one-time advance amount.</Text>
              </View>
            </Panel>
          ) : null}

          {step === 4 ? readOnly ? (
            mappedTerms.length || values.terms.trim() ? (
              <Panel style={styles.reviewInfo}>
                {mappedTerms.map((item, index) => (
                  <Text key={item.id} style={styles.reviewSummaryText}>
                    {index + 1}. {item.text}
                  </Text>
                ))}
                {values.terms.trim() ? (
                  <Text style={styles.reviewSummaryText}>
                    {mappedTerms.length + 1}. {values.terms.trim()}
                  </Text>
                ) : null}
              </Panel>
            ) : null
          ) : (
            <Panel style={styles.reviewInfo}>
              {mappedTerms.length ? mappedTerms.map((item, index) => (
                <Text key={item.id} style={styles.reviewSummaryText}>
                  {index + 1}. {item.text}
                </Text>
              )) : (
                <Text style={styles.reviewSummaryText}>No property terms are mapped to this unit.</Text>
              )}
              <Field
                label="Terms and notes"
                value={values.terms}
                onChangeText={(value) => update("terms", value)}
                editable
                multiline
                numberOfLines={7}
                maxLength={2000}
                placeholder="Enter additional agreed conditions"
                style={styles.multilineField}
                labelStyle={styles.reviewFieldLabel}
                inputStyle={styles.reviewFieldInput}
              />
              <Text style={styles.reviewCharacterCount}>{values.terms.length}/2000 characters</Text>
            </Panel>
          ) : null}

          {step === 5 ? (
            <>
              <Panel style={styles.reviewInfo}>
                <Text style={styles.cardTitle}>Agreement summary</Text>
                <ReviewFact label="Tenant" value={tenant?.fullName ?? "Tenant account"} />
                <ReviewFact
                  label={agreementAssets.length > 1 ? "Assets and units" : "Property and unit"}
                  value={agreementAssets.length
                    ? agreementAssets.map((item) => `${item.name} · Unit ${item.unitNumber}`).join(", ")
                    : `${asset?.buildingName ?? asset?.name ?? "Rental property"} · ${asset?.unitNumber ?? "—"}`}
                />
                <ReviewFact label="Agreement period" value={`${shortDate(values.startDate)} – ${endDate ? shortDate(endDate) : "Invalid start date"}`} />
                <ReviewFact label="Monthly rent" value={money(Number(values.monthlyRent))} />
                <ReviewFact label="Security deposit" value={money(Number(values.securityDeposit))} />
                <Divider />
                {readOnly ? (
                  mappedTerms.length || values.terms.trim() ? (
                    <>
                      {mappedTerms.map((item, index) => (
                        <Text key={item.id} style={styles.reviewSummaryText}>
                          {index + 1}. {item.text}
                        </Text>
                      ))}
                      {values.terms.trim() ? (
                        <Text style={styles.reviewSummaryText}>
                          {mappedTerms.length + 1}. {values.terms.trim()}
                        </Text>
                      ) : null}
                    </>
                  ) : null
                ) : (
                  <>
                    <Text style={styles.cardTitle}>Mapped property terms</Text>
                    {mappedTerms.length ? mappedTerms.map((item, index) => (
                      <Text key={item.id} style={styles.reviewSummaryText}>
                        {index + 1}. {item.text}
                      </Text>
                    )) : (
                      <Text style={styles.reviewSummaryText}>No property terms are mapped to this unit.</Text>
                    )}
                    <Text style={styles.cardTitle}>Terms and notes</Text>
                    <Text style={styles.reviewSummaryText}>{values.terms.trim() || "No additional terms recorded."}</Text>
                  </>
                )}
              </Panel>
              <Panel style={styles.reviewInfo}>
                <Text style={styles.cardTitle}>Approval status</Text>
                <ApprovalLine role="Owner" time={agreement?.ownerApprovedAt} />
              </Panel>
              {!isOwner && !agreement?.ownerApprovedAt ? (
                <Notice message="This agreement is waiting for the owner's approval." />
              ) : null}
            </>
          ) : null}

          {error ? <Notice message={error} /> : null}
        </ScrollView>
        <View style={styles.reviewFooter}>
          <View style={styles.reviewActionButton}>
            <ActionButton
              label={step === 0 ? readOnly ? "Close" : "Cancel" : "Back"}
              variant="secondary"
              onPress={() => {
                if (step === 0) {
                  onClose();
                  return;
                }
                setError("");
                setStep((current) => current - 1);
              }}
              disabled={busy}
            />
          </View>
          <View style={styles.reviewActionButton}>
          {step < steps.length - 1 ? (
            <ActionButton
              label="Next"
              onPress={continueReview}
              icon={<ChevronRight size={17} color={colors.white} />}
              disabled={busy}
            />
          ) : readOnly ? (
            <ActionButton
              label="Done"
              onPress={onClose}
              icon={<Check size={16} color={colors.white} />}
            />
          ) : (
            <ActionButton
              label="Approve"
              onPress={() => void approve()}
              busy={busy}
              icon={<Check size={16} color={colors.white} />}
              disabled={!isOwner && !agreement?.ownerApprovedAt}
            />
          )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

function PasswordSheet({
  selected,
  session,
  onClose,
  onReset,
}: {
  selected: { account: Account; type: AdminType } | null;
  session: MobileSession;
  onClose: () => void;
  onReset: () => void;
}) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    if (!selected) return;
    if (password.length < 8 || password.length > 128) {
      setError("Password must be between 8 and 128 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await resetAccountPassword(
        session,
        selected.type,
        selected.account.mobileNumber,
        password,
      );
      onReset();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to reset this password.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal visible={Boolean(selected)} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalRoot}>
        <Pressable accessibilityLabel="Close" style={styles.modalShade} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.sheetHandle} />
          <View style={styles.sheetHeading}>
            <View>
              <Text style={styles.sheetTitle}>Reset password</Text>
              <Text style={styles.mutedSmall}>{selected?.account.fullName} · {selected?.account.mobileNumber}</Text>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={onClose} style={styles.closeButton}>
              <X size={19} color={colors.ink} />
            </Pressable>
          </View>
          <View style={styles.sheetFields}>
            <Field label="New password" value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none" maxLength={128} />
            <Field label="Confirm new password" value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry autoCapitalize="none" maxLength={128} />
            {error ? <Notice message={error} /> : null}
            <ActionButton label="Save new password" onPress={() => void submit()} busy={busy} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingTop: 9,
    paddingBottom: 11,
  },
  brandLine: { flexDirection: "row", alignItems: "center", gap: 10 },
  brandIcon: { width: 37, height: 37, borderRadius: 13, backgroundColor: colors.forest, alignItems: "center", justifyContent: "center" },
  brandTextWrap: { gap: 1 },
  brandTitle: { color: colors.ink, fontSize: 14, fontWeight: "800" },
  brandRole: { color: colors.muted, fontSize: 10, fontWeight: "600" },
  signOut: { width: 38, height: 38, borderRadius: 13, alignItems: "center", justifyContent: "center", backgroundColor: colors.mint },
  adminNotice: { flexDirection: "row", gap: 7, alignItems: "center", marginHorizontal: 18, marginBottom: 6 },
  adminNoticeText: { color: colors.forest, fontSize: 11, fontWeight: "700" },
  sectionTabs: { paddingHorizontal: 18, paddingBottom: 5, gap: 7 },
  sectionTab: { paddingHorizontal: 15, paddingVertical: 9, borderRadius: 99, backgroundColor: "#E9EDE7" },
  sectionTabSelected: { backgroundColor: colors.forest },
  sectionTabText: { color: colors.muted, fontSize: 11, fontWeight: "700" },
  sectionTabTextSelected: { color: colors.white },
  loading: { flex: 1, justifyContent: "center", alignItems: "center", gap: 12 },
  loadingText: { color: colors.muted, fontSize: 12 },
  ownerRoot: { flex: 1, backgroundColor: colors.background },
  ownerHeader: {
    minHeight: 56,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    backgroundColor: colors.surface,
  },
  ownerHeaderButton: {
    width: 40,
    height: 40,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.mint,
  },
  ownerHeaderTitle: { flex: 1, color: colors.ink, fontSize: 16, fontWeight: "700" },
  ownerScroll: { flex: 1 },
  ownerContent: { paddingHorizontal: 14, paddingTop: 12, paddingBottom: 24, gap: 9 },
  ownerError: { paddingHorizontal: 14, paddingTop: 10 },
  reviewRefreshingOverlay: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 10,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: "rgba(255,255,255,0.82)",
  },
  reviewRefreshingText: { color: colors.forest, fontSize: 12, fontWeight: "700" },
  ownerRecordCount: { color: colors.muted, fontSize: 11, fontWeight: "600", paddingHorizontal: 3, paddingBottom: 2 },
  buildingTotals: { flexDirection: "row", gap: 9 },
  buildingTotalCard: { flex: 1, minWidth: 0, minHeight: 76, justifyContent: "center", gap: 7, paddingHorizontal: 12, paddingVertical: 11, borderWidth: 1, borderColor: colors.line, borderRadius: 14, backgroundColor: colors.surface },
  buildingTotalLabel: { color: colors.muted, fontSize: 8, fontWeight: "800", letterSpacing: 0.45 },
  buildingTotalValue: { color: colors.forest, fontSize: 17, fontWeight: "800" },
  ownerRow: {
    minHeight: 64,
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 14,
  },
  ownerRowIcon: { width: 38, height: 38, borderRadius: 12, backgroundColor: colors.mint, alignItems: "center", justifyContent: "center" },
  ownerRowTitle: { color: colors.ink, fontSize: 13, fontWeight: "700" },
  ownerRowSubtitle: { color: colors.muted, fontSize: 11, lineHeight: 16, marginTop: 3 },
  ownerPanel: { padding: 15, gap: 13 },
  tenantPublicShare: { gap: 12, borderWidth: 1, borderColor: "#DDE9DF", borderRadius: 18, backgroundColor: "#F7FAF7", padding: 15, marginBottom: 2 },
  tenantPublicHeader: { flexDirection: "row", alignItems: "flex-start", gap: 11 },
  tenantPublicIcon: { width: 40, height: 40, borderRadius: 13, alignItems: "center", justifyContent: "center", backgroundColor: "#E8F2E9" },
  tenantPublicStatus: { alignSelf: "flex-start", minHeight: 27, flexDirection: "row", alignItems: "center", gap: 7, borderWidth: 1, borderColor: colors.line, borderRadius: 99, paddingHorizontal: 10, backgroundColor: colors.surface },
  tenantPublicStatusActive: { borderColor: "#C9DFCD", backgroundColor: "#EEF7EF" },
  tenantPublicStatusDot: { width: 7, height: 7, borderRadius: 99, backgroundColor: colors.muted },
  tenantPublicStatusDotActive: { backgroundColor: "#34804B" },
  tenantPublicStatusText: { color: colors.muted, fontSize: 10, fontWeight: "700" },
  tenantPublicStatusTextActive: { color: "#28653B" },
  tenantPublicPrivacy: { color: "#6F5C35", fontSize: 10, lineHeight: 15, padding: 10, borderRadius: 11, backgroundColor: "#FFF7E8" },
  tenantPublicUrlBox: { gap: 6, padding: 11, borderWidth: 1, borderColor: colors.line, borderRadius: 12, backgroundColor: colors.surface },
  tenantPublicUrlLabel: { color: colors.muted, fontSize: 9, fontWeight: "800", letterSpacing: 0.8 },
  tenantPublicUrl: { color: colors.forest, fontSize: 12, lineHeight: 18, overflow: "hidden" },
  tenantPublicActions: { flexDirection: "row", gap: 9 },
  tenantPublicAction: { flex: 1, minWidth: 0, minHeight: 44, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, borderWidth: 1, borderColor: colors.line, borderRadius: 12, paddingHorizontal: 8, backgroundColor: colors.surface },
  tenantPublicActionPrimary: { borderColor: colors.forest, backgroundColor: colors.forest },
  tenantPublicActionText: { color: colors.forest, fontSize: 11, fontWeight: "700" },
  tenantPublicActionTextPrimary: { color: colors.white },
  tenantPublicRegenerate: { alignSelf: "center", minHeight: 32, alignItems: "center", justifyContent: "center", paddingHorizontal: 10 },
  tenantPublicRegenerateText: { color: colors.muted, fontSize: 10, fontWeight: "700" },
  ownerHint: { color: colors.muted, fontSize: 11, lineHeight: 16 },
  tenantAssetMergeRow: { minHeight: 78, flexDirection: "row", alignItems: "center", gap: 10, padding: 12, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: 13 },
  tenantAssetMergeCheckbox: { width: 25, height: 25, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.line, borderRadius: 7, backgroundColor: colors.surface },
  tenantAssetMergeCheckboxSelected: { backgroundColor: colors.forest, borderColor: colors.forest },
  tenantAssetMergeDetails: { flex: 1, minWidth: 0 },
  tenantAssetSplitButton: { minHeight: 36, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.line, borderRadius: 9, paddingHorizontal: 10, backgroundColor: colors.surface },
  tenantAssetSplitText: { color: colors.forest, fontSize: 10, fontWeight: "700" },
  ownerTermNumber: { color: colors.forest, fontSize: 12, fontWeight: "800" },
  ownerTermGroup: { gap: 5, borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 11 },
  ownerTermGroupTitle: { color: colors.ink, fontSize: 12, fontWeight: "700", marginBottom: 4 },
  ownerTermAsset: { minHeight: 40, flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 5 },
  ownerTermCheck: { width: 23, height: 23, borderWidth: 1, borderColor: colors.line, borderRadius: 7, alignItems: "center", justifyContent: "center" },
  ownerTermCheckSelected: { backgroundColor: colors.forest, borderColor: colors.forest },
  ownerTermMappedCount: { color: colors.muted, fontSize: 10, marginTop: 4 },
  ownerTermImportantToggle: { minHeight: 36, flexDirection: "row", alignItems: "center", gap: 9 },
  ownerImportantObligationBadge: { alignSelf: "flex-start", color: "#805B13", backgroundColor: "#FFF3D6", fontSize: 9, fontWeight: "700", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 99, overflow: "hidden" },
  ownerLinkedRow: {
    minHeight: 58,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 13,
  },
  ownerDetailTabs: { gap: 5, paddingVertical: 3 },
  ownerDetailTab: { minHeight: 38, justifyContent: "center", paddingHorizontal: 13, borderRadius: 11, backgroundColor: "#E9EDE7" },
  ownerDetailTabSelected: { backgroundColor: colors.forest },
  ownerDetailTabText: { color: colors.muted, fontSize: 11, fontWeight: "700" },
  ownerDetailTabTextSelected: { color: colors.white },
  agreementDetailHeading: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 8 },
  downloadNotice: { width: "100%", color: colors.forest, fontSize: 11, lineHeight: 16 },
  approvalQueueRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 9,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 14,
  },
  approvalQueueRecord: { flex: 1, minHeight: 54, flexDirection: "row", alignItems: "center", gap: 10 },
  drawerRoot: { flex: 1, flexDirection: "row" },
  drawerShade: { ...StyleSheet.absoluteFill, backgroundColor: "rgba(12,27,20,0.48)" },
  drawer: {
    width: "82%",
    maxWidth: 330,
    paddingHorizontal: 16,
    paddingTop: Platform.OS === "android" ? (StatusBar.currentHeight ?? 0) + 8 : 16,
    paddingBottom: 16,
    backgroundColor: colors.surface,
  },
  drawerBrand: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 18, borderBottomWidth: 1, borderBottomColor: colors.line },
  drawerLinks: { flex: 1, paddingTop: 13, gap: 4 },
  drawerLink: { minHeight: 46, flexDirection: "row", alignItems: "center", gap: 11, paddingHorizontal: 11, borderRadius: 12 },
  drawerLinkSelected: { backgroundColor: colors.mint },
  drawerLinkText: { flex: 1, color: colors.ink, fontSize: 13, fontWeight: "600" },
  drawerLinkTextSelected: { color: colors.forest, fontWeight: "700" },
  drawerCount: { color: colors.muted, fontSize: 11, fontWeight: "600" },
  drawerFooter: { borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 9, gap: 2 },
  drawerFooterAction: { minHeight: 43, flexDirection: "row", alignItems: "center", gap: 11, paddingHorizontal: 11 },
  drawerFooterText: { color: colors.ink, fontSize: 12, fontWeight: "600" },
  inlineHeading: { flexDirection: "row", alignItems: "center", gap: 10 },
  flexOne: { flex: 1 },
  cardTitle: { color: colors.ink, fontSize: 13, fontWeight: "700" },
  mutedSmall: { color: colors.muted, fontSize: 11, lineHeight: 16 },
  highlightIcon: { width: 36, height: 36, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: colors.mint },
  propertyIcon: { width: 37, height: 37, borderRadius: 12, backgroundColor: colors.mint, alignItems: "center", justifyContent: "center" },
  countPill: { color: colors.forest, backgroundColor: colors.mint, borderRadius: 99, paddingHorizontal: 8, paddingVertical: 5, fontSize: 10, fontWeight: "700", overflow: "hidden" },
  unitHint: { color: colors.muted, fontSize: 10, marginTop: 4 },
  unitRow: { flexDirection: "row", alignItems: "center", gap: 7, paddingTop: 10, marginTop: 9, borderTopWidth: 1, borderColor: colors.line, flexWrap: "wrap" },
  unitName: { flex: 1, color: colors.ink, fontSize: 11, fontWeight: "600" },
  unitRent: { color: colors.forest, fontSize: 11, fontWeight: "700" },
  unitTenant: { width: "100%", paddingLeft: 21, color: colors.muted, fontSize: 10 },
  personRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  avatar: { width: 38, height: 38, borderRadius: 14, backgroundColor: colors.mint, alignItems: "center", justifyContent: "center" },
  accountPanel: { gap: 12 },
  agreementPanel: { gap: 11 },
  agreementHeading: { flexDirection: "row", alignItems: "flex-start", gap: 9 },
  agreementIcon: { width: 34, height: 34, borderRadius: 12, backgroundColor: colors.mint, alignItems: "center", justifyContent: "center" },
  statePill: { borderRadius: 99, paddingHorizontal: 8, paddingVertical: 5 },
  statePillPositive: { backgroundColor: colors.mint },
  statePillPending: { backgroundColor: "#F8F0E1" },
  stateText: { fontSize: 9, fontWeight: "700" },
  stateTextPositive: { color: colors.forest },
  stateTextPending: { color: "#8F6A32" },
  agreementFacts: { flexDirection: "row", gap: 24 },
  fact: { gap: 3 },
  factLabel: { color: colors.muted, fontSize: 10 },
  factValue: { color: colors.ink, fontSize: 12, fontWeight: "700" },
  approvalLine: { flexDirection: "row", alignItems: "center", gap: 7 },
  approvalText: { color: colors.muted, fontSize: 10 },
  reviewCallout: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "#F1F6F1", borderColor: "#D7E5D8" },
  tenantHomeCard: { padding: 19, gap: 16, backgroundColor: colors.forestDark, borderColor: colors.forestDark },
  tenantHomeTop: { flexDirection: "row", gap: 11, alignItems: "center" },
  tenantHomeTitle: { color: colors.white, fontSize: 18, fontWeight: "700", marginTop: 3 },
  tenantLeaseRow: { flexDirection: "row", justifyContent: "space-between" },
  tenantLeaseRight: { alignItems: "flex-end" },
  tenantRent: { color: colors.white, fontSize: 15, fontWeight: "700", marginTop: 4 },
  reviewInfo: {
    backgroundColor: colors.surface,
    padding: 21,
    gap: 18,
    borderColor: "#DDE7DE",
    shadowColor: colors.forestDark,
    shadowOpacity: 0.06,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 7 },
    elevation: 2,
  },
  reviewSavedProfileNote: { color: colors.muted, fontSize: 12, lineHeight: 17 },
  reviewFactsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 11,
  },
  reviewPage: { flex: 1, backgroundColor: colors.background },
  reviewHeader: {
    minHeight: 62,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    gap: 10,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  reviewHeaderTitle: { color: colors.ink, fontSize: 15, fontWeight: "700" },
  reviewLogoutButton: {
    minHeight: 40,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingHorizontal: 9,
    borderRadius: 12,
    backgroundColor: "#F1F6F1",
  },
  reviewLogoutText: { color: colors.forest, fontSize: 12, fontWeight: "700" },
  reviewProgress: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 8,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  reviewProgressButton: {
    flex: 1,
    minWidth: 0,
    minHeight: 40,
    justifyContent: "center",
  },
  reviewProgressSegment: {
    flex: 1,
    minWidth: 0,
    minHeight: 34,
    borderRadius: 99,
    backgroundColor: "#DDE4DD",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 2,
  },
  reviewProgressComplete: { backgroundColor: colors.leaf },
  reviewProgressCurrent: { backgroundColor: colors.forest },
  reviewProgressLabel: { color: "#52665A", fontSize: 8, fontWeight: "800", letterSpacing: -0.2 },
  reviewProgressLabelComplete: { color: colors.white },
  reviewProgressLabelCurrent: { color: colors.white },
  reviewScroll: { flex: 1 },
  reviewContent: { padding: 18, paddingTop: 18, paddingBottom: 26, gap: 14 },
  reviewEyebrow: { color: colors.leaf, fontSize: 12, fontWeight: "800", letterSpacing: 1 },
  reviewStepTitle: { color: colors.ink, fontSize: 24, fontWeight: "800", letterSpacing: -0.4 },
  reviewFact: {
    width: "47%",
    minHeight: 88,
    gap: 8,
    padding: 15,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: "#E5ECE5",
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
  },
  reviewFactLabel: { color: colors.leaf, fontSize: 12, fontWeight: "700" },
  reviewFactValue: { color: colors.ink, fontSize: 17, fontWeight: "800", lineHeight: 23 },
  reviewCardEyebrow: { color: colors.leaf, fontSize: 11, fontWeight: "800", letterSpacing: 1.2 },
  reviewDepositSummary: {
    gap: 6,
    padding: 18,
    borderRadius: 18,
    backgroundColor: colors.forest,
  },
  reviewDepositLabel: { color: "#D6E6DA", fontSize: 12, fontWeight: "700" },
  reviewDepositValue: { color: colors.white, fontSize: 27, fontWeight: "800", letterSpacing: -0.5 },
  reviewDepositHint: { color: "#D6E6DA", fontSize: 12, lineHeight: 18 },
  reviewRentPeriod: {
    flexDirection: "row",
    gap: 12,
    marginTop: 8,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.22)",
  },
  reviewRentDate: { flex: 1, gap: 5 },
  reviewRentDateLabel: { color: "#D6E6DA", fontSize: 10, fontWeight: "800", letterSpacing: 0.7 },
  reviewRentDateValue: { color: colors.white, fontSize: 14, fontWeight: "800", lineHeight: 20 },
  reviewFieldLabel: { color: colors.ink, fontSize: 15, fontWeight: "700" },
  reviewFieldInput: { fontSize: 19, minHeight: 60, fontWeight: "600" },
  reviewCharacterCount: { color: colors.muted, fontSize: 13 },
  reviewSummaryText: { color: colors.ink, fontSize: 15, lineHeight: 23 },
  reviewFooter: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: Platform.OS === "android" ? 30 : 14,
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    backgroundColor: colors.surface,
  },
  reviewActionButton: { flexGrow: 1, flexBasis: 128, minWidth: 128 },
  yearFolder: { minHeight: 92, flexDirection: "row", alignItems: "center", gap: 12, padding: 16, borderRadius: 18, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface },
  yearFolderIcon: { width: 44, height: 44, alignItems: "center", justifyContent: "center", borderRadius: 14, backgroundColor: colors.mint },
  yearFolderLabel: { color: colors.muted, fontSize: 9, fontWeight: "700", letterSpacing: 1 },
  yearFolderTitle: { color: colors.forest, fontSize: 22, fontWeight: "800", marginTop: 3 },
  yearFolderCount: { color: colors.forest, fontSize: 10, fontWeight: "700" },
  createPage: { flex: 1, backgroundColor: colors.background },
  createHeader: {
    minHeight: 56,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    backgroundColor: colors.surface,
  },
  createTitle: { flex: 1, color: colors.ink, fontSize: 16, fontWeight: "700" },
  createScroll: { flex: 1 },
  createFields: { padding: 16, paddingBottom: 28, gap: 15 },
  modalRoot: { flex: 1, justifyContent: "flex-end" },
  modalShade: { ...StyleSheet.absoluteFill, backgroundColor: "rgba(12,27,20,0.44)" },
  sheet: { maxHeight: "92%", backgroundColor: colors.background, borderTopLeftRadius: 25, borderTopRightRadius: 25, paddingHorizontal: 18, paddingTop: 10, paddingBottom: 25, gap: 14 },
  sheetHandle: { alignSelf: "center", width: 38, height: 4, borderRadius: 99, backgroundColor: "#CDD5CD" },
  sheetHeading: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  sheetTitle: { color: colors.ink, fontSize: 18, fontWeight: "800" },
  closeButton: { width: 34, height: 34, borderRadius: 12, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" },
  sheetFields: { gap: 14, paddingBottom: 6 },
  formRow: { flexDirection: "row", gap: 9 },
  halfField: { flex: 1 },
  formHint: { color: colors.muted, fontSize: 11, lineHeight: 16 },
  fieldLabel: { color: colors.ink, fontSize: 12, fontWeight: "600" },
  selectField: { gap: 8 },
  choiceList: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
  reviewActions: { flexDirection: "row", gap: 9 },
  multilineField: { minHeight: 140 },
  contactPickerButton: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
    borderWidth: 1,
    borderColor: "#C9D9CD",
    borderRadius: 12,
    backgroundColor: "#F1F6F1",
  },
  contactPickerButtonDisabled: { opacity: 0.65 },
  contactPickerText: { color: colors.forest, fontSize: 14, fontWeight: "700" },
  pressed: { opacity: 0.8 },
});
