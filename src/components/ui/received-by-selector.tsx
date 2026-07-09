import React, { useState, useEffect, useMemo } from 'react';
import { Check, ChevronsUpDown, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { useQuery } from '@tanstack/react-query';
import { custodianService } from '@/services/custodianService';
import { Custodian } from '@/services/custodianService';

interface ReceivedBySelectorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
  required?: boolean;
  className?: string;
}

export const ReceivedBySelector: React.FC<ReceivedBySelectorProps> = ({
  value,
  onChange,
  placeholder = "Search for custodian or enter manually...",
  label = "Received By",
  required = false,
  className
}) => {
  const [open, setOpen] = useState(false);
  const [isManualMode, setIsManualMode] = useState(false);
  const [manualValue, setManualValue] = useState(value);

  // Fetch custodians for the dropdown
  const { data: custodians = [], isLoading, error } = useQuery({
    queryKey: ['custodians-for-received-by'],
    queryFn: async () => {
      try {
        const custodians = await custodianService.getAll();
        return custodians || [];
      } catch (error) {
        console.error('Error fetching custodians:', error);
        return [];
      }
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Filter custodians based on search
  const filteredCustodians = useMemo(() => {
    if (!value || value.length < 2) return custodians;
    return custodians.filter((custodian: Custodian) =>
      custodian.name.toLowerCase().includes(value.toLowerCase()) ||
      custodian.position?.toLowerCase().includes(value.toLowerCase()) ||
      custodian.department_name?.toLowerCase().includes(value.toLowerCase())
    );
  }, [custodians, value]);

  // Handle manual input toggle
  const handleManualToggle = () => {
    setIsManualMode(!isManualMode);
    if (!isManualMode) {
      // Switching to manual mode - clear the current value
      setManualValue('');
      onChange('');
    } else {
      // Switching back to dropdown mode
      setManualValue('');
    }
  };

  // Handle custodian selection from dropdown
  const handleCustodianSelect = (custodianName: string) => {
    onChange(custodianName);
    setOpen(false);
    setIsManualMode(false);
  };

  // Handle manual input change
  const handleManualChange = (inputValue: string) => {
    setManualValue(inputValue);
    onChange(inputValue);
  };

  // Sync manual value with external value changes
  useEffect(() => {
    if (isManualMode) {
      setManualValue(value);
    }
  }, [value, isManualMode]);

  return (
    <div className={cn("space-y-2", className)}>
      <Label htmlFor="received-by-selector">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </Label>
      
      <div className="flex gap-2">
        <div className="flex-1">
          {isManualMode ? (
            <Input
              id="received-by-manual"
              value={manualValue}
              onChange={(e) => handleManualChange(e.target.value)}
              placeholder="Enter receiver name manually..."
              className="w-full"
            />
          ) : (
            <Popover open={open} onOpenChange={setOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={open}
                  className="w-full justify-between"
                >
                  {value ? (
                    <span className="truncate">{value}</span>
                  ) : (
                    <span className="text-muted-foreground">{placeholder}</span>
                  )}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-full p-0" align="start">
                <Command>
                  <CommandInput placeholder="Search custodians..." />
                  <CommandList>
                    <CommandEmpty>
                      {isLoading ? "Loading custodians..." : "No custodians found."}
                    </CommandEmpty>
                    <CommandGroup>
                      {filteredCustodians.map((custodian: Custodian) => (
                        <CommandItem
                          key={custodian.id}
                          value={custodian.name}
                          onSelect={() => handleCustodianSelect(custodian.name)}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              value === custodian.name ? "opacity-100" : "opacity-0"
                            )}
                          />
                          <div className="flex flex-col">
                            <span className="font-medium">{custodian.name}</span>
                            <span className="text-sm text-muted-foreground">
                              {custodian.position} • {custodian.department_name}
                            </span>
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          )}
        </div>
        
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleManualToggle}
          className="px-3"
          title={isManualMode ? "Switch to dropdown selection" : "Switch to manual input"}
        >
          <User className="h-4 w-4" />
        </Button>
      </div>
      
      <div className="text-xs text-muted-foreground">
        {isManualMode ? (
          "Manual input mode - type the receiver's name directly"
        ) : (
          "Dropdown mode - search and select from existing custodians"
        )}
      </div>
    </div>
  );
};
