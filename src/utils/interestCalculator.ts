import { addMonths, differenceInCalendarMonths, endOfMonth, format, isAfter, startOfMonth } from 'date-fns';
import { Payment } from '@/types/project'; 
import { monthToDate } from '@/components/payments/utils';

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

export const calculateMonthlyInterestLogic = ({ payments, interestRate, projectEndDate }: CalculateInterestParams): CalculatedInterestResult => {
  // Helper function to calculate interest details for a given month's activity
  const calculateInterestDetailsForMonth = (balanceAtStartOfMonth: number, paymentsInMonth: Payment[], monthStartDate: Date, dailyRate: number, monthlyRate: number, interestRateInternal: number) => {
    let monthInterest = 0;
    let interestBreakdown: string[] = [];
    const monthEndDate = endOfMonth(monthStartDate);

    // Interest on the balance at the start of the month (for the full month)
    if (balanceAtStartOfMonth > 0) {
      const startBalanceInterest = balanceAtStartOfMonth * monthlyRate;
      monthInterest += startBalanceInterest;
      interestBreakdown.push(`${Math.round(balanceAtStartOfMonth).toLocaleString('en-IN')} (full month)`);
    }

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
        dateB = monthToDate(b.month);
      }
      
      return dateA.getTime() - dateB.getTime();
    });

    for (const payment of sortedMonthPayments) {
      // In our app, payments are negative amounts (outflows)
      // We only calculate interest on outflows (money borrowed)
      if (payment.amount < 0) {
        // Ensure we have a proper Date object
        let paymentDate: Date;
        if (payment.date instanceof Date) {
          paymentDate = payment.date;
        } else if (typeof payment.date === 'string') {
          paymentDate = new Date(payment.date);
        } else {
          paymentDate = monthToDate(payment.month);
        }
        
        const daysInMonth = monthEndDate.getDate();
        const paymentDateDay = paymentDate.getDate();
        const daysRemaining = daysInMonth - paymentDateDay + 1;
        
        if (daysRemaining > 0) {
          const paymentInterest = payment.amount * dailyRate * daysRemaining;
          monthInterest += paymentInterest;
          interestBreakdown.push(`${Math.round(payment.amount).toLocaleString('en-IN')} (${daysRemaining} days)`);
        }
      }
    }
    
    let paymentEntry: Payment | null = null;
    if (monthInterest > 0) {
      // Round to 2 decimal places and store as negative (since it's an outflow)
      const roundedInterest = parseFloat(monthInterest.toFixed(2));
      
      // Create a truly unique ID by combining timestamp and a random value
      const uniqueId = `int_${monthEndDate.getTime()}_${Math.random().toString(36).substring(2, 10)}`;
      
      paymentEntry = {
        id: uniqueId, // Guaranteed unique ID
        amount: -roundedInterest, // Store as NEGATIVE with 2 decimal precision
        type: 'interest',
        date: new Date(monthEndDate), 
        month: (monthEndDate.getMonth()) + (monthEndDate.getFullYear() - 2024) * 12,
        description: `Interest @ ${interestRateInternal}% (Basis: ${interestBreakdown.join(' + ') || 'N/A'})`
      };
    }
    return { amount: monthInterest, paymentEntry };
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
        // First, make sure we're working with the correct sign
        // In our app, payments (outflows) are stored as negative values
        // Returns (inflows) are stored as positive values
        
        console.log(`Processing payment:`, payment);
        
        // For payments (negative amounts), we INCREASE the debt/principal
        if (payment.amount < 0) {
          // Add the absolute value to increase the debt
          runningBalance += Math.abs(payment.amount);
          console.log(`Added payment ${Math.abs(payment.amount)} to balance, new balance: ${runningBalance}`);
        }
        // For returns (positive amounts), we DECREASE the debt/principal
        else if (payment.amount > 0) {
          // Subtract directly to decrease the debt
          runningBalance -= payment.amount;
          console.log(`Subtracted return ${payment.amount} from balance, new balance: ${runningBalance}`);
        }
      }

      // Calculate interest for the current month if there was a balance or payments contributing to it
      // The interest calculation itself uses balanceAtStartOfThisMonth for the full-month part,
      // and paymentsInCurrentLoopMonth for pro-rata parts.
      // Interest should be calculated for every month once there's a positive balance
      if (runningBalance > 0) {
        const interestDetails = calculateInterestDetailsForMonth(balanceAtStartOfThisMonth, paymentsInCurrentLoopMonth, currentMonthStart, dailyRate, monthlyRate, interestRate);
        if (interestDetails.paymentEntry) {
          newInterestPayments.push(interestDetails.paymentEntry);
          
          // Since interestDetails.amount is positive but interest is an outflow (like a payment),
          // we should ADD it to the balance (increases debt/principal)
          runningBalance += interestDetails.amount; // Compound interest
          console.log(`Added interest ${interestDetails.amount} to balance, new balance: ${runningBalance}`);
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
