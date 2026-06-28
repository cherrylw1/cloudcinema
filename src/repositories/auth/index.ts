export interface User {
  id: string;
  email: string;
  createdAt: string;
  displayName?: string | null;
  avatarUrl?: string | null;
}

export interface Session {
  user: User;
  accessToken: string;
}

export interface AuthRepository {
  getCurrentUser(): Promise<User | null>;
  getSession(): Promise<Session | null>;
  signIn(email: string, password: string): Promise<Session>;
  signUp(email: string, password: string): Promise<User>;
  signOut(): Promise<void>;
}
