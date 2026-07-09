export interface InventoryItem {
  id: string;
  propertyNumber: string;
  description: string;
  brand: string;
  model: string;
  serialNumber: string;
  entityName?: string;
  unitOfMeasure: string;
  quantity: number;
  unitCost: number;
  totalCost: number;
  dateAcquired: string;
  warrantyEndDate?: string;
  lifespanEndDate?: string;
  supplier: string;
  condition: 'Serviceable' | 'Unserviceable' | 'For Repair' | 'Lost' | 'Stolen' | 'Damaged' | 'Destroyed';
  fundSource: string;
  remarks?: string;
  lastInventoryDate?: string;
  semiExpandableCategory?: string; // Store the selected category from semi_expandable_categories lookup
  subCategory?: 'Small Value Expendable' | 'High Value Expendable';
  status: 'Active' | 'Transferred' | 'Disposed' | 'Missing';
  assignmentStatus?: 'Available' | 'Assigned';
  custodian?: string;
  custodianPosition?: string;
  assignedDate?: string;
  accountableOfficer?: string; // New
  icsNumber?: string; // New
  icsDate?: string; // New
  estimatedUsefulLife?: string; // User-defined text, e.g. "3 yrs", "5 years"
  hasPropertyCard?: boolean; // Flag to indicate if item has a property card
  createdAt: string;
  updatedAt: string;
}

export interface PropertyTransfer {
  id: string;
  itemId: string;
  fromCustodian: string;
  toCustodian: string;
  transferDate: string;
  reason: string;
  authorizedBy: string;
  status: 'Pending' | 'Approved' | 'Completed' | 'Cancelled';
  remarks?: string;
}

export interface PhysicalCount {
  id: string;
  itemId: string;
  countDate: string;
  expectedQuantity: number;
  actualQuantity: number;
  variance: number;
  countedBy: string;
  verifiedBy: string;
  remarks?: string;
}

export interface LossReport {
  id: string;
  itemId: string;
  lossType: 'Lost' | 'Stolen' | 'Damaged' | 'Destroyed';
  dateReported: string;
  dateOccurred: string;
  reportedBy: string;
  circumstances: string;
  estimatedValue: number;
  actionTaken?: string;
  status: 'Reported' | 'Under Investigation' | 'Resolved' | 'Written Off';
}

export interface CustodianSlip {
  id: string;
  custodian: string;
  position: string;
  office: string;
  items: InventoryItem[];
  dateIssued: string;
  issuedBy: string;
  receivedBy: string;
}