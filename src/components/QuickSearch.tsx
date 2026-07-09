import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Package, User, FileText, Receipt, FileCheck, Loader2, FileSpreadsheet } from 'lucide-react';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { globalSearchService, SearchResult } from '@/services/globalSearchService';
import { useQuery } from '@tanstack/react-query';

interface QuickSearchProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const QuickSearch = ({ open, onOpenChange }: QuickSearchProps) => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');

  // Debounce search query to prevent too many API calls
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 300); // 300ms debounce

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const { data: searchResults, isLoading } = useQuery({
    queryKey: ['global-search', debouncedQuery],
    queryFn: () => globalSearchService.search(debouncedQuery, 10),
    enabled: debouncedQuery.trim().length > 0 && open,
    staleTime: 0,
    gcTime: 0, // Don't cache results - always fetch fresh data
  });

  useEffect(() => {
    if (!open) {
      setSearchQuery('');
    }
  }, [open]);

  const handleSelect = (result: SearchResult) => {
    switch (result.type) {
      case 'inventory':
        // Navigate to inventory with search parameter
        navigate(`/inventory?search=${encodeURIComponent(result.title)}`);
        break;
      case 'custodian':
        // Navigate to custodians page with search
        navigate(`/custodians?search=${encodeURIComponent(result.title)}`);
        break;
      case 'transfer':
        // Navigate to transfers page - transfers don't have a search param yet
        navigate(`/transfers`);
        break;
      case 'ics':
        // Navigate to custodian slips page with search
        navigate(`/custodian-slips?search=${encodeURIComponent(result.title)}`);
        break;
      case 'property-card':
        // Navigate to property cards page with search
        navigate(`/property-cards?search=${encodeURIComponent(result.title)}`);
        break;
    }
    onOpenChange(false);
  };

  const handleOpenPersonnelReport = (result: SearchResult) => {
    // Only for custodian results
    if (result.type !== 'custodian') return;
    navigate(`/reports/personnel?custodianId=${encodeURIComponent(result.id)}`);
    onOpenChange(false);
  };

  const getTypeIcon = (type: SearchResult['type']) => {
    switch (type) {
      case 'inventory':
        return <Package className="h-4 w-4" />;
      case 'custodian':
        return <User className="h-4 w-4" />;
      case 'transfer':
        return <FileText className="h-4 w-4" />;
      case 'ics':
        return <Receipt className="h-4 w-4" />;
      case 'property-card':
        return <FileCheck className="h-4 w-4" />;
    }
  };

  const getTypeLabel = (type: SearchResult['type']) => {
    switch (type) {
      case 'inventory':
        return 'Inventory Item';
      case 'custodian':
        return 'Custodian';
      case 'transfer':
        return 'Transfer (ITR)';
      case 'ics':
        return 'ICS Slip';
      case 'property-card':
        return 'Property Card';
    }
  };

  const allResults: SearchResult[] = searchResults
    ? [
        ...searchResults.inventory,
        ...searchResults.custodians,
        ...searchResults.transfers,
        ...searchResults.icsSlips,
        ...searchResults.propertyCards,
      ]
    : [];

  // Debug logging
  useEffect(() => {
    if (open && debouncedQuery) {
      console.log('QuickSearch - Query:', debouncedQuery);
      console.log('QuickSearch - Results:', searchResults);
      console.log('QuickSearch - All Results Count:', allResults.length);
    }
  }, [open, debouncedQuery, searchResults, allResults.length]);

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange} shouldFilter={false}>
      <CommandInput
        placeholder="Search inventory, custodians, transfers, ICS slips, property cards..."
        value={searchQuery}
        onValueChange={setSearchQuery}
      />
      <CommandList>
        {isLoading && debouncedQuery.trim().length > 0 && (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            <span className="ml-2 text-sm text-muted-foreground">Searching...</span>
          </div>
        )}
        {!isLoading && searchQuery.trim().length === 0 && (
          <CommandEmpty>
            <div className="flex flex-col items-center justify-center py-6">
              <Search className="h-8 w-8 text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">Start typing to search...</p>
              <p className="text-xs text-muted-foreground mt-1">
                Search by property number, custodian name, ITR/ICS number, subcategory, or date
              </p>
            </div>
          </CommandEmpty>
        )}
        {!isLoading && debouncedQuery.trim().length > 0 && allResults.length === 0 && (
          <CommandEmpty>No results found.</CommandEmpty>
        )}
        {!isLoading && debouncedQuery.trim().length > 0 && allResults.length > 0 && (
          <>
            {searchResults?.inventory && searchResults.inventory.length > 0 && (
              <CommandGroup heading="Inventory Items">
                {searchResults.inventory.map((result) => (
                  <CommandItem
                    key={`${result.type}-${result.id}`}
                    onSelect={() => handleSelect(result)}
                    className="cursor-pointer"
                  >
                    {getTypeIcon(result.type)}
                    <div className="ml-2 flex flex-col">
                      <span className="font-medium">{result.title}</span>
                      {result.subtitle && (
                        <span className="text-xs text-muted-foreground">{result.subtitle}</span>
                      )}
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            {searchResults?.custodians && searchResults.custodians.length > 0 && (
              <CommandGroup heading="Custodians">
                {searchResults.custodians.map((result) => (
                  <div key={`${result.type}-${result.id}`}>
                    <CommandItem onSelect={() => handleSelect(result)} className="cursor-pointer">
                      {getTypeIcon(result.type)}
                      <div className="ml-2 flex flex-col">
                        <span className="font-medium">{result.title}</span>
                        {result.subtitle && (
                          <span className="text-xs text-muted-foreground">{result.subtitle}</span>
                        )}
                      </div>
                    </CommandItem>

                    <CommandItem
                      onSelect={() => handleOpenPersonnelReport(result)}
                      className="cursor-pointer pl-8 text-sm"
                    >
                      <FileSpreadsheet className="h-4 w-4" />
                      <div className="ml-2 flex flex-col">
                        <span className="font-medium">Personnel Report</span>
                        <span className="text-xs text-muted-foreground">Printable accountability listing</span>
                      </div>
                    </CommandItem>
                  </div>
                ))}
              </CommandGroup>
            )}
            {searchResults?.transfers && searchResults.transfers.length > 0 && (
              <CommandGroup heading="Transfers (ITR)">
                {searchResults.transfers.map((result) => (
                  <CommandItem
                    key={`${result.type}-${result.id}`}
                    onSelect={() => handleSelect(result)}
                    className="cursor-pointer"
                  >
                    {getTypeIcon(result.type)}
                    <div className="ml-2 flex flex-col">
                      <span className="font-medium">{result.title}</span>
                      {result.subtitle && (
                        <span className="text-xs text-muted-foreground">{result.subtitle}</span>
                      )}
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            {searchResults?.icsSlips && searchResults.icsSlips.length > 0 && (
              <CommandGroup heading="ICS Slips">
                {searchResults.icsSlips.map((result) => (
                  <CommandItem
                    key={`${result.type}-${result.id}`}
                    onSelect={() => handleSelect(result)}
                    className="cursor-pointer"
                  >
                    {getTypeIcon(result.type)}
                    <div className="ml-2 flex flex-col">
                      <span className="font-medium">{result.title}</span>
                      {result.subtitle && (
                        <span className="text-xs text-muted-foreground">{result.subtitle}</span>
                      )}
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            {searchResults?.propertyCards && searchResults.propertyCards.length > 0 && (
              <CommandGroup heading="Property Cards">
                {searchResults.propertyCards.map((result) => (
                  <CommandItem
                    key={`${result.type}-${result.id}`}
                    onSelect={() => handleSelect(result)}
                    className="cursor-pointer"
                  >
                    {getTypeIcon(result.type)}
                    <div className="ml-2 flex flex-col">
                      <span className="font-medium">{result.title}</span>
                      {result.subtitle && (
                        <span className="text-xs text-muted-foreground">{result.subtitle}</span>
                      )}
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </>
        )}
      </CommandList>
    </CommandDialog>
  );
};

