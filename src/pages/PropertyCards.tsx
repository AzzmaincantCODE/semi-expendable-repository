import { useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Search, Plus, Loader2, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { PropertyCard } from "@/hooks/useSupabasePropertyCards";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { propertyCardService } from "@/services/propertyCardService";

export const PropertyCards = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const { toast } = useToast();

  // Use React Query for property cards
  const { data: cards = [], isLoading: loading, error } = useQuery({
    queryKey: ['property-cards'],
    queryFn: async () => {
      const response = await propertyCardService.getAll();
      return response.success ? response.data : [];
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: (failureCount, error) => {
      if (!navigator.onLine) return false;
      return failureCount < 2;
    },
  });

  const filteredCards = cards.filter(card =>
    card.propertyNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
    card.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
    card.entityName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading && cards.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
        <span className="ml-2">Loading property cards...</span>
      </div>
    );
  }

  if (error && navigator.onLine) {
  return (
      <div className="text-center py-8">
        <Alert className="max-w-md mx-auto">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Error: {error.message || 'Failed to load property cards'}
          </AlertDescription>
        </Alert>
        <Button onClick={() => window.location.reload()} className="mt-4">
          Retry
        </Button>
      </div>
    );
  }

  // Show offline message if error and offline
  if (error && !navigator.onLine) {
    return (
      <div className="text-center py-8">
        <Alert className="max-w-md mx-auto">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            You're offline. Some features may not work until your connection is restored.
          </AlertDescription>
        </Alert>
        <div className="mt-4">
          <p className="text-muted-foreground">Previously loaded data will appear when available.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-foreground">Property Cards</h1>
        <Button className="bg-primary hover:bg-primary-dark">
          <Plus className="h-4 w-4 mr-2" />
          Create New Card
        </Button>
              </div>

      <Card>
        <CardHeader>
          <CardTitle>Semi-Expendable Property Cards</CardTitle>
          <div className="flex items-center space-x-4">
            <div className="flex-1 relative">
              <Search className="h-4 w-4 absolute left-3 top-3 text-muted-foreground" />
              <Input
                placeholder="Search by property number, description, or entity..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Property Number</TableHead>
                  <TableHead>Entity Name</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Fund Cluster</TableHead>
                  <TableHead>Date Acquired</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCards.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      {cards.length === 0 ? "No property cards found" : "No cards match your search"}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredCards.map((card) => (
                    <TableRow key={card.id}>
                      <TableCell className="font-medium">{card.propertyNumber}</TableCell>
                      <TableCell>{card.entityName}</TableCell>
                      <TableCell>{card.description}</TableCell>
                      <TableCell>{card.fundCluster}</TableCell>
                      <TableCell>{new Date(card.dateAcquired).toLocaleDateString()}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">Active</Badge>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};