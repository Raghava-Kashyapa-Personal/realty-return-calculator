
import React, { useState, useCallback } from 'react';
import { ProjectData, Payment, IncomeItem } from '@/types/project';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, BarChart2, Landmark, Scale, Percent, HandCoins, CalendarDays, RefreshCw } from 'lucide-react';
import { format as formatDateFns, differenceInDays } from 'date-fns';
import { monthToDate } from '@/components/payments/utils';
import { Button } from '@/components/ui/button';
import xirr from 'xirr';

interface CashFlowAnalysisProps {
  projectData: ProjectData;
  allPaymentsWithInterest: Payment[];
  projectEndDate?: Date;
  lastUpdated?: number; // Timestamp to trigger recalculation
}

// Define a type that includes both Payment and IncomeItem
interface CashFlowItem extends Omit<Payment, 'id' | 'type'> {
  type: 'payment' | 'return' | 'interest' | 'rental' | 'sale';
  id?: string;
}

const calculateXIRR = (allCashFlows: CashFlowItem[]): number => {
  try {
    if (allCashFlows.length < 2) return 0;

    console.log('Calculating XIRR with cash flows:', allCashFlows);
    
    // Properly format transactions for the xirr library
    const transactions = allCashFlows.map(cf => {
      const date = 'date' in cf && cf.date ? new Date(cf.date) : monthToDate(cf.month);
      let amount;
      if (cf.type === 'payment' || cf.type === 'interest') {
        amount = -Math.abs(cf.amount);
      } else if (cf.type === 'return' || cf.type === 'rental' || cf.type === 'sale') {
        amount = Math.abs(cf.amount);
      } else {
        // Default case
        amount = cf.amount;
      }
      return { amount, when: date };
    });

    console.log('XIRR transactions:', transactions);
    
    // Calculate XIRR using the xirr library
    const result = xirr(transactions);
    return isNaN(result) ? 0 : result * 100; // Convert to percentage
  } catch (error) {
    console.error('Error calculating XIRR:', error);
    return 0;
  }
};

