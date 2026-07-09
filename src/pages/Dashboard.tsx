import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Package, FileText, TrendingUp, Users, Plus, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useQuery } from "@tanstack/react-query";
// Removed mock data service in production
import { useToast } from "@/hooks/use-toast";

interface DashboardStats {
  totalItems: number;
  totalValue: number;
  byCondition: Record<string, number>;
  byStatus: Record<string, number>;
  issuedItems: number;
  unissuedItems: number;
  unserviceableItems: number;
  recentActivity: Array<{
    action: string;
    user: string;
    time: string;
  }>;
}

const fetchDashboardData = async (): Promise<DashboardStats> => {
  const [
    { data: items, error: itemsErr }, 
    { data: recent, error: recErr }
  ] = await Promise.all([
    supabase.from('inventory_items').select('id, total_cost, condition, status, assignment_status, custodian').range(0, 499),
    supabase.from('inventory_items').select('description, property_number, created_at, updated_at').order('updated_at', { ascending: false }).limit(8)
  ]);

  if (itemsErr) throw itemsErr;
  if (recErr) throw recErr;

  // Count all items for total, but only serviceable items for issued/available calculations
  const totalItems = items?.length || 0;
  const totalValue = (items || []).reduce((sum, x: any) => sum + (Number(x.total_cost) || 0), 0);
  
  const serviceableItems = (items || []).filter((item: any) => 
    item.status === 'Active' && item.condition === 'Serviceable'
  );
  
  const byCondition: Record<string, number> = {};
  const byStatus: Record<string, number> = {};
  (items || []).forEach((x: any) => {
    byCondition[x.condition] = (byCondition[x.condition] || 0) + 1;
    byStatus[x.status] = (byStatus[x.status] || 0) + 1;
  });

  // Count issued and unissued items using assignment_status field
  const issuedItems = serviceableItems.filter((item: any) => 
    item.assignment_status === 'Assigned' || (item.custodian && item.custodian !== '')
  ).length;
  
  const unissuedItems = serviceableItems.filter((item: any) => 
    !item.assignment_status || item.assignment_status === 'Available' || 
    (!item.custodian || item.custodian === '')
  ).length;

  // Count unserviceable items
  const unserviceableItems = (items || []).filter((item: any) => 
    item.condition === 'Unserviceable'
  ).length;

  const recentActivity = (recent || []).map((r: any) => ({
    action: `Item ${r.property_number} updated`,
    user: 'system',
    time: new Date(r.updated_at || r.created_at).toLocaleString(),
  }));

  return { totalItems, totalValue, byCondition, byStatus, issuedItems, unissuedItems, unserviceableItems, recentActivity };
};

