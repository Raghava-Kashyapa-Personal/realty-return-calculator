import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Payment } from '@/types/project';
import { calculateLoanBalance } from '@/utils/loanTracker';
import { Info, AlertCircle } from 'lucide-react';

interface LoanAdjustmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  payment: Payment;
  allPayments: Payment[];
  onSave: (updatedPayment: Payment) => void;
}

export const LoanAdjustmentDialog: React.FC<LoanAdjustmentDialogProps> = ({
  open,
  onOpenChange,
  payment,
  allPayments,
  onSave
}) => {
  const [loanAdjustment, setLoanAdjustment] = useState<number>(0);
  const [netReturn, setNetReturn] = useState<number>(0);
  const [error, setError] = useState<string>('');

  const totalAmount = Math.abs(payment.amount);
  
  // Calculate current loan balance before this payment
  const paymentIndex = allPayments.findIndex(p => p.id === payment.id);
  const loanBalance = calculateLoanBalance(allPayments, paymentIndex);
  
  // Initialize values when dialog opens
  useEffect(() => {
    if (open) {
      // Use existing values if available, otherwise auto-calculate
      const existingLoanAdjustment = payment.loanAdjustment || 0;
      const existingNetReturn = payment.netReturn || 0;
      
      if (existingLoanAdjustment > 0 || existingNetReturn > 0) {
        // Use existing manual values
        setLoanAdjustment(existingLoanAdjustment);
        setNetReturn(existingNetReturn);
      } else {
        // Auto-calculate based on loan balance
        const autoLoanAdjustment = Math.min(totalAmount, loanBalance.outstanding);
        const autoNetReturn = totalAmount - autoLoanAdjustment;
        setLoanAdjustment(autoLoanAdjustment);
        setNetReturn(autoNetReturn);
      }
      setError('');
    }
  }, [open, payment, totalAmount, loanBalance.outstanding]);

  // Validate amounts
  useEffect(() => {
    const sum = loanAdjustment + netReturn;
    if (Math.abs(sum - totalAmount) > 0.01) {
      setError(`Loan adjustment and net return must sum to ${totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`);
    } else if (loanAdjustment > loanBalance.outstanding) {
      setError(`Loan adjustment cannot exceed outstanding balance of ₹${loanBalance.outstanding.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`);
    } else if (loanAdjustment < 0 || netReturn < 0) {
      setError('Amounts cannot be negative');
    } else {
      setError('');
    }
  }, [loanAdjustment, netReturn, totalAmount, loanBalance.outstanding]);

  const handleLoanAdjustmentChange = (value: number) => {
    setLoanAdjustment(value);
    setNetReturn(totalAmount - value);
  };

  const handleNetReturnChange = (value: number) => {
    setNetReturn(value);
    setLoanAdjustment(totalAmount - value);
  };

  const handleSave = () => {
    if (error) return;
    
    const updatedPayment: Payment = {
      ...payment,
      loanAdjustment,
      netReturn,
      isPartialLoanPayment: loanAdjustment > 0 && loanAdjustment < totalAmount
    };
    
    onSave(updatedPayment);
    onOpenChange(false);
  };

  const handleCancel = () => {
    onOpenChange(false);
  };

  const loanPercentage = totalAmount > 0 ? (loanAdjustment / totalAmount) * 100 : 0;
  const returnPercentage = totalAmount > 0 ? (netReturn / totalAmount) * 100 : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Adjust Loan vs Return Allocation</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Payment Info */}
          <div className="bg-gray-50 p-3 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <Info className="w-4 h-4 text-blue-500" />
              <span className="font-medium text-sm">Payment Details</span>
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-600">Total Amount:</span>
                <div className="font-medium">₹{totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
              </div>
              <div>
                <span className="text-gray-600">Outstanding Loan:</span>
                <div className="font-medium text-red-600">₹{loanBalance.outstanding.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
              </div>
            </div>
          </div>

          {/* Loan Adjustment Input */}
          <div className="space-y-2">
            <Label htmlFor="loanAdjustment">Amount Applied to Loan Principal</Label>
            <div className="relative">
              <Input
                id="loanAdjustment"
                type="number"
                value={loanAdjustment}
                onChange={(e) => handleLoanAdjustmentChange(Number(e.target.value))}
                min="0"
                max={Math.min(totalAmount, loanBalance.outstanding)}
                step="0.01"
                className="pr-12"
              />
              <div className="absolute right-3 top-2.5 text-sm text-gray-500">
                {loanPercentage.toFixed(1)}%
              </div>
            </div>
            <div className="text-xs text-gray-500">
              This reduces your outstanding loan balance
            </div>
          </div>

          {/* Net Return Input */}
          <div className="space-y-2">
            <Label htmlFor="netReturn">Net Return (for IRR calculation)</Label>
            <div className="relative">
              <Input
                id="netReturn"
                type="number"
                value={netReturn}
                onChange={(e) => handleNetReturnChange(Number(e.target.value))}
                min="0"
                max={totalAmount}
                step="0.01"
                className="pr-12"
              />
              <div className="absolute right-3 top-2.5 text-sm text-gray-500">
                {returnPercentage.toFixed(1)}%
              </div>
            </div>
            <div className="text-xs text-gray-500">
              This counts as actual return for performance calculations
            </div>
          </div>

          {/* Visual Progress Bar */}
          <div className="space-y-2">
            <Label className="text-sm">Allocation Breakdown</Label>
            <div className="w-full h-3 bg-gray-200 rounded overflow-hidden">
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
            <div className="flex justify-between text-xs text-gray-600">
              <span>🔵 Loan: ₹{loanAdjustment.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              <span>🟢 Return: ₹{netReturn.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Quick Action Buttons */}
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => handleLoanAdjustmentChange(Math.min(totalAmount, loanBalance.outstanding))}
              className="flex-1"
            >
              Max to Loan
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => handleLoanAdjustmentChange(0)}
              className="flex-1"
            >
              All Return
            </Button>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleCancel}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!!error}>
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}; 