require('dotenv').config();
const express = require('express');
const path = require('path');
const fetch = require('node-fetch'); // npm install node-fetch@2
const fs = require('fs');

const { 
  Client, 
  GatewayIntentBits, 
  EmbedBuilder, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle, 
  SlashCommandBuilder, 
  REST, 
  Routes 
} = require('discord.js');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public'))); // Serve frontend

// --- Env Variables ---
const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const GUILD_ID = process.env.GUILD_ID;
const REDIRECT_URI = process.env.REDIRECT_URI;

// --- Discord Bot Setup ---
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages] });

// Memory für Buttons
client.buttonActions = {};
const styleMap = {
  'primary': ButtonStyle.Primary,
  'success': ButtonStyle.Success,
  'danger': ButtonStyle.Danger,
  'secondary': ButtonStyle.Secondary
};

// --- Slash Commands ---
const commands = [
  new SlashCommandBuilder()
    .setName('embed')
    .setDescription('Erstellt einen Embed')
    .addStringOption(opt=>opt.setName('titel').setDescription('Titel').setRequired(true))
    .addStringOption(opt=>opt.setName('beschreibung').setDescription('Beschreibung').setRequired(true))
    .addStringOption(opt=>opt.setName('farbe').setDescription('Hex-Farbe'))
    .addStringOption(opt=>opt.setName('footer').setDescription('Footer'))
    .addStringOption(opt=>opt.setName('bild').setDescription('Bild URL'))
    .addStringOption(opt=>opt.setName('feldname').setDescription('Feld Name'))
    .addStringOption(opt=>opt.setName('feldwert').setDescription('Feld Wert'))
].map(cmd=>cmd.toJSON());

// --- Commands registrieren ---
const rest = new REST({ version: '10' }).setToken(TOKEN);
(async ()=>{
  try{
    await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), {body:commands});
    console.log('Slash Commands registriert ✅');
  }catch(err){console.error(err);}
})();

// --- Buttons.json Loader/Saver ---
function loadButtons(){ try{ if(!fs.existsSync('./buttons.json')) fs.writeFileSync('./buttons.json','[]'); return JSON.parse(fs.readFileSync('./buttons.json','utf-8')); }catch{ return []; } }
function saveButtons(buttons){ try{ fs.writeFileSync('./buttons.json',JSON.stringify(buttons,null,2)); }catch(err){ console.error(err); } }

// --- Bot ready ---
client.once('ready', async ()=>{
  console.log(`Bot online als ${client.user.tag}`);

  // Embeds posten aus embed.json
  try{
    if(fs.existsSync('./embed.json')){
      const embeds = JSON.parse(fs.readFileSync('./embed.json','utf-8'));
      const channel = client.channels.cache.first();
      for(const e of embeds){
        const embed = new EmbedBuilder()
          .setTitle(e.titel)
          .setDescription(e.beschreibung.replace(/\\n/g,"\n"))
          .setColor(e.farbe||'#0099ff');
        if(e.footer) embed.setFooter({text:e.footer});
        if(e.bild) embed.setImage(e.bild);
        if(e.feldName && e.feldWert) embed.addFields({name:e.feldName,value:e.feldWert});
        await channel.send({embeds:[embed]});
      }
    }
  }catch(err){ console.error('Fehler embed.json:',err); }

  // Buttons laden
  const buttons = loadButtons();
  for(const b of buttons){
    try{
      const channel = client.channels.cache.get(b.channelId);
      if(!channel) continue;
      const message = await channel.messages.fetch(b.nachrichtenId);
      const row = new ActionRowBuilder();
      const button = new ButtonBuilder()
        .setCustomId(`dynbtn_${Date.now()}_${Math.floor(Math.random()*1000)}`)
        .setLabel(b.label)
        .setStyle(styleMap[b.style]||ButtonStyle.Primary)
        .setEmoji(b.emoji||null);
      row.addComponents(button);
      client.buttonActions[button.data.custom_id] = { type:b.actionType, value:b.actionValue };
      await message.edit({components:[row]});
    }catch(err){ console.log('Button konnte nicht hinzugefügt werden:',err);}
  }
});

// --- Interaction Handler ---
client.on('interactionCreate', async interaction=>{
  if(interaction.isChatInputCommand()){
    if(interaction.commandName==='embed'){
      const embed = new EmbedBuilder()
        .setTitle(interaction.options.getString('titel'))
        .setDescription(interaction.options.getString('beschreibung').replace(/\\n/g,"\n"))
        .setColor(interaction.options.getString('farbe')||'#0099ff');
      if(interaction.options.getString('footer')) embed.setFooter({text:interaction.options.getString('footer')});
      if(interaction.options.getString('bild')) embed.setImage(interaction.options.getString('bild'));
      if(interaction.options.getString('feldname') && interaction.options.getString('feldwert')) embed.addFields({
        name:interaction.options.getString('feldname'),
        value:interaction.options.getString('feldwert')
      });
      await interaction.reply({embeds:[embed], ephemeral:true});
    }
  }

  if(interaction.isButton()){
    const action = client.buttonActions[interaction.customId];
    if(!action) return;
    switch(action.type){
      case 'text': await interaction.reply({content:action.value, ephemeral:true}); break;
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
      case 'command': await interaction.reply({content:`Führe Command "${action.value}" manuell aus`,ephemeral:true}); break;
      default: await interaction.reply({content:'Unbekannte Aktion',ephemeral:true});
    }
  }
});

// --- Express Backend ---
// Root -> Dashboard
app.get('/', (req,res)=>{
  res.sendFile(path.join(__dirname,'public','dashboard.html'));
});

// Discord OAuth2
app.get('/login', (req,res)=>{
  const url = `https://discord.com/api/oauth2/authorize?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_type=code&scope=identify%20guilds`;
  res.redirect(url);
});

// Callback
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
    if(tokenData.error) return res.send("Fehler beim Token: "+tokenData.error);

    const userRes = await fetch("https://discord.com/api/users/@me",{
      headers:{Authorization:`Bearer ${tokenData.access_token}`}
    });
    const userData = await userRes.json();

    // Redirect auf Dashboard mit Query
    res.redirect(`/dashboard.html?username=${encodeURIComponent(userData.username)}&discriminator=${userData.discriminator}`);
  }catch(err){ console.error(err); res.send("OAuth Fehler"); }
});

// Channels Endpoint
app.get('/channels', async (req,res)=>{
  try{
    const guild = await client.guilds.fetch(GUILD_ID);
    const channels = await guild.channels.fetch();
    res.json(channels.map(c=>({id:c.id,name:c.name})));
  }catch(err){ res.json([]); }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, ()=>console.log(`Dashboard & Backend läuft auf Port ${PORT}`));

client.login(TOKEN);
