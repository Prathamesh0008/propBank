"use client";

import React, { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/ui/dialog";
import { Button } from "@/ui/button";
import { Checkbox } from "@/ui/checkbox";
import { Input } from "@/ui/input";
import { Label } from "@/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/ui/card";
import { Plus, Trash2 } from "lucide-react";

interface FurnishedItem {
  id: string;
  name: string;
  checked: boolean;
  quantity: number;
  category: 'basic' | 'kitchen' | 'bedroom' | 'living' | 'appliances' | 'semifurnished' | 'office' | 'infrastructure' | 'safety' | 'machinery' | 'storage' | 'utilities' | 'other';
}

interface FurnishedChecklistModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (checklist: FurnishedItem[]) => void;
  initialChecklist?: FurnishedItem[];
  propertyType?: 'residential' | 'commercial' | 'industrial';
}

// Residential property items (default)
const residentialFurnishedItems: Omit<FurnishedItem, 'id' | 'checked'>[] = [
  // Semi Furnished Items (Based on your table)
  { name: 'Light', category: 'semifurnished', quantity: 1 },
  { name: 'Fan', category: 'semifurnished', quantity: 1 },
  { name: 'Kitchen cabinet', category: 'semifurnished', quantity: 1 },
  { name: 'Geyser', category: 'semifurnished', quantity: 1 },
  { name: 'Curtain Road', category: 'semifurnished', quantity: 1 },
  { name: 'Mosquito net', category: 'semifurnished', quantity: 1 },
  { name: 'Exhaust Fan', category: 'semifurnished', quantity: 1 },
  { name: 'Chimeny (Optional)', category: 'semifurnished', quantity: 1 },
  { name: 'Air Conditioners (Optional)', category: 'semifurnished', quantity: 1 },
  { name: 'Wooden Cabinets (Optional)', category: 'semifurnished', quantity: 1 },
  
  // Basic Items
  { name: 'Light fan', category: 'basic', quantity: 1 },
  { name: 'Kitchen cabinet', category: 'basic', quantity: 1 },
  { name: 'Geyser', category: 'basic', quantity: 1 },
  { name: 'Curtain Road', category: 'basic', quantity: 1 },
  { name: 'Mosquito net', category: 'basic', quantity: 1 },
  { name: 'Exhaust Fan', category: 'basic', quantity: 1 },
  { name: 'Chimeny (Optional)', category: 'basic', quantity: 1 },
  { name: 'Air Conditioners', category: 'basic', quantity: 1 },
  { name: 'Wooden Cabinets', category: 'basic', quantity: 1 },
  
  // Kitchen Items  
  { name: 'Exhaust Fan', category: 'kitchen', quantity: 1 },
  { name: 'Air Conditioners', category: 'kitchen', quantity: 1 },
  { name: 'Sofa', category: 'kitchen', quantity: 1 },
  { name: 'Refrigerator', category: 'kitchen', quantity: 1 },
  { name: 'Microwave', category: 'kitchen', quantity: 1 },
  { name: 'Chairs', category: 'kitchen', quantity: 1 },
  { name: 'CCTV Camera', category: 'kitchen', quantity: 1 },
  { name: 'Side tables', category: 'kitchen', quantity: 1 },
  { name: 'Burner', category: 'kitchen', quantity: 1 },
  { name: 'Dish washer', category: 'kitchen', quantity: 1 },
  { name: 'cooking range', category: 'kitchen', quantity: 1 },
  
  // Bedroom Items
  { name: 'Double Bed', category: 'bedroom', quantity: 1 },
  { name: 'Single Bed', category: 'bedroom', quantity: 1 },
  { name: 'Mattress', category: 'bedroom', quantity: 1 },
  { name: 'Dressing unit', category: 'bedroom', quantity: 1 },
  
  // Living Room Items
  { name: 'Sofa', category: 'living', quantity: 1 },
  { name: 'Centre table', category: 'living', quantity: 1 },
  { name: 'Dining with chairs', category: 'living', quantity: 1 },
  { name: 'wall painting', category: 'living', quantity: 1 },
  { name: 'Balcony table with chairs', category: 'living', quantity: 1 },
  
  // Appliances
  { name: 'Refrigerator', category: 'appliances', quantity: 1 },
  { name: 'Microwave', category: 'appliances', quantity: 1 },
  { name: 'Washing Machine', category: 'appliances', quantity: 1 },
];

