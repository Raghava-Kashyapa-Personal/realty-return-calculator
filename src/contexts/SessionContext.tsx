import React, { createContext, useContext, useState, ReactNode } from 'react';

interface SessionContextType {
  currentSessionId: string;
  setCurrentSessionId: (id: string) => void;
}

const SessionContext = createContext<SessionContextType | undefined>(undefined);

export const SessionProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [currentSessionId, setCurrentSessionId] = useState<string>('');

  return (
    <SessionContext.Provider value={{ currentSessionId, setCurrentSessionId }}>
      {children}
    </SessionContext.Provider>
  );
};

export const useSession = (): SessionContextType => {
  const context = useContext(SessionContext);
  if (context === undefined) {
    throw new Error('useSession must be used within a SessionProvider');
  }
  return context;
};
