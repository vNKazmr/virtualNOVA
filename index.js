require('dotenv').config();
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
const express = require('express');
const fs = require('fs');

const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;

// -------------------
// Discord Client
// -------------------
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages] });

// Memory für Buttons
client.buttonActions = {};
const styleMap = {
  'primary': ButtonStyle.Primary,
  'success': ButtonStyle.Success,
  'danger': ButtonStyle.Danger,
  'secondary': ButtonStyle.Secondary
};

// -------------------
// Express Dashboard Server
// -------------------
const app = express();
app.use(express.json());
app.use(express.static('public')); // Statische Dateien (HTML/CSS/JS) im public-Ordner

// Endpoint Embeds
app.post("/embed", async (req,res) => {
  const { titel, beschreibung, farbe, footer, bild, feldName, feldWert } = req.body;
  try {
    const channel = client.channels.cache.first();
    const embed = new EmbedBuilder()
      .setTitle(titel)
      .setDescription(beschreibung.replace(/\\n/g,"\n"))
      .setColor(farbe || "#0099ff");
    if(footer) embed.setFooter({text:footer});
    if(bild) embed.setImage(bild);
    if(feldName && feldWert) embed.addFields({name:feldName,value:feldWert});
    await channel.send({ embeds:[embed] });
    res.send("Embed erfolgreich gesendet ✅");
  } catch(err) {
    console.error(err);
    res.status(500).send("Fehler beim Senden des Embeds ❌");
  }
});

// Endpoint Buttons
app.post("/buttons", async (req,res) => {
  const { nachrichtenid, label, style, actiontype, actionvalue, emoji } = req.body;
  try {
    const channel = client.channels.cache.first();
    const message = await channel.messages.fetch(nachrichtenid);
    const row = new ActionRowBuilder();
    const button = new ButtonBuilder()
      .setCustomId(`dynbtn_${Date.now()}_${Math.floor(Math.random()*1000)}`)
      .setLabel(label)
      .setStyle(styleMap[style] || ButtonStyle.Primary)
      .setEmoji(emoji || null);
    row.addComponents(button);
    client.buttonActions[button.data.custom_id] = { type: actiontype, value: actionvalue };
    await message.edit({ components: [row] });
    res.send("Button erfolgreich hinzugefügt ✅");
  } catch(err) {
    console.error(err);
    res.status(500).send("Nachricht nicht gefunden oder keine Rechte ❌");
  }
});

// -------------------
// Discord Slash Commands
// -------------------
const commands = [
  new SlashCommandBuilder()
    .setName('embed')
    .setDescription('Erstellt einen standalone Embed')
    .addStringOption(opt => opt.setName('titel').setDescription('Titel des Embeds').setRequired(true))
    .addStringOption(opt => opt.setName('beschreibung').setDescription('Beschreibung des Embeds').setRequired(true))
    .addStringOption(opt => opt.setName('farbe').setDescription('Hex-Farbe z.B. #ff0000').setRequired(false))
    .addStringOption(opt => opt.setName('footer').setDescription('Footer Text').setRequired(false))
    .addStringOption(opt => opt.setName('bild').setDescription('Bild URL').setRequired(false))
    .addStringOption(opt => opt.setName('feldname').setDescription('Optional: Name für ein Embed-Feld').setRequired(false))
    .addStringOption(opt => opt.setName('feldwert').setDescription('Optional: Wert für das Embed-Feld').setRequired(false))
].map(cmd => cmd.toJSON());

const rest = new REST({ version: '10' }).setToken(TOKEN);
(async () => {
  try {
    await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commands });
    console.log('Slash Commands registriert ✅');
  } catch (err) {
    console.error('Fehler beim Registrieren der Commands:', err);
  }
})();

// -------------------
// Discord Ready Event
// -------------------
client.once('ready', async () => {
  console.log(`✅ Bot online als ${client.user.tag}`);
  // Optional: Embeds automatisch aus embed.json senden
  if(fs.existsSync('./embed.json')) {
    try {
      const embeds = JSON.parse(fs.readFileSync('./embed.json','utf-8'));
      const channel = client.channels.cache.first();
      for(const e of embeds) {
        const embed = new EmbedBuilder()
          .setTitle(e.titel)
          .setDescription(e.beschreibung.replace(/\\n/g,"\n"))
          .setColor(e.farbe || '#0099ff');
        if(e.footer) embed.setFooter({text:e.footer});
        if(e.bild) embed.setImage(e.bild);
        if(e.feldName && e.feldWert) embed.addFields({name:e.feldName,value:e.feldWert});
        await channel.send({ embeds:[embed] });
      }
    } catch(err) { console.error("Fehler beim Einlesen von embed.json:", err); }
  }
});

// -------------------
// Discord Interaction Handler
// -------------------
client.on('interactionCreate', async interaction => {
  if(interaction.isChatInputCommand() && interaction.commandName === 'embed') {
    const titel = interaction.options.getString('titel');
    const beschreibung = interaction.options.getString('beschreibung');
    const farbe = interaction.options.getString('farbe') || '#0099ff';
    const footer = interaction.options.getString('footer') || '';
    const bild = interaction.options.getString('bild');
    const feldName = interaction.options.getString('feldname');
    const feldWert = interaction.options.getString('feldwert');

    const embed = new EmbedBuilder()
      .setTitle(titel)
      .setDescription(beschreibung.replace(/\\n/g,"\n"))
      .setColor(farbe);
    if(footer) embed.setFooter({text:footer});
    if(bild) embed.setImage(bild);
    if(feldName && feldWert) embed.addFields({name:feldName,value:feldWert});

    await interaction.deferReply({ ephemeral:true });
    await interaction.channel.send({ embeds:[embed] });
    await interaction.followUp({ content:"Embed gesendet ✅", ephemeral:true });
  }

  if(interaction.isButton()) {
    const action = client.buttonActions[interaction.customId];
    if(!action) return;
    switch(action.type) {
      case 'text':
        await interaction.reply({ content: action.value, ephemeral:true });
        break;
      case 'role':
        const role = interaction.guild.roles.cache.get(action.value);
        if(!role) return interaction.reply({ content:'Rolle nicht gefunden ❌', ephemeral:true });
        const member = interaction.member;
        if(member.roles.cache.has(role.id)) member.roles.remove(role.id);
        else member.roles.add(role.id);
        await interaction.reply({ content:`Rolle ${role.name} angepasst ✅`, ephemeral:true });
        break;
      case 'editembed':
        if(interaction.message.embeds.length>0) {
          const newEmbed = EmbedBuilder.from(interaction.message.embeds[0]).setColor(action.value);
          await interaction.update({ embeds:[newEmbed] });
        } else await interaction.reply({ content:'Keine Embed-Nachricht gefunden 😅', ephemeral:true });
        break;
      case 'command':
        await interaction.reply({ content:`Slash Command "${action.value}" bitte manuell ausführen`, ephemeral:true });
        break;
      default:
        await interaction.reply({ content:'Unbekannte Aktion ❌', ephemeral:true });
    }
  }
});

// -------------------
// Express Server starten
// -------------------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🌐 Dashboard läuft auf Port ${PORT}`));
client.login(TOKEN);
