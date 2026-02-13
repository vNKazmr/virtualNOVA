const loginBtn = document.getElementById('loginBtn');
const embedForm = document.getElementById('embedForm');
const channelDropdown = document.getElementById('channelDropdown');
const embedPreview = document.getElementById('embedPreview');
const userInfo = document.getElementById('userInfo');

loginBtn.addEventListener('click',()=>{ window.location.href='/login'; });

const params = new URLSearchParams(window.location.search);
if(params.has('username')){
  userInfo.innerHTML = `Angemeldet als <strong>${params.get('username')}#${params.get('discriminator')}</strong>`;
}

// Channels laden
async function loadChannels(){
  try{
    const res = await fetch('/channels');
    const channels = await res.json();
    channelDropdown.innerHTML='';
    channels.forEach(c=>{
      const opt = document.createElement('option');
      opt.value=c.id;
      opt.textContent=c.name;
      channelDropdown.appendChild(opt);
    });
  }catch(err){ channelDropdown.innerHTML='<option>Fehler beim Laden</option>'; }
}
loadChannels();

// Live Vorschau
function updatePreview(){
  const titel = document.getElementById('titel').value;
  const beschreibung = document.getElementById('beschreibung').value;
  embedPreview.innerHTML=`<strong>${titel}</strong><p>${beschreibung}</p>`;
}
document.querySelectorAll('#titel,#beschreibung').forEach(el=>el.addEventListener('input',updatePreview));

// Embed senden
embedForm.addEventListener('submit',async e=>{
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
