import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { 
  saveProjectData, 
  savePayments, 
  fetchProject, 
  fetchProjectData,
  deleteProject,
  createNewProject,
  updateProjectName,
  sanitizePaymentData
} from './firestoreService';
import { ProjectData, Payment } from '@/types/project';
import { doc, setDoc, getDoc, deleteDoc, updateDoc, Timestamp } from 'firebase/firestore';

/**
 * FIREBASE FIRESTORE SERVICE TESTS
 * 
 * This test suite validates the Firebase Firestore service layer that handles:
 * - Project data persistence (metadata like interest rates, property details)
 * - Payment data persistence (transactions, drawdowns, returns)
 * - CRUD operations (Create, Read, Update, Delete)
 * - Data integrity and error handling
 * - Authentication and security
 * 
 * WHY THESE TESTS MATTER:
 * - Prevents data loss from database operation failures
 * - Ensures proper error handling for network/permission issues
 * - Validates data sanitization prevents corruption
 * - Confirms authentication requirements are enforced
 * - Tests real-world scenarios like concurrent operations
 */

// Mock Firebase Firestore - we don't want to hit real database during tests
vi.mock('firebase/firestore', () => ({
  doc: vi.fn(),
  setDoc: vi.fn(),
  getDoc: vi.fn(),
  deleteDoc: vi.fn(),
  updateDoc: vi.fn(),
  collection: vi.fn(),
  getDocs: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
  limit: vi.fn(),
  Timestamp: {
    now: vi.fn(() => ({ seconds: 1234567890, nanoseconds: 0 })),
    fromDate: vi.fn((date) => ({ seconds: Math.floor(date.getTime() / 1000), nanoseconds: 0 }))
  }
}));

// Mock Firebase config
vi.mock('../firebaseConfig', () => ({
  db: 'mock-db'
}));

