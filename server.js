// === DEPENDANCES ===
import express from "express";
import { Client, LocalAuth } from "whatsapp-web.js";
import dotenv from "dotenv";
const cors = require('cors');

dotenv.config();

const app = express();
app.use(express.json());
app.use(cors());

// === ROUTE POUR DEMANDER LE PAIRING CODE ===
app.post("/pair", async (req, res) => {
  const { phone } = req.body;
  if (!phone) {
    return res.status(400).json({ error: "Numéro de téléphone requis" });
  }

  // Création d'un client WhatsApp
  const client = new Client({
    authStrategy: new LocalAuth({ clientId: phone }), // chaque numéro a son propre dossier de session
  });

  // Quand un pairing code est dispo
  client.on("pairing-code", (code) => {
    console.log(`Code de liaison pour ${phone} : ${code}`);
    res.json({ phone, pairing_code: code });
  });

  // Quand c'est connecté
  client.on("ready", () => {
    console.log(`✅ ${phone} connecté avec succès`);
  });

  client.initialize();
});

// === DEMARRAGE DU SERVEUR ===
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Serveur WhatsApp en écoute sur http://localhost:${PORT}`);
});
