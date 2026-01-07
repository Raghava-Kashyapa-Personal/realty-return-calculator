export interface AppUser {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  isAdmin: boolean;
  createdAt: Date;
  lastLoginAt: Date;
}

export interface ProjectAccessInfo {
  sharedWith: string[];  // Array of user UIDs with access
  ownerId: string;
  ownerEmail: string;
  ownerName?: string;
}
