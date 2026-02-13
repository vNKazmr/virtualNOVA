require('dotenv').config();
const express = require('express');
const path = require('path');
const fetch = require('node-fetch');
const fs = require('fs');

const { 
  Client, 
  GatewayIntentBits, 
  EmbedBuilder, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle 
} = require('discord.js');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname,'public')));

// --- Environment Variables ---
const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const GUILD_ID = process.env.GUILD_ID;
const REDIRECT_URI = process.env.REDIRECT_URI;

// --- Discord Bot Setup ---
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.GuildMembers] });

// Memory für Buttons
client.buttonActions = {};
const styleMap = {
  'primary': ButtonStyle.Primary,
  'success': ButtonStyle.Success,
  'danger': ButtonStyle.Danger,
  'secondary': ButtonStyle.Secondary
};

// --- JSON Loader/Saver ---
function loadJSON(file){ 
  try{ 
    if(!fs.existsSync(file)) fs.writeFileSync(file,'[]'); 
    return JSON.parse(fs.readFileSync(file,'utf-8')); 
  }catch{return [];} 
}
function saveJSON(file,data){ 
  try{ fs.writeFileSync(file,JSON.stringify(data,null,2)); }catch(err){console.error(err);} 
}

// --- Bot ready ---
client.once('ready', async () => {
  console.log(`Bot online als ${client.user.tag}`);

  // Buttons aus buttons.json laden
  const buttons = loadJSON('buttons.json');
  for(const b of buttons){
    try{
      const channel = await client.channels.fetch(b.channelId);
      const message = await channel.messages.fetch(b.messageId);
      const row = new ActionRowBuilder();
      const btn = new ButtonBuilder()
        .setCustomId(`dynbtn_${Date.now()}_${Math.floor(Math.random()*1000)}`)
        .setLabel(b.label)
        .setStyle(styleMap[b.style]||ButtonStyle.Primary)
        .setEmoji(b.emoji||null);
      row.addComponents(btn);
      client.buttonActions[btn.data.custom_id] = {type:b.actionType,value:b.actionValue};
      await message.edit({components:[row]});
    }catch(err){ console.log('Button konnte nicht hinzugefügt werden:',err);}
  }
});

// --- Interaction Handler ---
client.on('interactionCreate', async interaction => {
  // Embed Commands via Bot Slash
  if(interaction.isChatInputCommand()){
    const embed = new EmbedBuilder()
      .setTitle(interaction.options.getString('titel'))
      .setDescription(interaction.options.getString('beschreibung').replace(/\\n/g,"\n"))
      .setColor(interaction.options.getString('farbe')||'#0099ff');
    if(interaction.options.getString('footer')) embed.setFooter({text:interaction.options.getString('footer')});
    if(interaction.options.getString('bild')) embed.setImage(interaction.options.getString('bild'));
    if(interaction.options.getString('feldname') && interaction.options.getString('feldwert')) embed.addFields({name:interaction.options.getString('feldname'),value:interaction.options.getString('feldwert')});
    await interaction.reply({embeds:[embed],ephemeral:true});
  }

  // Button pressed
  if(interaction.isButton()){
    const action = client.buttonActions[interaction.customId];
    if(!action) return;
    switch(action.type){
      case 'text': await interaction.reply({content:action.value,ephemeral:true}); break;
      case 'role':
        const role = interaction.guild.roles.cache.get(action.value);
        if(!role) return interaction.reply({content:'Rolle nicht gefunden',ephemeral:true});
        if(interaction.member.roles.cache.has(role.id)) interaction.member.roles.remove(role.id);
        else interaction.member.roles.add(role.id);
        await interaction.reply({content:`Rolle ${role.name} angepasst ✅`,ephemeral:true});
        break;
      case 'editembed':
        if(interaction.message.embeds.length>0){
          const newEmbed = EmbedBuilder.from(interaction.message.embeds[0]).setColor(action.value);
          await interaction.update({embeds:[newEmbed]});
        }else await interaction.reply({content:'Keine Embed Nachricht',ephemeral:true});
        break;
      default: await interaction.reply({content:'Unbekannte Aktion',ephemeral:true});
    }
  }
});

// --- Express Backend ---

// Root -> Dashboard
app.get('/', (req,res)=>{
  res.sendFile(path.join(__dirname,'public','dashboard.html'));
});

// Discord Login
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

    // Dashboard mit Username redirect
    res.redirect(`/dashboard.html?username=${encodeURIComponent(userData.username)}&discriminator=${userData.discriminator}`);
  }catch(err){ console.error(err); res.send("OAuth Fehler"); }
});

// Channels Endpoint für Dropdown
app.get('/channels', async (req,res)=>{
  try{
    const guild = await client.guilds.fetch(GUILD_ID);
    const channels = await guild.channels.fetch();
    const textChannels = Array.from(channels.values()).filter(c=>c.isTextBased());
    res.json(textChannels.map(c=>({id:c.id,name:c.name})));
  }catch(err){ res.json([]); }
});

// Embed senden Endpoint
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
app.listen(PORT,()=>console.log(`Dashboard & Bot läuft auf Port ${PORT}`));

client.login(TOKEN);
