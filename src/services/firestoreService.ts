import { db } from '../firebaseConfig';
import { collection, doc, setDoc, getDoc, Timestamp, updateDoc, arrayUnion, getDocs, query, orderBy, limit, where, deleteDoc } from 'firebase/firestore';
import { Payment, ProjectData } from '@/types/project';

// Collection names
const CASHFLOW_COLLECTION = 'cashflows';
const PAYMENTS_COLLECTION = 'test'; // Using 'test' as specified by the user

/**
 * Deletes a session (document) by its ID from Firestore
 * @param sessionId The document ID of the session to delete
 */
export const deleteSession = async (sessionId: string): Promise<void> => {
  try {
    const docRef = doc(db, PAYMENTS_COLLECTION, sessionId);
    await deleteDoc(docRef);
    console.log(`Session ${sessionId} deleted successfully.`);
  } catch (error) {
    console.error(`Error deleting session ${sessionId}:`, error);
    throw error;
  }
};

/**
 * Saves project data to Firestore
 * @param projectData The project data to save
 * @param sessionId Optional session ID to use as document ID
 * @returns The document ID
 */
export const saveProjectData = async (projectData: ProjectData, sessionId?: string): Promise<string> => {
  try {
    // Use provided sessionId, or derive from project name, or generate a timestamp-based ID
    const docId = sessionId || (projectData.projectName 
      ? projectData.projectName.replace(/\s+/g, '-').toLowerCase() 
      : `project-${Date.now()}`);
    
    console.log(`Saving project data to session ID: ${docId}`);
    
    // Remove any undefined values to prevent Firestore errors
    const sanitizedData = sanitizeData(projectData);
    
    const docRef = doc(db, CASHFLOW_COLLECTION, docId);
    await setDoc(docRef, {
      ...sanitizedData,
      projectId: docId, // Store the ID within the document as well
      payments: [], // We'll store payments separately
      updatedAt: Timestamp.now()
    }, { merge: true });
    
    // Return the document ID for reference
    return docId;
  } catch (error) {
    console.error('Error saving project data:', error);
    throw error;
  }
};

/**
 * Saves payments data to Firestore
 * @param payments The payments to save
 * @param sessionId The session ID to use as document ID (optional)
 * @returns The document ID
 */
export const savePayments = async (payments: Payment[], sessionId?: string): Promise<string> => {
  try {
    // Use provided sessionId or today's date as document ID
    const docId = sessionId || new Date().toISOString().split('T')[0];
    console.log(`Saving payments to session ID: ${docId}`);
    
    // Sanitize the payments to remove any undefined values
    const sanitizedPayments = payments.map(payment => sanitizePaymentData(payment));
    
    // Check if document already exists
    const docRef = doc(db, PAYMENTS_COLLECTION, docId);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      // Document exists, update it with new payments
      const existingData = docSnap.data();
      const existingPayments = existingData.entries || [];
      
      // Create a Set of existing payment IDs for quick lookup
      const existingPaymentIds = new Set(existingPayments.map((p: Payment) => p.id));
      
      // Filter out any new payments that already exist (by ID)
      const uniqueNewPayments = sanitizedPayments.filter(payment => !existingPaymentIds.has(payment.id));
      
      if (uniqueNewPayments.length === 0) {
        console.log('No new payments to save - all entries already exist');
        return docId;
      }
      
      // Only update if we have new payments to add
      await updateDoc(docRef, {
        entries: [...existingPayments, ...uniqueNewPayments],
        updatedAt: Timestamp.now(),
        count: existingPayments.length + uniqueNewPayments.length,
        sessionId: sessionId || existingData.sessionId
      });
    } else {
      // Document doesn't exist, create it
      await setDoc(docRef, {
        entries: sanitizedPayments,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
        count: sanitizedPayments.length,
        sessionId: sessionId || docId
      });
    }
    
    return docId;
  } catch (error) {
    console.error('Error saving payments:', error);
    throw error;
  }
};

/**
 * Saves a single payment to Firestore
 * @param payment The payment to save
 * @param projectId The project ID (optional)
 * @returns The document ID
 */
