// =====================================================

// Weekly Property Report Print Component

// Annex A.7 - Report of Semi-Expendable Property Issued

// =====================================================



import { createPortal } from "react-dom";

import { useParams } from "react-router-dom";

import { useQuery } from "@tanstack/react-query";

import { weeklyPropertyReportService } from "@/services/weeklyPropertyReportService";

import { Button } from "@/components/ui/button";

import { Printer } from "lucide-react";

import { PrintDocumentLayout, PrintLayoutHint } from "@/components/print/PrintDocumentLayout";

import { printDocument } from "@/lib/printDocument";

import { PRINT_LAYOUT } from "@/lib/printLayouts";

import headerLogo from "@/assets/HEADERLOGO.png";



export const WeeklyPropertyReportPrint = () => {

    const { id } = useParams<{ id: string }>();



    const { data: report, isLoading, error } = useQuery({

        queryKey: ["weekly-report", id],

        queryFn: () => weeklyPropertyReportService.getById(id!),

        enabled: !!id,

    });



    const handlePrint = () => printDocument(PRINT_LAYOUT.LONG_BOND_PORTRAIT_ZERO);



    const fmtDate = (d?: string) => {

        if (!d) return "";

        return new Date(d).toLocaleDateString("en-PH", {

            year: "numeric",

            month: "long",

            day: "numeric",

        });

    };



    const fmtMonthRange = (start?: string, end?: string) => {

        if (!start || !end) return "";

        const s = new Date(start);

        const e = new Date(end);

        const monthName = s.toLocaleString("en-PH", { month: "long" });

        return `${monthName} ${s.getDate()} to ${e.getDate()}, ${s.getFullYear()}`;

    };



    const fmtCurrency = (n?: number) =>

        n != null ? n.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "";



    if (isLoading) return <div className="p-8 text-center">Loading report…</div>;

    if (error || !report) return <div className="p-8 text-center text-red-600">Report not found.</div>;



    const reportBody = (

        <div

            id="rspi-print-area"
            data-print-root
            className="print-doc-longbond-portrait-zero mx-auto bg-white shadow-2xl print:shadow-none print:w-full print:max-w-none print:m-0"

            style={{

                fontFamily: "'Times New Roman', serif",

                fontSize: "8.5pt",

                padding: "8mm",

                width: "215.9mm",

                color: "#000",

            }}

        >

            <div style={{ textAlign: "right", marginBottom: "2px", fontSize: "8pt", fontStyle: "italic" }}>

                Annex A.7

            </div>



            <div style={{ width: "100%", marginBottom: "6px" }}>

                <img

                    src={headerLogo}

                    alt="Official Header"

                    className="block w-full max-h-[26mm] object-fill object-bottom"

                />

            </div>



            <div style={{ textAlign: "center", marginBottom: "10px" }}>

                <div style={{ fontWeight: "bold", fontSize: "14pt", textTransform: "uppercase", letterSpacing: "1px" }}>

                    Report of Semi-Expendable Property Issued

                </div>

            </div>



            <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "10px", fontSize: "10pt" }}>

                <tbody>

                    <tr>

                        <td style={{ width: "65%", paddingBottom: "6px" }}>

                            <div style={{ display: "flex", alignItems: "baseline", gap: "5px" }}>

                                <span style={{ fontWeight: "bold", whiteSpace: "nowrap" }}>Entity Name:</span>

                                <div style={{ flex: 1, borderBottom: "1px solid #000", paddingLeft: "5px", fontWeight: "bold", textTransform: "uppercase" }}>

                                    {report.entity_name}

                                </div>

                            </div>

                        </td>

                        <td style={{ paddingBottom: "6px" }}>

                            <div style={{ display: "flex", alignItems: "baseline", gap: "5px", justifyContent: "flex-end" }}>

                                <span style={{ fontWeight: "bold", whiteSpace: "nowrap" }}>Serial No.:</span>

                                <div style={{ minWidth: "150px", borderBottom: "1px solid #000", paddingLeft: "5px", fontWeight: "bold" }}>

                                    {report.serial_number}

                                </div>

                            </div>

                        </td>

                    </tr>

                    <tr>

                        <td style={{ paddingBottom: "6px" }}>

                            <div style={{ display: "flex", alignItems: "baseline", gap: "5px" }}>

                                <span style={{ fontWeight: "bold", whiteSpace: "nowrap" }}>Fund Cluster:</span>

                                <div style={{ flex: 1, borderBottom: "1px solid #000", paddingLeft: "5px", fontWeight: "bold" }}>

                                    {report.fund_cluster?.split(" - ")[0] || ""}

                                </div>

                            </div>

                        </td>

                        <td style={{ paddingBottom: "6px" }}>

                            <div style={{ display: "flex", alignItems: "baseline", gap: "5px", justifyContent: "flex-end" }}>

                                <span style={{ fontWeight: "bold", whiteSpace: "nowrap" }}>Date:</span>

                                <div style={{ minWidth: "150px", borderBottom: "1px solid #000", paddingLeft: "5px", fontWeight: "bold" }}>

                                    {fmtMonthRange(report.period_start, report.period_end)}

                                </div>

                            </div>

                        </td>

                    </tr>

                </tbody>

            </table>



            <table

                style={{

                    width: "100%",

                    borderCollapse: "collapse",

                    fontSize: "8pt",

                }}

            >

                <thead>

                    <tr>

                        <th colSpan={6} style={{ border: "1px solid #000", padding: "2px 3px", fontSize: "7.5pt", textAlign: "left", fontWeight: "normal", fontStyle: "italic" }}>

                            To be filled out by the Property and/or Supply Division/Unit

                        </th>

                        <th colSpan={2} style={{ border: "1px solid #000", padding: "2px 3px", fontSize: "7.5pt", textAlign: "right", fontWeight: "normal", fontStyle: "italic" }}>

                            To be filled out by the Accounting Division/Unit

                        </th>

                    </tr>

                    <tr style={{ backgroundColor: "#f2f2f2" }}>

                        {[

                            { label: "ICS No.", width: "10%" },

                            { label: "Responsibility Center Code", width: "10%" },

                            { label: "Semi-expendable Property No.", width: "12%" },

                            { label: "Item Description", width: "28%" },

                            { label: "Unit", width: "5%" },

                            { label: "Qty Issued", width: "5%" },

                            { label: "Unit Cost", width: "15%" },

                            { label: "Amount", width: "15%" },

                        ].map((h) => (

                            <th

                                key={h.label}

                                style={{

                                    border: "1px solid #000",

                                    padding: "2px 1px",

                                    textAlign: "center",

                                    fontWeight: "bold",

                                    verticalAlign: "middle",

                                    lineHeight: "1.1",

                                    width: h.width,

                                    fontSize: "7.5pt",

                                }}

                            >

                                {h.label}

                            </th>

                        ))}

                    </tr>

                </thead>

                <tbody>

                    {(report.items || []).length === 0 ? (

                        <tr>

                            <td colSpan={8} style={{ border: "1px solid #000", padding: "20px", textAlign: "center", color: "#666", fontStyle: "italic" }}>

                                No semi-expendable property issued for this period.

                            </td>

                        </tr>

                    ) : (

                        report.items.map((item, i) => (

                            <tr key={i}>

                                <td style={{ border: "1px solid #000", padding: "2px 4px", textAlign: "center" }}>{item.ics_no}</td>

                                <td style={{ border: "1px solid #000", padding: "2px 4px", textAlign: "center" }}>

                                    {item.responsibility_center || ""}

                                </td>

                                <td style={{ border: "1px solid #000", padding: "2px 4px", textAlign: "center" }}>{item.property_no}</td>

                                <td style={{ border: "1px solid #000", padding: "2px 6px" }}>{item.description}</td>

                                <td style={{ border: "1px solid #000", padding: "2px 4px", textAlign: "center" }}>{item.unit}</td>

                                <td style={{ border: "1px solid #000", padding: "2px 4px", textAlign: "center" }}>{item.qty_issued}</td>

                                <td style={{ border: "1px solid #000", padding: "2px 4px", textAlign: "right" }}>

                                    {fmtCurrency(item.unit_cost)}

                                </td>

                                <td style={{ border: "1px solid #000", padding: "2px 4px", textAlign: "right" }}>

                                    {fmtCurrency(item.amount)}

                                </td>

                            </tr>

                        ))

                    )}

                    {(report.items || []).length < 15 &&

                        Array.from({ length: Math.max(0, 15 - (report.items || []).length) }).map((_, i) => (

                            <tr key={`filler-${i}`}>

                                {Array.from({ length: 8 }).map((__, j) => (

                                    <td key={`filler-cell-${j}`} style={{ border: "1px solid #000", height: "16px" }}>

                                        &nbsp;

                                    </td>

                                ))}

                            </tr>

                        ))}

                </tbody>

                <tfoot>

                    <tr style={{ fontWeight: "bold" }}>

                        <td colSpan={7} style={{ border: "1px solid #000", padding: "2px 4px", textAlign: "right", fontSize: "9pt" }}>

                            TOTAL

                        </td>

                        <td style={{ border: "1px solid #000", padding: "2px 4px", textAlign: "right", fontSize: "8.5pt" }}>

                            {fmtCurrency((report.items || []).reduce((s, i) => s + (i.amount || 0), 0))}

                        </td>

                    </tr>

                    <tr>

                        <td colSpan={6} style={{ border: "1px solid #000", padding: "4px 6px", verticalAlign: "top", fontSize: "9pt" }}>

                            <div style={{ marginBottom: "5px" }}>I hereby certify to the correctness of the above information.</div>

                            <div style={{ textAlign: "center", marginTop: "35px" }}>

                                <div style={{ display: "inline-block", minWidth: "200px" }}>

                                    <div style={{ fontWeight: "bold", textTransform: "uppercase", fontSize: "10pt", borderBottom: "1px solid #000", paddingBottom: "2px", minHeight: "18px" }}>

                                        {report.certified_by_name || "CARLA MAY DANGAO"}

                                    </div>

                                    <div style={{ fontSize: "8pt", marginTop: "2px" }}>

                                        {report.certified_by_position || "PROPERTY OFFICER - GSO"}

                                    </div>

                                </div>

                            </div>

                        </td>

                        <td colSpan={2} style={{ border: "1px solid #000", padding: "4px 6px", verticalAlign: "top", fontSize: "9pt" }}>

                            <div style={{ marginBottom: "5px" }}>Posted by:</div>

                            <div style={{ textAlign: "center", marginTop: "35px" }}>

                                <div style={{ display: "inline-block", minWidth: "200px" }}>

                                    <div style={{ fontWeight: "bold", textTransform: "uppercase", fontSize: "10pt", borderBottom: "1px solid #000", paddingBottom: "2px", minHeight: "18px" }}>

                                        {report.posted_by_name || ""}

                                    </div>

                                    <div style={{ fontSize: "8pt", marginTop: "2px" }}>

                                        {report.posted_by_position || "Designated Accounting Staff"}

                                    </div>

                                </div>

                            </div>

                        </td>

                    </tr>

                </tfoot>

            </table>

        </div>

    );



    return createPortal(

        <PrintDocumentLayout

            layout={PRINT_LAYOUT.LONG_BOND_PORTRAIT_ZERO}

            className="print-portal-root fixed inset-0 z-[9999] overflow-y-auto bg-gray-100 print:static print:overflow-visible print:bg-white print:min-h-0"

        >

            <style>{`

                @media print {

                    #rspi-print-area {

                        width: 215.9mm !important;

                        padding: 5mm !important;

                        margin: 0 auto !important;

                        box-shadow: none !important;

                    }

                    #rspi-print-area thead {

                        display: table-header-group;

                    }

                    #rspi-print-area tfoot {

                        display: table-footer-group;

                    }

                    #rspi-print-area tr {

                        page-break-inside: avoid;

                    }

                }

            `}</style>



            <div className="no-print fixed top-4 right-4 z-50 flex gap-2 pr-12">

                <PrintLayoutHint layout={PRINT_LAYOUT.LONG_BOND_PORTRAIT_ZERO} />

                <Button onClick={handlePrint} className="gap-2 shadow-lg">

                    <Printer className="h-4 w-4" />

                    Print / Save as PDF

                </Button>

                <Button variant="outline" onClick={() => window.history.back()} className="shadow-lg bg-background">

                    Back

                </Button>

            </div>



            <div className="flex min-h-full items-start justify-center py-8 print:min-h-0 print:py-0">

                {reportBody}

            </div>

        </PrintDocumentLayout>,

        document.body,

    );

};


