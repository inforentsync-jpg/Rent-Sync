export type AgreementApprovalState = {
  ownerApprovedAt: Date | string | null;
  tenantApprovedAt: Date | string | null;
};

export function getNextAgreementApprovals(
  current: AgreementApprovalState,
  party: "OWNER" | "TENANT",
  hasChanges: boolean,
  approvedAt = new Date(),
): AgreementApprovalState {
  return {
    ownerApprovedAt:
      party === "OWNER"
        ? approvedAt
        : hasChanges
          ? null
          : current.ownerApprovedAt,
    tenantApprovedAt: party === "TENANT" ? approvedAt : null,
  };
}
