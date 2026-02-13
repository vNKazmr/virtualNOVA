require('dotenv').config();
const fs = require('fs');
const path = require('path');
const express = require('express');
const fetch = require('node-fetch');
const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

// ---------------- Environment ----------------
const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const GUILD_ID = process.env.GUILD_ID;
const REDIRECT_URI = process.env.REDIRECT_URI;
const PORT = process.env.PORT || 4539;

// ---------------- Discord Client ----------------
const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]
});

// Memory für Buttons
client.buttonActions = {};
const styleMap = { primary: ButtonStyle.Primary, success: ButtonStyle.Success, danger: ButtonStyle.Danger, secondary: ButtonStyle.Secondary };

// ---------------- JSON Loader ----------------
function loadJSON(file) { if(!fs.existsSync(file)) fs.writeFileSync(file,'[]'); return JSON.parse(fs.readFileSync(file,'utf8')); }
function saveJSON(file,data) { fs.writeFileSync(file,JSON.stringify(data,null,2)); }

// ---------------- Express Setup ----------------
const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname,'public')));

// ---------------- Discord OAuth2 ----------------
app.get("/auth/discord",(req,res)=>{
    const redirectUri = encodeURIComponent(REDIRECT_URI);
    res.redirect(`https://discord.com/api/oauth2/authorize?client_id=${CLIENT_ID}&redirect_uri=${redirectUri}&response_type=code&scope=identify%20guilds`);
});

app.get("/callback", async (req,res)=>{
    const code = req.query.code;
    if(!code) return res.send("Kein Code empfangen ❌");
    try{
        const params = new URLSearchParams();
        params.append("client_id", CLIENT_ID);
        params.append("client_secret", CLIENT_SECRET);
        params.append("grant_type","authorization_code");
        params.append("code",code);
        params.append("redirect_uri",REDIRECT_URI);
        params.append("scope","identify guilds");

        const tokenRes = await fetch("https://discord.com/api/oauth2/token",{
            method:"POST", body: params, headers: { "Content-Type":"application/x-www-form-urlencoded" }
        });
        const tokenData = await tokenRes.json();
        if(tokenData.error) return res.send("Fehler beim Token: "+tokenData.error);

        const userRes = await fetch("https://discord.com/api/users/@me",{
            headers:{Authorization:`Bearer ${tokenData.access_token}`}
        });
        const userData = await userRes.json();

        // Redirect direkt zum Dashboard mit Querystring
        res.redirect(`/dashboard.html?username=${encodeURIComponent(userData.username)}&discriminator=${userData.discriminator}`);
    }catch(err){ console.error(err); res.send("Fehler beim OAuth Callback ❌"); }
});

// ---------------- Get Guild Channels ----------------
app.get("/channels", async (req,res)=>{
    try{
        const guild = await client.guilds.fetch(GUILD_ID);
        const channels = await guild.channels.fetch();
        const data = Array.from(channels.values()).filter(c=>c.isText()).map(c=>({id:c.id,name:c.name}));
        res.json(data);
    }catch(err){ console.error(err); res.status(500).json([]); }
});

// ---------------- Send Embed ----------------
app.post("/embed", async (req,res)=>{
    const { titel,beschreibung,farbe,footer,bild,feldName,feldWert,channelId } = req.body;
    try{
        const channel = await client.channels.fetch(channelId);
        const embed = new EmbedBuilder()
            .setTitle(titel)
            .setDescription(beschreibung.replace(/\\n/g,"\n"))
            .setColor(farbe||"#0099ff");
        if(footer) embed.setFooter({text:footer});
        if(bild) embed.setImage(bild);
        if(feldName && feldWert) embed.addFields({name:feldName,value:feldWert});
        await channel.send({embeds:[embed]});

        const embeds = loadJSON('./embed.json');
        embeds.push({titel,beschreibung,farbe,footer,bild,feldName,feldWert,channelId});
        saveJSON('./embed.json',embeds);

        res.send("✅ Embed gesendet!");
    }catch(err){ console.error(err); res.status(500).send("❌ Fehler beim Senden des Embeds"); }
});