export const CashFlowAnalysis: React.FC<CashFlowAnalysisProps> = ({ 
  projectData, 
  allPaymentsWithInterest, 
  projectEndDate,
  lastUpdated = 0
}) => {
  // Track if initial data has been loaded
  const [initialDataLoaded, setInitialDataLoaded] = useState(false);
  
  const [analysisData, setAnalysisData] = useState({
    totalInvestment: 0,
    totalReturns: 0,
    netProfit: 0,
    totalInterestPaid: 0,
    xirrValue: 0,
    lastCalculated: null as Date | null
  });

  // Pure calculation function that doesn't modify interest data
  // Takes payments data as an argument to avoid side effects
  const calculateAnalysis = (paymentsData: Payment[], projectDataInput: ProjectData) => {
    console.log('Calculating financial metrics with existing data');
    
    if (!projectDataInput) {
      return {
        totalInvestment: 0,
        totalReturns: 0,
        netProfit: 0,
        totalInterestPaid: 0,
        xirrValue: 0,
        lastCalculated: null
      };
    }

    console.log('Calculating financial analysis with:', {
      payments: allPaymentsWithInterest.length,
      rental: projectData.rentalIncome.length
    });

    // Total payments (only principal, not interest)
    let totalPayments = 0;
    paymentsData.forEach(p => {
      if (p.type === 'payment') {
        totalPayments += p.amount;
      }
    });

    // Total interest paid
    let totalInterestPaid = 0;
    paymentsData.forEach(p => {
      if (p.type === 'interest') {
        totalInterestPaid += Math.abs(p.amount); // Ensure positive for display
      }
    });

    // Total returns
    let totalReturns = 0;
    
    // Add rental income
    projectDataInput.rentalIncome.forEach(ri => {
      totalReturns += ri.amount;
    });
    
    // Add return payments
    paymentsData.forEach(p => {
      if (p.type === 'return') {
        totalReturns += p.amount;
      }
    });

    // Calculate total investment (payments - interest)
    const totalInvestment = totalPayments - totalInterestPaid;

    
    // Net profit calculation
    const netProfit = totalReturns - totalInvestment;
    
    // Calculate XIRR with all cash flows
    const allCashFlows: CashFlowItem[] = [
      // Ensure all payments have a type property
      ...paymentsData.map(p => ({
        ...p,
        type: p.type || 'payment' as const
      })),
      // Add rental income with proper typing
      ...projectDataInput.rentalIncome.map(ri => ({
        ...ri,
        type: ri.type as 'rental',
        id: ri.id || `rental-${ri.month}-${ri.amount}`
      }))
    ];
    
    const xirrValue = calculateXIRR(allCashFlows);

    const result = { 
      totalInvestment, 
      totalReturns, 
      netProfit, 
      totalInterestPaid,
      xirrValue,
      lastCalculated: new Date()
    };
    
    console.log('Analysis results:', result);
    return result;
  }; // Removed dependency array since it's no longer a useCallback

  // Currency formatter
  const formatCurrency = (value: number, isInvestment: boolean = false) => {
    // For investment values, use absolute value to remove negative sign
    const displayValue = isInvestment ? Math.abs(value) : value;
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(displayValue);
  };
  
  // Load data once when component first mounts or when tab is switched
  // This provides initial data without automatic recalculation on every change
  React.useEffect(() => {
    if (!initialDataLoaded && allPaymentsWithInterest.length > 0) {
      console.log('Loading initial data for CashFlowAnalysis');
      const result = calculateAnalysis(allPaymentsWithInterest, projectData);
      setAnalysisData(result);
      setInitialDataLoaded(true);
    }
  }, [initialDataLoaded, allPaymentsWithInterest.length, projectData]);
  
  // Handle manual refresh - only recalculates metrics using existing data
  const handleRefresh = () => {
    console.log('Manual refresh triggered - recalculating metrics only');
    // Use existing interest data without modifying it
    const result = calculateAnalysis(allPaymentsWithInterest, projectData);
    setAnalysisData(result);
    console.log('Metrics manually refreshed at', new Date().toISOString());
  };

  const MetricCard: React.FC<{ title: string; value: string; icon: React.ReactNode; description?: string }> = 
    ({ title, value, icon, description }) => (
    <Card className="flex-1 min-w-[200px] shadow-lg hover:shadow-xl transition-shadow duration-300">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent className="text-left">
        <div className="text-2xl font-bold">{value}</div>
        {description && <p className="text-xs text-muted-foreground block text-left">{description}</p>}
      </CardContent>
    </Card>
  );

  if (!projectData) {
    return <p>No project data available for analysis.</p>;
  }

  // Format project end date
  const formattedEndDate = projectEndDate ? formatDateFns(projectEndDate, 'MMM yyyy') : 'Not set';

  return (
    <div className="space-y-6 p-4 bg-gray-50 rounded-lg">
      <div className="flex justify-between items-center mb-4">
        <div>
          <h2 className="text-2xl font-semibold text-gray-700">Project Financial Summary</h2>
          {projectEndDate && (
            <p className="text-sm text-muted-foreground">
              Project End Date: {formattedEndDate}
            </p>
          )}
        </div>
        <Button 
          onClick={handleRefresh} 
          size="sm" 
          variant="outline" 
          className="flex items-center gap-1">
          <RefreshCw className="h-4 w-4" />
          Refresh
        </Button>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-4">
        <MetricCard 
          title="Total Investment"
          value={formatCurrency(analysisData.totalInvestment, true)}
          icon={<Landmark className="h-5 w-5 text-blue-500" />}
          description="Principal + Interest payments"
        />
        <MetricCard 
          title="Total Returns"
          value={formatCurrency(analysisData.totalReturns)}
          icon={<TrendingUp className="h-5 w-5 text-green-500" />}
          description="Total rental and sale income"
        />
        <MetricCard 
          title="Net Profit"
          value={formatCurrency(analysisData.netProfit)}
          icon={<Scale className="h-5 w-5 text-purple-500" />}
          description="Total Returns - Total Investment"
        />
        <MetricCard 
          title="Total Interest Paid"
          value={formatCurrency(analysisData.totalInterestPaid)}
          icon={<HandCoins className="h-5 w-5 text-red-500" />}
          description="Cumulative interest paid on debt"
        />
        <MetricCard 
          title="XIRR"
          value={`${analysisData.xirrValue.toFixed(2)}%`}
          icon={<Percent className="h-5 w-5 text-yellow-500" />}
          description="Time-weighted return rate"
        />
        {projectEndDate && (
          <MetricCard 
            title="Project End Date"
            value={formatDateFns(projectEndDate, 'MMM dd, yyyy')}
            icon={<CalendarDays className="h-5 w-5 text-teal-500" />}
            description="Derived from last cash flow"
          />
        )}
      </div>
    </div>
  );
};