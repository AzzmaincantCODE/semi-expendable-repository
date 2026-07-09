import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { InventoryItem } from "@/types/inventory";
import { lookupService, LookupItem } from "@/services/lookupService";
import { PropertyNumberService } from "@/services/propertyNumberService";
import { simpleInventoryService } from "@/services/simpleInventoryService";
import { Check, ChevronsUpDown, Loader2, Copy, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { differenceInDays, parseISO } from "date-fns";
import { Checkbox } from "@/components/ui/checkbox";

interface InventoryFormProps {
  item?: InventoryItem;
  initialLegacyMode?: boolean;
  onSave: (item: InventoryItem, autoCreatePropertyCard?: boolean) => void;
  onCancel: () => void;
  isSaving?: boolean;
}

export const InventoryForm = ({ item, initialLegacyMode = false, onSave, onCancel, isSaving = false }: InventoryFormProps) => {
  const [suppliers, setSuppliers] = useState<LookupItem[]>([]);
  const [fundSources, setFundSources] = useState<LookupItem[]>([]);
  const [semiExpandableCategories, setSemiExpandableCategories] = useState<LookupItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [openAddLookup, setOpenAddLookup] = useState<{ type: 'supplier' | 'fundSource' | null }>({ type: null });
  const [newLookup, setNewLookup] = useState<{ name: string; code?: string }>({ name: "" });
  const [estimatedLifeOverride, setEstimatedLifeOverride] = useState<string>(item?.estimatedUsefulLife?.toString() || "");
  const [overrideError, setOverrideError] = useState<string>("");
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [categorySearch, setCategorySearch] = useState("");
  const [propertyNumberPrefix, setPropertyNumberPrefix] = useState<string>('');
  const [autoCreatePropertyCard, setAutoCreatePropertyCard] = useState<boolean>(false);
  const [descriptionManuallyEdited, setDescriptionManuallyEdited] = useState<boolean>(!!item?.description);
  const [isLegacyMode, setIsLegacyMode] = useState<boolean>(initialLegacyMode);

  // Disable auto-create property card in legacy mode
  useEffect(() => {
    if (isLegacyMode) {
      setAutoCreatePropertyCard(false);
    }
  }, [isLegacyMode]);

  // Duplication State
  const [duplicateDialogOpen, setDuplicateDialogOpen] = useState(false);
  const [duplicateSearch, setDuplicateSearch] = useState("");
  const [duplicateResults, setDuplicateResults] = useState<InventoryItem[]>([]);
  const [duplicateLoading, setDuplicateLoading] = useState(false);

  const createLookup = async () => {
    if (!newLookup.name.trim() || !openAddLookup.type) return;
    const map: any = { supplier: 'suppliers', fundSource: 'fund_sources' };
    const created = await lookupService.create(map[openAddLookup.type], newLookup);
    if (openAddLookup.type === 'supplier') setSuppliers([created, ...suppliers]);
    if (openAddLookup.type === 'fundSource') setFundSources([created, ...fundSources]);
    setNewLookup({ name: "" });
    setOpenAddLookup({ type: null });
  };

  const [formData, setFormData] = useState<Partial<InventoryItem>>({
    propertyNumber: item?.propertyNumber || "",
    description: item?.description || "",
    brand: item?.brand || "",
    model: item?.model || "",
    serialNumber: item?.serialNumber || "",
    unitOfMeasure: item?.unitOfMeasure || "piece",
    quantity: item?.quantity || 1,
    unitCost: item?.unitCost || undefined,
    dateAcquired: item?.dateAcquired || new Date().toISOString().split('T')[0],
    warrantyEndDate: item?.warrantyEndDate || "",
    lifespanEndDate: item?.lifespanEndDate || "",
    supplier: item?.supplier || "",
    condition: item?.condition || "Serviceable",
    fundSource: item?.fundSource || "",
    remarks: item?.remarks || "",
    estimatedUsefulLife: item?.estimatedUsefulLife || "",
    semiExpandableCategory: item?.semiExpandableCategory || "", // Store the selected category name
    subCategory: item?.subCategory || undefined,
    status: item?.status || "Active",
    lastInventoryDate: item?.lastInventoryDate || "",
    entityName: 'PROVINCIAL GOVERNMENT OF APAYAO',
  });

  // Handle duplication search
  useEffect(() => {
    if (!duplicateDialogOpen) return;

    const searchItems = async () => {
      if (!duplicateSearch.trim()) {
        setDuplicateResults([]);
        return;
      }
      setDuplicateLoading(true);
      try {
        const response = await simpleInventoryService.search(duplicateSearch);
        if (response.success && response.data) {
          setDuplicateResults(response.data);
        } else {
          setDuplicateResults([]);
        }
      } catch (error) {
        console.error("Search failed", error);
      } finally {
        setDuplicateLoading(false);
      }
    };

    const debounce = setTimeout(searchItems, 300);
    return () => clearTimeout(debounce);
  }, [duplicateSearch, duplicateDialogOpen]);

  const handleDuplicateSelect = (selectedItem: InventoryItem) => {
    setFormData(prev => ({
      ...prev,
      brand: selectedItem.brand,
      model: selectedItem.model,
      serialNumber: "",
      unitOfMeasure: selectedItem.unitOfMeasure,
      quantity: selectedItem.quantity,
      unitCost: selectedItem.unitCost,
      description: selectedItem.description,
      supplier: selectedItem.supplier,
      fundSource: selectedItem.fundSource,
      semiExpandableCategory: selectedItem.semiExpandableCategory,
      subCategory: selectedItem.subCategory,
      warrantyEndDate: "",
      lifespanEndDate: "",
      condition: selectedItem.condition,
      remarks: selectedItem.remarks,
      propertyNumber: "",
    }));
    setDuplicateDialogOpen(false);
  };

  // Auto-computed description: "Brand Model SN: SerialNumber"
  const computedDescription = useMemo(() => {
    const brandModel = [formData.brand?.trim(), formData.model?.trim()].filter(Boolean).join(' ');
    const sn = formData.serialNumber?.trim();
    if (brandModel && sn) return `${brandModel} SN: ${sn}`;
    if (sn) return `SN: ${sn}`;
    return brandModel;
  }, [formData.brand, formData.model, formData.serialNumber]);

  // Auto-populate description when brand/model/serial changes unless user has manually edited it
  useEffect(() => {
    if (!descriptionManuallyEdited) {
      setFormData(prev => ({ ...prev, description: computedDescription }));
    }
  }, [computedDescription, descriptionManuallyEdited]);

  // Helper function to determine sub-category from unit cost
  const determineSubCategory = (unitCost: number | undefined): 'Small Value Expendable' | 'High Value Expendable' | undefined => {
    if (unitCost === undefined || unitCost === null) {
      return undefined;
    }
    return unitCost <= 5000 ? 'Small Value Expendable' : 'High Value Expendable';
  };

  // Initialize property number prefix when editing an existing item
  useEffect(() => {
    if (item?.propertyNumber && !propertyNumberPrefix) {
      const parts = item.propertyNumber.split('-');
      if (parts[0] === 'SPLV' || parts[0] === 'SPHV') {
        setPropertyNumberPrefix(parts[0]);
      }
    }
  }, [item?.propertyNumber, propertyNumberPrefix]);

  // Generate property number when sub-category changes
  const generatePropertyNumber = async (subCategory: 'Small Value Expendable' | 'High Value Expendable') => {
    if (isLegacyMode) return; // Skip generation in legacy mode
    
    console.log('generatePropertyNumber called with subCategory:', subCategory);
    const prefix = PropertyNumberService.getPrefixForSubCategory(subCategory);
    setPropertyNumberPrefix(prefix);

    try {
      // Use the new unique property number generation to prevent duplicates
      const propertyNumber = await PropertyNumberService.generateUniquePropertyNumber(subCategory);
      console.log('Generated unique property number:', propertyNumber);
      setFormData(prev => ({ ...prev, propertyNumber }));
      console.log('Updated formData with property number:', propertyNumber);
    } catch (error) {
      console.error('Error generating unique property number:', error);
      // Fallback to basic generation
      try {
        const propertyNumber = await PropertyNumberService.generateNextPropertyNumber(subCategory);
        console.log('Generated fallback property number:', propertyNumber);
        setFormData(prev => ({ ...prev, propertyNumber }));
      } catch (fallbackError) {
        console.error('Fallback generation also failed:', fallbackError);
        // Final fallback to manual format
        const now = new Date();
        const year = now.getFullYear().toString();
        const month = (now.getMonth() + 1).toString().padStart(2, '0');
        const fallbackNumber = `${prefix}-${year}-${month}-0001`;
        console.log('Using final fallback number:', fallbackNumber);
        setFormData(prev => ({ ...prev, propertyNumber: fallbackNumber }));
      }
    }
  };

  // Auto-determine sub-category and generate property number when unit cost changes
  useEffect(() => {
    if (formData.unitCost !== undefined && formData.unitCost !== null && formData.unitCost >= 0.01) {
      const determinedSubCategory = determineSubCategory(formData.unitCost);

      // Only update if sub-category changed or is not set
      if (determinedSubCategory) {
        setFormData(prev => {
          // Only update if sub-category actually changed
          if (prev.subCategory !== determinedSubCategory) {
            console.log('Auto-determining sub-category:', determinedSubCategory, 'from unit cost:', formData.unitCost);
            // Generate property number for the determined sub-category
            if (!isLegacyMode) {
              generatePropertyNumber(determinedSubCategory);
            }
            return { ...prev, subCategory: determinedSubCategory };
          }
          return prev;
        });
      }
    } else if (formData.unitCost === undefined || formData.unitCost === null) {
      // Clear sub-category and property number if unit cost is cleared
      setFormData(prev => {
        if (prev.subCategory) {
          setPropertyNumberPrefix('');
          return { ...prev, subCategory: undefined, propertyNumber: '' };
        }
        return prev;
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.unitCost]);

  // Validate property number format while allowing editing
  const validatePropertyNumber = (value: string): string => {
    if (!value) return '';
    if (isLegacyMode) return value; // No strict format in legacy mode

    const parts = value.split('-');
    if (parts.length !== 4) return value;

    const [prefix, year, month, sequence] = parts;

    // Enforce that the prefix must be SPLV or SPHV
    if (prefix !== 'SPLV' && prefix !== 'SPHV') {
      // Invalid prefix, restore original if we have one
      if (propertyNumberPrefix) {
        return `${propertyNumberPrefix}-${year}-${month}-${sequence}`;
      }
      return value;
    }

    // If the prefix changed from what was generated, prevent it
    if (propertyNumberPrefix && prefix !== propertyNumberPrefix) {
      // Restore the original prefix
      return `${propertyNumberPrefix}-${year}-${month}-${sequence}`;
    }

    return value;
  };

  // Handle property number input change
  const handlePropertyNumberChange = (value: string) => {
    const validated = validatePropertyNumber(value);
    setFormData(prev => ({ ...prev, propertyNumber: validated }));
  };

  // Validation for unit cost (simplified since sub-category is auto-determined)
  // Compute days label for warranty/lifespan end dates
  const warrantyDaysLabel = useMemo(() => {
    if (!formData.warrantyEndDate) return null;
    try {
      const endDate = parseISO(formData.warrantyEndDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const days = differenceInDays(endDate, today);
      if (days < 0) return { text: `Warranty expired ${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"} ago`, className: "text-red-600" };
      if (days === 0) return { text: "Warranty expires today", className: "text-amber-600" };
      if (days <= 60) return { text: `${days} day${days === 1 ? "" : "s"} until warranty expires`, className: "text-amber-600" };
      return { text: `${days} days of warranty remaining`, className: "text-green-600" };
    } catch {
      return null;
    }
  }, [formData.warrantyEndDate]);

  const lifespanDaysLabel = useMemo(() => {
    if (!formData.lifespanEndDate) return null;
    try {
      const endDate = parseISO(formData.lifespanEndDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const days = differenceInDays(endDate, today);
      if (days < 0) return { text: `Lifespan ended ${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"} ago`, className: "text-red-600" };
      if (days === 0) return { text: "Lifespan ends today", className: "text-amber-600" };
      if (days <= 60) return { text: `${days} day${days === 1 ? "" : "s"} until lifespan ends`, className: "text-amber-600" };
      return { text: `${days} days until lifespan ends`, className: "text-green-600" };
    } catch {
      return null;
    }
  }, [formData.lifespanEndDate]);

  const unitCostValidation = useMemo(() => {
    const unitCost = formData.unitCost;

    // Only validate if user has actually entered a value
    if (unitCost === undefined || unitCost === null) {
      return { isValid: true, message: '' };
    }

    // Check minimum value
    if (unitCost < 0.01) {
      return {
        isValid: false,
        message: 'Unit cost must be at least ₱0.01'
      };
    }

    // Check maximum value for semi-expendable items
    if (unitCost > 50000) {
      return {
        isValid: false,
        message: 'Unit cost must not exceed ₱50,000 for Semi-Expendable items'
      };
    }

    // Sub-category is auto-determined, so no need to validate mismatch
    return { isValid: true, message: '' };
  }, [formData.unitCost]);


  // Load lookup data
  useEffect(() => {
    const loadLookupData = async () => {
      try {
        const [suppliersData, fundSourcesData, categoriesData] = await Promise.all([
          lookupService.getSuppliers(),
          lookupService.getFundSources(),
          lookupService.getSemiExpandableCategories(),
        ]);

        setSuppliers(suppliersData);
        setFundSources(fundSourcesData);
        setSemiExpandableCategories(categoriesData);
      } catch (error) {
        console.error('Error loading lookup data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadLookupData();
  }, []);

  const handleOverrideChange = (value: string) => {
    setEstimatedLifeOverride(value);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Validate semi-expendable category is selected
    if (!formData.semiExpandableCategory) {
      setOverrideError("Please select a Semi-Expendable Category");
      return;
    }

    // Validate unit cost is provided (required for sub-category determination)
    if (!formData.unitCost || formData.unitCost < 0.01) {
      setOverrideError("Please enter a valid unit cost (minimum ₱0.01)");
      return;
    }

    // Ensure sub-category is determined
    if (!formData.subCategory) {
      const determinedSubCategory = determineSubCategory(formData.unitCost);
      if (determinedSubCategory) {
        setFormData(prev => ({ ...prev, subCategory: determinedSubCategory }));
        setOverrideError("Please wait for property number to be generated...");
        // Generate property number and retry submission
        generatePropertyNumber(determinedSubCategory).then(() => {
          // Retry submission after property number is generated
          setTimeout(() => {
            const newItem: InventoryItem = {
              id: item?.id || `INV-${Date.now()}`,
              ...formData,
              subCategory: determinedSubCategory,
              totalCost: (formData.quantity || 0) * (formData.unitCost || 0),
              estimatedUsefulLife: formData.estimatedUsefulLife || "",
              createdAt: item?.createdAt || new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            } as InventoryItem;
            onSave(newItem, autoCreatePropertyCard);
          }, 500);
        });
        return;
      }
      setOverrideError("Unable to determine sub-category. Please check unit cost.");
      return;
    }

    // Validate unit cost
    if (!unitCostValidation.isValid) {
      setOverrideError(unitCostValidation.message);
      return;
    }

    // Validate property number is set
    if (!formData.propertyNumber) {
      setOverrideError("Property number is required. Please wait for it to be generated or enter manually.");
      return;
    }

    // Clear any previous validation errors
    setOverrideError("");

    const newItem: InventoryItem = {
      id: item?.id || `INV-${Date.now()}`,
      ...formData,
      totalCost: (formData.quantity || 0) * (formData.unitCost || 0),
      estimatedUsefulLife: formData.estimatedUsefulLife || "",
      createdAt: item?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } as InventoryItem;

    onSave(newItem, autoCreatePropertyCard);
  };

  if (loading) {
    return (
      <Card className="max-w-4xl mx-auto">
        <CardContent className="p-8 text-center">
          <div className="text-muted-foreground">Loading form data...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="max-w-3xl mx-auto">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">{item ? "Edit Inventory Item" : (isLegacyMode ? "Add Legacy Item" : "Add Inventory Item")}</CardTitle>
            {!item && (
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox id="legacyMode" checked={isLegacyMode} onCheckedChange={(c) => setIsLegacyMode(!!c)} />
                <span className="text-xs text-muted-foreground">Legacy Mode</span>
              </label>
            )}
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <form onSubmit={handleSubmit} className="space-y-0">
            {/* Row 1: Category & Description */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pb-4">
              <div className="space-y-1">
                <Label className="text-xs">Category *</Label>
                <Popover open={categoryOpen} onOpenChange={setCategoryOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={categoryOpen}
                      className="w-full justify-between h-9 text-sm"
                    >
                      <span className="truncate text-left flex-1 mr-2">
                        {formData.semiExpandableCategory
                          ? semiExpandableCategories.find((cat) => cat.name === formData.semiExpandableCategory)?.name || formData.semiExpandableCategory
                          : "Select category..."}
                      </span>
                      <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                    <Command>
                      <CommandInput
                        placeholder="Search categories..."
                        value={categorySearch}
                        onValueChange={setCategorySearch}
                      />
                      <CommandList>
                        <CommandEmpty>No category found.</CommandEmpty>
                        <CommandGroup>
                          {semiExpandableCategories
                            .filter((cat) =>
                              categorySearch === "" ||
                              cat.name.toLowerCase().includes(categorySearch.toLowerCase())
                            )
                            .map((cat) => (
                              <CommandItem
                                key={cat.id}
                                value={cat.name}
                                onSelect={() => {
                                  setFormData({ ...formData, semiExpandableCategory: cat.name });
                                  setCategoryOpen(false);
                                  setCategorySearch("");
                                }}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    formData.semiExpandableCategory === cat.name
                                      ? "opacity-100"
                                      : "opacity-0"
                                  )}
                                />
                                {cat.name}
                              </CommandItem>
                            ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Description *</Label>
                  {descriptionManuallyEdited && (
                    <button
                      type="button"
                      className="text-[10px] text-blue-600 hover:underline"
                      onClick={() => {
                        setDescriptionManuallyEdited(false);
                        setFormData(prev => ({ ...prev, description: computedDescription }));
                      }}
                    >
                      Reset
                    </button>
                  )}
                </div>
                <Input
                  id="description"
                  value={formData.description || ''}
                  onChange={(e) => {
                    setDescriptionManuallyEdited(true);
                    setFormData(prev => ({ ...prev, description: e.target.value }));
                  }}
                  placeholder="Auto-fills from Brand + Model + SN"
                  className="h-9 text-sm"
                />
              </div>
            </div>

            {/* Row 2: Brand, Model, Serial */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 border-t pt-3 pb-4">
              <div className="space-y-1">
                <Label className="text-xs">Brand</Label>
                <Input
                  id="brand"
                  value={formData.brand}
                  onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                  placeholder="e.g., Dell, HP"
                  className="h-9 text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Model</Label>
                <Input
                  id="model"
                  value={formData.model}
                  onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                  placeholder="e.g., OptiPlex 7090"
                  className="h-9 text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Serial Number</Label>
                <Input
                  id="serialNumber"
                  value={formData.serialNumber}
                  onChange={(e) => setFormData({ ...formData, serialNumber: e.target.value })}
                  placeholder="e.g., DL12345678"
                  className="h-9 text-sm"
                />
              </div>
            </div>

            {/* Row 3: Qty, Unit, Unit Cost, Total, Property # */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 border-t pt-3 pb-4">
              <div className="space-y-1">
                <Label className="text-xs">Qty *</Label>
                <Input
                  id="quantity"
                  type="number"
                  min="1"
                  value={formData.quantity}
                  onChange={(e) => setFormData({ ...formData, quantity: parseInt(e.target.value) || 1 })}
                  required
                  className="h-9 text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Unit *</Label>
                <Select value={formData.unitOfMeasure} onValueChange={(value) => setFormData({ ...formData, unitOfMeasure: value })}>
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="piece">Piece</SelectItem>
                    <SelectItem value="set">Set</SelectItem>
                    <SelectItem value="unit">Unit</SelectItem>
                    <SelectItem value="lot">Lot</SelectItem>
                    <SelectItem value="pair">Pair</SelectItem>
                    <SelectItem value="dozen">Dozen</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Unit Cost *</Label>
                <Input
                  id="unitCost"
                  type="number"
                  step="0.01"
                  min="0.01"
                  max="50000"
                  value={formData.unitCost || ''}
                  onChange={(e) => {
                    const value = parseFloat(e.target.value);
                    if (isNaN(value)) {
                      setFormData({ ...formData, unitCost: undefined });
                    } else {
                      setFormData({ ...formData, unitCost: value > 50000 ? 50000 : value });
                    }
                  }}
                  onBlur={(e) => {
                    const value = parseFloat(e.target.value);
                    if (!value || value <= 0) {
                      setFormData({ ...formData, unitCost: 0.01 });
                    } else if (value > 50000) {
                      setFormData({ ...formData, unitCost: 50000 });
                    }
                  }}
                  required
                  placeholder="₱0.01 – ₱50,000"
                  className={`h-9 text-sm ${!unitCostValidation.isValid ? "border-red-500" : ""} ${formData.unitCost && formData.unitCost > 5000 ? "bg-orange-50" : ""}`}
                />
                {!unitCostValidation.isValid && (
                  <p className="text-[10px] text-red-600">{unitCostValidation.message}</p>
                )}
                {formData.unitCost !== undefined && formData.unitCost !== null && formData.unitCost >= 0.01 && (
                  <span className={`text-[10px] px-1.5 py-0.5 rounded ${formData.unitCost <= 5000 ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                    {formData.unitCost <= 5000 ? 'SPLV' : 'SPHV'}
                  </span>
                )}
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Total</Label>
                <div className="h-9 px-3 flex items-center bg-muted rounded-md text-sm font-medium">
                  ₱{((formData.quantity || 0) * (formData.unitCost || 0)).toFixed(2)}
                </div>
              </div>
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Property # *</Label>
                  {formData.subCategory && !isLegacyMode && (
                    <button
                      type="button"
                      onClick={() => {
                        if (formData.subCategory) {
                          generatePropertyNumber(formData.subCategory as 'Small Value Expendable' | 'High Value Expendable');
                        }
                      }}
                      className="text-[10px] text-blue-600 hover:underline"
                    >
                      Regen
                    </button>
                  )}
                </div>
                <Input
                  id="propertyNumber"
                  value={formData.propertyNumber}
                  onChange={(e) => handlePropertyNumberChange(e.target.value)}
                  className={`h-9 text-sm font-mono ${isLegacyMode ? "" : (formData.subCategory ? "bg-green-50 border-green-300" : "bg-muted")}`}
                  placeholder={isLegacyMode ? "Enter property #" : "Auto-generated"}
                  readOnly={!isLegacyMode}
                />
                {isLegacyMode && (
                  <p className="text-[10px] text-muted-foreground">Any format allowed</p>
                )}
              </div>
            </div>

            {/* Row 4: Date, Supplier, Fund Source */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 border-t pt-3 pb-4">
              <div className="space-y-1">
                <Label className="text-xs">Date Acquired *</Label>
                <Input
                  id="dateAcquired"
                  type="date"
                  value={formData.dateAcquired}
                  max={new Date().toISOString().split('T')[0]}
                  onChange={(e) => setFormData({ ...formData, dateAcquired: e.target.value })}
                  required
                  className="h-9 text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Supplier</Label>
                <Select value={formData.supplier} onValueChange={(value) => setFormData({ ...formData, supplier: value })}>
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue placeholder="Select supplier" />
                  </SelectTrigger>
                  <SelectContent>
                    {suppliers.map((supplier) => (
                      <SelectItem key={supplier.id} value={supplier.id}>
                        {supplier.name}
                      </SelectItem>
                    ))}
                    <div className="p-2">
                      <Button type="button" variant="outline" size="sm" onClick={() => setOpenAddLookup({ type: 'supplier' })}>+ Add supplier</Button>
                    </div>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Fund Source</Label>
                <Select value={formData.fundSource} onValueChange={(value) => setFormData({ ...formData, fundSource: value })}>
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue placeholder="Select fund source" />
                  </SelectTrigger>
                  <SelectContent>
                    {fundSources.map((source) => (
                      <SelectItem key={source.id} value={source.id}>
                        {source.name}
                      </SelectItem>
                    ))}
                    <div className="p-2">
                      <Button type="button" variant="outline" size="sm" onClick={() => setOpenAddLookup({ type: 'fundSource' })}>+ Add fund source</Button>
                    </div>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Row 5: Optional dates & EUL */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 border-t pt-3 pb-4">
              <div className="space-y-1">
                <Label className="text-xs">Warranty End <span className="text-muted-foreground">(Optional)</span></Label>
                <Input
                  id="warrantyEndDate"
                  type="date"
                  value={formData.warrantyEndDate || ""}
                  onChange={(e) => setFormData({ ...formData, warrantyEndDate: e.target.value })}
                  className="h-9 text-sm"
                />
                {warrantyDaysLabel && (
                  <p className={cn("text-[10px] font-medium", warrantyDaysLabel.className)}>{warrantyDaysLabel.text}</p>
                )}
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Lifespan End <span className="text-muted-foreground">(Optional)</span></Label>
                <Input
                  id="lifespanEndDate"
                  type="date"
                  value={formData.lifespanEndDate || ""}
                  onChange={(e) => setFormData({ ...formData, lifespanEndDate: e.target.value })}
                  className="h-9 text-sm"
                />
                {lifespanDaysLabel && (
                  <p className={cn("text-[10px] font-medium", lifespanDaysLabel.className)}>{lifespanDaysLabel.text}</p>
                )}
              </div>
              <div className="space-y-1">
                <Label className="text-xs">EUL <span className="text-muted-foreground">(Optional)</span></Label>
                <Input
                  id="estimatedUsefulLife"
                  value={formData.estimatedUsefulLife || ""}
                  placeholder="e.g., 3 yrs"
                  onChange={(e) => setFormData({ ...formData, estimatedUsefulLife: e.target.value })}
                  className="h-9 text-sm"
                />
              </div>
            </div>

            {/* Row 6: Condition, Status, Remarks */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 border-t pt-3 pb-4">
              <div className="space-y-1">
                <Label className="text-xs">Condition</Label>
                <Select value={formData.condition} onValueChange={(value) => setFormData({ ...formData, condition: value as InventoryItem['condition'] })}>
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Serviceable">Serviceable</SelectItem>
                    <SelectItem value="Unserviceable">Unserviceable</SelectItem>
                    <SelectItem value="For Repair">For Repair</SelectItem>
                    <SelectItem value="Obsolete">Obsolete</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Status</Label>
                <Select value={formData.status} onValueChange={(value) => setFormData({ ...formData, status: value as InventoryItem['status'] })}>
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Active">Active</SelectItem>
                    <SelectItem value="Transferred">Transferred</SelectItem>
                    <SelectItem value="Disposed">Disposed</SelectItem>
                    <SelectItem value="Missing">Missing</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Remarks</Label>
                <Input
                  id="remarks"
                  value={formData.remarks}
                  onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                  placeholder="Any additional notes..."
                  className="h-9 text-sm"
                />
              </div>
            </div>

            {/* Error display */}
            {overrideError && (
              <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded p-2">{overrideError}</div>
            )}

            {/* Actions */}
            <div className="flex justify-end space-x-2 border-t pt-4">
              <Button type="button" variant="outline" size="sm" onClick={onCancel}>
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={isSaving || loading}>
                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {item ? "Update Item" : "Save Item"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Add Lookup Dialog */}
      <Dialog open={!!openAddLookup.type} onOpenChange={(open) => !open && setOpenAddLookup({ type: null })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New {openAddLookup.type === 'supplier' ? 'Supplier' : 'Fund Source'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="newName">Name</Label>
              <Input
                id="newName"
                value={newLookup.name}
                onChange={(e) => setNewLookup({ ...newLookup, name: e.target.value })}
                placeholder={`Enter ${openAddLookup.type} name`}
              />
            </div>
            <Button onClick={createLookup} className="w-full">
              Add {openAddLookup.type === 'supplier' ? 'Supplier' : 'Fund Source'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
