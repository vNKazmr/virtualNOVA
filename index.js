require('dotenv').config();
const express = require('express');
const path = require('path');
const fetch = require('node-fetch');
const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// --- Environment Variables ---
const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const REDIRECT_URI = process.env.REDIRECT_URI;
const PORT = process.env.PORT || 3000;

// --- Discord Bot ---
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages]
});

client.once('ready', () => {
  console.log(`Bot online als ${client.user.tag}`);
});

// --- Login Route ---
app.get('/login', (req, res) => {
  const scope = encodeURIComponent('identify guilds');
  const url = `https://discord.com/api/oauth2/authorize?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_type=code&scope=${scope}`;
  res.redirect(url);
});

// --- OAuth2 Callback ---
app.get('/callback', async (req, res) => {
  const code = req.query.code;
  if (!code) return res.send('Fehler: Kein Code empfangen');

  try {
    const params = new URLSearchParams();
    params.append('client_id', CLIENT_ID);
    params.append('client_secret', CLIENT_SECRET);
    params.append('grant_type', 'authorization_code');
    params.append('code', code);
    params.append('redirect_uri', REDIRECT_URI);
    params.append('scope', 'identify guilds');

    const tokenRes = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      body: params,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });

    const tokenData = await tokenRes.json();
    if (tokenData.error) return res.send('Token Fehler: ' + tokenData.error);

    const userRes = await fetch('https://discord.com/api/users/@me', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` }
    });
    const userData = await userRes.json();

    const guildRes = await fetch('https://discord.com/api/users/@me/guilds', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` }
    });
    const guilds = await guildRes.json();

    // Redirect zum Dashboard
    const guildParam = encodeURIComponent(JSON.stringify(guilds));
    res.redirect(`/dashboard.html?username=${encodeURIComponent(userData.username)}&discriminator=${userData.discriminator}&guilds=${guildParam}`);
  } catch (err) {
    console.error(err);
    res.send('OAuth Fehler: ' + err.message);
  }
});

// --- Channels für Dropdown ---
app.get('/channels/:guildId', async (req, res) => {
  try {
    const guild = await client.guilds.fetch(req.params.guildId);
    const channels = await guild.channels.fetch();
    const textChannels = Array.from(channels.values()).filter(c => c.isTextBased());
    res.json(textChannels.map(c => ({ id: c.id, name: c.name })));
  } catch (err) {
    console.error(err);
    res.json([]);
  }
});

// --- Embed senden ---
app.post('/sendEmbed', async (req, res) => {
  const { titel, beschreibung, farbe, footer, bild, feldName, feldWert, channelId } = req.body;
  try {
    const channel = await client.channels.fetch(channelId);
    const embed = new EmbedBuilder()
      .setTitle(titel)
      .setDescription(beschreibung.replace(/\\n/g, '\n'))
      .setColor(farbe || '#0099ff');
    if (footer) embed.setFooter({ text: footer });
    if (bild) embed.setImage(bild);
    if (feldName && feldWert) embed.addFields({ name: feldName, value: feldWert });

    await channel.send({ embeds: [embed] });
    res.json({ success: true, message: 'Embed erfolgreich gesendet ✅' });
  } catch (err) {
    console.error(err);
    res.json({ success: false, message: 'Fehler beim Senden ❌' });
  }
});

// --- Server starten ---
app.listen(PORT, () => console.log(`Dashboard läuft auf Port ${PORT}`));
client.login(TOKEN);
