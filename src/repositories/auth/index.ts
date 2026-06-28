export interface User {
  id: string;
  email: string;
  createdAt: string;
  displayName?: string | null;
  avatarUrl?: string | null;
  isApproved: boolean;
}

export interface Session {
  user: User;
  accessToken: string;
}

export interface AuthRepository {
  getCurrentUser(): Promise<User | null>;
  getSession(): Promise<Session | null>;
  signInWithGoogle(): Promise<void>;
  signOut(): Promise<void>;
}
