import { db } from '../firebaseConfig';
import { collection, doc, setDoc, getDoc, Timestamp, updateDoc, arrayUnion, getDocs, query, orderBy, limit, where, deleteDoc, or } from 'firebase/firestore';
import { Payment, ProjectData } from '@/types/project';
import { COLLECTIONS } from '@/constants/collections';

// Collection names - using constants for consistency
const CASHFLOW_COLLECTION = COLLECTIONS.CASHFLOWS;
const PAYMENTS_COLLECTION = COLLECTIONS.PROJECTS;

/**
 * Deletes a project (document) by its ID from Firestore
 * @param projectId The document ID of the project to delete
 */
export const deleteProject = async (projectId: string): Promise<void> => {
  try {
    const docRef = doc(db, PAYMENTS_COLLECTION, projectId);
    await deleteDoc(docRef);
    console.log(`Project ${projectId} deleted successfully.`);
  } catch (error) {
    console.error(`Error deleting project ${projectId}:`, error);
    throw error;
  }
};

/**
 * Saves project data to Firestore
 * @param projectData The project data to save
 * @param projectId Optional project ID to use as document ID
 * @returns The document ID
 */
export const saveProjectData = async (projectData: ProjectData, projectId?: string): Promise<string> => {
  try {
    // Use provided projectId, or derive from project name, or generate a timestamp-based ID
    const docId = projectId || (projectData.projectName 
      ? projectData.projectName.replace(/\s+/g, '-').toLowerCase() 
      : `project-${Date.now()}`);
    
    console.log(`Saving project data to project ID: ${docId}`);
    
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
 * @param projectId The project ID to use as document ID (optional)
 * @returns The document ID
 */
export const savePayments = async (payments: Payment[], projectId?: string): Promise<string> => {
  try {
    // Use provided projectId or today's date as document ID
    const docId = projectId || new Date().toISOString().split('T')[0];
    console.log(`Saving payments to project ID: ${docId}`);
    
    // Sanitize the payments to remove any undefined values
    const sanitizedPayments = payments.map(payment => sanitizePaymentData(payment));
    
    // Check if document already exists
    const docRef = doc(db, PAYMENTS_COLLECTION, docId);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      // Document exists, replace the entire entries array with the new one
      const existingData = docSnap.data();
      
      await updateDoc(docRef, {
        entries: sanitizedPayments, // Replace entire array to preserve edits
        updatedAt: Timestamp.now(),
        count: sanitizedPayments.length,
        projectId: projectId || existingData.projectId
      });
    } else {
      // Document doesn't exist, create it
      await setDoc(docRef, {
        entries: sanitizedPayments,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
        count: sanitizedPayments.length,
        projectId: projectId || docId
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
    if (!projectId) {
      throw new Error('Project ID is required to save a payment');
    }
    
    // Sanitize the payment to remove any undefined values
    const sanitizedPayment = sanitizePaymentData(payment);
    
    // Check if document already exists
    const docRef = doc(db, PAYMENTS_COLLECTION, projectId);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      // Document exists, add this payment to it if it doesn't already exist
      const existingData = docSnap.data();
      const existingEntries: Payment[] = existingData.entries || [];
      
      // Check if this payment already exists (by ID or content)
      const paymentExists = existingEntries.some(
        p => p.id === payment.id || 
             (p.month === payment.month && 
              p.amount === payment.amount && 
              p.description === payment.description)
      );
      
      if (paymentExists) {
        console.log('Payment already exists in project, skipping duplicate');
        return projectId;
      }
      
      await updateDoc(docRef, {
        entries: [...existingEntries, sanitizedPayment],
        updatedAt: Timestamp.now(),
        count: existingEntries.length + 1,
        projectId: projectId
      });
      
      console.log(`Added payment to existing project ${projectId}`);
    } else {
      // Document doesn't exist, create it with this payment
      await setDoc(docRef, {
        entries: [sanitizedPayment],
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
        count: 1,
        projectId: projectId
      });
      
      console.log(`Created new project ${projectId} with first payment`);
    }
    
    return projectId;
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
 * Fetches a specific project by ID from Firestore
 * @param projectId The document ID of the project to fetch
 * @returns Project data with entries and project name
 */
export const fetchProject = async (projectId: string): Promise<{ entries: Payment[], projectId?: string, projectName?: string }> => {
  try {
    console.log('Fetching project by ID:', projectId);
    const docRef = doc(db, PAYMENTS_COLLECTION, projectId);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      const data = docSnap.data();
      console.log('Found project with data:', data);
      
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
        projectId: data.projectId,
        projectName: data.name // Return the project name from the document
      };
    }
    
    return { entries: [] };
  } catch (error) {
    console.error(`Error fetching project ${projectId}:`, error);
    return { entries: [] };
  }
};

/**
 * Get all projects (documents) from the payments collection for a specific user
 * Includes projects owned by the user AND projects shared with the user
 * @param userId The UID of the user whose projects to fetch (empty string for all - admin)
 * @param limit Maximum number of projects to retrieve
 * @returns Array of project objects with id, date, and entry count
 */
export const fetchProjects = async (userId: string, limitCount: number = 50) => {
  try {
    const projectsRef = collection(db, PAYMENTS_COLLECTION);
    let q;

    if (userId) {
      // Fetch projects where user is owner OR user is in sharedWith array
      // Note: Firestore requires composite index for this query
      q = query(
        projectsRef,
        or(
          where('ownerId', '==', userId),
          where('sharedWith', 'array-contains', userId)
        ),
        orderBy('createdAt', 'desc'),
        limit(limitCount)
      );
    } else {
      // Admin: fetch all projects
      q = query(
        projectsRef,
        orderBy('createdAt', 'desc'),
        limit(limitCount)
      );
    }

    const querySnapshot = await getDocs(q);

    const projects: Array<{
      id: string;
      date: Date;
      entryCount: number;
      projectId: string;
      name: string;
      ownerId: string;
      ownerEmail: string;
      ownerName: string;
      sharedWith: string[];
      isSharedWithMe: boolean;
    }> = [];

    querySnapshot.forEach((docSnapshot) => {
      const data = docSnapshot.data() as any;
      projects.push({
        id: docSnapshot.id,
        date: data.createdAt?.toDate() || new Date(docSnapshot.id),
        entryCount: (data.entries || []).length,
        projectId: data.projectId,
        name: data.name || '',
        ownerId: data.ownerId || '',
        ownerEmail: data.ownerEmail || '',
        ownerName: data.ownerName || '',
        sharedWith: data.sharedWith || [],
        isSharedWithMe: userId ? data.ownerId !== userId : false,
      });
    });

    return projects;
  } catch (error) {
    console.error('Error fetching projects:', error);
    return [];
  }
};

/**
 * Updates the name of an existing project
 * @param projectId The ID of the project to update
 * @param newName The new name for the project
 */
export const updateProjectName = async (projectId: string, newName: string) => {
  try {
    await updateDoc(doc(db, PAYMENTS_COLLECTION, projectId), {
      name: newName,
      updatedAt: Timestamp.now()
    });
  } catch (error) {
    console.error('Error updating project name:', error);
    throw error;
  }
};

/**
 * Creates a new project in Firestore with current timestamp and name
 * @param projectName Optional name for the project
 * @param ownerId The UID of the user who owns the project
 * @returns Object with new project ID, name, and ownerId
 */
export const createNewProject = async (projectName?: string, ownerId?: string, ownerEmail?: string, ownerName?: string) => {
  try {
    // Use current date as document ID (YYYY-MM-DD)
    const today = new Date().toISOString().split('T')[0];
    const projectId = `${today}-${Math.random().toString(36).substring(2, 8)}`;
    const name = projectName || `Project ${new Date().toLocaleString()}`;

    await setDoc(doc(db, PAYMENTS_COLLECTION, projectId), {
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
      name,
      entries: [],
      ownerId: ownerId || null,
      ownerEmail: ownerEmail || null,
      ownerName: ownerName || null,
      sharedWith: [], // Initialize empty shared users array
    });

    return { projectId, name, ownerId, ownerEmail, ownerName };
  } catch (error) {
    console.error('Error creating new project:', error);
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
export const fetchProjectData = async (projectId: string): Promise<ProjectData | null> => {
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
  
  // Handle Date objects specifically - convert to Firestore Timestamp
  if (obj instanceof Date) {
    return Timestamp.fromDate(obj);
  }
  
  const sanitized: any = {};
  Object.keys(obj).forEach(key => {
    if (obj[key] !== undefined) {
      if (obj[key] instanceof Date) {
        // Convert Date objects to Firestore Timestamps
        sanitized[key] = Timestamp.fromDate(obj[key]);
      } else if (typeof obj[key] === 'object' && obj[key] !== null) {
        sanitized[key] = sanitizeData(obj[key]);
      } else {
        sanitized[key] = obj[key];
      }
    }
  });
  
  return sanitized;
};

export const deleteProjectData = deleteProject;
export const updateProjectData = updateProjectName;

/**
 * Saves project data and payments in a single batch operation
 * @param projectData The project data to save
 * @param payments The payments to save
 * @param projectId The project ID
 * @returns Promise that resolves when the batch is committed
 */
export const saveBatch = async (projectData: ProjectData, payments: Payment[], projectId: string): Promise<void> => {
  try {
    console.log(`Batch saving project ${projectId} with ${payments.length} payments`);
    
    // Save project metadata (if different from payments)
    await saveProjectData(projectData, projectId);
    
    // Save payments
    await savePayments(payments, projectId);
    
    console.log(`Batch save completed for project ${projectId}`);
  } catch (error) {
    console.error('Error in batch save:', error);
    throw error;
  }
};

/**
 * Checks if a project has been modified since the given timestamp
 * @param projectId The project ID to check
 * @param lastKnownUpdate The last known update timestamp
 * @returns Object with conflict status and latest data
 */
export const checkForConflicts = async (projectId: string, lastKnownUpdate: Date): Promise<{
  hasConflict: boolean;
  latestData?: { entries: Payment[], updatedAt: Date };
}> => {
  try {
    const docRef = doc(db, PAYMENTS_COLLECTION, projectId);
    const docSnap = await getDoc(docRef);
    
    if (!docSnap.exists()) {
      return { hasConflict: false };
    }
    
    const data = docSnap.data();
    const serverUpdatedAt = data.updatedAt?.toDate() || new Date(0);
    
    // Check if server version is newer than our last known update
    const hasConflict = serverUpdatedAt > lastKnownUpdate;
    
    if (hasConflict) {
      // Convert entries back to Payment objects
      const entries = (data.entries || []).map((entry: any) => {
        let date = entry.date;
        if (date && typeof date.toDate === 'function') {
          date = date.toDate();
        }
        
        return {
          ...entry,
          date,
          id: entry.id || `entry-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
        };
      });
      
      return {
        hasConflict: true,
        latestData: {
          entries,
          updatedAt: serverUpdatedAt
        }
      };
    }
    
    return { hasConflict: false };
  } catch (error) {
    console.error('Error checking for conflicts:', error);
    return { hasConflict: false };
  }
};

/**
 * Optimistic update with rollback capability
 * @param projectId The project ID
 * @param updateFn Function that performs the update
 * @param rollbackData Data to restore if update fails
 * @returns Success status and any error
 */
export const optimisticUpdate = async <T>(
  projectId: string,
  updateFn: () => Promise<T>,
  rollbackData: { projectData: ProjectData; payments: Payment[] }
): Promise<{ success: boolean; result?: T; error?: Error }> => {
  try {
    // Check for conflicts before applying update
    const lastSavedAt = new Date(); // This should come from ProjectContext
    const conflictCheck = await checkForConflicts(projectId, lastSavedAt);
    
    if (conflictCheck.hasConflict) {
      throw new Error('Project has been modified by another user. Please refresh to see the latest changes.');
    }
    
    // Perform the update
    const result = await updateFn();
    
    return { success: true, result };
  } catch (error) {
    console.error('Optimistic update failed, attempting rollback:', error);
    
    try {
      // Attempt to restore previous state
      await saveBatch(rollbackData.projectData, rollbackData.payments, projectId);
      console.log('Rollback completed successfully');
    } catch (rollbackError) {
      console.error('Rollback failed:', rollbackError);
    }
    
    return { 
      success: false, 
      error: error instanceof Error ? error : new Error(String(error))
    };
  }
};

/**
 * Bulk operation for multiple projects
 * @param operations Array of operations to perform
 * @returns Results of all operations
 */
export const bulkOperations = async (operations: Array<{
  type: 'save' | 'delete';
  projectId: string;
  data?: { projectData: ProjectData; payments: Payment[] };
}>): Promise<Array<{ projectId: string; success: boolean; error?: string }>> => {
  const results = [];

  for (const operation of operations) {
    try {
      if (operation.type === 'save' && operation.data) {
        await saveBatch(operation.data.projectData, operation.data.payments, operation.projectId);
        results.push({ projectId: operation.projectId, success: true });
      } else if (operation.type === 'delete') {
        await deleteProject(operation.projectId);
        results.push({ projectId: operation.projectId, success: true });
      }
    } catch (error) {
      results.push({
        projectId: operation.projectId,
        success: false,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  return results;
};

// ============================================
// PROJECT SHARING FUNCTIONS
// ============================================

/**
 * Fetches the sharing information for a project
 * @param projectId The project ID to fetch sharing info for
 * @returns Object with ownerId, sharedWith array, and pendingInvites
 */
export const fetchProjectSharing = async (projectId: string): Promise<{
  ownerId: string;
  ownerEmail?: string;
  sharedWith: string[];
  pendingInvites: string[];
} | null> => {
  try {
    const docRef = doc(db, PAYMENTS_COLLECTION, projectId);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      const data = docSnap.data();
      return {
        ownerId: data.ownerId || '',
        ownerEmail: data.ownerEmail,
        sharedWith: data.sharedWith || [],
        pendingInvites: data.pendingInvites || [],
      };
    }

    return null;
  } catch (error) {
    console.error(`Error fetching sharing info for project ${projectId}:`, error);
    return null;
  }
};

/**
 * Updates the sharing list for a project
 * @param projectId The project ID to update sharing for
 * @param sharedWith Array of user UIDs to share with
 */
export const updateProjectSharing = async (projectId: string, sharedWith: string[]): Promise<void> => {
  try {
    const docRef = doc(db, PAYMENTS_COLLECTION, projectId);
    await updateDoc(docRef, {
      sharedWith,
      updatedAt: Timestamp.now(),
    });
    console.log(`Updated sharing for project ${projectId} with ${sharedWith.length} users`);
  } catch (error) {
    console.error(`Error updating sharing for project ${projectId}:`, error);
    throw error;
  }
};

/**
 * Updates the sharing list and pending invites for a project
 * @param projectId The project ID to update sharing for
 * @param sharedWith Array of user UIDs to share with
 * @param pendingInvites Array of emails to invite (users who haven't signed up yet)
 */
export const updateProjectSharingWithInvites = async (
  projectId: string,
  sharedWith: string[],
  pendingInvites: string[]
): Promise<void> => {
  try {
    const docRef = doc(db, PAYMENTS_COLLECTION, projectId);
    await updateDoc(docRef, {
      sharedWith,
      pendingInvites,
      updatedAt: Timestamp.now(),
    });
    console.log(
      `Updated sharing for project ${projectId}: ${sharedWith.length} users, ${pendingInvites.length} pending invites`
    );
  } catch (error) {
    console.error(`Error updating sharing for project ${projectId}:`, error);
    throw error;
  }
};

/**
 * Adds a user to the shared list for a project
 * @param projectId The project ID
 * @param userId The user UID to add
 */
export const addUserToProject = async (projectId: string, userId: string): Promise<void> => {
  try {
    const docRef = doc(db, PAYMENTS_COLLECTION, projectId);
    await updateDoc(docRef, {
      sharedWith: arrayUnion(userId),
      updatedAt: Timestamp.now(),
    });
    console.log(`Added user ${userId} to project ${projectId}`);
  } catch (error) {
    console.error(`Error adding user to project ${projectId}:`, error);
    throw error;
  }
};

/**
 * Removes a user from the shared list for a project
 * @param projectId The project ID
 * @param userId The user UID to remove
 */
export const removeUserFromProject = async (projectId: string, userId: string): Promise<void> => {
  try {
    // First get the current sharedWith array
    const sharingInfo = await fetchProjectSharing(projectId);
    if (!sharingInfo) {
      throw new Error('Project not found');
    }

    // Filter out the user
    const updatedSharedWith = sharingInfo.sharedWith.filter((uid) => uid !== userId);

    // Update the document
    const docRef = doc(db, PAYMENTS_COLLECTION, projectId);
    await updateDoc(docRef, {
      sharedWith: updatedSharedWith,
      updatedAt: Timestamp.now(),
    });
    console.log(`Removed user ${userId} from project ${projectId}`);
  } catch (error) {
    console.error(`Error removing user from project ${projectId}:`, error);
    throw error;
  }
};

/**
 * Checks if a user has access to a project (owner or shared)
 * @param projectId The project ID
 * @param userId The user UID to check
 * @returns True if user has access
 */
export const checkProjectAccess = async (projectId: string, userId: string): Promise<boolean> => {
  try {
    const sharingInfo = await fetchProjectSharing(projectId);
    if (!sharingInfo) {
      return false;
    }

    return sharingInfo.ownerId === userId || sharingInfo.sharedWith.includes(userId);
  } catch (error) {
    console.error(`Error checking project access for ${projectId}:`, error);
    return false;
  }
};

/**
 * Processes pending invites for a user who just signed up
 * Converts any pending invites matching their email to actual sharing
 * @param userEmail The email of the user who just signed up
 * @param userId The UID of the user
 * @returns Number of projects the user was granted access to
 */
export const processPendingInvites = async (userEmail: string, userId: string): Promise<number> => {
  try {
    const email = userEmail.toLowerCase();
    const projectsRef = collection(db, PAYMENTS_COLLECTION);

    // Find all projects where this email is in pendingInvites
    const q = query(projectsRef, where('pendingInvites', 'array-contains', email));
    const snapshot = await getDocs(q);

    let grantedCount = 0;

    for (const docSnapshot of snapshot.docs) {
      const data = docSnapshot.data();
      const currentSharedWith = data.sharedWith || [];
      const currentPendingInvites = data.pendingInvites || [];

      // Add user to sharedWith if not already there
      if (!currentSharedWith.includes(userId)) {
        const updatedSharedWith = [...currentSharedWith, userId];
        const updatedPendingInvites = currentPendingInvites.filter(
          (e: string) => e.toLowerCase() !== email
        );

        await updateDoc(doc(db, PAYMENTS_COLLECTION, docSnapshot.id), {
          sharedWith: updatedSharedWith,
          pendingInvites: updatedPendingInvites,
          updatedAt: Timestamp.now(),
        });

        grantedCount++;
        console.log(`Granted access to project ${docSnapshot.id} for user ${userEmail}`);
      }
    }

    if (grantedCount > 0) {
      console.log(`Processed ${grantedCount} pending invites for ${userEmail}`);
    }

    return grantedCount;
  } catch (error) {
    console.error(`Error processing pending invites for ${userEmail}:`, error);
    return 0;
  }
};
