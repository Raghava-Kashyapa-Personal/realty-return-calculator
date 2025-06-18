import React, { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Payment, ProjectData } from '@/types/project';
import { useToast } from '@/hooks/use-toast';
import { Plus, Upload, Copy, Calculator } from 'lucide-react';
import { PaymentsTable } from '@/components/payments/PaymentsTable';
import { exportToCsv } from '@/utils/csvExport';
import { useInterestCalculator } from '@/hooks/useInterestCalculator';
import { monthToDate, dateToMonth, monthToMonth, formatCurrency } from '@/components/payments/utils';

interface PaymentManagerProps {
  projectData: ProjectData;
  updatePayments: (payments: Payment[]) => void;
  interestRate: number;
  onCalculateInterest: () => void;
  allEntriesForTable: Payment[];
}

export const PaymentManager: React.FC<PaymentManagerProps> = ({
  projectData,
  updatePayments,
  interestRate,
  onCalculateInterest,
  allEntriesForTable,
}) => {
  const [editingPayment, setEditingPayment] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<any>({});
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [csvData, setCsvData] = useState('');
  const { toast } = useToast();

  const [newPayment, setNewPayment] = useState<Partial<Payment>>({
    month: dateToMonth(new Date()),
    amount: 0,
    description: '',
    date: new Date(),
    type: 'payment',
  });

  // Handle editing payment
  const startEditPayment = useCallback((payment: Payment) => {
    if (payment.type === 'interest') return; // Don't allow editing interest entries
    
    setEditingPayment(payment.id || null);
    setEditValues({
      month: payment.month,
      amount: payment.amount,
      description: payment.description || '',
      type: payment.type,
    });
  }, []);

  // Handle saving edited payment
  const saveEdit = useCallback(() => {
    if (!editingPayment) return;
    
    const updatedPayments = projectData.payments.map(payment => {
      if (payment.id === editingPayment) {
        return {
          ...payment,
          ...editValues,
          amount: Number(editValues.amount),
        };
      }
      return payment;
    });
    
    updatePayments(updatedPayments);
    setEditingPayment(null);
    setEditValues({});
  }, [editingPayment, editValues, projectData.payments, updatePayments]);

  // Handle canceling edit
  const cancelEdit = useCallback(() => {
    setEditingPayment(null);
    setEditValues({});
  }, []);

  // Handle removing payment
  const removePayment = useCallback((id: string) => {
    updatePayments(projectData.payments.filter(payment => payment.id !== id));
  }, [projectData.payments, updatePayments]);

  // Handle saving new payment
  const handleSaveNew = useCallback(() => {
    console.log('=== handleSaveNew STARTED ===');
    console.log('Current newPayment:', newPayment);
    console.log('Current projectData.payments:', projectData.payments);
    
    if (!newPayment.amount || newPayment.amount <= 0) {
      toast({
        title: 'Invalid Amount',
        description: 'Please enter a valid amount',
        variant: 'destructive',
      });
      return;
    }

    // Determine the payment type, default to 'payment' if not set
    const paymentType = (newPayment.type === 'return' || newPayment.type === 'payment') 
      ? newPayment.type 
      : 'payment';
    
    // Create a new payment with a unique ID that includes the type
    const payment: Payment = {
      id: `${paymentType}-${Date.now()}`,
      month: newPayment.month || dateToMonth(new Date()),
      amount: Math.abs(newPayment.amount), // Store absolute value
      description: newPayment.description || '',
      date: newPayment.date || monthToDate(newPayment.month || dateToMonth(new Date())),
      type: paymentType,
    };
    
    console.log('Created new payment:', payment);

    // Update the payments in the parent component
    updatePayments([...projectData.payments, payment]);
    
    // Reset the form
    setNewPayment({
      month: dateToMonth(new Date()),
      amount: 0,
      description: '',
      date: new Date(),
      type: 'payment',
    });
    
    // Close the add new row
    setIsAddingNew(false);
    
    // Show success message
    toast({
      title: `${paymentType === 'return' ? 'Return' : 'Payment'} Added`,
      description: `New ${paymentType} entry has been added successfully. Click 'Calculate Interest' to update interest calculations.`,
    });
  }, [newPayment, projectData.payments, updatePayments, toast, dateToMonth, monthToDate]);

  // Handle canceling new payment
  const handleCancelNew = useCallback(() => {
    setIsAddingNew(false);
    setNewPayment({
      month: dateToMonth(new Date()),
      amount: 0,
      description: '',
      date: new Date(),
      type: 'payment',
    });
  }, []);

  // Parse CSV data and add to payments with enhanced type detection
  const parseCsvData = useCallback(() => {
    try {
      const lines = csvData.trim().split('\n');
      const newPayments: Payment[] = [];
      const errors: string[] = [];

      // Check if first line is a header
      const hasHeader = lines[0].toLowerCase().includes('date') && 
                        lines[0].toLowerCase().includes('amount') &&
                        (lines[0].toLowerCase().includes('type') || 
                         lines[0].toLowerCase().includes('description'));
      
      const dataLines = hasHeader ? lines.slice(1) : lines;
      console.log(`Processing ${dataLines.length} data lines${hasHeader ? ' (skipping header)' : ''}`);

      dataLines.forEach((line, index) => {
        if (!line.trim()) return; // Skip empty lines

        try {
          // Support both 3-column (Date,Amount,Description) and 4-column (Date,Type,Amount,Description) formats
          const parts = line.split(',').map(s => s.trim());
          let dateStr, typeStr, amountStr, descriptionStr;
          
          if (parts.length >= 4) {
            // Format: Date,Type,Amount,Description
            [dateStr, typeStr, amountStr, descriptionStr] = parts;
          } else if (parts.length >= 3) {
            // Format: Date,Amount,Description
            [dateStr, amountStr, descriptionStr] = parts;
            // Will determine type from amount sign
            typeStr = '';
          } else {
            errors.push(`Line ${index + 1}: Not enough columns (expected at least Date,Amount,Description)`);
            return;
          }

          if (!dateStr || !amountStr) {
            errors.push(`Line ${index + 1}: Missing required date or amount`);
            return;
          }

          // Parse date
          let date: Date;
          let month: number;
          
          // Try parsing as Month-Year format (MMM-YYYY) first
          const monthYearMatch = dateStr.trim().match(/^(\w{3,})-(\d{4})$/i);
          
          if (monthYearMatch) {
            const [_, monthPart, yearPart] = monthYearMatch;
            const year = parseInt(yearPart);
            
            // Define month names and their variations
            const monthMap: {[key: string]: number} = {
              'jan': 0, 'january': 0,
              'feb': 1, 'february': 1,
              'mar': 2, 'march': 2,
              'apr': 3, 'april': 3,
              'may': 4,
              'jun': 5, 'june': 5,
              'jul': 6, 'july': 6,
              'aug': 7, 'august': 7,
              'sep': 8, 'september': 8,
              'oct': 9, 'october': 9,
              'nov': 10, 'november': 10,
              'dec': 11, 'december': 11
            };
            
            const monthIndex = monthMap[monthPart.toLowerCase()];
            
            if (monthIndex !== undefined && !isNaN(year)) {
              date = new Date(year, monthIndex, 1);
              // Calculate months since Jan 2024 (our reference point)
              month = ((year - 2024) * 12) + monthIndex;
              console.log(`Parsed date (MMM-YYYY): ${dateStr} -> ${monthIndex + 1}/${year} (month ${month})`);
            } else {
              errors.push(`Line ${index + 1}: Invalid month or year in '${dateStr}'`);
              return;
            }
          } else {
            // Fallback to Date parsing for other formats
            date = new Date(dateStr);
            if (isNaN(date.getTime())) {
              errors.push(`Line ${index + 1}: Could not parse date '${dateStr}'. Expected format: MMM-YYYY (e.g., May-2025)`);
              return;
            }
            // For other date formats, use the existing dateToMonth function
            month = dateToMonth(date);
          }

          // Parse amount (remove currency symbols, commas, etc.)
          const amountValue = parseFloat(amountStr.replace(/[^0-9.-]+/g, ''));
          if (isNaN(amountValue)) {
            errors.push(`Line ${index + 1}: Invalid amount '${amountStr}'`);
            return;
          }

          // Determine payment type (with better handling)
          let type: 'payment' | 'return' | 'interest' = 'payment';
          
          if (typeStr) {
            // Explicit type provided
            const normalizedType = typeStr.toLowerCase().trim();
            if (normalizedType.includes('payment') || normalizedType.includes('invest')) {
              type = 'payment';
            } else if (normalizedType.includes('return') || normalizedType.includes('income') || 
                       normalizedType.includes('sale') || normalizedType.includes('rental')) {
              type = 'return';
            } else if (normalizedType.includes('interest')) {
              type = 'interest';
            } else {
              // Fallback to amount sign
              type = amountValue < 0 ? 'payment' : 'return';
            }
          } else {
            // Determine by amount sign
            type = amountValue < 0 ? 'payment' : 'return';
          }

          // Create payment object
          newPayments.push({
            id: `imported-${Date.now()}-${index}`,
            month,
            amount: Math.abs(amountValue),
            description: descriptionStr || `Imported ${type} ${index + 1}`,
            date: date.toISOString(),
            type,
          });
        } catch (lineError) {
          errors.push(`Line ${index + 1}: ${lineError instanceof Error ? lineError.message : 'Unknown error'}`);
        }
      });

      // Report results
      if (newPayments.length > 0) {
        // Update payments without triggering analysis
        updatePayments([...projectData.payments, ...newPayments]);
        setCsvData('');
        setIsImportOpen(false);
        
        // Create summary by type
        const typeCount = newPayments.reduce((acc, p) => {
          acc[p.type] = (acc[p.type] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);
        
        const summary = Object.entries(typeCount)
          .map(([type, count]) => `${count} ${type}${count !== 1 ? 's' : ''}`)
          .join(', ');
        
        toast({
          title: 'Import Successful',
          description: `Successfully imported ${newPayments.length} entries (${summary}). ${errors.length > 0 ? `${errors.length} line(s) had errors.` : ''} Click 'Calculate Interest' to update interest calculations.`,
        });
        
        // Log errors if any
        if (errors.length > 0) {
          console.warn('CSV import had some errors:', errors);
        }
      } else if (errors.length > 0) {
        toast({
          title: 'Import Failed',
          description: `No entries imported. ${errors.length} ${errors.length === 1 ? 'error' : 'errors'} found.`,
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'No Data',
          description: 'No valid entries found in the CSV data',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error parsing CSV data:', error);
      toast({
        title: 'Import Error',
        description: error instanceof Error ? error.message : 'Failed to parse CSV data',
        variant: 'destructive',
      });
    }
  }, [csvData, projectData.payments, toast, updatePayments]);

  // Handle CSV export
  const handleExportCSV = useCallback(async () => {
    try {
      const entries = allEntriesForTable.map(entry => ({
        ...entry,
        date: entry.date || monthToDate(entry.month).toISOString()
      }));
      
      const csvContent = exportToCsv(entries);
      
      if (navigator.clipboard && window.isSecureContext) {
        try {
          await navigator.clipboard.writeText(csvContent);
          toast({
            title: 'CSV Copied',
            description: 'Cash flow data has been copied to clipboard',
          });
          return; 
        } catch (clipboardError) {
          console.warn('Clipboard write failed, falling back to download:', clipboardError);
        }
      }
      
      // Fallback to download if clipboard API is not available
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', 'cash-flow-export.csv');
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      toast({
        title: 'CSV Downloaded',
        description: 'Cash flow data has been downloaded as cash-flow-export.csv',
      });
      
    } catch (error) {
      console.error('Error in handleExportCSV:', error);
      toast({
        title: 'Export Error',
        description: 'Failed to export CSV. Please try again or contact support.',
        variant: 'destructive',
      });
    }
  }, [allEntriesForTable, toast]);

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <div className="flex justify-end items-center px-4 py-3">
          <div className="flex items-center gap-2">
            <Button
              onClick={handleExportCSV}
              variant="outline"
              size="sm"
              className="h-8 gap-1 bg-green-50 border-green-200 hover:bg-green-100 text-green-700"
            >
              <Copy className="h-3.5 w-3.5" />
              Export CSV 
            </Button>
            <Button
              onClick={(e) => {
                console.log('Calculate Interest button clicked');
                console.log('onCalculateInterest:', onCalculateInterest);
                onCalculateInterest();
              }}
              variant="outline"
              size="sm"
              className="h-8 gap-1 bg-purple-50 border-purple-200 hover:bg-purple-100 text-purple-700"
            >
              <Calculator className="h-3.5 w-3.5" />
              Calculate Interest
            </Button>
            <Button
              onClick={() => setIsImportOpen(true)}
              variant="outline"
              size="sm"
              className="h-8 gap-1 bg-blue-50 border-blue-200 hover:bg-blue-100 text-blue-700"
            >
              <Upload className="h-3.5 w-3.5" />
              Import CSV
            </Button>
            <Button
              onClick={() => setIsAddingNew(true)}
              variant="outline"
              size="sm"
              className="h-8 gap-1 ml-auto bg-primary-50 border-primary-200 hover:bg-primary-100 text-primary-700"
            >
              <Plus className="h-3.5 w-3.5" />
              Add Entry
            </Button>
          </div>
        </div>

        <PaymentsTable
          payments={allEntriesForTable}
          editingPayment={editingPayment}
          editValues={editValues}
          onStartEdit={startEditPayment}
          onSaveEdit={saveEdit}
          onCancelEdit={cancelEdit}
          onRemove={removePayment}
          setEditValues={setEditValues}
          formatCurrency={formatCurrency}
          formatNumber={(n: number) => new Intl.NumberFormat('en-IN', {
            maximumFractionDigits: 0
          }).format(n)}
          monthToDate={monthToDate}
          dateToMonth={dateToMonth}
          isAddingNew={isAddingNew}
          newPayment={newPayment}
          setNewPayment={setNewPayment}
          onSaveNew={handleSaveNew}
          onCancelNew={handleCancelNew}
        />
      </div>

      {/* Enhanced Import Modal with better instructions */}
      {isImportOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setIsImportOpen(false)}>
          <div className="relative max-w-lg w-full mx-4" onClick={(e) => e.stopPropagation()}>
            <Card className="border-blue-200 shadow-lg">
              <CardContent className="p-6">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-medium">Import Cash Flow Entries</h3>
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => setIsImportOpen(false)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                
                <div className="space-y-4">
                  <div>
                    <h4 className="text-sm font-medium mb-1">Supported Formats:</h4>
                    <ul className="text-xs text-gray-600 list-disc pl-5 space-y-1">
                      <li><code>Date,Amount,Description</code> - Type determined by amount sign</li>
                      <li><code>Date,Type,Amount,Description</code> - Explicit type</li>
                      <li>Headers are automatically detected and skipped</li>
                    </ul>
                  </div>
                  
                  <div>
                    <h4 className="text-sm font-medium mb-1">Examples:</h4>
                    <pre className="text-xs bg-gray-50 p-2 rounded border overflow-x-auto">
{`2025-01-01,-1000000,Initial investment
2025-06-30,50000,Monthly rental income
2025-12-31,1200000,Property sale
Date,Type,Amount,Description
2025-01-01,Payment,1000000,Initial investment
2025-02-01,Interest,10000,February interest`}
                    </pre>
                  </div>
                  
                  <div>
                    <label htmlFor="csv-import" className="block text-sm font-medium mb-1">Paste your CSV data here:</label>
                    <textarea
                      id="csv-import"
                      className="w-full p-3 border rounded-md mb-2 h-40 font-mono text-sm"
                      value={csvData}
                      onChange={(e) => setCsvData(e.target.value)}
                      placeholder="Date,Amount,Description"
                    />
                  </div>
                  
                  <div className="flex justify-end gap-3 pt-2">
                    <Button variant="outline" onClick={() => setIsImportOpen(false)}>
                      Cancel
                    </Button>
                    <Button 
                      onClick={parseCsvData}
                      disabled={!csvData.trim()}
                      className="bg-blue-600 hover:bg-blue-700"
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      Import Data
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
};
