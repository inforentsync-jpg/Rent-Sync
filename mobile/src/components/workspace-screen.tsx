import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  ArrowDownRight,
  ArrowRight,
  Building2,
  Check,
  ChevronRight,
  CircleUserRound,
  Clock3,
  DoorOpen,
  FileCheck2,
  KeyRound,
  LogOut,
  Plus,
  Pencil,
  ShieldCheck,
  Share2,
  UsersRound,
  Trash2,
  X,
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
  createPortfolioItem,
  deletePortfolioItem,
  getAdminAccounts,
  getOwnerPortfolio,
  getTenantAgreements,
  resetAccountPassword,
  shareAgreementPdf,
  updateOwnerProfile,
  updatePortfolioItem,
} from "@/lib/api";
import { clearSession, type MobileSession } from "@/lib/session";
import { colors } from "@/theme";

const deleteGuidance: Record<string, string> = {
  agreement: "This permanently removes the agreement and its history, including approval records. Its tenant and property stay. Its agreement year will not be generated again.",
  tenant: "Tenants with agreements cannot be deleted. Delete their agreements first only if you intend to permanently remove that history.",
  asset: "Units with agreements or assigned tenants cannot be deleted. Delete their agreements only if you intend to permanently remove that history.",
  building: "Delete this property's units first.",
  company: "Move or delete this company's properties first.",
};

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
  importantTerms?: string;
  status: string;
  ownerApprovedAt?: string | null;
  tenantApprovedAt?: string | null;
  agreementYear?: number;
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
};
type Asset = {
  id: string;
  buildingId?: string;
  name: string;
  assetType: string;
  unitNumber: string;
  monthlyRent: number;
  securityDeposit: number;
  tenantIds?: string[];
  buildingName?: string;
  buildingAddress?: string;
  city?: string;
  state?: string;
};
type Tenant = {
  id: string;
  fullName: string;
  mobileNumber?: string | null;
  assetIds?: string[];
};
type Portfolio = {
  owner: { id: string; fullName: string; mobileNumber: string; email?: string | null };
  companies: Company[];
  buildings: Building[];
  assets: Asset[];
  tenants: Tenant[];
  agreements: Agreement[];
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
  passwordConfigured: boolean;
};

type ReviewValues = {
  startDate: string;
  endDate: string;
  monthlyRent: string;
  securityDeposit: string;
  terms: string;
  importantTerms: string;
};

type CreateKind = "company" | "building" | "asset" | "tenant" | "agreement";
type AdminType = "OWNER" | "TENANT";
type EditableItem =
 | { kind: "company"; item: Company }
 | { kind: "building"; item: Building }
 | { kind: "asset"; item: Asset }
 | { kind: "tenant"; item: Tenant }
 | { kind: "agreement"; item: Agreement };

function dateOnly(value?: string | null) {
  if (!value) return "";
  return value.slice(0, 10);
}

function localToday() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
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

function titleCase(value: string) {
  return value.toLowerCase().replace(/(^|\s)\S/g, (match) => match.toUpperCase());
}

function getAgreementState(agreement: Agreement) {
  if (agreement.status === "ACTIVE") return "Active";
  if (agreement.ownerApprovedAt && agreement.tenantApprovedAt) return "Approved";
  if (agreement.ownerApprovedAt || agreement.tenantApprovedAt) return "Awaiting approval";
  return "Draft";
}

function ownerNeedsReview(agreement: Agreement) {
  return agreement.status !== "ACTIVE" && !agreement.ownerApprovedAt;
}