// ---------------- Add Button ----------------
app.post("/buttons", async (req,res)=>{
    const { nachrichtenid,label,style,actiontype,actionvalue,emoji,channelId } = req.body;
    try{
        const channel = await client.channels.fetch(channelId);
        const message = await channel.messages.fetch(nachrichtenid);

        const row = new ActionRowBuilder();
        const button = new ButtonBuilder()
            .setCustomId(`dynbtn_${Date.now()}_${Math.floor(Math.random()*1000)}`)
            .setLabel(label)
            .setStyle(styleMap[style]||ButtonStyle.Primary)
            .setEmoji(emoji||null);

        row.addComponents(button);
        client.buttonActions[button.data.custom_id] = {type:actiontype,value:actionvalue};
        await message.edit({components:[row]});

        const buttons = loadJSON('./buttons.json');
        buttons.push({nachrichtenid,label,style,actiontype,actionvalue,emoji,channelId});
        saveJSON('./buttons.json',buttons);

        res.send("✅ Button hinzugefügt!");
    }catch(err){ console.error("Button konnte nicht hinzugefügt werden:",err); res.status(500).send("❌ Nachricht nicht gefunden oder keine Rechte"); }
});

// ---------------- Interaction Handler ----------------
client.on("interactionCreate", async interaction=>{
    if(interaction.isButton()){
        const action = client.buttonActions[interaction.customId];
        if(!action) return;
        switch(action.type){
            case "text": await interaction.reply({content:action.value,ephemeral:true}); break;
            case "role":
                const role = interaction.guild.roles.cache.get(action.value);
                if(!role) return interaction.reply({content:"Rolle nicht gefunden",ephemeral:true});
                const member = interaction.member;
                if(member.roles.cache.has(role.id)) member.roles.remove(role.id);
                else member.roles.add(role.id);
                await interaction.reply({content:`Rolle ${role.name} angepasst`,ephemeral:true}); break;
            case "editembed":
                if(interaction.message.embeds.length>0){
                    const newEmbed = EmbedBuilder.from(interaction.message.embeds[0]).setColor(action.value);
                    await interaction.update({embeds:[newEmbed]});
                }else await interaction.reply({content:"Keine Embed Nachricht",ephemeral:true});
                break;
            case "command":
                await interaction.reply({content:`Bitte Slash Command "${action.value}" manuell ausführen`,ephemeral:true});
                break;
            default: await interaction.reply({content:"Unbekannte Aktion",ephemeral:true});
        }
    }
});

// ---------------- Load Buttons on Startup ----------------
client.once("ready", async ()=>{
    console.log(`✅ Bot online als ${client.user.tag}`);
    const buttons = loadJSON('./buttons.json');
    for(const b of buttons){
        try{
            const channel = await client.channels.fetch(b.channelId);
            const message = await channel.messages.fetch(b.nachrichtenid);
            const row = new ActionRowBuilder();
            const button = new ButtonBuilder()
                .setCustomId(`dynbtn_${Date.now()}_${Math.floor(Math.random()*1000)}`)
                .setLabel(b.label)
                .setStyle(styleMap[b.style]||ButtonStyle.Primary)
                .setEmoji(b.emoji||null);
            row.addComponents(button);
            client.buttonActions[button.data.custom_id] = {type:b.actiontype,value:b.actionvalue};
            await message.edit({components:[row]});
        }catch(err){
            console.log(`Nachricht ${b.nachrichtenid} nicht gefunden.`);
        }
    }
});

// ---------------- Start Server ----------------
app.listen(PORT,()=>console.log(`🌐 Dashboard läuft auf Port ${PORT}`));
client.login(TOKEN);
