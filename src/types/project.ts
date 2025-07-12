export interface InterestBreakdownItem {
  fromDate: string;
  toDate: string;
  days: number;
  principal: number;
  rate: number;
  interest: number;
}

export interface Payment {
  id: string;
  month: number;
  amount: number;
  description?: string | any; // Allow React nodes for formatted descriptions
  debtFunded?: boolean;
  date?: Date | string;
  type?: 'payment' | 'return' | 'interest' | 'drawdown' | 'repayment';
  breakdown?: InterestBreakdownItem[];
  debtDrawdown?: boolean;
  applyToDebt?: boolean;
  
  // Enhanced loan tracking fields
  loanAdjustment?: number; // Amount applied to loan principal
  netReturn?: number; // Amount after loan adjustment (for IRR calculation)
  isPartialLoanPayment?: boolean; // Flag to indicate this is a partial loan payment
}

export interface IncomeItem {
  id?: string;
  month: number;
  amount: number;
  type: 'rental' | 'sale';
  date?: string | Date;
  description?: string;
}

export interface ExpenseItem {
  month: number;
  amount: number;
  type: 'operating' | 'interest' | 'selling';
}

export interface ProjectData {
  projectName: string;
  annualInterestRate: number; // Annual interest rate as a percentage (e.g., 12 for 12%)
  projectEndDate?: Date; // Project end date for interest calculations
  purchasePrice: number;
  closingCosts: number;
  // Support both property naming conventions
  renovationCosts?: number;
  repairs?: number;
  salePrice?: number;
  afterRepairValue?: number;
  otherInitialCosts?: number;
  saleMonth?: number;
  sellingCosts?: number;
  monthlyInterestRate?: number;
  discountRate?: number;
  payments: Payment[];
  rentalIncome: IncomeItem[];
  operatingExpenses?: ExpenseItem[];
}

export interface CashFlowRow {
  month: number;
  payments: number;
  interest: number;
  rental: number;
  sale: number;
  netCashFlow: number;
  cumulativeCashFlow: number;
  outstandingBalance: number;
}

export interface ProjectSettings {
  autoRepayInflow: boolean;
}
