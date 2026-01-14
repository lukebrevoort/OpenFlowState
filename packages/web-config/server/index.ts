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
  } catch (error) {
    console.error('[API] Failed to init Core:', error);
  }
}

// --- Auth Routes ---

app.get('/api/auth/status', async (_req, res) => {
  try {
    const services = ['notion', 'gmail', 'gcal'];
    const status = await Promise.all(
      services.map(s => auth.getStatus(s))
    );
    res.json(status);
  } catch (error) {
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
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

app.post('/api/auth/disconnect', async (req, res) => {
  const { service } = req.body;
  try {
    await auth.removeToken(service);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

// --- Preference Routes ---

app.get('/api/preferences', async (_req, res) => {
  try {
    const prefs = await memory.getPreferences();
    res.json(prefs);
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

app.post('/api/preferences', async (req, res) => {
  try {
    await memory.setPreferences(req.body);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

// Start server
app.listen(port, () => {
  console.log(`[API] Server running on http://localhost:${port}`);
  initCore();
});
