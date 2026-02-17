/**
 * FlowState Desktop App - Auth Manager
 *
 * Encrypted local storage for OAuth tokens and credentials.
 * Ported from @flowstate/core with Electron-specific paths.
 * Uses AES-256-GCM encryption.
 */

import { app } from 'electron';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { execFile } from 'child_process';
import { promisify } from 'util';

const ALGORITHM = 'aes-256-gcm';
const SECURITY_BIN = '/usr/bin/security';
const KEYCHAIN_ACCOUNT = 'flowstate-desktop';
const TOKENS_KEYCHAIN_SERVICE = 'com.flowstate.auth.tokens';
const CREDENTIALS_KEYCHAIN_SERVICE = 'com.flowstate.auth.credentials';
const execFileAsync = promisify(execFile);

export type AuthMethod = 'oauth' | 'api_token';

export interface AuthToken {
  service: string;
  accessToken: string;
  refreshToken?: string;
  expiresAt?: string; // ISO string for JSON serialization
  scopes: string[];
  email?: string;
  authMethod: AuthMethod;
  // Service-specific additional data (e.g., Canvas API URL)
  additionalData?: Record<string, string>;
}

export interface ClientCredentials {
  clientId: string;
  clientSecret: string;
  redirectUri?: string;
}

export interface AuthStatus {
  service: string;
  connected: boolean;
  configured: boolean;
  email?: string;
  lastRefresh?: string;
  error?: string;
  authMethod?: AuthMethod;
}

interface EncryptedData {
  iv: string;
  authTag: string;
  content: string;
}

class AuthManager {
  private dataDir: string = '';
  private authFile: string = '';
  private credentialsFile: string = '';
  private keyFile: string = '';
  private masterKey: Buffer | null = null;
  private useKeychain = false;
  private initialized = false;

