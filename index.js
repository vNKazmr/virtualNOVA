require("dotenv").config();
const express = require("express");
const app = express();
const PORT = process.env.PORT || 3000;

// Statische Dateien
app.use(express.static("public"));

// Dashboard Hauptseite
app.get("/", (req, res) => {
  res.sendFile(__dirname + "/public/dashboard.html");
});

// Discord OAuth Callback
app.get("/callback", (req, res) => {
  res.send("Login erfolgreich!");
});

// Server starten
app.listen(PORT, () => {
  console.log(`Server läuft auf Port ${PORT}`);
});

// ---------------- Discord Bot -----------------
const { Client, GatewayIntentBits } = require("discord.js");
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages] });

client.once("ready", () => {
  console.log(`Bot online als ${client.user.tag}`);
});

client.login(process.env.TOKEN);
