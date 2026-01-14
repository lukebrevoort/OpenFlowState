# Authentication Setup Guide

Since FlowState 2.0 runs locally on your machine, you need to provide it with access tokens for your applications. This guide explains how to generate them manually for testing.

---

## 1. Notion Setup

### Step 1: Create an Integration
1. Go to [Notion My Integrations](https://www.notion.so/my-integrations).
2. Click **+ New integration**.
3. Name it "FlowState" and ensure the correct workspace is selected.
4. Click **Submit**.

### Step 2: Get the Token
1. On the integration page, click **Show** next to the "Internal Integration Secret".
2. Copy this string (starts with `secret_`).

### Step 3: Connect Data
⚠️ **Important**: Notion requires you to explicitly share pages with your integration.
1. Open the Notion page or database you want FlowState to manage.
2. Click the **...** menu in the top right.
3. Scroll down to **Connections**.
4. Search for "FlowState" (or whatever you named your integration) and add it.

### Step 4: FlowState Dashboard
1. Open FlowState Dashboard (`http://localhost:3847`).
2. Click **Connect** on Notion.
3. Paste the `secret_...` string directly into the box.
4. Click **Save & Connect**.

---

## 2. Google Setup (Gmail & Calendar)

For the MVP, we use the **Google OAuth Playground** to generate tokens manually. This avoids needing to verify a Google Cloud App immediately.

### Step 1: OAuth Playground
1. Go to the [Google OAuth Playground](https://developers.google.com/oauthplayground).
2. Click the **Gear Icon** (Settings) in the top right.
   - Check "Use your own OAuth credentials" (Optional, but recommended if you have a Google Cloud Project).
   - If not, you can use the default Playground credentials for testing (tokens expire quickly, ~1 hour).

### Step 2: Select Scopes
In the "Select & authorize APIs" list on the left, find and select:

**For Gmail:**
- `https://www.googleapis.com/auth/gmail.modify` (Read, write, send, delete)

**For Calendar:**
- `https://www.googleapis.com/auth/calendar` (Read, write events)

Click **Authorize APIs**.

### Step 3: Exchange Tokens
1. Click **Exchange authorization code for tokens**.
2. You will see a JSON object on the right side looking like this:

```json
{
  "access_token": "ya29.a0...",
  "scope": "...",
  "token_type": "Bearer",
  "expires_in": 3599,
  "refresh_token": "1//0..."
}
```

### Step 4: FlowState Dashboard
1. Copy that **entire JSON object** (including curly braces).
2. Open FlowState Dashboard.
3. Click **Connect** on Gmail or Google Calendar.
4. Paste the JSON into the box.
5. Click **Save & Connect**.

> **Note**: If you used the default Playground credentials, the `refresh_token` might stop working after 24 hours. For long-term use, creating your own Google Cloud Project is recommended.