// Commercial property items
const commercialFurnishedItems: Omit<FurnishedItem, 'id' | 'checked'>[] = [
  // Office Furniture
  { name: 'Executive Desk', category: 'office', quantity: 1 },
  { name: 'Office Chairs', category: 'office', quantity: 1 },
  { name: 'Workstations / Cubicles', category: 'office', quantity: 1 },
  { name: 'Conference Table', category: 'office', quantity: 1 },
  { name: 'Conference Chairs', category: 'office', quantity: 1 },
  { name: 'Reception Desk', category: 'office', quantity: 1 },
  { name: 'Visitor Chairs', category: 'office', quantity: 1 },
  { name: 'Filing Cabinets', category: 'office', quantity: 1 },
  { name: 'Storage Cabinets', category: 'office', quantity: 1 },
  { name: 'Bookshelves', category: 'office', quantity: 1 },
  { name: 'Modular Partitions', category: 'office', quantity: 1 },
  { name: 'Whiteboard', category: 'office', quantity: 1 },
  { name: 'Notice Board', category: 'office', quantity: 1 },
  
  // Infrastructure & IT
  { name: 'Air Conditioners / HVAC', category: 'infrastructure', quantity: 1 },
  { name: 'False Ceiling', category: 'infrastructure', quantity: 1 },
  { name: 'Raised Flooring', category: 'infrastructure', quantity: 1 },
  { name: 'Network Cabling', category: 'infrastructure', quantity: 1 },
  { name: 'Server Room Setup', category: 'infrastructure', quantity: 1 },
  { name: 'UPS / Power Backup', category: 'infrastructure', quantity: 1 },
  { name: 'Generator Backup', category: 'infrastructure', quantity: 1 },
  { name: 'Telephone Lines', category: 'infrastructure', quantity: 1 },
  { name: 'Internet Connection', category: 'infrastructure', quantity: 1 },
  { name: 'Projector', category: 'infrastructure', quantity: 1 },
  { name: 'Video Conferencing System', category: 'infrastructure', quantity: 1 },
  { name: 'LED Display / TV', category: 'infrastructure', quantity: 1 },
  
  // Safety & Security
  { name: 'Fire Extinguisher', category: 'safety', quantity: 1 },
  { name: 'Fire Alarm System', category: 'safety', quantity: 1 },
  { name: 'Smoke Detectors', category: 'safety', quantity: 1 },
  { name: 'Sprinkler System', category: 'safety', quantity: 1 },
  { name: 'CCTV Cameras', category: 'safety', quantity: 1 },
  { name: 'Access Control System', category: 'safety', quantity: 1 },
  { name: 'Biometric Attendance', category: 'safety', quantity: 1 },
  { name: 'Security Guard Room', category: 'safety', quantity: 1 },
  { name: 'Emergency Exit Signage', category: 'safety', quantity: 1 },
  
  // Utilities & Pantry
  { name: 'Pantry / Kitchenette', category: 'utilities', quantity: 1 },
  { name: 'Refrigerator', category: 'utilities', quantity: 1 },
  { name: 'Microwave', category: 'utilities', quantity: 1 },
  { name: 'Water Purifier / Dispenser', category: 'utilities', quantity: 1 },
  { name: 'Coffee / Tea Machine', category: 'utilities', quantity: 1 },
  { name: 'Vending Machine', category: 'utilities', quantity: 1 },
  { name: 'Washroom Fixtures', category: 'utilities', quantity: 1 },
  { name: 'Housekeeping Room', category: 'utilities', quantity: 1 },
  
  // Basic Fixtures
  { name: 'Lights / LED Panels', category: 'basic', quantity: 1 },
  { name: 'Fans', category: 'basic', quantity: 1 },
  { name: 'Blinds / Curtains', category: 'basic', quantity: 1 },
  { name: 'Glass Partitions', category: 'basic', quantity: 1 },
  { name: 'Carpet / Flooring', category: 'basic', quantity: 1 },
  { name: 'Wall Paneling', category: 'basic', quantity: 1 },
  { name: 'Signage / Name Board', category: 'basic', quantity: 1 },
];