export const saveSinglePayment = async (payment: Payment, projectId?: string): Promise<string> => {
  try {
    // Get today's date as document ID (YYYY-MM-DD)
    const today = new Date().toISOString().split('T')[0];
    const docId = today;
    
    // Sanitize the payment to remove any undefined values
    const sanitizedPayment = sanitizePaymentData(payment);
    
    // Check if document already exists
    const docRef = doc(db, PAYMENTS_COLLECTION, docId);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      // Document exists, add this payment to it
      const existingData = docSnap.data();
      const existingEntries = existingData.entries || [];
      
      await updateDoc(docRef, {
        entries: [...existingEntries, sanitizedPayment],
        updatedAt: Timestamp.now(),
        count: (existingEntries.length || 0) + 1,
        projectId: projectId || existingData.projectId
      });
    } else {
      // Document doesn't exist, create it
      await setDoc(docRef, {
        entries: [sanitizedPayment],
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
        count: 1,
        projectId: projectId
      });
    }
    
    return docId;
  } catch (error) {
    console.error('Error saving single payment:', error);
    throw error;
  }
};

/**
 * Sanitizes a payment object to remove undefined values
 * @param payment The payment to sanitize
 * @returns Sanitized payment object
 */
export const sanitizePaymentData = (payment: Payment): any => {
  const sanitized: any = {};
  
  // Only include defined properties
  if (payment.id !== undefined) sanitized.id = payment.id;
  if (payment.month !== undefined) sanitized.month = payment.month;
  if (payment.amount !== undefined) sanitized.amount = payment.amount;
  if (payment.description !== undefined) sanitized.description = payment.description;
  if (payment.debtFunded !== undefined) sanitized.debtFunded = payment.debtFunded;
  if (payment.type !== undefined) sanitized.type = payment.type;
  
  // Handle date specifically (convert to Firestore timestamp if it's a Date object)
  if (payment.date !== undefined) {
    if (payment.date instanceof Date) {
      sanitized.date = Timestamp.fromDate(payment.date);
    } else if (typeof payment.date === 'string') {
      // Try to parse the string to a date
      try {
        const dateObj = new Date(payment.date);
        sanitized.date = Timestamp.fromDate(dateObj);
      } catch (e) {
        // If parsing fails, store as is
        sanitized.date = payment.date;
      }
    } else {
      // If it's already a Timestamp or other format, store as is
      sanitized.date = payment.date;
    }
  }
  
  return sanitized;
};

/**
 * Fetches today's entries from Firestore
 * @returns The entries for today's date
 */
export const fetchTodayEntries = async (): Promise<Payment[]> => {
  try {
    // Get today's date as document ID (YYYY-MM-DD)
    const today = new Date().toISOString().split('T')[0];
    console.log('Fetching entries for today:', today);
    const docRef = doc(db, PAYMENTS_COLLECTION, today);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      const data = docSnap.data();
      console.log('Found document for today with data:', data);
      // Convert Firebase timestamps back to Date objects
      return (data.entries || []).map((entry: any) => {
        try {
          // Handle date conversion from Firestore timestamp to Date
          let date = entry.date;
          if (date && typeof date.toDate === 'function') {
            date = date.toDate();
            console.log('Converted timestamp to date:', date);
          } else {
            console.log('Date is not a timestamp, using as is:', date);
          }
          
          return {
            ...entry,
            date,
            id: entry.id || `entry-${Date.now()}-${Math.random().toString(36).substr(2, 9)}` // Ensure we have an ID
          };
        } catch (err) {
          console.error('Error processing entry:', err, entry);
          // Return entry without date conversion if there's an error
          return {
            ...entry,
            id: entry.id || `entry-${Date.now()}-${Math.random().toString(36).substr(2, 9)}` // Ensure we have an ID
          };
        }
      });
    } else {
      console.log('No document found for today');
    }
    
    return [];
  } catch (error) {
    console.error('Error fetching today\'s entries:', error);
    return []; // Return empty array instead of throwing to prevent breaking the UI
  }
};

/**
 * Fetches all entries from Firestore
 * @param limit Number of documents to fetch (default: 20)
 * @returns All entries from the database
 */
