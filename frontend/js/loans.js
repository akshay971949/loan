const user = guardPage(['admin', 'staff']);
if (user) {
  document.getElementById('whoName').textContent = user.name;
  document.getElementById('whoEmail').textContent = user.email;
}
document.getElementById('logoutBtn').addEventListener('click', e => { e.preventDefault(); clearSession(); window.location.href='user-login.html'; });

const urlParams = new URLSearchParams(window.location.search);
const filterCustomerId = urlParams.get('customer_id');
let editingLoanId = null;
let syncing = false;

function statusBadge(status){ return `<span class="badge badge-${status}">${status}</span>`; }

async function loadLoans(){
  const rows=await api('/loans');
  const filtered=filterCustomerId ? rows.filter(r=>String(r.customer_id)===filterCustomerId):rows;
  const body=document.getElementById('loansBody'), empty=document.getElementById('loansEmpty');
  if(!filtered.length){body.innerHTML='';empty.style.display='block';return;}
  empty.style.display='none';
  body.innerHTML=filtered.map(l=>`
    <tr>
      <td><a href="loan-details.html?id=${l.id}">#${l.id}</a></td>
      <td>${l.full_name}</td><td>${l.loan_type}</td>
      <td class="right money">${formatMoney(l.principal_amount)}</td>
      <td>${Number(l.interest_rate).toFixed(2)}%</td>
      <td>${l.tenure_months} mo</td>
      <td class="right money">${formatMoney(l.emi_amount)}</td>
      <td>${statusBadge(l.status)}</td>
      <td>
        <a class="btn btn-ghost btn-sm" href="loan-details.html?id=${l.id}">View</a>
        ${user.role==='admin'?`<button class="btn btn-ghost btn-sm" onclick="editLoan(${l.id})">Edit</button>
        <button class="btn btn-ghost btn-sm" onclick="removeLoan(${l.id})">Remove</button>`:''}
      </td>
    </tr>`).join('');
}

async function loadCustomerOptions(selectedId){
  const customers=await api('/customers');
  const select=document.getElementById('l_customer');
  select.innerHTML=customers.map(c=>`<option value="${c.id}">${c.full_name} — ${c.phone}</option>`).join('');
  if(selectedId) select.value=selectedId;
}

function clearLoanInputs(){
  ['l_principal','l_rate','l_emi','l_tenure'].forEach(id=>document.getElementById(id).value='');
  document.getElementById('l_type').value='Personal';
  document.getElementById('l_start').value=new Date().toISOString().slice(0,10);
  document.getElementById('emiPreview').textContent='';
}
function calcEmi(p,r,n){
  if(!p||!n||r===null||r==='') return null;
  r=Number(r)/100; if(r===0)return p/n;
  const f=Math.pow(1+r,n); return (p*r*f)/(f-1);
}
function solveRate(p,emi,n){
  if(!p||!emi||!n)return null;
  if(emi===p/n)return 0;
  if(emi<p/n)return null;
  const payment=r=>r===0?p/n:(p*r*Math.pow(1+r,n))/(Math.pow(1+r,n)-1);
  let lo=0,hi=1;if(payment(hi)<emi)return null;
  for(let i=0;i<80;i++){const mid=(lo+hi)/2;if(payment(mid)<emi)lo=mid;else hi=mid;}
  return ((lo+hi)/2)*100;
}
function syncFromRate(){
  if(syncing)return; syncing=true;
  const p=Number(document.getElementById('l_principal').value), r=document.getElementById('l_rate').value, n=Number(document.getElementById('l_tenure').value);
  const emi=calcEmi(p,r,n);
  document.getElementById('l_emi').value=emi?emi.toFixed(2):'';
  document.getElementById('emiPreview').textContent=emi?`EMI: ${formatMoney(emi)} / month`:'';
  syncing=false;
}
function syncFromEmi(){
  if(syncing)return; syncing=true;
  const p=Number(document.getElementById('l_principal').value), emi=Number(document.getElementById('l_emi').value), n=Number(document.getElementById('l_tenure').value);
  const rate=solveRate(p,emi,n);
  document.getElementById('l_rate').value=rate===null?'':rate.toFixed(4);
  document.getElementById('emiPreview').textContent=emi?`Monthly interest rate: ${rate===null?'not possible':rate.toFixed(4)+'%'}`:'';
  syncing=false;
}
document.getElementById('l_rate').addEventListener('input',syncFromRate);
document.getElementById('l_emi').addEventListener('input',syncFromEmi);
['l_principal','l_tenure'].forEach(id=>document.getElementById(id).addEventListener('input',()=> {
  if(document.activeElement && document.activeElement.id==='l_emi') syncFromEmi(); else syncFromRate();
}));