function tenantNeedsReview(agreement: Agreement) {
  return agreement.status !== "ACTIVE" && !agreement.tenantApprovedAt;
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
  const [editingItem, setEditingItem] = useState<EditableItem | null>(null);
  const [reviewing, setReviewing] = useState<Agreement | null>(null);
  const [resetAccount, setResetAccount] = useState<{ account: Account; type: AdminType } | null>(null);

  const loadData = useCallback(async () => {
    try {
      if (session.role === "OWNER") {
        const [nextPortfolio, nextProfile] = await Promise.all([
          getOwnerPortfolio<Portfolio>(session),
          authenticatedRequest<{ profile: Profile }>(session, "/api/owner/profile"),
        ]);
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

  async function removePortfolioItem(kind: string, id: string, label: string) {
    const remove = async () => {
      try {
        await deletePortfolioItem(session, kind, id);
        refresh();
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : `Unable to delete ${label}.`);
      }
    };
    const guidance = deleteGuidance[kind] ?? "Dependent records must be deleted first.";
    if (Platform.OS === "web") {
      if (globalThis.confirm(`Delete ${label}?\n\n${guidance}\n\nThis action cannot be undone.`)) await remove();
      return;
    }
    Alert.alert(`Delete ${label}?`, `${guidance}\n\nThis action cannot be undone.`, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => void remove() },
    ]);
  }

  const sections =
    session.role === "SUPER_ADMIN"
      ? ["Owners", "Tenants"]
      : session.role === "TENANT"
        ? ["Home", "Agreements"]
        : ["Home", "Agreements", "People", "Profile"];

  return (
    <View style={styles.screen}>
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
        {session.role !== "OWNER" ? (
          <Pressable accessibilityRole="button" accessibilityLabel="Sign out" onPress={() => void signOut()} style={styles.signOut}>
            <LogOut size={17} color={colors.forest} />
          </Pressable>
        ) : null}
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
        {sections.map((item) => (
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
        <View style={styles.loading}>
          <ActivityIndicator color={colors.forest} size="large" />
          <Text style={styles.loadingText}>Opening your workspace</Text>
        </View>
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
          {session.role === "OWNER" && portfolio ? (
            <OwnerWorkspace
              section={section}
              portfolio={portfolio}
              profile={profile}
              session={session}
              onCreate={setCreateKind}
              onEdit={setEditingItem}
              onDelete={removePortfolioItem}
              onReview={setReviewing}
              onProfileSaved={loadData}
              onSignOut={() => void signOut()}
            />
          ) : null}
          {session.role === "OWNER" && !portfolio && error ? (
            <EmptyState title="Portfolio unavailable" text="Check the server address and connection, then pull down to retry." />
          ) : null}
          {session.role === "TENANT" && tenantPortal ? (
            <TenantWorkspace
              section={section}
              portal={tenantPortal}
              onReview={setReviewing}
            />
          ) : null}
          {session.role === "TENANT" && !tenantPortal && error ? (
            <EmptyState title="Workspace unavailable" text="Check the server address and connection, then pull down to retry." />
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

      <CreateSheet
        key={editingItem ? `edit-${editingItem.kind}-${editingItem.item.id}` : createKind ?? "create-closed"}
        kind={editingItem?.kind ?? createKind}
        item={editingItem}
        portfolio={portfolio}
        session={session}
        onClose={() => {
          setCreateKind(null);
          setEditingItem(null);
        }}
        onCreated={() => {
          setCreateKind(null);
          setEditingItem(null);
          refresh();
        }}
      />
      <ReviewSheet
        key={reviewing?.id ?? "review-closed"}
        agreement={reviewing}
        session={session}
        portal={tenantPortal}
        portfolio={portfolio}
        onClose={() => setReviewing(null)}
        onApproved={() => {
          setReviewing(null);
          refresh();
        }}
      />
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

function OwnerWorkspace({
  section,
  portfolio,
  profile,
  session,
  onCreate,
  onEdit,
  onDelete,
  onReview,
  onProfileSaved,
  onSignOut,
}: {
  section: string;
  portfolio: Portfolio;
  profile: Profile | null;
  session: MobileSession;
  onCreate: (kind: CreateKind) => void;
  onEdit: (selection: EditableItem) => void;
  onDelete: (kind: string, id: string, label: string) => void;
  onReview: (agreement: Agreement) => void;
  onProfileSaved: () => Promise<void>;
  onSignOut: () => void;
}) {
  const assetById = useMemo(
    () => new Map(portfolio.assets.map((asset) => [asset.id, asset])),
    [portfolio.assets],
  );
  const tenantById = useMemo(
    () => new Map(portfolio.tenants.map((tenant) => [tenant.id, tenant])),
    [portfolio.tenants],
  );
  const pending = portfolio.agreements.filter(ownerNeedsReview);

  if (section === "Agreements") {
    return (
      <>
        <Heading
          title="Agreements"
          subtitle={`${portfolio.agreements.length} rental ${portfolio.agreements.length === 1 ? "agreement" : "agreements"}`}
        />
        {pending.length ? (
          <Panel style={styles.highlightPanel}>
            <View style={styles.inlineHeading}>
              <View style={styles.highlightIcon}><FileCheck2 size={18} color={colors.forest} /></View>
              <View style={styles.flexOne}>
                <Text style={styles.cardTitle}>{pending.length} need your review</Text>
                <Text style={styles.mutedSmall}>Check the agreement before approving.</Text>
              </View>
            </View>
          </Panel>
        ) : null}
        {portfolio.agreements.length ? portfolio.agreements.map((agreement) => (
          <AgreementCard
            key={agreement.id}
            agreement={agreement}
            asset={assetById.get(agreement.assetId ?? "")}
            tenant={tenantById.get(agreement.tenantId ?? "")}
            role="OWNER"
            session={session}
            onReview={() => onReview(agreement)}
            onDelete={() => onDelete("agreement", agreement.id, "this agreement")}
            onEdit={
                agreement.status === "DRAFT" && !agreement.ownerApprovedAt && !agreement.tenantApprovedAt
                  ? () => onEdit({ kind: "agreement", item: agreement })
                  : undefined
            }
          />
        )) : <EmptyState title="No agreements yet" text="Add a tenant to prepare the first agreement." />}
      </>
    );
  }

  if (section === "People") {
    return (
      <>
        <Heading
          title="People"
          subtitle={`${portfolio.tenants.length} ${portfolio.tenants.length === 1 ? "tenant" : "tenants"} in your properties`}
          right={<IconButton label="Add tenant" onPress={() => onCreate("tenant")} />}
        />
        {portfolio.tenants.length ? portfolio.tenants.map((tenant) => {
          const assignedAssets = (tenant.assetIds ?? [])
            .map((id) => assetById.get(id))
            .filter((asset): asset is Asset => Boolean(asset));
          return (
            <Panel key={tenant.id}>
              <View style={styles.personRow}>
                <View style={styles.avatar}><CircleUserRound size={19} color={colors.forest} /></View>
                <View style={styles.flexOne}>
                  <Text style={styles.cardTitle}>{tenant.fullName}</Text>
                  <Text style={styles.mutedSmall}>{tenant.mobileNumber || "Mobile number not added"}</Text>
                  {assignedAssets.length ? (
                    <Text style={styles.unitHint}>
                      {assignedAssets.map((asset) => `${asset.name} · ${asset.unitNumber}`).join(", ")}
                    </Text>
                  ) : null}
                </View>
              </View>
              <View style={styles.recordActions}>
                <RecordAction label="Edit tenant" icon={<Pencil size={14} color={colors.forest} />} onPress={() => onEdit({ kind: "tenant", item: tenant })} />
                <RecordAction label="Delete tenant" danger icon={<Trash2 size={14} color={colors.danger} />} onPress={() => onDelete("tenant", tenant.id, tenant.fullName)} />
              </View>
            </Panel>
          );
        }) : <EmptyState title="No tenants yet" text="Add a tenant to connect them with a home and agreement." />}
      </>
    );
  }

  if (section === "Profile") {
    return (
      <>
        <Heading title="Your profile" subtitle="Account details and contact information" />
        <ProfilePanel
          key={profile?.id ?? "profile-loading"}
          session={session}
          profile={profile}
          onSaved={onProfileSaved}
          onSignOut={onSignOut}
        />
        <Panel>
          <Text style={styles.cardTitle}>Sign-in number</Text>
          <Text style={styles.mutedSmall}>{profile?.mobileNumber ?? session.mobileNumber}</Text>
        </Panel>
      </>
    );
  }

  return (
    <>
      <Heading title={`Hello, ${portfolio.owner.fullName.split(" ")[0]}`} subtitle="Your property workspace" />
      <View style={styles.metricGrid}>
        <Metric label="Properties" value={portfolio.buildings.length} icon={<Building2 size={17} color={colors.forest} />} />
        <Metric label="Units" value={portfolio.assets.length} icon={<DoorOpen size={17} color={colors.forest} />} />
        <Metric label="Tenants" value={portfolio.tenants.length} icon={<UsersRound size={17} color={colors.forest} />} />
        <Metric label="To review" value={pending.length} icon={<FileCheck2 size={17} color={colors.forest} />} />
      </View>
      <Panel style={styles.actionPanel}>
        <View style={styles.actionPanelHeading}>
          <View>
            <Text style={styles.cardTitle}>Manage portfolio</Text>
            <Text style={styles.mutedSmall}>Add properties, homes and people.</Text>
          </View>
          <ArrowDownRight size={18} color={colors.forest} />
        </View>
        <View style={styles.actionGrid}>
          <QuickAction label="Company" onPress={() => onCreate("company")} />
          <QuickAction label="Property" onPress={() => onCreate("building")} />
          <QuickAction label="Unit" onPress={() => onCreate("asset")} />
          <QuickAction label="Tenant" onPress={() => onCreate("tenant")} />
          <QuickAction label="Agreement" onPress={() => onCreate("agreement")} />
        </View>
      </Panel>
      {portfolio.companies.length ? (
        <>
          <Heading title="Companies" subtitle={`${portfolio.companies.length} total`} />
          {portfolio.companies.map((company) => (
            <Panel key={company.id}>
              <View style={styles.inlineHeading}>
                <View style={styles.propertyIcon}><Building2 size={17} color={colors.forest} /></View>
                <Text style={[styles.cardTitle, styles.flexOne]}>{company.name}</Text>
              </View>
              <View style={styles.recordActions}>
                <RecordAction label="Edit company" icon={<Pencil size={14} color={colors.forest} />} onPress={() => onEdit({ kind: "company", item: company })} />
                <RecordAction label="Delete company" danger icon={<Trash2 size={14} color={colors.danger} />} onPress={() => onDelete("company", company.id, company.name)} />
              </View>
            </Panel>
          ))}
        </>
      ) : null}
      <Heading title="Your properties" subtitle={`${portfolio.buildings.length} total`} />
      {portfolio.buildings.length ? portfolio.buildings.map((building) => {
        const company = portfolio.companies.find((item) => item.id === building.companyId);
        const units = portfolio.assets.filter((asset) => asset.buildingId === building.id);
        return (
          <Panel key={building.id}>
            <View style={styles.inlineHeading}>
              <View style={styles.propertyIcon}><Building2 size={18} color={colors.forest} /></View>
              <View style={styles.flexOne}>
                <Text style={styles.cardTitle}>{building.name}</Text>
                <Text style={styles.mutedSmall}>{[building.city, building.state].filter(Boolean).join(", ")}</Text>
              </View>
              {units.length ? <Text style={styles.countPill}>{units.length} units</Text> : null}
            </View>
            {company ? <Text style={styles.unitHint}>{company.name}</Text> : null}
            <View style={styles.recordActions}>
              <RecordAction label="Edit property" icon={<Pencil size={14} color={colors.forest} />} onPress={() => onEdit({ kind: "building", item: building })} />
              <RecordAction label="Delete property" danger icon={<Trash2 size={14} color={colors.danger} />} onPress={() => onDelete("building", building.id, building.name)} />
            </View>
            {units.map((asset) => {
              const currentTenant = (asset.tenantIds ?? []).map((id) => tenantById.get(id)).find(Boolean);
              return (
                <View key={asset.id} style={styles.unitBlock}>
                  <View style={styles.unitRow}>
                    <DoorOpen size={14} color={colors.leaf} />
                    <Text style={styles.unitName}>{asset.name} · {asset.unitNumber}</Text>
                    <Text style={styles.unitRent}>{money(asset.monthlyRent)}</Text>
                    {currentTenant ? <Text style={styles.unitTenant}>{currentTenant.fullName}</Text> : null}
                  </View>
                  <View style={styles.recordActions}>
                    <RecordAction label="Edit unit" icon={<Pencil size={14} color={colors.forest} />} onPress={() => onEdit({ kind: "asset", item: asset })} />
                    <RecordAction label="Delete unit" danger icon={<Trash2 size={14} color={colors.danger} />} onPress={() => onDelete("asset", asset.id, asset.name)} />
                  </View>
                </View>
              );
            })}
          </Panel>
        );
      }) : (
        <Panel><EmptyState title="Your portfolio starts here" text="Create a company, then add a property and its units." /></Panel>
      )}
      {portfolio.agreements.filter(ownerNeedsReview).length ? (
        <>
          <Heading title="Needs your attention" subtitle="Agreements waiting for your approval" />
          {portfolio.agreements.filter(ownerNeedsReview).slice(0, 3).map((agreement) => (
            <AgreementCard
              key={agreement.id}
              agreement={agreement}
              asset={assetById.get(agreement.assetId ?? "")}
              tenant={tenantById.get(agreement.tenantId ?? "")}
              role="OWNER"
              session={session}
              onReview={() => onReview(agreement)}
            />
          ))}
        </>
      ) : null}
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
  const assetById = useMemo(
    () => new Map(portal.assets.map((asset) => [asset.id, asset])),
    [portal.assets],
  );
  const pending = portal.agreements.filter(tenantNeedsReview);

  if (section === "Agreements") {
    return (
      <>
        <Heading title="My agreements" subtitle={`${portal.agreements.length} records`} />
        {portal.agreements.length ? portal.agreements.map((agreement) => (
          <AgreementCard
            key={agreement.id}
            agreement={agreement}
            asset={assetById.get(agreement.assetId ?? "")}
            role="TENANT"
            onReview={() => onReview(agreement)}
          />
        )) : <EmptyState title="No agreements yet" text="Your rental agreements will appear here when your property owner adds you." />}
      </>
    );
  }

  const currentAgreement = portal.agreements.find((agreement) => agreement.status === "ACTIVE")
    ?? portal.agreements[0];
  const currentAsset = currentAgreement ? assetById.get(currentAgreement.assetId ?? "") : portal.assets[0];

  return (
    <>
      <Heading title={`Welcome, ${portal.tenant.fullName.split(" ")[0]}`} subtitle="Your rental home" />
      {pending.length ? (
        <Pressable onPress={() => onReview(pending[0])}>
          <Panel style={styles.reviewCallout}>
            <View style={styles.highlightIcon}><FileCheck2 size={18} color={colors.forest} /></View>
            <View style={styles.flexOne}>
              <Text style={styles.cardTitle}>Agreement needs your approval</Text>
              <Text style={styles.mutedSmall}>Review the details before confirming.</Text>
            </View>
            <ChevronRight size={18} color={colors.forest} />
          </Panel>
        </Pressable>
      ) : null}
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
      <Heading title="Agreement status" subtitle="Approval is recorded for both parties" />
      {portal.agreements.length ? portal.agreements.slice(0, 3).map((agreement) => (
        <AgreementCard
          key={agreement.id}
          agreement={agreement}
          asset={assetById.get(agreement.assetId ?? "")}
          role="TENANT"
          onReview={() => onReview(agreement)}
        />
      )) : null}
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
        <Panel><EmptyState title="Accounts unavailable" text="Check the server address and pull down to retry." /></Panel>
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

function Metric({
  label,
  value,
  icon,
}: {
  label: string;
  value: number;
  icon: ReactNode;
}) {
  return (
    <Panel style={styles.metricCard}>
      <View style={styles.metricTop}>
        <Text style={styles.metricValue}>{value}</Text>
        <View style={styles.metricIcon}>{icon}</View>
      </View>
      <Text style={styles.metricLabel}>{label}</Text>
    </Panel>
  );
}

function QuickAction({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.quickAction, pressed && styles.pressed]}>
      <View style={styles.quickIcon}><Plus size={15} color={colors.forest} /></View>
      <Text style={styles.quickText}>{label}</Text>
    </Pressable>
  );
}

function IconButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={styles.iconButton}>
      <Plus size={17} color={colors.forest} />
    </Pressable>
  );
}

function RecordAction({
  label,
  icon,
  onPress,
  danger = false,
}: {
  label: string;
  icon: ReactNode;
  onPress: () => void;
  danger?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.recordAction, danger && styles.recordActionDanger, pressed && styles.pressed]}
    >
      {icon}
      <Text style={[styles.recordActionText, danger && styles.recordActionTextDanger]}>{label}</Text>
    </Pressable>
  );
}

function AgreementCard({
  agreement,
  asset,
  tenant,
  role,
  session,
  onReview,
  onEdit,
  onDelete,
}: {
  agreement: Agreement;
  asset?: Asset;
  tenant?: Tenant;
  role: "OWNER" | "TENANT";
  session?: MobileSession;
  onReview: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}) {
  const [sharing, setSharing] = useState(false);
  const [shareError, setShareError] = useState("");
  const needsReview = role === "OWNER" ? ownerNeedsReview(agreement) : tenantNeedsReview(agreement);
  const state = getAgreementState(agreement);
  async function sharePdf() {
    if (!session) return;
    setSharing(true);
    setShareError("");
    try {
      await shareAgreementPdf(session, agreement.id, agreement.agreementNumber);
    } catch (cause) {
      setShareError(cause instanceof Error ? cause.message : "Unable to share the agreement PDF.");
    } finally {
      setSharing(false);
    }
  }
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
      <ApprovalLine role="Tenant" time={agreement.tenantApprovedAt} />
      {shareError ? <Notice message={shareError} /> : null}
      {needsReview ? (
        <ActionButton
          label="Review agreement"
          onPress={onReview}
          icon={<ArrowRight size={16} color={colors.white} />}
          compact
        />
      ) : null}
      {onEdit ? (
        <ActionButton
          label="Edit draft"
          variant="secondary"
          onPress={onEdit}
          icon={<Pencil size={14} color={colors.forest} />}
          compact
        />
      ) : null}
      {role === "OWNER" && session && Platform.OS !== "web" ? (
        <ActionButton
          label="Share PDF"
          variant="secondary"
          onPress={() => void sharePdf()}
          busy={sharing}
          icon={<Share2 size={15} color={colors.forest} />}
          compact
        />
      ) : null}
      {onDelete ? (
        <ActionButton
          label="Delete draft"
          variant="danger"
          onPress={onDelete}
          icon={<Trash2 size={14} color={colors.danger} />}
          compact
        />
      ) : null}
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
  onSignOut,
}: {
  session: MobileSession;
  profile: Profile | null;
  onSaved: () => Promise<void>;
  onSignOut: () => void;
}) {
  const [fullName, setFullName] = useState(profile?.fullName ?? "");
  const [email, setEmail] = useState(profile?.email ?? "");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [noticeTone, setNoticeTone] = useState<"error" | "success">("error");

  async function save() {
    setBusy(true);
    setNotice("");
    try {
      await updateOwnerProfile(session, { fullName, email });
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
      <Field label="Full name" value={fullName} onChangeText={setFullName} autoCapitalize="words" />
      <Field label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
      {notice ? <Notice message={notice} tone={noticeTone} /> : null}
      <ActionButton label="Save profile" onPress={() => void save()} busy={busy} />
      <Divider />
      <Text style={styles.cardTitle}>Account session</Text>
      <Text style={styles.mutedSmall}>Sign out of your Rent-Sync owner account on this device.</Text>
      <ActionButton
        label="Sign out"
        variant="danger"
        onPress={onSignOut}
        icon={<LogOut size={15} color={colors.danger} />}
      />
    </Panel>
  );
}

function initialEditFields(selection: EditableItem): Record<string, string> {
  switch (selection.kind) {
    case "company":
      return { name: selection.item.name };
    case "building":
      return {
        companyId: selection.item.companyId ?? "",
        name: selection.item.name,
        address: selection.item.address,
        city: selection.item.city,
        state: selection.item.state,
        postalCode: selection.item.postalCode,
      };
    case "asset":
      return {
        buildingId: selection.item.buildingId ?? "",
        name: selection.item.name,
        assetType: selection.item.assetType,
        unitNumber: selection.item.unitNumber,
        monthlyRent: String(selection.item.monthlyRent),
        securityDeposit: String(selection.item.securityDeposit),
      };
    case "tenant":
      return {
        fullName: selection.item.fullName,
        mobileNumber: selection.item.mobileNumber ?? "",
      };
    case "agreement":
      return {
        startDate: dateOnly(selection.item.startDate),
        endDate: dateOnly(selection.item.endDate),
        assetId: selection.item.assetId ?? "",
        tenantId: selection.item.tenantId ?? "",
        monthlyRent: String(selection.item.monthlyRent),
        securityDeposit: String(selection.item.securityDeposit),
        terms: selection.item.terms ?? "",
        importantTerms: selection.item.importantTerms ?? "",
      };
  }
}

function CreateSheet({
  kind,
  item,
  portfolio,
  session,
  onClose,
  onCreated,
}: {
  kind: CreateKind | null;
  item: EditableItem | null;
  portfolio: Portfolio | null;
  session: MobileSession;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [fields, setFields] = useState<Record<string, string>>(() =>
    item ? initialEditFields(item) : { startDate: localToday() },
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  function set(key: string, value: string) {
    setFields((current) => ({ ...current, [key]: value }));
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
        body = {
          kind,
          buildingId: fields.buildingId ?? "",
          name: fields.name ?? "",
          assetType: fields.assetType || "Residential",
          unitNumber: fields.unitNumber ?? "",
          monthlyRent: Number(fields.monthlyRent),
          securityDeposit: Number(fields.securityDeposit || 0),
        };
      } else if (kind === "agreement") {
        body = {
          kind,
          ...(item ? { id: item.item.id } : {}),
          assetId: fields.assetId ?? "",
          tenantId: fields.tenantId ?? "",
          startDate: fields.startDate ?? "",
          endDate: fields.endDate ?? "",
          monthlyRent: Number(fields.monthlyRent),
          securityDeposit: Number(fields.securityDeposit || 0),
          terms: fields.terms ?? "",
          importantTerms: fields.importantTerms ?? "",
        };
      } else if (item?.kind === "tenant") {
        const digits = (fields.mobileNumber ?? "").replace(/\D/g, "");
        body = {
          kind,
          id: item.item.id,
          fullName: fields.fullName ?? "",
          mobileNumber: digits.length === 10 ? `91${digits}` : digits,
        };
      } else {
        const digits = (fields.mobileNumber ?? "").replace(/\D/g, "");
        const mobile = digits.length === 10 ? `91${digits}` : digits;
        body = {
          kind,
          assetId: fields.assetId ?? "",
          fullName: fields.fullName ?? "",
          ...(mobile ? { mobileNumber: mobile } : {}),
          startDate: fields.startDate ?? "",
        };
      }
      if (item) {
        body.id = item.item.id;
        await updatePortfolioItem(session, body);
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

  const title =
    kind === "company" ? `${item ? "Edit" : "Add"} company` :
      kind === "building" ? `${item ? "Edit" : "Add"} property` :
        kind === "asset" ? `${item ? "Edit" : "Add"} unit` :
          kind === "tenant" ? `${item ? "Edit" : "Add"} tenant` :
            kind === "agreement" ? `${item ? "Edit" : "Add"} agreement` : "";
  const availableAssets = (portfolio?.assets ?? []).filter(
    (asset) => !portfolio?.tenants.some((tenant) => tenant.assetIds?.includes(asset.id)),
  );
  const agreementTenants = (portfolio?.tenants ?? []).filter(
    (tenant) => tenant.assetIds?.includes(fields.assetId ?? ""),
  );
  const agreementAssets = (portfolio?.assets ?? []).filter((asset) =>
    portfolio?.tenants.some((tenant) => tenant.assetIds?.includes(asset.id)),
  );

  return (
    <Modal visible={Boolean(kind)} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalRoot}>
        <Pressable accessibilityLabel="Close" style={styles.modalShade} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.sheetHandle} />
          <View style={styles.sheetHeading}>
            <View>
              <Text style={styles.sheetTitle}>{title}</Text>
              <Text style={styles.mutedSmall}>{item ? "Update portfolio details" : "Add details to your portfolio"}</Text>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={onClose} style={styles.closeButton}>
              <X size={19} color={colors.ink} />
            </Pressable>
          </View>
          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={styles.sheetFields}>
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
              </>
            ) : null}
            {kind === "tenant" ? (
              <>
                {!item ? <SelectField label="Rental unit" options={availableAssets.map((asset) => ({ id: asset.id, label: `${asset.name} · ${asset.unitNumber}` }))} value={fields.assetId ?? ""} onChange={(value) => set("assetId", value)} /> : null}
                <Field label="Tenant name" value={fields.fullName ?? ""} onChangeText={(value) => set("fullName", value)} autoCapitalize="words" />
                <Field label="Mobile number (optional)" value={fields.mobileNumber ?? ""} onChangeText={(value) => set("mobileNumber", value)} keyboardType="phone-pad" maxLength={15} />
                {!item ? <Field label="Agreement start date" value={fields.startDate ?? ""} onChangeText={(value) => set("startDate", value)} placeholder="YYYY-MM-DD" /> : null}
                {!item ? <Text style={styles.formHint}>An 11-month draft agreement will be created with this tenant.</Text> : null}
              </>
            ) : null}
            {kind === "agreement" ? (
              <>
                {!item ? (
                  <>
                    <SelectField label="Rental unit" options={agreementAssets.map((asset) => ({ id: asset.id, label: `${asset.name} · ${asset.unitNumber}` }))} value={fields.assetId ?? ""} onChange={(value) => {
                      set("assetId", value);
                      set("tenantId", "");
                    }} />
                    <SelectField label="Tenant" options={agreementTenants.map((tenant) => ({ id: tenant.id, label: tenant.fullName }))} value={fields.tenantId ?? ""} onChange={(value) => set("tenantId", value)} />
                  </>
                ) : (
                  <Text style={styles.formHint}>Only unapproved draft agreements can be edited.</Text>
                )}
                <Field label="Start date" value={fields.startDate ?? ""} onChangeText={(value) => set("startDate", value)} placeholder="YYYY-MM-DD" />
                <Field label="End date" value={fields.endDate ?? ""} onChangeText={(value) => set("endDate", value)} placeholder="YYYY-MM-DD" />
                <View style={styles.formRow}>
                  <Field label="Monthly rent (₹)" value={fields.monthlyRent ?? ""} onChangeText={(value) => set("monthlyRent", value.replace(/\D/g, ""))} keyboardType="number-pad" style={styles.halfField} />
                  <Field label="Deposit (₹)" value={fields.securityDeposit ?? ""} onChangeText={(value) => set("securityDeposit", value.replace(/\D/g, ""))} keyboardType="number-pad" style={styles.halfField} />
                </View>
                <Field label="Agreement terms" value={fields.terms ?? ""} onChangeText={(value) => set("terms", value)} multiline numberOfLines={4} maxLength={2000} style={styles.multilineField} />
                <Field label="Important terms" value={fields.importantTerms ?? ""} onChangeText={(value) => set("importantTerms", value)} multiline numberOfLines={4} maxLength={4000} style={styles.multilineField} />
              </>
            ) : null}
            {!item && kind && ((kind === "building" && !portfolio?.companies.length) || (kind === "asset" && !portfolio?.buildings.length) || (kind === "tenant" && !availableAssets.length)) ? (
              <Notice message={kind === "building" ? "Add a company before creating a property." : kind === "asset" ? "Add a property before creating a unit." : "All units are already assigned to tenants. Add an available unit first."} />
            ) : null}
            {error ? <Notice message={error} /> : null}
            {kind === "agreement" && !item && !agreementAssets.length ? (
              <Notice message="Assign a tenant to a unit before adding an agreement." />
            ) : null}
            <ActionButton label={item ? "Save changes" : title} onPress={() => void submit()} busy={busy} disabled={
              !item && (Boolean(kind === "building" && !portfolio?.companies.length) ||
              Boolean(kind === "asset" && !portfolio?.buildings.length) ||
              Boolean(kind === "tenant" && !availableAssets.length) ||
              Boolean(kind === "agreement" && !agreementAssets.length))
            } />
          </ScrollView>
        </View>
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
  options: Array<{ id: string; label: string }>;
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

function ReviewSheet({
  agreement,
  session,
  portal,
  portfolio,
  onClose,
  onApproved,
}: {
  agreement: Agreement | null;
  session: MobileSession;
  portal: TenantPortal | null;
  portfolio: Portfolio | null;
  onClose: () => void;
  onApproved: () => void;
}) {
  const [step, setStep] = useState(0);
  const [values, setValues] = useState<ReviewValues>(() => ({
    startDate: dateOnly(agreement?.startDate),
    endDate: dateOnly(agreement?.endDate),
    monthlyRent: agreement ? String(agreement.monthlyRent) : "",
    securityDeposit: agreement ? String(agreement.securityDeposit) : "",
    terms: agreement?.terms ?? "",
    importantTerms: agreement?.importantTerms ?? "",
  }));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const assetId = agreement?.assetId;
  const tenantId = agreement?.tenantId;
  const asset = agreement
    ? portfolio?.assets.find((item) => item.id === assetId)
      ?? portal?.assets.find((item) => item.id === assetId)
    : undefined;
  const tenant = agreement
    ? portfolio?.tenants.find((item) => item.id === tenantId)
      ?? portal?.tenant
    : undefined;
  const steps = ["KYC", "Rent", "Advance", "Terms", "Important", "Approve"];
  const roleLabel = session.role === "OWNER" ? "owner" : "tenant";

  function update(key: keyof ReviewValues, value: string) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  async function approve() {
    if (!agreement) return;
    setBusy(true);
    setError("");
    try {
      await approveAgreement(session, agreement.id, {
        startDate: values.startDate,
        endDate: values.endDate,
        monthlyRent: Number(values.monthlyRent),
        securityDeposit: Number(values.securityDeposit),
        terms: values.terms,
        importantTerms: values.importantTerms,
      });
      onApproved();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to approve this agreement.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal visible={Boolean(agreement)} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalRoot}>
        <Pressable accessibilityLabel="Close" style={styles.modalShade} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.sheetHandle} />
          <View style={styles.sheetHeading}>
            <View>
              <Text style={styles.sheetTitle}>Review agreement</Text>
              <Text style={styles.mutedSmall}>{agreement?.agreementNumber}</Text>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={onClose} style={styles.closeButton}>
              <X size={19} color={colors.ink} />
            </Pressable>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.reviewSteps}
          >
            {steps.map((label, index) => (
              <Pressable
                key={label}
                accessibilityRole="button"
                accessibilityState={{ selected: step === index }}
                onPress={() => setStep(index)}
                style={[styles.reviewStep, step === index && styles.reviewStepActive]}
              >
                <Text style={[styles.reviewStepText, step === index && styles.reviewStepTextActive]}>{label}</Text>
              </Pressable>
            ))}
          </ScrollView>
          <Text style={styles.stepCounter}>STEP {step + 1} OF {steps.length}</Text>
          <ScrollView
            style={styles.reviewContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.sheetFields}
          >
            {step === 0 ? (
              <Panel style={styles.reviewInfo}>
                <Text style={styles.cardTitle}>People and home</Text>
                <Fact label="Tenant" value={tenant?.fullName ?? "Tenant account"} />
                <Fact label="Mobile" value={tenant?.mobileNumber ?? "Not provided"} />
                <Fact label="Property" value={asset?.buildingName ?? asset?.name ?? "Rental property"} />
                <Fact label="Unit" value={asset?.unitNumber ?? "—"} />
                <Fact label="Agreement" value={agreement?.agreementNumber ?? ""} />
              </Panel>
            ) : null}
            {step === 1 ? (
              <>
                <Field label="Start date" value={values.startDate} onChangeText={(value) => update("startDate", value)} placeholder="YYYY-MM-DD" />
                <Field label="End date" value={values.endDate} onChangeText={(value) => update("endDate", value)} placeholder="YYYY-MM-DD" />
                <Field label="Monthly rent (₹)" value={values.monthlyRent} onChangeText={(value) => update("monthlyRent", value.replace(/\D/g, ""))} keyboardType="number-pad" />
              </>
            ) : null}
            {step === 2 ? (
              <Field label="Security deposit (₹)" value={values.securityDeposit} onChangeText={(value) => update("securityDeposit", value.replace(/\D/g, ""))} keyboardType="number-pad" />
            ) : null}
            {step === 3 ? (
              <Field label="Agreement terms" value={values.terms} onChangeText={(value) => update("terms", value)} multiline numberOfLines={5} maxLength={2000} style={styles.multilineField} />
            ) : null}
            {step === 4 ? (
              <Field label="Important terms" value={values.importantTerms} onChangeText={(value) => update("importantTerms", value)} multiline numberOfLines={6} maxLength={4000} style={styles.multilineField} />
            ) : null}
            {step === 5 ? (
              <Panel style={styles.reviewInfo}>
                <Text style={styles.cardTitle}>Confirm your approval</Text>
                <Text style={styles.mutedSmall}>Your approval will be recorded with the current date and time. The other party must approve before the agreement becomes active.</Text>
                <Divider />
                <Fact label="Term" value={`${shortDate(values.startDate)} – ${shortDate(values.endDate)}`} />
                <Fact label="Monthly rent" value={money(Number(values.monthlyRent))} />
                <Fact label="Security deposit" value={money(Number(values.securityDeposit))} />
                <ApprovalLine role="Owner" time={agreement?.ownerApprovedAt} />
                <ApprovalLine role="Tenant" time={agreement?.tenantApprovedAt} />
              </Panel>
            ) : null}
            {error ? <Notice message={error} /> : null}
          </ScrollView>
          <View style={styles.reviewActions}>
            {step > 0 ? (
              <View style={styles.reviewActionButton}>
                <ActionButton label="Back" variant="secondary" onPress={() => setStep((current) => current - 1)} />
              </View>
            ) : null}
            <View style={styles.reviewActionButton}>
              {step < steps.length - 1 ? (
                <ActionButton label="Continue" onPress={() => setStep((current) => current + 1)} icon={<ChevronRight size={17} color={colors.white} />} />
              ) : (
                <ActionButton label={`Approve as ${roleLabel}`} onPress={() => void approve()} busy={busy} icon={<Check size={16} color={colors.white} />} />
              )}
            </View>
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
  inlineHeading: { flexDirection: "row", alignItems: "center", gap: 10 },
  flexOne: { flex: 1 },
  cardTitle: { color: colors.ink, fontSize: 13, fontWeight: "700" },
  mutedSmall: { color: colors.muted, fontSize: 11, lineHeight: 16 },
  highlightPanel: { backgroundColor: "#F1F6F1", borderColor: "#D7E5D8" },
  highlightIcon: { width: 36, height: 36, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: colors.mint },
  metricGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  metricCard: { width: "48%", flexGrow: 1, padding: 14, gap: 5 },
  metricTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  metricValue: { color: colors.ink, fontSize: 25, fontWeight: "800", letterSpacing: -0.6 },
  metricIcon: { width: 32, height: 32, borderRadius: 11, backgroundColor: colors.mint, alignItems: "center", justifyContent: "center" },
  metricLabel: { color: colors.muted, fontSize: 11, fontWeight: "600" },
  actionPanel: { gap: 14 },
  actionPanelHeading: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  actionGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  quickAction: { flexBasis: "48%", flexGrow: 1, minHeight: 43, borderRadius: 13, backgroundColor: "#F4F7F2", paddingHorizontal: 10, flexDirection: "row", alignItems: "center", gap: 8 },
  quickIcon: { width: 25, height: 25, borderRadius: 9, backgroundColor: colors.mint, alignItems: "center", justifyContent: "center" },
  quickText: { color: colors.ink, fontSize: 11, fontWeight: "700" },
  propertyIcon: { width: 37, height: 37, borderRadius: 12, backgroundColor: colors.mint, alignItems: "center", justifyContent: "center" },
  countPill: { color: colors.forest, backgroundColor: colors.mint, borderRadius: 99, paddingHorizontal: 8, paddingVertical: 5, fontSize: 10, fontWeight: "700", overflow: "hidden" },
  unitHint: { color: colors.muted, fontSize: 10, marginTop: 4 },
  unitRow: { flexDirection: "row", alignItems: "center", gap: 7, paddingTop: 10, marginTop: 9, borderTopWidth: 1, borderColor: colors.line, flexWrap: "wrap" },
  unitName: { flex: 1, color: colors.ink, fontSize: 11, fontWeight: "600" },
  unitRent: { color: colors.forest, fontSize: 11, fontWeight: "700" },
  unitTenant: { width: "100%", paddingLeft: 21, color: colors.muted, fontSize: 10 },
  unitBlock: { gap: 3 },
  personRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  avatar: { width: 38, height: 38, borderRadius: 14, backgroundColor: colors.mint, alignItems: "center", justifyContent: "center" },
  iconButton: { width: 37, height: 37, borderRadius: 12, backgroundColor: colors.mint, alignItems: "center", justifyContent: "center" },
  recordActions: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 2 },
  recordAction: { minHeight: 36, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, borderRadius: 11, backgroundColor: colors.mint, paddingHorizontal: 10 },
  recordActionDanger: { backgroundColor: colors.dangerWash },
  recordActionText: { color: colors.forest, fontSize: 10, fontWeight: "700" },
  recordActionTextDanger: { color: colors.danger },
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
  reviewInfo: { backgroundColor: "#F8FAF7" },
  modalRoot: { flex: 1, justifyContent: "flex-end" },
  modalShade: { ...StyleSheet.absoluteFill, backgroundColor: "rgba(12,27,20,0.44)" },
  sheet: { height: "92%", maxHeight: "92%", backgroundColor: colors.background, borderTopLeftRadius: 25, borderTopRightRadius: 25, paddingHorizontal: 18, paddingTop: 10, paddingBottom: 18, gap: 10 },
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
  reviewSteps: { gap: 7 },
  reviewStep: { backgroundColor: "#E8EDE6", borderRadius: 99, paddingHorizontal: 12, paddingVertical: 8 },
  reviewStepActive: { backgroundColor: colors.forest },
  reviewStepText: { color: colors.muted, fontSize: 10, fontWeight: "700" },
  reviewStepTextActive: { color: colors.white },
  stepCounter: { color: colors.leaf, fontSize: 9, fontWeight: "800", letterSpacing: 0.8 },
  reviewContent: { flex: 1, minHeight: 0 },
  reviewActions: { flexDirection: "row", flexShrink: 0, gap: 9, paddingTop: 2 },
  reviewActionButton: { flex: 1 },
  multilineField: { minHeight: 140 },
  pressed: { opacity: 0.8 },
});
