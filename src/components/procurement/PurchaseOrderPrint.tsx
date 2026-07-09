import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { purchaseOrderService } from "@/services/purchaseOrderService";
import { Button } from "@/components/ui/button";
import { Printer, ArrowLeft, Download } from "lucide-react";
import headerLogo from "@/assets/HEADERLOGO.png";
import { format } from "date-fns";
import { exportToExcel } from "@/lib/excelExport";

export const PurchaseOrderPrint = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();

    const { data: po, isLoading, error } = useQuery({
        queryKey: ["purchase-order", id],
        queryFn: () => purchaseOrderService.getPOById(id!),
        enabled: !!id,
    });

    const handlePrint = () => window.print();

    if (isLoading) return <div className="p-8 text-center">Loading Purchase Order...</div>;
    if (error || !po) return <div className="p-8 text-center text-red-600">Purchase Order not found.</div>;

    const totalAmount = po.purchase_order_items?.reduce((sum: number, item: any) => sum + (item.quantity * item.unitCost), 0) || 0;

    return (
        <div className="min-h-screen bg-gray-100 py-8 print:p-0 print:bg-white text-black">
            <div className="no-print fixed top-4 right-4 z-50 flex gap-2 pr-12">
                <Button onClick={() => {
                    if (po && po.purchase_order_items) {
                        const data = po.purchase_order_items.map((item: any, idx: number) => ({
                            "PO Number": po.poNumber,
                            "Supplier": po.suppliers?.name || "",
                            "Item No.": idx + 1,
                            "Description": item.description,
                            "Quantity": item.quantity,
                            "Unit": item.unit,
                            "Unit Cost": item.unitCost,
                            "Total Cost": item.quantity * item.unitCost
                        }));
                        exportToExcel(data, `PO_${po.poNumber}.xlsx`, 'Purchase Order');
                    }
                }} className="gap-2 shadow-lg bg-emerald-600 hover:bg-emerald-700 text-white">
                    <Download className="h-4 w-4" /> Export to Excel
                </Button>
                <Button onClick={handlePrint} className="gap-2 shadow-lg">
                    <Printer className="h-4 w-4" /> Print PO
                </Button>
                <Button variant="outline" onClick={() => navigate(-1)} className="gap-2 shadow-lg bg-white">
                    <ArrowLeft className="h-4 w-4" /> Back
                </Button>
            </div>

            <div
                className="mx-auto bg-white shadow-2xl print:shadow-none p-[10mm] w-[210mm] min-h-[297mm] border border-gray-300"
                style={{ fontFamily: "Arial, sans-serif", fontSize: "10pt", color: "black" }}
            >
                {/* Header Section */}
                <div className="mb-3 flex w-full justify-center overflow-hidden">
                    <img
                        src={headerLogo}
                        alt="Province of Apayao"
                        className="mx-auto block w-full h-[28mm] max-h-[28mm] object-fill object-bottom [object-position:center_bottom]"
                    />
                </div>

                {/* Purchase Order Title Bar */}
                <div className="bg-gray-200 border-y-2 border-black text-center py-2 mb-4">
                    <h1 className="text-2xl font-bold tracking-widest uppercase text-gray-700">Purchase Order</h1>
                </div>

                {/* Info Grid */}
                <div className="grid grid-cols-12 border-x border-t border-black">
                    <div className="col-span-7 border-r border-b border-black p-1 space-y-1">
                        <div className="flex gap-2">
                            <span className="font-bold w-20 text-[9pt] uppercase">Supplier:</span>
                            <span className="border-b border-gray-400 flex-1">{po.suppliers?.name}</span>
                        </div>
                        <div className="flex gap-2">
                            <span className="font-bold w-20 text-[9pt] uppercase">Address:</span>
                            <span className="border-b border-gray-400 flex-1">{po.suppliers?.address || "PUDTOL APAYAO"}</span>
                        </div>
                        <div className="flex gap-2">
                            <span className="font-bold w-20 text-[9pt] uppercase">Office:</span>
                            <span className="border-b border-gray-400 flex-1">{po.office || "PHO"}</span>
                        </div>
                        <div className="flex gap-2">
                            <span className="font-bold w-20 text-[9pt] uppercase">Purpose:</span>
                            <span className="border-b border-gray-400 flex-1">{po.purpose}</span>
                        </div>
                        <hr className="border-black mt-2" />
                        <div className="flex gap-2 mt-1">
                            <span className="font-bold w-20 text-[9pt] uppercase">ABC:</span>
                            <span className="border-b border-gray-400 flex-1 font-bold">
                                {po.abc?.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </span>
                        </div>
                    </div>
                    <div className="col-span-5 border-b border-black p-1 space-y-1">
                        <div className="flex justify-between gap-2">
                            <span className="font-bold text-[9pt] uppercase">P.O. Number:</span>
                            <span className="font-bold text-gray-700 border-b border-gray-400">{po.poNumber}</span>
                        </div>
                        <div className="flex justify-between gap-2">
                            <span className="font-bold text-[9pt] uppercase">P.O. Date:</span>
                            <span className="border-b border-gray-400">{format(new Date(po.poDate), "MM/dd/yyyy")}</span>
                        </div>
                        <div className="flex justify-between gap-2">
                            <span className="font-bold text-[9pt] uppercase">P.R. NO.:</span>
                            <span className="border-b border-gray-400">{po.prNumber || "2025-07-195-A"}</span>
                        </div>
                        <div className="flex justify-between gap-2">
                            <span className="font-bold text-[9pt] uppercase">Procurement Mode:</span>
                            <span className="border-b border-gray-400">{po.modeOfProcurement || "SVP"}</span>
                        </div>
                    </div>
                </div>

                <div className="border-x border-b border-black p-1 text-[8.5pt]">
                    <p>Gentlemen:</p>
                    <p className="ml-4">Please furnish this office the following articles subject to the terms and conditions contained herein.</p>
                </div>

                <div className="grid grid-cols-12 border-x border-b border-black text-[9pt]">
                    <div className="col-span-8 border-r border-black p-1">
                        <div className="flex gap-2">
                            <span className="font-bold uppercase">Date of Delivery:</span>
                            <span>{po.deliveryTerm || "10 DAYS UPON PO RECEIPT"}</span>
                        </div>
                    </div>
                    <div className="col-span-4 p-1">
                        <div className="flex gap-2">
                            <span className="font-bold uppercase">Delivery Term:</span>
                            <span className="uppercase italic">Complete</span>
                        </div>
                    </div>
                    <div className="col-span-8 border-r border-t border-black p-1">
                        <div className="flex gap-2">
                            <span className="font-bold uppercase">Place of Delivery:</span>
                            <span>{po.placeOfDelivery || "GSO"}</span>
                        </div>
                    </div>
                    <div className="col-span-4 border-t border-black p-1">
                        <div className="flex gap-2">
                            <span className="font-bold uppercase">Payment Term:</span>
                            <span className="uppercase italic">{po.paymentTerm || "ON ACCOUNT"}</span>
                        </div>
                    </div>
                </div>

                {/* Items Table */}
                <table className="w-full border-collapse border-x border-b border-black">
                    <thead className="bg-gray-100 uppercase text-[8pt] font-bold">
                        <tr className="border-b border-black">
                            <th className="border-r border-black p-1 w-12 text-center">Item No.</th>
                            <th className="border-r border-black p-1 w-12 text-center">Qty</th>
                            <th className="border-r border-black p-1 w-16 text-center">Unit</th>
                            <th className="border-r border-black p-1 text-center tracking-widest">Description</th>
                            <th className="border-r border-black p-1 w-24 text-center">Unit Cost</th>
                            <th className="p-1 w-32 text-center">Total Cost</th>
                        </tr>
                    </thead>
                    <tbody className="text-[9.5pt]">
                        {po.purchase_order_items?.map((item: any, idx: number) => (
                            <tr key={item.id} className="border-b border-black border-dashed">
                                <td className="border-r border-black p-1 text-center tabular-nums">{idx + 1}</td>
                                <td className="border-r border-black p-1 text-center tabular-nums">{item.quantity}</td>
                                <td className="border-r border-black p-1 text-center uppercase">{item.unit}</td>
                                <td className="border-r border-black p-2 uppercase font-medium">{item.description}</td>
                                <td className="border-r border-black p-1 text-right tabular-nums">{item.unitCost.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                                <td className="p-1 text-right tabular-nums">{(item.quantity * item.unitCost).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                            </tr>
                        ))}
                        {[...Array(Math.max(0, 15 - (po.purchase_order_items?.length || 0)))].map((_, i) => (
                            <tr key={`empty-${i}`} className="h-6 border-b border-black border-dashed opacity-25">
                                <td className="border-r border-black"></td>
                                <td className="border-r border-black"></td>
                                <td className="border-r border-black"></td>
                                <td className="border-r border-black"></td>
                                <td className="border-r border-black"></td>
                                <td></td>
                            </tr>
                        ))}
                    </tbody>
                    <tfoot>
                        <tr className="border-t border-black font-bold">
                            <td colSpan={5} className="border-r border-black p-0 h-1"></td>
                            <td className="p-1 text-right tabular-nums border-t-2 border-black border-double underline">
                                {totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </td>
                        </tr>
                    </tfoot>
                </table>

                {/* Penalty & Footer */}
                <div className="border-x border-b border-black p-1 text-[8.5pt] italic text-gray-700">
                    In case of failure to make full delivery within time specifies above, a penalty of one-tenth (1/10) of one percent for everyday or delay shall be imposed.
                </div>

                <div className="grid grid-cols-2 border-x border-b border-black min-h-[160px]">
                    {/* Conforme Section */}
                    <div className="p-2 border-r border-black flex flex-col justify-between">
                        <div>
                            <p className="font-bold mb-4">Conforme:</p>
                            <div className="mt-4 border-b border-black w-full h-10"></div>
                            <p className="text-[8pt] text-gray-600 mt-1">Signature over printed name</p>
                            <div className="mt-4 border-b border-black w-24 h-6 px-1 text-gray-300">Date</div>
                        </div>

                        <div className="mt-8 pt-4 border-t border-gray-300">
                            <p className="font-bold text-[8pt] uppercase mb-4">Fund Available:</p>
                            <div className="text-center mt-6">
                                <p className="font-bold text-center underline uppercase">Sherwin S. Agudelo</p>
                                <p className="text-[8pt]">Provincial Accountant</p>
                            </div>
                        </div>
                    </div>

                    {/* Governor Section */}
                    <div className="p-6 flex flex-col justify-between items-center text-center">
                        <div className="w-full">
                            <p className="font-bold text-sm underline uppercase">Elias C. Bulut Jr.</p>
                            <p className="text-[9pt]">Provincial Governor</p>
                        </div>

                        <div className="mt-10 w-full pt-4 border-t border-dashed border-gray-400">
                            <p className="text-[8pt] italic mb-6">By Authority of the Governor:</p>
                            <p className="font-bold text-sm underline uppercase">Arnold B. Castillo, EnP</p>
                            <p className="text-[8pt]">Provincial Administrator</p>
                        </div>

                        <div className="mt-8 w-full text-right pr-2 text-[9pt]">

                            <div className="flex justify-end gap-2 mt-1">
                                <span className="font-bold uppercase text-[8pt]">Amount:</span>
                                <span className="border-b border-black min-w-[120px] text-right font-bold">{totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="mt-2 text-[7pt] text-gray-400 text-right italic uppercase">
                    Province of Apayao - GSO - PO Form - 2026
                </div>
            </div>
        </div>
    );
};
