// =====================================================
// RSPI Annex Page - Annex A.7
// Report of Semi-Expendable Property Issued
// =====================================================

import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
    FileSpreadsheet,
    Calendar,
    CheckCircle,
    Upload,
    Printer,
    Trash2,
    RefreshCw,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
    weeklyPropertyReportService,
    WeeklyPropertyReport,
} from "@/services/weeklyPropertyReportService";
import { toast } from "sonner";

const getLocalDateString = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
};

export const RSPIAnnex = () => {
    const navigate = useNavigate();
    const queryClient = useQueryClient();

    // Generate form state
    const [entityName, setEntityName] = useState("PROVINCIAL GOVERNMENT OF APAYAO");
    const [periodStart, setPeriodStart] = useState(() => {
        const now = new Date();
        return getLocalDateString(new Date(now.getFullYear(), now.getMonth(), 1));
    });
    const [periodEnd, setPeriodEnd] = useState(() => {
        const now = new Date();
        return getLocalDateString(new Date(now.getFullYear(), now.getMonth() + 1, 0));
    });
    
    // Quick Month Selector
    const [selectedMonth, setSelectedMonth] = useState(() => {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    });

    const handleMonthChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        setSelectedMonth(val);
        if (val) {
            const [year, month] = val.split('-');
            const start = new Date(parseInt(year), parseInt(month) - 1, 1);
            const end = new Date(parseInt(year), parseInt(month), 0);
            setPeriodStart(getLocalDateString(start));
            setPeriodEnd(getLocalDateString(end));
        }
    };

    // Confirm dialog for delete
    const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

    // Certify inline state
    const [certifyingId, setCertifyingId] = useState<string | null>(null);
    const [certifyName, setCertifyName] = useState("CARLA MAY DANGAO");
    const [certifyPosition, setCertifyPosition] = useState("PROPERTY OFFICER - GSO");

    // Post inline state
    const [postingId, setPostingId] = useState<string | null>(null);
    const [postName, setPostName] = useState("");
    const [postPosition, setPostPosition] = useState("");

    // ── Queries ──────────────────────────────────────
    const { data: reports = [], isLoading } = useQuery({
        queryKey: ["weekly-reports"],
        queryFn: () => weeklyPropertyReportService.getAll(),
        staleTime: 30_000,
    });

    // ── Mutations ────────────────────────────────────
    const generateMutation = useMutation({
        mutationFn: weeklyPropertyReportService.generate,
        onSuccess: (reports) => {
            toast.success(`${reports.length} report(s) generated successfully!`);
            queryClient.invalidateQueries({ queryKey: ["weekly-reports"] });
            setPeriodStart("");
            setPeriodEnd("");
        },
        onError: (error: Error) => {
            toast.error(`Failed to generate: ${error.message}`);
        },
    });

    const deleteMutation = useMutation({
        mutationFn: (id: string) => weeklyPropertyReportService.delete(id),
        onSuccess: () => {
            toast.success("Report deleted");
            queryClient.invalidateQueries({ queryKey: ["weekly-reports"] });
            setDeleteTargetId(null);
        },
        onError: (error: Error) => {
            toast.error(`Delete failed: ${error.message}`);
            setDeleteTargetId(null);
        },
    });

    const certifyMutation = useMutation({
        mutationFn: ({ id, name, position }: { id: string; name: string; position: string }) =>
            weeklyPropertyReportService.certify(id, {
                name,
                position,
                date: new Date().toISOString().split("T")[0],
            }),
        onSuccess: (data: any, variables: any) => {
            toast.success("Report certified!");
            queryClient.invalidateQueries({ queryKey: ["weekly-reports"] });
            if (variables?.id) {
                queryClient.invalidateQueries({ queryKey: ["weekly-report", variables.id] });
            }
            setCertifyingId(null);
            setCertifyName("CARLA MAY DANGAO");
            setCertifyPosition("PROPERTY OFFICER - GSO");
        },
        onError: (error: Error) => toast.error(`Certify failed: ${error.message}`),
    });

    const postMutation = useMutation({
        mutationFn: ({ id, name, position }: { id: string; name: string; position: string }) =>
            weeklyPropertyReportService.markAsPosted(id, {
                name,
                position,
                date: new Date().toISOString().split("T")[0],
            }),
        onSuccess: (data: any, variables: any) => {
            toast.success("Report posted to SPLC!");
            queryClient.invalidateQueries({ queryKey: ["weekly-reports"] });
            if (variables?.id) {
                queryClient.invalidateQueries({ queryKey: ["weekly-report", variables.id] });
            }
            setPostingId(null);
            setPostName("");
            setPostPosition("");
        },
        onError: (error: Error) => toast.error(`Post failed: ${error.message}`),
    });

    // ── Helpers ──────────────────────────────────────
    const handleGenerate = () => {
        if (!entityName.trim()) return toast.error("Entity name is required");
        if (!periodStart) return toast.error("Period start is required");
        if (!periodEnd) return toast.error("Period end is required");
        if (new Date(periodEnd) < new Date(periodStart))
            return toast.error("End date must be after start date");

        generateMutation.mutate({
            entity_name: entityName,
            period_start: periodStart,
            period_end: periodEnd,
        });
    };

    const fmt = (d: string) =>
        new Date(d).toLocaleDateString("en-PH", {
            year: "numeric",
            month: "short",
            day: "numeric",
        });

    const statusBadge = (status: WeeklyPropertyReport["status"]) => {
        if (status === "draft") return <Badge variant="secondary">Draft</Badge>;
        if (status === "certified") return <Badge className="bg-blue-500 text-white">Certified</Badge>;
        return <Badge className="bg-green-600 text-white">Posted</Badge>;
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h1 className="text-3xl font-bold text-foreground">RSPI Reports</h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        Annex A.7 — Report of Semi-Expendable Property Issued
                    </p>
                </div>
            </div>

            {/* Generate Form */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Calendar className="h-5 w-5" />
                        Generate New Report
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="entityName">Entity Name *</Label>
                            <Input
                                id="entityName"
                                value={entityName}
                                readOnly
                                className="bg-muted"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="monthPicker">Select Month</Label>
                            <Input
                                id="monthPicker"
                                type="month"
                                value={selectedMonth}
                                onChange={handleMonthChange}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="periodStart">Period Start *</Label>
                            <Input
                                id="periodStart"
                                type="date"
                                value={periodStart}
                                max={new Date().toISOString().split("T")[0]}
                                onChange={(e) => {
                                    setPeriodStart(e.target.value);
                                    setSelectedMonth("");
                                }}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="periodEnd">Period End *</Label>
                            <Input
                                id="periodEnd"
                                type="date"
                                value={periodEnd}
                                onChange={(e) => {
                                    setPeriodEnd(e.target.value);
                                    setSelectedMonth("");
                                }}
                            />
                        </div>
                    </div>

                    <div className="flex justify-end gap-2 pt-2 border-t">
                        <Button
                            variant="outline"
                            onClick={() => { 
                                const now = new Date();
                                setPeriodStart(getLocalDateString(new Date(now.getFullYear(), now.getMonth(), 1)));
                                setPeriodEnd(getLocalDateString(new Date(now.getFullYear(), now.getMonth() + 1, 0)));
                                setSelectedMonth(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`);
                            }}
                            disabled={generateMutation.isPending}
                        >
                            <RefreshCw className="h-4 w-4 mr-2" />
                            Reset
                        </Button>
                        <Button onClick={handleGenerate} disabled={generateMutation.isPending} className="min-w-40">
                            {generateMutation.isPending ? (
                                "Generating…"
                            ) : (
                                <>
                                    <FileSpreadsheet className="h-4 w-4 mr-2" />
                                    Generate Report
                                </>
                            )}
                        </Button>
                    </div>

                    <div className="p-3 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg text-sm text-blue-900 dark:text-blue-100">
                        <strong>Note:</strong> The report automatically aggregates all <strong>confirmed</strong> ICS issued
                        within the selected period. Items currently in <strong>Draft Mode</strong> will not appear in the RSPI until the ICS is officially confirmed.
                    </div>
                </CardContent>
            </Card>

            {/* Reports List - Organized by Status */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                        <span>Generated Reports</span>
                        <Badge variant="outline">{reports.length}</Badge>
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <p className="text-center text-muted-foreground py-8">Loading…</p>
                    ) : reports.length === 0 ? (
                        <p className="text-center text-muted-foreground py-8">
                            No reports yet. Generate your first report above.
                        </p>
                    ) : (
                        <Tabs defaultValue="draft" className="w-full">
                            <TabsList className="grid w-full grid-cols-3">
                                <TabsTrigger value="draft" className="gap-2">
                                    Draft
                                    <Badge variant="secondary" className="ml-1 text-xs px-1.5 py-0">
                                        {reports.filter(r => r.status === "draft").length}
                                    </Badge>
                                </TabsTrigger>
                                <TabsTrigger value="certified" className="gap-2">
                                    Certified
                                    <Badge variant="secondary" className="ml-1 text-xs px-1.5 py-0 bg-blue-100 text-blue-700">
                                        {reports.filter(r => r.status === "certified").length}
                                    </Badge>
                                </TabsTrigger>
                                <TabsTrigger value="posted" className="gap-2">
                                    Posted
                                    <Badge variant="secondary" className="ml-1 text-xs px-1.5 py-0 bg-green-100 text-green-700">
                                        {reports.filter(r => r.status === "posted").length}
                                    </Badge>
                                </TabsTrigger>
                            </TabsList>

                            {(["draft", "certified", "posted"] as const).map((tab) => {
                                const filtered = reports.filter(r => r.status === tab);
                                return (
                                    <TabsContent key={tab} value={tab} className="mt-4">
                                        {filtered.length === 0 ? (
                                            <p className="text-center text-muted-foreground py-8">
                                                No {tab} reports.
                                            </p>
                                        ) : (
                                            <div className="space-y-3">
                                                {filtered.map((report) => (
                                                    <div key={report.id} className="border rounded-lg p-4 space-y-3">
                                                        {/* Row header */}
                                                        <div className="flex flex-wrap items-center justify-between gap-2">
                                                            <div className="flex items-center gap-3">
                                                                <span className="font-mono font-semibold text-lg">
                                                                    {report.serial_number}
                                                                </span>
                                                                {statusBadge(report.status)}
                                                            </div>
                                                            <div className="flex items-center gap-2">
                                                                {/* Print */}
                                                                <Button
                                                                    size="sm"
                                                                    variant="outline"
                                                                    onClick={() => navigate(`/rspi/${report.id}`)}
                                                                >
                                                                    <Printer className="h-4 w-4 mr-1" />
                                                                    Print
                                                                </Button>
                                                                {/* Delete */}
                                                                <Button
                                                                    size="sm"
                                                                    variant="ghost"
                                                                    className="text-red-500 hover:text-red-700"
                                                                    onClick={() => setDeleteTargetId(report.id)}
                                                                >
                                                                    <Trash2 className="h-4 w-4" />
                                                                </Button>
                                                            </div>
                                                        </div>

                                                        {/* Meta */}
                                                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-1 text-sm">
                                                            <div className="col-span-2">
                                                                <span className="text-muted-foreground">Entity: </span>
                                                                <span className="font-medium">{report.entity_name}</span>
                                                            </div>
                                                            <div className="col-span-2">
                                                                <span className="text-muted-foreground">Fund / Category: </span>
                                                                <span className="font-medium text-primary">{report.fund_cluster || 'N/A'}</span>
                                                            </div>
                                                            <div className="col-span-2">
                                                                <span className="text-muted-foreground">Period: </span>
                                                                <span className="font-medium">
                                                                    {fmt(report.period_start)} – {fmt(report.period_end)}
                                                                </span>
                                                            </div>
                                                            <div>
                                                                <span className="text-muted-foreground">Items: </span>
                                                                <span className="font-medium">{report.items?.length ?? 0} ICS</span>
                                                            </div>
                                                            {report.certified_by_name && (
                                                                <div className="col-span-2 text-xs text-green-600">
                                                                    ✓ Certified by {report.certified_by_name} on {fmt(report.certified_date!)}
                                                                </div>
                                                            )}
                                                            {report.posted_by_name && (
                                                                <div className="col-span-2 text-xs text-blue-600">
                                                                    ✓ Posted by {report.posted_by_name} on {fmt(report.posted_date!)}
                                                                </div>
                                                            )}
                                                        </div>

                                                        {/* Certify inline */}
                                                        {report.status === "draft" && (
                                                            certifyingId === report.id ? (
                                                                <div className="flex flex-wrap items-end gap-2 pt-2 border-t">
                                                                    <div className="space-y-1">
                                                                        <Label className="text-xs">Certifier Name</Label>
                                                                        <Input value={certifyName} onChange={(e) => setCertifyName(e.target.value)} placeholder="Full name" className="h-8 text-sm w-48" />
                                                                    </div>
                                                                    <div className="space-y-1">
                                                                        <Label className="text-xs">Position</Label>
                                                                        <Input value={certifyPosition} onChange={(e) => setCertifyPosition(e.target.value)} placeholder="Position/Designation" className="h-8 text-sm w-48" />
                                                                    </div>
                                                                    <Button size="sm" onClick={() => certifyMutation.mutate({ id: report.id, name: certifyName, position: certifyPosition })} disabled={certifyMutation.isPending || !certifyName || !certifyPosition}>
                                                                        <CheckCircle className="h-4 w-4 mr-1" /> Confirm Certify
                                                                    </Button>
                                                                    <Button size="sm" variant="ghost" onClick={() => setCertifyingId(null)}>Cancel</Button>
                                                                </div>
                                                            ) : (
                                                                <div className="flex pt-2 border-t">
                                                                    <Button size="sm" variant="outline" onClick={() => setCertifyingId(report.id)}>
                                                                        <CheckCircle className="h-4 w-4 mr-1" /> Certify
                                                                    </Button>
                                                                </div>
                                                            )
                                                        )}

                                                        {/* Post inline */}
                                                        {report.status === "certified" && (
                                                            postingId === report.id ? (
                                                                <div className="flex flex-wrap items-end gap-2 pt-2 border-t">
                                                                    <div className="space-y-1">
                                                                        <Label className="text-xs">Accounting Staff Name</Label>
                                                                        <Input value={postName} onChange={(e) => setPostName(e.target.value)} placeholder="Full name" className="h-8 text-sm w-48" />
                                                                    </div>
                                                                    <div className="space-y-1">
                                                                        <Label className="text-xs">Position</Label>
                                                                        <Input value={postPosition} onChange={(e) => setPostPosition(e.target.value)} placeholder="Position" className="h-8 text-sm w-48" />
                                                                    </div>
                                                                    <Button size="sm" onClick={() => postMutation.mutate({ id: report.id, name: postName, position: postPosition })} disabled={postMutation.isPending || !postName || !postPosition}>
                                                                        <Upload className="h-4 w-4 mr-1" /> Confirm Post
                                                                    </Button>
                                                                    <Button size="sm" variant="ghost" onClick={() => setPostingId(null)}>Cancel</Button>
                                                                </div>
                                                            ) : (
                                                                <div className="flex pt-2 border-t">
                                                                    <Button size="sm" variant="outline" onClick={() => setPostingId(report.id)}>
                                                                        <Upload className="h-4 w-4 mr-1" /> Post to SPLC
                                                                    </Button>
                                                                </div>
                                                            )
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </TabsContent>
                                );
                            })}
                        </Tabs>
                    )}
                </CardContent>
            </Card>


            {/* Workflow Card */}
            <Card className="border-purple-200 bg-purple-50/40 dark:bg-purple-950/20">
                <CardHeader>
                    <CardTitle className="text-base">Workflow</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex items-center justify-between text-sm gap-1">
                        {[
                            { step: 1, label: "Generate", sub: "Auto-aggregate ICS", color: "bg-gray-200" },
                            { step: 2, label: "Certify", sub: "Property Custodian", color: "bg-blue-200" },
                            { step: 3, label: "Post", sub: "Accounting Staff", color: "bg-green-200" },
                            { step: 4, label: "JEV", sub: "Accounting prepares", color: "bg-purple-200" },
                        ].map((item, idx, arr) => (
                            <React.Fragment key={item.step}>
                                <div className="flex flex-col items-center gap-1">
                                    <div className={`w-9 h-9 rounded-full ${item.color} flex items-center justify-center font-bold text-sm`}>
                                        {item.step}
                                    </div>
                                    <p className="font-medium">{item.label}</p>
                                    <p className="text-xs text-muted-foreground text-center">{item.sub}</p>
                                </div>
                                {idx < arr.length - 1 && <div className="flex-1 h-px bg-border mx-1" />}
                            </React.Fragment>
                        ))}
                    </div>
                </CardContent>
            </Card>

            {/* Delete Confirm Dialog */}
            <AlertDialog open={!!deleteTargetId} onOpenChange={() => setDeleteTargetId(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete Report?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will permanently delete this RSPI report. This cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            className="bg-red-600 hover:bg-red-700"
                            onClick={() => deleteTargetId && deleteMutation.mutate(deleteTargetId)}
                        >
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
};
