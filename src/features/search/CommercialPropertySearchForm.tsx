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
  purpose: z.string().min(1, "Purpose is required"),
  remarks: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

interface CommercialPropertySearchFormProps {
  propertyType: string;
  onSubmit: (data: FormData) => void;
  onBack: () => void;
}

const CommercialPropertySearchForm = ({ propertyType, onSubmit, onBack }: CommercialPropertySearchFormProps) => {
  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      location: "",
      budgetMin: "",
      budgetMax: "",
      configuration: "",
      purpose: "",
      remarks: "",
    },
  });

  const configurations = [
    { value: "office", label: "Office" },
    { value: "shop", label: "Shop" },
    { value: "showroom", label: "Showroom" },
  ];

  const purposes = [
    { value: "end-use", label: "End Use" },
    { value: "investment", label: "Investment" },
  ];

  return (
    <main className="container mx-auto py-10 pb-16">
      <div className="mb-6">
        <Button variant="outline" onClick={onBack} className="mb-4">
          ← Back to Property Types
        </Button>
        <h1 className="text-3xl font-bold mb-2">Find {propertyType.charAt(0).toUpperCase() + propertyType.slice(1)} Properties</h1>
        <p className="text-muted-foreground">Please fill in your preferences to help us find the perfect commercial property for you</p>
      </div>

      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle>Commercial Property Search Preferences</CardTitle>
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
                      <Input placeholder="Enter city, area, or commercial zone" {...field} />
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
                        <Input placeholder="₹25,00,000" {...field} />
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
                        <Input placeholder="₹5,00,00,000" {...field} />
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
                          <SelectValue placeholder="Select property type" />
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
                name="purpose"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Purpose</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select purpose" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {purposes.map((purpose) => (
                          <SelectItem key={purpose.value} value={purpose.value}>
                            {purpose.label}
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
                name="remarks"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Specific Requirements (Optional)</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Any specific requirements like parking, floor area, amenities, etc."
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

export default CommercialPropertySearchForm;
