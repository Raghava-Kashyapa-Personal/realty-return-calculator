import React, { useState } from 'react';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Upload, X, Wand2, FileText, FileUp, Loader2, AlertCircle, File } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
// Import mammoth for Word docs
import mammoth from 'mammoth';
import * as pdfjsLib from 'pdfjs-dist/build/pdf';
// For Vite, importing the worker as a URL is a common pattern
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.mjs?url'; // Using '?url' tells Vite to provide a URL to the worker file

if (typeof window !== 'undefined' && 'Worker' in window) { // Ensure this runs only in browser
  pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;
} 


interface AITextImporterProps {
  onImport: (csvData: string) => void;
  onClose: () => void;
}

interface ProcessFileResult {
  text: string;
  fileType: string;
  fileName: string;
}

// Initialize the Google Generative AI with your API key from environment variables
const API_KEY = import.meta.env.VITE_GOOGLE_API_KEY;
if (!API_KEY) {
  console.error('VITE_GOOGLE_API_KEY is not set in environment variables');
  throw new Error('Google API key is required. Please set VITE_GOOGLE_API_KEY in your .env file');
}
const genAI = new GoogleGenerativeAI(API_KEY);

export const AITextImporter: React.FC<AITextImporterProps> = ({ onImport, onClose }) => {
  const [rawText, setRawText] = useState('');
  const [csvResult, setCsvResult] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isReadingFile, setIsReadingFile] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [activeTab, setActiveTab] = useState('paste');
  const [fileError, setFileError] = useState<string | null>(null);
  const [fileInfo, setFileInfo] = useState<{type: string, name: string} | null>(null);
  const { toast } = useToast();

  // Process the selected file
  const processFile = async (file: File): Promise<ProcessFileResult | null> => {
    setFileError(null);
    setIsReadingFile(true);
    
    try {
      let text = "";
      const fileType = file.type;
      const fileName = file.name.toLowerCase();
      const extension = fileName.split('.').pop() || '';
      
      console.log(`Processing file: ${fileName}, type: ${fileType}`);
      
      if (fileType === "text/plain" || extension === "txt") {
        // Handle text files
        text = await readTextFile(file);
        return { text, fileType: 'text', fileName };
      } 
      else if (fileType === "application/pdf" || extension === "pdf") {
        // Extract text from PDF using pdf-parse library
        text = await extractPdfText(file);
        return { text, fileType: 'pdf', fileName };
      } 
      else if (fileType.includes("word") || ["doc", "docx", "rtf"].includes(extension)) {
        // Extract text from Word document using mammoth
        text = await extractWordText(file);
        return { text, fileType: 'word', fileName };
      } 
      else {
        throw new Error(`Unsupported file type: ${fileType}. Please use a text, PDF, or Word file.`);
      }
    } catch (error) {
      console.error('Error processing file:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error processing file';
      setFileError(errorMessage);
      return null;
    } finally {
      setIsReadingFile(false);
    }
  };
  
  // Extract text from PDF using pdfjs-dist
  const extractPdfText = async (file: File): Promise<string> => {
    toast({
      title: "Processing PDF",
      description: "Extracting text content...",
      duration: 2000,
    });

    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      let fullText = "";

      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        // textContent.items is an array of objects, check if 'str' property exists
        const pageText = textContent.items.map(item => ('str' in item ? item.str : '')).join(" ");
        fullText += pageText + "\n"; // Add a newline between pages
      }

      if (fullText.trim()) {
        toast({
          title: "Success",
          description: "Text extracted from PDF.",
          duration: 2000,
        });
        return `PDF Document: ${file.name}\n\n${fullText.trim()}`;
      } else {
        toast({
          title: "Limited Success",
          description: "Could not extract meaningful text from this PDF. It might be image-based.",
          duration: 4000,
        });
        return `Could not extract meaningful text from PDF: ${file.name}. It might be image-based. Try manual extraction.`;
      }
    } catch (error) {
      console.error('Error extracting PDF text with pdf.js:', error);
      let errorMessage = "Could not extract text from this PDF.";
      // Check for specific pdf.js error types if possible, or use instanceof Error
      if (error instanceof Error) {
          // pdf.js might throw errors with a 'name' property for specific issues
          if ('name' in error && error.name === 'PasswordException') {
              errorMessage = "This PDF is password protected. Please remove the password and try again.";
          } else if (error.message.includes('Invalid PDF structure')) {
              errorMessage = "The PDF file seems to be corrupted or has an invalid structure.";
          }
      }
      toast({
        title: "PDF Processing Error",
        description: errorMessage,
        variant: "destructive",
        duration: 4000,
      });
      return `Error processing PDF: ${file.name}\n${errorMessage}\nTry opening it externally and pasting the text manually.`;
    }
  };
  
  // Enhanced text extraction from Word document using mammoth
  const extractWordText = async (file: File): Promise<string> => {
    toast({
      title: "Processing Document",
      description: "Extracting text content...",
      duration: 2000,
    });
    
    try {
      const arrayBuffer = await file.arrayBuffer();
      let text = '';
      let fileType = '';
      
      // Handle different document types
      if (file.name.toLowerCase().endsWith('.rtf')) {
        // RTF files - use a simplified approach
        fileType = 'RTF';
        // For RTF files we need special handling - we'll extract what we can
        const basicText = await readFirstChunkAsText(file, 10000); // Read up to 10KB
        text = basicText.replace(/[\r\n]+/g, '\n').replace(/[\x00-\x1F\x7F-\x9F]/g, '');
        
        toast({
          title: "RTF Format Detected",
          description: "Limited support for RTF. Some formatting may be lost.",
          duration: 3000,
        });
      } else {
        // DOCX files - use mammoth
        fileType = 'Word';
        // Extract raw text from the document
        const result = await mammoth.extractRawText({ arrayBuffer });
        text = result.value;
        
        // Check if we have warnings or issues
        if (result.messages.length > 0) {
          console.warn('Word document conversion notes:', result.messages);
          // Check if there are serious issues that might affect extraction quality
          const seriousIssues = result.messages.filter(msg => msg.type === 'error');
          if (seriousIssues.length > 0) {
            toast({
              title: "Document Processing Note",
              description: "Some content may not have been extracted properly.",
              duration: 4000,
            });
          }
        }
      }
      
      console.log(`Extracted ${text.length} characters from ${fileType} document`);
      
      // Return just the extracted text without adding any headers
      if (text.trim().length > 0) {
        return text.trim();
      }
      
      // If we got here but have no text, the extraction was unsuccessful
      throw new Error('No text content could be extracted');
    } catch (error) {
      console.error('Error extracting document text:', error);
      toast({
        title: "Document Processing Error",
        description: "Could not extract text from this document.",
        variant: "destructive",
        duration: 4000,
      });
      return `Could not extract text from document: ${file.name}\n\n` +
        `The document might be:\n` +
        `- Password protected\n` +
        `- Corrupted\n` +
        `- In an unsupported format\n\n` +
        `Try saving it as a plain text file (.txt) instead.`;
    }
  };
  
  // Read first chunk of a file as text (for preview purposes)
  const readFirstChunkAsText = (file: File, size: number = 2048): Promise<string> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      // Read specified amount or default to 2KB
      const blob = file.slice(0, size);
      
      reader.onload = (e) => {
        const result = e.target?.result as string || '';
        resolve(result + (size <= 2048 ? '...[content truncated]' : ''));
      };
      
      reader.onerror = () => {
        resolve('[Could not read file content]');
      };
      
      reader.readAsText(blob);
    });
  };
  
  // Handle file selection
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setSelectedFile(file);
    setFileError(null);
    setFileInfo({ type: file.type, name: file.name });
    
    const result = await processFile(file);
    if (result) {
      setRawText(result.text);
      setActiveTab('paste');
      toast({ 
        title: "File Processed", 
        description: `Content extracted from ${result.fileName}. You can now convert it to CSV.` 
      });
    }
  };
  
  // Read text file contents
  const readTextFile = (file: File): Promise<string> => {
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

  // Function to check if text is already in CSV format
  const isCSVFormatted = (text: string): boolean => {
    const lines = text.trim().split('\n');
    if (lines.length < 2) return false;
    
    // Check if first line contains CSV headers
    const headers = lines[0].trim().split(',').map(h => h.trim().toLowerCase());
    const hasRequiredHeaders = 
      headers.includes('date') && 
      headers.includes('amount') && 
      headers.includes('description');
    
    if (!hasRequiredHeaders) return false;
    
    // Check if remaining lines have the correct number of columns
    return lines.slice(1).every(line => {
      const values = line.split(',').map(v => v.trim());
      return values.length >= 3; // At least 3 columns: date, amount, description
    });
  };

  // Function to clean and format CSV text
  const cleanAndFormatCSV = (text: string): string => {
    const lines = text.trim().split('\n').filter(Boolean);
    const headerLine = 'date,amount,description';
    
    // If already has correct headers, process the data lines
    if (lines[0].trim().toLowerCase() === headerLine) {
      // Parse and reconstruct each line to ensure proper CSV formatting
      const cleanedLines = lines.slice(1).map(line => {
        const [date, amount, ...descParts] = line.split(',').map(s => s.trim());
        const description = descParts.join(',').trim();
        // Reconstruct the line with proper CSV formatting
        return `${date},${amount},${description}`;
      });
      return [headerLine, ...cleanedLines].join('\n');
    }
    
    // If has different headers but correct format, replace headers and process data lines
    if (lines[0].split(',').length >= 3) {
      const cleanedLines = lines.slice(1).map(line => {
        const [date, amount, ...descParts] = line.split(',').map(s => s.trim());
        const description = descParts.join(',').trim();
        // Reconstruct the line with proper CSV formatting
        return `${date},${amount},${description}`;
      });
      return [headerLine, ...cleanedLines].join('\n');
    }
    
    // If format is unrecognized, return the original text with headers
    return [headerLine, ...lines].join('\n');
  };

  // Function to normalize date strings to YYYY-MM-DD format
  const normalizeDate = (dateStr: string): string => {
    if (!dateStr) return '';
    
    // Try to parse the date using JavaScript's Date object
    try {
      // Handle dates with ordinals (1st, 2nd, 3rd, 4th, etc.)
      const cleanedDateStr = dateStr.replace(/(\d+)(?:st|nd|rd|th)/, '$1');
      
      // Try parsing with different formats
      const dateFormats = [
        // ISO 8601
        'yyyy-MM-dd',
        // Common date formats
        'MM/dd/yyyy', 'dd/MM/yyyy', 'yyyy/MM/dd',
        'MM-dd-yyyy', 'dd-MM-yyyy', 'yyyy-MM-dd',
        // Text month formats
        'MMMM d, yyyy', 'MMM d, yyyy', 'd MMMM yyyy', 'd MMM yyyy',
        'd MMMM, yyyy', 'd MMM, yyyy', 'MMMM yyyy', 'MMM yyyy',
        'yyyy MMMM', 'yyyy MMM', 'MM/yyyy', 'MM-yyyy', 'yyyy/MM', 'yyyy-MM'
      ];
      
      // Try parsing with date-fns or fallback to native Date
      let parsedDate: Date | null = null;
      
      // First try with date-fns if available
      if (typeof window !== 'undefined' && window['dateFns']) {
        const dateFns = window['dateFns'];
        for (const format of dateFormats) {
          try {
            const d = dateFns.parse(cleanedDateStr, format, new Date());
            if (dateFns.isValid(d)) {
              parsedDate = d;
              break;
            }
          } catch (e) { /* Ignore parse errors */ }
        }
      }
      
      // Fallback to native Date parsing if date-fns not available or didn't work
      if (!parsedDate) {
        // Try parsing directly
        const d = new Date(cleanedDateStr);
        if (!isNaN(d.getTime())) {
          parsedDate = d;
        }
      }
      
      if (parsedDate) {
        // Format as YYYY-MM-DD
        const pad = (n: number) => n.toString().padStart(2, '0');
        const year = parsedDate.getFullYear();
        const month = pad(parsedDate.getMonth() + 1);
        const day = parsedDate.getDate();
        
        // If the original string only had month and year, use the 1st of the month
        const hasDay = /\d{1,2}(st|nd|rd|th)?\s+[A-Za-z]|\d{1,2}[\/\-]\d{1,2}/i.test(dateStr);
        const formattedDay = hasDay ? pad(day) : '01';
        
        return `${year}-${month}-${formattedDay}`;
      }
    } catch (e) {
      console.error('Error normalizing date:', e);
    }
    
    // Return original string if parsing failed
    return dateStr;
  };

  // Function to convert text to CSV format using Google's Generative AI (Gemini)
  const convertToCSV = async () => {
    if (!rawText.trim()) {
      toast({ title: "Error", description: "Please enter some text to convert.", variant: "destructive" });
      return;
    }

    // Check if input is already in CSV format
    if (isCSVFormatted(rawText)) {
      const cleanedCSV = cleanAndFormatCSV(rawText);
      // Normalize dates in the CSV
      const lines = cleanedCSV.split('\n');
      const header = lines[0];
      const dataLines = lines.slice(1).map(line => {
        const [date, ...rest] = line.split(',');
        return [normalizeDate(date), ...rest].join(',');
      });
      const normalizedCSV = [header, ...dataLines].join('\n');
      setCsvResult(normalizedCSV);
      toast({ title: "Success", description: "CSV data detected and formatted." });
      return;
    }

    setIsProcessing(true);
    try {
      // Create a prompt for the Gemini model
      const prompt = `
        Convert the following text into a CSV format with three columns: date, amount, description.
        
        Rules:
        1. The first line should be the header: date,amount,description
        2. Extract the full date including day, month, and year when available
        3. Format dates as YYYY-MM-DD (e.g., 2025-05-25 for May 25, 2025)
        4. If only month and year are available, use YYYY-MM-01 (e.g., 2025-05-01 for May 2025)
        5. Preserve the exact date when available in the original text (e.g., '25th May 2024' should be '2024-05-25')
        6. Amounts should be numbers only (no currency symbols or commas)
        7. For payments/expenses, make the amount negative (add a minus sign)
        8. For income/returns, keep the amount positive
        9. The description should be a brief explanation of the payment or income
        
        Examples:
        - 'Payment on 25th May 2024 of Rs. 1,00,000' -> '2024-05-25,-100000,Payment'
        - 'May 2025: Monthly installment 2,50,000' -> '2025-05-01,-250000,Monthly installment'
        - '16th of June 2023 - Maintenance 5000' -> '2023-06-16,-5000,Maintenance'
        - '25-01-2026: Final payment 7,50,000' -> '2026-01-25,-750000,Final payment'
        
        Here's the text to convert:
        ${rawText}
        
        Return ONLY the CSV data, nothing else. No explanations or additional text.
      `;
      
      try {
        console.log('Using API Key:', API_KEY ? 'API key is set' : 'No API key');
        // Call the Gemini API
        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
        console.log('Model created successfully');
        const result = await model.generateContent(prompt);
        console.log('Content generated successfully');
        const response = result.response;
        const text = response.text();
        
        // Check if the response starts with the header
        if (text.trim().startsWith('date,amount,description')) {
          setCsvResult(text.trim());
        } else {
          // If the model didn't format it correctly, add the header
          setCsvResult('date,amount,description\n' + text.trim());
        }
        
        toast({ title: "Success", description: "Text converted to CSV format using AI." });
      } catch (aiError) {
        console.error('Error calling Gemini API:', aiError);
        
        // Fallback to rule-based parsing if API call fails
        toast({ 
          title: "AI Service Unavailable", 
          description: "Using fallback parser instead. Check your API key configuration.",
          variant: "destructive"
        });
        
        // Rule-based fallback parser
        const lines = rawText.split('\n').filter(line => line.trim());
        const csvLines = ['date,amount,description'];
        
        // Enhanced date patterns to match various formats
        const datePatterns = [
          // DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY
          /(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})/,
          // YYYY/MM/DD or YYYY-MM-DD or YYYY.MM.DD
          /(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})/,
          // DD Month YYYY or DD Mon YYYY
          /(\d{1,2})(?:st|nd|rd|th)?\s+(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)[a-z]*\s+(\d{4})/i,
          // Month DD, YYYY or Mon DD, YYYY 
          /(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)[a-z]*\s+(\d{1,2})(?:st|nd|rd|th)?[,\s]+(\d{4})/i,
          // Month YYYY or Mon YYYY
          /(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)[a-z]*\s+(\d{4})/i,
          // YYYY Month or YYYY Mon
          /(\d{4})\s+(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)[a-z]*/i
        ];
        
        for (const line of lines) {
          let dateMatch = null;
          let dateStr = '';
          
          // Try each date pattern until we find a match
          for (const pattern of datePatterns) {
            const match = line.match(pattern);
            if (match) {
              dateMatch = match;
              dateStr = match[0].trim();
              break;
            }
          }
          
          if (!dateMatch) continue;
          
          // Try to extract amount patterns (numbers with optional commas, decimal points, and currency symbols)
          const amountPattern = /(?:[-+]?\s*(?:Rs\.?|INR|\$)?\s*\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?)|(?:[-+]?\s*\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?\s*(?:Rs\.?|INR|\$)?)/;
          const amountMatch = line.match(amountPattern);
          
          if (amountMatch) {
            let amount = amountMatch[0].trim();
            
            // Clean up the amount (remove currency symbols, commas)
            amount = amount.replace(/[Rs\.INR\$,\s]/g, '');
            
            // Make payment amounts negative if they don't already have a sign
            if (!amount.startsWith('+') && !amount.startsWith('-')) {
              // Check if this looks like a payment (keywords)
              const paymentKeywords = ['payment', 'booking', 'installment', 'completion', 'fee', 'charge', 'debit'];
              if (paymentKeywords.some(keyword => line.toLowerCase().includes(keyword))) {
                amount = '-' + amount;
              }
            }
            
            // Extract description (everything that's not the date or amount)
            let description = line
              .replace(dateStr, '')
              .replace(amountMatch[0], '')
              .replace(/[,\s]+/g, ' ')
              .replace(/^[^\w\s]+|[^\w\s]+$/g, '') // Remove leading/trailing non-word chars
              .trim();
            
            // If description is empty, use a default
            if (!description) {
              description = 'Payment';
            }
            
            // Normalize the date
            const normalizedDate = normalizeDate(dateStr);
            
            csvLines.push(`${normalizedDate},${amount},${description}`);
          }
        }
        
        const result = csvLines.join('\n');
        setCsvResult(result);
        toast({ title: "Success", description: "Text converted to CSV format using fallback parser." });
      }
    } catch (error) {
      console.error('Error converting text to CSV:', error);
      toast({ title: "Error", description: "Failed to convert text to CSV format.", variant: "destructive" });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="relative max-w-2xl w-full mx-4" onClick={(e) => e.stopPropagation()}>
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle className="flex items-center gap-2">
                <Wand2 className="w-5 h-5" /> AI Text to CSV Converter
              </CardTitle>
              <Button variant="ghost" size="sm" className="p-0 h-7 w-7" onClick={onClose}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="paste" className="flex items-center gap-1">
                  <FileText className="w-4 h-4" /> Paste Text
                </TabsTrigger>
                <TabsTrigger value="upload" className="flex items-center gap-1">
                  <FileUp className="w-4 h-4" /> Upload File
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="paste" className="mt-4">
                <p className="text-sm text-muted-foreground mb-2">
                  Paste any text containing payment information, and Google's Gemini AI will convert it to CSV format.
                </p>
                <Textarea
                  value={rawText}
                  onChange={(e) => setRawText(e.target.value)}
                  placeholder="Paste your text here... Example:&#10;May 2025 - Booking payment of Rs. 1,46,000&#10;June 2025 - Foundation work payment Rs. 2,92,000"
                  rows={6}
                  className="font-mono text-xs"
                />
              </TabsContent>
              
              <TabsContent value="upload" className="mt-4">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="ai-file-upload">Upload a text, PDF, or Word file containing payment data</Label>
                    <Input 
                      id="ai-file-upload"
                      type="file"
                      accept=".txt,.pdf,.doc,.docx,.rtf"
                      onChange={handleFileSelect}
                      disabled={isReadingFile}
                    />
                    <p className="text-xs text-muted-foreground">
                      Supported formats: .txt, .pdf, .doc, .docx, .rtf
                    </p>
                  </div>
                  
                  {fileInfo && (
                    <div className="rounded-md bg-muted p-3 text-sm">
                      <div className="flex items-center gap-2">
                        {fileInfo.type.includes('pdf') || fileInfo.name.endsWith('.pdf') ? (
                          <File className="h-4 w-4 text-primary" />
                        ) : fileInfo.type.includes('word') || fileInfo.name.match(/\.(doc|docx)$/) ? (
                          <FileText className="h-4 w-4 text-primary" />
                        ) : (
                          <FileText className="h-4 w-4 text-primary" />
                        )}
                        <span className="font-medium">{fileInfo.name}</span>
                      </div>
                      {isReadingFile && (
                        <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground">
                          <Loader2 className="h-3 w-3 animate-spin" />
                          <span>Processing file content...</span>
                        </div>
                      )}
                    </div>
                  )}
                  
                  {fileError && (
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertTitle>Error</AlertTitle>
                      <AlertDescription>{fileError}</AlertDescription>
                    </Alert>
                  )}
                </div>
              </TabsContent>
            </Tabs>
            
            <div className="flex justify-center">
              <Button 
                onClick={convertToCSV} 
                disabled={isProcessing || !rawText.trim()}
                className="gap-2"
              >
                <Wand2 className="w-4 h-4" /> 
                {isProcessing ? "Converting..." : "Convert to CSV"}
              </Button>
            </div>
            
            {csvResult && (
              <div>
                <p className="text-sm font-medium mb-2">CSV Result:</p>
                <Textarea
                  value={csvResult}
                  readOnly
                  rows={6}
                  className="font-mono text-xs bg-muted"
                />
                <div className="flex justify-end mt-4">
                  <Button
                    onClick={() => onImport(csvResult)}
                    className="gap-2"
                  >
                    <Upload className="w-4 h-4" /> Use This Data
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AITextImporter;
