import { InventoryItem } from "./inventory";

export interface PurchaseOrder {
    id: string;
    poNumber: string;
    poDate: string;
    supplierId: string;
    modeOfProcurement?: string;
    placeOfDelivery?: string;
    deliveryTerm?: string;
    paymentTerm?: string;
    fundCluster?: string;
    fundSourceId?: string;
    orsBursNumber?: string;
    orsBursDate?: string;
    office?: string;
    purpose?: string;
    abc?: number;
    prNumber?: string;
    status: 'Pending' | 'Partial' | 'Received' | 'Cancelled';
    remarks?: string;
    createdAt?: string;
    updatedAt?: string;
    purchase_order_items?: PurchaseOrderItem[];
    suppliers?: { name: string; address?: string };
}

export interface PurchaseOrderItem {
    id: string;
    poId: string;
    description: string;
    quantity: number;
    unit: string;
    unitCost: number;
    totalCost: number;
    remarks?: string;
    quantityStocked?: number;
    inventoryItemIds?: string[];
    createdAt?: string;
    updatedAt?: string;
}

export interface IARReport {
    id: string;
    iarNumber: string;
    iarDate: string;
    poId?: string;
    invoiceNo?: string;
    invoiceDate?: string;
    deliveryReceiptNo?: string;
    deliveryReceiptDate?: string;
    inspectionDate?: string;
    acceptanceDate?: string;
    inspectionOfficer?: string;
    acceptanceOfficer?: string;
    status: 'Pending' | 'Accepted' | 'Rejected';
    inspectionRemarks?: string;
    acceptanceRemarks?: string;
    createdAt?: string;
    updatedAt?: string;
    iar_items?: IARItem[];
    purchase_orders?: { po_number: string };
}

export interface IARItem {
    id: string;
    iarId: string;
    poItemId?: string;
    description: string;
    quantityReceived: number;
    unit: string;
    unitCost: number;
    brand?: string;
    model?: string;
    serialNumber?: string;
    isAccepted: boolean;
    iarRemarks?: string;
    inventoryItemId?: string;
    createdAt?: string;
}
