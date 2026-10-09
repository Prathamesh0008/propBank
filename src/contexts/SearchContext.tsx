"use client";

import React, { createContext, useContext, useState, useCallback } from 'react';

interface SearchContextType {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  searchType: string;
  setSearchType: (type: string) => void;
  selectedCategories: string[];
  setSelectedCategories: (categories: string[]) => void;
  selectedListingTypes: string[];
  setSelectedListingTypes: (types: string[]) => void;
  isSearching: boolean;
  setIsSearching: (searching: boolean) => void;
  triggerSearch: () => void;
  clearSearch: () => void;
  onSearchTrigger: (() => void) | null;
  setOnSearchTrigger: (trigger: (() => void) | null) => void;
}

const SearchContext = createContext<SearchContextType | undefined>(undefined);

export const SearchProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchType, setSearchType] = useState("all");
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedListingTypes, setSelectedListingTypes] = useState<string[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [onSearchTrigger, setOnSearchTrigger] = useState<(() => void) | null>(null);

  const triggerSearch = useCallback(() => {
    if (onSearchTrigger) {
      onSearchTrigger();
    }
  }, [onSearchTrigger]);

  const clearSearch = useCallback(() => {
    setSearchQuery("");
    setSearchType("all");
    setSelectedCategories([]);
    setSelectedListingTypes([]);
    setIsSearching(false);
  }, []);

  const value: SearchContextType = {
    searchQuery,
    setSearchQuery,
    searchType,
    setSearchType,
    selectedCategories,
    setSelectedCategories,
    selectedListingTypes,
    setSelectedListingTypes,
    isSearching,
    setIsSearching,
    triggerSearch,
    clearSearch,
    onSearchTrigger,
    setOnSearchTrigger,
  };

  return (
    <SearchContext.Provider value={value}>
      {children}
    </SearchContext.Provider>
  );
};

export const useSearch = () => {
  const context = useContext(SearchContext);
  if (context === undefined) {
    throw new Error('useSearch must be used within a SearchProvider');
  }
  return context;
};
