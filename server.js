import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import pkg from "whatsapp-web.js";

const { Client, LocalAuth } = pkg;
dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

app.post("/pair", async (req, res) => {
  const { phone } = req.body;
  if (!phone) return res.status(400).json({ error: "Numéro requis" });

  const client = new Client({
    authStrategy: new LocalAuth({ clientId: phone })
  });

  try {
    await client.initialize();

    // Demande explicite du pairing code
    const code = await client.requestPairingCode(phone);
    console.log(`Pairing code pour ${phone} : ${code}`);

    res.json({ phone, pairing_code: code });
  } catch (err) {
    console.error(err);
    res.status(500).json({ phone, error: "Impossible d'obtenir le code" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Serveur en écoute sur ${PORT}`));
