const loginBtn = document.getElementById('loginBtn');
const embedForm = document.getElementById('embedForm');
const guildDropdown = document.getElementById('guildDropdown');
const channelDropdown = document.getElementById('channelDropdown');
const embedPreview = document.getElementById('embedPreview');
const userInfo = document.getElementById('userInfo');

loginBtn.addEventListener('click',()=>{ window.location.href='/login'; });

// OAuth2 Parameter aus URL
const params = new URLSearchParams(window.location.search);
if(params.has('username')){
  const username = params.get('username');
  const discriminator = params.get('discriminator');
  userInfo.innerHTML = `Angemeldet als <strong>${username}#${discriminator}</strong>`;

  const guilds = JSON.parse(decodeURIComponent(params.get('guilds')));
  guildDropdown.innerHTML = '';
  guilds.forEach(g => {
    const opt = document.createElement('option');
    opt.value = g.id;
    opt.textContent = g.name;
    guildDropdown.appendChild(opt);
  });
  loadChannels(guildDropdown.value);
}

// Channels laden bei Guild-Änderung
guildDropdown.addEventListener('change',()=>loadChannels(guildDropdown.value));
async function loadChannels(guildId){
  channelDropdown.innerHTML = '<option>Lade Channels...</option>';
  try{
    const res = await fetch(`/channels/${guildId}`);
    const channels = await res.json();
    channelDropdown.innerHTML = '';
    channels.forEach(c=>{
      const opt = document.createElement('option');
      opt.value = c.id;
      opt.textContent = c.name;
      channelDropdown.appendChild(opt);
    });
  }catch(err){ channelDropdown.innerHTML='<option>Fehler beim Laden</option>'; }
}

// Live Preview
function updatePreview(){
  const titel = document.getElementById('titel').value;
  const beschreibung = document.getElementById('beschreibung').value;
  embedPreview.innerHTML=`<strong>${titel}</strong><p>${beschreibung}</p>`;
}
document.querySelectorAll('#titel,#beschreibung').forEach(el=>el.addEventListener('input',updatePreview));

// Embed senden
embedForm.addEventListener('submit', async e=>{
  e.preventDefault();
  const payload = {
    titel: document.getElementById('titel').value,
    beschreibung: document.getElementById('beschreibung').value,
    farbe: document.getElementById('farbe').value,
    footer: document.getElementById('footer').value,
    bild: document.getElementById('bild').value,
    feldName: document.getElementById('feldname').value,
    feldWert: document.getElementById('feldwert').value,
    channelId: channelDropdown.value
  };
  try{
    const res = await fetch('/sendEmbed',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify(payload)
    });
    const data = await res.json();
    alert(data.message);
  }catch(err){ console.error(err); alert('Fehler beim Senden'); }
});