export const Dashboard = () => {
  const navigate = useNavigate();
  const { toast } = useToast();

  // Use React Query for caching and offline support
  const { data: stats, isLoading: loading, error } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: fetchDashboardData,
    staleTime: 2 * 60 * 1000, // 2 minutes (reduced for more frequent updates)
    gcTime: 24 * 60 * 60 * 1000, // 24 hours
    retry: (failureCount, error) => {
      // Don't retry if offline
      if (!navigator.onLine) return false;
      return failureCount < 2;
    },
  });

  // Provide default values for offline/error states
  const safeStats = stats || {
    totalItems: 0,
    totalValue: 0,
    byCondition: {},
    byStatus: {},
    issuedItems: 0,
    unissuedItems: 0,
    unserviceableItems: 0,
    recentActivity: []
  };


  const getConditionColor = (condition: string) => {
    switch (condition) {
      case "Serviceable": return "bg-green-500";
      case "For Repair": return "bg-yellow-500";
      case "Unserviceable": return "bg-red-600";
      case "Missing": return "bg-red-400";
      default: return "bg-gray-500";
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Active": return "bg-green-500";
      case "Transferred": return "bg-blue-500";
      case "Disposed": return "bg-gray-500";
      case "Missing": return "bg-red-500";
      default: return "bg-gray-500";
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
        <span className="ml-2">Loading dashboard...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
        <div className="flex items-center space-x-4">
          {/* Removed Create Test Data button */}
          <div className="text-sm text-muted-foreground">
            Last updated: {new Date().toLocaleDateString()}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Items</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{safeStats.totalItems.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              {!navigator.onLine && !stats ? "Offline - cached data" : safeStats.totalItems === 0 ? "No items yet" : "From database"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Value</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">₱{safeStats.totalValue.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              {!navigator.onLine && !stats ? "Offline - cached data" : safeStats.totalValue === 0 ? "No value yet" : "From database"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Issued Items</CardTitle>
            <Users className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{safeStats.issuedItems.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              {safeStats.issuedItems === 0 ? "No items issued yet" : "Assigned to custodians"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Available Items</CardTitle>
            <Package className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{safeStats.unissuedItems.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              {safeStats.unissuedItems === 0 ? "All items are issued" : "Ready for assignment"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Issued/Unissued Summary Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <FileText className="h-5 w-5" />
            <span>Issued vs Unissued Items Summary</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <button 
                onClick={() => navigate('/inventory?filter=issued')}
                className="w-full flex items-center justify-between p-4 bg-green-50 rounded-lg border border-green-200 hover:bg-green-100 hover:border-green-300 transition-colors cursor-pointer group"
              >
                <div className="flex items-center space-x-3">
                  <Users className="h-8 w-8 text-green-600" />
                  <div>
                    <h3 className="text-lg font-semibold text-green-800">Issued Items</h3>
                    <p className="text-sm text-green-600">Assigned to custodians</p>
                    <p className="text-xs text-green-500 group-hover:text-green-700">Click to view →</p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-3xl font-bold text-green-600">{safeStats.issuedItems}</div>
                  <div className="text-sm text-green-600">
                    {safeStats.totalItems > 0 ? Math.round((safeStats.issuedItems / safeStats.totalItems) * 100) : 0}% of total
                  </div>
                </div>
              </button>
            </div>
            
            <div className="space-y-4">
              <button 
                onClick={() => navigate('/inventory?filter=available')}
                className="w-full flex items-center justify-between p-4 bg-blue-50 rounded-lg border border-blue-200 hover:bg-blue-100 hover:border-blue-300 transition-colors cursor-pointer group"
              >
                <div className="flex items-center space-x-3">
                  <Package className="h-8 w-8 text-blue-600" />
                  <div>
                    <h3 className="text-lg font-semibold text-blue-800">Available Items</h3>
                    <p className="text-sm text-blue-600">Ready for assignment</p>
                    <p className="text-xs text-blue-500 group-hover:text-blue-700">Click to view →</p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-3xl font-bold text-blue-600">{safeStats.unissuedItems}</div>
                  <div className="text-sm text-blue-600">
                    {safeStats.totalItems > 0 ? Math.round((safeStats.unissuedItems / safeStats.totalItems) * 100) : 0}% of total
                  </div>
                </div>
              </button>
            </div>
          </div>
          
          {safeStats.totalItems > 0 && (
            <div className="mt-6 p-4 bg-secondary rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-foreground">Distribution</span>
                <span className="text-sm text-muted-foreground">{safeStats.totalItems} total items</span>
              </div>
              <div className="w-full bg-muted rounded-full h-3">
                <div className="flex h-3 rounded-full overflow-hidden">
                  <div 
                    className="bg-green-500" 
                    style={{ width: `${safeStats.totalItems > 0 ? (safeStats.issuedItems / safeStats.totalItems) * 100 : 0}%` }}
                    title={`${safeStats.issuedItems} issued items`}
                  ></div>
                  <div 
                    className="bg-blue-500" 
                    style={{ width: `${safeStats.totalItems > 0 ? (safeStats.unissuedItems / safeStats.totalItems) * 100 : 0}%` }}
                    title={`${safeStats.unissuedItems} available items`}
                  ></div>
                  {safeStats.unserviceableItems > 0 && (
                    <div 
                      className="bg-red-600" 
                      style={{ width: `${safeStats.totalItems > 0 ? (safeStats.unserviceableItems / safeStats.totalItems) * 100 : 0}%` }}
                      title={`${safeStats.unserviceableItems} unserviceable items`}
                    ></div>
                  )}
                </div>
              </div>
              <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground flex-wrap gap-2">
                <div className="flex items-center space-x-1">
                  <div className="w-3 h-3 bg-green-500 rounded"></div>
                  <span>Issued ({safeStats.issuedItems})</span>
                </div>
                <div className="flex items-center space-x-1">
                  <div className="w-3 h-3 bg-blue-500 rounded"></div>
                  <span>Available ({safeStats.unissuedItems})</span>
                </div>
                {safeStats.unserviceableItems > 0 && (
                  <div className="flex items-center space-x-1">
                    <div className="w-3 h-3 bg-red-600 rounded"></div>
                    <span>Unserviceable ({safeStats.unserviceableItems})</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {stats.recentActivity.length > 0 ? (
                stats.recentActivity.map((activity, index) => (
                  <div key={index} className="flex items-center space-x-3">
                    <div className="w-2 h-2 bg-primary rounded-full"></div>
                    <div className="flex-1">
                      <p className="text-sm font-medium">{activity.action}</p>
                      <p className="text-xs text-muted-foreground">by {activity.user} • {activity.time}</p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <p>No recent activity</p>
                  <p className="text-xs">Add items to see activity here</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Property Status Overview</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {Object.keys(stats.byCondition).length > 0 ? (
                Object.entries(stats.byCondition).map(([condition, count]) => {
                  const total = Object.values(stats.byCondition).reduce((sum, c) => sum + c, 0);
                  const percentage = total > 0 ? (count / total) * 100 : 0;
                  const barWidth = Math.max(percentage, 5); // Minimum 5% width for visibility
                  
                  return (
                    <div key={condition} className="flex items-center justify-between">
                      <span className="text-sm">{condition}</span>
                      <div className="flex items-center space-x-2">
                        <div className="w-20 h-2 bg-muted rounded-full">
                          <div 
                            className={`h-2 rounded-full ${getConditionColor(condition)}`}
                            style={{ width: `${barWidth}%` }}
                          ></div>
                        </div>
                        <span className="text-sm text-muted-foreground">{count}</span>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <p>No property data</p>
                  <p className="text-xs">Add items to see status overview</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

    </div>
  );
};