export const fetchAllEntries = async (limitCount: number = 20): Promise<{ entries: Payment[], projectIds: string[] }> => {
  try {
    console.log('Fetching all entries, limit:', limitCount);
    const entriesCollectionRef = collection(db, PAYMENTS_COLLECTION);
    
    // Just query the collection without orderBy as it might not exist
    const q = query(entriesCollectionRef, limit(limitCount));
    const querySnapshot = await getDocs(q);
    
    console.log('Fetched documents count:', querySnapshot.size);
    
    const allEntries: Payment[] = [];
    const projectIds: string[] = [];
    
    querySnapshot.forEach((docSnapshot) => {
      try {
        console.log('Processing document:', docSnapshot.id);
        const data = docSnapshot.data();
        console.log('Document data:', data);
        
        if (data.projectId && !projectIds.includes(data.projectId)) {
          projectIds.push(data.projectId);
        }
        
        // Handle entries if they exist
        if (Array.isArray(data.entries)) {
          const entries = data.entries.map((entry: any) => {
            try {
              // Handle date conversion from Firestore timestamp to Date
              let date = entry.date;
              if (date && typeof date.toDate === 'function') {
                date = date.toDate();
              }
              
              return {
                ...entry,
                date,
                id: entry.id || `entry-${Date.now()}-${Math.random().toString(36).substr(2, 9)}` // Ensure we have an ID
              };
            } catch (err) {
              console.error('Error processing entry:', err, entry);
              // Return entry without date conversion if there's an error
              return {
                ...entry,
                id: entry.id || `entry-${Date.now()}-${Math.random().toString(36).substr(2, 9)}` // Ensure we have an ID
              };
            }
          });
          
          console.log(`Adding ${entries.length} entries from document ${docSnapshot.id}`);
          allEntries.push(...entries);
        } else {
          console.log('No entries array in document:', docSnapshot.id);
        }
      } catch (docError) {
        console.error('Error processing document:', docError, docSnapshot.id);
      }
    });
    
    console.log('Total entries found:', allEntries.length, 'Project IDs:', projectIds);
    return { entries: allEntries, projectIds };
  } catch (error) {
    console.error('Error fetching all entries:', error);
    return { entries: [], projectIds: [] }; // Return empty data instead of throwing
  }
};

/**
 * Fetches a specific session by ID from Firestore
 * @param sessionId The document ID of the session to fetch
 * @returns Session data with entries
 */
export const fetchSession = async (sessionId: string): Promise<{ entries: Payment[], projectId?: string }> => {
  try {
    console.log('Fetching session by ID:', sessionId);
    const docRef = doc(db, PAYMENTS_COLLECTION, sessionId);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      const data = docSnap.data();
      console.log('Found session with data:', data);
      
      // Convert Firebase timestamps back to Date objects in entries
      const entries = (data.entries || []).map((entry: any) => {
        // Handle date conversion from Firestore timestamp to Date
        let date = entry.date;
        if (date && typeof date.toDate === 'function') {
          date = date.toDate();
        }
        
        return {
          ...entry,
          date,
          id: entry.id || `entry-${Date.now()}-${Math.random().toString(36).substr(2, 9)}` // Ensure we have an ID
        };
      });
      
      return { 
        entries, 
        projectId: data.projectId 
      };
    }
    
    return { entries: [] };
  } catch (error) {
    console.error(`Error fetching session ${sessionId}:`, error);
    return { entries: [] };
  }
};

/**
 * Get all sessions (documents) from the payments collection
 * @param limit Maximum number of sessions to retrieve
 * @returns Array of session objects with id, date, and entry count
 */
export const fetchSessions = async (limitCount: number = 20) => {
  try {
    const sessionsRef = collection(db, PAYMENTS_COLLECTION);
    const q = query(sessionsRef, orderBy('createdAt', 'desc'), limit(limitCount));
    const querySnapshot = await getDocs(q);
    
    const sessions = [];
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      sessions.push({
        id: doc.id,
        date: data.createdAt?.toDate() || new Date(doc.id),
        entryCount: (data.entries || []).length,
        projectId: data.projectId
      });
    });
    
    return sessions;
  } catch (error) {
    console.error('Error fetching sessions:', error);
    return [];
  }
};

/**
 * Creates a new session in Firestore with current timestamp and name
 * @param sessionName Optional name for the session
 * @returns Object with new session ID and name
 */
/**
 * Updates the name of an existing session
 * @param sessionId The ID of the session to update
 * @param newName The new name for the session
 */
