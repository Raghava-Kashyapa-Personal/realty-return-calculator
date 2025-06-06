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


interface AITextImporterProps {
  onImport: (csvData: string) => void;
  onClose: () => void;
}

interface ProcessFileResult {
  text: string;
  fileType: string;
  fileName: string;
}

// Initialize the Google Generative AI with your API key
// You can add your API key here for testing, but make sure to move it to .env before committing
const API_KEY = import.meta.env.VITE_GOOGLE_API_KEY || 'AIzaSyCMnwnm5V9wBbNqTj5Vs8PePx2ddsSqHpI';
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
  
  // Extract text from PDF using a specialized approach for browser environment
  const extractPdfText = async (file: File): Promise<string> => {
    try {
      toast({
        title: "Processing PDF",
        description: "Attempting to extract text...",
        duration: 2000,
      });
      
      // Try a completely different approach focusing on text extraction
      const extractedText = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        
        reader.onload = (e) => {
          const binary = e.target?.result as string || '';
          
          // Step 1: Filter out obvious PDF binary markers and headers
          if (binary.includes('%PDF') || binary.includes('endobj') || binary.includes('endstream')) {
            // This is definitely a PDF, now extract meaningful text
            
            // Step 2: Extract text using multiple methods and combine results
            let extractedParts: string[] = [];
            
            // Method 1: Look for plain text sections (between TJ or Tj operators)
            const textSections = binary.match(/\[(.*?)\]\s*TJ|\(.*?\)\s*Tj/g) || [];
            if (textSections.length > 0) {
              const plainTextParts = textSections.map(section => {
                // Extract content from TJ sections (array of strings)
                if (section.endsWith('TJ')) {
                  const content = section.substring(1, section.length - 3).trim();
                  // Extract strings from the TJ array
                  const strings = content.match(/\(([^\)\\]*(?:\\.[^\)\\]*)*)\)/g) || [];
                  return strings
                    .map(s => s.substring(1, s.length - 1))
                    .join(' ');
                } 
                // Extract content from Tj sections (single string)
                else if (section.endsWith('Tj')) {
                  const content = section.substring(1, section.length - 4);
                  return content.replace(/\\\(/g, '(').replace(/\\\)/g, ')');
                }
                return '';
              }).filter(text => text.trim().length > 0);
              
              extractedParts.push(...plainTextParts);
            }
            
            // Method 2: Look for text in content streams
            const contentStreams = binary.match(/stream[\s\S]*?endstream/g) || [];
            if (contentStreams.length > 0) {
              const streamTexts = contentStreams.map(stream => {
                // Extract only readable text from streams
                const text = stream.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\xFF]/g, '');
                // Find potential text strings
                const strings = text.match(/\(([^\)\\]*(?:\\.[^\)\\]*)*)\)/g) || [];
                return strings
                  .map(s => s.substring(1, s.length - 1))
                  .filter(s => {
                    // Only keep strings that are mostly printable characters
                    const printable = s.replace(/[^\x20-\x7E]/g, '').length;
                    return s.length > 3 && printable > s.length * 0.8;
                  })
                  .join(' ');
              }).filter(text => text.trim().length > 0);
              
              extractedParts.push(...streamTexts);
            }
            
            // Method 3: Direct string extraction as fallback
            if (extractedParts.length === 0) {
              const strings = binary.match(/\(([^\)\\]{3,}(?:\\.[^\)\\]*)*)\)/g) || [];
              const textStrings = strings
                .map(s => s.substring(1, s.length - 1))
                .filter(s => {
                  // Only keep strings that are mostly printable ASCII
                  const printable = s.replace(/[^\x20-\x7E]/g, '').length;
                  return s.length > 4 && printable > s.length * 0.8;
                });
              
              extractedParts.push(...textStrings);
            }
            
            // Step 3: Clean up the extracted text
            let result = extractedParts
              .join('\n')
              // Remove PDF escape sequences
              .replace(/\\n/g, '\n')
              .replace(/\\r/g, '')
              .replace(/\\t/g, ' ')
              .replace(/\s+/g, ' ')
              // Remove binary data markers
              .replace(/endobj|endstream|startxref|xref|trailer/g, '')
              // Remove non-printable characters
              .replace(/[\x00-\x09\x0B\x0C\x0E-\x1F]/g, '')
              // Fix spacing
              .replace(/\s+/g, ' ')
              .trim();
              
            // Filter out sections that look like PDF syntax
            result = result
              .split('\n')
              .filter(line => {
                // Filter out lines that look like PDF syntax or binary data
                return !line.includes('obj') && 
                       !line.includes('PDF') &&
                       !line.includes('endstream') &&
                       !line.includes('FontDescriptor') &&
                       !line.match(/^[0-9]+ [0-9]+ R$/) && // PDF references
                       !line.match(/^[<>{}\[\]]/); // PDF syntax markers
              })
              .join('\n');
            
            if (result.length > 100) {
              resolve(result);
            } else {
              // If we couldn't extract meaningful text, provide a clear message
              resolve("This PDF appears to contain limited extractable text or may be protected. Please try copying the text manually from the PDF.");
            }
          } else {
            // This doesn't appear to be a PDF or is in an unexpected format
            resolve("The file doesn't appear to be a standard PDF or may be protected. Please try copying the text manually.");
          }
        };
        
        reader.onerror = () => {
          resolve("Error reading the PDF file. The file may be corrupted or protected.");
        };
        
        reader.readAsBinaryString(file);
      });
      
      // Check the quality of extraction and provide appropriate feedback
      if (extractedText && extractedText.length > 300) {
        toast({
          title: "Success",
          description: "Text extracted from PDF",
          duration: 2000,
        });
        return extractedText;
      } else if (extractedText && extractedText.length > 100) {
        toast({
          title: "Partial Success",
          description: "Limited text extracted from PDF",
          duration: 3000,
        });
        return extractedText;
      }
      
      toast({
        title: "Limited Success",
        description: "This PDF may be protected or contain images. Try manual extraction.",
        duration: 4000,
      });
      
      return extractedText;
    } catch (error) {
      console.error('PDF extraction error:', error);
      toast({
        title: "Error",
        description: "Could not extract text from PDF",
        duration: 3000,
      });
      return `We had trouble extracting text from this PDF. Please try opening the PDF externally and paste the text here manually.`;
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
      
      // Only add header if text was successfully extracted
      if (text.trim().length > 0) {
        return `${fileType} Document: ${file.name}\n\n${text}`;
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

  // Function to convert text to CSV format using Google's Generative AI (Gemini)
  const convertToCSV = async () => {
    if (!rawText.trim()) {
      toast({ title: "Error", description: "Please enter some text to convert.", variant: "destructive" });
      return;
    }

    setIsProcessing(true);
    try {
      // Create a prompt for the Gemini model
      const prompt = `
        Convert the following text into a CSV format with three columns: date, amount, description.
        
        Rules:
        1. The first line should be the header: date,amount,description
        2. Dates should be in the format Month-Year (e.g., May-2025) or keep the original format if it's already a date
        3. Amounts should be numbers only (no currency symbols or commas)
        4. For payments/expenses, make the amount negative (add a minus sign)
        5. For income/returns, keep the amount positive
        6. The description should be a brief explanation of the payment or income
        
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
        
        for (const line of lines) {
          // Try to extract date patterns (Month-Year or MM/DD/YYYY)
          const datePattern = /(?:\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*[-\s]20\d{2}\b)|(?:\d{1,2}\/\d{1,2}\/\d{2,4})/i;
          const dateMatch = line.match(datePattern);
          
          // Try to extract amount patterns (numbers with optional commas, decimal points, and currency symbols)
          const amountPattern = /(?:[-+]?\s*(?:Rs\.?|INR|\$)?\s*\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?)|(?:[-+]?\s*\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?\s*(?:Rs\.?|INR|\$)?)/;
          const amountMatch = line.match(amountPattern);
          
          // If we found both a date and an amount, extract the description as everything else
          if (dateMatch && amountMatch) {
            const date = dateMatch[0].trim();
            let amount = amountMatch[0].trim();
            
            // Clean up the amount (remove currency symbols, commas)
            amount = amount.replace(/[Rs\.INR\$,\s]/g, '');
            
            // Make payment amounts negative if they don't already have a sign
            if (!amount.startsWith('+') && !amount.startsWith('-')) {
              // Check if this looks like a payment (keywords)
              if (line.toLowerCase().includes('payment') || 
                  line.toLowerCase().includes('booking') || 
                  line.toLowerCase().includes('installment') ||
                  line.toLowerCase().includes('completion')) {
                amount = '-' + amount;
              }
            }
            
            // Extract description (everything that's not the date or amount)
            let description = line
              .replace(dateMatch[0], '')
              .replace(amountMatch[0], '')
              .replace(/[,\s]+/g, ' ')
              .trim();
            
            // If description is empty, use a default
            if (!description) {
              description = 'Payment';
            }
            
            csvLines.push(`${date},${amount},${description}`);
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
