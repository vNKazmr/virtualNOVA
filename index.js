require('dotenv').config();
const express = require('express');
const path = require('path');
const fetch = require('node-fetch');
const fs = require('fs');
const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname,'public')));

// --- Environment ---
const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const GUILD_ID = process.env.GUILD_ID;
const REDIRECT_URI = process.env.REDIRECT_URI;

// --- Discord Bot ---
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages] });
client.buttonActions = {};
const styleMap = {
  'primary': ButtonStyle.Primary,
  'success': ButtonStyle.Success,
  'danger': ButtonStyle.Danger,
  'secondary': ButtonStyle.Secondary
};

// --- JSON Helper ---
function loadJSON(file){ if(!fs.existsSync(file)) fs.writeFileSync(file,'[]'); return JSON.parse(fs.readFileSync(file,'utf-8')); }
function saveJSON(file,data){ fs.writeFileSync(file,JSON.stringify(data,null,2)); }

// --- Bot ready ---
client.once('ready',()=>{ console.log(`Bot online als ${client.user.tag}`); });

// --- Express Endpoints ---
app.get('/', (req,res)=>res.sendFile(path.join(__dirname,'public','dashboard.html')));

// Login
app.get('/login',(req,res)=>{
  const url = `https://discord.com/api/oauth2/authorize?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_type=code&scope=identify%20guilds`;
  res.redirect(url);
});

// OAuth Callback
app.get('/callback', async (req,res)=>{
  const code = req.query.code;
  if(!code) return res.send("Kein Code empfangen");
  try{
    const params = new URLSearchParams();
    params.append("client_id",CLIENT_ID);
    params.append("client_secret",CLIENT_SECRET);
    params.append("grant_type","authorization_code");
    params.append("code",code);
    params.append("redirect_uri",REDIRECT_URI);
    params.append("scope","identify guilds");

    const tokenRes = await fetch("https://discord.com/api/oauth2/token",{
      method:"POST",
      body:params,
      headers:{"Content-Type":"application/x-www-form-urlencoded"}
    });
    const tokenData = await tokenRes.json();
    if(tokenData.error) return res.send("Token Fehler: "+tokenData.error);

    const userRes = await fetch("https://discord.com/api/users/@me",{
      headers:{Authorization:`Bearer ${tokenData.access_token}`}
    });
    const userData = await userRes.json();

    res.redirect(`/dashboard.html?username=${encodeURIComponent(userData.username)}&discriminator=${userData.discriminator}`);
  }catch(err){ console.error(err); res.send("OAuth Fehler"); }
});

// Channels für Dropdown
app.get('/channels', async (req,res)=>{
  try{
    const guild = await client.guilds.fetch(GUILD_ID);
    const channels = await guild.channels.fetch();
    const textChannels = Array.from(channels.values()).filter(c=>c.isTextBased());
    res.json(textChannels.map(c=>({id:c.id,name:c.name})));
  }catch(err){ console.error(err); res.json([]); }
});

// Embed senden
app.post('/sendEmbed', async (req,res)=>{
  const {titel,beschreibung,farbe,footer,bild,feldName,feldWert,channelId} = req.body;
  try{
    const channel = await client.channels.fetch(channelId);
    const embed = new EmbedBuilder()
      .setTitle(titel)
      .setDescription(beschreibung.replace(/\\n/g,"\n"))
      .setColor(farbe||'#0099ff');
    if(footer) embed.setFooter({text:footer});
    if(bild) embed.setImage(bild);
    if(feldName && feldWert) embed.addFields({name:feldName,value:feldWert});
    await channel.send({embeds:[embed]});
    res.json({success:true,message:'Embed gesendet ✅'});
  }catch(err){
    console.error(err);
    res.json({success:false,message:'Fehler beim Senden ❌'});
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT,()=>console.log(`Dashboard läuft auf Port ${PORT}`));
client.login(TOKEN);