export const updateSessionName = async (sessionId: string, newName: string) => {
  try {
    await updateDoc(doc(db, PAYMENTS_COLLECTION, sessionId), {
      name: newName,
      updatedAt: Timestamp.now()
    });
  } catch (error) {
    console.error('Error updating session name:', error);
    throw error;
  }
};

/**
 * Creates a new session in Firestore with current timestamp and name
 * @param sessionName Optional name for the session
 * @returns Object with new session ID and name
 */
export const createNewSession = async (sessionName?: string) => {
  try {
    // Use current date as document ID (YYYY-MM-DD)
    const today = new Date().toISOString().split('T')[0];
    const sessionId = `${today}-${Math.random().toString(36).substring(2, 8)}`;
    const name = sessionName || `Session ${new Date().toLocaleString()}`;
    
    await setDoc(doc(db, PAYMENTS_COLLECTION, sessionId), {
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
      name,
      entries: []
    });
    
    return { sessionId, name };
  } catch (error) {
    console.error('Error creating new session:', error);
    throw error;
  }
};

/**
 * Fetches entries for a specific project from Firestore
 * @param projectId The project ID to fetch entries for
 * @returns Entries for the specified project
 */
export const fetchProjectEntries = async (projectId: string): Promise<Payment[]> => {
  try {
    console.log('Fetching entries for project:', projectId);
    const entriesCollectionRef = collection(db, PAYMENTS_COLLECTION);
    
    // Use simple query without composite index requirements
    // Note: we're not using the where clause with orderBy as it requires a composite index
    const q = query(entriesCollectionRef, where('projectId', '==', projectId));
    const querySnapshot = await getDocs(q);
    
    console.log('Project documents found:', querySnapshot.size);
    const projectEntries: Payment[] = [];
    
    querySnapshot.forEach((docSnapshot) => {
      try {
        const data = docSnapshot.data();
        console.log('Document data for project:', data);
        
        // Handle entries if they exist
        if (Array.isArray(data.entries)) {
          const entries = data.entries.map((entry: any) => {
            try {
              // Handle date conversion from Firestore timestamp to Date
              let date = entry.date;
              if (date && typeof date.toDate === 'function') {
                date = date.toDate();
              }
              
              return {
                ...entry,
                date,
                id: entry.id || `entry-${Date.now()}-${Math.random().toString(36).substr(2, 9)}` // Ensure we have an ID
              };
            } catch (err) {
              console.error('Error processing entry:', err, entry);
              // Return entry without date conversion if there's an error
              return {
                ...entry,
                id: entry.id || `entry-${Date.now()}-${Math.random().toString(36).substr(2, 9)}` // Ensure we have an ID
              };
            }
          });
          
          console.log(`Adding ${entries.length} entries from project document ${docSnapshot.id}`);
          projectEntries.push(...entries);
        } else {
          console.log('No entries array in project document:', docSnapshot.id);
        }
      } catch (docError) {
        console.error('Error processing project document:', docError, docSnapshot.id);
      }
    });
    
    console.log('Total project entries found:', projectEntries.length);
    return projectEntries;
  } catch (error) {
    console.error(`Error fetching entries for project ${projectId}:`, error);
    return []; // Return empty array instead of throwing
  }
};

/**
 * Fetches a project from Firestore
 * @param projectId The project ID to fetch
 * @returns The project data
 */
export const fetchProject = async (projectId: string): Promise<ProjectData | null> => {
  try {
    const docRef = doc(db, CASHFLOW_COLLECTION, projectId);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      return docSnap.data() as ProjectData;
    }
    
    return null;
  } catch (error) {
    console.error(`Error fetching project ${projectId}:`, error);
    throw error;
  }
};

/**
 * Sanitizes an object to remove undefined values (recursive)
 * @param obj The object to sanitize
 * @returns Sanitized object
 */
const sanitizeData = (obj: any): any => {
  if (obj === null || obj === undefined || typeof obj !== 'object') {
    return obj;
  }
  
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeData(item));
  }
  
  const sanitized: any = {};
  Object.keys(obj).forEach(key => {
    if (obj[key] !== undefined) {
      if (typeof obj[key] === 'object' && obj[key] !== null) {
        sanitized[key] = sanitizeData(obj[key]);
      } else {
        sanitized[key] = obj[key];
      }
    }
  });
  
  return sanitized;
};
