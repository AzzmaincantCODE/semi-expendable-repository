// =====================================================
// Weekly Property Report Form - Annex A.7 (RSPI)
// =====================================================

import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Calendar, FileSpreadsheet, CheckCircle, Upload } from "lucide-react";
import { weeklyPropertyReportService, WeeklyPropertyReport } from "@/services/weeklyPropertyReportService";
import { toast } from "sonner";

export const WeeklyPropertyReportForm: React.FC = () => {
    const queryClient = useQueryClient();

    // Form state
    const [entityName, setEntityName] = useState('PROVINCIAL GOVERNMENT OF APAYAO');
    const [fundCluster, setFundCluster] = useState('');
    const [periodStart, setPeriodStart] = useState('');
    const [periodEnd, setPeriodEnd] = useState('');
    const [reportDate, setReportDate] = useState(new Date().toISOString().split('T')[0]);

    // Generate mutation
    const generateMutation = useMutation({
        mutationFn: weeklyPropertyReportService.generate,
        onSuccess: (report) => {
            toast.success(`Weekly Report ${report.serial_number} generated successfully!`);
            queryClient.invalidateQueries({ queryKey: ['weekly-reports'] });
            resetForm();
        },
        onError: (error: Error) => {
            toast.error(`Failed to generate report: ${error.message}`);
        }
    });

    // Fetch existing reports
    const { data: reports = [], isLoading } = useQuery({
        queryKey: ['weekly-reports'],
        queryFn: () => weeklyPropertyReportService.getAll()
    });

    const resetForm = () => {
        setEntityName('PROVINCIAL GOVERNMENT OF APAYAO');
        setFundCluster('');
        setPeriodStart('');
        setPeriodEnd('');
        setReportDate(new Date().toISOString().split('T')[0]);
    };

    const validateForm = (): boolean => {
        if (!entityName.trim()) {
            toast.error('Entity name is required');
            return false;
        }

        if (!periodStart) {
            toast.error('Period start date is required');
            return false;
        }

        if (!periodEnd) {
            toast.error('Period end date is required');
            return false;
        }

        if (new Date(periodEnd) < new Date(periodStart)) {
            toast.error('End date must be after start date');
            return false;
        }

        return true;
    };

    const handleGenerate = () => {
        if (!validateForm()) return;

        generateMutation.mutate({
            entity_name: entityName,
            fund_cluster: fundCluster || undefined,
            period_start: periodStart,
            period_end: periodEnd
        });
    };

    const handleCertify = async (reportId: string) => {
        const name = prompt('Enter certifier name:');
        const position = prompt('Enter certifier position:');

        if (name && position) {
            try {
                await weeklyPropertyReportService.certify(reportId, {
                    name,
                    position,
                    date: new Date().toISOString().split('T')[0]
                });
                toast.success('Report certified successfully');
                queryClient.invalidateQueries({ queryKey: ['weekly-reports'] });
            } catch (error: any) {
                toast.error(`Failed to certify: ${error.message}`);
            }
        }
    };

    const handlePost = async (reportId: string) => {
        const name = prompt('Enter accounting staff name:');
        const position = prompt('Enter position:');

        if (name && position) {
            try {
                await weeklyPropertyReportService.markAsPosted(reportId, {
                    name,
                    position,
                    date: new Date().toISOString().split('T')[0]
                });
                toast.success('Report marked as posted');
                queryClient.invalidateQueries({ queryKey: ['weekly-reports'] });
            } catch (error: any) {
                toast.error(`Failed to post: ${error.message}`);
            }
        }
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'draft':
                return <Badge variant="secondary">Draft</Badge>;
            case 'certified':
                return <Badge className="bg-blue-500">Certified</Badge>;
            case 'posted':
                return <Badge className="bg-green-500">Posted</Badge>;
            default:
                return <Badge variant="outline">{status}</Badge>;
        }
    };

    const formatDate = (date: string) => {
        return new Date(date).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    };

    return (
        <div className="max-w-6xl mx-auto space-y-6">
            {/* Generate New Report */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-2xl flex items-center gap-2">
                        <Calendar className="h-6 w-6" />
                        Generate Weekly Property Report (RSPI)
                    </CardTitle>
                    <p className="text-sm text-muted-foreground">
                        Annex A.7 - Report of Semi-Expendable Property Issued for JEV preparation
                    </p>
                </CardHeader>

                <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 border rounded-lg bg-muted/50">
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
                            <Label htmlFor="fundCluster">Fund Cluster</Label>
                            <Input
                                id="fundCluster"
                                value={fundCluster}
                                onChange={(e) => setFundCluster(e.target.value)}
                                placeholder="e.g., 01"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="periodStart">Period Start Date *</Label>
                            <Input
                                id="periodStart"
                                type="date"
                                value={periodStart}
                                onChange={(e) => setPeriodStart(e.target.value)}
                                required
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="periodEnd">Period End Date *</Label>
                            <Input
                                id="periodEnd"
                                type="date"
                                value={periodEnd}
                                onChange={(e) => setPeriodEnd(e.target.value)}
                                required
                            />
                        </div>
                    </div>

                    <div className="flex justify-end gap-2 pt-4 border-t">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={resetForm}
                            disabled={generateMutation.isPending}
                        >
                            Reset
                        </Button>
                        <Button
                            onClick={handleGenerate}
                            disabled={generateMutation.isPending}
                            className="min-w-40"
                        >
                            {generateMutation.isPending ? (
                                <>Generating...</>
                            ) : (
                                <>
                                    <FileSpreadsheet className="h-4 w-4 mr-2" />
                                    Generate Report
                                </>
                            )}
                        </Button>
                    </div>

                    <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                        <p className="text-sm text-blue-900">
                            <strong>Note:</strong> The report will automatically aggregate all approved ICS issued within the selected period.
                        </p>
                    </div>
                </CardContent>
            </Card>

            {/* Existing Reports */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                        <span>Recent Weekly Reports</span>
                        <Badge variant="outline">{reports.length} reports</Badge>
                    </CardTitle>
                </CardHeader>

                <CardContent>
                    {isLoading ? (
                        <div className="p-8 text-center text-muted-foreground">
                            Loading reports...
                        </div>
                    ) : reports.length === 0 ? (
                        <div className="p-8 text-center text-muted-foreground">
                            No reports generated yet. Create your first report above.
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {reports.map((report) => (
                                <div
                                    key={report.id}
                                    className="p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                                >
                                    <div className="flex items-start justify-between">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-3 mb-2">
                                                <h3 className="font-semibold font-mono text-lg">
                                                    {report.serial_number}
                                                </h3>
                                                {getStatusBadge(report.status)}
                                            </div>

                                            <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
                                                <div>
                                                    <span className="text-muted-foreground">Entity:</span>{' '}
                                                    <span className="font-medium">{report.entity_name}</span>
                                                </div>
                                                <div>
                                                    <span className="text-muted-foreground">Report Date:</span>{' '}
                                                    <span className="font-medium">{formatDate(report.report_date)}</span>
                                                </div>
                                                <div>
                                                    <span className="text-muted-foreground">Period:</span>{' '}
                                                    <span className="font-medium">
                                                        {formatDate(report.period_start)} - {formatDate(report.period_end)}
                                                    </span>
                                                </div>
                                                <div>
                                                    <span className="text-muted-foreground">Items:</span>{' '}
                                                    <span className="font-medium">{report.items.length} ICS</span>
                                                </div>

                                                {report.certified_by_name && (
                                                    <div className="col-span-2 text-xs text-green-600">
                                                        ✓ Certified by {report.certified_by_name} on {formatDate(report.certified_date!)}
                                                    </div>
                                                )}

                                                {report.posted_by_name && (
                                                    <div className="col-span-2 text-xs text-blue-600">
                                                        ✓ Posted by {report.posted_by_name} on {formatDate(report.posted_date!)}
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        <div className="flex flex-col gap-2">
                                            {report.status === 'draft' && (
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={() => handleCertify(report.id)}
                                                >
                                                    <CheckCircle className="h-4 w-4 mr-1" />
                                                    Certify
                                                </Button>
                                            )}

                                            {report.status === 'certified' && (
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={() => handlePost(report.id)}
                                                >
                                                    <Upload className="h-4 w-4 mr-1" />
                                                    Post to SPLC
                                                </Button>
                                            )}

                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                onClick={() => {
                                                    // Navigate to print view
                                                    window.open(`/reports/rspi/${report.id}`, '_blank');
                                                }}
                                            >
                                                View Report
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Workflow Guide */}
            <Card className="border-purple-200 bg-purple-50/50">
                <CardHeader>
                    <CardTitle className="text-lg">Workflow</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex items-center justify-between text-sm">
                        <div className="flex flex-col items-center gap-1">
                            <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center font-bold">
                                1
                            </div>
                            <p className="font-medium">Generate</p>
                            <p className="text-xs text-muted-foreground">Auto-aggregate ICS</p>
                        </div>

                        <div className="flex-1 h-px bg-gray-300 mx-2"></div>

                        <div className="flex flex-col items-center gap-1">
                            <div className="w-10 h-10 rounded-full bg-blue-200 flex items-center justify-center font-bold">
                                2
                            </div>
                            <p className="font-medium">Certify</p>
                            <p className="text-xs text-muted-foreground">Property Custodian</p>
                        </div>

                        <div className="flex-1 h-px bg-gray-300 mx-2"></div>

                        <div className="flex flex-col items-center gap-1">
                            <div className="w-10 h-10 rounded-full bg-green-200 flex items-center justify-center font-bold">
                                3
                            </div>
                            <p className="font-medium">Post</p>
                            <p className="text-xs text-muted-foreground">Accounting Staff</p>
                        </div>

                        <div className="flex-1 h-px bg-gray-300 mx-2"></div>

                        <div className="flex flex-col items-center gap-1">
                            <div className="w-10 h-10 rounded-full bg-purple-200 flex items-center justify-center font-bold">
                                4
                            </div>
                            <p className="font-medium">JEV</p>
                            <p className="text-xs text-muted-foreground">Accounting prepares</p>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};
