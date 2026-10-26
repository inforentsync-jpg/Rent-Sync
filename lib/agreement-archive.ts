type AgreementForArchive = {
  id: string;
  agreementNumber: string;
  agreementYear: number;
  startDate: Date;
  endDate: Date;
  monthlyRent: number;
  securityDeposit: number;
  terms: string;
  importantTerms: string;
  status: string;
  ownerApprovedAt: Date | null;
  tenantApprovedAt: Date | null;
  createdAt: Date;
  tenant: { fullName: string; mobileNumber: string | null };
  asset: {
    name: string;
    assetType: string;
    unitNumber: string;
    building: { name: string; address: string; city: string; state: string };
    termTemplates: Array<{
      template: {
        id: string;
        name: string;
        items: Array<{ id: string; position: number; text: string; importantObligation: boolean }>;
      };
    }>;
  };
};

export function buildArchivedAgreementData(ownerId: string, agreement: AgreementForArchive) {
  return {
    ownerId,
    originalAgreementId: agreement.id,
    agreementNumber: agreement.agreementNumber,
    agreementYear: agreement.agreementYear,
    startDate: agreement.startDate,
    endDate: agreement.endDate,
    monthlyRent: agreement.monthlyRent,
    securityDeposit: agreement.securityDeposit,
    terms: agreement.terms,
    importantTerms: agreement.importantTerms,
    status: agreement.status,
    ownerApprovedAt: agreement.ownerApprovedAt,
    tenantApprovedAt: agreement.tenantApprovedAt,
    tenantName: agreement.tenant.fullName,
    tenantMobileNumber: agreement.tenant.mobileNumber,
    assetName: agreement.asset.name,
    assetType: agreement.asset.assetType,
    unitNumber: agreement.asset.unitNumber,
    buildingName: agreement.asset.building.name,
    buildingAddress: agreement.asset.building.address,
    city: agreement.asset.building.city,
    state: agreement.asset.building.state,
    templateTerms: JSON.stringify(agreement.asset.termTemplates.map(({ template }) => ({
      templateId: template.id,
      heading: template.name,
      items: template.items.map(({ id, position, text, importantObligation }) => ({
        id,
        position,
        text,
        importantObligation,
      })),
    }))),
    createdAt: agreement.createdAt,
  };
}
