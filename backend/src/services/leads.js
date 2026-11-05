export const leadStatuses = [
  "New",
  "Pending",
  "In Progress",
  "Completed",
  "Cancelled",
];

export const legacyLeadStatusMap = {
  Contacted: "Pending",
  Qualified: "In Progress",
  Converted: "Completed",
  Lost: "Cancelled",
};

export function normalizeLeadStatus(status) {
  return legacyLeadStatusMap[status] || status;
}
