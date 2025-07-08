import React, { useState, useCallback } from 'react';
import { ProjectData, Payment, IncomeItem } from '@/types/project';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, BarChart2, Landmark, Scale, Percent, HandCoins, CalendarDays } from 'lucide-react';
import { format as formatDateFns, differenceInDays } from 'date-fns';
import { monthToDate } from '@/components/payments/utils';
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
    console.log('paymentsData length:', paymentsData?.length || 0);
    console.log('paymentsData:', paymentsData);
    console.log('projectDataInput:', projectDataInput);
    
    if (!projectDataInput) {
      console.log('No project data input, returning zeros');
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
      payments: paymentsData?.length || 0,
      rental: projectDataInput.rentalIncome?.length || 0
    });

    // Total payments (only principal, not interest)
    let totalPayments = 0;
    paymentsData.forEach(p => {
      if (p.type === 'payment') {
        console.log('Found payment:', p.amount);
        totalPayments += p.amount;
      }
    });

    // Total interest paid
    let totalInterestPaid = 0;
    paymentsData.forEach(p => {
      if (p.type === 'interest') {
        console.log('Found interest:', p.amount);
        totalInterestPaid += Math.abs(p.amount); // Ensure positive for display
      }
    });

    // Total returns
    let totalReturns = 0;
    
    // Add rental income
    projectDataInput.rentalIncome?.forEach(ri => {
      console.log('Found rental income:', ri.amount);
      totalReturns += ri.amount;
    });
    
    // Add return payments
    paymentsData.forEach(p => {
      if (p.type === 'return') {
        console.log('Found return:', p.amount);
        totalReturns += p.amount;
      }
    });

    // Calculate total investment (payments + interest paid)
    const totalInvestment = Math.abs(totalPayments) + totalInterestPaid;

    
    // Net profit calculation
    const netProfit = totalReturns - totalInvestment;
    
    console.log('Raw calculations:', {
      totalPayments,
      totalInterestPaid,
      totalReturns,
      totalInvestment,
      netProfit
    });
    
    // Calculate XIRR with all cash flows
    let outstandingPrincipal = 0;
    const allCashFlows: CashFlowItem[] = [
      // Payments: exclude debt drawdowns from IRR
      ...paymentsData
        .filter(p => !(p.type === 'payment' && p.debtDrawdown))
        .map(p => ({
          ...p,
          type: p.type || 'payment' as const
        })),
      // Returns: handle applyToDebt logic
      ...paymentsData
        .filter(p => p.type === 'return' && p.applyToDebt)
        .flatMap(p => {
          // Calculate principal remaining before this repayment
          // (We need to reconstruct the principal balance up to this point)
          // For simplicity, assume payments are sorted chronologically
          // We'll do a simple running total here
          // (In a more robust system, this should be calculated outside the map)
          let repayment = p.amount;
          let principalToApply = Math.min(repayment, outstandingPrincipal);
          let excess = repayment - principalToApply;
          // Update outstanding principal
          outstandingPrincipal = Math.max(0, outstandingPrincipal - principalToApply);
          // Only include the excess as a positive cash flow
          return excess > 0 ? [{ ...p, amount: excess, type: 'return' as const }] : [];
        }),
      // Add rental income with proper typing
      ...(projectDataInput.rentalIncome?.map(ri => ({
        ...ri,
        type: ri.type as 'rental',
        id: ri.id || `rental-${ri.month}-${ri.amount}`
      })) || [])
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
  };

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
  
  // Recalculate whenever the data changes
  React.useEffect(() => {
    if (projectData && allPaymentsWithInterest) {
      console.log('Data changed, recalculating analysis');
      const result = calculateAnalysis(allPaymentsWithInterest, projectData);
      setAnalysisData(result);
    }
  }, [allPaymentsWithInterest, projectData, projectEndDate, lastUpdated]);

  const MetricCard: React.FC<{ title: string; value: string; icon: React.ReactNode; description?: string }> = 
    ({ title, value, icon, description }) => (
    <Card className="flex-1 min-w-[160px] shadow-sm hover:shadow-md transition-shadow duration-200">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-3 px-3">
        <CardTitle className="text-xs font-medium">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent className="px-3 pb-3">
        <div className="text-lg font-bold">{value}</div>
        {description && <p className="text-xs text-muted-foreground mt-1">{description}</p>}
      </CardContent>
    </Card>
  );

  if (!projectData) {
    return <p>No project data available for analysis.</p>;
  }

  // Format project end date
  const formattedEndDate = projectEndDate ? formatDateFns(projectEndDate, 'MMM yyyy') : 'Not set';

  return (
    <div className="space-y-3 p-3 bg-white rounded-lg border border-gray-200">
      <div>
        <h3 className="text-lg font-medium text-gray-700">Financial Summary</h3>
        {projectEndDate && (
          <p className="text-xs text-muted-foreground">
            Project End: {formattedEndDate}
          </p>
        )}
      </div>
      
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <MetricCard 
          title="Total Investment"
          value={formatCurrency(analysisData.totalInvestment, true)}
          icon={<Landmark className="h-4 w-4 text-blue-500" />}
          description="Principal + Interest"
        />
        <MetricCard 
          title="Total Returns"
          value={formatCurrency(analysisData.totalReturns)}
          icon={<TrendingUp className="h-4 w-4 text-green-500" />}
          description="Rental + Sale income"
        />
        <MetricCard 
          title="Net Profit"
          value={formatCurrency(analysisData.netProfit)}
          icon={<Scale className="h-4 w-4 text-purple-500" />}
          description="Returns - Investment"
        />
        <MetricCard 
          title="Interest Paid"
          value={formatCurrency(analysisData.totalInterestPaid)}
          icon={<HandCoins className="h-4 w-4 text-red-500" />}
          description="Total interest expense"
        />
        <MetricCard 
          title="XIRR"
          value={`${analysisData.xirrValue.toFixed(2)}%`}
          icon={<Percent className="h-4 w-4 text-yellow-500" />}
          description="Annualized return"
        />
      </div>
    </div>
  );
};