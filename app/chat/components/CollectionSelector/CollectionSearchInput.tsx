"use client";

import { Input } from "@/components/ui/input";
import { Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface CollectionSearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export function CollectionSearchInput({
  value,
  onChange,
  placeholder = "검색...",
}: CollectionSearchInputProps) {
  return (
    <div className="relative px-3 py-2 border-b">
      <Search className="absolute left-5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="pl-8 pr-8 h-9 bg-muted/30 border-0 focus-visible:ring-1"
      />
      {value && (
        <Button
          variant="ghost"
          size="icon"
          className="absolute right-4 top-1/2 -translate-y-1/2 h-6 w-6"
          onClick={() => onChange("")}
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      )}
    </div>
  );
}
