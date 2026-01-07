import React, { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { EnhancedCalendar } from '@/components/ui/enhanced-calendar';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Payment } from '@/types/project';
import { processPaymentsWithLoanTracking, ProcessedPayment } from '@/utils/loanTracker';
import { PartialPaymentBreakdown, PartialPaymentIndicator, LoanBalanceDisplay } from './PartialPaymentBreakdown';
import { LoanAdjustmentDialog } from './LoanAdjustmentDialog';
type PaymentType = 'payment' | 'return' | 'interest' | 'drawdown' | 'repayment';
import { Trash2, CalendarIcon, Pencil, Check, X, Plus, Settings, Filter, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { format } from 'date-fns';

// Payment type filter configuration
const PAYMENT_TYPE_CONFIG: Record<PaymentType, { label: string; bgClass: string; textClass: string; borderClass: string }> = {
  payment: { label: 'Payment', bgClass: 'bg-red-100', textClass: 'text-red-800', borderClass: 'border-red-300' },
  return: { label: 'Return', bgClass: 'bg-green-100', textClass: 'text-green-800', borderClass: 'border-green-300' },
  interest: { label: 'Interest', bgClass: 'bg-purple-100', textClass: 'text-purple-800', borderClass: 'border-purple-300' },
  drawdown: { label: 'Drawdown', bgClass: 'bg-orange-100', textClass: 'text-orange-800', borderClass: 'border-orange-300' },
  repayment: { label: 'Repayment', bgClass: 'bg-blue-100', textClass: 'text-blue-800', borderClass: 'border-blue-300' },
};

type SortField = 'date' | 'amount' | 'type' | 'description' | 'balance';
type SortDirection = 'asc' | 'desc' | null;

interface PaymentsTableProps {
  payments: Payment[];
  editingPayment: string | null;
  editValues: any;
  onStartEdit: (id: string, payment: Payment) => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  onRemove: (id: string) => void;
  setEditValues: (values: any) => void;
  formatCurrency: (value: number) => string;
  formatNumber: (value: number) => string;
  monthToDate: (month: number) => Date;
  dateToMonth: (date: Date) => number;
  isAddingNew?: boolean;
  newPayment?: Partial<Payment>;
  setNewPayment?: (payment: Partial<Payment>) => void;
  onSaveNew?: () => void;
  onCancelNew?: () => void;
  onTogglePaymentType?: (id: string, currentType: string) => void;
  onToggleReturnType?: (id: string, currentType: string) => void;
  onUpdatePayment?: (payment: Payment) => void;
}

export const PaymentsTable: React.FC<PaymentsTableProps> = ({
  payments,
  editingPayment,
  editValues,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
  onRemove,
  setEditValues,
  formatCurrency,
  formatNumber,
  monthToDate: propMonthToDate,
  dateToMonth: propDateToMonth,
  isAddingNew = false,
  newPayment = {},
  setNewPayment = () => {},
  onSaveNew = () => {},
  onCancelNew = () => {},
  onTogglePaymentType,
  onToggleReturnType,
  onUpdatePayment
}) => {
  const [loanAdjustmentDialog, setLoanAdjustmentDialog] = useState<{
    open: boolean;
    payment: Payment | null;
  }>({ open: false, payment: null });

  // Filter state - all types selected by default
  const [activeFilters, setActiveFilters] = useState<Set<PaymentType>>(
    new Set(['payment', 'return', 'interest', 'drawdown', 'repayment'])
  );

  // Sort state
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);

  // Get unique payment types from current data
  const availableTypes = useMemo(() => {
    const types = new Set<PaymentType>();
    payments.forEach(p => {
      if (p.type) types.add(p.type as PaymentType);
    });
    return types;
  }, [payments]);

  // Toggle a filter
  const toggleFilter = (type: PaymentType) => {
    setActiveFilters(prev => {
      const next = new Set(prev);
      if (next.has(type)) {
        // Don't allow deselecting all filters
        if (next.size > 1) {
          next.delete(type);
        }
      } else {
        next.add(type);
      }
      return next;
    });
  };

  // Select all filters
  const selectAllFilters = () => {
    setActiveFilters(new Set(['payment', 'return', 'interest', 'drawdown', 'repayment']));
  };

  // Handle sort click
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      // Cycle through: asc -> desc -> null
      if (sortDirection === 'asc') {
        setSortDirection('desc');
      } else if (sortDirection === 'desc') {
        setSortDirection(null);
        setSortField(null);
      } else {
        setSortDirection('asc');
      }
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Get sort icon for header
  const getSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown className="h-3 w-3 ml-1 opacity-50" />;
    }
    if (sortDirection === 'asc') {
      return <ArrowUp className="h-3 w-3 ml-1" />;
    }
    if (sortDirection === 'desc') {
      return <ArrowDown className="h-3 w-3 ml-1" />;
    }
    return <ArrowUpDown className="h-3 w-3 ml-1 opacity-50" />;
  };

  // Filter and sort payments
  const filteredAndSortedPayments = useMemo(() => {
    // First filter
    let result = payments.filter(p => activeFilters.has((p.type || 'payment') as PaymentType));

    // Then sort if needed
    if (sortField && sortDirection) {
      result = [...result].sort((a, b) => {
        let comparison = 0;

        switch (sortField) {
          case 'date':
            const dateA = a.date ? new Date(a.date).getTime() : a.month;
            const dateB = b.date ? new Date(b.date).getTime() : b.month;
            comparison = dateA - dateB;
            break;
          case 'amount':
            comparison = a.amount - b.amount;
            break;
          case 'type':
            comparison = (a.type || 'payment').localeCompare(b.type || 'payment');
            break;
          case 'description':
            const descA = typeof a.description === 'string' ? a.description : '';
            const descB = typeof b.description === 'string' ? b.description : '';
            comparison = descA.localeCompare(descB);
            break;
          default:
            comparison = 0;
        }

        return sortDirection === 'asc' ? comparison : -comparison;
      });
    }

    return result;
  }, [payments, activeFilters, sortField, sortDirection]);
  // Local implementations that can be overridden by props
  const monthToDate = (month: number) => {
    if (propMonthToDate) return propMonthToDate(month);
    const date = new Date();
    date.setMonth(month % 12);
    date.setFullYear(Math.floor(month / 12));
    return date;
  };

  const dateToMonth = (date: Date) => {
    if (propDateToMonth) return propDateToMonth(date);
    return date.getFullYear() * 12 + date.getMonth();
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      onSaveEdit();
    }
    if (e.key === 'Escape') {
      onCancelEdit();
    }
  };

  // Process filtered payments with loan tracking
  // Note: We process ALL payments first to get correct running balances, then filter the display
  const allPaymentsWithBalance = processPaymentsWithLoanTracking(payments, true);

  // Create a map of payment ID to processed payment for quick lookup
  const balanceMap = useMemo(() => {
    const map = new Map<string, ProcessedPayment>();
    allPaymentsWithBalance.forEach(p => map.set(p.id, p));
    return map;
  }, [allPaymentsWithBalance]);

  // Get filtered and sorted payments with their balance info
  const paymentsWithBalance = useMemo(() => {
    return filteredAndSortedPayments.map(p => balanceMap.get(p.id) || p as ProcessedPayment);
  }, [filteredAndSortedPayments, balanceMap]);
  const totalPayments = payments.reduce((sum, p) => sum + (p.type === 'return' ? p.amount : -p.amount), 0);
  const netCashFlow = payments.reduce((sum, p) => {
    if (p.type === 'return') {
      return sum + p.amount;  // Returns are positive (reduce debt)
    } else if (p.type === 'payment') {
      return sum - p.amount;  // Payments are negative (increase debt)
    } else {
      return sum + p.amount;  // Interest is positive (increases debt)
    }
  }, 0);

  // Remove the conditional column logic and headers
  const showLoanDrawdownCol = false;
  const showApplyToDebtCol = false;

  // Add toggle button functionality for type changes
  const handleTogglePaymentType = (paymentId: string, currentType: string) => {
    if (onTogglePaymentType) {
      onTogglePaymentType(paymentId, currentType);
    }
  };

  const handleToggleReturnType = (paymentId: string, currentType: string) => {
    if (onToggleReturnType) {
      onToggleReturnType(paymentId, currentType);
    }
  };

  if (payments.length === 0 && !isAddingNew) return null;

  return (
    <div className="border border-gray-200 rounded-sm bg-white">
      <div className="overflow-x-auto">
        <Table className="min-w-full">
          <TableHeader className="bg-white border-b border-gray-200">
            <TableRow className="hover:bg-transparent">
              <TableHead
                className="py-3 text-xs font-normal text-gray-500 text-center border-r border-gray-100 cursor-pointer hover:bg-gray-50 select-none"
                onClick={() => handleSort('date')}
              >
                <div className="flex items-center justify-center">
                  Date {getSortIcon('date')}
                </div>
              </TableHead>
              <TableHead
                className="py-3 text-xs font-normal text-gray-500 text-center border-r border-gray-100 cursor-pointer hover:bg-gray-50 select-none"
                onClick={() => handleSort('amount')}
              >
                <div className="flex items-center justify-center">
                  Amount (₹) {getSortIcon('amount')}
                </div>
              </TableHead>
              <TableHead className="py-3 text-xs font-normal text-gray-500 text-center border-r border-gray-100 p-0">
                <Popover>
                  <PopoverTrigger asChild>
                    <div className="flex items-center justify-center cursor-pointer hover:bg-gray-50 py-3 px-2 select-none">
                      Type
                      <Filter className={`h-3 w-3 ml-1 ${activeFilters.size < 5 ? 'text-blue-600' : 'opacity-50'}`} />
                    </div>
                  </PopoverTrigger>
                  <PopoverContent className="w-48 p-2" align="center">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between pb-2 border-b">
                        <span className="text-xs font-medium text-gray-700">Filter by type</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={selectAllFilters}
                          className="h-6 px-2 text-xs"
                        >
                          Select all
                        </Button>
                      </div>
                      {(Object.keys(PAYMENT_TYPE_CONFIG) as PaymentType[]).map(type => {
                        const config = PAYMENT_TYPE_CONFIG[type];
                        const count = payments.filter(p => (p.type || 'payment') === type).length;
                        if (count === 0) return null;
                        return (
                          <label
                            key={type}
                            className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-1 rounded"
                          >
                            <Checkbox
                              checked={activeFilters.has(type)}
                              onCheckedChange={() => toggleFilter(type)}
                            />
                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${config.bgClass} ${config.textClass}`}>
                              {config.label}
                            </span>
                            <span className="text-xs text-gray-400 ml-auto">({count})</span>
                          </label>
                        );
                      })}
                    </div>
                  </PopoverContent>
                </Popover>
              </TableHead>
              <TableHead
                className="py-3 text-xs font-normal text-gray-500 text-center border-r border-gray-100 cursor-pointer hover:bg-gray-50 select-none"
                onClick={() => handleSort('description')}
              >
                <div className="flex items-center justify-center">
                  Description {getSortIcon('description')}
                </div>
              </TableHead>
              <TableHead className="py-3 text-xs font-normal text-gray-500 text-center border-r border-gray-100">
                Outstanding Principal
              </TableHead>
              <TableHead className="py-3 text-xs font-normal text-gray-500 text-center w-24">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {payments.length === 0 && (
              <TableRow className="hover:bg-white">
                <TableCell colSpan={6} className="py-4 text-center text-sm text-gray-500 border-b border-gray-100">
                  No cash flow entries yet. Add your first entry to get started.
                </TableCell>
              </TableRow>
            )}
            {payments.length > 0 && paymentsWithBalance.length === 0 && (
              <TableRow className="hover:bg-white">
                <TableCell colSpan={6} className="py-4 text-center text-sm text-gray-500 border-b border-gray-100">
                  <div className="flex flex-col items-center gap-2">
                    <span>No entries match your filter.</span>
                    <Button variant="link" size="sm" onClick={selectAllFilters} className="text-blue-600">
                      Show all entries
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            )}
            {paymentsWithBalance.map((payment, index) => (
              <TableRow key={payment.id} className="hover:bg-white border-b border-gray-100 last:border-b-0">
                <TableCell className="p-1 text-center">
                  <div className="w-full flex justify-center">
                    {editingPayment === payment.id ? (
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button 
                            variant="outline" 
                            className="justify-center font-normal text-sm h-8 w-full max-w-[180px]"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <CalendarIcon className="mr-2 h-3 w-3" />
                            {format(monthToDate(editValues.month), "MMM yyyy")}
                          </Button>
                      </PopoverTrigger>
                      <PopoverContent 
                        className="w-auto p-0" 
                        align="center"
                        onInteractOutside={(e) => e.preventDefault()}
                      >
                        <EnhancedCalendar
                          mode="single"
                          selected={editValues.date ? new Date(editValues.date) : monthToDate(editValues.month)}
                          onSelect={(date) => {
                            if (date) {
                              setEditValues(prev => ({
                                ...prev,
                                date,
                                month: dateToMonth(date)
                              }));
                              document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
                            }
                          }}
                          className="rounded-md border"
                          initialFocus
                          yearRange={{ from: 2023, to: 2030 }}
                        />
                        <div className="flex justify-end p-2 border-t">
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="h-8"
                          >
                            Close
                          </Button>
                        </div>
                      </PopoverContent>
                    </Popover>
                  ) : (
                    <span className="text-sm">
                      {payment.date 
                        ? format(new Date(payment.date), "MMM d, yyyy") 
                        : format(monthToDate(payment.month), "MMM d, yyyy")}
                    </span>
                  )}
                  </div>
                </TableCell>
                <TableCell className="p-1 text-center">
                  {editingPayment === payment.id ? (
                    <Input
                      type="number"
                      value={editValues.amount || ''}
                      onChange={(e) => setEditValues(prev => ({ ...prev, amount: Math.abs(Number(e.target.value)) }))}
                      onKeyDown={handleKeyPress}
                      className="w-full h-8 text-sm text-center"
                      autoFocus
                    />
                  ) : (
                    <div className="flex flex-col items-center gap-1">
                      <span className={`text-sm ${
                        ['return', 'repayment'].includes(payment.type as string) ? 'text-green-600' : 
                        (payment.type as PaymentType) === 'interest' ? 'text-purple-600' : 
                        'text-red-600'
                      }`}>
                        {/* Show + for returns and repayments, - for payments and interest */}
                        {['return', 'repayment'].includes(payment.type as string) ? '+' : '-'}
                        {/* Show absolute value of amount */}
                        {Math.abs(payment.amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                      
                      {/* Show partial payment indicator */}
                      <PartialPaymentIndicator payment={payment as ProcessedPayment} />
                      
                      {/* Show breakdown for returns/repayments */}
                      {['return', 'repayment'].includes(payment.type as string) && 
                       ((payment as ProcessedPayment).calculatedLoanAdjustment || 0) > 0 && (
                        <div className="text-xs text-gray-500">
                          <div>Loan: ₹{((payment as ProcessedPayment).calculatedLoanAdjustment || 0).toLocaleString()}</div>
                          {((payment as ProcessedPayment).calculatedNetReturn || 0) > 0 && (
                            <div>Return: ₹{((payment as ProcessedPayment).calculatedNetReturn || 0).toLocaleString()}</div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </TableCell>
                <TableCell className="p-1 text-center">
                  {editingPayment === payment.id ? (
                    <select 
                      value={editValues.type || 'payment'}
                      onChange={(e) => setEditValues(prev => ({ ...prev, type: e.target.value }))}
                      className="w-full h-8 text-sm rounded-md border border-input px-3 text-center"
                    >
                      <option value="payment">Payment</option>
                      <option value="return">Return</option>
                    </select>
                  ) : (
                    <div className="flex justify-center">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium
                        ${payment.type === 'repayment' ? 'bg-blue-100 text-blue-800 border border-blue-300' :
                          payment.type === 'drawdown' ? 'bg-orange-100 text-orange-800 border border-orange-300' :
                          payment.type === 'return' ? 'bg-green-100 text-green-800' :
                          payment.type === 'interest' ? 'bg-purple-100 text-purple-800' :
                          'bg-red-100 text-red-800'}
                      `}>
                        {payment.type.toUpperCase()}
                      </span>
                    </div>
                  )}
                </TableCell>
                <TableCell className="p-1 text-center">
                  {editingPayment === payment.id ? (
                    <Input
                      value={editValues.description || ''}
                      onChange={(e) => setEditValues(prev => ({ ...prev, description: e.target.value }))}
                      onKeyDown={handleKeyPress}
                      className="w-full h-8 text-sm text-center"
                    />
                  ) : (
                    <span className="text-sm">{payment.description}</span>
                  )}
                </TableCell>
                <TableCell className="p-1 text-center">
                  <LoanBalanceDisplay 
                    balance={(payment as ProcessedPayment).runningLoanBalance || 0}
                    formatCurrency={formatCurrency}
                  />
                </TableCell>
                <TableCell className="p-1 text-center w-24">
                  {editingPayment === payment.id ? (
                    <div className="flex items-center justify-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={onSaveEdit}
                        className="p-1 h-7 w-7 rounded-full bg-green-50 text-green-600 hover:bg-green-100"
                        title="Save changes"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </Button>
                      {payment.type !== 'interest' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={onCancelEdit}
                          className="p-1 h-7 w-7 rounded-full bg-red-50 text-red-600 hover:bg-red-100"
                          title="Cancel"
                        >
                          <X className="w-3.5 h-3.5" />
                        </Button>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center justify-center space-x-1">
                      {payment.type !== 'interest' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onStartEdit(payment.id, payment)}
                          className="h-7 w-7 p-0 bg-blue-50 text-blue-600 hover:bg-blue-100"
                          title="Edit entry"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                      )}
                      
                      {/* Toggle button for PAYMENT <-> DRAWDOWN */}
                      {(payment.type === 'payment' || payment.type === 'drawdown') && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleTogglePaymentType(payment.id, payment.type)}
                          className={`h-7 w-7 p-0 rounded-full ${
                            payment.type === 'drawdown'
                              ? 'bg-orange-100 text-orange-600' 
                              : 'bg-gray-50 text-gray-400 hover:bg-orange-50'
                          }`}
                          title={payment.type === 'drawdown' ? "Convert to Regular Payment" : "Convert to Debt Drawdown"}
                        >
                          💳
                        </Button>
                      )}
                      
                      {/* Toggle button for RETURN <-> REPAYMENT */}
                      {(payment.type === 'return' || payment.type === 'repayment') && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleToggleReturnType(payment.id, payment.type)}
                          className={`h-7 w-7 p-0 rounded-full ${
                            payment.type === 'repayment'
                              ? 'bg-blue-100 text-blue-800 border border-blue-300'
                              : 'bg-gray-50 text-gray-400 hover:bg-blue-50'
                          }`}
                          title={payment.type === 'repayment' ? "Convert to Regular Return" : "Convert to Debt Repayment"}
                        >
                          💰
                        </Button>
                      )}
                      
                      {/* Loan Adjustment button for returns and repayments */}
                      {(payment.type === 'return' || payment.type === 'repayment') && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setLoanAdjustmentDialog({ open: true, payment })}
                          className="h-7 w-7 p-0 bg-purple-50 text-purple-600 hover:bg-purple-100"
                          title="Adjust Loan vs Return Allocation"
                        >
                          <Settings className="w-3.5 h-3.5" />
                        </Button>
                      )}
                      
                      {payment.type !== 'interest' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onRemove(payment.id)}
                          className="p-1 h-7 w-7 rounded-full bg-red-50 text-red-600 hover:bg-red-100"
                          title="Delete entry"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      )}
                    </div>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {isAddingNew && (
              <TableRow className="bg-blue-50 border-t border-blue-100">
                <TableCell className="p-1 pt-2">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button 
                        variant="outline" 
                        className="w-full justify-start text-left font-normal text-xs h-8 border-blue-200 bg-white"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <CalendarIcon className="mr-1.5 h-3 w-3 text-blue-500" />
                        {newPayment.date ? format(new Date(newPayment.date), "MMM d, yyyy") : "Select date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent 
                      className="w-auto p-0" 
                      align="start"
                      onInteractOutside={(e) => e.preventDefault()}
                    >
                      <EnhancedCalendar
                        mode="single"
                        selected={newPayment.date ? new Date(newPayment.date) : (newPayment.month ? monthToDate(newPayment.month) : new Date())}
                        onSelect={(date) => {
                          if (date) {
                            setNewPayment({
                              ...newPayment,
                              date,
                              month: dateToMonth(date)
                            });
                            document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
                          }
                        }}
                        className="rounded-md border"
                        initialFocus
                        yearRange={{ from: 2023, to: 2030 }}
                      />
                      <div className="flex justify-end p-2 border-t">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="h-7 text-xs"
                        >
                          Close
                        </Button>
                      </div>
                    </PopoverContent>
                  </Popover>
                </TableCell>
                <TableCell className="p-1 pt-2">
                  <Input
                    type="number"
                    value={newPayment.amount || ''}
                    onChange={(e) => setNewPayment({
                      ...newPayment,
                      amount: Math.abs(Number(e.target.value))
                    })}
                    className="h-8 text-xs border-blue-200 bg-white"
                    placeholder="Amount"
                  />
                </TableCell>
                <TableCell className="p-1 pt-2">
                  <select
                    value={newPayment.type || 'payment'}
                    onChange={(e) => setNewPayment({
                      ...newPayment,
                      type: e.target.value as 'payment' | 'return'
                    })}
                    className="w-full h-8 text-xs rounded-md border border-blue-200 px-2 bg-white"
                  >
                    <option value="payment">Payment</option>
                    <option value="return">Return</option>
                  </select>
                </TableCell>
                <TableCell className="p-1 pt-2">
                  <Input
                    value={newPayment.description || ''}
                    onChange={(e) => setNewPayment({
                      ...newPayment,
                      description: e.target.value
                    })}
                    className="h-8 text-xs border-blue-200 bg-white"
                    placeholder="Description"
                  />
                </TableCell>
                <TableCell className="p-1 text-center">
                  <div className="w-full text-center justify-end space-x-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={onSaveNew}
                      className="p-1 h-7 w-7 rounded-full bg-green-50 text-green-600 hover:bg-green-100"
                      title="Save entry"
                    >
                      <Check className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={onCancelNew}
                      className="p-1 h-7 w-7 rounded-full bg-red-50 text-red-600 hover:bg-red-100"
                      title="Cancel"
                    >
                      <X className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      
      {/* Loan Adjustment Dialog */}
      {loanAdjustmentDialog.payment && (
        <LoanAdjustmentDialog
          open={loanAdjustmentDialog.open}
          onOpenChange={(open) => setLoanAdjustmentDialog({ open, payment: null })}
          payment={loanAdjustmentDialog.payment}
          allPayments={payments}
          onSave={(updatedPayment) => {
            if (onUpdatePayment) {
              onUpdatePayment(updatedPayment);
            }
          }}
        />
      )}
    </div>
  );
};