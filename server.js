import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import pkg from "whatsapp-web.js";

const { Client, LocalAuth } = pkg; // ✅ destructuration après import

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// Exemple route
app.post("/pair", async (req, res) => {
  const { phone } = req.body;
  if (!phone) return res.status(400).json({ error: "Numéro requis" });

  const client = new Client({
    authStrategy: new LocalAuth({ clientId: phone })
  });

  client.on("qr", (qr) => {
    console.log("QR reçu:", qr);
  });

  client.on("pairing-code", (code) => {
    console.log(`Code de liaison pour ${phone} : ${code}`);
    res.json({ phone, pairing_code: code });
  });

  client.on("ready", () => {
    console.log(`✅ ${phone} connecté`);
  });

  client.initialize();
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Serveur en écoute sur ${PORT}`));