  /**
   * Initialize the auth manager
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      // Use Electron's userData path
      this.dataDir = path.join(app.getPath('userData'), 'auth');
      this.authFile = path.join(this.dataDir, 'tokens.enc');
      this.credentialsFile = path.join(this.dataDir, 'credentials.enc');
      this.keyFile = path.join(this.dataDir, 'master.key');

      await fs.mkdir(this.dataDir, { recursive: true });
      this.masterKey = await this.loadOrGenerateKey();

      if (process.platform === 'darwin') {
        this.useKeychain = await this.canUseKeychain();
        if (this.useKeychain) {
          await this.migrateLegacyEncryptedDataToKeychain();
        }
      }

      this.initialized = true;
      console.log(`[Auth] Initialized at ${this.dataDir}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown error';
      console.error(`[Auth] Failed to initialize auth manager: ${message}`);
      throw error;
    }
  }

  private async canUseKeychain(): Promise<boolean> {
    try {
      await execFileAsync(SECURITY_BIN, ['list-keychains']);
      return true;
    } catch {
      console.warn('[Auth] macOS Keychain unavailable; using encrypted file storage');
      return false;
    }
  }

  private disableKeychainFallback(reason: string): void {
    if (!this.useKeychain) {
      return;
    }

    this.useKeychain = false;
    console.warn(`[Auth] ${reason}; using encrypted file storage`);
  }

  private isMissingKeychainItem(error: unknown): boolean {
    const err = error as { code?: number; stderr?: string };
    return err.code === 44 || err.stderr?.includes('could not be found') || false;
  }

  private async readKeychainValue(serviceName: string): Promise<string | null> {
    try {
      const { stdout } = await execFileAsync(SECURITY_BIN, [
        'find-generic-password',
        '-s',
        serviceName,
        '-a',
        KEYCHAIN_ACCOUNT,
        '-w',
      ]);
      return stdout.trim();
    } catch (error) {
      if (this.isMissingKeychainItem(error)) {
        return null;
      }
      throw error;
    }
  }

  private async writeKeychainValue(serviceName: string, value: string): Promise<void> {
    await execFileAsync(SECURITY_BIN, [
      'add-generic-password',
      '-U',
      '-s',
      serviceName,
      '-a',
      KEYCHAIN_ACCOUNT,
      '-w',
      value,
    ]);
  }

  private async loadOrGenerateKey(): Promise<Buffer> {
    try {
      const keyHex = await fs.readFile(this.keyFile, 'utf8');
      return Buffer.from(keyHex.trim(), 'hex');
    } catch {
      // Generate new key
      const key = crypto.randomBytes(32);
      // Set restrictive permissions (600) for key file
      await fs.writeFile(this.keyFile, key.toString('hex'), { mode: 0o600 });
      return key;
    }
  }

  private encrypt(text: string): EncryptedData {
    if (!this.masterKey) throw new Error('AuthManager not initialized');

    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(ALGORITHM, this.masterKey, iv);

    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag();

    return {
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex'),
      content: encrypted,
    };
  }

  private decrypt(data: EncryptedData): string {
    if (!this.masterKey) throw new Error('AuthManager not initialized');

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

  // --- Token Management ---

  private async loadTokensFromFile(): Promise<Record<string, AuthToken>> {
    try {
      const fileContent = await fs.readFile(this.authFile, 'utf8');
      const encryptedData: EncryptedData = JSON.parse(fileContent);
      const jsonStr = this.decrypt(encryptedData);
      return JSON.parse(jsonStr);
    } catch (error: unknown) {
      const err = error as { code?: string };
      if (err.code === 'ENOENT') return {};
      console.error('[Auth] Error loading tokens from encrypted storage');
      return {};
    }
  }

  private async saveTokensToFile(tokens: Record<string, AuthToken>): Promise<void> {
    const jsonStr = JSON.stringify(tokens);
    const encryptedData = this.encrypt(jsonStr);
    await fs.writeFile(this.authFile, JSON.stringify(encryptedData, null, 2), {
      mode: 0o600,
    });
  }

  private async loadTokensFromKeychain(): Promise<Record<string, AuthToken>> {
    const value = await this.readKeychainValue(TOKENS_KEYCHAIN_SERVICE);
    if (!value) return {};
    return JSON.parse(value) as Record<string, AuthToken>;
  }

  private async saveTokensToKeychain(tokens: Record<string, AuthToken>): Promise<void> {
    await this.writeKeychainValue(TOKENS_KEYCHAIN_SERVICE, JSON.stringify(tokens));
  }

  private async loadTokens(): Promise<Record<string, AuthToken>> {
    if (this.useKeychain) {
      try {
        return await this.loadTokensFromKeychain();
      } catch {
        this.disableKeychainFallback('Keychain token read failed');
      }
    }
    return this.loadTokensFromFile();
  }

  private async saveTokens(tokens: Record<string, AuthToken>): Promise<void> {
    if (this.useKeychain) {
      try {
        await this.saveTokensToKeychain(tokens);
        return;
      } catch {
        this.disableKeychainFallback('Keychain token write failed');
      }
    }
    await this.saveTokensToFile(tokens);
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
    return tokens[service] || null;
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

  async listConnectedServices(): Promise<string[]> {
    await this.initialize();
    const tokens = await this.loadTokens();
    return Object.keys(tokens);
  }

  // --- Credentials Management ---

  private async loadCredentialsFromFile(): Promise<Record<string, ClientCredentials>> {
    try {
      const fileContent = await fs.readFile(this.credentialsFile, 'utf8');
      const encryptedData: EncryptedData = JSON.parse(fileContent);
      const jsonStr = this.decrypt(encryptedData);
      return JSON.parse(jsonStr);
    } catch (error: unknown) {
      const err = error as { code?: string };
      if (err.code === 'ENOENT') return {};
      console.error('[Auth] Error loading credentials from encrypted storage');
      return {};
    }
  }

  private async saveCredentialsToFile(
    creds: Record<string, ClientCredentials>
  ): Promise<void> {
    const jsonStr = JSON.stringify(creds);
    const encryptedData = this.encrypt(jsonStr);
    await fs.writeFile(
      this.credentialsFile,
      JSON.stringify(encryptedData, null, 2),
      { mode: 0o600 }
    );
  }

  private async loadCredentialsFromKeychain(): Promise<Record<string, ClientCredentials>> {
    const value = await this.readKeychainValue(CREDENTIALS_KEYCHAIN_SERVICE);
    if (!value) return {};
    return JSON.parse(value) as Record<string, ClientCredentials>;
  }

  private async saveCredentialsToKeychain(
    creds: Record<string, ClientCredentials>
  ): Promise<void> {
    await this.writeKeychainValue(CREDENTIALS_KEYCHAIN_SERVICE, JSON.stringify(creds));
  }

  private async loadCredentials(): Promise<Record<string, ClientCredentials>> {
    if (this.useKeychain) {
      try {
        return await this.loadCredentialsFromKeychain();
      } catch {
        this.disableKeychainFallback('Keychain credential read failed');
      }
    }
    return this.loadCredentialsFromFile();
  }

  private async saveCredentials(
    creds: Record<string, ClientCredentials>
  ): Promise<void> {
    if (this.useKeychain) {
      try {
        await this.saveCredentialsToKeychain(creds);
        return;
      } catch {
        this.disableKeychainFallback('Keychain credential write failed');
      }
    }
    await this.saveCredentialsToFile(creds);
  }

  private async migrateLegacyEncryptedDataToKeychain(): Promise<void> {
    try {
      const [legacyTokens, legacyCredentials] = await Promise.all([
        this.loadTokensFromFile(),
        this.loadCredentialsFromFile(),
      ]);

      const hasLegacyTokens = Object.keys(legacyTokens).length > 0;
      const hasLegacyCredentials = Object.keys(legacyCredentials).length > 0;

      if (!hasLegacyTokens && !hasLegacyCredentials) {
        return;
      }

      if (hasLegacyTokens) {
        const existingTokens = await this.loadTokensFromKeychain();
        await this.saveTokensToKeychain({ ...legacyTokens, ...existingTokens });
      }

      if (hasLegacyCredentials) {
        const existingCredentials = await this.loadCredentialsFromKeychain();
        await this.saveCredentialsToKeychain({
          ...legacyCredentials,
          ...existingCredentials,
        });
      }

      console.log('[Auth] Migrated legacy encrypted auth data to macOS Keychain');
    } catch {
      console.warn('[Auth] Legacy auth migration skipped; encrypted fallback remains available');
    }
  }

  async storeClientCredentials(
    service: string,
    config: ClientCredentials
  ): Promise<void> {
    await this.initialize();
    const creds = await this.loadCredentials();
    creds[service] = config;
    await this.saveCredentials(creds);
    console.log(`[Auth] Stored credentials for ${service}`);
  }

  async getClientCredentials(service: string): Promise<ClientCredentials | null> {
    await this.initialize();
    const creds = await this.loadCredentials();
    return creds[service] || null;
  }

  async removeClientCredentials(service: string): Promise<void> {
    await this.initialize();
    const creds = await this.loadCredentials();
    if (creds[service]) {
      delete creds[service];
      await this.saveCredentials(creds);
      console.log(`[Auth] Removed credentials for ${service}`);
    }
  }

  // --- Status ---

  async getStatus(service: string): Promise<AuthStatus> {
    const token = await this.getToken(service);
    const creds = await this.getClientCredentials(service);
    return {
      service,
      connected: !!token,
      configured: !!creds,
      email: token?.email,
      lastRefresh: token?.expiresAt,
      authMethod: token?.authMethod,
    };
  }

/**
    * Store an API token directly (for services like Notion Internal Integration, Canvas LMS)
    * Supports additional metadata like Canvas API URL
    */
  async storeApiToken(service: string, apiToken: string, additionalData?: Record<string, string>): Promise<void> {
    const token: AuthToken = {
      service,
      accessToken: apiToken,
      scopes: ['all'], // API tokens typically have full access
      authMethod: 'api_token',
      additionalData,
    };
    await this.storeToken(token);
    console.log(`[Auth] Stored API token for ${service}`);
  }

  async getAllStatuses(): Promise<AuthStatus[]> {
    await this.initialize();
    
    // Define all supported services
    const services = ['notion', 'gmail', 'gcal', 'canvas'];
    const statuses: AuthStatus[] = [];
    
    for (const service of services) {
      statuses.push(await this.getStatus(service));
    }
    
    return statuses;
  }

  /**
   * Check if a token is expired or about to expire (within 5 minutes)
   */
  isTokenExpired(token: AuthToken): boolean {
    if (!token.expiresAt) return false;
    const expiresAt = new Date(token.expiresAt);
    const now = new Date();
    const fiveMinutes = 5 * 60 * 1000;
    return expiresAt.getTime() - now.getTime() < fiveMinutes;
  }
}

export const authManager = new AuthManager();
export default authManager;
