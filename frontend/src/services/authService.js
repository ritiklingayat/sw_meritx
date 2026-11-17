import { storageService, STORAGE_KEYS } from './storageService';

const SESSION_USER_KEY = 'meritx_user';
const SESSION_TOKEN_KEY = 'meritx_token';

class AuthService {
  async login(email, password) {
    const users = storageService.getCollection(STORAGE_KEYS.USERS);
    const cleanEmail = String(email || '').trim().toLowerCase();
    const cleanPass = String(password || '').trim();

    const user = users.find(
      (u) => u.email.toLowerCase() === cleanEmail && (!cleanPass || u.password === cleanPass)
    );

    if (!user) {
      throw new Error('Invalid email or password. Please verify your credentials or use demo accounts.');
    }

    const token = `demo-token-${user.id}-${Date.now()}`;
    const safeUser = { ...user };
    delete safeUser.password;

    sessionStorage.setItem(SESSION_TOKEN_KEY, token);
    sessionStorage.setItem(SESSION_USER_KEY, JSON.stringify(safeUser));

    return { user: safeUser, token };
  }

  async googleLogin(credential, target = 'JEE Main') {
    const users = storageService.getCollection(STORAGE_KEYS.USERS);
    // Find or create student
    let user = users.find((u) => u.role === 'student');
    if (!user) {
      user = storageService.insert(STORAGE_KEYS.USERS, {
        name: 'Google Candidate',
        email: 'google.student@meritx.demo',
        role: 'student',
        target,
        city: 'Delhi',
        year: '2027'
      });
    }

    const token = `demo-google-token-${user.id}`;
    const safeUser = { ...user };
    delete safeUser.password;

    sessionStorage.setItem(SESSION_TOKEN_KEY, token);
    sessionStorage.setItem(SESSION_USER_KEY, JSON.stringify(safeUser));

    return { user: safeUser, token };
  }

  async register({ name, email, password, target = 'JEE Main', role = 'student', city = 'Pune', year = '2027' }) {
    const users = storageService.getCollection(STORAGE_KEYS.USERS);
    const cleanEmail = String(email || '').trim().toLowerCase();

    if (users.some((u) => u.email.toLowerCase() === cleanEmail)) {
      throw new Error('An account with this email address already exists.');
    }

    const newUser = storageService.insert(STORAGE_KEYS.USERS, {
      name: name.trim(),
      email: cleanEmail,
      password: password || 'Student@123',
      role,
      target,
      city,
      academic_year: year,
      createdAt: new Date().toISOString()
    });

    const safeUser = { ...newUser };
    delete safeUser.password;
    return safeUser;
  }

  getCurrentUser() {
    try {
      const stored = sessionStorage.getItem(SESSION_USER_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  }

  getToken() {
    return sessionStorage.getItem(SESSION_TOKEN_KEY) || '';
  }

  logout() {
    sessionStorage.removeItem(SESSION_USER_KEY);
    sessionStorage.removeItem(SESSION_TOKEN_KEY);
  }

  // Demo shortcut to switch profiles seamlessly
  async switchDemoRole(role = 'student') {
    const users = storageService.getCollection(STORAGE_KEYS.USERS);
    const target = users.find((u) => u.role === role) || users[0];
    return this.login(target.email, target.password);
  }
}

export const authService = new AuthService();
