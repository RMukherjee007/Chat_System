import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInWithEmailAndPassword as realSignInWithEmailAndPassword,
  createUserWithEmailAndPassword as realCreateUserWithEmailAndPassword,
  updateProfile as realUpdateProfile,
  signOut as realSignOut,
  onAuthStateChanged as realOnAuthStateChanged
} from 'firebase/auth';

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "mock_api_key",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "mock_auth_domain",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "mock_project_id",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "mock_storage_bucket",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "mock_sender_id",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "mock_app_id"
};

const isMock = firebaseConfig.apiKey === 'mock_api_key';

// Initialize real Firebase
const app = initializeApp(firebaseConfig);
const realAuth = getAuth(app);

interface MockUser {
  uid: string;
  email: string;
  displayName: string;
}

const decorateUser = (user: MockUser) => {
  return {
    ...user,
    getIdToken: async () => `mock-token-${user.uid}|${encodeURIComponent(user.displayName)}`,
    emailVerified: true,
  } as any;
};

class MockAuth {
  private _currentUser: MockUser | null = null;
  private listeners: ((user: any) => void)[] = [];

  constructor() {
    const savedSession = localStorage.getItem('mock_user_session');
    if (savedSession) {
      try {
        this._currentUser = JSON.parse(savedSession);
      } catch (e) {
        this._currentUser = null;
      }
    }
  }

  get currentUser() {
    return this._currentUser ? decorateUser(this._currentUser) : null;
  }

  setCurrentUser(user: MockUser | null) {
    this._currentUser = user;
    if (user) {
      localStorage.setItem('mock_user_session', JSON.stringify(user));
    } else {
      localStorage.removeItem('mock_user_session');
    }
    this.notify();
  }

  onAuthStateChanged(callback: (user: any) => void) {
    this.listeners.push(callback);
    callback(this.currentUser);
    return () => {
      this.listeners = this.listeners.filter(l => l !== callback);
    };
  }

  notify() {
    this.listeners.forEach(l => l(this.currentUser));
  }
}

const mockAuthInstance = new MockAuth();

export const auth = isMock ? (mockAuthInstance as any) : realAuth;

export const signInWithEmailAndPassword = async (authInstance: any, email: string, password: string) => {
  if (isMock) {
    const usersStr = localStorage.getItem('mock_users') || '[]';
    const users: MockUser[] = JSON.parse(usersStr);
    const user = users.find(u => u.email === email);
    if (!user) {
      throw new Error('Firebase: Error (auth/user-not-found).');
    }
    mockAuthInstance.setCurrentUser(user);
    return { user: decorateUser(user) };
  }
  return realSignInWithEmailAndPassword(authInstance, email, password);
};

export const createUserWithEmailAndPassword = async (authInstance: any, email: string, password: string) => {
  if (isMock) {
    const usersStr = localStorage.getItem('mock_users') || '[]';
    const users: MockUser[] = JSON.parse(usersStr);
    if (users.find(u => u.email === email)) {
      throw new Error('Firebase: Error (auth/email-already-in-use).');
    }
    const newUser: MockUser = {
      uid: 'mockuid' + Math.random().toString(36).substring(2, 9),
      email,
      displayName: email.split('@')[0]
    };
    users.push(newUser);
    localStorage.setItem('mock_users', JSON.stringify(users));
    mockAuthInstance.setCurrentUser(newUser);
    return { user: decorateUser(newUser) };
  }
  return realCreateUserWithEmailAndPassword(authInstance, email, password);
};

export const updateProfile = async (user: any, profile: { displayName?: string }) => {
  if (isMock) {
    const usersStr = localStorage.getItem('mock_users') || '[]';
    let users: MockUser[] = JSON.parse(usersStr);
    users = users.map(u => u.uid === user.uid ? { ...u, displayName: profile.displayName || u.displayName } : u);
    localStorage.setItem('mock_users', JSON.stringify(users));
    
    if (mockAuthInstance.currentUser && mockAuthInstance.currentUser.uid === user.uid) {
      const updatedUser = { ...mockAuthInstance.currentUser, displayName: profile.displayName || mockAuthInstance.currentUser.displayName };
      mockAuthInstance.setCurrentUser(updatedUser);
    }
    return;
  }
  return realUpdateProfile(user, profile);
};

export const signOut = async (authInstance: any) => {
  if (isMock) {
    mockAuthInstance.setCurrentUser(null);
    return;
  }
  return realSignOut(authInstance);
};

export const onAuthStateChanged = (authInstance: any, callback: any) => {
  if (isMock) {
    return mockAuthInstance.onAuthStateChanged((user) => {
      callback(user ? decorateUser(user) : null);
    });
  }
  return realOnAuthStateChanged(authInstance, callback);
};