// Industrial property items
const industrialFurnishedItems: Omit<FurnishedItem, 'id' | 'checked'>[] = [
  // Machinery & Equipment
  { name: 'Overhead Crane / Hoist', category: 'machinery', quantity: 1 },
  { name: 'Forklift', category: 'machinery', quantity: 1 },
  { name: 'Pallet Jack', category: 'machinery', quantity: 1 },
  { name: 'Conveyor System', category: 'machinery', quantity: 1 },
  { name: 'Loading Dock Equipment', category: 'machinery', quantity: 1 },
  { name: 'Industrial Weighing Scale', category: 'machinery', quantity: 1 },
  { name: 'Compressor', category: 'machinery', quantity: 1 },
  { name: 'Industrial Generator', category: 'machinery', quantity: 1 },
  { name: 'Transformer', category: 'machinery', quantity: 1 },
  { name: 'Pump System', category: 'machinery', quantity: 1 },
  
  // Storage & Warehouse
  { name: 'Pallet Racks', category: 'storage', quantity: 1 },
  { name: 'Heavy Duty Shelving', category: 'storage', quantity: 1 },
  { name: 'Mezzanine Floor', category: 'storage', quantity: 1 },
  { name: 'Storage Bins / Containers', category: 'storage', quantity: 1 },
  { name: 'Cold Storage / Refrigeration Unit', category: 'storage', quantity: 1 },
  { name: 'Material Handling Trolleys', category: 'storage', quantity: 1 },
  { name: 'Dock Levelers', category: 'storage', quantity: 1 },
  { name: 'Roller Shutters', category: 'storage', quantity: 1 },
  
  // Safety & Compliance
  { name: 'Fire Extinguishers', category: 'safety', quantity: 1 },
  { name: 'Fire Hydrant System', category: 'safety', quantity: 1 },
  { name: 'Sprinkler System', category: 'safety', quantity: 1 },
  { name: 'Fire Alarm System', category: 'safety', quantity: 1 },
  { name: 'Emergency Exit Doors', category: 'safety', quantity: 1 },
  { name: 'Safety Signage', category: 'safety', quantity: 1 },
  { name: 'First Aid Station', category: 'safety', quantity: 1 },
  { name: 'Eye Wash Station', category: 'safety', quantity: 1 },
  { name: 'PPE Storage Cabinet', category: 'safety', quantity: 1 },
  { name: 'CCTV Surveillance', category: 'safety', quantity: 1 },
  { name: 'Security Cabin', category: 'safety', quantity: 1 },
  { name: 'Boom Barrier', category: 'safety', quantity: 1 },
  
  // Infrastructure
  { name: 'Industrial Ventilation / Exhaust', category: 'infrastructure', quantity: 1 },
  { name: 'Air Handling Unit (AHU)', category: 'infrastructure', quantity: 1 },
  { name: 'Industrial Lighting', category: 'infrastructure', quantity: 1 },
  { name: 'Power Distribution Panel', category: 'infrastructure', quantity: 1 },
  { name: 'HT / LT Connection', category: 'infrastructure', quantity: 1 },
  { name: 'Earthing System', category: 'infrastructure', quantity: 1 },
  { name: 'Water Tank / Overhead Tank', category: 'infrastructure', quantity: 1 },
  { name: 'Sewage Treatment Plant (STP)', category: 'infrastructure', quantity: 1 },
  { name: 'Effluent Treatment Plant (ETP)', category: 'infrastructure', quantity: 1 },
  { name: 'Borewell', category: 'infrastructure', quantity: 1 },
  { name: 'Weighbridge', category: 'infrastructure', quantity: 1 },
  
  // Office Section (within industrial)
  { name: 'Office Cabin', category: 'office', quantity: 1 },
  { name: 'Office Desk & Chairs', category: 'office', quantity: 1 },
  { name: 'Air Conditioner (Office)', category: 'office', quantity: 1 },
  { name: 'Meeting Room Setup', category: 'office', quantity: 1 },
  { name: 'Reception Area', category: 'office', quantity: 1 },
  { name: 'Filing Cabinet', category: 'office', quantity: 1 },
  
  // Utilities
  { name: 'Canteen / Cafeteria Setup', category: 'utilities', quantity: 1 },
  { name: 'Washroom Fixtures', category: 'utilities', quantity: 1 },
  { name: 'Locker Room', category: 'utilities', quantity: 1 },
  { name: 'Worker Rest Area', category: 'utilities', quantity: 1 },
  { name: 'Water Cooler / Dispenser', category: 'utilities', quantity: 1 },
  { name: 'Changing Room', category: 'utilities', quantity: 1 },
];

