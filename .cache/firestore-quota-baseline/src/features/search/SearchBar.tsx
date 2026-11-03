"use client";

import { useState } from "react";
import { Button } from "@/ui/button";
import { Input } from "@/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/ui/select";
import { Search } from "lucide-react";
import { useNavigate } from "@/lib/navigation";
import { auth } from "../../firebase";

const SearchBar = () => {
  const [searchType, setSearchType] = useState("buy");
  const [searchQuery, setSearchQuery] = useState("");
  const navigate = useNavigate();

  const handleSearch = async () => {
    const user = auth.currentUser;
    
    if (!user) {
      navigate("/auth");
      return;
    }

    const searchParams = new URLSearchParams();
    if (searchQuery.trim()) searchParams.append('q', searchQuery.trim());
    if (searchType) searchParams.append('type', searchType);
    
    navigate(`/search?${searchParams.toString()}`);
  };

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div className="flex items-center gap-0 rounded-lg border border-input bg-background shadow-sm overflow-hidden">
        <Select value={searchType} onValueChange={setSearchType}>
          <SelectTrigger className="w-32 border-0 border-r border-input rounded-none bg-muted/50">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="buy">Buy</SelectItem>
            <SelectItem value="rent">Rent</SelectItem>
          </SelectContent>
        </Select>
        
        <Input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search properties by location, type, or features..."
          className="flex-1 border-0 rounded-none bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0"
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
        />
        
        <Button 
          onClick={handleSearch}
          className="rounded-none px-4"
          variant="default"
        >
          <Search className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};

export default SearchBar;
