import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { purchaseOrderService } from "@/services/purchaseOrderService";
import { Button } from "@/components/ui/button";
import { Printer, ArrowLeft, CheckSquare, Square } from "lucide-react";
import headerLogo from "@/assets/HEADERLOGO.png";
import { format } from "date-fns";

export const IARPrint = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();

    const { data: iar, isLoading, error } = useQuery({
        queryKey: ["iar-report", id],
        queryFn: () => purchaseOrderService.getIARById(id!),
        enabled: !!id,
    });

    const handlePrint = () => window.print();

    if (isLoading) return <div className="p-8 text-center">Loading IAR...</div>;
    if (error || !iar) return <div className="p-8 text-center text-red-600">IAR not found.</div>;

    return (
        <div className="min-h-screen bg-gray-100 py-8 print:p-0 print:bg-white text-black">
            <div className="no-print fixed top-4 right-4 z-50 flex gap-2 pr-12">
                <Button onClick={handlePrint} className="gap-2 shadow-lg">
                    <Printer className="h-4 w-4" /> Print IAR
                </Button>
                <Button variant="outline" onClick={() => navigate(-1)} className="gap-2 shadow-lg bg-white">
                    <ArrowLeft className="h-4 w-4" /> Back
                </Button>
            </div>

            <div
                className="mx-auto bg-white shadow-2xl print:shadow-none bg-white p-[15mm] w-[210mm] min-h-[297mm]"
                style={{ fontFamily: "'Times New Roman', serif", fontSize: "10pt" }}
            >
                {/* Header Logo */}
                <div className="w-full mb-6 text-center">
                    <img src={headerLogo} alt="Official Header" className="mx-auto" style={{ width: "100%", maxHeight: "100px", objectFit: "contain" }} />
                </div>

                <div className="text-center mb-6">
                    <h1 className="text-xl font-bold uppercase underline">Inspection and Acceptance Report</h1>
                </div>

                <div className="grid grid-cols-2 gap-0 border border-black mb-0">
                    <div className="p-2 border-r border-b border-black">
                        <p><span className="font-bold">Entity Name:</span> __________________________</p>
                    </div>
                    <div className="p-2 border-b border-black">
                        <p><span className="font-bold">Fund Cluster:</span> __________________________</p>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-0 border-x border-b border-black mb-6">
                    <div className="p-2 border-r border-black">
                        <p><span className="font-bold">Supplier:</span> {iar.purchase_orders?.suppliers?.name || "N/A"}</p>
                        <p><span className="font-bold">PO No./Date:</span> {iar.purchase_orders?.po_number} / {iar.purchase_orders?.po_date ? format(new Date(iar.purchase_orders.po_date), "MM-dd-yyyy") : "N/A"}</p>
                        <p><span className="font-bold">Requisitioning Office/Dept:</span> ________________</p>
                    </div>
                    <div className="p-2">
                        <p><span className="font-bold">IAR No. :</span> <span className="text-red-600 font-bold">{iar.iar_number}</span></p>
                        <p><span className="font-bold">Date :</span> {format(new Date(iar.iar_date), "MMMM dd, yyyy")}</p>
                        <p><span className="font-bold">Invoice No. / Date :</span> {iar.invoice_no || "N/A"} / {iar.invoice_date ? format(new Date(iar.invoice_date), "MM-dd-yyyy") : "N/A"}</p>
                    </div>
                </div>

                {/* Items Table */}
                <table className="w-full border-collapse border border-black mb-0">
                    <thead>
                        <tr className="bg-gray-50">
                            <th className="border border-black p-2 text-center w-16">Stock/ Property No.</th>
                            <th className="border border-black p-2 text-left">Description</th>
                            <th className="border border-black p-2 text-center w-16">Unit</th>
                            <th className="border border-black p-2 text-center w-16">Quantity</th>
                        </tr>
                    </thead>
                    <tbody>
                        {iar.iar_items?.map((item: any, idx: number) => (
                            <tr key={item.id} className="h-10">
                                <td className="border border-black p-2 text-center">{idx + 1}</td>
                                <td className="border border-black p-2 italic">{item.description}</td>
                                <td className="border border-black p-2 text-center">{item.unit}</td>
                                <td className="border border-black p-2 text-center font-bold">{item.quantity_received}</td>
                            </tr>
                        ))}
                        {[...Array(Math.max(0, 12 - (iar.iar_items?.length || 0)))].map((_, i) => (
                            <tr key={`empty-${i}`} className="h-10">
                                <td className="border border-black p-2"></td>
                                <td className="border border-black p-2"></td>
                                <td className="border border-black p-2"></td>
                                <td className="border border-black p-2"></td>
                            </tr>
                        ))}
                    </tbody>
                </table>

                {/* Inspection and Acceptance Section */}
                <div className="grid grid-cols-2 gap-0 border-x border-b border-black min-h-[250px]">
                    <div className="border-r border-black p-4">
                        <h3 className="font-bold text-base text-center mb-4 uppercase underline">Inspection</h3>
                        <div className="space-y-4 mb-8">
                            <div className="flex items-start gap-2">
                                <CheckSquare className="h-5 w-5 mt-0.5" />
                                <div>
                                    <p className="font-bold">Inspected, verified and found OK as to quantity and specifications</p>
                                </div>
                            </div>
                        </div>

                        <div className="mt-12 text-center">
                            <div className="w-full border-b border-black font-bold uppercase underline">
                                {iar.inspection_officer || "__________________________"}
                            </div>
                            <p className="text-xs font-bold uppercase mt-1">Inspection Officer/Committee Chairperson</p>

                            <div className="mt-6 w-full border-b border-black font-bold uppercase">
                                __________________________
                            </div>
                            <p className="text-xs font-bold uppercase mt-1">Member</p>
                        </div>
                    </div>

                    <div className="p-4">
                        <h3 className="font-bold text-base text-center mb-4 uppercase underline">Acceptance</h3>
                        <div className="space-y-4 mb-2">
                            <div className="flex items-start gap-2">
                                {iar.status === 'Accepted' ? <CheckSquare className="h-5 w-5 mt-0.5" /> : <Square className="h-5 w-5 mt-0.5" />}
                                <div>
                                    <p className="font-bold">Complete</p>
                                </div>
                            </div>
                            <div className="flex items-start gap-2">
                                {iar.status === 'Partial' ? <CheckSquare className="h-5 w-5 mt-0.5" /> : <Square className="h-5 w-5 mt-0.5" />}
                                <div>
                                    <p className="font-bold">Partial (specify quantity)</p>
                                    <p className="text-xs border-b border-black w-full h-4 mt-2"></p>
                                </div>
                            </div>
                        </div>

                        <div className="mt-12 text-center">
                            <div className="w-full border-b border-black font-bold uppercase underline">
                                {iar.acceptance_officer || "__________________________"}
                            </div>
                            <p className="text-xs font-bold uppercase mt-1">Property Officer / Authorized Representative</p>

                            <div className="mt-10 text-left">
                                <p><span className="font-bold">Date Received:</span> ___________________</p>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="text-[9pt] italic mt-4">
                    Note: This report shall be prepared for every delivery of property/supplies.
                </div>
            </div>
        </div>
    );
};
