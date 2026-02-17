/**
 * FlowState Desktop App - OAuth Server
 *
 * Temporary localhost HTTP server for handling OAuth callbacks.
 * Starts on demand, handles the callback, then shuts down.
 */

import http from 'http';
import { URL } from 'url';
import crypto from 'crypto';
import { shell, BrowserWindow } from 'electron';
import { authManager, AuthToken } from './auth-manager.js';

// OAuth configuration
const OAUTH_PORT = 3847;
const REDIRECT_URI = `http://localhost:${OAUTH_PORT}/callback`;

// Google OAuth scopes
const GOOGLE_SCOPES = {
  gmail: [
    'https://www.googleapis.com/auth/gmail.readonly',
    'https://www.googleapis.com/auth/gmail.compose',
    'https://www.googleapis.com/auth/gmail.modify',
    'https://www.googleapis.com/auth/gmail.labels',
    'https://www.googleapis.com/auth/userinfo.email',
  ],
  gcal: [
    'https://www.googleapis.com/auth/calendar.readonly',
    'https://www.googleapis.com/auth/calendar.events',
    'https://www.googleapis.com/auth/userinfo.email',
  ],
};

// Notion OAuth scopes
const NOTION_SCOPES = ['read_content', 'update_content', 'insert_content'];

const OUTLOOK_SCOPES = [
  'offline_access',
  'openid',
  'profile',
  'email',
  'User.Read',
  'Mail.Read',
  'Mail.ReadWrite',
  'Mail.Send',
  'Calendars.Read',
  'Calendars.ReadWrite',
];

interface OAuthConfig {
  clientId: string;
  clientSecret: string;
  authUrl: string;
  tokenUrl: string;
  scopes: string[];
  service: string;
}

interface PendingOAuth {
  service: string;
  state: string;
  config: OAuthConfig;
  resolve: (token: AuthToken) => void;
  reject: (error: Error) => void;
}

class OAuthServer {
  private server: http.Server | null = null;
  private pendingOAuth: PendingOAuth | null = null;
  private mainWindow: BrowserWindow | null = null;

  /**
   * Set the main window reference for sending events
   */
  setMainWindow(window: BrowserWindow): void {
    this.mainWindow = window;
  }

  /**
   * Start OAuth flow for a service
   */
  async startOAuth(
    service: string,
    clientId: string,
    clientSecret: string
  ): Promise<AuthToken> {
    // Determine OAuth config based on service
    const config = this.getOAuthConfig(service, clientId, clientSecret);

    // Generate state for CSRF protection
    const state = this.generateState();

    // Start the server if not running
    await this.startServer();

    // Create promise for the OAuth result
    return new Promise((resolve, reject) => {
      this.pendingOAuth = {
        service,
        state,
        config,
        resolve,
        reject,
      };

      // Build authorization URL
      const authUrl = this.buildAuthUrl(config, state);

      // Open in default browser
      console.log(`[OAuth] Opening authorization URL for ${service}`);
      shell.openExternal(authUrl);

      // Set timeout (5 minutes)
      setTimeout(() => {
        if (this.pendingOAuth?.state === state) {
          this.pendingOAuth.reject(new Error('OAuth timeout'));
          this.pendingOAuth = null;
          this.stopServer();
        }
      }, 5 * 60 * 1000);
    });
  }

  private getOAuthConfig(
    service: string,
    clientId: string,
    clientSecret: string
  ): OAuthConfig {
    switch (service) {
      case 'gmail':
        return {
          clientId,
          clientSecret,
          authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
          tokenUrl: 'https://oauth2.googleapis.com/token',
          scopes: GOOGLE_SCOPES.gmail,
          service: 'gmail',
        };
      case 'gcal':
        return {
          clientId,
          clientSecret,
          authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
          tokenUrl: 'https://oauth2.googleapis.com/token',
          scopes: GOOGLE_SCOPES.gcal,
          service: 'gcal',
        };
      case 'notion':
        return {
          clientId,
          clientSecret,
          authUrl: 'https://api.notion.com/v1/oauth/authorize',
          tokenUrl: 'https://api.notion.com/v1/oauth/token',
          scopes: NOTION_SCOPES,
          service: 'notion',
        };
      case 'outlook':
        return {
          clientId,
          clientSecret,
          authUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
          tokenUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
          scopes: OUTLOOK_SCOPES,
          service: 'outlook',
        };
      default:
        throw new Error(`Unknown service: ${service}`);
    }
  }

