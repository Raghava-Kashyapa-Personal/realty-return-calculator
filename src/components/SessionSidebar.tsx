import React, { useState, useEffect } from 'react';
import { collection, query, getDocs, orderBy, limit } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { Button } from './ui/button';
import { Skeleton } from './ui/skeleton';
import { X, PlusCircle, Calendar } from 'lucide-react';
import { format } from 'date-fns';

// Define the structure of a session
interface Session {
  id: string;
  date: Date;
  entries: number;
  totalAmount: number;
}

interface SessionSidebarProps {
  onSelectSession: (sessionId: string) => void;
  onNewSession: () => void;
  currentSessionId?: string;
  onDeleteSession?: (sessionId: string) => void;
}

const PAYMENTS_COLLECTION = 'test';

export const SessionSidebar: React.FC<SessionSidebarProps> = ({
  onSelectSession,
  onNewSession,
  currentSessionId,
  onDeleteSession
}) => {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [isOpen, setIsOpen] = useState<boolean>(true);

  // Expose fetchSessions for parent/other triggers
  const fetchSessions = async () => {
    try {
      setLoading(true);
      const sessionsCol = collection(db, PAYMENTS_COLLECTION);
      const q = query(sessionsCol, orderBy('createdAt', 'desc'), limit(30));
      const querySnapshot = await getDocs(q);
      const sessionsData: Session[] = [];
      querySnapshot.forEach(doc => {
        const data = doc.data();
        const entries = data.entries || [];
        // Calculate the total amount of all entries
        const totalAmount = entries.reduce((sum: number, entry: any) => {
          const amount = entry.amount || 0;
          return sum + amount;
        }, 0);
        sessionsData.push({
          id: doc.id,
          date: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(doc.id),
          entries: entries.length,
          totalAmount
        });
      });
      setSessions(sessionsData);
    } catch (error) {
      console.error('Error fetching sessions:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSessions();
  }, []);

  // Allow refresh via window event (for decoupled triggering)
  useEffect(() => {
    const handler = (event: Event) => {
      const customEvent = event as CustomEvent;
      if (customEvent.detail === 'refresh-sessions') fetchSessions();
    };
    window.addEventListener('refresh-sessions', handler);
    return () => window.removeEventListener('refresh-sessions', handler);
  }, []);
  
  // Toggle sidebar
  const toggleSidebar = () => {
    setIsOpen(!isOpen);
  };
  
  // Format amount for display
  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(amount);
  };
  
  return (
    <div className={`transition-all duration-300 ${isOpen ? 'w-64' : 'w-12'} border-r border-gray-200 h-screen flex flex-col`}>
      {/* Toggle button */}
      <button 
        onClick={toggleSidebar} 
        className="absolute left-64 top-4 p-1 bg-white border border-gray-200 rounded-full shadow-sm z-10"
        style={{ transform: isOpen ? 'translateX(50%)' : 'translateX(-50%)'}}
      >
        <X className={`h-4 w-4 transition-transform duration-300 ${isOpen ? 'rotate-0' : 'rotate-180'}`} />
      </button>
      
      {isOpen && (
        <>
          <div className="p-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold mb-2">Previous Sessions</h2>
            <Button 
              variant="outline" 
              className="w-full justify-start" 
              onClick={onNewSession}
            >
              <PlusCircle className="h-4 w-4 mr-2" />
              New Session
            </Button>
          </div>
          
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="p-4 space-y-3">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="flex flex-col space-y-2">
                    <Skeleton className="h-5 w-32" />
                    <Skeleton className="h-4 w-24" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-2">
                {sessions.length > 0 ? sessions.map(session => (
                  <div
                    key={session.id}
                    className={`p-3 mb-2 rounded-md flex items-center justify-between transition-colors
                      ${currentSessionId === session.id 
                        ? 'bg-blue-100 border-l-4 border-blue-500' 
                        : 'hover:bg-gray-100'}`}
                  >
                    <div
                      className="flex items-center cursor-pointer flex-1"
                      onClick={() => onSelectSession(session.id)}
                    >
                      <Calendar className="h-4 w-4 mr-2" />
                      <div className="font-mono text-base">
                        {session.id}
                      </div>
                    </div>
                    {onDeleteSession && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="ml-2 text-red-500 hover:bg-red-100"
                        title="Delete session"
                        onClick={e => {
                          e.stopPropagation();
                          onDeleteSession(session.id);
                        }}
                        disabled={loading}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                )) : (
                  <div className="text-center text-gray-500 py-8">
                    No previous sessions found
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};
