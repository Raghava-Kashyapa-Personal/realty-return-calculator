import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ProjectData } from '@/types/project';
import { IndianRupee, Home, TrendingUp, Percent } from 'lucide-react';

interface ProjectSetupProps {
  projectData: ProjectData;
  updateProjectData: (updates: Partial<ProjectData>) => void;
}

export const ProjectSetup: React.FC<ProjectSetupProps> = ({ projectData, updateProjectData }) => {
  const handleInputChange = (field: keyof ProjectData, value: string | number) => {
    updateProjectData({ [field]: value });
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(value);
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card className="border-blue-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Home className="w-4 h-4 text-blue-600" />
              Project Basics
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="projectName">Project Name</Label>
              <Input
                id="projectName"
                value={projectData.projectName}
                onChange={(e) => handleInputChange('projectName', e.target.value)}
                placeholder="Enter project name"
              />
            </div>
            <div>
              <Label htmlFor="purchasePrice">Purchase Price (₹)</Label>
              <Input
                id="purchasePrice"
                type="number"
                value={projectData.purchasePrice}
                onChange={(e) => handleInputChange('purchasePrice', Number(e.target.value))}
                placeholder="5000000"
              />
              <p className="text-xs text-gray-500 mt-1">
                {formatCurrency(projectData.purchasePrice)}
              </p>
            </div>
            <div>
              <Label htmlFor="closingCosts">Closing Costs (₹)</Label>
              <Input
                id="closingCosts"
                type="number"
                value={projectData.closingCosts}
                onChange={(e) => handleInputChange('closingCosts', Number(e.target.value))}
                placeholder="100000"
              />
              <p className="text-xs text-gray-500 mt-1">
                {formatCurrency(projectData.closingCosts)}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-green-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-green-600" />
              Development & Exit
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="renovationCosts">Renovation Costs (₹)</Label>
              <Input
                id="renovationCosts"
                type="number"
                value={projectData.renovationCosts}
                onChange={(e) => handleInputChange('renovationCosts', Number(e.target.value))}
                placeholder="1000000"
              />
              <p className="text-xs text-gray-500 mt-1">
                {formatCurrency(projectData.renovationCosts)}
              </p>
            </div>
            <div>
              <Label htmlFor="salePrice">Expected Sale Price (₹)</Label>
              <Input
                id="salePrice"
                type="number"
                value={projectData.salePrice}
                onChange={(e) => handleInputChange('salePrice', Number(e.target.value))}
                placeholder="8000000"
              />
              <p className="text-xs text-gray-500 mt-1">
                {formatCurrency(projectData.salePrice)}
              </p>
            </div>
            <div>
              <Label htmlFor="saleMonth">Sale Month</Label>
              <Input
                id="saleMonth"
                type="number"
                value={projectData.saleMonth}
                onChange={(e) => handleInputChange('saleMonth', Number(e.target.value))}
                placeholder="24"
                min="1"
              />
              <p className="text-xs text-gray-500 mt-1">
                Month {projectData.saleMonth} from project start
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-purple-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Percent className="w-4 h-4 text-purple-600" />
              Financial Parameters
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="sellingCosts">Selling Costs (₹)</Label>
              <Input
                id="sellingCosts"
                type="number"
                value={projectData.sellingCosts}
                onChange={(e) => handleInputChange('sellingCosts', Number(e.target.value))}
                placeholder="200000"
              />
              <p className="text-xs text-gray-500 mt-1">
                {formatCurrency(projectData.sellingCosts)}
              </p>
            </div>
            <div>
              <Label htmlFor="monthlyInterestRate">Monthly Interest Rate (%)</Label>
              <Input
                id="monthlyInterestRate"
                type="number"
                step="0.01"
                value={(projectData.monthlyInterestRate * 100).toFixed(2)}
                onChange={(e) => handleInputChange('monthlyInterestRate', Number(e.target.value) / 100)}
                placeholder="1.00"
              />
              <p className="text-xs text-gray-500 mt-1">
                {(projectData.monthlyInterestRate * 12 * 100).toFixed(1)}% annual rate
              </p>
            </div>
            <div>
              <Label htmlFor="discountRate">Discount Rate for NPV (%)</Label>
              <Input
                id="discountRate"
                type="number"
                step="0.01"
                value={(projectData.discountRate * 100).toFixed(2)}
                onChange={(e) => handleInputChange('discountRate', Number(e.target.value) / 100)}
                placeholder="12.00"
              />
              <p className="text-xs text-gray-500 mt-1">
                Annual discount rate for NPV calculation
              </p>
            </div>
            <div>
              <Label htmlFor="autoRepayInflow">Auto-Repay Inflow</Label>
              <input
                id="autoRepayInflow"
                type="checkbox"
                checked={projectData.autoRepayInflow || false}
                onChange={e => handleInputChange('autoRepayInflow', e.target.checked)}
              />
              <span className="text-xs text-gray-500 ml-2">If checked, new inflows will default to apply to principal</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-blue-50 border-blue-200">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <IndianRupee className="w-5 h-5 text-blue-600" />
            Project Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="text-center">
              <p className="text-sm text-gray-600">Total Investment</p>
              <p className="text-xl font-bold text-blue-600">
                {formatCurrency(projectData.purchasePrice + projectData.closingCosts + projectData.renovationCosts)}
              </p>
            </div>
            <div className="text-center">
              <p className="text-sm text-gray-600">Expected Returns</p>
              <p className="text-xl font-bold text-green-600">
                {formatCurrency(projectData.salePrice - projectData.sellingCosts)}
              </p>
            </div>
            <div className="text-center">
              <p className="text-sm text-gray-600">Gross Profit</p>
              <p className="text-xl font-bold text-purple-600">
                {formatCurrency(
                  projectData.salePrice - projectData.sellingCosts - 
                  projectData.purchasePrice - projectData.closingCosts - projectData.renovationCosts
                )}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