// Function to get items based on property type
const getDefaultFurnishedItems = (propertyType?: 'residential' | 'commercial' | 'industrial') => {
  switch (propertyType) {
    case 'commercial':
      return commercialFurnishedItems;
    case 'industrial':
      return industrialFurnishedItems;
    case 'residential':
    default:
      return residentialFurnishedItems;
  }
};

export const FurnishedChecklistModal: React.FC<FurnishedChecklistModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialChecklist = [],
  propertyType = 'residential'
}) => {
  const defaultFurnishedItems = getDefaultFurnishedItems(propertyType);
  
  const [checklist, setChecklist] = useState<FurnishedItem[]>(() => {
    if (initialChecklist.length > 0) {
      return initialChecklist;
    }
    
    return defaultFurnishedItems.map((item, index) => ({
      ...item,
      id: `item-${index}`,
      checked: false,
      quantity: 1
    }));
  });

  // Reset checklist when property type changes
  React.useEffect(() => {
    if (initialChecklist.length === 0) {
      const items = getDefaultFurnishedItems(propertyType);
      setChecklist(items.map((item, index) => ({
        ...item,
        id: `item-${index}`,
        checked: false,
        quantity: 1
      })));
    }
  }, [propertyType, initialChecklist.length]);

  const [customItems, setCustomItems] = useState<string[]>(['']);

  const handleItemToggle = (itemId: string) => {
    setChecklist(prev => prev.map(item => 
      item.id === itemId ? { ...item, checked: !item.checked } : item
    ));
  };

  const handleQuantityChange = (itemId: string, quantity: number) => {
    const qty = Math.max(1, Math.floor(quantity || 1));
    setChecklist(prev => prev.map(item => 
      item.id === itemId ? { ...item, quantity: qty } : item
    ));
  };

  const addCustomItem = (itemName: string) => {
    if (itemName.trim()) {
      const newItem: FurnishedItem = {
        id: `custom-${Date.now()}`,
        name: itemName.trim(),
        checked: false,
        quantity: 1,
        category: 'other'
      };
      setChecklist(prev => [...prev, newItem]);
    }
  };

  const removeCustomItem = (itemId: string) => {
    setChecklist(prev => prev.filter(item => item.id !== itemId));
  };

  const handleCustomItemChange = (index: number, value: string) => {
    const newCustomItems = [...customItems];
    newCustomItems[index] = value;
    setCustomItems(newCustomItems);
  };

  const addCustomItemInput = () => {
    setCustomItems(prev => [...prev, '']);
  };

  const removeCustomItemInput = (index: number) => {
    setCustomItems(prev => prev.filter((_, i) => i !== index));
  };

  const handleSave = () => {
    // Add any pending custom items before saving
    const itemsToAdd: string[] = [];
    customItems.forEach(item => {
      if (item.trim()) {
        itemsToAdd.push(item.trim());
      }
    });
    
    // Add all pending custom items first
    itemsToAdd.forEach(itemName => {
      const newItem: FurnishedItem = {
        id: `custom-${Date.now()}-${Math.random()}`,
        name: itemName,
        checked: false,
        quantity: 1,
        category: 'other'
      };
      setChecklist(prev => [...prev, newItem]);
    });
    
    // Clear custom items input
    setCustomItems(['']);
    
    // Save the checklist (including newly added custom items)
    setTimeout(() => {
      setChecklist(currentChecklist => {
        onSave(currentChecklist);
        return currentChecklist;
      });
      onClose();
    }, 50);
  };

  const groupedItems = checklist.reduce((acc, item) => {
    if (!acc[item.category]) {
      acc[item.category] = [];
    }
    acc[item.category].push(item);
    return acc;
  }, {} as Record<string, FurnishedItem[]>);

  const categoryTitles = {
    semifurnished: 'Semi Furnished Items',
    basic: 'Basic Furnishing',
    kitchen: 'Kitchen Items',
    bedroom: 'Bedroom Items', 
    living: 'Living Room Items',
    appliances: 'Appliances',
    office: 'Office Furniture & Setup',
    infrastructure: 'Infrastructure & IT',
    safety: 'Safety & Security',
    machinery: 'Machinery & Equipment',
    storage: 'Storage & Warehouse',
    utilities: 'Utilities & Amenities',
    other: 'Other Items'
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">Furnished Property Checklist</DialogTitle>
          <DialogDescription>
            Select all the items that are included with this furnished property
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Object.entries(groupedItems).map(([category, items]) => (
              <Card key={category} className="border">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">
                    {categoryTitles[category as keyof typeof categoryTitles]}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {items.map((item) => (
                    <div key={item.id} className="flex items-center space-x-3 gap-2">
                      <Checkbox
                        id={item.id}
                        checked={item.checked}
                        onCheckedChange={() => handleItemToggle(item.id)}
                      />
                      <Label 
                        htmlFor={item.id}
                        className="text-sm font-normal cursor-pointer flex-1"
                      >
                        {item.name}
                      </Label>
                      {/* Quantity field - always visible for all items */}
                      <div className="flex items-center space-x-2">
                        <Label htmlFor={`qty-${item.id}`} className="text-xs text-muted-foreground whitespace-nowrap">
                          Qty:
                        </Label>
                        <Input
                          id={`qty-${item.id}`}
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={(e) => handleQuantityChange(item.id, parseInt(e.target.value) || 1)}
                          className="w-16 h-8 text-sm"
                          onClick={(e) => e.stopPropagation()}
                          disabled={!item.checked}
                        />
                      </div>
                      {item.category === 'other' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeCustomItem(item.id)}
                          className="text-destructive hover:text-destructive p-1"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Custom Items Section */}
          <Card className="border border-blue-200 bg-blue-50/30">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Plus className="h-5 w-5 text-blue-600" />
                Add Custom Items
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Add your own custom furnished items that are not in the default list
              </p>
            </CardHeader>
            <CardContent className="space-y-3">
              {customItems.map((item, index) => (
                <div key={index} className="flex items-center space-x-2">
                  <Input
                    placeholder="Enter custom item name (e.g., Smart TV, Coffee Table, etc.)..."
                    value={item}
                    onChange={(e) => handleCustomItemChange(index, e.target.value)}
                    onBlur={() => {
                      if (item.trim()) {
                        addCustomItem(item);
                        setCustomItems(prev => prev.filter((_, i) => i !== index));
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        if (item.trim()) {
                          addCustomItem(item);
                          setCustomItems(prev => prev.filter((_, i) => i !== index));
                        }
                      }
                    }}
                    className="flex-1"
                  />
                  {customItems.length > 1 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeCustomItemInput(index)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
              <Button
                variant="outline"
                onClick={addCustomItemInput}
                className="w-full"
                size="sm"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Another Custom Item
              </Button>
              {checklist.filter(item => item.category === 'other').length > 0 && (
                <div className="mt-3 pt-3 border-t">
                  <p className="text-xs text-muted-foreground mb-2">
                    Custom items added: {checklist.filter(item => item.category === 'other').length}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Summary */}
          <div className="bg-muted p-4 rounded-lg">
            <p className="text-sm font-medium">
              Selected Items: {checklist.filter(item => item.checked).length} of {checklist.length}
            </p>
            {checklist.filter(item => item.checked).length > 0 && (
              <p className="text-xs text-muted-foreground mt-1">
                Total Quantity: {checklist.filter(item => item.checked).reduce((sum, item) => sum + item.quantity, 0)}
              </p>
            )}
          </div>
        </div>

        <div className="flex justify-end space-x-3 pt-4 border-t">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave}>
            Save Checklist
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
