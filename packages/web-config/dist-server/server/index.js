import express from 'express';
import cors from 'cors';
import { auth, memory, daemon } from '@flowstate/core';
const app = express();
const port = 3001; // Backend port
app.use(cors());
app.use(express.json());
// Initialize Core
async function initCore() {
    try {
        await daemon.start();
        console.log('[API] FlowState Core initialized');
    }
    catch (error) {
        console.error('[API] Failed to init Core:', error);
    }
}
// --- Auth Routes ---
app.get('/api/auth/status', async (_req, res) => {
    try {
        const services = ['notion', 'gmail', 'gcal'];
        const status = await Promise.all(services.map(s => auth.getStatus(s)));
        res.json(status);
    }
    catch (error) {
        res.status(500).json({ error: String(error) });
    }
});
app.post('/api/auth/connect', async (req, res) => {
    const { service, token } = req.body;
    if (!service || !token) {
        res.status(400).json({ error: 'Missing service or token' });
        return;
    }
    try {
        // For MVP/Dev Mode: We accept a raw token object directly.
        // Real OAuth flow would exchange code for token here.
        await auth.storeToken({
            service,
            accessToken: token.accessToken,
            refreshToken: token.refreshToken,
            expiresAt: token.expiresIn ? new Date(Date.now() + token.expiresIn * 1000) : undefined,
            scopes: token.scopes || [],
        });
        res.json({ success: true });
    }
    catch (error) {
        res.status(500).json({ error: String(error) });
    }
});
app.post('/api/auth/disconnect', async (req, res) => {
    const { service } = req.body;
    try {
        await auth.removeToken(service);
        res.json({ success: true });
    }
    catch (error) {
        res.status(500).json({ error: String(error) });
    }
});
// --- OAuth Helper Routes ---
app.post('/api/auth/google/exchange', async (req, res) => {
    const { code, clientId, clientSecret, redirectUri } = req.body;
    if (!code || !clientId || !clientSecret || !redirectUri) {
        res.status(400).json({ error: 'Missing required OAuth parameters' });
        return;
    }
    try {
        const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                code,
                client_id: clientId,
                client_secret: clientSecret,
                redirect_uri: redirectUri,
                grant_type: 'authorization_code',
            }),
        });
        const tokens = await tokenResponse.json();
        if (!tokenResponse.ok) {
            throw new Error(tokens.error_description || tokens.error || 'Failed to exchange token');
        }
        // Determine scopes to save based on what we requested or what was returned
        const scope = tokens.scope || '';
        const isGmail = scope.includes('gmail');
        const isCalendar = scope.includes('calendar');
        // Store for Gmail if applicable
        if (isGmail) {
            await auth.storeToken({
                service: 'gmail',
                accessToken: tokens.access_token,
                refreshToken: tokens.refresh_token,
                expiresAt: new Date(Date.now() + tokens.expires_in * 1000),
                scopes: scope.split(' '),
            });
        }
        // Store for Calendar if applicable
        if (isCalendar) {
            await auth.storeToken({
                service: 'gcal',
                accessToken: tokens.access_token,
                refreshToken: tokens.refresh_token,
                expiresAt: new Date(Date.now() + tokens.expires_in * 1000),
                scopes: scope.split(' '),
            });
        }
        // Also store the client credentials for future refreshes
        if (isGmail)
            await auth.storeClientConfig('gmail', { clientId, clientSecret, redirectUri });
        if (isCalendar)
            await auth.storeClientConfig('gcal', { clientId, clientSecret, redirectUri });
        res.json({ success: true, services: { gmail: isGmail, gcal: isCalendar } });
    }
    catch (error) {
        console.error('OAuth Exchange Error:', error);
        res.status(500).json({ error: error.message });
    }
});
// --- Preference Routes ---
app.get('/api/preferences', async (_req, res) => {
    try {
        const prefs = await memory.getPreferences();
        res.json(prefs);
    }
    catch (error) {
        res.status(500).json({ error: String(error) });
    }
});
app.post('/api/preferences', async (req, res) => {
    try {
        await memory.setPreferences(req.body);
        res.json({ success: true });
    }
    catch (error) {
        res.status(500).json({ error: String(error) });
    }
});
// Start server
app.listen(port, '0.0.0.0', () => {
    console.log(`[API] Server running on http://0.0.0.0:${port}`);
    initCore();
});
