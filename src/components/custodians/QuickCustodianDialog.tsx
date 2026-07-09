import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertCircle, Loader2 } from 'lucide-react';
import { lookupService } from '@/services/lookupService';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';

interface QuickCustodianDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess: (custodian: { id: string; name: string; code?: string }) => void;
    editingCustodian?: {
        id: string;
        name: string;
        custodian_no?: string;
        position?: string;
        department_id?: string;
        department_name?: string;
        employee_no?: string;
        contact_number?: string;
    };
}

export function QuickCustodianDialog({ open, onOpenChange, onSuccess, editingCustodian }: QuickCustodianDialogProps) {
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const [loading, setLoading] = useState(false);
    const [departments, setDepartments] = useState<Array<{ id: string; name: string; code?: string }>>([]);
    const [positions, setPositions] = useState<string[]>([]);

    // Form state
    const [name, setName] = useState('');
    const [position, setPosition] = useState('');
    const [departmentId, setDepartmentId] = useState<string>('');
    const [customDepartment, setCustomDepartment] = useState(''); // For free text
    const [employeeNo, setEmployeeNo] = useState('');
    const [contactNumber, setContactNumber] = useState('');

    const [useCustomDepartment, setUseCustomDepartment] = useState(false);
    const [useCustomPosition, setUseCustomPosition] = useState(false);
    const [customPosition, setCustomPosition] = useState('');

    // Load departments and positions
    useEffect(() => {
        if (open) {
            loadDepartments();
            loadPositions();
        }
    }, [open]);

    const loadDepartments = async () => {
        try {
            const depts = await lookupService.getDepartments();
            setDepartments(depts);
        } catch (error) {
            console.error('Error loading departments:', error);
        }
    };

    const loadPositions = async () => {
        try {
            // Get distinct positions from existing custodians
            const { data, error } = await supabase
                .from('custodians')
                .select('position')
                .not('position', 'is', null)
                .order('position');

            if (error) throw error;

            const uniquePositions = [...new Set(data?.map(c => c.position).filter(Boolean) as string[])];
            setPositions(uniquePositions);
        } catch (error) {
            console.error('Error loading positions:', error);
        }
    };

    // Pre-fill form when editing
    useEffect(() => {
        if (open && editingCustodian) {
            setName(editingCustodian.name || '');
            setEmployeeNo(editingCustodian.employee_no || '');
            setContactNumber(editingCustodian.contact_number || '');

            if (editingCustodian.position) {
                setPosition(editingCustodian.position);
                setUseCustomPosition(false);
            }

            if (editingCustodian.department_id) {
                setDepartmentId(editingCustodian.department_id);
                setUseCustomDepartment(false);
            } else if (editingCustodian.department_name) {
                setCustomDepartment(editingCustodian.department_name);
                setUseCustomDepartment(true);
            }
        }
    }, [open, editingCustodian]);

    const handleSubmit = async () => {
        // Validation
        if (!name.trim()) {
            toast({
                title: 'Validation Error',
                description: 'Full Name is required',
                variant: 'destructive',
            });
            return;
        }

        const finalDepartmentName = useCustomDepartment ? customDepartment.trim() : null;
        const finalDepartmentId = useCustomDepartment ? null : departmentId;

        if (!finalDepartmentName && !finalDepartmentId) {
            toast({
                title: 'Validation Error',
                description: 'Office/Department is required',
                variant: 'destructive',
            });
            return;
        }

        const finalPosition = useCustomPosition ? customPosition.trim() : position;
        if (!finalPosition) {
            toast({
                title: 'Validation Error',
                description: 'Position is required',
                variant: 'destructive',
            });
            return;
        }

        setLoading(true);
        try {
            // If custom department was used, create it first
            let deptId = finalDepartmentId;
            if (useCustomDepartment && finalDepartmentName) {
                const newDept = await lookupService.create('departments', {
                    name: finalDepartmentName
                });
                deptId = newDept.id;
            }

            let result;

            if (editingCustodian) {
                // UPDATE existing custodian
                const updateData = {
                    name: name.trim(),
                    position: finalPosition,
                    department_id: deptId || undefined,
                    code: employeeNo.trim() || undefined,
                };

                result = await lookupService.update('custodians', editingCustodian.id, updateData);

                // Update contact number separately if changed
                if (contactNumber.trim() !== (editingCustodian.contact_number || '')) {
                    await supabase
                        .from('custodians')
                        .update({ contact_number: contactNumber.trim() || null })
                        .eq('id', editingCustodian.id);
                }

                toast({
                    title: 'Success',
                    description: `Custodian "${name}" updated successfully`,
                });
            } else {
                // CREATE new custodian
                result = await lookupService.create('custodians', {
                    name: name.trim(),
                    position: finalPosition,
                    department_id: deptId || undefined,
                    code: employeeNo.trim() || undefined,
                });

                // Update contact number if provided (since lookupService doesn't handle it)
                if (contactNumber.trim()) {
                    await supabase
                        .from('custodians')
                        .update({ contact_number: contactNumber.trim() })
                        .eq('id', result.id);
                }

                toast({
                    title: 'Success',
                    description: `Custodian "${name}" created successfully`,
                });
            }

            // CRITICAL: Immediately invalidate all custodian-related queries for real-time updates
            await queryClient.invalidateQueries({ queryKey: ['custodians'] });
            await queryClient.invalidateQueries({ queryKey: ['custodians-search'] });
            await queryClient.invalidateQueries({ queryKey: ['custodian-summaries'] });
            await queryClient.invalidateQueries({ queryKey: ['custodians-for-received-by'] });

            onSuccess(result);
            handleClose();
        } catch (error: any) {
            console.error('Error creating custodian:', error);
            toast({
                title: 'Error',
                description: error.message || 'Failed to create custodian',
                variant: 'destructive',
            });
        } finally {
            setLoading(false);
        }
    };

    const handleClose = () => {
        // Reset form
        setName('');
        setPosition('');
        setDepartmentId('');
        setCustomDepartment('');
        setEmployeeNo('');
        setContactNumber('');
        setUseCustomDepartment(false);
        setUseCustomPosition(false);
        setCustomPosition('');
        onOpenChange(false);
    };

    const isValid =
        name.trim() !== '' &&
        (useCustomDepartment ? customDepartment.trim() !== '' : departmentId !== '') &&
        (useCustomPosition ? customPosition.trim() !== '' : position !== '');

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>{editingCustodian ? 'Edit Custodian' : 'Quick Add Custodian'}</DialogTitle>
                    <DialogDescription>
                        {editingCustodian
                            ? 'Update custodian information. All fields marked with * are required.'
                            : 'Add a new custodian quickly. All fields marked with * are required.'
                        }
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-4 py-4">
                    {/* Office/Department - Priority 1 */}
                    <div className="grid gap-2">
                        <Label htmlFor="department">Office/Department *</Label>
                        {!useCustomDepartment ? (
                            <>
                                <Select value={departmentId} onValueChange={setDepartmentId}>
                                    <SelectTrigger id="department">
                                        <SelectValue placeholder="Select office/department" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {departments.map((dept) => (
                                            <SelectItem key={dept.id} value={dept.id}>
                                                {dept.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    type="button"
                                    onClick={() => setUseCustomDepartment(true)}
                                    className="text-xs"
                                >
                                    + Not in list? Enter custom department
                                </Button>
                            </>
                        ) : (
                            <>
                                <Input
                                    id="customDepartment"
                                    value={customDepartment}
                                    onChange={(e) => setCustomDepartment(e.target.value)}
                                    placeholder="Enter department name"
                                />
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    type="button"
                                    onClick={() => {
                                        setUseCustomDepartment(false);
                                        setCustomDepartment('');
                                    }}
                                    className="text-xs"
                                >
                                    ← Back to department list
                                </Button>
                            </>
                        )}
                    </div>

                    {/* Full Name - Priority 2 */}
                    <div className="grid gap-2">
                        <Label htmlFor="name">Full Name *</Label>
                        <Input
                            id="name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="e.g., Juan P. Dela Cruz"
                            autoFocus
                        />
                    </div>

                    {/* Position - Priority 3 */}
                    <div className="grid gap-2">
                        <Label htmlFor="position">Position *</Label>
                        {!useCustomPosition && positions.length > 0 ? (
                            <>
                                <Select value={position} onValueChange={setPosition}>
                                    <SelectTrigger id="position">
                                        <SelectValue placeholder="Select position" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {positions.map((pos) => (
                                            <SelectItem key={pos} value={pos}>
                                                {pos}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    type="button"
                                    onClick={() => setUseCustomPosition(true)}
                                    className="text-xs"
                                >
                                    + Enter new position
                                </Button>
                            </>
                        ) : (
                            <>
                                <Input
                                    id="customPosition"
                                    value={useCustomPosition ? customPosition : position}
                                    onChange={(e) => {
                                        if (useCustomPosition) {
                                            setCustomPosition(e.target.value);
                                        } else {
                                            setPosition(e.target.value);
                                        }
                                    }}
                                    placeholder="e.g., Administrative Officer V"
                                />
                                {positions.length > 0 && (
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        type="button"
                                        onClick={() => {
                                            setUseCustomPosition(false);
                                            setCustomPosition('');
                                        }}
                                        className="text-xs"
                                    >
                                        ← Back to position list
                                    </Button>
                                )}
                            </>
                        )}
                    </div>

                    {/* Optional Fields */}
                    <div className="border-t pt-4 space-y-4">
                        <p className="text-sm text-muted-foreground">Optional Information</p>

                        <div className="grid gap-2">
                            <Label htmlFor="employeeNo">Employee Number</Label>
                            <Input
                                id="employeeNo"
                                value={employeeNo}
                                onChange={(e) => setEmployeeNo(e.target.value)}
                                placeholder="e.g., 2024-001"
                            />
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="contact">Contact Number</Label>
                            <Input
                                id="contact"
                                value={contactNumber}
                                onChange={(e) => setContactNumber(e.target.value)}
                                placeholder="e.g., 09XX-XXX-XXXX"
                            />
                        </div>
                    </div>
                </div>

                {!isValid && (
                    <div className="flex items-center gap-2 text-sm text-amber-600 bg-amber-50 p-3 rounded">
                        <AlertCircle className="h-4 w-4" />
                        <p>Please fill all required fields (*) to proceed</p>
                    </div>
                )}

                <DialogFooter>
                    <Button variant="outline" onClick={handleClose} disabled={loading}>
                        Cancel
                    </Button>
                    <Button onClick={handleSubmit} disabled={!isValid || loading}>
                        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {editingCustodian ? 'Update Custodian' : 'Create Custodian'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