document.getElementById('addBtn').addEventListener('click',async()=>{
  editingLoanId=null; document.getElementById('loanModalTitle').textContent='New loan';
  document.getElementById('loanSave').textContent='Create loan';
  document.getElementById('loanError').style.display='none'; clearLoanInputs();
  await loadCustomerOptions(filterCustomerId); document.getElementById('loanModal').classList.add('open');
});
document.getElementById('loanCancel').addEventListener('click',()=>document.getElementById('loanModal').classList.remove('open'));

async function editLoan(id){
  try{
    const {loan}=await api(`/loans/${id}`);
    editingLoanId=id; document.getElementById('loanModalTitle').textContent='Edit loan';
    document.getElementById('loanSave').textContent='Save changes';
    document.getElementById('loanError').style.display='none';
    await loadCustomerOptions(loan.customer_id);
    document.getElementById('l_type').value=loan.loan_type||'Personal';
    document.getElementById('l_principal').value=loan.principal_amount;
    document.getElementById('l_rate').value=Number(loan.interest_rate).toFixed(4);
    document.getElementById('l_emi').value=Number(loan.emi_amount).toFixed(2);
    document.getElementById('l_tenure').value=loan.tenure_months;
    document.getElementById('l_start').value=String(loan.start_date).slice(0,10);
    document.getElementById('emiPreview').textContent=`EMI: ${formatMoney(loan.emi_amount)} / month`;
    document.getElementById('loanModal').classList.add('open');
  }catch(err){alert(err.message);}
}
async function removeLoan(id){
  if(!confirm('Remove this loan and its entire EMI schedule? This cannot be undone.'))return;
  try{await api(`/loans/${id}`,{method:'DELETE'});loadLoans();}catch(err){alert(err.message);}
}

document.getElementById('loanSave').addEventListener('click',async()=>{
  const errorMsg=document.getElementById('loanError');errorMsg.style.display='none';
  const body={
    customer_id:document.getElementById('l_customer').value,
    loan_type:document.getElementById('l_type').value.trim()||'Personal',
    principal_amount:document.getElementById('l_principal').value,
    interest_rate:document.getElementById('l_rate').value,
    emi_amount:document.getElementById('l_emi').value,
    tenure_months:document.getElementById('l_tenure').value,
    start_date:document.getElementById('l_start').value
  };
  if(!body.customer_id||!body.principal_amount||!body.tenure_months||!body.start_date||(!body.interest_rate&&!body.emi_amount)){
    errorMsg.textContent='Customer, principal, tenure, start date and either monthly interest rate or EMI are required';
    errorMsg.style.display='block';return;
  }
  try{
    await api(editingLoanId?`/loans/${editingLoanId}`:'/loans',{method:editingLoanId?'PUT':'POST',body});
    document.getElementById('loanModal').classList.remove('open');
    loadLoans();
    if(editingLoanId) window.location.href=`loan-details.html?id=${editingLoanId}`;
    else loadLoans();
  }catch(err){errorMsg.textContent=err.message;errorMsg.style.display='block';}
});
document.getElementById('exportBtn').addEventListener('click',()=>downloadCsv('/export/loans','loans.csv').catch(err=>alert(err.message)));
loadLoans();
if(user && user.role!=='admin'){const x=document.getElementById('staffNavLink');if(x)x.style.display='none';}
