import { addDays, addMonths, differenceInDays, endOfMonth, format, isAfter, isSameDay, startOfMonth } from 'date-fns';
import { Payment } from '@/types/project';
import { monthToDate } from '@/components/payments/utils';

interface InterestBreakdownItem {
  fromDate: string;
  toDate: string;
  days: number;
  principal: number;
  rate: number;
  interest: number;
}

// Helper function to get month identifier (YYYYMM)
const getMonthId = (date: Date): number => date.getFullYear() * 100 + date.getMonth();

// Interface for parameters, defined locally
export interface CalculateInterestParams {
  payments: Payment[];
  interestRate: number;
  projectEndDate?: Date;
}

// Updated type for results
export interface CalculatedInterestResult {
  newInterestPayments: Payment[];
  allPaymentsWithInterest: Payment[];
  error?: string;
  finalBalance?: number;
}

// Helper function to parse payment date
const getPaymentDate = (payment: Payment): Date => {
  if (payment.date instanceof Date) return payment.date;
  if (typeof payment.date === 'string') return new Date(payment.date);
  return monthToDate(payment.month);
};

export const calculateMonthlyInterestLogic = ({
  payments,
  interestRate,
  projectEndDate,
}: CalculateInterestParams): CalculatedInterestResult => {
  // Helper function to format date as DD-MM-YYYY
  const formatDate = (date: Date): string => {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}-${month}-${year}`;
  };

  // Sort payments by date
  const sortedPayments = [...payments]
    .filter(p => p.type !== 'interest')
    .sort((a, b) => getPaymentDate(a).getTime() - getPaymentDate(b).getTime());

  if (sortedPayments.length === 0) {
    return {
      newInterestPayments: [],
      allPaymentsWithInterest: payments,
      error: 'No valid payments found for interest calculation',
    };
  }

  // Initialize variables
  const interestPayments: Payment[] = [];
  const allPayments: Payment[] = [...payments];
  let currentDate = startOfMonth(getPaymentDate(sortedPayments[0]));
  const endDate = projectEndDate || endOfMonth(new Date());
  const dailyRate = interestRate / 100 / 365;

  // Process each month
  while (currentDate <= endDate) {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    
    // Get payments for this month
    const monthPayments = sortedPayments.filter(p => {
      const paymentDate = getPaymentDate(p);
      return paymentDate >= monthStart && paymentDate <= monthEnd;
    });

    // Calculate interest for each day of the month
    let dailyInterests: { date: Date; principal: number; days: number }[] = [];
    let currentPrincipal = 0;
    let currentDateInMonth = new Date(monthStart);
    
    // Process each day of the month
    while (currentDateInMonth <= monthEnd) {
      // Check if there are payments on this day
      const paymentsToday = monthPayments.filter(p => 
        isSameDay(getPaymentDate(p), currentDateInMonth)
      );
      
      // Add entry for this day
      dailyInterests.push({
        date: new Date(currentDateInMonth),
        principal: currentPrincipal,
        days: 1
      });
      
      // Update principal for next day
      paymentsToday.forEach(payment => {
        currentPrincipal += Math.abs(payment.amount);
      });
      
      currentDateInMonth = addDays(currentDateInMonth, 1);
    }
    
    // Group consecutive days with same principal
    const groupedInterests: typeof dailyInterests = [];
    if (dailyInterests.length > 0) {
      let currentGroup = { ...dailyInterests[0] };
      
      for (let i = 1; i < dailyInterests.length; i++) {
        if (dailyInterests[i].principal === currentGroup.principal) {
          currentGroup.days++;
        } else {
          groupedInterests.push({ ...currentGroup });
          currentGroup = { ...dailyInterests[i] };
        }
      }
      groupedInterests.push(currentGroup);
    }
    
    // Calculate total interest for the month
    let totalInterest = 0;
    const breakdown: InterestBreakdownItem[] = [];
    
    groupedInterests.forEach(period => {
      if (period.principal > 0) {
        const interest = period.principal * dailyRate * period.days;
        totalInterest += interest;
        
        const fromDate = formatDate(period.date);
        const toDate = formatDate(addDays(period.date, period.days - 1));
        
        breakdown.push({
          fromDate,
          toDate,
          days: period.days,
          principal: period.principal,
          rate: interestRate,
          interest: parseFloat(interest.toFixed(2))
        });
      }
    });
    
    // Create interest payment entry if there's any interest
    if (totalInterest > 0) {
      const interestPayment: Payment = {
        id: `int_${monthStart.getTime()}`,
        amount: parseFloat(totalInterest.toFixed(2)),
        type: 'interest',
        date: new Date(monthEnd),
        month: monthEnd.getMonth() + (monthEnd.getFullYear() - 2024) * 12,
        description: `Interest @ ${interestRate}% for ${format(monthStart, 'MMM yyyy')}`,
        breakdown,
        debtFunded: false
      };
      
      interestPayments.push(interestPayment);
      allPayments.push(interestPayment);
    }
    
    // Move to next month
    currentDate = addMonths(currentDate, 1);
  }
  
  // Sort all payments by date
  allPayments.sort((a, b) => getPaymentDate(a).getTime() - getPaymentDate(b).getTime());
  
  return {
    newInterestPayments: interestPayments,
    allPaymentsWithInterest: allPayments,
    finalBalance: 0 // You might want to calculate this based on your business logic
  };
};
