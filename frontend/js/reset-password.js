const token=new URLSearchParams(location.search).get('token');
document.getElementById('resetForm').addEventListener('submit',async e=>{
 e.preventDefault();const error=document.getElementById('errorMsg'),success=document.getElementById('successMsg');
 error.style.display='none';success.style.display='none';
 const password=document.getElementById('password').value,confirm=document.getElementById('confirm').value;
 if(password!==confirm){error.textContent='Passwords do not match';error.style.display='block';return;}
 if(!token){error.textContent='Reset link is missing or invalid';error.style.display='block';return;}
 try{const data=await api('/auth/reset-password',{method:'POST',auth:false,body:{token,new_password:password}});
 success.textContent=data.message;success.style.display='block';document.getElementById('resetForm').reset();
 }catch(err){error.textContent=err.message;error.style.display='block';}
});