"use client";

import React from "react";
import { Button } from "@/ui/button";
import { Input } from "@/ui/input";
import { Badge } from "@/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/ui/select";
import { Search, Filter, Home, Building2, Building, Factory } from "lucide-react";

interface SearchFilterSectionProps {
  searchType: string;
  setSearchType: (val: string) => void;
  searchQuery: string;
  setSearchQuery: (val: string) => void;
  selectedCategories: string[];
  handleCategoryToggle: (categoryId: string) => void;
  setSelectedCategories: (categories: string[]) => void;
  selectedProjectCondition: string;
  setSelectedProjectCondition: (val: string) => void;
  budgetRange: { min: number; max: number };
  setBudgetRange: (range: { min: number; max: number }) => void;
  clearFilters: () => void;
  handleSearch: () => void;
}

export const SearchFilterSection: React.FC<SearchFilterSectionProps> = ({
  searchType,
  setSearchType,
  searchQuery,
  setSearchQuery,
  selectedCategories,
  handleCategoryToggle,
  setSelectedCategories,
  selectedProjectCondition,
  setSelectedProjectCondition,
  budgetRange,
  setBudgetRange,
  clearFilters,
  handleSearch,
}) => {
  return (
    <section className="py-8 sm:py-12 px-4">
      <div className="container mx-auto max-w-6xl">
        <div className="text-center mb-6 sm:mb-8">
          <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-4">Find Your Dream Property</h2>
          <p className="text-gray-600 text-base sm:text-lg">Your dream property is just a search away</p>
        </div>

        <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-xl border border-gray-100">
          {/* Active Filters Display inside card */}
          {(selectedCategories.length > 0 || selectedProjectCondition || budgetRange.min > 0 || budgetRange.max > 0 || searchQuery || (searchType && searchType !== "all")) && (
            <div className="mb-6 bg-slate-50 border border-slate-100 rounded-2xl p-3 sm:p-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                  <span className="text-sm text-slate-500 font-medium">Active filters:</span>
                  <div className="flex gap-1.5 flex-wrap items-center">
                    {selectedCategories.map((category) => (
                      <Badge key={category} variant="secondary" className="capitalize text-xs py-0.5 px-2 bg-slate-200/60 hover:bg-slate-200/80 text-slate-700">
                        {category}
                      </Badge>
                    ))}
                    {searchQuery && (
                      <Badge variant="secondary" className="text-xs py-0.5 px-2 bg-slate-200/60 hover:bg-slate-200/80 text-slate-700">
                        "{searchQuery.length > 15 ? `${searchQuery.substring(0, 15)}...` : searchQuery}"
                      </Badge>
                    )}
                    {searchType && searchType !== "all" && (
                      <Badge variant="secondary" className="capitalize text-xs py-0.5 px-2 bg-slate-200/60 hover:bg-slate-200/80 text-slate-700">
                        For {searchType}
                      </Badge>
                    )}
                    {selectedProjectCondition && (
                      <Badge variant="default" className="bg-blue-600 text-white hover:bg-blue-700 text-xs py-0.5 px-2">
                        {selectedProjectCondition}
                      </Badge>
                    )}
                    {(budgetRange.min > 0 || budgetRange.max > 0) && (
                      <Badge variant="default" className="bg-emerald-600 text-white hover:bg-emerald-700 text-xs py-0.5 px-2">
                        ₹
                        {searchType === "rent"
                          ? `${budgetRange.min > 0 ? `${(budgetRange.min / 1000).toFixed(0)}K` : "0"} - ${
                              budgetRange.max > 0 ? `${(budgetRange.max / 1000).toFixed(0)}K` : "∞"
                            }/mo`
                          : `${budgetRange.min > 0 ? `${(budgetRange.min / 100000).toFixed(0)}L` : "0"} - ${
                              budgetRange.max > 0 ? `${(budgetRange.max / 100000).toFixed(0)}L` : "∞"
                            }`}
                      </Badge>
                    )}
                  </div>
                </div>
                <Button variant="ghost" size="sm" onClick={clearFilters} className="self-start sm:self-auto text-xs text-slate-500 hover:text-slate-900 h-8 px-2.5">
                  Clear All
                </Button>
              </div>
            </div>
          )}

          <div className="mb-8">
            <div className="flex items-center bg-white rounded-2xl border border-gray-200 shadow-sm focus-within:ring-2 focus-within:ring-slate-900 focus-within:border-transparent transition-all overflow-hidden group">
              <Select value={searchType} onValueChange={setSearchType}>
                <SelectTrigger className="w-32 border-0 border-r border-gray-200 rounded-none bg-gray-50/50 h-14 focus:ring-0 focus:ring-offset-0 font-semibold text-gray-700 px-6">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="buy">Buy</SelectItem>
                  <SelectItem value="rent">Rent</SelectItem>
                </SelectContent>
              </Select>

              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by location, type, or features..."
                className="flex-1 border-0 rounded-none bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 text-base py-7 px-6"
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              />
              <Button
                onClick={handleSearch}
                className="rounded-none px-8 h-14 bg-[#111827] hover:bg-[#1F2937] transition-all text-white font-semibold text-base flex items-center gap-2"
                variant="default"
              >
                <Search className="h-5 w-5" />
                <span>Search</span>
              </Button>
            </div>
          </div>

          {/* Filters Sections */}
          <div className="space-y-6">
            {/* Property Types */}
            <div className="space-y-2">
              <h3 className="text-base font-bold text-gray-900">Property Types</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <Button
                  variant="outline"
                  className={`h-14 rounded-xl flex items-center justify-center gap-3 transition-all duration-200 border-gray-200 shadow-sm hover:border-blue-200 hover:bg-blue-50/30 ${
                    selectedCategories.length === 0
                      ? "bg-[#111827] text-white border-[#111827] hover:bg-[#1F2937] hover:text-white"
                      : "text-gray-600 bg-white"
                  }`}
                  onClick={() => {
                    setSelectedCategories([]);
                  }}
                >
                  <Home className={`h-5 w-5 ${selectedCategories.length === 0 ? "text-white" : "text-gray-400"}`} />
                  <span className="font-semibold text-sm">All</span>
                </Button>
                <Button
                  variant="outline"
                  className={`h-14 rounded-xl flex items-center justify-center gap-3 transition-all duration-200 border-gray-200 shadow-sm hover:border-blue-200 hover:bg-blue-50/30 ${
                    selectedCategories.includes("residential")
                      ? "bg-[#111827] text-white border-[#111827] hover:bg-[#1F2937] hover:text-white"
                      : "text-gray-600 bg-white"
                  }`}
                  onClick={() => handleCategoryToggle("residential")}
                >
                  <Building2 className={`h-5 w-5 ${selectedCategories.includes("residential") ? "text-white" : "text-gray-400"}`} />
                  <span className="font-semibold text-sm">Residential</span>
                </Button>
                <Button
                  variant="outline"
                  className={`h-14 rounded-xl flex items-center justify-center gap-3 transition-all duration-200 border-gray-200 shadow-sm hover:border-blue-200 hover:bg-blue-50/30 ${
                    selectedCategories.includes("commercial")
                      ? "bg-[#111827] text-white border-[#111827] hover:bg-[#1F2937] hover:text-white"
                      : "text-gray-600 bg-white"
                  }`}
                  onClick={() => handleCategoryToggle("commercial")}
                >
                  <Building className={`h-5 w-5 ${selectedCategories.includes("commercial") ? "text-white" : "text-gray-400"}`} />
                  <span className="font-semibold text-sm">Commercial</span>
                </Button>
                <Button
                  variant="outline"
                  className={`h-14 rounded-xl flex items-center justify-center gap-3 transition-all duration-200 border-gray-200 shadow-sm hover:border-blue-200 hover:bg-blue-50/30 ${
                    selectedCategories.includes("industrial")
                      ? "bg-[#111827] text-white border-[#111827] hover:bg-[#1F2937] hover:text-white"
                      : "text-gray-600 bg-white"
                  }`}
                  onClick={() => handleCategoryToggle("industrial")}
                >
                  <Factory className={`h-5 w-5 ${selectedCategories.includes("industrial") ? "text-white" : "text-gray-400"}`} />
                  <span className="font-semibold text-sm">Industrial</span>
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-16 gap-y-6">
              {/* Project Types */}
              <div className="space-y-2">
                <h3 className="text-base font-bold text-gray-900">Project Types</h3>
                <div className="grid grid-cols-2 gap-4">
                  <Button
                    variant="outline"
                    onClick={() => setSelectedProjectCondition("")}
                    className={`h-10 rounded-xl font-semibold border-gray-200 shadow-sm transition-all text-sm ${
                      !selectedProjectCondition
                        ? "bg-[#111827] text-white border-[#111827] hover:bg-[#1F2937]"
                        : "text-gray-600 bg-white hover:bg-gray-50"
                    }`}
                  >
                    All Projects
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setSelectedProjectCondition("New Project")}
                    className={`h-10 rounded-xl font-semibold border-gray-200 shadow-sm transition-all text-sm ${
                      selectedProjectCondition === "New Project"
                        ? "bg-[#111827] text-white border-[#111827] hover:bg-[#1F2937]"
                        : "text-gray-600 bg-white hover:bg-gray-50"
                    }`}
                  >
                    New Project
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setSelectedProjectCondition("Ready Project")}
                    className={`h-10 rounded-xl font-semibold border-gray-200 shadow-sm transition-all text-sm ${
                      selectedProjectCondition === "Ready Project"
                        ? "bg-[#111827] text-white border-[#111827] hover:bg-[#1F2937]"
                        : "text-gray-600 bg-white hover:bg-gray-50"
                    }`}
                  >
                    Ready Project
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setSelectedProjectCondition("Preleased")}
                    className={`h-10 rounded-xl font-semibold border-gray-200 shadow-sm transition-all text-sm ${
                      selectedProjectCondition === "Preleased"
                        ? "bg-[#111827] text-white border-[#111827] hover:bg-[#1F2937]"
                        : "text-gray-600 bg-white hover:bg-gray-50"
                    }`}
                  >
                    Preleased
                  </Button>
                </div>
              </div>

              {/* Budget Range */}
              <div className="space-y-2">
                <h3 className="text-base font-bold text-gray-900">Budget Range (₹)</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-500">Min Budget</label>
                    <Select
                      value={budgetRange.min.toString()}
                      onValueChange={(value) => setBudgetRange({ ...budgetRange, min: parseInt(value) || 0 })}
                    >
                      <SelectTrigger className="w-full h-10 rounded-xl border-gray-200 bg-white text-gray-700 font-medium text-sm">
                        <SelectValue placeholder="No Min" />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl border-gray-200 shadow-xl">
                        <SelectItem value="0">No Min</SelectItem>
                        {searchType === "buy" ? (
                          <>
                            <SelectItem value="1000000">₹10 Lakh</SelectItem>
                            <SelectItem value="2000000">₹20 Lakh</SelectItem>
                            <SelectItem value="3000000">₹30 Lakh</SelectItem>
                            <SelectItem value="4000000">₹40 Lakh</SelectItem>
                            <SelectItem value="5000000">₹50 Lakh</SelectItem>
                            <SelectItem value="7500000">₹75 Lakh</SelectItem>
                            <SelectItem value="10000000">₹1 Crore</SelectItem>
                            <SelectItem value="20000000">₹2 Crore</SelectItem>
                            <SelectItem value="50000000">₹5 Crore</SelectItem>
                          </>
                        ) : (
                          <>
                            <SelectItem value="5000">₹5,000</SelectItem>
                            <SelectItem value="10000">₹10,000</SelectItem>
                            <SelectItem value="20000">₹20,000</SelectItem>
                            <SelectItem value="30000">₹30,000</SelectItem>
                            <SelectItem value="50000">₹50,000</SelectItem>
                            <SelectItem value="100000">₹1 Lakh</SelectItem>
                          </>
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-500">Max Budget</label>
                    <Select
                      value={budgetRange.max.toString()}
                      onValueChange={(value) => setBudgetRange({ ...budgetRange, max: parseInt(value) || 0 })}
                    >
                      <SelectTrigger className="w-full h-10 rounded-xl border-gray-200 bg-white text-gray-700 font-medium text-sm">
                        <SelectValue placeholder="No Max" />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl border-gray-200 shadow-xl">
                        <SelectItem value="0">No Max</SelectItem>
                        {searchType === "buy" ? (
                          <>
                            <SelectItem value="5000000">₹50 Lakh</SelectItem>
                            <SelectItem value="10000000">₹1 Crore</SelectItem>
                            <SelectItem value="20000000">₹2 Crore</SelectItem>
                            <SelectItem value="50000000">₹5 Crore</SelectItem>
                            <SelectItem value="100000000">₹10 Crore</SelectItem>
                          </>
                        ) : (
                          <>
                            <SelectItem value="20000">₹20,000</SelectItem>
                            <SelectItem value="50000">₹50,000</SelectItem>
                            <SelectItem value="100000">₹1 Lakh</SelectItem>
                            <SelectItem value="200000">₹2 Lakh</SelectItem>
                            <SelectItem value="500000">₹5 Lakh</SelectItem>
                          </>
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Clear Filters Button */}
          {(selectedCategories.length > 0 || selectedProjectCondition || budgetRange.min > 0 || budgetRange.max > 0 || searchQuery.trim()) && (
            <div className="mt-8 flex justify-center">
              <Button
                variant="ghost"
                onClick={clearFilters}
                className="text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-xl px-6 transition-all"
              >
                <Filter className="h-4 w-4 mr-2" />
                Clear All Filters
              </Button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};
