// ---------------- Dashboard JS ----------------
document.addEventListener("DOMContentLoaded", async () => {

  // ---------------- User info ----------------
  const params = new URLSearchParams(window.location.search);
  document.getElementById("username").innerText = params.get("username")||"User";
  document.getElementById("discriminator").innerText = params.get("discriminator")||"0000";

  // ---------------- Load Channels ----------------
  async function loadChannels() {
    const res = await fetch("/channels");
    const data = await res.json();
    const chSelect = document.getElementById("channel");
    const btnChSelect = document.getElementById("btnChannel");
    chSelect.innerHTML = "";
    btnChSelect.innerHTML = "";
    data.forEach(ch=>{
      const opt1 = document.createElement("option");
      opt1.value=ch.id; opt1.textContent=ch.name; chSelect.appendChild(opt1);
      const opt2 = document.createElement("option");
      opt2.value=ch.id; opt2.textContent=ch.name; btnChSelect.appendChild(opt2);
    });
  }
  loadChannels();

  // ---------------- Embed Vorschau ----------------
  const previewBox = document.getElementById("preview-box");
  const beschreibungInput = document.getElementById("beschreibung");
  const titelInput = document.getElementById("titel");
  const footerInput = document.getElementById("footer");
  const feldNameInput = document.getElementById("feldName");
  const feldWertInput = document.getElementById("feldWert");

  function updatePreview() {
    let text = `<strong>${titelInput.value}</strong><br>${beschreibungInput.value.replace(/\\n/g,"<br>")}`;
    if(footerInput.value) text+=`<br><em>${footerInput.value}</em>`;
    if(feldNameInput.value && feldWertInput.value) text+=`<br><strong>${feldNameInput.value}</strong>: ${feldWertInput.value}`;
    previewBox.innerHTML=text;
  }

  [titelInput,beschreibungInput,footerInput,feldNameInput,feldWertInput].forEach(el=>el.addEventListener("input",updatePreview));

  // ---------------- Embed Form Submit ----------------
  document.getElementById("embed-form").addEventListener("submit", async e=>{
    e.preventDefault();
    const data = {
      titel:titelInput.value,
      beschreibung:beschreibungInput.value,
      farbe:document.getElementById("farbe").value,
      footer:footerInput.value,
      bild:document.getElementById("bild").value,
      feldName:feldNameInput.value,
      feldWert:feldWertInput.value,
      channelId:document.getElementById("channel").value
    };
    const res = await fetch("/embed",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(data)});
    alert(await res.text());
  });

  // ---------------- Button Form Submit ----------------
  document.getElementById("button-form").addEventListener("submit", async e=>{
    e.preventDefault();
    const data = {
      nachrichtenid:document.getElementById("msgId").value,
      label:document.getElementById("btnLabel").value,
      style:document.getElementById("btnStyle").value,
      actiontype:document.getElementById("actionType").value,
      actionvalue:document.getElementById("actionValue").value,
      emoji:document.getElementById("emoji").value,
      channelId:document.getElementById("btnChannel").value
    };
    const res = await fetch("/buttons",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(data)});
    alert(await res.text());
  });
});
