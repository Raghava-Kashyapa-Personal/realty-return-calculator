
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
      // - Payments (negative) DECREASE the principal
      // - Returns (positive) INCREASE the principal
      // - Interest (positive) INCREASES principal (reduces debt)
      runningBalance += payment.amount;
      return { ...payment, balance: runningBalance };
    });
  };

  const paymentsWithBalance = calculateRunningBalances();
  const totalPayments = payments.reduce((sum, p) => sum + (p.type === 'return' ? p.amount : -p.amount), 0);
  const netCashFlow = payments.reduce((sum, p) => sum + (p.type === 'return' ? p.amount : -p.amount), 0);

  if (payments.length === 0 && !isAddingNew) return null;

  return (
    <Card className="shadow-sm border-gray-200">
      <CardContent className="p-0">
        <Table>
          <TableHeader className="bg-gray-50">
            <TableRow>
              <TableHead className="py-2 text-xs font-medium text-gray-500">Date</TableHead>
              <TableHead className="py-2 text-xs font-medium text-gray-500">Amount (₹)</TableHead>
              <TableHead className="py-2 text-xs font-medium text-gray-500">Type</TableHead>
              <TableHead className="py-2 text-xs font-medium text-gray-500">Description</TableHead>
              <TableHead className="py-2 text-xs font-medium text-gray-500">Outstanding Principal</TableHead>
              <TableHead className="py-2 text-xs font-medium text-gray-500 text-right w-24">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {payments.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="py-4 text-center text-sm text-gray-500">
                  No cash flow entries yet. Add your first entry to get started.
                </TableCell>
              </TableRow>
            )}
            {paymentsWithBalance.map((payment, index) => (
              <TableRow key={payment.id}>
                <TableCell className="p-1">
                  {editingPayment === payment.id ? (
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button 
                          variant="outline" 
                          className="w-full justify-start text-left font-normal text-sm h-8"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <CalendarIcon className="mr-2 h-3 w-3" />
                          {format(monthToDate(editValues.month), "MMM yyyy")}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent 
                        className="w-auto p-0" 
                        align="start"
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
                    <div className="flex items-center justify-between">
                      <span className="text-sm">
                        {payment.date 
                          ? format(new Date(payment.date), "MMM d, yyyy") 
                          : format(monthToDate(payment.month), "MMM d, yyyy")}
                      </span>
                    </div>
                  )}
                </TableCell>
                <TableCell className="p-1">
                  {editingPayment === payment.id ? (
                    <Input
                      type="number"
                      value={editValues.amount || ''}
                      onChange={(e) => setEditValues(prev => ({ ...prev, amount: Math.abs(Number(e.target.value)) }))}
                      onKeyDown={handleKeyPress}
                      className="w-full h-8 text-sm"
                      autoFocus
                    />
                  ) : (
                    <span className={`text-sm ${(payment.type as PaymentType) === 'return' ? 'text-green-600' : (payment.type as PaymentType) === 'interest' ? 'text-purple-600' : 'text-red-600'}`}>
                      {/* Only returns and interest should be shown as positive */}
                      {(payment.type as PaymentType) === 'return' || (payment.type as PaymentType) === 'interest' ? '+' : '-'}
                      {/* For all types, show absolute value */}
                      {formatNumber(Math.abs(payment.amount), (payment.type as PaymentType) === 'interest' ? 2 : undefined)}
                    </span>
                  )}
                </TableCell>
                <TableCell className="p-1">
                  {editingPayment === payment.id ? (
                    <select 
                      value={editValues.type || 'payment'}
                      onChange={(e) => setEditValues(prev => ({ ...prev, type: e.target.value }))}
                      className="w-full h-8 text-sm rounded-md border border-input px-3"
                    >
                      <option value="payment">Payment</option>
                      <option value="return">Return</option>
                    </select>
                  ) : (
                    <span className={`text-sm font-medium ${(payment.type as PaymentType) === 'return' ? 'text-green-600' : (payment.type as PaymentType) === 'interest' ? 'text-purple-600' : 'text-red-600'}`}>
                      {(payment.type as PaymentType) === 'return' ? 'Return' : (payment.type as PaymentType) === 'interest' ? 'Interest' : 'Payment'}
                    </span>
                  )}
                </TableCell>
                <TableCell className="p-1">
                  {editingPayment === payment.id ? (
                    <Input
                      value={editValues.description || ''}
                      onChange={(e) => setEditValues(prev => ({ ...prev, description: e.target.value }))}
                      onKeyDown={handleKeyPress}
                      className="w-full h-8 text-sm"
                    />
                  ) : (
                    <span className="text-sm">{payment.description}</span>
                  )}
                </TableCell>
                <TableCell className="py-2 text-right pr-4">
                  {formatCurrency(payment.balance)}
                </TableCell>
                <TableCell className="text-right py-2 pr-4 w-24">
                  {editingPayment === payment.id || payment.type === 'interest' ? (
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={onSaveEdit}
                        className="p-1 h-7 w-7 rounded-full bg-green-50 text-green-600 hover:bg-green-100"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={onCancelEdit}
                        className="p-1 h-7 w-7 rounded-full bg-red-50 text-red-600 hover:bg-red-100"
                      >
                        <X className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-end space-x-1">
                      {(payment.type as PaymentType) !== 'interest' ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onStartEdit(payment.id, payment)}
                          className="h-7 w-7 p-0 bg-blue-50 text-blue-600 hover:bg-blue-100"
                          title="Edit entry"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                      ) : null}
                      {(payment.type as PaymentType) !== 'interest' ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onRemove(payment.id)}
                          className="p-1 h-7 w-7 rounded-full bg-red-50 text-red-600 hover:bg-red-100"
                          title="Delete entry"
                        >
                      
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      ) : null}
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
                <TableCell className="p-1 pt-2 text-right">
                  <div className="flex items-center justify-end space-x-1">
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
      </CardContent>
    </Card>
  );
};