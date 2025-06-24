
import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { EnhancedCalendar } from '@/components/ui/enhanced-calendar';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Payment } from '@/types/project';
type PaymentType = 'payment' | 'return' | 'interest';
import { Trash2, CalendarIcon, Pencil, Check, X, Plus } from 'lucide-react';
import { format } from 'date-fns';

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
  onCancelNew = () => {}
}) => {
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

  // Calculate running balance for each payment
  const calculateRunningBalances = () => {
    if (!payments.length) return [];
    
    const sortedPayments = [...payments].sort((a, b) => {
      const dateA = a.date ? new Date(a.date).getTime() : monthToDate(a.month).getTime();
      const dateB = b.date ? new Date(b.date).getTime() : monthToDate(b.month).getTime();
      if (dateA === dateB) {
        // If dates are the same, prioritize based on type
        const typeOrder: Record<string, number> = { payment: 1, interest: 2, return: 3 };
        return (typeOrder[a.type as string] || 0) - (typeOrder[b.type as string] || 0);
      }
      return dateA - dateB;
    });

    let runningBalance = 0;
    return sortedPayments.map(payment => {
      // For running balance calculation:
      if (payment.type === 'return') {
        // Returns decrease the debt (positive amount)
        runningBalance -= payment.amount;
      } else if (payment.type === 'payment') {
        // Payments increase the debt (negative amount)
        runningBalance += Math.abs(payment.amount);
      } else if (payment.type === 'interest') {
        // Interest increases the debt (positive amount)
        runningBalance += payment.amount;
      }
      return { ...payment, balance: runningBalance };
    });
  };

  const paymentsWithBalance = calculateRunningBalances();
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

  if (payments.length === 0 && !isAddingNew) return null;

  return (
    <div className="border border-gray-200 rounded-sm bg-white">
      <div className="overflow-x-auto">
        <Table className="min-w-full">
          <TableHeader className="bg-white border-b border-gray-200">
            <TableRow className="hover:bg-transparent">
              <TableHead className="py-3 text-xs font-normal text-gray-500 text-center border-r border-gray-100">Date</TableHead>
              <TableHead className="py-3 text-xs font-normal text-gray-500 text-center border-r border-gray-100">Amount (₹)</TableHead>
              <TableHead className="py-3 text-xs font-normal text-gray-500 text-center border-r border-gray-100">Type</TableHead>
              <TableHead className="py-3 text-xs font-normal text-gray-500 text-center border-r border-gray-100">Description</TableHead>
              <TableHead className="py-3 text-xs font-normal text-gray-500 text-center border-r border-gray-100">Outstanding Principal</TableHead>
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
                    <span className={`text-sm ${(payment.type as PaymentType) === 'return' ? 'text-green-600' : (payment.type as PaymentType) === 'interest' ? 'text-purple-600' : 'text-red-600'}`}>
                      {/* Show + for returns, - for payments and interest */}
                      {(payment.type as PaymentType) === 'return' ? '+' : '-'}
                      {/* Show absolute value of amount */}
                      {Math.abs(payment.amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
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
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                        payment.type === 'return' ? 'bg-green-100 text-green-800' : 
                        payment.type === 'interest' ? 'bg-purple-100 text-purple-800' : 
                        'bg-red-100 text-red-800'
                      }`}>
                        {(payment.type as PaymentType).toUpperCase()}
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
                  <span className={payment.balance > 0 ? 'text-red-600' : 'text-green-600'}>
                    {payment.balance > 0 ? '-' : ''}{formatCurrency(Math.abs(payment.balance))}
                  </span>
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
                <TableCell className="p-1 pt-2 text-center">
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
    </div>
  );
};