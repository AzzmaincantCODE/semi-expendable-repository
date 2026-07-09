// Custom hook for property card management with Supabase
import { useState, useEffect, useRef, useCallback } from 'react';
import { supabaseService } from '../services/supabaseService';
import { supabase } from '../lib/supabase';

export interface PropertyCard {
  id: string;
  entityName: string;
  fundCluster: string;
  semiExpendableProperty: string;
  propertyNumber: string;
  description: string;
  dateAcquired: string;
  remarks?: string;
  createdAt: string;
  updatedAt: string;
  // Optional on reads that join entries; used by UI for printing/details
  entries?: SPCEntry[];
}

export interface SPCEntry {
  id: string;
  propertyCardId: string;
  date: string;
  reference: string;
  receiptQty: number;
  unitCost: number;
  totalCost: number;
  issueItemNo: string;
  issueQty: number;
  officeOfficer: string;
  balanceQty: number;
  amount: number;
  createdAt: string;
  updatedAt: string;
}

export const useSupabasePropertyCards = () => {
  const [cards, setCards] = useState<PropertyCard[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 0,
  });
  const loadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load all property cards
  const loadCards = useCallback(async (filters = {}) => {
    setLoading(true);
    setError(null);
    try {
      const response = await supabaseService.propertyCards.getAll(filters);
      if (response.success && response.data) {
        setCards(response.data);
        setPagination(response.pagination);
      } else {
        setError(response.error || 'Failed to load property cards');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }, []);

  const scheduleLoadCards = useCallback((filters = {}, delay = 150) => {
    if (loadTimerRef.current) {
      clearTimeout(loadTimerRef.current);
    }

    loadTimerRef.current = setTimeout(() => {
      loadCards(filters);
    }, delay);
  }, [loadCards]);

  // Create new property card
  const createCard = async (card: Omit<PropertyCard, 'id' | 'createdAt' | 'updatedAt'>) => {
    setLoading(true);
    setError(null);
    try {
      const response = await supabaseService.propertyCards.create(card);
      if (response.success && response.data) {
        setCards(prev => [response.data!, ...prev]);
        return response.data;
      } else {
        setError(response.error || 'Failed to create property card');
        return null;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      return null;
    } finally {
      setLoading(false);
    }
  };

  // Update property card
  const updateCard = async (id: string, updates: Partial<PropertyCard>) => {
    setLoading(true);
    setError(null);
    try {
      const response = await supabaseService.propertyCards.update(id, updates);
      if (response.success && response.data) {
        setCards(prev => 
          prev.map(card => card.id === id ? response.data! : card)
        );
        return response.data;
      } else {
        setError(response.error || 'Failed to update property card');
        return null;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      return null;
    } finally {
      setLoading(false);
    }
  };

  // Delete property card
  const deleteCard = async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await supabaseService.propertyCards.delete(id);
      if (response.success) {
        setCards(prev => prev.filter(card => card.id !== id));
        return true;
      } else {
        setError(response.error || 'Failed to delete property card');
        return false;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      return false;
    } finally {
      setLoading(false);
    }
  };

  // Get property card with entries
  const getCardWithEntries = async (id: string) => {
    try {
      const response = await supabaseService.propertyCards.getWithEntries(id);
      if (response.success && response.data) {
        return response.data;
      } else {
        setError(response.error || 'Failed to get property card with entries');
        return null;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      return null;
    }
  };

  // Add entry to property card
  const addEntry = async (propertyCardId: string, entry: Omit<SPCEntry, 'id' | 'propertyCardId' | 'createdAt' | 'updatedAt'>) => {
    try {
      const response = await supabaseService.propertyCards.addEntry(propertyCardId, entry);
      if (response.success && response.data) {
        return response.data;
      } else {
        setError(response.error || 'Failed to add entry');
        return null;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      return null;
    }
  };

  // Update entry
  const updateEntry = async (propertyCardId: string, entryId: string, updates: Partial<SPCEntry>) => {
    try {
      const response = await supabaseService.propertyCards.updateEntry(propertyCardId, entryId, updates);
      if (response.success && response.data) {
        return response.data;
      } else {
        setError(response.error || 'Failed to update entry');
        return null;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      return null;
    }
  };

  // Delete entry
  const deleteEntry = async (propertyCardId: string, entryId: string) => {
    try {
      const response = await supabaseService.propertyCards.deleteEntry(propertyCardId, entryId);
      if (response.success) {
        return true;
      } else {
        setError(response.error || 'Failed to delete entry');
        return false;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      return false;
    }
  };

  // Search property cards
  const searchCards = async (query: string, filters = {}) => {
    setLoading(true);
    setError(null);
    try {
      const response = await supabaseService.propertyCards.search(query, filters);
      if (response.success && response.data) {
        setCards(response.data);
        setPagination(response.pagination);
        return response.data;
      } else {
        setError(response.error || 'Failed to search property cards');
        return [];
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      return [];
    } finally {
      setLoading(false);
    }
  };

  // Load cards on mount + realtime + focus refetch
  useEffect(() => {
    loadCards();

    const channel = supabase
      .channel('realtime:property_cards')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'property_cards' }, () => scheduleLoadCards())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'property_card_entries' }, () => {/* leave list; details refetch on open */})
      .subscribe();

    const onFocus = () => scheduleLoadCards();
    window.addEventListener('focus', onFocus);

    return () => {
      supabase.removeChannel(channel);
      window.removeEventListener('focus', onFocus);
      if (loadTimerRef.current) {
        clearTimeout(loadTimerRef.current);
      }
    };
  }, [loadCards, scheduleLoadCards]);

  return {
    cards,
    loading,
    error,
    pagination,
    loadCards,
    createCard,
    updateCard,
    deleteCard,
    getCardWithEntries,
    addEntry,
    updateEntry,
    deleteEntry,
    searchCards,
  };
};
