import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Textarea } from '@/components/ui/textarea';
import { Payment, IncomeItem, ProjectData } from '@/types/project';
import { useToast } from '@/hooks/use-toast';
import { useProject } from '@/contexts/ProjectContext';
import { CashFlowAnalysis } from '@/components/CashFlowAnalysis';
import { PaymentsTable } from '@/components/payments/PaymentsTable';
import { Plus, ArrowUpDown, X, Upload, Copy, Calculator, Save, Database, Download, Wand2, Loader2, Trash2 } from 'lucide-react';
import { exportToCsv } from '@/utils/csvExport';
import {
  formatCurrency,
  formatNumber,
  parseCurrencyAmount,
  parseDate,
  monthToDate,
  dateToMonth
} from '@/components/payments/utils';
import { parseISO, startOfMonth, endOfMonth, addMonths, compareAsc, isBefore, isSameDay, isWithinInterval, isValid, format as formatDate } from 'date-fns';
import { calculateDerivedProjectEndDate } from '@/utils/projectDateUtils';
import { savePayments, saveSinglePayment, saveProjectData, fetchAllEntries, fetchProject, sanitizePaymentData } from '@/services/firestoreService';
import { db } from '@/firebaseConfig';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import AITextImporter from '@/components/AITextImporter';
import { calculateMonthlyInterestLogic } from '@/utils/interestCalculator';

// Collection name for payments
const PAYMENTS_COLLECTION = 'projects'; // Renamed from 'test' to 'projects'

interface PaymentsCashFlowProps {
  projectData: ProjectData;
  updateProjectData: (updates: Partial<ProjectData>) => void;
  updatePayments: (payments: Payment[]) => void;
  showOnlyCashFlow?: boolean;
  showOnlyAnalysis?: boolean;
  projectId?: string;
}

