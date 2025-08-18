// === DEPENDANCES ===
require('dotenv').config();
const express = require('express');
const { Client, Buttons, MessageMedia, LocalAuth } = require('whatsapp-web.js');
const cors = require('cors');
const fetch = require('node-fetch');

// === CONFIG EXPRESS ===
const app = express();
const port = 3000;
app.use(cors());
app.use(express.json());

// === VARIABLES ===
let authenticated = false;
let client;
let currentSession = null; // stocke la session en mémoire
let WEBHOOK_URL = "https://webhookwhastsappv2-1.onrender.com/whatsapp";

// === INITIALISATION CLIENT WHATSAPP ===
async function initClient() {
  if (client) {
    console.log("♻️ Destruction de l'ancien client...");
    await client.destroy().catch(() => {});
  }

  client = new Client({
    authStrategy: new LocalAuth(), // conserve la session automatiquement
    puppeteer: {
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-gpu',
        '--disable-dev-shm-usage',
        '--disable-software-rasterizer',
        '--disable-setuid-sandbox',
        '--disable-extensions',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding'
      ]
    }
  });

  client.on('ready', () => {
    console.log('🤖 Client prêt');
    authenticated = true;
  });

  client.on('authenticated', () => {
    console.log('✅ Authentifié');
    authenticated = true;
  });

  client.on('auth_failure', (msg) => {
    console.error('❌ Authentification échouée :', msg);
    authenticated = false;
  });

  // === SUPPRIMER MESSAGES ENVOYÉS APRÈS ENVOI ===
  client.on('message_create', async (msg) => {
    if (msg.fromMe) {
      try {
        await msg.delete();
        console.log(`🗑️ Message envoyé supprimé pour moi`);
      } catch (err) {
        console.error('❌ Erreur suppression message envoyé :', err.message);
      }
    }
  });

  // === SUPPRIMER MESSAGES REÇUS APRÈS WEBHOOK ===
  client.on('message', async (msg) => {
    console.log(`📩 Reçu de ${msg.from}: ${msg.body || '[média]'}`);

    const payload = {
      from: msg.from,
      body: msg.body || '',
      timestamp: msg.timestamp,
      type: msg.type,
      isGroupMsg: msg.from.includes('@g.us'),
    };

    if (msg.hasQuotedMsg) {
      payload.context = await msg.getQuotedMessage();
    }

    if (msg.hasMedia) {
      try {
        const media = await msg.downloadMedia();
        if (media) {
          payload.media = {
            mimetype: media.mimetype,
            data: media.data,
            filename: media.filename || `media.${media.mimetype.split('/')[1] || 'bin'}`
          };
        }
      } catch (err) {
        console.error('Erreur téléchargement média :', err.message);
      }
    }

    try {
      if (WEBHOOK_URL) {
        await fetch(WEBHOOK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      }

      await msg.delete(true);
      console.log('🗑️ Message reçu supprimé pour moi');

      if (payload.media) payload.media.data = null;

    } catch (err) {
      console.error('Erreur webhook ou suppression :', err.message);
    }
  });

  client.initialize();
}

initClient();

// === ROUTE AUTH PAR PAIRING CODE ===
app.post('/auth/pair', async (req, res) => {
  const { number } = req.body;
  if (!number) return res.status(400).json({ error: 'Numéro requis (ex: 229XXXXXXXX)' });

  try {
    const code = await client.requestPairingCode(number.replace('+', ''));
    console.log("👉 Pairing code pour", number, ":", code);
    res.json({ status: 'pending', pairingCode: code });
  } catch (err) {
    console.error('Erreur génération pairing code:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// === ROUTE CHECK AUTH ===
app.get('/checkAuth', (req, res) => {
  res.json({ status: authenticated ? 'authenticated' : 'not authenticated' });
});

// === ENVOYER MESSAGE TEXTE ===
app.post('/sendMessage', async (req, res) => {
  const { number, message } = req.body;
  if (!authenticated) return res.status(401).json({ error: 'Client non authentifié' });
  if (!number || !message) return res.status(400).json({ error: 'Numéro et message requis' });

  const formatted = number.replace('+', '') + '@c.us';
  try {
    await client.sendMessage(formatted, message);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// === ENVOYER MEDIA SIMPLE ===
app.post('/sendMedia', async (req, res) => {
  const { number, media } = req.body;
  if (!authenticated) return res.status(401).json({ error: 'Client non authentifié' });
  if (!number || !media?.data || !media?.mimetype) {
    return res.status(400).json({ error: 'Champs requis manquants' });
  }

  const formatted = number.replace('+', '') + '@c.us';
  try {
    const mediaMsg = new MessageMedia(media.mimetype, media.data, media.filename || 'fichier');
    await client.sendMessage(formatted, mediaMsg);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// === ENVOYER MEDIA AVEC CAPTION ===
app.post('/sendMediaV2', async (req, res) => {
  const { number, media, caption = '' } = req.body;
  if (!authenticated) return res.status(401).json({ error: 'Client non authentifié' });
  if (!number || !media?.data || !media?.mimetype) {
    return res.status(400).json({ error: 'Champs requis : number, media.data, media.mimetype' });
  }

  const formatted = number.replace('+', '') + '@c.us';
  try {
    const mediaMsg = new MessageMedia(media.mimetype, media.data, media.filename || 'fichier');
    await client.sendMessage(formatted, mediaMsg, { caption: caption || undefined });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// === ENVOYER BOUTONS ===
app.post('/sendButtons', async (req, res) => {
  const { number, text, buttons, title = '', footer = '' } = req.body;
  if (!authenticated) return res.status(401).json({ error: 'Client non authentifié' });
  if (!number || !text || !Array.isArray(buttons) || buttons.length === 0) {
    return res.status(400).json({ error: 'Champs requis : number, text, buttons[]' });
  }

  const formattedNumber = number.replace('+', '').replace(/\s+/g, '') + '@c.us';
  try {
    const parsedButtons = buttons.map(b => typeof b === 'string' ? { body: b } : b);
    const buttonMsg = new Buttons(text, parsedButtons, title, footer);
    await client.sendMessage(formattedNumber, buttonMsg);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// === ROUTE STATISTIQUES MÉMOIRE ===
app.get('/stats', (req, res) => {
  const mem = process.memoryUsage();
  res.json({
    rss: (mem.rss / 1024 / 1024).toFixed(2) + " MB",
    heapUsed: (mem.heapUsed / 1024 / 1024).toFixed(2) + " MB",
    heapTotal: (mem.heapTotal / 1024 / 1024).toFixed(2) + " MB",
    external: (mem.external / 1024 / 1024).toFixed(2) + " MB",
    arrayBuffers: (mem.arrayBuffers / 1024 / 1024).toFixed(2) + " MB"
  });
});

// === DEMARRAGE SERVEUR ===
app.listen(port, () => {
  console.log(`🚀 Serveur WhatsApp en ligne sur http://localhost:${port}`);
});
