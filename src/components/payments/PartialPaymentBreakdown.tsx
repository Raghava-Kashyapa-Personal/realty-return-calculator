import React, { useState } from 'react';
import { ChevronDown, ChevronRight, Info } from 'lucide-react';
import { ProcessedPayment } from '@/utils/loanTracker';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

interface PartialPaymentBreakdownProps {
  payment: ProcessedPayment;
  formatCurrency: (amount: number) => string;
  showDetails?: boolean;
}

export const PartialPaymentBreakdown: React.FC<PartialPaymentBreakdownProps> = ({
  payment,
  formatCurrency,
  showDetails = true
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  
  const hasLoanAdjustment = (payment.calculatedLoanAdjustment || 0) > 0;
  const hasNetReturn = (payment.calculatedNetReturn || 0) > 0;
  const isPartialPayment = hasLoanAdjustment && hasNetReturn;

  // Don't show breakdown for simple cases
  if (!isPartialPayment && !showDetails) {
    return null;
  }

  const totalAmount = Math.abs(payment.amount);
  const loanPortion = payment.calculatedLoanAdjustment || 0;
  const returnPortion = payment.calculatedNetReturn || 0;
  const loanPercentage = totalAmount > 0 ? (loanPortion / totalAmount) * 100 : 0;
  const returnPercentage = totalAmount > 0 ? (returnPortion / totalAmount) * 100 : 0;

  return (
    <div className="space-y-1">
      {/* Main amount display */}
      <div className="flex items-center gap-2">
        <span className="font-medium">
          {formatCurrency(totalAmount)}
        </span>
        
        {isPartialPayment && (
          <Popover>
            <PopoverTrigger asChild>
              <button className="text-blue-500 hover:text-blue-700">
                <Info className="w-3 h-3" />
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-3">
              <div className="space-y-2">
                <h4 className="font-medium text-sm">Payment Breakdown</h4>
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span>Applied to Loan:</span>
                    <span className="font-medium text-blue-600">
                      {formatCurrency(loanPortion)} ({loanPercentage.toFixed(1)}%)
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Net Return:</span>
                    <span className="font-medium text-green-600">
                      {formatCurrency(returnPortion)} ({returnPercentage.toFixed(1)}%)
                    </span>
                  </div>
                  <hr className="my-1" />
                  <div className="flex justify-between font-medium">
                    <span>Total:</span>
                    <span>{formatCurrency(totalAmount)}</span>
                  </div>
                </div>
              </div>
            </PopoverContent>
          </Popover>
        )}
      </div>

      {/* Expandable details */}
      {showDetails && isPartialPayment && (
        <div className="text-xs text-gray-600">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center gap-1 hover:text-gray-800"
          >
            {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
            <span>Breakdown</span>
          </button>
          
          {isExpanded && (
            <div className="mt-2 pl-4 space-y-1">
              {hasLoanAdjustment && (
                <div className="flex justify-between">
                  <span className="text-blue-600">→ Loan Payment:</span>
                  <span className="font-medium text-blue-600">
                    {formatCurrency(loanPortion)}
                  </span>
                </div>
              )}
              {hasNetReturn && (
                <div className="flex justify-between">
                  <span className="text-green-600">→ Net Return:</span>
                  <span className="font-medium text-green-600">
                    {formatCurrency(returnPortion)}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Visual progress bar for partial payments */}
      {isPartialPayment && (
        <div className="w-full h-1 bg-gray-200 rounded overflow-hidden">
          <div className="h-full flex">
            {loanPercentage > 0 && (
              <div
                className="bg-blue-500"
                style={{ width: `${loanPercentage}%` }}
                title={`${loanPercentage.toFixed(1)}% to loan`}
              />
            )}
            {returnPercentage > 0 && (
              <div
                className="bg-green-500"
                style={{ width: `${returnPercentage}%` }}
                title={`${returnPercentage.toFixed(1)}% net return`}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
};

interface PartialPaymentIndicatorProps {
  payment: ProcessedPayment;
}

export const PartialPaymentIndicator: React.FC<PartialPaymentIndicatorProps> = ({
  payment
}) => {
  const hasLoanAdjustment = (payment.calculatedLoanAdjustment || 0) > 0;
  const hasNetReturn = (payment.calculatedNetReturn || 0) > 0;
  const isPartialPayment = hasLoanAdjustment && hasNetReturn;

  if (!isPartialPayment) return null;

  return (
    <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs bg-blue-100 text-blue-800 border border-blue-300">
      Partial
    </span>
  );
};

interface LoanBalanceDisplayProps {
  balance: number;
  formatCurrency: (amount: number) => string;
  className?: string;
}

export const LoanBalanceDisplay: React.FC<LoanBalanceDisplayProps> = ({
  balance,
  formatCurrency,
  className = ""
}) => {
  const isPositive = balance > 0;
  
  return (
    <span className={`${
      isPositive ? 'text-red-600' : 'text-green-600'
    } ${className}`}>
      {isPositive ? '' : ''}
      {formatCurrency(Math.abs(balance))}
      {balance === 0 && (
        <span className="text-xs text-gray-500 ml-1">(Paid Off)</span>
      )}
    </span>
  );
}; 