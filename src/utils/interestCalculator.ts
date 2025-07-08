import { Payment } from '@/types/project';

export interface CalculatedInterestResult {
  newInterestPayments: Payment[];
  allPaymentsWithInterest: Payment[];
  totalInterest: number;
}

interface CalculateInterestParams {
  payments: Payment[];
  interestRate: number;
  projectEndDate?: Date;
}

export const calculateMonthlyInterestLogic = ({
  payments,
  interestRate,
  projectEndDate = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
}: CalculateInterestParams): CalculatedInterestResult => {
  if (!payments.length) {
    return {
      newInterestPayments: [],
      allPaymentsWithInterest: [],
      totalInterest: 0
    };
  }

  // Sort payments by date
  const sortedPayments = [...payments].sort((a, b) => {
    const dateA = a.date ? new Date(a.date) : monthToDate(a.month);
    const dateB = b.date ? new Date(b.date) : monthToDate(b.month);
    return dateA.getTime() - dateB.getTime();
  });

  // Find the earliest payment date to start calculation
  const firstPayment = sortedPayments[0];
  const startDate = firstPayment.date ? new Date(firstPayment.date) : monthToDate(firstPayment.month);
  
  // Find the latest payment date
  const lastPayment = sortedPayments[sortedPayments.length - 1];
  const lastPaymentDate = lastPayment.date ? new Date(lastPayment.date) : monthToDate(lastPayment.month);

  // Use the later of projectEndDate or lastPaymentDate
  const calcEndDate = (projectEndDate && projectEndDate > lastPaymentDate) ? projectEndDate : lastPaymentDate;

  // Calculate interest month by month until calcEndDate
  const newInterestPayments: Payment[] = [];
  const monthlyRate = interestRate / 100 / 12; // Convert annual percentage to monthly decimal

  // Group payments by month for easier processing
  const paymentsByMonth = new Map<string, Payment[]>();
  
  sortedPayments.forEach(payment => {
    const paymentDate = payment.date ? new Date(payment.date) : monthToDate(payment.month);
    const monthKey = `${paymentDate.getFullYear()}-${paymentDate.getMonth()}`;
    
    if (!paymentsByMonth.has(monthKey)) {
      paymentsByMonth.set(monthKey, []);
    }
    paymentsByMonth.get(monthKey)!.push(payment);
  });

  // Process each month from start date to calcEndDate
  let currentDate = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
  let currentPrincipal = 0;
  
  while (currentDate <= calcEndDate) {
    const monthKey = `${currentDate.getFullYear()}-${currentDate.getMonth()}`;
    const monthPayments = paymentsByMonth.get(monthKey) || [];
    
    // Get principal at start of this month
    let monthStartPrincipal = currentPrincipal;
    
    // Process payments in this month to update principal
    for (const payment of monthPayments) {
      if (payment.type === 'drawdown') {
        // Drawdown increases principal
        currentPrincipal += Math.abs(payment.amount);
      } else if (payment.type === 'repayment') {
        // Repayment reduces principal
        currentPrincipal -= Math.abs(payment.amount);
        // Ensure principal doesn't go negative (surplus/overpayment)
        currentPrincipal = Math.max(0, currentPrincipal);
      }
      // Note: 'payment', 'return', and 'interest' types don't affect principal
    }

    // Calculate interest only if there's positive principal at any point in the month
    const maxPrincipal = Math.max(monthStartPrincipal, currentPrincipal);
    let monthInterest = 0;
    
    if (maxPrincipal > 0) {
      // Simple monthly interest calculation on the maximum principal during the month
      monthInterest = maxPrincipal * monthlyRate;
    }
    
    // Create interest payment if there's interest to charge
    if (monthInterest > 0) {
      const lastDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
      
      const interestPayment: Payment = {
        id: `interest-${currentDate.getFullYear()}-${currentDate.getMonth() + 1}`,
        amount: monthInterest,
        type: 'interest',
        date: lastDayOfMonth,
        month: currentDate.getFullYear() * 12 + currentDate.getMonth(),
        description: `Monthly Interest @ ${interestRate}% on principal of ₹${formatIndianCurrency(maxPrincipal)}`
      };
      
      newInterestPayments.push(interestPayment);
      
      // DO NOT add interest to principal - treat interest as an expense/outflow
      // Interest should not capitalize into the debt principal
    }
    
    // Move to next month
    currentDate.setMonth(currentDate.getMonth() + 1);
    currentDate.setDate(1);
  }

  // Combine original payments with new interest payments
  const allPaymentsWithInterest = [...sortedPayments, ...newInterestPayments].sort((a, b) => {
    const dateA = a.date ? new Date(a.date) : monthToDate(a.month);
    const dateB = b.date ? new Date(b.date) : monthToDate(b.month);
    return dateA.getTime() - dateB.getTime();
  });

  const totalInterest = newInterestPayments.reduce((sum, payment) => sum + payment.amount, 0);

  return {
    newInterestPayments,
    allPaymentsWithInterest,
    totalInterest
  };
};

// Helper function to convert month number to date
const monthToDate = (month: number): Date => {
  const year = Math.floor(month / 12);
  const monthIndex = month % 12;
  return new Date(year, monthIndex, 1);
};

// Helper function to create detailed interest description
const createInterestDescription = (startPrincipal: number, payments: Payment[], daysInMonth: number): string => {
  if (payments.length === 0) {
    return `Monthly Interest @ 12% on principal of ₹${formatIndianCurrency(startPrincipal)}`;
  }
  
  // For simplicity, show the main principal amount
  const mainPrincipal = Math.max(startPrincipal, ...payments.map(p => 
    p.type === 'payment' ? Math.abs(p.amount) : 0
  ));
  
  return `Monthly Interest @ 12% on principal of ₹${formatIndianCurrency(mainPrincipal)}`;
};

// Helper function to format currency in Indian format
const formatIndianCurrency = (amount: number): string => {
  return Math.abs(amount).toLocaleString('en-IN', { 
    minimumFractionDigits: 2, 
    maximumFractionDigits: 2 
  });
}; 