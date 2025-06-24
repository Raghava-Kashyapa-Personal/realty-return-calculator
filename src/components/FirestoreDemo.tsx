import React, { useState, useEffect } from 'react';
import { db } from '../firebaseConfig';
import { collection, getDocs, query, orderBy, limit } from 'firebase/firestore';
import FirestoreCSVImporter from './FirestoreCSVImporter';
import FirestoreOfflineSupport from './FirestoreOfflineSupport';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Database, CalendarClock } from 'lucide-react';

// Collection name constant - make sure this matches FirestoreCSVImporter
const COLLECTION_NAME = 'test';

const FirestoreDemo: React.FC = () => {
  const [recentImports, setRecentImports] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshTrigger, setRefreshTrigger] = useState<number>(0);

  // Handler for successful imports
  const handleImportSuccess = (docId: string) => {
    // Trigger a refresh
    setRefreshTrigger(prev => prev + 1);
  };

  // Fetch recent imports when component mounts or when refreshTrigger changes
  useEffect(() => {
    const fetchRecentImports = async () => {
      try {
        const paymentsCollectionRef = collection(db, COLLECTION_NAME);
        console.log('Fetching recent imports from collection:', COLLECTION_NAME);
        const q = query(paymentsCollectionRef, orderBy('importedAt', 'desc'), limit(5));
        const querySnapshot = await getDocs(q);
        
        const imports = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        
        setRecentImports(imports);
      } catch (error) {
        console.error("Error fetching recent imports:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchRecentImports();
  }, [refreshTrigger]);

  // Format date from Firestore Timestamp
  const formatDate = (timestamp: any) => {
    if (!timestamp) return 'N/A';
    
    try {
      // For Firestore Timestamp objects
      if (timestamp.toDate) {
        return timestamp.toDate().toLocaleString();
      }
      // For date strings or other formats
      return new Date(timestamp).toLocaleString();
    } catch (error) {
      return 'Invalid date';
    }
  };

  return (
    <div className="space-y-6">
      <FirestoreOfflineSupport />
      <FirestoreCSVImporter 
        collectionName={COLLECTION_NAME} 
        onImportSuccess={handleImportSuccess} 
      />
      
      <Card className="border-blue-200 shadow-sm">
        <CardHeader className="pb-1 pt-3 px-4">
          <CardTitle className="text-sm font-medium flex items-center gap-1.5">
            <Database className="w-4 h-4 text-blue-600" />
            Recent Firestore Imports (Collection: {COLLECTION_NAME})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-2">
          {loading ? (
            <div className="flex justify-center py-4">
              <svg className="animate-spin h-5 w-5 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            </div>
          ) : recentImports.length > 0 ? (
            <div className="space-y-3">
              {recentImports.map((item) => (
                <div key={item.id} className="border border-gray-200 rounded-md p-3">
                  <div className="flex justify-between items-start">
                    <div className="text-sm font-medium">{item.id}</div>
                    <div className="text-xs text-gray-500 flex items-center">
                      <CalendarClock className="w-3 h-3 mr-1" />
                      {formatDate(item.importedAt)}
                    </div>
                  </div>
                  <div className="text-xs text-gray-600 mt-1">
                    {item.count} entries imported
                    {item.hasErrors && (
                      <span className="text-red-500 ml-2">
                        ({item.errors?.length || 0} errors)
                      </span>
                    )}
                  </div>
                  {item.entries && item.entries.length > 0 && (
                    <div className="mt-2 text-xs">
                      <div className="font-semibold mb-1">Sample entries:</div>
                      <ul className="space-y-1 pl-2">
                        {item.entries.slice(0, 2).map((entry: any, index: number) => (
                          <li key={index} className="text-gray-700">
                            {entry.date}: {entry.amount < 0 ? '-₹' : '₹'}
                            {Math.abs(entry.amount).toLocaleString()} - {entry.description}
                          </li>
                        ))}
                        {item.entries.length > 2 && (
                          <li className="text-gray-500 italic">
                            ... and {item.entries.length - 2} more
                          </li>
                        )}
                      </ul>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-4 text-gray-500 text-sm">
              No imports found. Use the form above to import CSV data.
            </div>
          )}
        </CardContent>
      </Card>
      
      <div className="bg-blue-50 border border-blue-200 rounded-md p-4 text-sm text-blue-800">
        <p className="font-medium">Debugging Tips:</p>
        <ul className="list-disc pl-5 mt-2 space-y-1">
          <li>If the connection test succeeds but you don't see your imported data, check your Firebase console to verify the data is being stored in the <strong>test</strong> collection.</li>
          <li>Make sure you're looking at the correct Firebase project in the console.</li>
          <li>Check your browser's console for any error messages.</li>
          <li>If you see data in Firebase but not in the UI, try refreshing the page.</li>
        </ul>
      </div>
    </div>
  );
};

export default FirestoreDemo;
