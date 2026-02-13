document.addEventListener('DOMContentLoaded',async ()=>{
    const channelSelect = document.getElementById('channelSelect');
    const embedForm = document.getElementById('embedForm');
    const embedResult = document.getElementById('embedResult');

    // Channels laden
    const res = await fetch('/channels');
    const channels = await res.json();
    channels.forEach(ch=>{
        const opt = document.createElement('option');
        opt.value = ch.id;
        opt.textContent = ch.name;
        channelSelect.appendChild(opt);
    });

    // Embed senden
    embedForm.addEventListener('submit',async e=>{
        e.preventDefault();
        const formData = new FormData(embedForm);
        const data = {};
        formData.forEach((v,k)=>data[k]=v);
        const response = await fetch('/embed',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
        const text = await response.text();
        embedResult.textContent = text;
    });
});
