const config = require("../config");

let firebaseAdmin = null;

try {
  firebaseAdmin = require("firebase-admin");
} catch (_error) {
  firebaseAdmin = null;
}

let firebaseApp = null;

function normalizePrivateKey(value) {
  return String(value || "").replace(/\\n/g, "\n").trim();
}

function getModernConfig() {
  return {
    projectId:
      process.env.FIREBASE_ADMIN_PROJECT_ID ||
      process.env.GOOGLE_CLOUD_PROJECT ||
      process.env.FIREBASE_PROJECT_ID ||
      "",
    clientEmail:
      process.env.FIREBASE_ADMIN_CLIENT_EMAIL ||
      process.env.FIREBASE_CLIENT_EMAIL ||
      "",
    privateKey:
      normalizePrivateKey(
        process.env.FIREBASE_ADMIN_PRIVATE_KEY || process.env.FIREBASE_PRIVATE_KEY
      )
  };
}

function isModernConfigured() {
  const modernConfig = getModernConfig();
  return Boolean(
    firebaseAdmin &&
      modernConfig.projectId &&
      modernConfig.clientEmail &&
      modernConfig.privateKey
  );
}

function getFirebaseApp() {
  if (!isModernConfigured()) {
    throw new Error("Firebase Admin credentials are not configured");
  }

  if (!firebaseApp) {
    const modernConfig = getModernConfig();
    firebaseApp = firebaseAdmin.apps.length
      ? firebaseAdmin.app()
      : firebaseAdmin.initializeApp({
          credential: firebaseAdmin.credential.cert({
            projectId: modernConfig.projectId,
            clientEmail: modernConfig.clientEmail,
            privateKey: modernConfig.privateKey
          })
        });
  }

  return firebaseApp;
}

function normalizeTokens(tokens) {
  return Array.from(
    new Set(
      (Array.isArray(tokens) ? tokens : [])
        .map(token => String(token || "").trim())
        .filter(Boolean)
    )
  );
}

function stringifyData(data) {
  const normalized = {};
  Object.entries(data || {}).forEach(([key, value]) => {
    if (typeof value === "undefined" || value === null) {
      return;
    }

    normalized[key] =
      typeof value === "string" ? value : JSON.stringify(value);
  });

  return normalized;
}

async function sendModernNotification(options) {
  const tokens = normalizeTokens(options.tokens);
  if (!tokens.length) {
    return { successCount: 0, failureCount: 0, responses: [] };
  }

  const notificationTitle = options.title || options.siteName || "Shilota";
  const notificationBody = options.message || "";
  const payload = {
    tokens: tokens,
    data: stringifyData(options.data)
  };

  if (notificationBody) {
    payload.notification = {
      title: notificationTitle,
      body: notificationBody
    };
  }

  if (options.web) {
    payload.webpush = {
      notification: {
        title: notificationTitle,
        body: notificationBody,
        icon: options.icon || `${config.baseUrl}/favicon.png`
      },
      fcmOptions: {
        link: config.baseUrl
      }
    };
  }

  if (options.mobile) {
    payload.android = {
      priority: "high",
      notification: notificationBody
        ? {
            title: notificationTitle,
            body: notificationBody
          }
        : undefined
    };
    payload.apns = {
      headers: {
        "apns-priority": "10"
      },
      payload: {
        aps: notificationBody
          ? {
              alert: {
                title: notificationTitle,
                body: notificationBody
              },
              sound: "default"
            }
          : {
              contentAvailable: true
            }
      }
    };
  }

  return getFirebaseApp().messaging().sendEachForMulticast(payload);
}

async function sendNotification(options) {
  if (!isModernConfigured()) {
    throw new Error("Firebase Admin credentials are not configured");
  }

  return sendModernNotification(options);
}

module.exports = {
  getModernConfig,
  isModernConfigured,
  sendNotification
};
