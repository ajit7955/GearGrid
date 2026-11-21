
const BASE=process.env.NEXT_PUBLIC_API_URL||"http://localhost:5000";
export async function api(path,options={}){
 const res=await fetch(`${BASE}/api${path}`,{...options,credentials:"include",headers:{"Content-Type":"application/json",...(options.headers||{})},cache:"no-store"});
 const data=await res.json().catch(()=>({}));
 if(!res.ok) throw new Error(data.message||"Request failed");
 return data;
}
