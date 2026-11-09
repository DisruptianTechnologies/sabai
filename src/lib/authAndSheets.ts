import { initializeApp } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  onAuthStateChanged,
  type User,
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

export const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

const provider = new GoogleAuthProvider();
for (const scope of SCOPES) {
  provider.addScope(scope);
}

// Flag to indicate if we are in the middle of a sign-in flow.
let isSigningIn = false;
// Cache the access token strictly in memory (never in localStorage or sessionStorage).
let cachedAccessToken: string | null = null;
// Keep active spreadsheet metadata in memory for the session
let activeSpreadsheetId: string | null = null;
let activeSpreadsheetUrl: string | null = null;
let activeSheetTabName: string | null = null;

export interface AuthenticatedAnalyst {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string | null;
  provider: 'Google OAuth' | 'Email & Password (Firebase)' | 'Email & Password (MCP Vault)';
  hasSheetsToken: boolean;
}

export interface LoginAuditEntry {
  id: string;
  timestamp: string;
  uid: string;
  email: string;
  displayName: string;
  authProvider: string;
  datasetName: string;
  question: string;
  syncedToSheet: boolean;
  spreadsheetId?: string;
  spreadsheetUrl?: string;
}

export const initAuth = (
  onAuthSuccess?: (user: User, token: string | null) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      if (cachedAccessToken) {
        if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
      } else if (!isSigningIn) {
        // Still authenticated via Firebase (e.g. Email/Password or restored session)
        if (onAuthSuccess) onAuthSuccess(user, null);
      }
    } else {
      cachedAccessToken = null;
      if (onAuthFailure) onAuthFailure();
    }
  });
};

export const googleSignIn = async (): Promise<{
  analyst: AuthenticatedAnalyst;
  accessToken: string;
}> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Failed to obtain Google Sheets access token from Google Sign-In.');
    }

    cachedAccessToken = credential.accessToken;
    const analyst: AuthenticatedAnalyst = {
      uid: result.user.uid,
      email: result.user.email || 'analyst@sabaifoundation.org',
      displayName:
        result.user.displayName ||
        (result.user.email ? result.user.email.split('@')[0] : 'SABAI Analyst'),
      photoURL: result.user.photoURL,
      provider: 'Google OAuth',
      hasSheetsToken: true,
    };

    return { analyst, accessToken: cachedAccessToken };
  } finally {
    isSigningIn = false;
  }
};

export const emailPasswordSignInOrUp = async (
  mode: 'signin' | 'signup',
  email: string,
  password: string,
  displayName?: string
): Promise<{
  analyst: AuthenticatedAnalyst;
  usedMcpFallback: boolean;
}> => {
  const cleanEmail = email.trim();
  const cleanName = (displayName || '').trim() || cleanEmail.split('@')[0] || 'SABAI Analyst';

  // First try Firebase Email/Password authentication
  try {
    isSigningIn = true;
    let userCred;
    if (mode === 'signup') {
      userCred = await createUserWithEmailAndPassword(auth, cleanEmail, password);
      if (cleanName) {
        await updateProfile(userCred.user, { displayName: cleanName }).catch(() => {});
      }
    } else {
      userCred = await signInWithEmailAndPassword(auth, cleanEmail, password);
    }

    return {
      analyst: {
        uid: userCred.user.uid,
        email: userCred.user.email || cleanEmail,
        displayName: userCred.user.displayName || cleanName,
        photoURL: userCred.user.photoURL,
        provider: 'Email & Password (Firebase)',
        hasSheetsToken: Boolean(cachedAccessToken),
      },
      usedMcpFallback: false,
    };
  } catch (fbErr: any) {
    // If Firebase Email/Password provider is not enabled in Firebase console or user is stored in MCP Vault,
    // use the zero-cost MCP Identity Vault endpoint.
    const res = await fetch('/api/auth/mcp-authenticate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mode,
        email: cleanEmail,
        password,
        displayName: cleanName,
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || fbErr?.message || 'Authentication failed.');
    }

    return {
      analyst: {
        uid: data.user.uid,
        email: data.user.email,
        displayName: data.user.displayName,
        photoURL: null,
        provider: 'Email & Password (MCP Vault)',
        hasSheetsToken: Boolean(cachedAccessToken),
      },
      usedMcpFallback: true,
    };
  } finally {
    isSigningIn = false;
  }
};

export const getAccessToken = (): string | null => {
  return cachedAccessToken;
};

export const logout = async (): Promise<void> => {
  try {
    await auth.signOut();
  } finally {
    cachedAccessToken = null;
  }
};

export const getActiveSpreadsheetInfo = () => ({
  spreadsheetId: activeSpreadsheetId,
  spreadsheetUrl: activeSpreadsheetUrl,
  sheetTabName: activeSheetTabName,
});

