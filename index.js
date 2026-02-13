require("dotenv").config();
const express = require("express");
const path = require("path");
const session = require("express-session");
const fetch = require("node-fetch");
const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} = require("discord.js");

const app = express();

/* =========================
   DISCORD BOT
========================= */

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages
  ]
});

client.once("ready", () => {
  console.log(`✅ Bot online als ${client.user.tag}`);
});

client.login(process.env.TOKEN);

/* =========================
   EXPRESS CONFIG
========================= */

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

app.use(session({
  secret: "dashboard_secret",
  resave: false,
  saveUninitialized: false
}));

/* =========================
   DISCORD LOGIN
========================= */

app.get("/login", (req, res) => {
  const redirect = `https://discord.com/api/oauth2/authorize?client_id=${process.env.CLIENT_ID}&redirect_uri=${process.env.REDIRECT_URI}&response_type=code&scope=identify%20guilds`;
  res.redirect(redirect);
});

app.get("/callback", async (req, res) => {
  const code = req.query.code;

  const params = new URLSearchParams();
  params.append("client_id", process.env.CLIENT_ID);
  params.append("client_secret", process.env.CLIENT_SECRET);
  params.append("grant_type", "authorization_code");
  params.append("code", code);
  params.append("redirect_uri", process.env.REDIRECT_URI);

  const tokenResponse = await fetch("https://discord.com/api/oauth2/token", {
    method: "POST",
    body: params,
    headers: { "Content-Type": "application/x-www-form-urlencoded" }
  });

  const tokenData = await tokenResponse.json();

  const userResponse = await fetch("https://discord.com/api/users/@me", {
    headers: {
      authorization: `${tokenData.token_type} ${tokenData.access_token}`
    }
  });

  const user = await userResponse.json();
  req.session.user = user;

  res.redirect("/dashboard.html");
});

/* =========================
   AUTH CHECK
========================= */

function checkAuth(req, res, next) {
  if (!req.session.user) return res.redirect("/login.html");
  next();
}

/* =========================
   API ROUTES
========================= */

app.post("/api/embed", checkAuth, async (req, res) => {
  const embed = new EmbedBuilder(req.body);
  const channel = await client.channels.fetch(process.env.CHANNEL_ID);
  await channel.send({ embeds: [embed] });
  res.json({ success: true });
});

app.post("/api/button", checkAuth, async (req, res) => {
  const button = new ButtonBuilder()
    .setCustomId("nextlevel_button")
    .setLabel(req.body.label)
    .setStyle(ButtonStyle[req.body.style]);

  const row = new ActionRowBuilder().addComponents(button);
  const channel = await client.channels.fetch(process.env.CHANNEL_ID);

  await channel.send({
    content: "Button Nachricht:",
    components: [row]
  });

  res.json({ success: true });
});

app.get("/api/status", checkAuth, (req, res) => {
  res.json({
    bot: client.user ? "Online" : "Offline",
    servers: client.guilds.cache.size,
    uptime: process.uptime()
  });
});

/* =========================
   SERVER START
========================= */

app.listen(process.env.PORT || 3000, () => {
  console.log("🌐 Next Level Dashboard läuft");
});
