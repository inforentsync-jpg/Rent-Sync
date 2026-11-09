import { randomUUID } from "node:crypto";
import { readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { addElevenMonthTerm } from "@/lib/rental-agreement";
import {
  addAgreementDuration,
  DEFAULT_AGREEMENT_DURATION_UNIT,
  DEFAULT_AGREEMENT_DURATION_VALUE,
  hasValidAgreementDurationTerm,
  type AgreementDurationUnit,
} from "@/lib/agreement-duration";
import { getRenewalAgreementTerm } from "@/lib/agreement-year";
import { shouldUseDatabase } from "@/lib/storage-mode";

export type DevBuilding = {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  postalCode: string;
  panchayat?: string | null;
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
  aadhaarNumber?: string | null;
  fullAddress?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  district?: string | null;
  state?: string | null;
  city?: string | null;
  postalCode?: string | null;
  fatherName?: string | null;
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
  agreementDurationUnit: AgreementDurationUnit;
  agreementDurationValue: number;
  agreementStartDate?: string | null;
  externalBuildingId?: string | null;
  ward?: string | null;
  roomNumber?: string | null;
  ksmartBuildingId?: string | null;
  ksrbId?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type DevTenant = {
  id: string;
  ownerId: string;
  fullName: string;
  mobileNumber: string | null;
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
  status: "ACTIVE" | "DRAFT" | "MERGED" | "CANCELLED";
  agreementYear: number;
  ownerApprovedAt?: string | null;
  tenantApprovedAt?: string | null;
  mandatoryDetailsApprovedAt?: string | null;
  mergedIntoAgreementId?: string | null;
  mergedOriginalStatus?: "ACTIVE" | "DRAFT" | null;
  mergedOriginalStartDate?: string | null;
  mergedOriginalEndDate?: string | null;
  mergedOriginalAgreementYear?: number | null;
  mergedOriginalMonthlyRent?: number | null;
  mergedOriginalSecurityDeposit?: number | null;
  mergedOriginalOwnerApprovedAt?: string | null;
  mergedOriginalTenantApprovedAt?: string | null;
  mergedOriginalMandatoryDetailsApprovedAt?: string | null;
  renewalOfId?: string | null;
  createdAt: string;
};

export type DevArchivedAgreement = DevAgreement & {
  ownerId: string;
  tenantName: string;
  tenantMobileNumber: string | null;
  assetName: string;
  assetType: string;
  unitNumber: string;
  buildingName: string;
  buildingAddress: string;
  city: string;
  state: string;
  templateTerms: [];
  archivedAt: string;
};

type DevStore = {
  owners: DevOwner[];
  buildings: DevBuilding[];
  companies: DevCompany[];
  assets: DevAsset[];
  tenants: DevTenant[];
  agreements: DevAgreement[];
  archivedAgreements: DevArchivedAgreement[];
  dismissedAgreementRenewals: string[];
};

function markDevAgreementsForReview(
  store: DevStore,
  predicate: (agreement: DevAgreement) => boolean,
) {
  const affected = store.agreements.filter((agreement) =>
    !agreement.mergedIntoAgreementId &&
    (agreement.status === "ACTIVE" || agreement.status === "DRAFT") &&
    predicate(agreement),
  );
  const affectedIds = new Set(affected.map(({ id }) => id));
  for (const agreement of affected) {
    agreement.status = "DRAFT";
    agreement.ownerApprovedAt = null;
    agreement.tenantApprovedAt = null;
    agreement.mandatoryDetailsApprovedAt = null;
  }
  for (const agreement of store.agreements) {
    if (!agreement.mergedIntoAgreementId || !affectedIds.has(agreement.mergedIntoAgreementId)) continue;
    agreement.mergedOriginalStatus = "DRAFT";
    agreement.mergedOriginalOwnerApprovedAt = null;
    agreement.mergedOriginalTenantApprovedAt = null;
    agreement.mergedOriginalMandatoryDetailsApprovedAt = null;
  }
}

function syncDevAgreementAmountsFromAssets(store: DevStore, assetIds: Set<string>) {
  const affected = store.agreements.filter((agreement) =>
    !agreement.mergedIntoAgreementId &&
    (agreement.status === "ACTIVE" || agreement.status === "DRAFT") &&
    (assetIds.has(agreement.assetId) ||
      store.agreements.some(
        (member) => member.mergedIntoAgreementId === agreement.id && assetIds.has(member.assetId),
      )),
  );
  for (const agreement of affected) {
    const memberAssetIds = new Set([
      agreement.assetId,
      ...store.agreements
        .filter((member) => member.mergedIntoAgreementId === agreement.id)
        .map((member) => member.assetId),
    ]);
    const memberAssets = store.assets.filter((asset) => memberAssetIds.has(asset.id));
    agreement.monthlyRent = memberAssets.reduce((total, asset) => total + asset.monthlyRent, 0);
    agreement.securityDeposit = memberAssets.reduce((total, asset) => total + asset.securityDeposit, 0);
    for (const member of store.agreements) {
      if (member.mergedIntoAgreementId !== agreement.id) continue;
      const asset = memberAssets.find((entry) => entry.id === member.assetId);
      if (!asset) continue;
      member.mergedOriginalMonthlyRent = asset.monthlyRent;
      member.mergedOriginalSecurityDeposit = asset.securityDeposit;
    }
  }
}

type BuildingInput = Omit<DevBuilding, "id" | "ownerId" | "createdAt" | "updatedAt">;

export class DevAgreementConflictError extends Error {}
export class DevAgreementMergeError extends Error {}

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
      assets: (existing.assets ?? []).map((asset) => ({
        ...asset,
        agreementDurationUnit:
          asset.agreementDurationUnit === "YEAR" ? "YEAR" : DEFAULT_AGREEMENT_DURATION_UNIT,
        agreementDurationValue:
          asset.agreementDurationValue ?? DEFAULT_AGREEMENT_DURATION_VALUE,
        agreementStartDate: asset.agreementStartDate ?? null,
      })),
      tenants: existing.tenants ?? [],
      archivedAgreements: existing.archivedAgreements ?? [],
      dismissedAgreementRenewals: existing.dismissedAgreementRenewals ?? [],
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
          mandatoryDetailsApprovedAt: agreement.mandatoryDetailsApprovedAt ?? null,
          mergedIntoAgreementId: agreement.mergedIntoAgreementId ?? null,
          mergedOriginalStatus: agreement.mergedOriginalStatus ?? null,
          mergedOriginalStartDate: agreement.mergedOriginalStartDate ?? null,
          mergedOriginalEndDate: agreement.mergedOriginalEndDate ?? null,
          mergedOriginalAgreementYear: agreement.mergedOriginalAgreementYear ?? null,
          mergedOriginalMonthlyRent: agreement.mergedOriginalMonthlyRent ?? null,
          mergedOriginalSecurityDeposit: agreement.mergedOriginalSecurityDeposit ?? null,
          mergedOriginalOwnerApprovedAt: agreement.mergedOriginalOwnerApprovedAt ?? null,
          mergedOriginalTenantApprovedAt: agreement.mergedOriginalTenantApprovedAt ?? null,
          mergedOriginalMandatoryDetailsApprovedAt: agreement.mergedOriginalMandatoryDetailsApprovedAt ?? null,
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
        archivedAgreements: [],
        dismissedAgreementRenewals: [],
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
  agreementDetails?: {
    aadhaarNumber: string | null;
    fullAddress: string | null;
    addressLine1?: string | null;
    addressLine2?: string | null;
    district?: string | null;
    state?: string | null;
    city?: string | null;
    postalCode?: string | null;
    fatherName: string | null;
  },
) {
  return withStore(async (store) => {
    const owner = store.owners.find((entry) => entry.mobileNumber === mobileNumber);
    if (!owner) return null;
    const agreementDetailsChanged =
      owner.fullName !== fullName ||
      (agreementDetails !== undefined && (
        owner.aadhaarNumber !== agreementDetails.aadhaarNumber ||
        owner.fullAddress !== agreementDetails.fullAddress ||
        owner.addressLine1 !== agreementDetails.addressLine1 ||
        owner.addressLine2 !== agreementDetails.addressLine2 ||
        owner.district !== agreementDetails.district ||
        owner.state !== agreementDetails.state ||
        owner.city !== agreementDetails.city ||
        owner.postalCode !== agreementDetails.postalCode ||
        owner.fatherName !== agreementDetails.fatherName
      ));
    if (agreementDetailsChanged) {
      const ownerBuildingIds = new Set(
        store.buildings.filter((building) => building.ownerId === owner.id).map((building) => building.id),
      );
      const ownerAssetIds = new Set(
        store.assets.filter((asset) => ownerBuildingIds.has(asset.buildingId)).map((asset) => asset.id),
      );
      markDevAgreementsForReview(store, (agreement) =>
        ownerAssetIds.has(agreement.assetId) ||
        store.agreements.some(
          (member) => member.mergedIntoAgreementId === agreement.id && ownerAssetIds.has(member.assetId),
        ),
      );
    }
    owner.fullName = fullName;
    owner.email = email;
    for (const building of store.buildings) {
      if (building.ownerId === owner.id) building.ownerName = fullName;
    }
    if (agreementDetails) {
      owner.aadhaarNumber = agreementDetails.aadhaarNumber;
      owner.fullAddress = agreementDetails.fullAddress;
      owner.addressLine1 = agreementDetails.addressLine1;
      owner.addressLine2 = agreementDetails.addressLine2;
      owner.district = agreementDetails.district;
      owner.state = agreementDetails.state;
      owner.city = agreementDetails.city;
      owner.postalCode = agreementDetails.postalCode;
      owner.fatherName = agreementDetails.fatherName;
    }
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
    const agreements = store.agreements
      .filter(
        (entry) =>
          !entry.mergedIntoAgreementId &&
          (assetIds.has(entry.assetId) || tenantIds.has(entry.tenantId)),
      )
      .map((agreement) => ({
        ...agreement,
        agreementDurationUnit: assets.find((asset) => asset.id === agreement.assetId)?.agreementDurationUnit,
        agreementDurationValue: assets.find((asset) => asset.id === agreement.assetId)?.agreementDurationValue,
        mergedAssetIds: [...new Set(store.agreements
          .filter((entry) => entry.mergedIntoAgreementId === agreement.id)
          .map((entry) => entry.assetId))],
      }));
    const deletedAgreements = store.archivedAgreements.filter((entry) => entry.ownerId === owner.id);
    const assetsWithApprovedAdvance = assets.map((asset) => {
      const latestApprovedAgreement = agreements
        .filter((agreement) =>
          agreement.assetId === asset.id &&
          !agreement.mergedIntoAgreementId &&
          agreement.status === "ACTIVE" &&
          agreement.ownerApprovedAt !== null &&
          agreement.ownerApprovedAt !== undefined,
        )
        .sort((left, right) => {
          const yearDifference = right.agreementYear - left.agreementYear;
          if (yearDifference !== 0) return yearDifference;
          const leftApproved = left.ownerApprovedAt ? new Date(left.ownerApprovedAt).getTime() : 0;
          const rightApproved = right.ownerApprovedAt ? new Date(right.ownerApprovedAt).getTime() : 0;
          return rightApproved - leftApproved;
        })[0];
      return {
        ...asset,
        securityDeposit: latestApprovedAgreement?.securityDeposit ?? asset.securityDeposit,
      };
    });
    return { owner, companies, buildings, assets: assetsWithApprovedAdvance, tenants, agreements, deletedAgreements };
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

    const changed =
      asset.buildingId !== input.buildingId ||
      asset.name !== input.name ||
      asset.assetType !== input.assetType ||
      asset.unitNumber !== input.unitNumber ||
      asset.monthlyRent !== input.monthlyRent ||
      asset.securityDeposit !== input.securityDeposit ||
      asset.agreementDurationUnit !== input.agreementDurationUnit ||
      asset.agreementDurationValue !== input.agreementDurationValue ||
      asset.agreementStartDate !== input.agreementStartDate ||
      asset.externalBuildingId !== input.externalBuildingId ||
      asset.ward !== input.ward ||
      asset.roomNumber !== input.roomNumber ||
      asset.ksmartBuildingId !== input.ksmartBuildingId ||
      asset.ksrbId !== input.ksrbId;
    if (changed) {
      syncDevAgreementAmountsFromAssets(store, new Set([assetId]));
      markDevAgreementsForReview(store, (agreement) =>
        agreement.assetId === assetId ||
        store.agreements.some(
          (member) => member.mergedIntoAgreementId === agreement.id && member.assetId === assetId,
        ),
      );
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
      if (company.name !== input.name) {
        const buildingIds = new Set(
          store.buildings.filter((building) => building.companyId === company.id).map((building) => building.id),
        );
        const assetIds = new Set(
          store.assets.filter((asset) => buildingIds.has(asset.buildingId)).map((asset) => asset.id),
        );
        markDevAgreementsForReview(store, (agreement) =>
          assetIds.has(agreement.assetId) ||
          store.agreements.some(
            (member) => member.mergedIntoAgreementId === agreement.id && assetIds.has(member.assetId),
          ),
        );
      }
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
      const changed =
        building.name !== input.name ||
        building.address !== input.address ||
        building.city !== input.city ||
        building.state !== input.state ||
        building.postalCode !== input.postalCode ||
        building.panchayat !== input.panchayat ||
        building.companyId !== company.id;
      if (changed) {
        const buildingAssetIds = new Set(
          store.assets.filter((asset) => asset.buildingId === building.id).map((asset) => asset.id),
        );
        markDevAgreementsForReview(store, (agreement) =>
          buildingAssetIds.has(agreement.assetId) ||
          store.agreements.some(
            (member) => member.mergedIntoAgreementId === agreement.id && buildingAssetIds.has(member.assetId),
          ),
        );
      }
      Object.assign(building, {
        companyId: company.id,
        name: input.name ?? building.name,
        address: input.address ?? building.address,
        city: input.city ?? building.city,
        state: input.state ?? building.state,
        postalCode: input.postalCode ?? building.postalCode,
        panchayat: input.panchayat ?? building.panchayat ?? null,
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
    const changed =
      tenant.fullName !== input.fullName ||
      tenant.mobileNumber !== mobileNumber ||
      tenant.businessName !== input.businessName ||
      tenant.businessNature !== input.businessNature ||
      tenant.fullAddress !== input.fullAddress ||
      tenant.addressLine1 !== input.addressLine1 ||
      tenant.addressLine2 !== input.addressLine2 ||
      tenant.district !== input.district ||
      tenant.state !== input.state ||
      tenant.city !== input.city ||
      tenant.postalCode !== input.postalCode ||
      tenant.aadhaarNumber !== input.aadhaarNumber ||
      tenant.fatherName !== input.fatherName ||
      tenant.email !== input.email ||
      tenant.photoDataUrl !== input.photoDataUrl;
    if (changed) {
      markDevAgreementsForReview(store, (agreement) => agreement.tenantId === tenant.id);
    }
    tenant.fullName = input.fullName ?? tenant.fullName;
    tenant.mobileNumber = mobileNumber;
    tenant.businessName = input.businessName;
    tenant.businessNature = input.businessNature;
    tenant.fullAddress = input.fullAddress;
    tenant.addressLine1 = input.addressLine1;
    tenant.addressLine2 = input.addressLine2;
    tenant.district = input.district;
    tenant.state = input.state;
    tenant.city = input.city;
    tenant.postalCode = input.postalCode;
    tenant.aadhaarNumber = input.aadhaarNumber;
    tenant.fatherName = input.fatherName;
    tenant.email = input.email;
    tenant.photoDataUrl = input.photoDataUrl;
    tenant.updatedAt = now;
    await writeStore(store);
    return tenant;
  });
}

export function resetDevTenantDetails(ownerMobile: string, id: string) {
  return withStore(async (store) => {
    const owner = store.owners.find((entry) => entry.mobileNumber === ownerMobile);
    if (!owner) throw new Error("Owner account was not found.");
    const tenant = store.tenants.find((entry) => entry.id === id && entry.ownerId === owner.id);
    if (!tenant) return false;

    Object.assign(tenant, {
      mobileNumber: null,
      businessName: null,
      businessNature: null,
      fullAddress: null,
      addressLine1: null,
      addressLine2: null,
      district: null,
      state: null,
      city: null,
      postalCode: null,
      aadhaarNumber: null,
      fatherName: null,
      email: null,
      photoDataUrl: null,
      updatedAt: new Date().toISOString(),
    });
    markDevAgreementsForReview(store, (agreement) => agreement.tenantId === tenant.id);
    await writeStore(store);
    return true;
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
      const buildingCount = store.buildings.filter((entry) => entry.companyId === id).length;
      if (buildingCount) {
        throw new DevPortfolioConflictError(
          `This company has ${buildingCount} ${buildingCount === 1 ? "property" : "properties"}. Move or delete them before deleting the company.`,
        );
      }
      store.companies = store.companies.filter((entry) => entry.id !== id);
    } else if (kind === "building") {
      const building = store.buildings.find((entry) => entry.id === id && entry.ownerId === owner.id);
      if (!building) throw new Error("Property not found in your account.");
      const assetCount = store.assets.filter((entry) => entry.buildingId === id).length;
      if (assetCount) {
        throw new DevPortfolioConflictError(
          `This property has ${assetCount} ${assetCount === 1 ? "unit" : "units"}. Delete its units before deleting the property.`,
        );
      }
      store.buildings = store.buildings.filter((entry) => entry.id !== id);
    } else if (kind === "asset") {
      const asset = store.assets.find((entry) => entry.id === id);
      const building = store.buildings.find((entry) => entry.id === asset?.buildingId);
      if (!asset || building?.ownerId !== owner.id) throw new Error("Unit not found in your account.");
      const agreementCount = store.agreements.filter((entry) => entry.assetId === id).length;
      if (agreementCount) {
        throw new DevPortfolioConflictError(
          `This unit has ${agreementCount} agreement ${agreementCount === 1 ? "record" : "records"}. Archive all associated agreements first; their history remains available in Deleted agreements.`,
        );
      }
      const assignedTenantCount = store.tenants.filter((entry) => entry.assetIds.includes(id)).length;
      if (assignedTenantCount) {
        throw new DevPortfolioConflictError(
          `This unit has ${assignedTenantCount} assigned ${assignedTenantCount === 1 ? "tenant" : "tenants"}. Delete the assigned tenant records first, then delete the unit.`,
        );
      }
      store.assets = store.assets.filter((entry) => entry.id !== id);
      for (const tenant of store.tenants) tenant.assetIds = tenant.assetIds.filter((assetId) => assetId !== id);
    } else if (kind === "tenant") {
      const tenant = store.tenants.find((entry) => entry.id === id && entry.ownerId === owner.id);
      if (!tenant) throw new Error("Tenant not found in your account.");
      const agreementCount = store.agreements.filter((entry) => entry.tenantId === id).length;
      if (agreementCount) {
        throw new DevPortfolioConflictError(
          `This tenant has ${agreementCount} agreement ${agreementCount === 1 ? "record" : "records"} and was not deleted. Archive those agreements first; their history remains available in Deleted agreements.`,
        );
      }
      store.tenants = store.tenants.filter((entry) => entry.id !== id);
    } else {
      const agreement = store.agreements.find((entry) => entry.id === id);
      const asset = store.assets.find((entry) => entry.id === agreement?.assetId);
      const building = store.buildings.find((entry) => entry.id === asset?.buildingId);
      if (!agreement || building?.ownerId !== owner.id) throw new Error("Agreement not found in your account.");
      const renewalKey = `${agreement.assetId}:${agreement.tenantId}:${agreement.agreementYear}`;
      if (!store.dismissedAgreementRenewals.includes(renewalKey)) {
        store.dismissedAgreementRenewals.push(renewalKey);
      }
      const tenant = store.tenants.find((entry) => entry.id === agreement.tenantId);
      if (!tenant || !asset || !building) throw new Error("Agreement links could not be archived.");
      store.archivedAgreements.unshift({
        ...agreement,
        ownerId: owner.id,
        tenantName: tenant.fullName,
        tenantMobileNumber: tenant.mobileNumber,
        assetName: asset.name,
        assetType: asset.assetType,
        unitNumber: asset.unitNumber,
        buildingName: building.name,
        buildingAddress: building.address,
        city: building.city,
        state: building.state,
        templateTerms: [],
        archivedAt: new Date().toISOString(),
      });
      store.agreements = store.agreements.filter((entry) => entry.id !== id);
    }

    await writeStore(store);
    return { success: true };
  });
}

export function deleteDevPortfolioItems(
  ownerMobile: string,
  kind: "company" | "building" | "asset" | "tenant" | "agreement",
  ids: string[],
) {
  return withStore(async (store) => {
    const owner = store.owners.find((entry) => entry.mobileNumber === ownerMobile);
    if (!owner) throw new Error("Owner account was not found.");

    const selectedIds = new Set(ids);
    if (kind === "company") {
      const records = store.companies.filter(
        (entry) => selectedIds.has(entry.id) && entry.ownerId === owner.id,
      );
      if (records.length !== selectedIds.size) throw new Error("One or more companies were not found in your account.");
      const blocked = records
        .map((company) => store.buildings.filter((building) => building.companyId === company.id).length)
        .find((count) => count > 0);
      if (blocked) {
        throw new DevPortfolioConflictError("Selected companies contain properties. Delete those properties first.");
      }
      store.companies = store.companies.filter((entry) => !selectedIds.has(entry.id));
    } else if (kind === "building") {
      const records = store.buildings.filter(
        (entry) => selectedIds.has(entry.id) && entry.ownerId === owner.id,
      );
      if (records.length !== selectedIds.size) throw new Error("One or more properties were not found in your account.");
      const blocked = records
        .map((building) => store.assets.filter((asset) => asset.buildingId === building.id).length)
        .find((count) => count > 0);
      if (blocked) {
        throw new DevPortfolioConflictError("Selected properties contain units. Delete those units first.");
      }
      store.buildings = store.buildings.filter((entry) => !selectedIds.has(entry.id));
    } else if (kind === "asset") {
      const records = store.assets.filter((asset) => {
        const building = store.buildings.find((entry) => entry.id === asset.buildingId);
        return selectedIds.has(asset.id) && building?.ownerId === owner.id;
      });
      if (records.length !== selectedIds.size) throw new Error("One or more units were not found in your account.");
      if (records.some((asset) =>
        store.agreements.some((agreement) => agreement.assetId === asset.id)
      )) {
        throw new DevPortfolioConflictError(
          "Selected units include agreements. Archive all associated agreements first; their history remains available in Deleted agreements.",
        );
      }
      if (records.some((asset) =>
        store.tenants.some((tenant) => tenant.assetIds.includes(asset.id))
      )) {
        throw new DevPortfolioConflictError("Selected units have assigned tenants. Delete or reassign those tenants first.");
      }
      store.assets = store.assets.filter((entry) => !selectedIds.has(entry.id));
      for (const tenant of store.tenants) {
        tenant.assetIds = tenant.assetIds.filter((assetId) => !selectedIds.has(assetId));
      }
    } else if (kind === "tenant") {
      const records = store.tenants.filter(
        (entry) => selectedIds.has(entry.id) && entry.ownerId === owner.id,
      );
      if (records.length !== selectedIds.size) throw new Error("One or more tenants were not found in your account.");
      if (records.some((tenant) =>
        store.agreements.some((agreement) => agreement.tenantId === tenant.id)
      )) {
        throw new DevPortfolioConflictError(
          "Selected tenants have agreements, so they were not deleted. Archive their agreements first; their history remains available in Deleted agreements.",
        );
      }
      store.tenants = store.tenants.filter((entry) => !selectedIds.has(entry.id));
    } else {
      const records = store.agreements.filter((agreement) => {
        const asset = store.assets.find((entry) => entry.id === agreement.assetId);
        const building = store.buildings.find((entry) => entry.id === asset?.buildingId);
        return selectedIds.has(agreement.id) && building?.ownerId === owner.id;
      });
      if (records.length !== selectedIds.size) throw new Error("One or more agreements were not found in your account.");
      for (const agreement of records) {
        const renewalKey = `${agreement.assetId}:${agreement.tenantId}:${agreement.agreementYear}`;
        if (!store.dismissedAgreementRenewals.includes(renewalKey)) {
          store.dismissedAgreementRenewals.push(renewalKey);
        }
        const tenant = store.tenants.find((entry) => entry.id === agreement.tenantId);
        const asset = store.assets.find((entry) => entry.id === agreement.assetId);
        const building = store.buildings.find((entry) => entry.id === asset?.buildingId);
        if (!tenant || !asset || !building) {
          throw new DevPortfolioConflictError("Agreement links could not be archived. No agreements were removed.");
        }
        store.archivedAgreements.unshift({
          ...agreement,
          ownerId: owner.id,
          tenantName: tenant.fullName,
          tenantMobileNumber: tenant.mobileNumber,
          assetName: asset.name,
          assetType: asset.assetType,
          unitNumber: asset.unitNumber,
          buildingName: building.name,
          buildingAddress: building.address,
          city: building.city,
          state: building.state,
          templateTerms: [],
          archivedAt: new Date().toISOString(),
        });
      }
      store.agreements = store.agreements.filter((entry) => !selectedIds.has(entry.id));
    }

    await writeStore(store);
    return { success: true, deletedCount: selectedIds.size };
  });
}

export class DevPortfolioConflictError extends Error {}

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
    if (!owner || !agreement || !asset || building?.ownerId !== owner.id) {
      throw new Error("Agreement not found in your account.");
    }
    if (agreement.status !== "DRAFT" && agreement.status !== "ACTIVE") {
      throw new Error("Only draft or active agreements can be edited and re-approved.");
    }
    if (
      !hasValidAgreementDurationTerm(
        input.startDate,
        input.endDate,
        asset.agreementDurationUnit,
        asset.agreementDurationValue,
      )
    ) {
      throw new Error("The end date must match the duration configured for this asset.");
    }
    const agreementYear = Number(input.startDate.slice(0, 4));
    if (
      store.agreements.some(
        (entry) =>
          entry.id !== agreementId &&
          entry.assetId === agreement.assetId &&
          entry.tenantId === agreement.tenantId &&
          entry.agreementYear === agreementYear &&
          entry.status !== "CANCELLED" &&
          !entry.mergedIntoAgreementId,
      )
    ) {
      throw new DevAgreementConflictError("An agreement already exists for this tenant, unit, and year.");
    }
    Object.assign(agreement, input, {
      agreementYear,
      status: "DRAFT",
      ownerApprovedAt: null,
      tenantApprovedAt: null,
      mandatoryDetailsApprovedAt: null,
    });
    await writeStore(store);
    return agreement;
  });
}