  private generateState(): string {
    // Use Node.js crypto module (imported at top)
    return crypto.randomBytes(32).toString('hex');
  }

  private buildAuthUrl(config: OAuthConfig, state: string): string {
    const params = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: REDIRECT_URI,
      response_type: 'code',
      scope: config.scopes.join(' '),
      state,
      access_type: 'offline',
      prompt: 'consent',
    });

    // Notion uses different parameter names
    if (config.service === 'notion') {
      params.delete('access_type');
      params.delete('prompt');
      params.set('owner', 'user');
    } else if (config.service === 'outlook') {
      params.delete('access_type');
    }

    return `${config.authUrl}?${params.toString()}`;
  }

  private async startServer(): Promise<void> {
    if (this.server) return;

    return new Promise((resolve, reject) => {
      this.server = http.createServer((req, res) => {
        this.handleRequest(req, res);
      });

      this.server.on('error', (error) => {
        console.error('[OAuth] Server error:', error);
        reject(error);
      });

      this.server.listen(OAUTH_PORT, '127.0.0.1', () => {
        console.log(`[OAuth] Server listening on port ${OAUTH_PORT}`);
        resolve();
      });
    });
  }

  private stopServer(): void {
    if (this.server) {
      this.server.close();
      this.server = null;
      console.log('[OAuth] Server stopped');
    }
  }

  private async handleRequest(
    req: http.IncomingMessage,
    res: http.ServerResponse
  ): Promise<void> {
    const url = new URL(req.url || '/', `http://localhost:${OAUTH_PORT}`);

    if (url.pathname === '/callback') {
      await this.handleCallback(url, res);
    } else {
      res.writeHead(404);
      res.end('Not found');
    }
  }

  private async handleCallback(
    url: URL,
    res: http.ServerResponse
  ): Promise<void> {
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    const error = url.searchParams.get('error');

    // Send success page
    const sendSuccessPage = () => {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>FlowState - Connected!</title>
            <style>
              body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                display: flex;
                justify-content: center;
                align-items: center;
                height: 100vh;
                margin: 0;
                background: #F6EEE3;
                color: #1E1E1E;
              }
              .container {
                text-align: center;
                padding: 40px;
                background: white;
                border-radius: 16px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.1);
              }
              h1 { color: #4A7C59; margin-bottom: 16px; }
              p { color: #665F5D; }
            </style>
          </head>
          <body>
            <div class="container">
              <h1>Connected!</h1>
              <p>You can close this window and return to FlowState.</p>
            </div>
          </body>
        </html>
      `);
    };

    // Send error page
    const sendErrorPage = (message: string) => {
      res.writeHead(400, { 'Content-Type': 'text/html' });
      res.end(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>FlowState - Error</title>
            <style>
              body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                display: flex;
                justify-content: center;
                align-items: center;
                height: 100vh;
                margin: 0;
                background: #F6EEE3;
                color: #1E1E1E;
              }
              .container {
                text-align: center;
                padding: 40px;
                background: white;
                border-radius: 16px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.1);
              }
              h1 { color: #C45B4A; margin-bottom: 16px; }
              p { color: #665F5D; }
            </style>
          </head>
          <body>
            <div class="container">
              <h1>Connection Failed</h1>
              <p>${message}</p>
              <p>Please close this window and try again.</p>
            </div>
          </body>
        </html>
      `);
    };

    // Check for errors
    if (error) {
      console.error('[OAuth] Authorization error:', error);
      sendErrorPage(`Authorization denied: ${error}`);
      if (this.pendingOAuth) {
        this.pendingOAuth.reject(new Error(`OAuth error: ${error}`));
        this.pendingOAuth = null;
      }
      this.stopServer();
      return;
    }

    // Validate state
    if (!this.pendingOAuth || state !== this.pendingOAuth.state) {
      console.error('[OAuth] Invalid state');
      sendErrorPage('Invalid state parameter');
      return;
    }

    if (!code) {
      console.error('[OAuth] No code received');
      sendErrorPage('No authorization code received');
      this.pendingOAuth.reject(new Error('No authorization code'));
      this.pendingOAuth = null;
      this.stopServer();
      return;
    }

    try {
      // Exchange code for token
      const token = await this.exchangeCodeForToken(
        code,
        this.pendingOAuth.config
      );

      // Store the token
      await authManager.storeToken(token);

      // Send success response
      sendSuccessPage();

      // Notify the renderer
      if (this.mainWindow?.webContents) {
        this.mainWindow.webContents.send('oauth:success', {
          service: this.pendingOAuth.service,
        });
      }

      // Resolve the promise
      this.pendingOAuth.resolve(token);
    } catch (err) {
      console.error('[OAuth] Token exchange error:', err);
      sendErrorPage('Failed to complete authentication');
      this.pendingOAuth.reject(
        err instanceof Error ? err : new Error(String(err))
      );
    } finally {
      this.pendingOAuth = null;
      this.stopServer();
    }
  }

  private async exchangeCodeForToken(
    code: string,
    config: OAuthConfig
  ): Promise<AuthToken> {
    const body = new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      code,
      redirect_uri: REDIRECT_URI,
      grant_type: 'authorization_code',
    });

    const response = await fetch(config.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body: body.toString(),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Token exchange failed: ${errorText}`);
    }

    const data = await response.json();

    // Get user email for Google services
    let email: string | undefined;
    if (config.service === 'gmail' || config.service === 'gcal') {
      email = await this.getGoogleUserEmail(data.access_token);
    } else if (config.service === 'outlook') {
      email = await this.getOutlookUserEmail(data.access_token);
    }

    return {
      service: config.service,
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: data.expires_in
        ? new Date(Date.now() + data.expires_in * 1000).toISOString()
        : undefined,
      scopes: config.scopes,
      email,
      authMethod: 'oauth' as const,
    };
  }

  private async getGoogleUserEmail(accessToken: string): Promise<string | undefined> {
    try {
      const response = await fetch(
        'https://www.googleapis.com/oauth2/v2/userinfo',
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        return data.email;
      }
    } catch (error) {
      console.error('[OAuth] Failed to get user email:', error);
    }
    return undefined;
  }

  private async getOutlookUserEmail(accessToken: string): Promise<string | undefined> {
    try {
      const response = await fetch('https://graph.microsoft.com/v1.0/me', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        if (typeof data?.mail === 'string' && data.mail.length > 0) {
          return data.mail;
        }
        if (typeof data?.userPrincipalName === 'string' && data.userPrincipalName.length > 0) {
          return data.userPrincipalName;
        }
      }
    } catch (error) {
      console.error('[OAuth] Failed to get Outlook user email:', error);
    }
    return undefined;
  }

  /**
   * Refresh an access token
   */
  async refreshToken(service: string): Promise<AuthToken | null> {
    const token = await authManager.getToken(service);
    if (!token?.refreshToken) {
      console.error(`[OAuth] No refresh token for ${service}`);
      return null;
    }

    const creds = await authManager.getClientCredentials(service);
    if (!creds) {
      console.error(`[OAuth] No credentials for ${service}`);
      return null;
    }

    const config = this.getOAuthConfig(service, creds.clientId, creds.clientSecret);

    try {
      const body = new URLSearchParams({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        refresh_token: token.refreshToken,
        grant_type: 'refresh_token',
      });

      if (service === 'outlook') {
        body.set('scope', config.scopes.join(' '));
      }

      const response = await fetch(config.tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: 'application/json',
        },
        body: body.toString(),
      });

      if (!response.ok) {
        throw new Error(`Refresh failed: ${response.statusText}`);
      }

      const data = await response.json();

      const newToken: AuthToken = {
        ...token,
        accessToken: data.access_token,
        refreshToken: data.refresh_token ?? token.refreshToken,
        expiresAt: data.expires_in
          ? new Date(Date.now() + data.expires_in * 1000).toISOString()
          : undefined,
      };

      if (service === 'outlook') {
        newToken.email = await this.getOutlookUserEmail(data.access_token);
      }

      await authManager.storeToken(newToken);
      console.log(`[OAuth] Refreshed token for ${service}`);
      return newToken;
    } catch (error) {
      console.error(`[OAuth] Failed to refresh token for ${service}:`, error);
      return null;
    }
  }

  /**
   * Disconnect a service
   */
  async disconnect(service: string): Promise<void> {
    await authManager.removeToken(service);
    console.log(`[OAuth] Disconnected ${service}`);
  }
}

export const oauthServer = new OAuthServer();
export default oauthServer;