const PaymentsCashFlow: React.FC<PaymentsCashFlowProps> = ({
  projectData,
  updateProjectData,
  updatePayments,
  showOnlyCashFlow = false,
  showOnlyAnalysis = false,
  projectId: propProjectId
}) => {
  const { currentProjectId: contextProjectId } = useProject();
  const projectId = contextProjectId || propProjectId;
  const [csvData, setCsvData] = useState('');
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [editingPayment, setEditingPayment] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<any>({});
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isAIImportOpen, setIsAIImportOpen] = useState(false);
  const [isClearSessionDialogOpen, setIsClearSessionDialogOpen] = useState(false);
  const [interestRate, setInterestRate] = useState<number>(projectData.annualInterestRate || 12);
  const [newPayment, setNewPayment] = useState<Partial<Payment>>({
    month: dateToMonth(new Date()),
    amount: 0,
    description: '',
    date: new Date(),
    type: 'payment',
  });
  const { toast } = useToast();

  const [currentInterestDetails, setCurrentInterestDetails] = useState<{ newInterestPayments: Payment[], interestRate: number } | null>(null);
  const [isFetching, setIsFetching] = useState(false);
  const [lastSavedInterestRate, setLastSavedInterestRate] = useState<number | null>(null);
  const [allPaymentsWithInterest, setAllPaymentsWithInterest] = useState<Payment[]>([]);

  // Reset interest details when core data changes
  useEffect(() => {
    setCurrentInterestDetails(null);
  }, [projectData.payments, projectData.rentalIncome, interestRate]);

  // Manual fetch function (used by Load from DB button)
  const fetchDataFromFirestoreManual = async () => {
    setIsFetching(true);
    try {
      console.log('Manually fetching all database entries');
      // If projectId is provided, fetch only for that project
      const { entries } = await fetchAllEntries(100, projectId);

      if (entries && entries.length > 0) {
        // Create a set of existing IDs to avoid duplicates
        const existingIds = new Set(projectData.payments.map(p => p.id));
        
        // Also create a set of content hashes to avoid duplicate content
        const existingContentHashes = new Set(projectData.payments.map(p => 
          `${p.month}-${p.amount}-${p.description || ''}`
        ));

        // Process entries with stable IDs and filter out duplicates
        const newPayments = entries
          .filter(entry => {
            const contentHash = `${entry.month}-${entry.amount}-${entry.description || ''}`;
            return (!entry.id || !existingIds.has(entry.id)) && !existingContentHashes.has(contentHash);
          })
          .map(entry => ({
            ...entry,
            id: entry.id || generateStableId(entry)
          }));

        if (newPayments.length > 0) {
          console.log('Adding entries from database:', newPayments.length);
          const combinedPayments = [...projectData.payments, ...newPayments];
          updatePayments(combinedPayments);
          toast({
            title: 'Data Loaded',
            description: `Loaded ${newPayments.length} new entries from the database.`
          });
        } else {
          toast({ title: 'No New Data', description: 'No new entries found in the database.' });
        }
      } else {
        toast({ title: 'No Data', description: 'No entries found in the database.' });
      }
    } catch (error) {
      console.error('Error fetching data from Firestore:', error);
      toast({ title: 'Error', description: 'Failed to fetch data from the database.', variant: 'destructive' });
    } finally {
      setIsFetching(false);
    }
  };

  // Track if we've already loaded data for this project to prevent infinite loops
  const [loadedProjects, setLoadedProjects] = useState<Set<string>>(new Set());

  // Generate a stable ID for a payment entry
  const generateStableId = (entry: Payment) => {
    const descriptionPart = entry.description ? entry.description.substring(0, 10) : 'no-desc';
    return `entry-${entry.month}-${entry.amount}-${descriptionPart}`.replace(/\s+/g, '-');
  };
  
  // Helper function to read a file as text
  const readFileAsText = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        if (e.target?.result) {
          resolve(e.target.result as string);
        } else {
          reject(new Error('Failed to read file'));
        }
      };
      reader.onerror = (e) => {
        reject(new Error('File reading error'));
      };
      reader.readAsText(file);
    });
  };
  
  // Only fetch data for existing projects
  const fetchDataFromFirestore = async () => {
    if (!projectId) return;
    
    try {
      console.log(`Auto-fetching database entries for project: ${projectId}`);
      const { entries } = await fetchAllEntries(50, projectId);

      if (entries && entries.length > 0) {
        // Create a set of existing IDs to avoid duplicates
        const existingIds = new Set(projectData.payments.map(p => p.id));
        
        // Also create a set of content hashes to avoid duplicate content
        const existingContentHashes = new Set(projectData.payments.map(p => 
          `${p.month}-${p.amount}-${p.description || ''}`
        ));

        // Only add entries that don't already exist (by ID or content)
        const entriesWithIds = entries
          .filter(entry => {
            const contentHash = `${entry.month}-${entry.amount}-${entry.description || ''}`;
            return (!entry.id || !existingIds.has(entry.id)) && !existingContentHashes.has(contentHash);
          })
          .map(entry => ({
            ...entry,
            // Use a stable ID generation that doesn't rely on current timestamp
            id: entry.id || generateStableId(entry)
          }));

        if (entriesWithIds.length > 0) {
          // Combine with existing payments, avoiding duplicates
          updatePayments([...projectData.payments, ...entriesWithIds]);
          console.log(`Loaded ${entriesWithIds.length} new entries for project ${projectId}`);
        } else {
          console.log('No new entries to add (all already exist)');
        }
      } else {
        console.log(`No entries found for project ${projectId}`);
        // Don't clear existing payments if no entries are found
        // Only clear if this is the first load
        if (projectData.payments.length === 0) {
          updatePayments([]);
        }
      }
    } catch (error) {
      console.error('Error auto-fetching data from Firestore:', error);
      // On error, don't clear existing data
    }
  };

  // Handle project changes - only clear payments when project changes to a new non-null value
  useEffect(() => {
    if (!projectId) {
      console.log('No project ID, clearing payments');
      updatePayments([]);
      return;
    }

    console.log('Project ID changed:', projectId);
    
    // Only clear payments if this is a new project that we haven't loaded yet
    if (sessionStorage.getItem(`project-${projectId}-is-new`) === 'true') {
      console.log('New project detected, clearing existing payments');
      updatePayments([]);
      sessionStorage.setItem(`project-${projectId}-is-new`, 'false');
    }
  }, [projectId]);
  
  // Clear loaded projects when component unmounts to ensure fresh data on next mount
  useEffect(() => {
    return () => {
      console.log('Clearing loaded projects on unmount');
      setLoadedProjects(new Set());
    };
  }, []);

  // Add listener for project refresh events
  useEffect(() => {
    const handleProjectRefresh = () => {
      if (!projectId) {
        toast({ title: 'No Project', description: 'Please select a project first.', variant: 'destructive' });
        return;
      }
      console.log('Project refresh event received, reloading data');
      
      // Force reload data for current project
      const fetchLatestData = async () => {
        setIsFetching(true);
        try {
          const { entries } = await fetchProject(projectId);
          
          if (entries && entries.length > 0) {
            // Process entries with stable IDs
            const processedEntries = entries.map(entry => ({
              ...entry,
              // Use our stable ID generation helper
              id: entry.id || generateStableId(entry)
            }));
            
            // Replace all payments with the refreshed data
            updatePayments(processedEntries);
            toast({ title: 'Data Refreshed', description: `Loaded ${entries.length} entries from project ${projectId}` });
            
            // Update the loaded projects set to include this project
            setLoadedProjects(prev => new Set([...prev, projectId]));
          } else {
            toast({ title: 'No Data', description: 'No entries found for this project.' });
            // Clear payments on explicit refresh if no data found
            updatePayments([]);
          }
        } catch (error) {
          console.error('Error refreshing project data:', error);
          toast({ title: 'Error', description: 'Failed to refresh project data.', variant: 'destructive' });
        } finally {
          setIsFetching(false);
        }
      };
      
      fetchLatestData();
    };
    
    window.addEventListener('refresh-projects', handleProjectRefresh);
    return () => window.removeEventListener('refresh-projects', handleProjectRefresh);
  }, [projectId, updatePayments]);

  // Fix the project end date initialization
  const [projectEndDate, setProjectEndDate] = useState<Date>(() => {
    // Default to last entry date + 12 months, or current date + 12 months if no entries
    if (!projectData.payments || projectData.payments.length === 0) {
      const defaultDate = new Date();
      defaultDate.setFullYear(defaultDate.getFullYear() + 1);
      return defaultDate;
    }
    
    const lastEntry = projectData.payments.reduce((latest, payment) => {
      const paymentDate = payment.date ? new Date(payment.date) : monthToDate(payment.month);
      return paymentDate > latest ? paymentDate : latest;
    }, new Date());
    
    const endDate = new Date(lastEntry);
    endDate.setFullYear(endDate.getFullYear() + 1); // Add 12 months
    return endDate;
  });

  useEffect(() => {
    const handleProjectRefresh = () => {
      if (!projectId) {
        toast({ title: 'No Project', description: 'Please select a project first.', variant: 'destructive' });
        return;
      }
      console.log('Project refresh event received, reloading data');
      
      // Force reload data for current project
      const fetchLatestData = async () => {
        setIsFetching(true);
        try {
          const { entries } = await fetchProject(projectId);
          
          if (entries && entries.length > 0) {
            // Process entries with stable IDs
            const processedEntries = entries.map(entry => ({
              ...entry,
              // Use our stable ID generation helper
              id: entry.id || generateStableId(entry)
            }));
            
            // Replace all payments with the refreshed data
            updatePayments(processedEntries);
            toast({ title: 'Data Refreshed', description: `Loaded ${entries.length} entries from project ${projectId}` });
            
            // Update the loaded projects set to include this project
            setLoadedProjects(prev => new Set([...prev, projectId]));
          } else {
            toast({ title: 'No Data', description: 'No entries found for this project.' });
            // Clear payments on explicit refresh if no data found
            updatePayments([]);
          }
        } catch (error) {
          console.error('Error refreshing project data:', error);
          toast({ title: 'Error', description: 'Failed to refresh project data.', variant: 'destructive' });
        } finally {
          setIsFetching(false);
        }
      };
      
      fetchLatestData();
    };
    
    window.addEventListener('refresh-projects', handleProjectRefresh);
    return () => window.removeEventListener('refresh-projects', handleProjectRefresh);
  }, [projectId, updatePayments, toast, generateStableId]);

  const handleCalculateInterest = () => {
    if (!projectData.payments || projectData.payments.length === 0) {
      toast({ title: "No Data", description: "Please add some cash flow entries first." });
        return;
      }

    try {
      // Filter out existing interest payments to avoid double-counting
      const basePayments = projectData.payments.filter(p => p.type !== 'interest');
      
      // Use the new interest calculation with project end date
      const interestResult = calculateMonthlyInterestLogic({
        payments: basePayments,
        interestRate: interestRate,
        projectEndDate
      });
      
      // Update local state with new calculations
      updatePayments(interestResult.allPaymentsWithInterest);

      // Save the full array (including interest entries) to the database
      if (projectId) {
        savePayments(interestResult.allPaymentsWithInterest, projectId);
      }

      toast({
        title: 'Interest Calculated', 
        description: `Interest calculated up to ${projectEndDate instanceof Date && !isNaN(projectEndDate) ? projectEndDate.toLocaleDateString() : 'project end'} at ${interestRate}% annual rate.` 
      });
    } catch (error) {
      console.error('Error calculating interest:', error);
      toast({ 
        title: 'Error', 
        description: 'Failed to calculate interest. Please check your entries.',
        variant: 'destructive' 
      });
    }
  };

  const allEntriesForTable: Payment[] = useMemo(() => {
    // `projectData.payments` is the single source of truth and already contains interest payments after calculation
    const principalAndInterestMapped: Payment[] = projectData.payments.map((p): Payment => ({
      ...p,
      id: p.id || `payment_${p.month}_${p.amount}_${Math.random()}`,
      date: p.date ? new Date(p.date).toISOString() : monthToDate(p.month).toISOString(),
      type: p.type || 'payment',
    }));

    const returnsMapped: Payment[] = projectData.rentalIncome.map((r, i): Payment => ({
      id: r.id || `return_${i}_${r.month}_${r.amount}`,
      month: r.month,
      amount: r.amount,
      description: r.description || (r.type === 'sale' ? 'Property Sale' : 'Rental Income'),
      date: r.date ? new Date(r.date).toISOString() : monthToDate(r.month).toISOString(),
      type: 'return',
    }));

    return [...principalAndInterestMapped, ...returnsMapped].sort((a, b) => {
      const dateA = new Date(a.date as string).getTime();
      const dateB = new Date(b.date as string).getTime();
      if (dateA === dateB) {
        const typeOrder = { payment: 1, interest: 2, return: 3 };
        return (typeOrder[a.type as keyof typeof typeOrder] || 99) - (typeOrder[b.type as keyof typeof typeOrder] || 99);
      }
      return dateA - dateB;
    });
  }, [projectData.payments, projectData.rentalIncome]);

  const handleExportCSV = useCallback(async () => {
    try {
      const csvContent = exportToCsv(allEntriesForTable);
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(csvContent);
        toast({ title: 'CSV Copied', description: 'Cash flow data copied to clipboard.' });
      } else {
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = 'cash-flow-export.csv';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast({ title: 'CSV Downloaded', description: 'Cash flow data has been downloaded.' });
      }
    } catch (error) {
      console.error('Error exporting CSV:', error);
      toast({ title: 'Export Error', description: 'Failed to export CSV data.', variant: 'destructive' });
    }
  }, [allEntriesForTable, toast]);

  const startEditPayment = (id: string, payment: Payment) => {
    setEditingPayment(id);
    setEditValues(payment);
  };

  const cancelEdit = () => {
    setEditingPayment(null);
    setEditValues({});
  };

  const parseCashFlowData = async (csvText: string) => {
    if (!csvText.trim()) {
      toast({ title: "Error", description: "No data provided.", variant: "destructive" });
      return;
    }

    const lines = csvText.trim().split(/\r?\n/); // Handle both Unix and Windows line endings
    const newPayments: Payment[] = [];
    const errors: string[] = [];
    
    // Check if first line is a header
    const headerTest = lines[0]?.toLowerCase() || '';
    const hasHeader = headerTest.includes('date') || headerTest.includes('amount');
    let startLine = hasHeader ? 1 : 0;

    for (let i = startLine; i < lines.length; i++) {
      try {
        const line = lines[i].trim();
        if (!line) continue;
        
        // Skip potential header row anywhere in the data
        if (line.toLowerCase().includes('date,amount,description')) {
          console.log(`Skipping header row at line ${i + 1}`);
          continue;
        }

        // Handle quoted fields and commas within quotes
        const columns: string[] = [];
        let current = '';
        let inQuotes = false;
        
        for (let j = 0; j < line.length; j++) {
          const char = line[j];
          const nextChar = line[j + 1];
          
          if (char === '"') {
            if (inQuotes && nextChar === '"') {
              // Handle escaped quote
              current += '"';
              j++; // Skip next quote
            } else {
              inQuotes = !inQuotes;
            }
          } else if (char === ',' && !inQuotes) {
            columns.push(current.trim());
            current = '';
          } else {
            current += char;
          }
        }
        columns.push(current.trim());

        // We need at least date and amount
        if (columns.length < 2) {
          errors.push(`Line ${i + 1}: Invalid format. Expected at least Date and Amount.`);
          continue;
        }

        const dateStr = columns[0].trim();
        const amountStr = columns[1].trim();
        const description = columns[2]?.trim() || '';

        // Parse date - handle multiple formats
        let month = 0;
        let entryDate: Date;
        
        // Try parsing as MMM-YYYY format (e.g., May-2025)
        const monthYearMatch = dateStr.match(/^(\w{3})-(\d{4})$/i);
        if (monthYearMatch) {
          const [_, monthName, year] = monthYearMatch;
          const monthIndex = new Date(`${monthName} 1, ${year}`).getMonth();
          if (!isNaN(monthIndex)) {
            month = parseInt(`${year}${String(monthIndex + 1).padStart(2, '0')}`, 10);
            entryDate = new Date(parseInt(year), monthIndex, 1);
          } else {
            errors.push(`Line ${i + 1}: Invalid month '${monthName}' in date '${dateStr}'. Use format: MMM-YYYY (e.g., May-2025)`);
            continue;
          }
        } 
        // Try parsing as ISO date (YYYY-MM-DD) as fallback
        else {
          const isoDate = new Date(dateStr);
          if (!isNaN(isoDate.getTime())) {
            month = parseInt(formatDate(isoDate, 'yyyyMM'), 10);
            entryDate = isoDate;
          } else {
            // Try the original parseDate as last resort
            month = parseDate(dateStr);
            if (month <= 0) {
              errors.push(`Line ${i + 1}: Could not parse date '${dateStr}'. Use format: MMM-YYYY (e.g., May-2025) or YYYY-MM-DD`);
              continue;
            }
            entryDate = monthToDate(month);
          }
        }

        // Parse amount - handle currency symbols and thousand separators
        const amount = parseCurrencyAmount(amountStr);
        if (isNaN(amount)) {
          errors.push(`Line ${i + 1}: Invalid amount format '${amountStr}'. Expected a number.`);
          continue;
        }

        // Determine transaction type based on amount and description
        let type: 'payment' | 'return' | 'interest' = 'payment';
        const descLower = description.toLowerCase();
        
        if (amount > 0 || 
            ['rent', 'income', 'return', 'sale', 'interest'].some(term => 
              descLower.includes(term)
            )) {
          type = amount > 0 ? 'return' : 'payment';
          if (descLower.includes('interest')) {
            type = 'interest';
          }
        }

        // Create payment entry with proper typing
        const paymentEntry: Payment = {
          id: '', // Will be set by generateStableId
          month,
          amount: type === 'payment' || type === 'interest' ? -Math.abs(amount) : Math.abs(amount),
          description: description || (type === 'return' ? 'Income' : 'Payment'),
          type,
          date: entryDate
        };
        
        // Generate stable ID
        paymentEntry.id = generateStableId(paymentEntry);
        newPayments.push(paymentEntry);
        
      } catch (lineError) {
        console.error(`Error processing line ${i + 1}:`, lineError);
        errors.push(`Line ${i + 1}: ${(lineError as Error).message}`);
      }
    }

    if (errors.length > 0) {
      console.warn('CSV import errors:', errors);
      const errorMessage = errors.length > 5 
        ? `Encountered ${errors.length} errors. First 5: ${errors.slice(0, 5).join(' ')}...`
        : `Encountered errors: ${errors.join(' ')}`;
      
      toast({ 
        title: "Import Warning", 
        description: errorMessage, 
        variant: "destructive",
        duration: 10000 // Show for 10 seconds to allow reading longer messages
      });
    }

    if (newPayments.length > 0) {
      // Create a hash of existing payments to avoid duplicates
      const existingHashes = new Set(projectData.payments.map(p => `${p.month}-${p.amount}-${p.description}`));
      const uniqueNewPayments = newPayments.filter(p => !existingHashes.has(`${p.month}-${p.amount}-${p.description}`));

      if (uniqueNewPayments.length === 0) {
        toast({ title: "No New Data", description: "All entries already exist in the current project." });
        return;
      }

      // Update UI with new payments
      updatePayments([...projectData.payments, ...uniqueNewPayments]);
      
      // Save to Firestore if we have a project ID
      if (projectId) {
        try {
          await savePayments(uniqueNewPayments, projectId);
          toast({ title: "Success", description: `Imported ${uniqueNewPayments.length} new entries and saved to the database.` });
          
          // Trigger refresh for other components
          window.dispatchEvent(new CustomEvent('refresh-projects'));
        } catch (firestoreError) {
          console.error('Error saving to Firestore:', firestoreError);
          toast({ title: "Import Warning", description: "Entries imported but failed to save to the database.", variant: "destructive" });
        }
      } else {
        toast({ title: "Success", description: `Imported ${uniqueNewPayments.length} new entries. No project selected for saving.` });
      }
      
      setCsvData('');
    } else if (errors.length === 0) {
      toast({ title: "No New Data", description: "No new or valid entries were found in the imported data." });
    }
  };

  const saveEdit = async () => {
    if (editingPayment === null) return;
    if (!editValues.description || editValues.amount == null) {
      toast({ title: "Missing Information", description: "Please fill in all required fields.", variant: "destructive" });
      return;
    }

    const date = editValues.date instanceof Date ? editValues.date : 
                (typeof editValues.date === 'string' ? new Date(editValues.date) : monthToDate(editValues.month));
    
    const updatedPayment: Payment = {
      ...editValues,
      id: editingPayment, // Keep the original ID to ensure we're updating, not creating
      date,
      month: dateToMonth(date),
      amount: editValues.type === 'payment' ? -Math.abs(Number(editValues.amount)) : Math.abs(Number(editValues.amount)),
    };

    // Update the payment in the local state
    const updatedPayments = projectData.payments.map(p => p.id === editingPayment ? updatedPayment : p);

    // Recalculate interest with the updated payments array
    const basePayments = updatedPayments.filter(p => p.type !== 'interest');
    const interestResult = calculateMonthlyInterestLogic({
      payments: basePayments,
      interestRate: interestRate,
      projectEndDate
    });

    // Update local state with new calculations
    updatePayments(interestResult.allPaymentsWithInterest);

    // Log the payments array being saved
    console.log('Saving payments to database:', interestResult.allPaymentsWithInterest);

    // Save to Firestore if we have a project ID
    if (projectId) {
      try {
        await savePayments(interestResult.allPaymentsWithInterest, projectId);
        console.log('Save to Firestore successful');
        toast({ description: "Entry updated and saved to the database." });
      } catch (firestoreError) {
        console.error('Error saving to Firestore:', firestoreError);
        toast({ description: "Entry updated but failed to save to the database.", variant: "destructive" });
      }
    } else {
      toast({ description: "Entry updated. No project selected for saving." });
    }

    cancelEdit();
  };

  const handleSaveNew = async () => {
    if (!newPayment.description || newPayment.amount == null) {
      toast({ title: "Missing Information", description: "Please fill in all required fields.", variant: "destructive" });
      return;
    }

    // Ensure we have a valid date
    let dateObj: Date;
    if (newPayment.date instanceof Date) {
      dateObj = newPayment.date;
    } else if (typeof newPayment.date === 'string') {
      dateObj = new Date(newPayment.date);
      if (isNaN(dateObj.getTime())) {
        toast({ title: "Invalid Date", description: "Please enter a valid date.", variant: "destructive" });
        return;
      }
    } else {
      dateObj = new Date();
    }
    
    // Calculate the month number (months since Jan 2024)
    const monthNumber = dateToMonth(dateObj);
    
    // Ensure amount is a number
    const amountValue = Number(newPayment.amount);
    if (isNaN(amountValue)) {
      toast({ title: "Invalid Amount", description: "Please enter a valid number for the amount.", variant: "destructive" });
      return;
    }
    
    // Determine the correct sign for the amount based on payment type
    const amount = newPayment.type === 'payment' ? -Math.abs(amountValue) : Math.abs(amountValue);
    
    const paymentToAdd: Payment = {
      id: '', // Will be set by generateStableId
      month: monthNumber,
      amount: amount,
      description: newPayment.description.trim(),
      date: dateObj,
      type: newPayment.type as 'payment' | 'return' | 'interest',
    };
    
    // Generate a stable ID for the new payment
    paymentToAdd.id = generateStableId(paymentToAdd);
    
    console.log('Adding new payment to project:', projectId, {
      ...paymentToAdd,
      date: dateObj.toISOString(),
      month: monthNumber,
      amount: amount
    });

    try {
      // Save to Firestore first if we have a project ID
      if (projectId) {
        try {
          // This will save to the correct project and return the project ID
          const savedProjectId = await saveSinglePayment(paymentToAdd, projectId);
          console.log('Payment saved to project:', savedProjectId);
          
          // Update local state with the new payment
          updatePayments([...projectData.payments, paymentToAdd]);
          
          toast({ 
            title: "Success", 
            description: `Entry added to project ${savedProjectId}.` 
          });
          
          // Trigger refresh for other components
          window.dispatchEvent(new CustomEvent('refresh-projects'));
        } catch (firestoreError) {
          console.error('Error saving to Firestore:', firestoreError);
          // Still update local state even if Firestore save fails
          updatePayments([...projectData.payments, paymentToAdd]);
          
          toast({ 
            title: "Warning", 
            description: "Entry added locally but failed to save to the database. Changes are local only.", 
            variant: "destructive" 
          });
        }
      } else {
        // No project ID, just update local state
        updatePayments([...projectData.payments, paymentToAdd]);
        toast({ 
          title: "Warning", 
          description: "Entry added locally. No project selected - changes won't be saved to the database.",
          variant: "default"
        });
      }

      // Reset form and close
      handleCancelNew();
    } catch (error) {
      console.error('Error adding new payment:', error);
      toast({ 
        title: "Error", 
        description: `Failed to add entry: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: "destructive" 
      });
    }
  };

  const handleCancelNew = () => {
    setIsAddingNew(false);
    setNewPayment({
      month: dateToMonth(new Date()),
      amount: 0,
      description: '',
      date: new Date(),
      type: 'payment',
    });
  };

  const removePayment = async (id: string) => {
    if (id.startsWith('return_')) {
      const returnIndex = parseInt(id.split('_')[1], 10);
      if (!isNaN(returnIndex)) {
        const updatedReturns = projectData.rentalIncome.filter((_, index) => index !== returnIndex);
        updateProjectData({ rentalIncome: updatedReturns });
      }
    } else {
      // Update local state by removing the payment
      updatePayments(projectData.payments.filter(payment => payment.id !== id));
      
      // Remove from Firestore if we have a project ID
      if (projectId) {
        try {
          // Fetch the current entries
          const { entries } = await fetchProject(projectId);
          
          // Filter out the payment with the matching ID
          const updatedEntries = entries.filter(entry => entry.id !== id);
          
          // Process entries to ensure they all have stable IDs before saving
          const processedEntries = updatedEntries.map(entry => ({
            ...entry,
            id: entry.id || generateStableId(entry)
          }));
          
          // Save the updated entries back to Firestore, replacing the entire document
          // This prevents the duplication issue
          const docRef = doc(db, PAYMENTS_COLLECTION, projectId);
          const docSnap = await getDoc(docRef);
          const existingData = docSnap.exists() ? docSnap.data() : {};
          await setDoc(docRef, {
            name: existingData.name || '',
            ownerId: existingData.ownerId || '',
            entries: processedEntries,
            updatedAt: new Date(),
            count: processedEntries.length,
            projectId: projectId
          });
          
          toast({ description: "Entry deleted from database." });
        } catch (error) {
          console.error(`Error removing payment ${id} from Firestore:`, error);
          toast({ 
            title: "Error", 
            description: "Failed to delete entry from database. It was removed locally only.", 
            variant: "destructive" 
          });
        }
      }
    }
  };

  const handleClearSession = async () => {
    // Clear local state first
    updatePayments([]);
    
    // Clear from database if we have a project ID
    if (projectId) {
      try {
        // Clear the entries array in Firestore
      const docRef = doc(db, PAYMENTS_COLLECTION, projectId);
        const docSnap = await getDoc(docRef);
        const existingData = docSnap.exists() ? docSnap.data() : {};
        
      await setDoc(docRef, {
          name: existingData.name || '',
          ownerId: existingData.ownerId || '',
          ownerEmail: existingData.ownerEmail || '',
          ownerName: existingData.ownerName || '',
          entries: [], // Clear all entries
        updatedAt: new Date(),
          count: 0,
        projectId: projectId
      }, { merge: true });
      
      toast({ 
          title: 'Project Cleared',
          description: 'All entries have been removed from the current project and database.',
          variant: 'default'
      });
      
      // Trigger refresh for other components
      window.dispatchEvent(new CustomEvent('refresh-projects'));
    } catch (error) {
        console.error('Error clearing project from database:', error);
      toast({ 
          title: 'Partially Cleared',
          description: 'Entries removed locally but failed to clear from database.',
        variant: 'destructive' 
      });
    }
    } else {
    toast({
      title: 'Project Cleared',
      description: 'All entries have been removed from the current project.',
      variant: 'default'
    });
    }
    
    setIsClearSessionDialogOpen(false);
  };

  // Toggle handlers for type changes
  const handleTogglePaymentType = async (paymentId: string, currentType: string) => {
    // Toggle between payment <-> drawdown
    const newType = currentType === 'payment' ? 'drawdown' : 'payment';
    
    const updatedPayments = projectData.payments.map(payment => 
      payment.id === paymentId 
        ? { ...payment, type: newType }
        : payment
    );
    
    // Calculate interest with the updated payments array
    const basePayments = updatedPayments.filter(p => p.type !== 'interest');
    const interestResult = calculateMonthlyInterestLogic({
      payments: basePayments,
      interestRate: interestRate,
      projectEndDate
    });
    
    // Update the payments with the new interest calculations
    updatePayments(interestResult.allPaymentsWithInterest);
    
    // Save to database if we have a project ID
    if (projectId) {
      try {
        await savePayments(interestResult.allPaymentsWithInterest, projectId);
        toast({ description: "Entry type updated and saved to the database." });
      } catch (error) {
        console.error('Error saving to Firestore:', error);
        toast({ description: "Entry type updated but failed to save to the database.", variant: "destructive" });
      }
    }
  };

  const handleToggleReturnType = async (paymentId: string, currentType: string) => {
    // Toggle between return <-> repayment
    const newType = currentType === 'return' ? 'repayment' : 'return';
    
    const updatedPayments = projectData.payments.map(payment => 
      payment.id === paymentId 
        ? { ...payment, type: newType }
        : payment
    );
    
    // Calculate interest with the updated payments array
    const basePayments = updatedPayments.filter(p => p.type !== 'interest');
    const interestResult = calculateMonthlyInterestLogic({
      payments: basePayments,
      interestRate: interestRate,
      projectEndDate
    });
    
    // Update the payments with the new interest calculations
    updatePayments(interestResult.allPaymentsWithInterest);
    
    // Save to database if we have a project ID
    if (projectId) {
      try {
        await savePayments(interestResult.allPaymentsWithInterest, projectId);
        toast({ description: "Entry type updated and saved to the database." });
      } catch (error) {
        console.error('Error saving to Firestore:', error);
        toast({ description: "Entry type updated but failed to save to the database.", variant: "destructive" });
      }
    }
  };

  // Return the JSX for the component
  return (
    <div className="space-y-4">
      <div className="space-y-4">
        {/* Integrated Header with Project Controls and Actions */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
            {/* Left: Project Settings */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              <div className="flex items-center gap-3">
                <label className="text-sm font-medium text-gray-700 whitespace-nowrap">Project End:</label>
                <input
                  type="date"
                  value={projectEndDate instanceof Date && !isNaN(projectEndDate) ? projectEndDate.toISOString().split('T')[0] : ''}
                  onChange={(e) => setProjectEndDate(new Date(e.target.value))}
                  className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-36"
                />
              </div>
              
              <div className="flex items-center gap-3">
                <label className="text-sm font-medium text-gray-700 whitespace-nowrap">Interest Rate:</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={interestRate}
                    onChange={(e) => {
                      const newRate = Number(e.target.value);
                      setInterestRate(newRate);
                      updateProjectData({ annualInterestRate: newRate });
                    }}
                    className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-20"
                    min="0"
                    max="100"
                    step="0.1"
                  />
                  <span className="text-sm text-gray-600">% annual</span>
                </div>
              </div>
            </div>
            
            {/* Center: Primary Actions */}
            <div className="flex items-center gap-3">
              <Button 
                onClick={() => setIsAddingNew(true)} 
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 h-9"
                title="Add New Entry"
              >
                <Plus className="w-4 h-4 mr-2" />
                <span className="text-sm">Add Entry</span>
              </Button>
              
              <Button 
                onClick={handleCalculateInterest} 
                className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 h-9"
                title="Calculate Interest"
              >
                <Calculator className="w-4 h-4 mr-2" />
                <span className="text-sm">Calculate</span>
              </Button>
            </div>
            
            {/* Right: Secondary Actions */}
            <div className="flex items-center gap-2">
              {/* Import/Export Actions */}
              <div className="flex items-center gap-1 pr-3 border-r border-gray-200">
                <Button 
                  onClick={handleExportCSV} 
                  variant="outline" 
                  size="sm"
                  className="h-9 w-9 p-0"
                  title="Export to CSV"
                >
                  <Download className="w-4 h-4" />
                </Button>
                
                <Button 
                  onClick={() => setIsImportOpen(true)} 
                  variant="outline" 
                  size="sm"
                  className="h-9 w-9 p-0"
                  title="Import CSV"
                >
                  <Upload className="w-4 h-4" />
                </Button>
                
                <Button 
                  onClick={() => setIsAIImportOpen(true)} 
                  variant="outline" 
                  size="sm"
                  className="h-9 w-9 p-0"
                  title="AI Import"
                >
                  <Wand2 className="w-4 h-4" />
                </Button>
              </div>

              {/* Destructive Action */}
              <Button 
                onClick={() => setIsClearSessionDialogOpen(true)} 
                variant="outline" 
                size="sm"
                className="h-9 w-9 p-0 text-red-600 border-red-300 hover:bg-red-50"
                title="Clear Project"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Full-Width Financial Summary */}
        {!showOnlyCashFlow && (
          <CashFlowAnalysis
            projectData={projectData}
            allPaymentsWithInterest={allPaymentsWithInterest.length > 0 ? allPaymentsWithInterest : projectData.payments}
            projectEndDate={projectEndDate}
          />
        )}

        {/* Cash Flow Table */}
        <PaymentsTable
          payments={allEntriesForTable}
          editingPayment={editingPayment}
          editValues={editValues}
          onStartEdit={startEditPayment}
          onSaveEdit={saveEdit}
          onCancelEdit={cancelEdit}
          onRemove={removePayment}
          onTogglePaymentType={handleTogglePaymentType}
          onToggleReturnType={handleToggleReturnType}
          setEditValues={setEditValues}
          formatCurrency={formatCurrency}
          formatNumber={formatNumber}
          monthToDate={monthToDate}
          dateToMonth={dateToMonth}
          isAddingNew={isAddingNew}
          newPayment={newPayment}
          setNewPayment={setNewPayment}
          onSaveNew={handleSaveNew}
          onCancelNew={handleCancelNew}
        />
      </div>

      {/* Modal Dialogs */}
      {isImportOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setIsImportOpen(false)}>
          <div className="relative max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle className="flex items-center gap-2">
                    <Upload className="w-5 h-5" /> Import Cash Flow Data
                  </CardTitle>
                  <Button variant="ghost" size="sm" className="p-0 h-7 w-7" onClick={() => setIsImportOpen(false)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="csv-file">Select a CSV file</Label>
                  <Input
                    id="csv-file"
                    type="file"
                    accept=".csv,text/csv"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        setCsvFile(file);
                      }
                    }}
                  />
                  <p className="text-xs text-muted-foreground">
                    Format: Date,Amount,Description<br/>
                    Example: May-2025,-146000,Booking Payment<br/>
                    Example: Jun-2026,25000,Monthly Rent
                  </p>
                </div>
                <div className="flex justify-end">
                  <Button
                    onClick={async () => {
                      if (csvFile) {
                        setIsUploading(true);
                        try {
                          const text = await readFileAsText(csvFile);
                          await parseCashFlowData(text);
                          setIsImportOpen(false);
                          setCsvFile(null);
                        } catch (error) {
                          console.error('Error reading CSV file:', error);
                          toast({ 
                            title: "Error", 
                            description: "Failed to read CSV file. Please check the file format.", 
                            variant: "destructive" 
                          });
                        } finally {
                          setIsUploading(false);
                        }
                      }
                    }}
                    disabled={!csvFile || isUploading}
                  >
                    {isUploading ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Processing
                      </>
                    ) : (
                      <>
                        <Upload className="w-4 h-4 mr-2" /> Import Data
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
      
      {isAIImportOpen && (
        <AITextImporter 
          onImport={async (csvData) => {
            await parseCashFlowData(csvData);
            setIsAIImportOpen(false);
          }}
          onClose={() => setIsAIImportOpen(false)}
        />
      )}
      
      {/* Clear Project Confirmation Dialog */}
      <AlertDialog open={isClearSessionDialogOpen} onOpenChange={setIsClearSessionDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear Project Data</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to clear all entries from the current project? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleClearSession}
              className="bg-red-600 hover:bg-red-700"
            >
              Clear Project
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default PaymentsCashFlow;
