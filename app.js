const $ = (selector, root = document) => root.querySelector(selector);
const state = { token: sessionStorage.getItem('aster-doctor-token'), patients: [], selectedFile: null };
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const initials = name => name.split(/\s+/).slice(0,2).map(part => part[0]).join('').toUpperCase();
const dateText = value => new Date(`${value}T12:00:00`).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'});
$('#today').textContent = new Date().toLocaleDateString('en-IN',{weekday:'short',day:'numeric',month:'short',year:'numeric'});
$('#year').textContent = new Date().getFullYear();
function showApp(doctor) {
  $('#login-panel').classList.add('hidden'); $('#app-view').classList.remove('hidden');
  $('#doctor-name').textContent = doctor.name; $('#doctor-role').textContent = `${doctor.role} · Aster Eye Institute`;
  $('#avatar').textContent = initials(doctor.name); $('#logout').classList.remove('hidden');
  loadPatients();
}
function showLogin() {
  $('#app-view').classList.add('hidden'); $('#login-panel').classList.remove('hidden');
  $('#doctor-name').textContent = 'Doctor access'; $('#doctor-role').textContent = 'Sign in to continue'; $('#avatar').textContent = 'D'; $('#logout').classList.add('hidden');
  sessionStorage.removeItem('aster-doctor-token'); state.token = null;
}
async function api(path, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (state.token) headers.Authorization = `Bearer ${state.token}`;
  const response = await fetch(path, { ...options, headers });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Request failed');
  return data;
}
$('#login-form').addEventListener('submit', async event => {
  event.preventDefault(); const error = $('#login-error'); error.textContent = '';
  const form = new FormData(event.currentTarget);
  try { const result = await api('/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(Object.fromEntries(form.entries()))}); state.token=result.token;sessionStorage.setItem('aster-doctor-token',state.token);showApp(result.doctor); }
  catch (err) { error.textContent = err.message || 'Unable to sign in.'; }
});
$('#logout').addEventListener('click', showLogin);
async function loadPatients() {
  $('#patient-list').innerHTML = '<div class="loading">Loading clinic records…</div>';
  try {
    const result = await api('/api/patients'); state.patients=result.patients;
    $('#patient-count').textContent=state.patients.length;$('#report-count').textContent=state.patients.filter(p=>p.report).length;
    $('#patient-select').innerHTML='<option value="">Select a patient</option>'+state.patients.map(p=>`<option value="${esc(p.id)}">${esc(p.name)} · ${esc(p.id)}</option>`).join('');
    renderPatients();
  } catch (err) { if (err.message==='Session expired. Please sign in again.') showLogin(); $('#patient-list').innerHTML=`<div class="empty-state">${esc(err.message)}</div>`; }
}
function renderPatients() {
  const query=$('#patient-search').value.trim().toLowerCase();
  const patients=state.patients.filter(p=>`${p.name} ${p.id}`.toLowerCase().includes(query));
  $('#patient-list').innerHTML=patients.length?patients.map(p=>`<div class="patient-row"><span class="patient-initial">${esc(initials(p.name))}</span><span class="patient-info"><b>${esc(p.name)}</b><small>${esc(p.id)} · Last visit ${esc(dateText(p.lastVisit))}</small></span><span class="report-badge">Report ready</span><button data-report="${esc(p.id)}">View report →</button></div>`).join(''):'<div class="empty-state">No patients match that search.</div>';
  $('#patient-list').querySelectorAll('[data-report]').forEach(button=>button.addEventListener('click',()=>showReport(button.dataset.report)));
}
$('#patient-search').addEventListener('input',renderPatients);
function showReport(id) {
  const patient=state.patients.find(p=>p.id===id);if(!patient?.report)return;
  const r=patient.report;
  $('#report-modal').innerHTML=`<section class="modal" role="dialog" aria-modal="true" aria-labelledby="report-title"><div class="modal-head"><div><span class="eyebrow">ASTER EYE INSTITUTE · PATIENT REPORT</span><h2 id="report-title">${esc(patient.name)}</h2></div><button class="modal-close" data-close aria-label="Close report">×</button></div><p class="report-meta">${esc(patient.id)} · Visit ${esc(dateText(patient.lastVisit))} · ${esc(patient.age)} years · ${esc(patient.sex)}</p><div class="report-values"><div><small>VISUAL ACUITY · RIGHT</small><b>${esc(r.visualAcuity.right)}</b></div><div><small>VISUAL ACUITY · LEFT</small><b>${esc(r.visualAcuity.left)}</b></div><div><small>INTRAOCULAR PRESSURE · RIGHT</small><b>${esc(r.pressure.right)} mmHg</b></div><div><small>INTRAOCULAR PRESSURE · LEFT</small><b>${esc(r.pressure.left)} mmHg</b></div></div><div class="report-section"><h3>Clinical notes</h3><p>${esc(r.notes)}</p></div><div class="report-section"><h3>Plan</h3><p>${esc(r.plan)}</p></div><p class="modal-note">Demonstration data only. This prototype is not a medical record system and is not suitable for clinical decisions.</p></section>`;
  $('#report-modal').classList.add('show');$('#report-modal').querySelector('[data-close]').addEventListener('click',closeReport);
}
function closeReport(){ $('#report-modal').classList.remove('show');$('#report-modal').innerHTML=''; }
$('#report-modal').addEventListener('click',event=>{if(event.target===$('#report-modal'))closeReport();});
document.addEventListener('keydown',event=>{if(event.key==='Escape')closeReport();});
$('#eye-file').addEventListener('change',event=>{
  const file=event.target.files?.[0]; if(!file)return;
  if(!file.type.startsWith('image/')){event.target.value='';return toast('Please choose an image file.');}
  if(file.size>8*1024*1024){event.target.value='';return toast('Choose an image smaller than 8 MB.');}
  state.selectedFile=file;$('#eye-preview').src=URL.createObjectURL(file);$('#preview-wrap').classList.remove('hidden');$('.upload-drop').classList.add('hidden');$('#verify-result').classList.add('hidden');
});
$('#clear-image').addEventListener('click',()=>{if($('#eye-preview').src.startsWith('blob:'))URL.revokeObjectURL($('#eye-preview').src);$('#eye-file').value='';state.selectedFile=null;$('#preview-wrap').classList.add('hidden');$('.upload-drop').classList.remove('hidden');});
function computeRgbProfile(file) {
  return new Promise((resolve,reject)=>{const image=new Image(),url=URL.createObjectURL(file);image.onload=()=>{
    const canvas=document.createElement('canvas'),size=96;canvas.width=size;canvas.height=size;const ctx=canvas.getContext('2d',{willReadFrequently:true});
    const scale=Math.max(size/image.width,size/image.height),width=image.width*scale,height=image.height*scale;ctx.drawImage(image,(size-width)/2,(size-height)/2,width,height);
    const pixels=ctx.getImageData(0,0,size,size).data, bins=8, channels=[new Array(bins).fill(0),new Array(bins).fill(0),new Array(bins).fill(0)];let count=0;
    for(let i=0;i<pixels.length;i+=4){if(pixels[i+3]<16)continue;for(let c=0;c<3;c++)channels[c][Math.min(bins-1,Math.floor(pixels[i+c]*bins/256))]++;count++;}
    URL.revokeObjectURL(url);resolve(channels.map(channel=>channel.map(n=>n/count)));
  };image.onerror=()=>{URL.revokeObjectURL(url);reject(new Error('Could not read that image.'));};image.src=url;});
}
function similarity(left,right){let distance=0;for(let c=0;c<3;c++)for(let i=0;i<8;i++)distance+=Math.abs(left[c][i]-right[c][i]);return Math.max(0,Math.round((1-distance/6)*100));}
$('#verify-form').addEventListener('submit',async event=>{
  event.preventDefault();const patientId=$('#patient-select').value,file=state.selectedFile;if(!patientId||!file)return;
  const resultBox=$('#verify-result'),button=$('#verify-button');button.disabled=true;button.textContent='Comparing RGB profile…';
  try{
    const patient=state.patients.find(p=>p.id===patientId),observed=await computeRgbProfile(file),score=similarity(observed,patient.rgbProfile),passed=score>=patient.matchThreshold;
    resultBox.className=`result ${passed?'success':'review'}`;resultBox.innerHTML=`<b>${passed?'RGB profile is similar':'RGB profile differs'}</b>Similarity score: ${score}% · Reference threshold: ${patient.matchThreshold}%. ${passed?'Proceed with your approved identity checks.':'Do not rely on this result; confirm identity using clinic procedure.'}`;
  }catch(err){resultBox.className='result review';resultBox.textContent=err.message||'Could not compare images.';}
  finally{button.disabled=false;button.innerHTML='Run RGB comparison <span>→</span>';resultBox.classList.remove('hidden');}
});
function toast(message){const el=$('#toast');el.textContent=message;el.classList.add('show');setTimeout(()=>el.classList.remove('show'),2400);}
async function restoreSession(){if(!state.token)return;try{const result=await api('/api/session');showApp(result.doctor);}catch{sessionStorage.removeItem('aster-doctor-token');state.token=null;}}
restoreSession();
