/**
 * FlowState Auth Storage
 * 
 * Encrypted local storage for OAuth tokens and credentials.
 * Uses AES-256-GCM encryption.
 */

import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import crypto from 'crypto';

const FLOWSTATE_DIR = path.join(os.homedir(), '.flowstate');
const AUTH_FILE = path.join(FLOWSTATE_DIR, 'auth.json');
const KEY_FILE = path.join(FLOWSTATE_DIR, 'master.key');
const ALGORITHM = 'aes-256-gcm';

export interface AuthToken {
  service: string;
  accessToken: string;
  refreshToken?: string;
  expiresAt?: Date;
  scopes: string[];
}

export interface AuthStatus {
  service: string;
  connected: boolean;
  lastRefresh?: Date;
  error?: string;
}

interface EncryptedData {
  iv: string;
  authTag: string;
  content: string;
}

export class AuthStore {
  private masterKey: Buffer | null = null;
  private initialized = false;

  constructor() {}

  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      await fs.mkdir(FLOWSTATE_DIR, { recursive: true });
      this.masterKey = await this.loadOrGenerateKey();
      this.initialized = true;
      console.log(`[Auth] Initialized at ${FLOWSTATE_DIR}`);
    } catch (error) {
      console.error('[Auth] Failed to initialize:', error);
      throw error;
    }
  }

  private async loadOrGenerateKey(): Promise<Buffer> {
    try {
      const keyHex = await fs.readFile(KEY_FILE, 'utf8');
      return Buffer.from(keyHex.trim(), 'hex');
    } catch (error) {
      // Generate new key
      const key = crypto.randomBytes(32);
      // Set restrictive permissions (600) for key file
      await fs.writeFile(KEY_FILE, key.toString('hex'), { mode: 0o600 });
      return key;
    }
  }

  private encrypt(text: string): EncryptedData {
    if (!this.masterKey) throw new Error('AuthStore not initialized');

    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(ALGORITHM, this.masterKey, iv);
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();

    return {
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex'),
      content: encrypted
    };
  }

  private decrypt(data: EncryptedData): string {
    if (!this.masterKey) throw new Error('AuthStore not initialized');

    const decipher = crypto.createDecipheriv(
      ALGORITHM, 
      this.masterKey, 
      Buffer.from(data.iv, 'hex')
    );
    
    decipher.setAuthTag(Buffer.from(data.authTag, 'hex'));

    let decrypted = decipher.update(data.content, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }

  private async loadTokens(): Promise<Record<string, AuthToken>> {
    try {
      const fileContent = await fs.readFile(AUTH_FILE, 'utf8');
      const encryptedData: EncryptedData = JSON.parse(fileContent);
      const jsonStr = this.decrypt(encryptedData);
      const tokens = JSON.parse(jsonStr);
      
      // Revive dates
      Object.values(tokens).forEach((t: any) => {
        if (t.expiresAt) t.expiresAt = new Date(t.expiresAt);
      });
      
      return tokens;
    } catch (error: any) {
      if (error.code === 'ENOENT') return {};
      // If decryption fails or file is corrupt, return empty but log error
      console.error('[Auth] Error loading tokens:', error.message);
      return {};
    }
  }

  private async saveTokens(tokens: Record<string, AuthToken>): Promise<void> {
    const jsonStr = JSON.stringify(tokens);
    const encryptedData = this.encrypt(jsonStr);
    await fs.writeFile(AUTH_FILE, JSON.stringify(encryptedData, null, 2), { mode: 0o600 });
  }

  async storeToken(token: AuthToken): Promise<void> {
    await this.initialize();
    const tokens = await this.loadTokens();
    tokens[token.service] = token;
    await this.saveTokens(tokens);
    console.log(`[Auth] Stored token for ${token.service}`);
  }

  async getToken(service: string): Promise<AuthToken | null> {
    await this.initialize();
    const tokens = await this.loadTokens();
    const token = tokens[service];
    
    if (!token) return null;

    // Check if expired and refresh if possible (TODO)
    // For now just return the token
    return token;
  }

  async removeToken(service: string): Promise<void> {
    await this.initialize();
    const tokens = await this.loadTokens();
    if (tokens[service]) {
      delete tokens[service];
      await this.saveTokens(tokens);
      console.log(`[Auth] Removed token for ${service}`);
    }
  }

  async getStatus(service: string): Promise<AuthStatus> {
    const token = await this.getToken(service);
    return {
      service,
      connected: !!token,
      lastRefresh: token?.expiresAt, // This might be expiration, not last refresh.
      // Refined: usually we want to know when it expires.
    };
  }

  async listConnectedServices(): Promise<string[]> {
    await this.initialize();
    const tokens = await this.loadTokens();
    return Object.keys(tokens);
  }
}

export const auth = new AuthStore();
