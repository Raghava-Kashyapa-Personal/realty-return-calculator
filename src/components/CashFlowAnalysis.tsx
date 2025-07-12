import React, { useState, useCallback } from 'react';
import { ProjectData, Payment, IncomeItem } from '@/types/project';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, BarChart2, Landmark, Scale, Percent, HandCoins, CalendarDays } from 'lucide-react';
import { format as formatDateFns, differenceInDays } from 'date-fns';
import { monthToDate } from '@/components/payments/utils';
import { processPaymentsWithLoanTracking, getIRRCashFlows } from '@/utils/loanTracker';
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

const calculateXIRR = (cashFlowsWithDates: Array<{date: Date, amount: number}>): number => {
  try {
    if (cashFlowsWithDates.length < 2) return 0;

    console.log('Calculating XIRR with cash flows:', cashFlowsWithDates);
    
    // Check if we have at least one positive and one negative cash flow
    const hasPositive = cashFlowsWithDates.some(cf => cf.amount > 0);
    const hasNegative = cashFlowsWithDates.some(cf => cf.amount < 0);
    
    if (!hasPositive || !hasNegative) {
      console.warn('XIRR calculation requires both positive and negative cash flows');
      return 0;
    }
    
    // Format transactions for the xirr library
    const transactions = cashFlowsWithDates.map(cf => ({
      amount: cf.amount,
      when: cf.date
    }));

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

    // Total payments (only actual investor money, excluding borrowed funds)
    let totalPayments = 0;
    paymentsData.forEach(p => {
      if (p.type === 'payment') {  // Only count actual payments, not drawdowns (borrowed money)
        console.log('Found payment (investor money):', p.amount, 'type:', p.type);
        totalPayments += Math.abs(p.amount);
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

    // Total returns (only net returns, excluding loan repayments)
    let totalReturns = 0;
    const paymentsForReturns = processPaymentsWithLoanTracking(paymentsData, true);
    
    // Add rental income
    projectDataInput.rentalIncome?.forEach(ri => {
      console.log('Found rental income:', ri.amount);
      totalReturns += ri.amount;
    });
    
    // Add net returns from processed payments (excluding loan repayment portions)
    paymentsForReturns.forEach(p => {
      if (p.type === 'return' || p.type === 'repayment') {
        const netReturn = p.calculatedNetReturn || 0;
        if (netReturn > 0) {
          console.log('Found net return:', netReturn, 'from total:', p.amount);
          totalReturns += netReturn;
        }
      }
    });

    // Calculate total investment (only investor's cash from pocket: payments + interest paid)
    // Note: Excludes drawdowns as they are borrowed money, not investor money
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
    
    // Calculate XIRR using proper loan tracking
    const processedPayments = processPaymentsWithLoanTracking(paymentsData, true);
    const irrCashFlows = getIRRCashFlows(processedPayments);
    
    // Add rental income to IRR calculation
    const allIRRCashFlows = [
      ...irrCashFlows,
      ...(projectDataInput.rentalIncome?.map(ri => ({
        date: ri.date ? new Date(ri.date) : monthToDate(ri.month),
        amount: ri.amount // Rental income is positive cash flow
      })) || [])
    ];
    
    console.log('All IRR cash flows for XIRR calculation:', allIRRCashFlows);
    
    const xirrValue = calculateXIRR(allIRRCashFlows);

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

  // Format project end date with safety check
  const formattedEndDate = (() => {
    if (!projectEndDate) return 'Not set';
    
    try {
      // Ensure it's a valid Date object
      const date = projectEndDate instanceof Date ? projectEndDate : new Date(projectEndDate);
      
      // Check if the date is valid
      if (isNaN(date.getTime())) {
        console.warn('Invalid project end date:', projectEndDate);
        return 'Invalid date';
      }
      
      return formatDateFns(date, 'MMM yyyy');
    } catch (error) {
      console.warn('Error formatting project end date:', error);
      return 'Invalid date';
    }
  })();

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
          description="Cash from pocket only"
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