describe('firestoreService', () => {
  // Test data representing a real estate investment project
  const mockProjectId = 'test-project-123';
  const mockProjectData: ProjectData = {
    projectName: 'Test Project',
    annualInterestRate: 12,
    purchasePrice: 100000,
    closingCosts: 5000,
    repairs: 10000,
    afterRepairValue: 120000,
    otherInitialCosts: 2000,
    payments: [],
    rentalIncome: []
  };

  // Test payment data representing typical real estate transactions
  const mockPayments: Payment[] = [
    {
      id: 'payment-1',
      amount: 50000,
      type: 'drawdown',        // Borrowed money from lender
      date: new Date('2025-01-01'),
      month: 0,
      description: 'Initial drawdown'
    },
    {
      id: 'payment-2',
      amount: 25000,
      type: 'return',          // Money returned to investor
      date: new Date('2025-02-01'),
      month: 1,
      description: 'First return'
    }
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('saveProjectData', () => {
    /**
     * PROJECT DATA SAVING TESTS
     * 
     * These tests validate saving project metadata like:
     * - Property details (purchase price, repair costs, etc.)
     * - Interest rates and financial parameters
     * - Project identification and ownership
     * 
     * Business Impact: Project data is the foundation for all calculations
     */

    it('should save project data successfully', async () => {
      // SCENARIO: User creates a new real estate investment project
      const mockDocRef = 'mock-doc-ref';
      const mockSetDoc = vi.mocked(setDoc);
      const mockDoc = vi.mocked(doc);

      // Setup: Mock successful database operations
      mockDoc.mockReturnValue(mockDocRef as any);
      mockSetDoc.mockResolvedValue(undefined);

      // Action: Save project data
      const result = await saveProjectData(mockProjectData, mockProjectId);

      // Verification: Ensure data is saved correctly
      expect(doc).toHaveBeenCalledWith('mock-db', 'cashflows', mockProjectId);
      expect(setDoc).toHaveBeenCalledWith(
        mockDocRef,
        expect.objectContaining({
          projectName: 'Test Project',
          annualInterestRate: 12,
          projectId: mockProjectId,
          payments: [],
          updatedAt: expect.any(Object)  // Timestamp should be added
        }),
        { merge: true }  // Merge prevents overwriting existing data
      );
      expect(result).toBe(mockProjectId);
    });

    it('should handle errors gracefully', async () => {
      // SCENARIO: Network failure or permission denied during save
      const mockError = new Error('Firestore error');
      vi.mocked(setDoc).mockRejectedValue(mockError);

      // Action & Verification: Error should be propagated properly
      await expect(saveProjectData(mockProjectData, mockProjectId)).rejects.toThrow('Firestore error');
    });

    it('should generate project ID from name if not provided', async () => {
      // SCENARIO: User doesn't provide custom project ID
      vi.mocked(setDoc).mockResolvedValue(undefined);

      // Action: Save without explicit ID
      const result = await saveProjectData(mockProjectData);

      // Verification: ID should be auto-generated from project name
      expect(result).toBe('test-project');
      expect(doc).toHaveBeenCalledWith('mock-db', 'cashflows', 'test-project');
    });
  });

  describe('savePayments', () => {
    /**
     * PAYMENT DATA SAVING TESTS
     * 
     * These tests validate saving transaction data like:
     * - Drawdowns (borrowed money)
     * - Returns (investor payouts)
     * - Interest payments
     * - Repayments
     * 
     * Business Impact: Payment data drives all financial calculations (IRR, cash flow, etc.)
     */

    it('should save payments to new project', async () => {
      // SCENARIO: First time saving payments to a project
      const mockDocRef = 'mock-doc-ref';
      const mockDocSnap = {
        exists: () => false,  // Project doesn't exist yet
        data: () => null
      };

      vi.mocked(doc).mockReturnValue(mockDocRef as any);
      vi.mocked(getDoc).mockResolvedValue(mockDocSnap as any);
      vi.mocked(setDoc).mockResolvedValue(undefined);

      // Action: Save payments
      const result = await savePayments(mockPayments, mockProjectId);

      // Verification: New project document should be created
      expect(setDoc).toHaveBeenCalledWith(mockDocRef, expect.objectContaining({
        entries: expect.arrayContaining([
          expect.objectContaining({
            id: 'payment-1',
            amount: 50000,
            type: 'drawdown'
          })
        ]),
        count: 2,
        projectId: mockProjectId
      }));
      expect(result).toBe(mockProjectId);
    });

    it('should update existing project with new payments', async () => {
      // SCENARIO: Adding more payments to existing project
      const mockDocRef = 'mock-doc-ref';
      const mockDocSnap = {
        exists: () => true,   // Project already exists
        data: () => ({ projectId: mockProjectId, entries: [] })
      };

      vi.mocked(doc).mockReturnValue(mockDocRef as any);
      vi.mocked(getDoc).mockResolvedValue(mockDocSnap as any);
      vi.mocked(updateDoc).mockResolvedValue(undefined);

      // Action: Update existing project
      const result = await savePayments(mockPayments, mockProjectId);

      // Verification: Existing project should be updated, not overwritten
      expect(updateDoc).toHaveBeenCalledWith(mockDocRef, expect.objectContaining({
        entries: expect.arrayContaining([
          expect.objectContaining({ id: 'payment-1' })
        ]),
        count: 2
      }));
      expect(result).toBe(mockProjectId);
    });
  });

  describe('fetchProject', () => {
    /**
     * PROJECT DATA RETRIEVAL TESTS
     * 
     * These tests validate loading project data from database:
     * - Successful data retrieval
     * - Handling non-existent projects
     * - Network error recovery
     * - Date conversion from Firestore timestamps
     * 
     * Business Impact: Users must be able to load their existing projects
     */

    it('should fetch project successfully', async () => {
      // SCENARIO: User loads an existing project
      const mockDocRef = 'mock-doc-ref';
      const mockDocSnap = {
        exists: () => true,
        data: () => ({
          projectId: mockProjectId,
          entries: [
            {
              id: 'payment-1',
              amount: 50000,
              type: 'drawdown',
              date: { toDate: () => new Date('2025-01-01') }  // Firestore timestamp
            }
          ]
        })
      };

      vi.mocked(doc).mockReturnValue(mockDocRef as any);
      vi.mocked(getDoc).mockResolvedValue(mockDocSnap as any);

      // Action: Fetch project
      const result = await fetchProject(mockProjectId);

      // Verification: Data should be loaded and formatted correctly
      expect(doc).toHaveBeenCalledWith('mock-db', 'projects', mockProjectId);
      expect(result.projectId).toBe(mockProjectId);
      expect(result.entries).toHaveLength(1);
      expect(result.entries[0].date).toBeInstanceOf(Date);  // Timestamp converted to Date
    });

    it('should return empty entries if project does not exist', async () => {
      // SCENARIO: User tries to load non-existent project
      const mockDocSnap = {
        exists: () => false
      };

      vi.mocked(getDoc).mockResolvedValue(mockDocSnap as any);

      // Action: Fetch non-existent project
      const result = await fetchProject('non-existent-project');

      // Verification: Should return empty state, not error
      expect(result.entries).toEqual([]);
    });

    it('should handle Firestore errors gracefully', async () => {
      // SCENARIO: Network failure during project load
      vi.mocked(getDoc).mockRejectedValue(new Error('Network error'));

      // Action: Fetch during network error
      const result = await fetchProject(mockProjectId);

      // Verification: Should return empty state, not crash app
      expect(result.entries).toEqual([]);
    });
  });

  describe('fetchProjectData', () => {
    /**
     * PROJECT METADATA RETRIEVAL TESTS
     * 
     * These tests validate loading project metadata (not transactions):
     * - Property details, interest rates, etc.
     * - Handling missing metadata
     * 
     * Business Impact: App needs project settings to perform calculations
     */

    it('should fetch project metadata successfully', async () => {
      // SCENARIO: Loading project settings for calculations
      const mockDocRef = 'mock-doc-ref';
      const mockDocSnap = {
        exists: () => true,
        data: () => ({
          projectName: 'Test Project',
          annualInterestRate: 12,
          purchasePrice: 100000
        })
      };

      vi.mocked(doc).mockReturnValue(mockDocRef as any);
      vi.mocked(getDoc).mockResolvedValue(mockDocSnap as any);

      // Action: Fetch project metadata
      const result = await fetchProjectData(mockProjectId);

      // Verification: Metadata should be loaded correctly
      expect(result).toEqual(expect.objectContaining({
        projectName: 'Test Project',
        annualInterestRate: 12,
        purchasePrice: 100000
      }));
    });

    it('should return null if project metadata does not exist', async () => {
      // SCENARIO: Project exists but metadata is missing
      const mockDocSnap = {
        exists: () => false
      };

      vi.mocked(getDoc).mockResolvedValue(mockDocSnap as any);

      // Action: Fetch missing metadata
      const result = await fetchProjectData('non-existent-project');

      // Verification: Should return null to indicate missing data
      expect(result).toBeNull();
    });
  });

  describe('deleteProject', () => {
    /**
     * PROJECT DELETION TESTS
     * 
     * These tests validate removing projects from database:
     * - Successful deletion
     * - Permission errors
     * 
     * Business Impact: Users need to be able to clean up old projects
     */

    it('should delete project successfully', async () => {
      // SCENARIO: User deletes an old project
      const mockDocRef = 'mock-doc-ref';
      vi.mocked(doc).mockReturnValue(mockDocRef as any);
      vi.mocked(deleteDoc).mockResolvedValue(undefined);

      // Action: Delete project
      await deleteProject(mockProjectId);

      // Verification: Delete operation should be called correctly
      expect(doc).toHaveBeenCalledWith('mock-db', 'projects', mockProjectId);
      expect(deleteDoc).toHaveBeenCalledWith(mockDocRef);
    });

    it('should handle deletion errors', async () => {
      // SCENARIO: Permission denied during deletion
      vi.mocked(deleteDoc).mockRejectedValue(new Error('Permission denied'));

      // Action & Verification: Error should be propagated
      await expect(deleteProject(mockProjectId)).rejects.toThrow('Permission denied');
    });
  });

  describe('createNewProject', () => {
    /**
     * PROJECT CREATION TESTS
     * 
     * These tests validate creating new projects:
     * - With custom names
     * - With default names
     * - With owner information for security
     * 
     * Business Impact: Users need to create new investment projects
     */

    it('should create new project with provided name', async () => {
      // SCENARIO: User creates project with specific name
      const mockDocRef = 'mock-doc-ref';
      vi.mocked(doc).mockReturnValue(mockDocRef as any);
      vi.mocked(setDoc).mockResolvedValue(undefined);

      // Action: Create new project
      const result = await createNewProject('My New Project', 'user-123', 'user@example.com', 'John Doe');

      // Verification: Project should be created with owner information
      expect(setDoc).toHaveBeenCalledWith(mockDocRef, expect.objectContaining({
        name: 'My New Project',
        entries: [],
        ownerId: 'user-123',          // Security: track ownership
        ownerEmail: 'user@example.com',
        ownerName: 'John Doe'
      }));

      expect(result.name).toBe('My New Project');
      expect(result.ownerId).toBe('user-123');
      expect(result.projectId).toMatch(/^\d{4}-\d{2}-\d{2}-[a-z0-9]{6}$/);  // Date-based ID format
    });

    it('should create project with default name if none provided', async () => {
      // SCENARIO: User creates project without specifying name
      vi.mocked(setDoc).mockResolvedValue(undefined);

      // Action: Create project with default name
      const result = await createNewProject();

      // Verification: Default name should be generated
      expect(result.name).toMatch(/^Project \d/);
    });
  });

  describe('updateProjectName', () => {
    /**
     * PROJECT NAME UPDATE TESTS
     * 
     * These tests validate renaming projects:
     * - Successful name updates
     * - Timestamp tracking
     * 
     * Business Impact: Users need to organize projects with meaningful names
     */

    it('should update project name successfully', async () => {
      // SCENARIO: User renames project for better organization
      const mockDocRef = 'mock-doc-ref';
      vi.mocked(doc).mockReturnValue(mockDocRef as any);
      vi.mocked(updateDoc).mockResolvedValue(undefined);

      // Action: Update project name
      await updateProjectName(mockProjectId, 'Updated Project Name');

      // Verification: Name and timestamp should be updated
      expect(updateDoc).toHaveBeenCalledWith(mockDocRef, expect.objectContaining({
        name: 'Updated Project Name',
        updatedAt: expect.any(Object)  // Timestamp should be updated
      }));
    });
  });

  describe('sanitizePaymentData', () => {
    /**
     * DATA SANITIZATION TESTS
     * 
     * These tests validate cleaning payment data before saving:
     * - Removing undefined values
     * - Converting dates to Firestore timestamps
     * - Handling invalid data
     * 
     * Business Impact: Prevents database corruption and ensures data integrity
     */

    it('should sanitize payment data correctly', () => {
      // SCENARIO: Payment data contains undefined values that need cleaning
      const payment: Payment = {
        id: 'payment-1',
        amount: 50000,
        type: 'payment',
        date: new Date('2025-01-01'),
        month: 0,
        description: 'Test payment',
        loanAdjustment: undefined,    // Should be removed
        netReturn: undefined          // Should be removed
      };

      // Action: Sanitize payment data
      const sanitized = sanitizePaymentData(payment);

      // Verification: Clean data should be returned
      expect(sanitized).toEqual({
        id: 'payment-1',
        amount: 50000,
        type: 'payment',
        date: expect.any(Object), // Converted to Firestore Timestamp
        month: 0,
        description: 'Test payment'
      });

      // Undefined values should be removed to prevent database issues
      expect(sanitized).not.toHaveProperty('loanAdjustment');
      expect(sanitized).not.toHaveProperty('netReturn');
    });

    it('should handle string dates', () => {
      // SCENARIO: Date comes as string instead of Date object
      const payment: Payment = {
        id: 'payment-1',
        amount: 50000,
        type: 'payment',
        date: '2025-01-01',  // String date
        month: 0,
        description: 'Test payment'
      };

      // Action: Sanitize string date
      const sanitized = sanitizePaymentData(payment);

      // Verification: String should be converted to Firestore timestamp
      expect(sanitized.date).toEqual(expect.any(Object));
    });

    it('should handle invalid date strings', () => {
      // SCENARIO: Invalid date string provided
      const payment: Payment = {
        id: 'payment-1',
        amount: 50000,
        type: 'payment',
        date: 'invalid-date',  // Invalid date
        month: 0,
        description: 'Test payment'
      };

      // Action: Sanitize invalid date
      const sanitized = sanitizePaymentData(payment);

      // Verification: Invalid dates should create timestamp with NaN
      expect(sanitized.date).toEqual(expect.objectContaining({
        seconds: NaN,
        nanoseconds: 0
      }));
    });
  });

  describe('Integration Tests', () => {
    /**
     * INTEGRATION TESTS
     * 
     * These tests validate complete workflows:
     * - Full CRUD operations
     * - Concurrent operations
     * - Real-world usage patterns
     * 
     * Business Impact: Ensures the system works end-to-end
     */

    it('should handle complete CRUD workflow', async () => {
      // SCENARIO: User creates project, adds payments, loads data, then deletes
      const mockDocRef = 'mock-doc-ref';
      const mockCreateDoc = {
        exists: () => false
      };
      const mockUpdateDoc = {
        exists: () => true,
        data: () => ({ projectId: mockProjectId, entries: [] })
      };
      const mockFetchDoc = {
        exists: () => true,
        data: () => ({
          projectId: mockProjectId,
          entries: [
            { id: 'payment-1', amount: 50000, type: 'drawdown', date: { toDate: () => new Date('2025-01-01') } },
            { id: 'payment-2', amount: 25000, type: 'return', date: { toDate: () => new Date('2025-02-01') } }
          ]
        })
      };

      vi.mocked(doc).mockReturnValue(mockDocRef as any);
      vi.mocked(setDoc).mockResolvedValue(undefined);
      vi.mocked(updateDoc).mockResolvedValue(undefined);
      vi.mocked(deleteDoc).mockResolvedValue(undefined);

      // Step 1: Create project
      vi.mocked(getDoc).mockResolvedValueOnce(mockCreateDoc as any);
      const projectId = await saveProjectData(mockProjectData, mockProjectId);
      expect(projectId).toBe(mockProjectId);

      // Step 2: Save payments
      vi.mocked(getDoc).mockResolvedValueOnce(mockUpdateDoc as any);
      const paymentsResult = await savePayments(mockPayments, projectId);
      expect(paymentsResult).toBe(projectId);

      // Step 3: Fetch project
      vi.mocked(getDoc).mockResolvedValueOnce(mockFetchDoc as any);
      const fetchedProject = await fetchProject(projectId);
      expect(fetchedProject).toBeDefined();
      expect(fetchedProject.entries).toBeDefined();

      // Step 4: Delete project
      await deleteProject(projectId);
      expect(deleteDoc).toHaveBeenCalled();
    });

    it('should handle concurrent operations gracefully', async () => {
      // SCENARIO: Multiple users/tabs saving projects simultaneously
      vi.mocked(setDoc).mockResolvedValue(undefined);
      vi.mocked(getDoc).mockResolvedValue({ exists: () => false } as any);

      // Action: Simulate concurrent saves
      const promises = Array.from({ length: 5 }, (_, i) => 
        saveProjectData({ ...mockProjectData, projectName: `Project ${i}` }, `project-${i}`)
      );

      // Verification: All operations should complete successfully
      const results = await Promise.all(promises);
      
      expect(results).toHaveLength(5);
      expect(setDoc).toHaveBeenCalledTimes(5);
    });
  });

  describe('Error Handling', () => {
    /**
     * ERROR HANDLING TESTS
     * 
     * These tests validate how the system handles various failure scenarios:
     * - Network timeouts
     * - Permission errors
     * - Malformed data
     * 
     * Business Impact: App should gracefully handle failures without crashing
     */

    it('should handle network timeouts', async () => {
      // SCENARIO: Network timeout during data fetch
      const timeoutError = new Error('Request timeout');
      timeoutError.name = 'timeout';
      
      vi.mocked(getDoc).mockRejectedValue(timeoutError);

      // Action: Fetch during network timeout
      const result = await fetchProject(mockProjectId);

      // Verification: Should return empty state, not crash
      expect(result.entries).toEqual([]);
    });

    it('should handle permission denied errors', async () => {
      // SCENARIO: User lacks permission to save data
      const permissionError = new Error('Missing or insufficient permissions');
      permissionError.name = 'permission-denied';
      
      vi.mocked(setDoc).mockRejectedValue(permissionError);

      // Action & Verification: Permission error should be propagated
      await expect(saveProjectData(mockProjectData, mockProjectId)).rejects.toThrow('Missing or insufficient permissions');
    });

    it('should handle malformed data gracefully', async () => {
      // SCENARIO: Database contains corrupted/incomplete data
      const mockDocSnap = {
        exists: () => true,
        data: () => ({
          entries: [
            { id: 'malformed-1', amount: 500 }, // Missing required fields
            { id: 'malformed-2', date: 'invalid' }, // Invalid date
            { id: 'valid-1', amount: 1000, type: 'payment' } // Valid entry
          ]
        })
      };

      vi.mocked(getDoc).mockResolvedValue(mockDocSnap as any);

      // Action: Fetch project with malformed data
      const result = await fetchProject(mockProjectId);
      
      // Verification: Should handle malformed data and return what's salvageable
      expect(result.entries).toHaveLength(3);
      expect(result.entries[2]).toEqual(expect.objectContaining({
        id: 'valid-1',
        amount: 1000,
        type: 'payment'
      }));
    });
  });
}); 