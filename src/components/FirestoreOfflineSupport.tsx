import React, { useState, useEffect } from 'react';
import { db } from '../firebaseConfig';
import { enableIndexedDbPersistence, disableNetwork, enableNetwork } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { Wifi, WifiOff, RefreshCw } from 'lucide-react';

const FirestoreOfflineSupport: React.FC = () => {
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  const [persistenceEnabled, setPersistenceEnabled] = useState<boolean>(false);
  const [isEnablingPersistence, setIsEnablingPersistence] = useState<boolean>(false);
  const { toast } = useToast();

  // Monitor online/offline status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Enable offline persistence
  const enablePersistence = async () => {
    if (persistenceEnabled) {
      toast({
        title: 'Already Enabled',
        description: 'Offline persistence is already enabled.',
      });
      return;
    }

    setIsEnablingPersistence(true);
    try {
      await enableIndexedDbPersistence(db);
      setPersistenceEnabled(true);
      toast({
        title: 'Success',
        description: 'Offline persistence has been enabled. You can now use the app offline!',
      });
    } catch (error) {
      console.error('Error enabling persistence:', error);
      let errorMessage = 'Failed to enable offline persistence';
      
      if (error instanceof Error) {
        // Handle specific errors
        if (error.message.includes('multiple tabs')) {
          errorMessage = 'Multiple tabs open. Close other tabs of this app and try again.';
        } else if (error.message.includes('already enabled')) {
          setPersistenceEnabled(true);
          errorMessage = 'Persistence was already enabled in another tab.';
        }
      }
      
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setIsEnablingPersistence(false);
    }
  };

  // Force offline mode for testing
  const toggleNetworkConnection = async () => {
    try {
      if (isOnline) {
        await disableNetwork(db);
        toast({
          title: 'Network Disabled',
          description: 'Firestore network connection disabled. App is in offline mode.',
        });
      } else {
        await enableNetwork(db);
        toast({
          title: 'Network Enabled',
          description: 'Firestore network connection restored.',
        });
      }
    } catch (error) {
      console.error('Error toggling network:', error);
      toast({
        title: 'Error',
        description: 'Failed to toggle network connection',
        variant: 'destructive',
      });
    }
  };

  return (
    <Card className="border-yellow-200 shadow-sm">
      <CardHeader className="pb-1 pt-3 px-4">
        <CardTitle className="text-sm font-medium flex items-center gap-1.5">
          {isOnline ? (
            <Wifi className="w-4 h-4 text-green-600" />
          ) : (
            <WifiOff className="w-4 h-4 text-red-600" />
          )}
          Network Status: {isOnline ? 'Online' : 'Offline'}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 pt-2">
        <div className="text-sm space-y-4">
          <p className={isOnline ? 'text-green-700' : 'text-red-700'}>
            {isOnline 
              ? 'Your device is connected to the internet. Firestore operations should work normally.'
              : 'Your device is offline. With offline persistence enabled, you can still use the app and data will sync when you reconnect.'}
          </p>
          
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={enablePersistence}
              disabled={persistenceEnabled || isEnablingPersistence}
              size="sm"
              className="bg-yellow-600 hover:bg-yellow-700"
            >
              {isEnablingPersistence ? (
                <span className="flex items-center">
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Enabling...
                </span>
              ) : persistenceEnabled ? (
                'Offline Support Enabled'
              ) : (
                'Enable Offline Support'
              )}
            </Button>
            
            <Button
              onClick={toggleNetworkConnection}
              size="sm"
              variant="outline"
              className="border-gray-300"
            >
              {isOnline ? (
                <>
                  <WifiOff className="w-3.5 h-3.5 mr-1.5" />
                  Test Offline Mode
                </>
              ) : (
                <>
                  <Wifi className="w-3.5 h-3.5 mr-1.5" />
                  Reconnect
                </>
              )}
            </Button>
          </div>
          
          {persistenceEnabled && (
            <div className="text-xs bg-green-50 p-2 rounded border border-green-200 mt-1">
              <span className="font-medium text-green-700">Offline persistence enabled!</span> 
              <span className="text-gray-600 ml-1">
                Your data will be cached locally and synced when you're back online.
              </span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default FirestoreOfflineSupport;
