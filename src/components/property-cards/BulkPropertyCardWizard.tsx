import React, { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle, ArrowRight, ArrowLeft, Eye, Settings, Users, FileText } from 'lucide-react';
import { AnnexInventoryItem } from '@/types/annex';
import { supabase } from '@/lib/supabase';
import { annexService } from '@/services/annexService';

// Template definitions
interface PropertyCardTemplate {
  id: string;
  name: string;
  entityName: string;
  fundCluster: string;
  description: string;
  rules: {
    category?: string;
    fundSource?: string;
    entityName?: string;
  };
}

// Individual item configuration
interface ItemConfiguration {
  itemId: string;
  entityName: string;
  fundCluster: string;
  isOverridden: boolean;
}

// Wizard steps
type WizardStep = 'selection' | 'template' | 'configuration' | 'overrides' | 'preview' | 'processing';

interface BulkPropertyCardWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  inventoryItems: AnnexInventoryItem[];
}

const DEFAULT_TEMPLATES: PropertyCardTemplate[] = [
  {
    id: 'general-fund',
    name: 'General Fund',
    entityName: 'PROVINCIAL GOVERNMENT OF APAYAO',
    fundCluster: 'General Fund',
    description: 'Standard property cards for general fund items',
    rules: { fundSource: 'general' }
  },
  {
    id: 'custom',
    name: 'Custom Template',
    entityName: 'PROVINCIAL GOVERNMENT OF APAYAO',
    fundCluster: '',
    description: 'Create a custom template',
    rules: {}
  }
];

