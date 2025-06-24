import React, { useState, useEffect } from 'react';
import { collection, query, getDocs, orderBy, limit, doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { Button } from './ui/button';
import { Skeleton } from './ui/skeleton';
import { X, PlusCircle, Calendar, Pencil, Check } from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { useSession } from '@/contexts/SessionContext';

// Define the structure of a session
interface Session {
  id: string;
  date: Date;
  entries: number;
  totalAmount: number;
  name?: string;
}

interface SessionSidebarProps {
  onSelectSession: (sessionId: string) => void;
  onNewSession: () => void;
  currentSessionId?: string; // Keeping this for backward compatibility
  onDeleteSession?: (sessionId: string) => void;
}

const PAYMENTS_COLLECTION = 'test';

export const SessionSidebar: React.FC<SessionSidebarProps> = ({
  onSelectSession,
  onNewSession,
  currentSessionId: propCurrentSessionId,
  onDeleteSession
}) => {
  const { currentSessionId: contextSessionId, setCurrentSessionId } = useSession();
  const currentSessionId = contextSessionId || propCurrentSessionId;
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [isOpen, setIsOpen] = useState<boolean>(true);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState<string>('');
  const { toast } = useToast();

  // Handle updating a session name
  const handleUpdateSessionName = async (sessionId: string, newName: string) => {
    if (!newName.trim()) return;
    
    try {
      setLoading(true);
      // Update in Firestore
      await updateDoc(doc(db, PAYMENTS_COLLECTION, sessionId), {
        name: newName.trim(),
        updatedAt: new Date()
      });
      
      // Update local state
      setSessions(sessions.map(session => 
        session.id === sessionId 
          ? { ...session, name: newName.trim() } 
          : session
      ));
      
      toast({
        title: 'Session updated',
        description: 'Session name has been updated',
      });
      
      return true;
    } catch (error) {
      console.error('Error updating session name:', error);
      toast({
        title: 'Error',
        description: 'Failed to update session name',
        variant: 'destructive',
      });
      return false;
    } finally {
      setLoading(false);
      setEditingSessionId(null);
    }
  };

  // Handle session selection
  const handleSessionClick = (sessionId: string) => {
    setCurrentSessionId(sessionId);
    onSelectSession(sessionId);
    setIsOpen(false);
  };

  const startEditing = (session: Session) => {
    setEditingSessionId(session.id);
    setEditingName(session.name || '');
  };

  // Cancel editing
  const cancelEditing = () => {
    setEditingSessionId(null);
    setEditingName('');
  };

  // Save the edited name
  const saveEditing = async () => {
    if (editingSessionId && editingName.trim()) {
      await handleUpdateSessionName(editingSessionId, editingName);
    }
  };

  // Handle key down for input
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      saveEditing();
    } else if (e.key === 'Escape') {
      cancelEditing();
    }
  };

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
          totalAmount,
          name: data.name || `Session ${sessionsData.length + 1}`
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
    const handler = () => {
      console.log('Received refresh-sessions event, refreshing sessions...');
      fetchSessions();
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
                      <div className="flex flex-col flex-1 min-w-0">
                      {editingSessionId === session.id ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={editingName}
                            onChange={(e) => setEditingName(e.target.value)}
                            onKeyDown={handleKeyDown}
                            className="flex-1 px-2 py-1 text-sm border rounded"
                            autoFocus
                          />
                          <button 
                            onClick={saveEditing}
                            className="p-1 text-green-600 hover:bg-green-100 rounded"
                            disabled={!editingName.trim()}
                          >
                            <Check className="h-4 w-4" />
                          </button>
                          <button 
                            onClick={cancelEditing}
                            className="p-1 text-red-600 hover:bg-red-100 rounded"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center group">
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-sm truncate">
                              {session.name}
                            </div>
                            <div className="text-xs text-gray-500">
                              {format(session.date, 'MMM d, yyyy h:mm a')}
                            </div>
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              startEditing(session);
                            }}
                            className="opacity-0 group-hover:opacity-100 ml-2 p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded"
                            title="Edit session name"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      )}
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