export function createDevTenant(
  ownerMobile: string,
  assetId: string | null,
  fullName: string,
  mobileNumber: string | null,
  startDate: string | null,
  kyc: {
    businessName: string | null;
    businessNature: string | null;
    fullAddress: string | null;
    addressLine1: string | null;
    addressLine2: string | null;
    district: string | null;
    state: string | null;
    city: string | null;
    postalCode: string | null;
    aadhaarNumber: string | null;
    fatherName: string | null;
    email: string | null;
    photoDataUrl: string | null;
  },
) {
  return withStore(async (store) => {
    const owner = store.owners.find((entry) => entry.mobileNumber === ownerMobile);
    const asset = assetId ? store.assets.find((entry) => entry.id === assetId) : null;
    const building = store.buildings.find((entry) => entry.id === asset?.buildingId);
    if (!owner || (assetId && (!asset || !building || building.ownerId !== owner.id))) {
      throw new Error("Asset not found in your account.");
    }
    if (assetId && store.tenants.some((entry) => entry.assetIds.includes(assetId))) {
      throw new DevAgreementConflictError("This unit is already assigned to a tenant.");
    }
    const endDate = startDate
      ? addAgreementDuration(
          startDate,
          asset?.agreementDurationUnit ?? DEFAULT_AGREEMENT_DURATION_UNIT,
          asset?.agreementDurationValue ?? DEFAULT_AGREEMENT_DURATION_VALUE,
        )
      : null;
    if (startDate && !endDate) throw new Error("Choose a valid agreement start date.");
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
        ...kyc,
        assetIds: [],
        createdAt: now,
        updatedAt: now,
      };
      store.tenants.push(tenant);
    } else if (tenant.ownerId !== owner.id) {
      throw new Error("This mobile number is already registered with a different owner.");
    } else {
      tenant.fullName = fullName;
      tenant.mobileNumber = mobileNumber;
      Object.assign(tenant, kyc);
      tenant.updatedAt = now;
    }
    if (!asset || !assetId || !startDate || !endDate) {
      await writeStore(store);
      return tenant;
    }
    const agreementYear = Number(startDate.slice(0, 4));
    if (
      store.agreements.some(
        (agreement) =>
          agreement.assetId === asset.id &&
          agreement.tenantId === tenant.id &&
          agreement.agreementYear === agreementYear &&
          agreement.status !== "CANCELLED" &&
          !agreement.mergedIntoAgreementId,
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
    const renewalTerm = getRenewalAgreementTerm(
      startDate,
      endDate,
      new Date(),
      asset.agreementDurationUnit,
      asset.agreementDurationValue,
    );
    if (
      renewalTerm &&
      !store.agreements.some(
        (agreement) =>
          agreement.assetId === asset.id &&
          agreement.tenantId === tenant.id &&
          agreement.agreementYear === renewalTerm.year &&
          agreement.status !== "CANCELLED" &&
          !agreement.mergedIntoAgreementId,
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
      !hasValidAgreementDurationTerm(
        input.startDate,
        input.endDate,
        asset.agreementDurationUnit,
        asset.agreementDurationValue,
      )
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
          agreement.agreementYear === agreementYear &&
          agreement.status !== "CANCELLED" &&
          !agreement.mergedIntoAgreementId,
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
  ownerFullName: string;
  ownerAadhaarNumber: string;
  ownerFullAddress: string;
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
  tenantFullAddress: string;
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

export async function reviewDevAgreement(
  ownerMobile: string,
  agreementId: string,
  input: AgreementReviewInput,
) {
  return withStore(async (store) => {
    const owner = store.owners.find((entry) => entry.mobileNumber === ownerMobile);
    const agreement = store.agreements.find((entry) => entry.id === agreementId);
    if (!agreement || (agreement.status !== "DRAFT" && agreement.status !== "ACTIVE")) return null;
    const asset = store.assets.find((entry) => entry.id === agreement.assetId);
    const building = store.buildings.find((entry) => entry.id === asset?.buildingId);
    const company = store.companies.find((entry) => entry.id === building?.companyId);
    if (!owner || !asset || !building || (company?.ownerId ?? building.ownerId) !== owner.id) return null;

    if (
      !hasValidAgreementDurationTerm(
        input.startDate,
        input.endDate,
        asset.agreementDurationUnit,
        asset.agreementDurationValue,
      ) ||
      !Number.isInteger(input.monthlyRent) ||
      input.monthlyRent <= 0 ||
      !Number.isInteger(input.securityDeposit) ||
      input.securityDeposit < 0
    ) {
      throw new Error("Enter valid agreement dates, monthly rent, and security deposit.");
    }
    const tenant = store.tenants.find((entry) => entry.id === agreement.tenantId);
    if (!tenant) throw new Error("Tenant not found in this agreement.");
    if (store.tenants.some((entry) => entry.id !== tenant.id && entry.mobileNumber === input.tenantMobileNumber)) {
      throw new DevAgreementConflictError("This tenant mobile number is already registered.");
    }
    const agreementYear = Number(input.startDate.slice(0, 4));
    const mergedMembers = store.agreements.filter(
      (entry) => entry.mergedIntoAgreementId === agreement.id,
    );
    const groupedAgreements = [agreement, ...mergedMembers];
    const groupedIds = new Set(groupedAgreements.map((entry) => entry.id));
    const groupedAssetIds = new Set(groupedAgreements.map((entry) => entry.assetId));
    if (
      mergedMembers.some((member) => {
        const memberAsset = store.assets.find((entry) => entry.id === member.assetId);
        return !memberAsset || !hasValidAgreementDurationTerm(
          input.startDate,
          input.endDate,
          memberAsset.agreementDurationUnit,
          memberAsset.agreementDurationValue,
        );
      })
    ) {
      throw new Error("The agreement dates must match the configured duration for every included unit.");
    }
    if (
      store.agreements.some(
        (entry) =>
          !groupedIds.has(entry.id) &&
          groupedAssetIds.has(entry.assetId) &&
          entry.tenantId === agreement.tenantId &&
          entry.agreementYear === agreementYear &&
          entry.status !== "CANCELLED" &&
          !entry.mergedIntoAgreementId,
      )
    ) {
      throw new DevAgreementConflictError(
        "An agreement already exists for this tenant, asset, and year.",
      );
    }
    if (
      store.agreements.some(
        (entry) =>
          !groupedIds.has(entry.id) &&
          [...groupedAssetIds].some((assetId) =>
            agreementOverlaps(entry, assetId, input.startDate, input.endDate),
          ),
      )
    ) {
      throw new DevAgreementConflictError("This asset already has an active agreement for those dates.");
    }
    const updatedAgreement: DevAgreement = {
      ...agreement,
      startDate: input.startDate,
      endDate: input.endDate,
      agreementYear,
      monthlyRent: input.monthlyRent,
      securityDeposit: input.securityDeposit,
      terms: agreement.terms,
      importantTerms: agreement.importantTerms ?? "",
      status: "ACTIVE",
      ownerApprovedAt: new Date().toISOString(),
      tenantApprovedAt: null,
      mandatoryDetailsApprovedAt: new Date().toISOString(),
    };
    Object.assign(owner, {
      fullName: input.ownerFullName,
      aadhaarNumber: input.ownerAadhaarNumber,
      fullAddress: input.ownerFullAddress,
      addressLine1: input.ownerAddressLine1,
      addressLine2: input.ownerAddressLine2 || null,
      district: input.ownerDistrict,
      state: input.ownerState,
      city: input.ownerCity,
      postalCode: input.ownerPostalCode,
      fatherName: input.ownerFatherName,
      updatedAt: new Date().toISOString(),
    });
    building.ownerName = input.ownerFullName;
    Object.assign(tenant, {
      fullName: input.tenantFullName,
      mobileNumber: input.tenantMobileNumber,
      businessName: input.tenantBusinessName,
      businessNature: input.tenantBusinessNature,
      fullAddress: input.tenantFullAddress,
      addressLine1: input.tenantAddressLine1,
      addressLine2: input.tenantAddressLine2 || null,
      district: input.tenantDistrict,
      state: input.tenantState,
      city: input.tenantCity,
      postalCode: input.tenantPostalCode,
      aadhaarNumber: input.tenantAadhaarNumber,
      updatedAt: new Date().toISOString(),
    });
    Object.assign(building, {
      address: input.buildingAddress,
      city: input.buildingCity,
      state: input.buildingState,
      postalCode: input.buildingPostalCode,
      panchayat: input.buildingPanchayat,
      updatedAt: new Date().toISOString(),
    });
    Object.assign(asset, {
      ward: input.assetWard,
      roomNumber: input.assetRoomNumber,
      updatedAt: new Date().toISOString(),
    });
    Object.assign(agreement, updatedAgreement);
    const latestApprovedAgreement = store.agreements
      .filter((entry) =>
        entry.assetId === asset.id &&
        entry.status === "ACTIVE" &&
        !entry.mergedIntoAgreementId &&
        entry.ownerApprovedAt !== null &&
        entry.ownerApprovedAt !== undefined,
      )
      .sort((left, right) => {
        const yearDifference = right.agreementYear - left.agreementYear;
        if (yearDifference !== 0) return yearDifference;
        const leftApproved = left.ownerApprovedAt ? new Date(left.ownerApprovedAt).getTime() : 0;
        const rightApproved = right.ownerApprovedAt ? new Date(right.ownerApprovedAt).getTime() : 0;
        return rightApproved - leftApproved;
      })[0];
    if (mergedMembers.length === 0) {
      asset.securityDeposit = latestApprovedAgreement?.securityDeposit ?? input.securityDeposit;
    }
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
          asset.agreementDurationUnit,
          asset.agreementDurationValue,
        );
        if (!term) continue;
        if (
          tenantAgreements.some((agreement) => agreement.agreementYear === term.year)
        ) {
          continue;
        }
        const renewalKey = `${assetId}:${tenant.id}:${term.year}`;
        if (store.dismissedAgreementRenewals.includes(renewalKey)) continue;
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
    if (!agreement || agreement.mergedIntoAgreementId) return null;
    const asset = store.assets.find((entry) => entry.id === agreement.assetId);
    const building = store.buildings.find((entry) => entry.id === asset?.buildingId);
    const company = store.companies.find((entry) => entry.id === building?.companyId);
    const isOwned =
      building?.ownerId === owner.id ||
      (company?.ownerId === owner.id && building?.companyId === company.id);
    const tenant = store.tenants.find((entry) => entry.id === agreement.tenantId);
    if (!isOwned || !asset || !building || !tenant) return null;
    const mergedMembers = store.agreements
      .filter((entry) => entry.mergedIntoAgreementId === agreement.id)
      .flatMap((member) => {
        const memberAsset = store.assets.find((entry) => entry.id === member.assetId);
        const memberBuilding = store.buildings.find((entry) => entry.id === memberAsset?.buildingId);
        if (!memberAsset || !memberBuilding) return [];
        return [{ agreement: member, asset: memberAsset, building: memberBuilding }];
      });
    return { owner, tenant, asset, building, agreement, mergedMembers };
  });
}

export function mergeDevAgreements(ownerMobile: string, agreementIds: string[]) {
  return withStore(async (store) => {
    const owner = store.owners.find((entry) => entry.mobileNumber === ownerMobile);
    if (!owner) throw new DevAgreementMergeError("Owner account was not found.");
    const ids = [...new Set(agreementIds)];
    if (ids.length < 2 || ids.length > 12) {
      throw new DevAgreementMergeError("Select between 2 and 12 agreements to merge.");
    }

    const agreements = ids.map((id) => store.agreements.find((entry) => entry.id === id));
    if (agreements.some((agreement) => !agreement)) {
      throw new DevAgreementMergeError("One or more agreements were not found.");
    }
    const records = agreements as DevAgreement[];
    const primary = records[0];
    const assetRecords = records.map((agreement) =>
      store.assets.find((entry) => entry.id === agreement.assetId),
    );
    const buildingRecords = assetRecords.map((asset) =>
      store.buildings.find((entry) => entry.id === asset?.buildingId),
    );
    const ownsBuilding = buildingRecords.map((building) => {
      const company = store.companies.find((entry) => entry.id === building?.companyId);
      return building?.ownerId === owner.id || company?.ownerId === owner.id;
    });

    if (
      records.some((agreement) => agreement.status !== "ACTIVE" && agreement.status !== "DRAFT") ||
      records.some((agreement) => agreement.mergedIntoAgreementId) ||
      store.agreements.some((agreement) => ids.includes(agreement.mergedIntoAgreementId ?? "")) ||
      records.some((agreement) => agreement.tenantId !== primary.tenantId) ||
      assetRecords.some((asset) => !asset) ||
      buildingRecords.some((building) => !building) ||
      ownsBuilding.some((isOwned) => !isOwned) ||
      assetRecords.some((asset) => asset?.buildingId !== assetRecords[0]?.buildingId) ||
      assetRecords.some((asset) =>
        !store.tenants.some((tenant) =>
          tenant.id === primary.tenantId && tenant.assetIds.includes(asset?.id ?? ""),
        ),
      ) ||
      new Set(records.map((agreement) => agreement.assetId)).size !== records.length
    ) {
      throw new DevAgreementMergeError(
        "Select one unmerged agreement per asset. Agreements must belong to the same tenant and building before creating a combined agreement.",
      );
    }

    const selectedIds = new Set(ids);
    const selectedAssetIds = new Set(records.map((agreement) => agreement.assetId));
    if (
      store.agreements.some(
        (agreement) =>
          !selectedIds.has(agreement.id) &&
          agreement.status === "ACTIVE" &&
          selectedAssetIds.has(agreement.assetId) &&
          agreement.startDate.slice(0, 10) <= primary.endDate.slice(0, 10) &&
          agreement.endDate.slice(0, 10) >= primary.startDate.slice(0, 10),
      )
    ) {
      throw new DevAgreementMergeError(
        "One of these units has another active agreement during this period. Resolve the overlap before merging.",
      );
    }

    const monthlyRent = records.reduce((total, agreement) => total + agreement.monthlyRent, 0);
    const securityDeposit = records.reduce((total, agreement) => total + agreement.securityDeposit, 0);
    if (!Number.isSafeInteger(monthlyRent) || !Number.isSafeInteger(securityDeposit)) {
      throw new DevAgreementMergeError("The combined rent or deposit exceeds the supported amount.");
    }

    const uniqueText = (values: Array<string | undefined>) =>
      [...new Set(values.map((value) => value?.trim()).filter((value): value is string => Boolean(value)))].join("\n");
    const mergedAgreement: DevAgreement = {
      id: randomUUID(),
      agreementNumber: `RS-${new Date().getFullYear()}-${randomUUID().slice(0, 8).toUpperCase()}`,
      assetId: primary.assetId,
      tenantId: primary.tenantId,
      startDate: primary.startDate,
      endDate: primary.endDate,
      agreementYear: primary.agreementYear,
      monthlyRent,
      securityDeposit,
      terms: uniqueText(records.map((entry) => entry.terms)),
      importantTerms: uniqueText(records.map((entry) => entry.importantTerms)),
      status: "DRAFT",
      createdAt: new Date().toISOString(),
    };
    for (const member of records) {
      member.mergedOriginalStatus = member.status === "ACTIVE" ? "ACTIVE" : "DRAFT";
      member.mergedOriginalStartDate = member.startDate;
      member.mergedOriginalEndDate = member.endDate;
      member.mergedOriginalAgreementYear = member.agreementYear;
      member.mergedOriginalMonthlyRent = member.monthlyRent;
      member.mergedOriginalSecurityDeposit = member.securityDeposit;
      member.mergedOriginalOwnerApprovedAt = member.ownerApprovedAt ?? null;
      member.mergedOriginalTenantApprovedAt = member.tenantApprovedAt ?? null;
      member.mergedOriginalMandatoryDetailsApprovedAt = member.mandatoryDetailsApprovedAt ?? null;
      member.status = "CANCELLED";
      member.mergedIntoAgreementId = mergedAgreement.id;
    }
    store.agreements.push(mergedAgreement);
    await writeStore(store);
    return mergedAgreement;
  });
}

export function splitDevAgreement(ownerMobile: string, agreementId: string) {
  return withStore(async (store) => {
    const owner = store.owners.find((entry) => entry.mobileNumber === ownerMobile);
    const agreement = store.agreements.find((entry) => entry.id === agreementId);
    const asset = store.assets.find((entry) => entry.id === agreement?.assetId);
    const building = store.buildings.find((entry) => entry.id === asset?.buildingId);
    const company = store.companies.find((entry) => entry.id === building?.companyId);
    if (
      !owner ||
      !agreement ||
      agreement.mergedIntoAgreementId ||
      !(building?.ownerId === owner.id || company?.ownerId === owner.id)
    ) {
      throw new DevAgreementMergeError("Merged agreement was not found in your account.");
    }
    const members = store.agreements.filter((entry) => entry.mergedIntoAgreementId === agreement.id);
    if (!members.length) {
      throw new DevAgreementMergeError("This agreement is not a merged agreement.");
    }
    const approvedAfterMerge =
      agreement.status === "ACTIVE" && Boolean(agreement.mandatoryDetailsApprovedAt);

    const freshCombinedAgreement = members.every(
      (member) =>
        member.mergedOriginalStatus &&
        member.mergedOriginalMonthlyRent !== null &&
        member.mergedOriginalMonthlyRent !== undefined &&
        member.mergedOriginalSecurityDeposit !== null &&
        member.mergedOriginalSecurityDeposit !== undefined,
    );
    if (freshCombinedAgreement) {
      agreement.status = "CANCELLED";
      for (const member of members) {
        member.startDate = member.mergedOriginalStartDate ?? member.startDate;
        member.endDate = member.mergedOriginalEndDate ?? member.endDate;
        member.agreementYear = member.mergedOriginalAgreementYear ?? member.agreementYear;
        member.monthlyRent = member.mergedOriginalMonthlyRent ?? member.monthlyRent;
        member.securityDeposit = member.mergedOriginalSecurityDeposit ?? member.securityDeposit;
        member.status = approvedAfterMerge ? "DRAFT" : member.mergedOriginalStatus ?? "DRAFT";
        member.ownerApprovedAt = approvedAfterMerge ? null : member.mergedOriginalOwnerApprovedAt ?? null;
        member.tenantApprovedAt = approvedAfterMerge ? null : member.mergedOriginalTenantApprovedAt ?? null;
        member.mandatoryDetailsApprovedAt = approvedAfterMerge
          ? null
          : member.mergedOriginalMandatoryDetailsApprovedAt ?? null;
        member.mergedIntoAgreementId = null;
        member.mergedOriginalStatus = null;
        member.mergedOriginalStartDate = null;
        member.mergedOriginalEndDate = null;
        member.mergedOriginalAgreementYear = null;
        member.mergedOriginalMonthlyRent = null;
        member.mergedOriginalSecurityDeposit = null;
        member.mergedOriginalOwnerApprovedAt = null;
        member.mergedOriginalTenantApprovedAt = null;
        member.mergedOriginalMandatoryDetailsApprovedAt = null;
      }
      await writeStore(store);
      return { agreement, splitCount: members.length };
    }

    if (!agreement.mergedOriginalStatus) {
      throw new DevAgreementMergeError("This agreement has incomplete merge data and cannot be split.");
    }
    agreement.monthlyRent = agreement.mergedOriginalMonthlyRent ?? agreement.monthlyRent;
    agreement.securityDeposit = agreement.mergedOriginalSecurityDeposit ?? agreement.securityDeposit;
    agreement.startDate = agreement.mergedOriginalStartDate ?? agreement.startDate;
    agreement.endDate = agreement.mergedOriginalEndDate ?? agreement.endDate;
    agreement.agreementYear = agreement.mergedOriginalAgreementYear ?? agreement.agreementYear;
    agreement.status = approvedAfterMerge ? "DRAFT"     : agreement.mergedOriginalStatus === "ACTIVE" ? "ACTIVE" : "DRAFT";
    agreement.ownerApprovedAt = approvedAfterMerge ? null : agreement.mergedOriginalOwnerApprovedAt ?? null;
    agreement.tenantApprovedAt = approvedAfterMerge ? null : agreement.mergedOriginalTenantApprovedAt ?? null;
    agreement.mandatoryDetailsApprovedAt = approvedAfterMerge
      ? null
      : agreement.mergedOriginalMandatoryDetailsApprovedAt ?? null;
    agreement.mergedOriginalStatus = null;
    agreement.mergedOriginalStartDate = null;
    agreement.mergedOriginalEndDate = null;
    agreement.mergedOriginalAgreementYear = null;
    agreement.mergedOriginalMonthlyRent = null;
    agreement.mergedOriginalSecurityDeposit = null;
    agreement.mergedOriginalOwnerApprovedAt = null;
    agreement.mergedOriginalTenantApprovedAt = null;
    agreement.mergedOriginalMandatoryDetailsApprovedAt = null;
    for (const member of members) {
      member.status = approvedAfterMerge
        ? "DRAFT"
        : member.mergedOriginalStatus ?? "DRAFT";
      member.ownerApprovedAt = approvedAfterMerge ? null : member.ownerApprovedAt ?? null;
      member.tenantApprovedAt = approvedAfterMerge ? null : member.tenantApprovedAt ?? null;
      member.mandatoryDetailsApprovedAt = approvedAfterMerge
        ? null
        : member.mandatoryDetailsApprovedAt ?? null;
      member.mergedIntoAgreementId = null;
      member.mergedOriginalStatus = null;
    }
    await writeStore(store);
    return { agreement, splitCount: members.length + 1 };
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
    const agreements = store.agreements
      .filter((entry) => entry.tenantId === tenant.id && !entry.mergedIntoAgreementId)
      .map((agreement) => ({
        ...agreement,
        mergedAssetIds: store.agreements
          .filter((entry) => entry.mergedIntoAgreementId === agreement.id)
          .map((entry) => entry.assetId),
      }));
    return { tenant, assets, buildings, agreements };
  });
}
