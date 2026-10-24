import { randomUUID } from "node:crypto";
import { readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { addElevenMonthTerm } from "@/lib/rental-agreement";
import { getRenewalAgreementTerm } from "@/lib/agreement-year";
import { getNextAgreementApprovals } from "@/lib/agreement-approval";
import { shouldUseDatabase } from "@/lib/storage-mode";

export type DevBuilding = {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  postalCode: string;
  ownerName: string;
  ownerMobile: string;
  ownerId: string;
  companyId?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type DevOwner = {
  id: string;
  fullName: string;
  mobileNumber: string;
  email?: string | null;
  passwordHash?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type DevCompany = {
  id: string;
  ownerId: string;
  name: string;
  createdAt: string;
  updatedAt: string;
};

export type DevAsset = {
  id: string;
  buildingId: string;
  name: string;
  assetType: string;
  unitNumber: string;
  monthlyRent: number;
  securityDeposit: number;
  externalBuildingId?: string | null;
  ward?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type DevTenant = {
  id: string;
  ownerId: string;
  fullName: string;
  mobileNumber: string | null;
  passwordHash?: string | null;
  assetIds: string[];
  createdAt: string;
  updatedAt: string;
};

export type DevAgreement = {
  id: string;
  agreementNumber: string;
  assetId: string;
  tenantId: string;
  startDate: string;
  endDate: string;
  monthlyRent: number;
  securityDeposit: number;
  terms: string;
  importantTerms?: string;
  status: "ACTIVE" | "DRAFT";
  agreementYear: number;
  ownerApprovedAt?: string | null;
  tenantApprovedAt?: string | null;
  renewalOfId?: string | null;
  createdAt: string;
};

type DevStore = {
  owners: DevOwner[];
  buildings: DevBuilding[];
  companies: DevCompany[];
  assets: DevAsset[];
  tenants: DevTenant[];
  agreements: DevAgreement[];
};

type BuildingInput = Omit<DevBuilding, "id" | "ownerId" | "createdAt" | "updatedAt">;

export class DevAgreementConflictError extends Error {}

const STORE_PATH = path.join(process.cwd(), ".rent-sync-dev-data.json");
let storeQueue: Promise<void> = Promise.resolve();

function assertDevelopmentMode() {
  if (shouldUseDatabase()) {
    throw new Error("Local demo storage is disabled while database mode is active.");
  }
}

async function readStore(): Promise<DevStore> {
  try {
    const serialized = await readFile(STORE_PATH, "utf8");
    const store: unknown = JSON.parse(serialized);
    if (
      !store ||
      typeof store !== "object" ||
      !("owners" in store) ||
      !Array.isArray(store.owners) ||
      !("buildings" in store) ||
      !Array.isArray(store.buildings)
    ) {
      throw new Error("Local Rent-Sync data file has an invalid format.");
    }
    const existing = store as Partial<DevStore> & {
      agreements?: Array<DevAgreement & { renewalOfId?: string | null }>;
    };
    const owners = existing.owners ?? [];
    const buildings = existing.buildings ?? [];
    const rawAgreements = existing.agreements ?? [];
    const agreementsById = new Map(rawAgreements.map((agreement) => [agreement.id, agreement]));
    return {
      owners,
      buildings: buildings.map((building) => ({
        ...building,
        companyId: building.companyId ?? null,
      })),
      companies: existing.companies ?? [],
      assets: existing.assets ?? [],
      tenants: existing.tenants ?? [],
      agreements: rawAgreements.map((agreement) => {
        const legacySource = agreement.renewalOfId
          ? agreementsById.get(agreement.renewalOfId)
          : null;
        const legacyYear = legacySource
          ? Number(legacySource.startDate.slice(0, 4)) + 1
          : Number(agreement.startDate.slice(0, 4));
        const legacyStart = legacySource ? `${legacyYear}-01-01` : agreement.startDate;
        const currentAgreement = { ...agreement };
        delete currentAgreement.renewalOfId;
        return {
          ...currentAgreement,
          importantTerms: agreement.importantTerms ?? "",
          ownerApprovedAt: agreement.ownerApprovedAt ?? null,
          tenantApprovedAt: agreement.tenantApprovedAt ?? null,
          startDate: legacyStart,
          endDate: legacySource
            ? addElevenMonthTerm(legacyStart) ?? agreement.endDate
            : agreement.endDate,
          agreementYear: legacySource
            ? legacyYear
            : agreement.agreementYear ?? Number(agreement.startDate.slice(0, 4)),
        };
      }),
    };
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "ENOENT"
    ) {
      return {
        owners: [],
        buildings: [],
        companies: [],
        assets: [],
        tenants: [],
        agreements: [],
      };
    }
    throw error;
  }
}

async function writeStore(store: DevStore) {
  const temporaryPath = `${STORE_PATH}.${randomUUID()}.tmp`;
  await writeFile(temporaryPath, JSON.stringify(store, null, 2), {
    encoding: "utf8",
    mode: 0o600,
  });
  await rename(temporaryPath, STORE_PATH);
}

async function withStore<T>(operation: (store: DevStore) => Promise<T>) {
  assertDevelopmentMode();
  const current = storeQueue.then(async () => {
    const store = await readStore();
    return operation(store);
  });
  storeQueue = current.then(
    () => undefined,
    () => undefined,
  );
  return current;
}

export function upsertDevOwner(fullName: string, mobileNumber: string) {
  return withStore(async (store) => {
    const now = new Date().toISOString();
    let owner = store.owners.find((entry) => entry.mobileNumber === mobileNumber);
    if (owner) {
      owner.fullName = fullName;
      owner.updatedAt = now;
    } else {
      owner = {
        id: randomUUID(),
        fullName,
        mobileNumber,
        createdAt: now,
        updatedAt: now,
      };
      store.owners.push(owner);
    }
    await writeStore(store);
    return owner;
  });
}

export function createDevOwner(
  fullName: string,
  mobileNumber: string,
  passwordHash: string,
) {
  return withStore(async (store) => {
    if (store.owners.some((entry) => entry.mobileNumber === mobileNumber)) {
      return null;
    }
    const now = new Date().toISOString();
    const owner: DevOwner = {
      id: randomUUID(),
      fullName,
      mobileNumber,
      passwordHash,
      createdAt: now,
      updatedAt: now,
    };
    store.owners.push(owner);
    await writeStore(store);
    return owner;
  });
}

export function setDevOwnerPassword(mobileNumber: string, passwordHash: string) {
  return withStore(async (store) => {
    const owner = store.owners.find((entry) => entry.mobileNumber === mobileNumber);
    if (!owner) return false;
    owner.passwordHash = passwordHash;
    owner.updatedAt = new Date().toISOString();
    await writeStore(store);
    return true;
  });
}

export function setDevTenantPassword(mobileNumber: string, passwordHash: string) {
  return withStore(async (store) => {
    const tenant = store.tenants.find((entry) => entry.mobileNumber === mobileNumber);
    if (!tenant) return false;
    tenant.passwordHash = passwordHash;
    tenant.updatedAt = new Date().toISOString();
    await writeStore(store);
    return true;
  });
}

export function createDevBuilding(input: BuildingInput) {
  return withStore(async (store) => {
    const now = new Date().toISOString();
    let owner = store.owners.find((entry) => entry.mobileNumber === input.ownerMobile);
    if (!owner) {
      owner = {
        id: randomUUID(),
        fullName: input.ownerName,
        mobileNumber: input.ownerMobile,
        createdAt: now,
        updatedAt: now,
      };
      store.owners.push(owner);
    }
    const building: DevBuilding = {
      ...input,
      id: randomUUID(),
      ownerId: owner.id,
      createdAt: now,
      updatedAt: now,
    };
    store.buildings.unshift(building);
    await writeStore(store);
    return building;
  });
}

export function listDevBuildings() {
  return withStore(async (store) => store.buildings);
}

export function listDevOwnerBuildings(mobileNumber: string) {
  return withStore(async (store) => {
    const owner = store.owners.find((entry) => entry.mobileNumber === mobileNumber);
    if (!owner) return null;
    return store.buildings.filter(
      (building) =>
        building.ownerId === owner.id ||
        building.ownerMobile === owner.mobileNumber,
    );
  });
}

export function getDevOwner(mobileNumber: string) {
  return withStore(async (store) =>
    store.owners.find((entry) => entry.mobileNumber === mobileNumber) ?? null,
  );
}

export function listDevAdminAccounts() {
  return withStore(async (store) => ({
    owners: store.owners.map(({ id, fullName, mobileNumber, createdAt }) => ({
      id,
      fullName,
      mobileNumber,
      createdAt,
    })),
    tenants: store.tenants
      .filter(
        (tenant): tenant is DevTenant & { mobileNumber: string } =>
          typeof tenant.mobileNumber === "string" && tenant.mobileNumber.length > 0,
      )
      .map(({ id, fullName, mobileNumber, createdAt }) => ({
        id,
        fullName,
        mobileNumber,
        createdAt,
      })),
  }));
}

export function updateDevOwnerProfile(
  mobileNumber: string,
  fullName: string,
  email: string | null,
  passwordHash?: string,
) {
  return withStore(async (store) => {
    const owner = store.owners.find((entry) => entry.mobileNumber === mobileNumber);
    if (!owner) return null;
    owner.fullName = fullName;
    owner.email = email;
    if (passwordHash) owner.passwordHash = passwordHash;
    owner.updatedAt = new Date().toISOString();
    await writeStore(store);
    return owner;
  });
}

export function getDevOwnerPasswordHash(mobileNumber: string) {
  return withStore(async (store) => {
    const owner = store.owners.find((entry) => entry.mobileNumber === mobileNumber);
    return owner?.passwordHash ?? null;
  });
}

export function getDevOwnerPortfolio(mobileNumber: string) {
  return withStore(async (store) => {
    const owner = store.owners.find((entry) => entry.mobileNumber === mobileNumber);
    if (!owner) return null;
    const companies = store.companies.filter((entry) => entry.ownerId === owner.id);
    const companyIds = new Set(companies.map((entry) => entry.id));
    const buildings = store.buildings.filter(
      (entry) =>
        entry.ownerId === owner.id ||
        (entry.companyId !== null &&
          entry.companyId !== undefined &&
          companyIds.has(entry.companyId)),
    );
    const buildingIds = new Set(buildings.map((entry) => entry.id));
    const assets = store.assets.filter((entry) => buildingIds.has(entry.buildingId));
    const assetIds = new Set(assets.map((entry) => entry.id));
    const tenants = store.tenants.filter(
      (tenant) =>
        tenant.ownerId === owner.id ||
        tenant.assetIds.some((assetId) => assetIds.has(assetId)),
    );
    const tenantIds = new Set(tenants.map((entry) => entry.id));
    const agreements = store.agreements.filter(
      (entry) => assetIds.has(entry.assetId) || tenantIds.has(entry.tenantId),
    );
    return { owner, companies, buildings, assets, tenants, agreements };
  });
}

export function createDevCompany(ownerMobile: string, name: string) {
  return withStore(async (store) => {
    const owner = store.owners.find((entry) => entry.mobileNumber === ownerMobile);
    if (!owner) throw new Error("Register an owner account before creating a company.");
    const now = new Date().toISOString();
    const company: DevCompany = {
      id: randomUUID(),
      ownerId: owner.id,
      name,
      createdAt: now,
      updatedAt: now,
    };
    store.companies.unshift(company);
    await writeStore(store);
    return company;
  });
}

export function createDevOwnerBuilding(
  ownerMobile: string,
  companyId: string,
  input: Omit<BuildingInput, "ownerName" | "ownerMobile">,
) {
  return withStore(async (store) => {
    const company = store.companies.find((entry) => entry.id === companyId);
    const owner = store.owners.find(
      (entry) => entry.id === company?.ownerId && entry.mobileNumber === ownerMobile,
    );
    if (!company || !owner) throw new Error("Company not found in your account.");
    const now = new Date().toISOString();
    const building: DevBuilding = {
      ...input,
      ownerId: owner.id,
      ownerName: owner.fullName,
      ownerMobile: owner.mobileNumber,
      companyId: company.id,
      id: randomUUID(),
      createdAt: now,
      updatedAt: now,
    };
    store.buildings.unshift(building);
    await writeStore(store);
    return building;
  });
}

export function createDevAsset(
  ownerMobile: string,
  input: Omit<DevAsset, "id" | "createdAt" | "updatedAt">,
) {
  return withStore(async (store) => {
    const owner = store.owners.find((entry) => entry.mobileNumber === ownerMobile);
    const building = store.buildings.find(
      (entry) => entry.id === input.buildingId && entry.ownerId === owner?.id,
    );
    if (!owner || !building) throw new Error("Building not found in your account.");
    if (
      store.assets.some(
        (entry) =>
          entry.buildingId === building.id && entry.unitNumber === input.unitNumber,
      )
    ) {
      throw new Error("This unit number already exists in that building.");
    }
    const now = new Date().toISOString();
    const asset: DevAsset = {
      ...input,
      id: randomUUID(),
      createdAt: now,
      updatedAt: now,
    };
    store.assets.unshift(asset);
    await writeStore(store);
    return asset;
  });
}

export function updateDevAsset(
  ownerMobile: string,
  assetId: string,
  input: Omit<DevAsset, "id" | "createdAt" | "updatedAt">,
) {
  return withStore(async (store) => {
    const owner = store.owners.find((entry) => entry.mobileNumber === ownerMobile);
    const asset = store.assets.find((entry) => entry.id === assetId);
    const currentBuilding = store.buildings.find((entry) => entry.id === asset?.buildingId);
    const nextBuilding = store.buildings.find(
      (entry) => entry.id === input.buildingId && entry.ownerId === owner?.id,
    );
    if (!owner || !asset || !currentBuilding || currentBuilding.ownerId !== owner.id) {
      throw new Error("Asset not found in your account.");
    }
    if (!nextBuilding) throw new Error("Building not found in your account.");
    if (
      store.assets.some(
        (entry) =>
          entry.id !== assetId &&
          entry.buildingId === nextBuilding.id &&
          entry.unitNumber === input.unitNumber,
      )
    ) {
      throw new Error("This unit number already exists in that building.");
    }

    Object.assign(asset, input, { updatedAt: new Date().toISOString() });
    await writeStore(store);
    return asset;
  });
}

export function updateDevPortfolioItem(
  ownerMobile: string,
  kind: "company" | "building" | "tenant",
  id: string,
  input: Record<string, string | null>,
) {
  return withStore(async (store) => {
    const owner = store.owners.find((entry) => entry.mobileNumber === ownerMobile);
    if (!owner) throw new Error("Owner account was not found.");
    const now = new Date().toISOString();

    if (kind === "company") {
      const company = store.companies.find((entry) => entry.id === id && entry.ownerId === owner.id);
      if (!company) throw new Error("Company not found in your account.");
      company.name = input.name ?? company.name;
      company.updatedAt = now;
      await writeStore(store);
      return company;
    }
    if (kind === "building") {
      const building = store.buildings.find((entry) => entry.id === id && entry.ownerId === owner.id);
      if (!building) throw new Error("Property not found in your account.");
      const company = store.companies.find(
        (entry) => entry.id === input.companyId && entry.ownerId === owner.id,
      );
      if (!company) throw new Error("Company not found in your account.");
      Object.assign(building, {
        companyId: company.id,
        name: input.name ?? building.name,
        address: input.address ?? building.address,
        city: input.city ?? building.city,
        state: input.state ?? building.state,
        postalCode: input.postalCode ?? building.postalCode,
        updatedAt: now,
      });
      await writeStore(store);
      return building;
    }

    const tenant = store.tenants.find((entry) => entry.id === id && entry.ownerId === owner.id);
    if (!tenant) throw new Error("Tenant not found in your account.");
    const mobileNumber = input.mobileNumber?.replace(/\D/g, "") || null;
    if (
      mobileNumber &&
      store.tenants.some((entry) => entry.id !== id && entry.mobileNumber === mobileNumber)
    ) {
      throw new Error("This mobile number is already registered.");
    }
    tenant.fullName = input.fullName ?? tenant.fullName;
    tenant.mobileNumber = mobileNumber;
    tenant.updatedAt = now;
    await writeStore(store);
    return tenant;
  });
}

export function deleteDevPortfolioItem(
  ownerMobile: string,
  kind: "company" | "building" | "asset" | "tenant" | "agreement",
  id: string,
) {
  return withStore(async (store) => {
    const owner = store.owners.find((entry) => entry.mobileNumber === ownerMobile);
    if (!owner) throw new Error("Owner account was not found.");

    if (kind === "company") {
      const company = store.companies.find((entry) => entry.id === id && entry.ownerId === owner.id);
      if (!company) throw new Error("Company not found in your account.");
      if (store.buildings.some((entry) => entry.companyId === id)) {
        throw new Error("Move or delete this company's properties before deleting the company.");
      }
      store.companies = store.companies.filter((entry) => entry.id !== id);
    } else if (kind === "building") {
      const building = store.buildings.find((entry) => entry.id === id && entry.ownerId === owner.id);
      if (!building) throw new Error("Property not found in your account.");
      if (store.assets.some((entry) => entry.buildingId === id)) {
        throw new Error("Delete this property's units before deleting the property.");
      }
      store.buildings = store.buildings.filter((entry) => entry.id !== id);
    } else if (kind === "asset") {
      const asset = store.assets.find((entry) => entry.id === id);
      const building = store.buildings.find((entry) => entry.id === asset?.buildingId);
      if (!asset || building?.ownerId !== owner.id) throw new Error("Unit not found in your account.");
      if (store.agreements.some((entry) => entry.assetId === id)) {
        throw new Error("This unit has agreement history and cannot be deleted.");
      }
      store.assets = store.assets.filter((entry) => entry.id !== id);
      for (const tenant of store.tenants) tenant.assetIds = tenant.assetIds.filter((assetId) => assetId !== id);
    } else if (kind === "tenant") {
      const tenant = store.tenants.find((entry) => entry.id === id && entry.ownerId === owner.id);
      if (!tenant) throw new Error("Tenant not found in your account.");
      if (store.agreements.some((entry) => entry.tenantId === id)) {
        throw new Error("This tenant has agreement history and cannot be deleted.");
      }
      store.tenants = store.tenants.filter((entry) => entry.id !== id);
    } else {
      const agreement = store.agreements.find((entry) => entry.id === id);
      const asset = store.assets.find((entry) => entry.id === agreement?.assetId);
      const building = store.buildings.find((entry) => entry.id === asset?.buildingId);
      if (!agreement || building?.ownerId !== owner.id) throw new Error("Agreement not found in your account.");
      if (
        agreement.status !== "DRAFT" ||
        agreement.ownerApprovedAt ||
        agreement.tenantApprovedAt
      ) {
        throw new Error("Only unapproved draft agreements can be deleted.");
      }
      store.agreements = store.agreements.filter((entry) => entry.id !== id);
    }

    await writeStore(store);
    return { success: true };
  });
}

export function updateDevDraftAgreement(
  ownerMobile: string,
  agreementId: string,
  input: {
    startDate: string;
    endDate: string;
    monthlyRent: number;
    securityDeposit: number;
    terms: string;
    importantTerms: string;
  },
) {
  return withStore(async (store) => {
    const owner = store.owners.find((entry) => entry.mobileNumber === ownerMobile);
    const agreement = store.agreements.find((entry) => entry.id === agreementId);
    const asset = store.assets.find((entry) => entry.id === agreement?.assetId);
    const building = store.buildings.find((entry) => entry.id === asset?.buildingId);
    if (!owner || !agreement || building?.ownerId !== owner.id) {
      throw new Error("Agreement not found in your account.");
    }
    if (
      agreement.status !== "DRAFT" ||
      agreement.ownerApprovedAt ||
      agreement.tenantApprovedAt
    ) {
      throw new Error("Only unapproved draft agreements can be edited.");
    }
    const agreementYear = Number(input.startDate.slice(0, 4));
    if (
      store.agreements.some(
        (entry) =>
          entry.id !== agreementId &&
          entry.assetId === agreement.assetId &&
          entry.tenantId === agreement.tenantId &&
          entry.agreementYear === agreementYear,
      )
    ) {
      throw new DevAgreementConflictError("An agreement already exists for this tenant, unit, and year.");
    }
    Object.assign(agreement, input, { agreementYear });
    await writeStore(store);
    return agreement;
  });
}

export function createDevTenant(
  ownerMobile: string,
  assetId: string,
  fullName: string,
  mobileNumber: string | null,
  startDate: string,
) {
  return withStore(async (store) => {
    const owner = store.owners.find((entry) => entry.mobileNumber === ownerMobile);
    const asset = store.assets.find((entry) => entry.id === assetId);
    const building = store.buildings.find((entry) => entry.id === asset?.buildingId);
    if (!owner || !asset || !building || building.ownerId !== owner.id) {
      throw new Error("Asset not found in your account.");
    }
    if (store.tenants.some((entry) => entry.assetIds.includes(assetId))) {
      throw new DevAgreementConflictError("This unit is already assigned to a tenant.");
    }
    const endDate = addElevenMonthTerm(startDate);
    if (!endDate) throw new Error("Choose a valid agreement start date.");
    let tenant = mobileNumber
      ? store.tenants.find((entry) => entry.mobileNumber === mobileNumber)
      : store.tenants.find(
          (entry) =>
            entry.ownerId === owner.id &&
            entry.fullName.toLowerCase() === fullName.toLowerCase() &&
            entry.mobileNumber === null,
        );
    const now = new Date().toISOString();
    if (!tenant) {
      tenant = {
        id: randomUUID(),
        ownerId: owner.id,
        fullName,
        mobileNumber,
        assetIds: [],
        createdAt: now,
        updatedAt: now,
      };
      store.tenants.push(tenant);
    } else if (tenant.ownerId !== owner.id) {
      throw new Error("This mobile number is already registered with a different owner.");
    } else {
      tenant.fullName = fullName;
      tenant.updatedAt = now;
    }
    const agreementYear = Number(startDate.slice(0, 4));
    if (
      store.agreements.some(
        (agreement) =>
          agreement.assetId === asset.id &&
          agreement.tenantId === tenant.id &&
          agreement.agreementYear === agreementYear,
      )
    ) {
      throw new DevAgreementConflictError(
        "An agreement already exists for this tenant, asset, and year.",
      );
    }
    if (
      store.agreements.some((agreement) =>
        agreementOverlaps(agreement, asset.id, startDate, endDate),
      )
    ) {
      throw new DevAgreementConflictError("This asset already has an agreement for those dates.");
    }
    if (!tenant.assetIds.includes(asset.id)) tenant.assetIds.push(asset.id);
    const initialAgreement: DevAgreement = {
      id: randomUUID(),
      agreementNumber: `RS-${agreementYear}-${randomUUID().slice(0, 8).toUpperCase()}`,
      assetId: asset.id,
      tenantId: tenant.id,
      startDate,
      endDate,
      monthlyRent: asset.monthlyRent,
      securityDeposit: asset.securityDeposit,
      terms: "",
      importantTerms: "",
      status: "DRAFT",
      agreementYear,
      createdAt: now,
    };
    store.agreements.unshift(initialAgreement);
    const renewalTerm = getRenewalAgreementTerm(startDate, endDate);
    if (
      renewalTerm &&
      !store.agreements.some(
        (agreement) =>
          agreement.assetId === asset.id &&
          agreement.tenantId === tenant.id &&
          agreement.agreementYear === renewalTerm.year,
      )
    ) {
      store.agreements.unshift({
        id: randomUUID(),
        agreementNumber: `RS-${renewalTerm.year}-${randomUUID().slice(0, 8).toUpperCase()}`,
        assetId: asset.id,
        tenantId: tenant.id,
        startDate: renewalTerm.startDate,
        endDate: renewalTerm.endDate,
        monthlyRent: asset.monthlyRent,
        securityDeposit: asset.securityDeposit,
        terms: "",
        importantTerms: "",
        status: "DRAFT",
        agreementYear: renewalTerm.year,
        createdAt: now,
      });
    }
    await writeStore(store);
    return tenant;
  });
}

function agreementOverlaps(
  agreement: DevAgreement,
  assetId: string,
  startDate: string,
  endDate: string,
) {
  return (
    agreement.assetId === assetId &&
    agreement.status === "ACTIVE" &&
    agreement.startDate <= endDate &&
    agreement.endDate >= startDate
  );
}

export function createDevAgreement(input: {
  assetId: string;
  tenantMobile?: string;
  tenantId?: string;
  startDate: string;
  endDate: string;
  terms: string;
}) {
  return withStore(async (store) => {
    const tenant = store.tenants.find((entry) =>
      entry.assetIds.includes(input.assetId) &&
      (input.tenantId ? entry.id === input.tenantId : entry.mobileNumber === input.tenantMobile),
    );
    const asset = store.assets.find((entry) => entry.id === input.assetId);
    if (!tenant || !asset) {
      throw new Error("This property has not been assigned to your tenant account.");
    }
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(input.startDate) ||
      !/^\d{4}-\d{2}-\d{2}$/.test(input.endDate) ||
      input.endDate <= input.startDate
    ) {
      throw new Error("Choose a valid agreement start and end date.");
    }
    if (
      store.agreements.some((agreement) =>
        agreementOverlaps(agreement, asset.id, input.startDate, input.endDate),
      )
    ) {
      throw new DevAgreementConflictError("This asset already has an agreement for those dates.");
    }
    const agreementYear = Number(input.startDate.slice(0, 4));
    if (
      store.agreements.some(
        (agreement) =>
          agreement.assetId === asset.id &&
          agreement.tenantId === tenant.id &&
          agreement.agreementYear === agreementYear,
      )
    ) {
      throw new DevAgreementConflictError(
        "An agreement already exists for this tenant, asset, and year.",
      );
    }

    const now = new Date();
    const agreement: DevAgreement = {
      id: randomUUID(),
      agreementNumber: `RS-${now.getFullYear()}-${randomUUID().slice(0, 8).toUpperCase()}`,
      assetId: asset.id,
      tenantId: tenant.id,
      startDate: input.startDate,
      endDate: input.endDate,
      monthlyRent: asset.monthlyRent,
      securityDeposit: asset.securityDeposit,
      terms: input.terms.trim(),
      importantTerms: "",
      status: "DRAFT",
      agreementYear,
      createdAt: now.toISOString(),
    };
    store.agreements.unshift(agreement);
    await writeStore(store);
    return { ...agreement, tenant, asset };
  });
}

export type AgreementReviewInput = {
  startDate: string;
  endDate: string;
  monthlyRent: number;
  securityDeposit: number;
  terms: string;
  importantTerms: string;
};

export async function reviewDevAgreement(
  mobileNumber: string,
  role: "OWNER" | "TENANT",
  agreementId: string,
  input: AgreementReviewInput,
) {
  return withStore(async (store) => {
    const agreement = store.agreements.find((entry) => entry.id === agreementId);
    if (!agreement || agreement.status !== "DRAFT") return null;
    const tenant = store.tenants.find((entry) => entry.id === agreement.tenantId);
    const asset = store.assets.find((entry) => entry.id === agreement.assetId);
    const building = store.buildings.find((entry) => entry.id === asset?.buildingId);
    const company = store.companies.find((entry) => entry.id === building?.companyId);
    if (!tenant || !asset || !building) return null;

    const isAuthorized =
      role === "OWNER"
        ? (company?.ownerId ?? building.ownerId) ===
          store.owners.find((entry) => entry.mobileNumber === mobileNumber)?.id
        : tenant.mobileNumber === mobileNumber;
    if (!isAuthorized) return null;
    if (
      role === "OWNER"
        ? agreement.ownerApprovedAt != null
        : agreement.ownerApprovedAt == null || agreement.tenantApprovedAt != null
    ) {
      return null;
    }

    if (
      addElevenMonthTerm(input.startDate) !== input.endDate ||
      !Number.isInteger(input.monthlyRent) ||
      input.monthlyRent <= 0 ||
      !Number.isInteger(input.securityDeposit) ||
      input.securityDeposit < 0
    ) {
      throw new Error("Enter valid agreement dates, monthly rent, and security deposit.");
    }
    const agreementYear = Number(input.startDate.slice(0, 4));
    if (
      store.agreements.some(
        (entry) =>
          entry.id !== agreement.id &&
          entry.assetId === agreement.assetId &&
          entry.tenantId === agreement.tenantId &&
          entry.agreementYear === agreementYear,
      )
    ) {
      throw new DevAgreementConflictError(
        "An agreement already exists for this tenant, asset, and year.",
      );
    }
    if (
      store.agreements.some(
        (entry) =>
          entry.id !== agreement.id &&
          agreementOverlaps(entry, asset.id, input.startDate, input.endDate),
      )
    ) {
      throw new DevAgreementConflictError("This asset already has an active agreement for those dates.");
    }
    const hasChanges =
      agreement.startDate !== input.startDate ||
      agreement.endDate !== input.endDate ||
      agreement.monthlyRent !== input.monthlyRent ||
      agreement.securityDeposit !== input.securityDeposit ||
      agreement.terms !== input.terms ||
      (agreement.importantTerms ?? "") !== input.importantTerms;
    const approvalState = getNextAgreementApprovals(
      {
        ownerApprovedAt: agreement.ownerApprovedAt ?? null,
        tenantApprovedAt: agreement.tenantApprovedAt ?? null,
      },
      role,
      hasChanges,
      new Date(),
    );
    const updatedAgreement: DevAgreement = {
      ...agreement,
      startDate: input.startDate,
      endDate: input.endDate,
      agreementYear,
      monthlyRent: input.monthlyRent,
      securityDeposit: input.securityDeposit,
      terms: input.terms,
      importantTerms: input.importantTerms,
      status: "DRAFT",
      ownerApprovedAt: approvalState.ownerApprovedAt
        ? new Date(approvalState.ownerApprovedAt).toISOString()
        : null,
      tenantApprovedAt: approvalState.tenantApprovedAt
        ? new Date(approvalState.tenantApprovedAt).toISOString()
        : null,
    };
    if (updatedAgreement.ownerApprovedAt && updatedAgreement.tenantApprovedAt) {
      updatedAgreement.status = "ACTIVE";
    }
    Object.assign(agreement, updatedAgreement);
    await writeStore(store);
    return agreement;
  });
}

export function generateDevAnnualAgreementDrafts(mobileNumber: string, now = new Date()) {
  return withStore(async (store) => {
    const owner = store.owners.find((entry) => entry.mobileNumber === mobileNumber);
    if (!owner) return 0;

    const ownerCompanies = new Set(
      store.companies.filter((entry) => entry.ownerId === owner.id).map((entry) => entry.id),
    );
    const ownerBuildingIds = new Set(
      store.buildings
        .filter(
          (building) =>
            building.ownerId === owner.id ||
            (building.companyId && ownerCompanies.has(building.companyId)),
        )
        .map((building) => building.id),
    );
    const ownerAssetIds = new Set(
      store.assets
        .filter((asset) => ownerBuildingIds.has(asset.buildingId))
        .map((asset) => asset.id),
    );
    const ownerTenants = store.tenants.filter(
      (tenant) =>
        tenant.ownerId === owner.id ||
        tenant.assetIds.some((assetId) => ownerAssetIds.has(assetId)),
    );
    let created = 0;
    for (const assetId of ownerAssetIds) {
      const asset = store.assets.find((entry) => entry.id === assetId);
      if (!asset) continue;
      const tenants = ownerTenants.filter((tenant) => tenant.assetIds.includes(assetId));
      for (const tenant of tenants) {
        const tenantAgreements = store.agreements
          .filter(
            (agreement) =>
              agreement.assetId === assetId && agreement.tenantId === tenant.id,
          )
          .sort((a, b) => b.startDate.localeCompare(a.startDate));
        const latestAgreement = tenantAgreements[0];
        if (!latestAgreement) continue;
        const term = getRenewalAgreementTerm(
          latestAgreement.startDate,
          latestAgreement.endDate,
          now,
        );
        if (!term) continue;
        if (
          tenantAgreements.some((agreement) => agreement.agreementYear === term.year)
        ) {
          continue;
        }
        store.agreements.unshift({
          id: randomUUID(),
          agreementNumber: `RS-${term.year}-${randomUUID().slice(0, 8).toUpperCase()}`,
          assetId,
          tenantId: tenant.id,
          startDate: term.startDate,
          endDate: term.endDate,
          monthlyRent: asset.monthlyRent,
          securityDeposit: asset.securityDeposit,
          terms: "",
          importantTerms: "",
          status: "DRAFT",
          agreementYear: term.year,
          createdAt: now.toISOString(),
        });
        created += 1;
      }
    }
    if (created) await writeStore(store);
    return created;
  });
}

export function getDevOwnerAgreement(mobileNumber: string, agreementId: string) {
  return withStore(async (store) => {
    const owner = store.owners.find((entry) => entry.mobileNumber === mobileNumber);
    if (!owner) return null;
    const agreement = store.agreements.find((entry) => entry.id === agreementId);
    if (!agreement) return null;
    const asset = store.assets.find((entry) => entry.id === agreement.assetId);
    const building = store.buildings.find((entry) => entry.id === asset?.buildingId);
    const company = store.companies.find((entry) => entry.id === building?.companyId);
    const isOwned =
      building?.ownerId === owner.id ||
      (company?.ownerId === owner.id && building?.companyId === company.id);
    const tenant = store.tenants.find((entry) => entry.id === agreement.tenantId);
    if (!isOwned || !asset || !building || !tenant) return null;
    return { owner, tenant, asset, building, agreement };
  });
}

export function getDevTenantMobile(mobileNumber: string) {
  return withStore(async (store) =>
    store.tenants.find((entry) => entry.mobileNumber === mobileNumber) ?? null,
  );
}

export function getDevTenantPasswordHash(mobileNumber: string) {
  return withStore(async (store) => {
    const tenant = store.tenants.find((entry) => entry.mobileNumber === mobileNumber);
    return tenant?.passwordHash ?? null;
  });
}

export function getDevTenantPortal(mobileNumber: string) {
  return withStore(async (store) => {
    const tenant = store.tenants.find((entry) => entry.mobileNumber === mobileNumber);
    if (!tenant) return null;
    const assets = store.assets
      .filter((entry) => tenant.assetIds.includes(entry.id))
      .map((asset) => {
        const building = store.buildings.find((entry) => entry.id === asset.buildingId);
        const company = store.companies.find((entry) => entry.id === building?.companyId);
        return {
          ...asset,
          buildingName: building?.name,
          buildingAddress: building?.address,
          city: building?.city,
          state: building?.state,
          postalCode: building?.postalCode,
          companyName: company?.name ?? null,
        };
      });
    const buildings = store.buildings.filter((entry) =>
      assets.some((asset) => asset.buildingId === entry.id),
    );
    const agreements = store.agreements.filter((entry) => entry.tenantId === tenant.id);
    return { tenant, assets, buildings, agreements };
  });
}