export const setCustomSpreadsheetId = (idOrUrl: string) => {
  const trimmed = idOrUrl.trim();
  if (!trimmed) {
    activeSpreadsheetId = null;
    activeSpreadsheetUrl = null;
    activeSheetTabName = null;
    return;
  }
  const match = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  activeSpreadsheetId = match ? match[1] : trimmed;
  activeSpreadsheetUrl = `https://docs.google.com/spreadsheets/d/${activeSpreadsheetId}/edit`;
  activeSheetTabName = null;
};

/**
 * Ensures a Google Sheet exists (or inspects metadata of an existing sheet to get its first tab name)
 * and appends login audit rows to it using the user's in-memory OAuth access token.
 */
export async function syncLoginEntriesToGoogleSheet(
  entries: LoginAuditEntry[],
  customSheetId?: string
): Promise<{
  spreadsheetId: string;
  spreadsheetUrl: string;
  sheetTabName: string;
  appendedCount: number;
}> {
  const token = cachedAccessToken;
  if (!token) {
    throw new Error('Google Sheets access token is required. Sign in with Google to sync directly to Google Sheets.');
  }

  if (customSheetId) {
    setCustomSpreadsheetId(customSheetId);
  }

  let targetSpreadsheetId = activeSpreadsheetId;
  let targetSpreadsheetUrl = activeSpreadsheetUrl;
  let targetTabName = activeSheetTabName;

  // 1. If we already have a targetSpreadsheetId, fetch its metadata first to discover the actual first tab title
  if (targetSpreadsheetId && !targetTabName) {
    const metaRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
        targetSpreadsheetId
      )}?fields=spreadsheetId,spreadsheetUrl,sheets.properties.title`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    if (metaRes.ok) {
      const metaData = await metaRes.json();
      targetSpreadsheetId = metaData.spreadsheetId || targetSpreadsheetId;
      targetSpreadsheetUrl =
        metaData.spreadsheetUrl ||
        `https://docs.google.com/spreadsheets/d/${targetSpreadsheetId}/edit`;
      targetTabName = metaData.sheets?.[0]?.properties?.title || 'LoginAudit';
    } else {
      // If the custom sheet ID was invalid or inaccessible, create a new spreadsheet
      targetSpreadsheetId = null;
    }
  }

  // 2. Create a new Google Sheet if none exists yet
  if (!targetSpreadsheetId) {
    const createRes = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        properties: {
          title: 'SABAI Foundation - Login & Analysis Audit Log',
        },
        sheets: [
          {
            properties: {
              title: 'Login_Audit_Log',
              gridProperties: {
                frozenRowCount: 1,
              },
            },
          },
        ],
      }),
    });

    if (!createRes.ok) {
      const errBody = await createRes.text();
      throw new Error(`Google Sheets API error (${createRes.status}): ${errBody}`);
    }

    const createdSheet = await createRes.json();
    targetSpreadsheetId = createdSheet.spreadsheetId;
    targetSpreadsheetUrl =
      createdSheet.spreadsheetUrl ||
      `https://docs.google.com/spreadsheets/d/${targetSpreadsheetId}/edit`;
    targetTabName =
      createdSheet.sheets?.[0]?.properties?.title || 'Login_Audit_Log';

    // Write the header row to the newly created sheet
    await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
        targetSpreadsheetId!
      )}/values/${encodeURIComponent(targetTabName!)}!A1:H1?valueInputOption=USER_ENTERED`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          values: [
            [
              'Timestamp (ISO)',
              'User Email',
              'Display Name',
              'Auth Method',
              'Dataset Analyzed',
              'Analysis Inquiry',
              'Audit ID',
              'Promoter',
            ],
          ],
        }),
      }
    );
  }

  activeSpreadsheetId = targetSpreadsheetId;
  activeSpreadsheetUrl = targetSpreadsheetUrl;
  activeSheetTabName = targetTabName;

  if (!entries || entries.length === 0) {
    return {
      spreadsheetId: targetSpreadsheetId!,
      spreadsheetUrl: targetSpreadsheetUrl!,
      sheetTabName: targetTabName!,
      appendedCount: 0,
    };
  }

  // 3. Append the login rows to the discovered sheet tab
  const rows = entries.map((e) => [
    e.timestamp,
    e.email,
    e.displayName,
    e.authProvider,
    e.datasetName,
    e.question,
    e.id,
    'SABAI Foundation (Society for Awareness and Better Access to Information)',
  ]);

  const appendRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
      targetSpreadsheetId!
    )}/values/${encodeURIComponent(
      targetTabName!
    )}!A:H:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        values: rows,
      }),
    }
  );

  if (!appendRes.ok) {
    const errText = await appendRes.text();
    throw new Error(`Failed to append login details to Google Sheets: ${errText}`);
  }

  // Mark synced on the server audit ledger
  await fetch('/api/auth/audit-log/mark-synced', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ids: entries.map((e) => e.id),
      spreadsheetId: targetSpreadsheetId,
      spreadsheetUrl: targetSpreadsheetUrl,
    }),
  }).catch(() => {});

  return {
    spreadsheetId: targetSpreadsheetId!,
    spreadsheetUrl: targetSpreadsheetUrl!,
    sheetTabName: targetTabName!,
    appendedCount: rows.length,
  };
}
