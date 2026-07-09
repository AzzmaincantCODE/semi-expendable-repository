import { useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, ChevronDown, Search, Building2, Hash } from "lucide-react";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { lookupService, LookupItem } from "@/services/lookupService";

interface DepartmentSelectorProps {
  value: string;
  onChange: (departmentName: string, departmentData?: LookupItem) => void;
  placeholder?: string;
  label?: string;
  required?: boolean;
  className?: string;
}

export const DepartmentSelector = ({
  value,
  onChange,
  placeholder = "Search for department...",
  label = "Office/Department",
  required = false,
  className
}: DepartmentSelectorProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedDepartment, setSelectedDepartment] = useState<LookupItem | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Fetch departments with search
  const { data: departments = [], isLoading } = useQuery({
    queryKey: ['departments-search', searchTerm],
    queryFn: () => lookupService.getDepartments(),
    enabled: isOpen,
    staleTime: 5 * 60 * 1000
  });

  // Filter departments based on search term
  const filteredDepartments = departments.filter(department =>
    department.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (department.code && department.code.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  // Handle department selection
  const handleSelectDepartment = (department: LookupItem) => {
    setSelectedDepartment(department);
    setSearchTerm(department.name);
    setIsOpen(false);
    onChange(department.name, department);
  };

  // Handle input change
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setSearchTerm(newValue);
    
    // If user clears the input, clear selection
    if (!newValue) {
      setSelectedDepartment(null);
      onChange("");
    } else {
      // If user types something that doesn't match selected department, clear selection
      if (selectedDepartment && newValue !== selectedDepartment.name) {
        setSelectedDepartment(null);
        onChange(newValue);
      }
    }
    
    setIsOpen(true);
  };

  // Handle input focus
  const handleInputFocus = () => {
    setIsOpen(true);
    if (!searchTerm && selectedDepartment) {
      setSearchTerm(selectedDepartment.name);
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
    if (value && !selectedDepartment) {
      setSearchTerm(value);
    }
  }, [value, selectedDepartment]);

  return (
    <div className={cn("relative", className)} ref={dropdownRef}>
      {label && (
        <Label htmlFor="department-selector" className="text-sm font-medium">
          {label} {required && <span className="text-red-500">*</span>}
        </Label>
      )}
      
      <div className="relative">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            ref={inputRef}
            id="department-selector"
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
          <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-auto">
            {isLoading ? (
              <div className="p-3 text-center text-sm text-muted-foreground">
                Loading departments...
              </div>
            ) : filteredDepartments.length === 0 ? (
              <div className="p-3 text-center text-sm text-muted-foreground">
                {searchTerm ? "No departments found" : "Start typing to search departments"}
              </div>
            ) : (
              <div className="py-1">
                {filteredDepartments.map((department) => (
                  <button
                    key={department.id}
                    type="button"
                    className="w-full px-3 py-2 text-left hover:bg-secondary focus:bg-secondary focus:outline-none"
                    onClick={() => handleSelectDepartment(department)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <div className="font-medium">{department.name}</div>
                          {department.code && (
                            <div className="text-sm text-muted-foreground">
                              <Hash className="inline h-3 w-3 mr-1" />
                              {department.code}
                            </div>
                          )}
                        </div>
                      </div>
                      {selectedDepartment?.id === department.id && (
                        <Check className="h-4 w-4 text-green-600" />
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Selected department info */}
      {selectedDepartment && (
        <div className="mt-2 p-2 bg-green-50 border border-green-200 rounded-md">
          <div className="flex items-center gap-2">
            <Check className="h-4 w-4 text-green-600" />
            <div className="text-sm">
              <span className="font-medium text-green-800">Selected: {selectedDepartment.name}</span>
              {selectedDepartment.code && (
                <div className="text-green-600">
                  <Hash className="inline h-3 w-3 mr-1" />
                  {selectedDepartment.code}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
