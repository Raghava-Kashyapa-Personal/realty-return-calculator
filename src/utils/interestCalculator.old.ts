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

  // Helper function to calculate interest details for a given month's activity
  const calculateInterestDetailsForMonth = (
    balanceAtStartOfMonth: number, 
    paymentsInMonth: Payment[], 
    monthStartDate: Date, 
    dailyRate: number, 
    monthlyRate: number, 
    interestRateInternal: number
  ): { 
    amount: number; 
    paymentEntry: Payment | null; 
    breakdown?: InterestBreakdownItem[];
  } => {
    let monthInterest = 0;
    let interestBreakdown: Array<{
      fromDate: string;
      toDate: string;
      days: number;
      principal: number;
      rate: number;
      interest: number;
    }> = [];
    
    const monthEndDate = endOfMonth(monthStartDate);
    const daysInMonth = monthEndDate.getDate();
    
    // Sort payments by date
    const sortedPayments = [...paymentsInMonth].sort((a, b) => {
      const dateA = a.date ? (a.date instanceof Date ? a.date : new Date(a.date)) : monthToDate(a.month);
      const dateB = b.date ? (b.date instanceof Date ? b.date : new Date(b.date)) : monthToDate(b.month);
      return dateA.getTime() - dateB.getTime();
    });
    
    // Initialize tracking variables
    let currentDate = new Date(monthStartDate);
    let currentBalance = Math.abs(balanceAtStartOfMonth);
    let totalInterest = 0;
    const interestBreakdown: InterestBreakdownItem[] = [];
    
    // Process each day of the month
    while (currentDate <= monthEndDate) {
      const dayStart = new Date(currentDate);
      const dayEnd = new Date(currentDate);
      dayEnd.setHours(23, 59, 59, 999);
      
      // Find all payments made on this day
      const todaysPayments = sortedPayments.filter(p => {
        const paymentDate = p.date ? (p.date instanceof Date ? p.date : new Date(p.date)) : monthToDate(p.month);
        return paymentDate >= dayStart && paymentDate <= dayEnd;
      });
      
      // Calculate interest for the current balance for this day
      const dailyInterest = (currentBalance * interestRateInternal) / (100 * 365);
      totalInterest += dailyInterest;
      
      // Apply payments at the end of the day
      if (todaysPayments.length > 0) {
        todaysPayments.forEach(payment => {
          if (payment.amount < 0) {
            // Add to principal for negative amounts (payments)
            currentBalance += Math.abs(payment.amount);
          } else if (payment.amount > 0) {
            // Subtract from principal for positive amounts (returns/withdrawals)
            currentBalance = Math.max(0, currentBalance - Math.abs(payment.amount));
          }
        });
      }
      
      // Move to next day
      currentDate.setDate(currentDate.getDate() + 1);
    }

    // Initialize tracking variables
    let currentBalance = Math.abs(balanceAtStartOfMonth);
    let currentDate = new Date(monthStartDate);
    let lastProcessedDate = new Date(monthStartDate);
    let totalInterest = 0;

    // Process each payment in order
    for (const payment of sortedPayments) {
      const paymentDate = payment.date ? 
        (payment.date instanceof Date ? new Date(payment.date) : new Date(payment.date)) : 
        monthToDate(payment.month);
      
      // Calculate interest for the period before this payment
      if (paymentDate > currentDate && currentBalance > 0) {
        const days = Math.ceil((paymentDate.getTime() - currentDate.getTime()) / (1000 * 60 * 60 * 24));
        const interest = (currentBalance * days * interestRateInternal) / (100 * 365);
        
        interestBreakdown.push({
          fromDate: formatDate(currentDate),
          toDate: formatDate(new Date(paymentDate.getTime() - 24 * 60 * 60 * 1000)),
          days,
          principal: currentBalance,
          rate: interestRateInternal,
          interest
        });
        
        totalInterest += interest;
      }
      
      // Update the balance with this payment
      if (payment.amount) {
        currentBalance += Math.abs(payment.amount);
      }
      
      // Move to the next day after the payment
      currentDate = new Date(paymentDate);
      lastProcessedDate = new Date(paymentDate);
    }
    
    // Calculate interest for the remaining days of the month
    if (currentDate <= monthEndDate && currentBalance > 0) {
      const days = Math.ceil((monthEndDate.getTime() - currentDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      const interest = (currentBalance * days * interestRateInternal) / (100 * 365);
      
      const breakdownItem = {
        fromDate: formatDate(currentDate),
        toDate: formatDate(monthEndDate),
        days,
        principal: currentBalance,
        rate: interestRateInternal,
        interest
      };
      
      // Ensure we're pushing a properly typed object
      interestBreakdown.push(breakdownItem);
      totalInterest += interest;
    }
    
    monthInterest = parseFloat(totalInterest.toFixed(2));

    // Pro-rata interest for payments made during the month
    const sortedMonthPayments = [...paymentsInMonth].sort((a, b) => {
      // Ensure we have proper Date objects for comparison
      let dateA: Date;
      let dateB: Date;
      
      if (a.date instanceof Date) {
        dateA = a.date;
      } else if (typeof a.date === 'string') {
        dateA = new Date(a.date);
      } else {
        dateA = monthToDate(a.month);
      }
      
      if (b.date instanceof Date) {
        dateB = b.date;
      } else if (typeof b.date === 'string') {
        dateB = new Date(b.date);
      } else {
    }
    
    let paymentEntry: Payment | null = null;
    if (monthInterest > 0) {
      // Create a truly unique ID by combining timestamp and a random value
      const uniqueId = `int_${monthEndDate.getTime()}_${Math.random().toString(36).substring(2, 10)}`;
      
      // Format the breakdown for display
      const formattedBreakdown = interestBreakdown.map(item => {
        const interest = (item.principal * item.days * item.rate) / (100 * 365);
        return {
          fromDate: item.fromDate,
          toDate: item.toDate,
          days: item.days,
          principal: item.principal,
          rate: item.rate,
          interest: parseFloat(interest.toFixed(2))
        };
      });
      
      // Calculate total interest from breakdown to avoid floating point errors
      const totalInterest = formattedBreakdown.reduce((sum, item) => sum + item.interest, 0);
      
      // Format the description to match the image
      let description = `<div style="font-family: Arial, sans-serif; font-size: 14px; line-height: 1.5;">
        <div style="margin-bottom: 15px; font-weight: bold;">Interest Calculation:</div>
        <div style="margin-bottom: 10px;">
          <div style="display: flex; margin-bottom: 5px;">
            <div style="width: 200px;">Basis</div>
            <div style="width: 100px; text-align: right;">Days</div>
            <div style="width: 120px; text-align: right;">Amount (₹)</div>
            <div style="width: 80px; text-align: right;">Rate (%)</div>
            <div style="width: 120px; text-align: right;">Interest (₹)</div>
          </div>
          ${formattedBreakdown.map(item => `
            <div style="display: flex; margin-bottom: 3px; border-bottom: 1px solid #eee; padding-bottom: 3px;">
              <div style="width: 200px;">${item.fromDate} to ${item.toDate}</div>
              <div style="width: 100px; text-align: right;">${item.days}</div>
              <div style="width: 120px; text-align: right;">${item.principal.toFixed(2)}</div>
              <div style="width: 80px; text-align: right;">${item.rate}%</div>
              <div style="width: 120px; text-align: right; font-weight: bold;">${item.interest.toFixed(2)}</div>
            </div>`).join('')}
          <div style="display: flex; margin-top: 8px; padding-top: 5px; border-top: 2px solid #000;">
            <div style="width: 420px; text-align: right; font-weight: bold;">Total Interest:</div>
            <div style="width: 120px; text-align: right; font-weight: bold;">₹${totalInterest.toFixed(2)}</div>
          </div>
        </div>
      </div>`;
      
      paymentEntry = {
        id: uniqueId,
        amount: Math.round(totalInterest * 100) / 100, // Ensure proper rounding
        type: 'interest' as const,
        date: new Date(monthEndDate),
        month: (monthEndDate.getMonth()) + (monthEndDate.getFullYear() - 2024) * 12,
        description: description,
        breakdown: formattedBreakdown, // Store raw data for potential export
        // Ensure all required properties are included
        debtFunded: false
      } as Payment; // Type assertion to ensure compatibility
    }
    return { 
      amount: monthInterest, 
      paymentEntry,
      breakdown: interestBreakdown.map(item => ({
        fromDate: item.fromDate,
        toDate: item.toDate,
        days: item.days,
        principal: item.principal,
        rate: item.rate,
        interest: item.interest
      }))
    };
  };

  const paymentsWithoutInterest = payments.filter(p => p.type !== 'interest');

  if (!paymentsWithoutInterest.length && interestRate > 0) {
    // If no principal payments but there's an interest rate, it implies a scenario like an opening balance loan
    // This case might need special handling if the 'payments' array is expected to define the initial principal.
    // For now, if no payments, no interest is calculated from this function directly without a starting balance concept.
    // Consider if an 'initialPrincipal' parameter is needed for loans with no payment entries yet.
  } 
  if (!paymentsWithoutInterest.length && interestRate <= 0) {
     return {
      newInterestPayments: [],
      allPaymentsWithInterest: payments, 
      error: 'No non-interest payments found and no interest rate provided.'
    };
  }

  const dailyRate = interestRate / 100 / 365;
  const monthlyRate = interestRate / 100 / 12;
  const newInterestPayments: Payment[] = [];
  let runningBalance = 0;

  if (paymentsWithoutInterest.length === 0 && interestRate > 0) {
    // This case is tricky. If there are no principal payments, what is the principal amount?
    // The current logic derives principal from 'payment' type entries.
    // If the intent is to calculate interest on a loan that hasn't had drawdowns yet, 
    // this function would need an initialPrincipal input.
    // For now, we proceed assuming payments define principal changes.
  }

  // Clear existing interest payments first to avoid duplicates
  const existingInterestPayments = payments.filter(p => p.type === 'interest');
  // If we're recalculating, remove any existing interest payments to avoid duplicates
  if (existingInterestPayments.length > 0) {
    console.log(`Removing ${existingInterestPayments.length} existing interest payments for recalculation`);
  }
  
  // Sort dates for analysis
  const allSortedPrincipalPayments = paymentsWithoutInterest.sort((a, b) => {
    // Ensure we have proper Date objects for comparison
    let dateA: Date;
    let dateB: Date;
    
    if (a.date instanceof Date) {
      dateA = a.date;
    } else if (typeof a.date === 'string') {
      dateA = new Date(a.date);
    } else {
      dateA = monthToDate(a.month);
    }
    
    if (b.date instanceof Date) {
      dateB = b.date;
    } else if (typeof b.date === 'string') {
      dateB = new Date(b.date);
    } else {
      dateB = monthToDate(b.month);
    }
    
    return dateA.getTime() - dateB.getTime();
  });

  if (allSortedPrincipalPayments.length === 0 && interestRate <=0) {
    return { newInterestPayments: [], allPaymentsWithInterest: payments };
  }
  if (allSortedPrincipalPayments.length === 0 && interestRate > 0) {
     // Still, no principal to act upon if no payments define it.
     // The future interest loop below might kick in if runningBalance somehow becomes > 0, but unlikely here.
  }


  let firstPaymentDate: Date | null = null;
  let lastPaymentDate: Date | null = null;

  if (allSortedPrincipalPayments.length > 0) {
    firstPaymentDate = startOfMonth(allSortedPrincipalPayments[0].date ? new Date(allSortedPrincipalPayments[0].date) : monthToDate(allSortedPrincipalPayments[0].month));
    lastPaymentDate = endOfMonth(allSortedPrincipalPayments[allSortedPrincipalPayments.length - 1].date ? new Date(allSortedPrincipalPayments[allSortedPrincipalPayments.length - 1].date) : monthToDate(allSortedPrincipalPayments[allSortedPrincipalPayments.length - 1].month));
  }
  
  // If there are payments, iterate from the month of the first payment to either the end date or a reasonable number of months into the future
  if (firstPaymentDate) {
    // If no explicit last payment date or if user wants to calculate interest until projectEndDate
    if (!lastPaymentDate || (projectEndDate && isAfter(projectEndDate, lastPaymentDate))) {
      lastPaymentDate = projectEndDate || addMonths(new Date(), 6); // Use project end date or 6 months into future as fallback
    }
    let currentLoopMonthDate = new Date(firstPaymentDate);

    while (currentLoopMonthDate.getTime() <= lastPaymentDate.getTime()) {
      const currentMonthStart = startOfMonth(currentLoopMonthDate);
      const currentMonthEnd = endOfMonth(currentLoopMonthDate);
      const currentMonthId = getMonthId(currentMonthStart);

      // Payments within the current iteration month
      const paymentsInCurrentLoopMonth = allSortedPrincipalPayments.filter(p => {
        const pDate = p.date ? new Date(p.date) : monthToDate(p.month);
        return getMonthId(pDate) === currentMonthId;
      });

      const balanceAtStartOfThisMonth = runningBalance;
      
      // Update running balance with principal changes from payments in this month
      // IMPORTANT: Negative amounts are outflows (payments), positive are inflows (returns)
      for (const payment of paymentsInCurrentLoopMonth) {
        // Payments (outflows) are negative, returns (inflows) are positive
        if (payment.amount < 0) {
          runningBalance += payment.amount; // Add negative payment to runningBalance (debt increases)
        } else if (payment.amount > 0) {
          runningBalance += payment.amount; // Add positive return to runningBalance (debt decreases)
        }
      }

      // Calculate interest for the current month if there is a negative balance (debt)
      if (runningBalance < 0) {
        // Calculate interest on the absolute value of the negative balance
        const interestAmount = Math.abs(runningBalance) * monthlyRate;
        if (interestAmount > 0) {
          // Create interest payment as positive (income)
          const interestPayment: Payment = {
            id: `int_${currentMonthStart.getTime()}`,
            amount: interestAmount,
            type: 'interest',
            date: new Date(currentMonthEnd),
            month: (currentMonthEnd.getMonth()) + (currentMonthEnd.getFullYear() - 2024) * 12,
            description: `Interest @ ${interestRate}% on balance of ${Math.abs(runningBalance).toLocaleString('en-IN')}`,
            debtFunded: false
          };
          newInterestPayments.push(interestPayment);
          // Add interest to runningBalance (reduces debt)
          runningBalance += interestAmount;
        }
      }
      currentLoopMonthDate = addMonths(currentMonthStart, 1);
    }
  }

  // Future interest calculation (compounds on the final runningBalance)
  if (runningBalance > 0 && interestRate > 0) {
    // Always start future interest from the month after the last calculated interest payment or last principal payment
    let futureProcessingDate;
    
    if (newInterestPayments.length > 0) {
      // If we have calculated interest already, start from the month after the last interest payment
      const lastInterestDate = new Date(newInterestPayments[newInterestPayments.length - 1].date);
      futureProcessingDate = addMonths(startOfMonth(lastInterestDate), 1);
    } else if (lastPaymentDate) {
      // If no interest calculated yet, but we have principal payments, start from the month after the last payment
      futureProcessingDate = addMonths(startOfMonth(lastPaymentDate), 1);
    } else {
      // If no payments at all, start from next month of current date
      futureProcessingDate = addMonths(startOfMonth(new Date()), 1);
    }

    const maxFutureMonths = 3; // Default future months if no projectEndDate
    let monthsCalculated = 0;

    while(true) {
      const monthStartDate = startOfMonth(futureProcessingDate);
      const monthEndDate = endOfMonth(futureProcessingDate);

      // Stop if projectEndDate is defined and current month is after projectEndDate
      if (projectEndDate && isAfter(monthStartDate, projectEndDate)) {
        break;
      }

      // Stop if no projectEndDate and we've calculated the default number of future months
      if (!projectEndDate && monthsCalculated >= maxFutureMonths) {
        break;
      }
      
      const interestDetails = calculateInterestDetailsForMonth(runningBalance, [], monthStartDate, dailyRate, monthlyRate, interestRate);

      if (interestDetails.paymentEntry) {
        if (interestDetails.amount <= 0) { // Stop if interest becomes zero or negative
            break;
        }
        newInterestPayments.push(interestDetails.paymentEntry);
        runningBalance += interestDetails.amount; 
      } else { // Stop if no interest payment is generated (e.g., balance became zero through other means)
        break;
      }
      futureProcessingDate = addMonths(futureProcessingDate, 1);
      monthsCalculated++;
    }
  }
  
  const allPaymentsWithInterest = [
    ...allSortedPrincipalPayments.map(p => {
      // Ensure month is calculated correctly from date
      let month = p.month;
      if (p.date) {
        const dateObj = p.date instanceof Date ? p.date : new Date(p.date);
        month = dateObj.getMonth() + (dateObj.getFullYear() - 2024) * 12;
      }
      return { ...p, type: p.type ?? ('payment' as const), month };
    }),
    ...newInterestPayments.map(p => {
      // Ensure month is calculated correctly from date
      let month = p.month;
      if (p.date) {
        const dateObj = p.date instanceof Date ? p.date : new Date(p.date);
        month = dateObj.getMonth() + (dateObj.getFullYear() - 2024) * 12;
      }
      return { ...p, month };
    })
  ].sort((a, b) => {
    // Ensure we have proper Date objects for comparison
    let dateA: Date;
    let dateB: Date;
    
    if (a.date instanceof Date) {
      dateA = a.date;
    } else if (typeof a.date === 'string') {
      dateA = new Date(a.date);
    } else {
      dateA = monthToDate(a.month);
    }
    
    if (b.date instanceof Date) {
      dateB = b.date;
    } else if (typeof b.date === 'string') {
      dateB = new Date(b.date);
    } else {
      dateB = monthToDate(b.month);
    }
    
    if (dateA.getTime() === dateB.getTime()) {
      if (a.type === 'interest' && b.type !== 'interest') return 1;
      if (a.type !== 'interest' && b.type === 'interest') return -1;
    }
    return dateA.getTime() - dateB.getTime();
  });

  return {
    newInterestPayments,
    allPaymentsWithInterest,
    finalBalance: runningBalance
  };
};
