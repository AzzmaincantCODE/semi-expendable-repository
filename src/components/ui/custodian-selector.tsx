import { useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, ChevronDown, Search, User, Building2, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { custodianService, Custodian } from "@/services/custodianService";
import { QuickCustodianDialog } from "@/components/custodians/QuickCustodianDialog";

interface CustodianSelectorProps {
  value: string;
  onChange: (custodianName: string, custodianData?: Custodian) => void;
  placeholder?: string;
  label?: string;
  required?: boolean;
  className?: string;
  /** When false, inactive custodians are included (default: true). */
  onlyActive?: boolean;
  /** Max results from the server (default: 20). */
  resultLimit?: number;
}

export const CustodianSelector = ({
  value,
  onChange,
  placeholder = "Search for custodian...",
  label = "Custodian Name",
  required = false,
  className,
  onlyActive = true,
  resultLimit = 20
}: CustodianSelectorProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [hasTypedSinceOpen, setHasTypedSinceOpen] = useState(false);
  const [selectedCustodian, setSelectedCustodian] = useState<Custodian | null>(null);
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  // When the dropdown opens, load all custodians until the user types (avoids locking
  // the list to the currently selected name and blocking another custodian).
  const querySearch =
    isOpen && !hasTypedSinceOpen ? "" : searchTerm.trim();

  const { data: custodians = [], isLoading } = useQuery({
    queryKey: ['custodians-search', querySearch, onlyActive, resultLimit],
    queryFn: () =>
      custodianService.getAll({
        search: querySearch || undefined,
        ...(onlyActive ? { is_active: true } : {}),
        limit: resultLimit
      }),
    enabled: isOpen,
    staleTime: 10 * 1000, // 10 seconds - much faster refresh
    refetchOnWindowFocus: true, // Auto-refresh when user returns to window
    refetchInterval: 30 * 1000, // Auto-refresh every 30 seconds when dropdown is open
  });

  useEffect(() => {
    if (isOpen) {
      setHasTypedSinceOpen(false);
    }
  }, [isOpen]);

  // Client-side filter only when the user is actively searching
  const filteredCustodians =
    isOpen && hasTypedSinceOpen && searchTerm.trim()
      ? custodians.filter(
          (custodian) =>
            custodian.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            custodian.custodian_no.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (custodian.department_name &&
              custodian.department_name.toLowerCase().includes(searchTerm.toLowerCase()))
        )
      : custodians;

  // Handle custodian selection
  const handleSelectCustodian = (custodian: Custodian) => {
    setSelectedCustodian(custodian);
    setSearchTerm(custodian.name);
    setIsOpen(false);
    onChange(custodian.name, custodian);
  };

  // Handle input change
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setSearchTerm(newValue);
    setHasTypedSinceOpen(true);

    if (!newValue) {
      setSelectedCustodian(null);
      onChange("");
    } else {
      if (selectedCustodian && newValue !== selectedCustodian.name) {
        setSelectedCustodian(null);
      }
      onChange(newValue);
    }

    setIsOpen(true);
  };

  // Handle input focus
  const handleInputFocus = () => {
    setIsOpen(true);
    if (!searchTerm && selectedCustodian) {
      setSearchTerm(selectedCustodian.name);
    }
  };

  // Handle input blur with delay to allow clicking on dropdown items
  const handleInputBlur = () => {
    setTimeout(() => {
      setIsOpen(false);
    }, 200);
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Initialize with value if provided
  useEffect(() => {
    if (value && !selectedCustodian) {
      setSearchTerm(value);
    }
  }, [value, selectedCustodian]);

  return (
    <div className={cn("relative", className)} ref={dropdownRef}>
      {label && (
        <Label htmlFor="custodian-selector" className="text-sm font-medium">
          {label} {required && <span className="text-red-500">*</span>}
        </Label>
      )}

      <div className="relative">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            ref={inputRef}
            id="custodian-selector"
            value={searchTerm}
            onChange={handleInputChange}
            onFocus={handleInputFocus}
            onBlur={handleInputBlur}
            placeholder={placeholder}
            className="pl-10 pr-10"
            autoComplete="off"
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="absolute right-1 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0"
            onClick={() => setIsOpen(!isOpen)}
          >
            <ChevronDown className={cn("h-4 w-4 transition-transform", isOpen && "rotate-180")} />
          </Button>
        </div>

        {/* Dropdown */}
        {isOpen && (
          <div className="absolute z-50 w-full mt-1 bg-card border border-border rounded-md shadow-lg max-h-60 overflow-auto">
            {isLoading ? (
              <div className="p-3 text-center text-sm text-muted-foreground">
                Loading custodians...
              </div>
            ) : filteredCustodians.length === 0 ? (
              <div className="p-3 text-center text-sm text-muted-foreground">
                {searchTerm ? "No custodians found" : "Start typing to search custodians"}
              </div>
            ) : (
              <div className="py-1">
                {filteredCustodians.map((custodian) => (
                  <button
                    key={custodian.id}
                    type="button"
                    className="w-full px-3 py-2 text-left hover:bg-secondary focus:bg-secondary focus:outline-none"
                    onClick={() => handleSelectCustodian(custodian)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <div className="font-medium">{custodian.name}</div>
                          <div className="text-sm text-muted-foreground">
                            {custodian.custodian_no}
                            {custodian.department_name && (
                              <>
                                {" • "}
                                <Building2 className="inline h-3 w-3 mr-1" />
                                {custodian.department_name}
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                      {selectedCustodian?.id === custodian.id && (
                        <Check className="h-4 w-4 text-green-600" />
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}

            {/* Quick Add Button */}
            <div className="border-t border-border">
              <button
                type="button"
                className="w-full px-3 py-2 text-left hover:bg-secondary focus:bg-secondary focus:outline-none flex items-center gap-2 text-primary"
                onClick={() => {
                  setShowQuickAdd(true);
                  setIsOpen(false);
                }}
              >
                <Plus className="h-4 w-4" />
                <span className="font-medium">Create New Custodian</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Selected custodian info */}
      {selectedCustodian && (
        <div className="mt-2 p-2 bg-green-50 border border-green-200 rounded-md">
          <div className="flex items-center gap-2">
            <Check className="h-4 w-4 text-green-600" />
            <div className="text-sm">
              <span className="font-medium text-green-800">Selected: {selectedCustodian.name}</span>
              <div className="text-green-600">
                {selectedCustodian.custodian_no}
                {selectedCustodian.department_name && ` • ${selectedCustodian.department_name}`}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Quick Add Dialog */}
      <QuickCustodianDialog
        open={showQuickAdd}
        onOpenChange={setShowQuickAdd}
        onSuccess={async (newCustodian) => {
          // Refresh custodians list
          await queryClient.invalidateQueries({ queryKey: ['custodians-search'] });

          // Fetch the full custodian data
          const fullCustodian = await custodianService.getById(newCustodian.id);
          if (fullCustodian) {
            handleSelectCustodian(fullCustodian);
          }

          setShowQuickAdd(false);
        }}
      />
    </div>
  );
};