export const BulkPropertyCardWizard: React.FC<BulkPropertyCardWizardProps> = ({
  isOpen,
  onClose,
  onSuccess,
  inventoryItems
}) => {
  const [currentStep, setCurrentStep] = useState<WizardStep>('selection');
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<PropertyCardTemplate | null>(null);
  const [customTemplate, setCustomTemplate] = useState<PropertyCardTemplate>(DEFAULT_TEMPLATES[2]);
  const [itemConfigurations, setItemConfigurations] = useState<ItemConfiguration[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [createdCount, setCreatedCount] = useState(0);

  // Reset wizard when opening
  useEffect(() => {
    if (isOpen) {
      setCurrentStep('selection');
      setSelectedItems([]);
      setSelectedTemplate(null);
      setItemConfigurations([]);
      setIsCreating(false);
      setCreatedCount(0);
    }
  }, [isOpen]);

  // Get selected items data
  const selectedItemsData = useMemo(() => {
    return inventoryItems.filter(item => selectedItems.includes(item.id));
  }, [inventoryItems, selectedItems]);

  // Initialize item configurations when template is selected
  useEffect(() => {
    if (selectedTemplate && selectedItems.length > 0) {
      const configurations: ItemConfiguration[] = selectedItems.map(itemId => {
        const item = inventoryItems.find(i => i.id === itemId);
        return {
          itemId,
          entityName: selectedTemplate.entityName,
          fundCluster: selectedTemplate.fundCluster,
          isOverridden: false
        };
      });
      setItemConfigurations(configurations);
    }
  }, [selectedTemplate, selectedItems, inventoryItems]);

  // Helper function to get fund source name
  const getFundSourceName = async (fundSourceId: string): Promise<string | null> => {
    try {
      const { data: fundSource } = await supabase
        .from('fund_sources')
        .select('name')
        .eq('id', fundSourceId)
        .single();
      return fundSource?.name || null;
    } catch (error) {
      console.error('Error fetching fund source:', error);
      return null;
    }
  };

  // Auto-assign values based on inventory item data
  const autoAssignValues = async (itemId: string) => {
    const item = inventoryItems.find(i => i.id === itemId);
    if (!item) return;

    let entityName = selectedTemplate?.entityName || '';
    let fundCluster = selectedTemplate?.fundCluster || '';

    // Use item's entity name if available
    if (item.entityName) {
      entityName = item.entityName;
    }

    // Use item's fund source if available
    if (item.fundSource) {
      const fundSourceName = await getFundSourceName(item.fundSource);
      if (fundSourceName) {
        fundCluster = fundSourceName;
      }
    }

    return { entityName, fundCluster };
  };

  // Handle item selection
  const handleItemToggle = (itemId: string) => {
    setSelectedItems(prev => 
      prev.includes(itemId) 
        ? prev.filter(id => id !== itemId)
        : [...prev, itemId]
    );
  };

  // Handle template selection
  const handleTemplateSelect = (templateId: string) => {
    const template = DEFAULT_TEMPLATES.find(t => t.id === templateId);
    setSelectedTemplate(template || null);
  };

  // Handle custom template changes
  const handleCustomTemplateChange = (field: keyof PropertyCardTemplate, value: string) => {
    setCustomTemplate(prev => ({ ...prev, [field]: value }));
  };

  // Handle item configuration changes
  const handleItemConfigChange = (itemId: string, field: keyof ItemConfiguration, value: string | boolean) => {
    setItemConfigurations(prev => 
      prev.map(config => 
        config.itemId === itemId 
          ? { ...config, [field]: value, isOverridden: true }
          : config
      )
    );
  };

  // Auto-assign all items
  const handleAutoAssignAll = async () => {
    const newConfigurations = await Promise.all(
      selectedItems.map(async (itemId) => {
        const autoValues = await autoAssignValues(itemId);
        return {
          itemId,
          entityName: autoValues?.entityName || selectedTemplate?.entityName || '',
          fundCluster: autoValues?.fundCluster || selectedTemplate?.fundCluster || '',
          isOverridden: false
        };
      })
    );
    setItemConfigurations(newConfigurations);
  };

  // Create property cards
  const handleCreateCards = async () => {
    setIsCreating(true);
    setCreatedCount(0);

    try {
      for (let i = 0; i < itemConfigurations.length; i++) {
        const config = itemConfigurations[i];
        const item = inventoryItems.find(i => i.id === config.itemId);
        
        if (!item) continue;

        try {
          // Use annexService which creates both the card AND the initial receipt entry
          await annexService.createPropertyCardFromInventory({
            inventoryItemId: item.id,
            entityName: config.entityName,
            fundCluster: config.fundCluster,
            initialEntry: {
              date: item.dateAcquired || new Date().toISOString().split('T')[0],
              reference: 'Initial Receipt',
              receiptQty: item.quantity || 1,
              unitCost: item.unitCost || 0,
              totalCost: item.totalCost || ((item.quantity || 1) * (item.unitCost || 0))
            }
          });

          setCreatedCount(i + 1);
        } catch (error) {
          console.error(`Error creating property card for ${item.propertyNumber}:`, error);
        }
      }

      onSuccess();
      onClose();
    } catch (error) {
      console.error('Error creating property cards:', error);
    } finally {
      setIsCreating(false);
    }
  };

  // Navigation functions
  const nextStep = () => {
    const steps: WizardStep[] = ['selection', 'template', 'configuration', 'overrides', 'preview', 'processing'];
    const currentIndex = steps.indexOf(currentStep);
    if (currentIndex < steps.length - 1) {
      setCurrentStep(steps[currentIndex + 1]);
    }
  };

  const prevStep = () => {
    const steps: WizardStep[] = ['selection', 'template', 'configuration', 'overrides', 'preview', 'processing'];
    const currentIndex = steps.indexOf(currentStep);
    if (currentIndex > 0) {
      setCurrentStep(steps[currentIndex - 1]);
    }
  };

  const canProceed = () => {
    switch (currentStep) {
      case 'selection':
        return selectedItems.length > 0;
      case 'template':
        return selectedTemplate !== null;
      case 'configuration':
        return true;
      case 'overrides':
        return true;
      case 'preview':
        return true;
      default:
        return false;
    }
  };

  const getStepTitle = () => {
    switch (currentStep) {
      case 'selection':
        return 'Select Inventory Items';
      case 'template':
        return 'Choose Template';
      case 'configuration':
        return 'Configure Common Settings';
      case 'overrides':
        return 'Customize Individual Items';
      case 'preview':
        return 'Preview & Confirm';
      case 'processing':
        return 'Creating Property Cards';
      default:
        return '';
    }
  };

  const getStepIcon = () => {
    switch (currentStep) {
      case 'selection':
        return <Users className="h-5 w-5" />;
      case 'template':
        return <FileText className="h-5 w-5" />;
      case 'configuration':
        return <Settings className="h-5 w-5" />;
      case 'overrides':
        return <Settings className="h-5 w-5" />;
      case 'preview':
        return <Eye className="h-5 w-5" />;
      case 'processing':
        return <CheckCircle className="h-5 w-5" />;
      default:
        return null;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {getStepIcon()}
            Bulk Create Property Cards - {getStepTitle()}
          </DialogTitle>
        </DialogHeader>

        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>Step {['selection', 'template', 'configuration', 'overrides', 'preview', 'processing'].indexOf(currentStep) + 1} of 6</span>
            <span>{selectedItems.length} items selected</span>
          </div>
          <Progress 
            value={(['selection', 'template', 'configuration', 'overrides', 'preview', 'processing'].indexOf(currentStep) + 1) * 16.67} 
            className="h-2" 
          />
        </div>

        {/* Step Content */}
        <div className="space-y-6">
          {/* Step 1: Item Selection */}
          {currentStep === 'selection' && (
            <div className="space-y-4">
              <Alert>
                <AlertDescription>
                  Select the inventory items you want to create property cards for. You can select multiple items at once.
                </AlertDescription>
              </Alert>
              
              <div className="grid grid-cols-1 gap-2 max-h-96 overflow-y-auto">
                {inventoryItems.map((item) => {
                  const safeDescription = item.description || 
                    (item.model 
                      ? `${item.brand ? item.brand + ' ' : ''}${item.model}` 
                      : item.brand) || 
                    '';
                  return (
                    <div key={item.id} className="flex items-center space-x-2 p-2 border rounded">
                      <Checkbox
                        id={item.id}
                        checked={selectedItems.includes(item.id)}
                        onCheckedChange={() => handleItemToggle(item.id)}
                      />
                      <div className="flex-1">
                        <Label htmlFor={item.id} className="font-medium">
                          {item.propertyNumber} - {safeDescription}
                        </Label>
                        <div className="text-sm text-muted-foreground">
                          {item.category} • {item.condition} • {item.fundSource ? 'Has Fund Source' : 'No Fund Source'}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Step 2: Template Selection */}
          {currentStep === 'template' && (
            <div className="space-y-4">
              <Alert>
                <AlertDescription>
                  Choose a template to apply common settings to all selected items. You can customize individual items later.
                </AlertDescription>
              </Alert>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {DEFAULT_TEMPLATES.map((template) => (
                  <Card 
                    key={template.id}
                    className={`cursor-pointer transition-colors ${
                      selectedTemplate?.id === template.id ? 'ring-2 ring-primary' : ''
                    }`}
                    onClick={() => handleTemplateSelect(template.id)}
                  >
                    <CardHeader>
                      <CardTitle className="text-lg">{template.name}</CardTitle>
                      <p className="text-sm text-muted-foreground">{template.description}</p>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        <div>
                          <span className="font-medium">Entity:</span> {template.entityName || 'Custom'}
                        </div>
                        <div>
                          <span className="font-medium">Fund Cluster:</span> {template.fundCluster || 'Custom'}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Custom Template Form */}
              {selectedTemplate?.id === 'custom' && (
                <Card>
                  <CardHeader>
                    <CardTitle>Custom Template</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label htmlFor="customEntityName">Entity Name</Label>
                      <Input
                        id="customEntityName"
                        value="PROVINCIAL GOVERNMENT OF APAYAO"
                        readOnly
                        className="bg-muted"
                        placeholder="Enter entity name"
                      />
                    </div>
                    <div>
                      <Label htmlFor="customFundCluster">Fund Cluster</Label>
                      <Input
                        id="customFundCluster"
                        value={customTemplate.fundCluster}
                        onChange={(e) => handleCustomTemplateChange('fundCluster', e.target.value)}
                        placeholder="Enter fund cluster"
                      />
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {/* Step 3: Configuration */}
          {currentStep === 'configuration' && (
            <div className="space-y-4">
              <Alert>
                <AlertDescription>
                  Configure common settings that will be applied to all selected items. You can customize individual items in the next step.
                </AlertDescription>
              </Alert>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="commonEntityName">Entity Name</Label>
                  <Input
                    id="commonEntityName"
                    value={selectedTemplate?.entityName || 'PROVINCIAL GOVERNMENT OF APAYAO'}
                    readOnly
                    className="bg-muted"
                    placeholder="Enter entity name"
                  />
                </div>
                <div>
                  <Label htmlFor="commonFundCluster">Fund Cluster</Label>
                  <Input
                    id="commonFundCluster"
                    value={selectedTemplate?.fundCluster || ''}
                    onChange={(e) => {
                      const newTemplate = { ...selectedTemplate!, fundCluster: e.target.value };
                      setSelectedTemplate(newTemplate);
                    }}
                    placeholder="Enter fund cluster"
                  />
                </div>
              </div>

              <div className="flex gap-2">
                <Button onClick={handleAutoAssignAll} variant="outline">
                  Auto-Assign from Inventory Data
                </Button>
                <Button onClick={() => {
                  setItemConfigurations(prev => 
                    prev.map(config => ({
                      ...config,
                      entityName: selectedTemplate?.entityName || '',
                      fundCluster: selectedTemplate?.fundCluster || '',
                      isOverridden: false
                    }))
                  );
                }} variant="outline">
                  Apply Template to All Items
                </Button>
              </div>
            </div>
          )}

          {/* Step 4: Individual Overrides */}
          {currentStep === 'overrides' && (
            <div className="space-y-4">
              <Alert>
                <AlertDescription>
                  Review and customize individual items. Items marked with overrides will use their custom values instead of the template.
                </AlertDescription>
              </Alert>
              
              <div className="space-y-4 max-h-96 overflow-y-auto">
                {itemConfigurations.map((config) => {
                  const item = inventoryItems.find(i => i.id === config.itemId);
                  const safeDescription = item?.description || 
                    (item?.model 
                      ? `${item?.brand ? item.brand + ' ' : ''}${item.model}` 
                      : item?.brand) || 
                    '';
                  return (
                    <Card key={config.itemId} className={config.isOverridden ? 'ring-2 ring-orange-200' : ''}>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between mb-3">
                          <div>
                            <h4 className="font-medium">{item?.propertyNumber} - {safeDescription}</h4>
                            <p className="text-sm text-muted-foreground">{item?.category}</p>
                          </div>
                          {config.isOverridden && (
                            <Badge variant="secondary">Customized</Badge>
                          )}
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <Label htmlFor={`entity-${config.itemId}`}>Entity Name</Label>
                            <Input
                              id={`entity-${config.itemId}`}
                              value={config.entityName}
                              onChange={(e) => handleItemConfigChange(config.itemId, 'entityName', e.target.value)}
                              placeholder="Enter entity name"
                            />
                          </div>
                          <div>
                            <Label htmlFor={`fund-${config.itemId}`}>Fund Cluster</Label>
                            <Input
                              id={`fund-${config.itemId}`}
                              value={config.fundCluster}
                              onChange={(e) => handleItemConfigChange(config.itemId, 'fundCluster', e.target.value)}
                              placeholder="Enter fund cluster"
                            />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}

          {/* Step 5: Preview */}
          {currentStep === 'preview' && (
            <div className="space-y-4">
              <Alert>
                <AlertDescription>
                  Review all property cards that will be created. Make sure all information is correct before proceeding.
                </AlertDescription>
              </Alert>
              
              <div className="space-y-4 max-h-96 overflow-y-auto">
                {itemConfigurations.map((config) => {
                  const item = inventoryItems.find(i => i.id === config.itemId);
                  const safeDescription = item?.description || 
                    (item?.model 
                      ? `${item?.brand ? item.brand + ' ' : ''}${item.model}` 
                      : item?.brand) || 
                    '';
                  return (
                    <Card key={config.itemId}>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="font-medium">{item?.propertyNumber} - {safeDescription}</h4>
                          {config.isOverridden && (
                            <Badge variant="secondary">Customized</Badge>
                          )}
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                          <div>
                            <span className="font-medium">Entity Name:</span> {config.entityName}
                          </div>
                          <div>
                            <span className="font-medium">Fund Cluster:</span> {config.fundCluster}
                          </div>
                          <div>
                            <span className="font-medium">Property Number:</span> {item?.propertyNumber}
                          </div>
                          <div>
                            <span className="font-medium">Description:</span> {safeDescription}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}

          {/* Step 6: Processing */}
          {currentStep === 'processing' && (
            <div className="space-y-4 text-center">
              <div className="space-y-2">
                <div className="text-lg font-medium">Creating Property Cards...</div>
                <div className="text-sm text-muted-foreground">
                  {createdCount} of {itemConfigurations.length} cards created
                </div>
                <Progress value={(createdCount / itemConfigurations.length) * 100} className="h-2" />
              </div>
            </div>
          )}
        </div>

        {/* Navigation Buttons */}
        <div className="flex justify-between">
          <Button
            variant="outline"
            onClick={prevStep}
            disabled={currentStep === 'selection' || currentStep === 'processing'}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Previous
          </Button>
          
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            
            {currentStep === 'preview' ? (
              <Button onClick={handleCreateCards} disabled={isCreating}>
                <CheckCircle className="h-4 w-4 mr-2" />
                Create {itemConfigurations.length} Property Cards
              </Button>
            ) : (
              <Button
                onClick={nextStep}
                disabled={!canProceed() || currentStep === 'processing'}
              >
                Next
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
