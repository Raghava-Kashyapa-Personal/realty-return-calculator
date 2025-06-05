import React, { useState } from 'react';
import { db } from '../firebaseConfig';
import { collection, addDoc, Timestamp, getDocs, query, limit } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle, CheckCircle2 } from 'lucide-react';

const FirebaseConnectionTest: React.FC = () => {
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [testResult, setTestResult] = useState<any>(null);

  const runConnectionTest = async () => {
    setTestStatus('testing');
    setErrorMessage('');
    setTestResult(null);
    
    try {
      console.log('Starting Firebase connection test...');
      
      // 1. Test write operation
      const testCollection = collection(db, 'test');
      const testData = {
        message: 'Test message',
        timestamp: Timestamp.now(),
        testId: `test-${Date.now()}`
      };
      
      console.log('Attempting to write test data:', testData);
      const docRef = await addDoc(testCollection, testData);
      console.log('Test document written with ID:', docRef.id);
      
      // 2. Test read operation
      const q = query(testCollection, limit(1));
      const querySnapshot = await getDocs(q);
      
      if (querySnapshot.empty) {
        throw new Error('Could not read from Firestore after writing test document');
      }
      
      const result = {
        writeId: docRef.id,
        readSample: querySnapshot.docs[0].data(),
        readId: querySnapshot.docs[0].id
      };
      
      setTestResult(result);
      setTestStatus('success');
      console.log('Firebase connection test successful!', result);
      
    } catch (error) {
      console.error('Firebase connection test failed:', error);
      setTestStatus('error');
      setErrorMessage(error instanceof Error ? error.message : 'Unknown error occurred');
    }
  };

  return (
    <Card className="border-purple-200 shadow-sm mt-6">
      <CardHeader className="pb-1 pt-3 px-4">
        <CardTitle className="text-sm font-medium flex items-center gap-1.5">
          {testStatus === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-green-600" />
          ) : (
            <AlertCircle className="w-4 h-4 text-purple-600" />
          )}
          Firebase Connection Test
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 pt-2">
        <div className="space-y-3">
          <p className="text-sm text-gray-600">
            This will test if your Firebase connection is working properly by writing and reading a test document.
          </p>
          
          <div className="flex justify-center">
            <Button
              onClick={runConnectionTest}
              disabled={testStatus === 'testing'}
              className="bg-purple-600 hover:bg-purple-700"
            >
              {testStatus === 'testing' ? (
                <span className="flex items-center">
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Testing Connection...
                </span>
              ) : 'Test Firebase Connection'}
            </Button>
          </div>
          
          {testStatus === 'error' && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm">
              <p className="font-medium">Connection Error:</p>
              <p>{errorMessage}</p>
            </div>
          )}
          
          {testStatus === 'success' && (
            <div className="p-3 bg-green-50 border border-green-200 rounded-md text-green-700 text-sm">
              <p className="font-medium">Connection Successful!</p>
              <p>Successfully wrote document with ID: {testResult?.writeId}</p>
              <p className="mt-2 font-medium">Sample data read from Firestore:</p>
              <pre className="mt-1 bg-white p-2 rounded overflow-x-auto text-xs">
                {JSON.stringify(testResult?.readSample, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default FirebaseConnectionTest;
