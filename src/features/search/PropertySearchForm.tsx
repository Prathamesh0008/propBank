"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/ui/form";
import { Input } from "@/ui/input";
import { Textarea } from "@/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/ui/card";

const formSchema = z.object({
  location: z.string().min(1, "Location is required"),
  budgetMin: z.string().min(1, "Minimum budget is required"),
  budgetMax: z.string().min(1, "Maximum budget is required"),
  configuration: z.string().min(1, "Configuration is required"),
  projectCondition: z.string().optional(),
  remarks: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

interface PropertySearchFormProps {
  propertyType: string;
  onSubmit: (data: FormData) => void;
  onBack: () => void;
}

const PropertySearchForm = ({ propertyType, onSubmit, onBack }: PropertySearchFormProps) => {
  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      location: "",
      budgetMin: "",
      budgetMax: "",
      configuration: "",
      projectCondition: "",
      remarks: "",
    },
  });

  const configurations = [
    { value: "1bhk", label: "1 BHK" },
    { value: "2bhk", label: "2 BHK" },
    { value: "3bhk", label: "3 BHK" },
    { value: "4bhk", label: "4 BHK" },
    { value: "5bhk+", label: "5 BHK+" },
  ];

  return (
    <main className="container mx-auto py-10">
      <div className="mb-6">
        <Button variant="outline" onClick={onBack} className="mb-4">
          ← Back to Property Types
        </Button>
        <h1 className="text-3xl font-bold mb-2">Find {propertyType.charAt(0).toUpperCase() + propertyType.slice(1)} Properties</h1>
        <p className="text-muted-foreground">Please fill in your preferences to help us find the perfect property for you</p>
      </div>

      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle>Property Search Preferences</CardTitle>
          <CardDescription>Tell us what you're looking for and we'll help you find it</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="location"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Preferred Location</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter city, area, or locality" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="budgetMin"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Minimum Budget</FormLabel>
                      <FormControl>
                        <Input placeholder="₹50,00,000" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="budgetMax"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Maximum Budget</FormLabel>
                      <FormControl>
                        <Input placeholder="₹1,00,00,000" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="configuration"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Property Configuration</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select configuration" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {configurations.map((config) => (
                          <SelectItem key={config.value} value={config.value}>
                            {config.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="projectCondition"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Project Condition (Optional)</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select project condition" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="">All Conditions</SelectItem>
                        <SelectItem value="New Project">New Project</SelectItem>
                        <SelectItem value="Ready Project">Ready Project</SelectItem>
                        <SelectItem value="Preleased">Preleased</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="remarks"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Specific Requirements (Optional)</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Any specific requirements like parking, balcony, floor preference, etc."
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button type="submit" className="w-full">
                Search Properties
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </main>
  );
};

export default PropertySearchForm;
