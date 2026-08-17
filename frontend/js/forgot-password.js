document.getElementById('forgotForm').addEventListener('submit',async e=>{
 e.preventDefault();const error=document.getElementById('errorMsg'),success=document.getElementById('successMsg');
 error.style.display='none';success.style.display='none';
 try{const data=await api('/auth/forgot-password',{method:'POST',auth:false,body:{email:document.getElementById('email').value.trim()}});
 success.textContent=data.message;success.style.display='block';
 }catch(err){error.textContent=err.message;error.style.display='block';}
});