
import { Router } from "express";
import { pool } from "../db/pool.js";
import { requireAuth, allowRoles } from "../middleware/auth.js";
import Stripe from "stripe";

const router = Router();
const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null;
const asyncRoute = fn => (req,res,next) => Promise.resolve(fn(req,res,next)).catch(next);

router.get("/health", (req,res)=>res.json({ok:true, service:"GearGrid API"}));
router.get("/categories", (req,res)=>res.json(["Construction Equipment","Photography Equipment","Vehicles & Transportation","Agriculture Equipment","Electronics","Event Equipment"]));

router.get("/equipment", asyncRoute(async(req,res)=>{
  const { search="", category="", rentalType="", availability="", minPrice="", maxPrice="", sort="recent", page="1", limit="9", status="Approved" } = req.query;
  const values=[]; const where=[];
  const add=(v)=>{values.push(v);return `$${values.length}`};
  if(status!=="all") where.push(`e.status=${add(status)}`);
  if(search) { const p=add(`%${search}%`); where.push(`(e.name ILIKE ${p} OR e.location ILIKE ${p} OR e.category ILIKE ${p})`); }
  if(category) where.push(`e.category=${add(category)}`);
  if(rentalType) where.push(`e.rental_type=${add(rentalType)}`);
  if(availability==="available") where.push("e.available_quantity > 0");
  if(availability==="unavailable") where.push("e.available_quantity = 0");
  if(minPrice!=="") where.push(`e.rental_price >= ${add(Number(minPrice))}`);
  if(maxPrice!=="") where.push(`e.rental_price <= ${add(Number(maxPrice))}`);
  const order = sort==="price-asc" ? "e.rental_price ASC" : sort==="price-desc" ? "e.rental_price DESC" : "e.created_at DESC";
  const pageNum=Math.max(1,Number(page)||1), pageSize=Math.min(30,Math.max(1,Number(limit)||9));
  const count=await pool.query(`SELECT COUNT(*)::int AS total FROM equipment e ${where.length?"WHERE "+where.join(" AND "):""}`,values);
  const offsetParam=add((pageNum-1)*pageSize), limitParam=add(pageSize);
  const result=await pool.query(`SELECT e.*, e.owner_id AS "ownerId" FROM equipment e ${where.length?"WHERE "+where.join(" AND "):""} ORDER BY ${order} LIMIT ${limitParam} OFFSET ${offsetParam}`,values);
  res.json({items:result.rows,total:count.rows[0].total,page:pageNum,pages:Math.ceil(count.rows[0].total/pageSize)});
}));
router.get("/equipment/featured", asyncRoute(async(req,res)=>{
 const r=await pool.query("SELECT * FROM equipment WHERE status='Approved' ORDER BY created_at DESC LIMIT 6"); res.json(r.rows);
}));
router.get("/equipment/:id", asyncRoute(async(req,res)=>{
 const r=await pool.query("SELECT e.*, u.name AS owner_name, u.email AS owner_email FROM equipment e LEFT JOIN \"user\" u ON u.id=e.owner_id WHERE e.id=$1 AND e.status='Approved'",[req.params.id]);
 if(!r.rowCount) return res.status(404).json({message:"Equipment not found"});
 res.json(r.rows[0]);
}));
router.post("/equipment", requireAuth, allowRoles("Owner","Admin"), asyncRoute(async(req,res)=>{
 const {name,description,category,location,rental_price,rental_type,available_quantity,condition,brand,model,image_url,terms}=req.body;
 if(!name||!description||!category||!location||!rental_price||!rental_type) return res.status(400).json({message:"Please complete required fields."});
 const r=await pool.query(`INSERT INTO equipment(owner_id,name,description,category,location,rental_price,rental_type,available_quantity,condition,brand,model,image_url,terms)
 VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
 [req.user.id,name,description,category,location,rental_price,rental_type,available_quantity||1,condition||"Good",brand||"",model||"",image_url||"",terms||""]);
 res.status(201).json(r.rows[0]);
}));
router.patch("/equipment/:id", requireAuth, asyncRoute(async(req,res)=>{
 const existing=await pool.query("SELECT * FROM equipment WHERE id=$1",[req.params.id]);
 if(!existing.rowCount) return res.status(404).json({message:"Not found"});
 if(req.user.role!=="Admin" && existing.rows[0].owner_id!==req.user.id) return res.status(403).json({message:"Not your equipment"});
 const allowed=["name","description","category","location","rental_price","rental_type","available_quantity","condition","brand","model","image_url","terms","status"];
 if(req.user.role!=="Admin") allowed.splice(allowed.indexOf("status"),1);
 const keys=allowed.filter(k=>req.body[k]!==undefined);
 if(!keys.length) return res.json(existing.rows[0]);
 const vals=keys.map(k=>req.body[k]); const set=keys.map((k,i)=>`${k}=$${i+1}`).join(",");
 vals.push(req.params.id);
 const r=await pool.query(`UPDATE equipment SET ${set},updated_at=NOW() WHERE id=$${vals.length} RETURNING *`,vals); res.json(r.rows[0]);
}));
router.delete("/equipment/:id", requireAuth, asyncRoute(async(req,res)=>{
 const r=await pool.query("DELETE FROM equipment WHERE id=$1 AND (owner_id=$2 OR $3='Admin') RETURNING id",[req.params.id,req.user.id,req.user.role]);
 if(!r.rowCount) return res.status(404).json({message:"Equipment not found or not yours"});
 res.json({message:"Equipment deleted"});
}));

router.get("/favorites",requireAuth,asyncRoute(async(req,res)=>{
 const r=await pool.query("SELECT e.* FROM favorites f JOIN equipment e ON e.id=f.equipment_id WHERE f.user_id=$1 ORDER BY f.created_at DESC",[req.user.id]);res.json(r.rows);
}));
router.post("/favorites/:equipmentId",requireAuth,asyncRoute(async(req,res)=>{
 await pool.query("INSERT INTO favorites(user_id,equipment_id) VALUES($1,$2) ON CONFLICT DO NOTHING",[req.user.id,req.params.equipmentId]);res.status(201).json({message:"Added to favorites"});
}));
router.delete("/favorites/:equipmentId",requireAuth,asyncRoute(async(req,res)=>{
 await pool.query("DELETE FROM favorites WHERE user_id=$1 AND equipment_id=$2",[req.user.id,req.params.equipmentId]);res.json({message:"Removed"});
}));

router.post("/bookings/checkout",requireAuth,allowRoles("Customer"),asyncRoute(async(req,res)=>{
 if(!stripe) return res.status(503).json({message:"Stripe is not configured yet."});
 const {equipmentId,startDate,endDate,quantity,contactNumber,deliveryAddress,notes=""}=req.body;
 const start=new Date(startDate),end=new Date(endDate),qty=Number(quantity);
 if(!equipmentId||!Number.isFinite(start.getTime())||!Number.isFinite(end.getTime())||end<=start||qty<1||!contactNumber||!deliveryAddress) return res.status(400).json({message:"Invalid booking information."});
 const client=await pool.connect();
 try{
  await client.query("BEGIN");
  const item=await client.query("SELECT * FROM equipment WHERE id=$1 AND status='Approved' FOR UPDATE",[equipmentId]);
  if(!item.rowCount) throw Object.assign(new Error("Equipment is unavailable"),{status:404});
  const e=item.rows[0]; if(e.available_quantity<qty) throw Object.assign(new Error("Not enough quantity available"),{status:409});
  const unit=Number(e.rental_price); const days=Math.max(1,Math.ceil((end-start)/86400000));
  const units=e.rental_type==="Weekly"?Math.ceil(days/7):e.rental_type==="Monthly"?Math.ceil(days/30):days;
  const total=unit*units*qty;
  const b=await client.query(`INSERT INTO bookings(customer_id,owner_id,equipment_id,start_date,end_date,quantity,contact_number,delivery_address,notes,total_amount)
  VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
  [req.user.id,e.owner_id,e.id,startDate,endDate,qty,contactNumber,deliveryAddress,notes,total]);
  await client.query("COMMIT");
  const origin=process.env.CLIENT_URL;
  const session=await stripe.checkout.sessions.create({
   mode:"payment",payment_method_types:["card"],
   line_items:[{price_data:{currency:"usd",product_data:{name:e.name,description:`${days} rental days × ${qty} unit(s)`},unit_amount:Math.round(total*100)},quantity:1}],
   success_url:`${origin}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
   cancel_url:`${origin}/payment/cancel?booking_id=${b.rows[0].id}`,
   metadata:{bookingId:String(b.rows[0].id),customerId:req.user.id}
  });
  await pool.query("UPDATE bookings SET stripe_session_id=$1 WHERE id=$2",[session.id,b.rows[0].id]);
  res.json({url:session.url,bookingId:b.rows[0].id});
 }catch(err){await client.query("ROLLBACK").catch(()=>{});throw err;}finally{client.release();}
}));
router.get("/bookings/mine",requireAuth,asyncRoute(async(req,res)=>{
 const r=await pool.query("SELECT b.*,e.name AS equipment_name FROM bookings b JOIN equipment e ON e.id=b.equipment_id WHERE b.customer_id=$1 ORDER BY b.created_at DESC",[req.user.id]);res.json(r.rows);
}));
router.get("/owner/bookings",requireAuth,allowRoles("Owner","Admin"),asyncRoute(async(req,res)=>{
 const r=await pool.query(`SELECT b.*,e.name AS equipment_name,u.name AS customer_name,u.email AS customer_email FROM bookings b JOIN equipment e ON e.id=b.equipment_id JOIN "user" u ON u.id=b.customer_id WHERE ($1='Admin' OR b.owner_id=$2) ORDER BY b.created_at DESC`,[req.user.role,req.user.id]);res.json(r.rows);
}));
router.get("/owner/equipment",requireAuth,allowRoles("Owner","Admin"),asyncRoute(async(req,res)=>{
 const r=await pool.query("SELECT * FROM equipment WHERE owner_id=$1 ORDER BY created_at DESC",[req.user.id]);res.json(r.rows);
}));
router.get("/profile",requireAuth,asyncRoute(async(req,res)=>{
 const r=await pool.query("SELECT phone,address,photo_url FROM profiles WHERE user_id=$1",[req.user.id]);res.json({user:req.user,profile:r.rows[0]||{}});
}));
router.patch("/profile",requireAuth,asyncRoute(async(req,res)=>{
 const {phone="",address="",photo_url=""}=req.body;
 const r=await pool.query(`INSERT INTO profiles(user_id,phone,address,photo_url) VALUES($1,$2,$3,$4)
 ON CONFLICT(user_id) DO UPDATE SET phone=$2,address=$3,photo_url=$4,updated_at=NOW() RETURNING *`,[req.user.id,phone,address,photo_url]);res.json(r.rows[0]);
}));
router.get("/reviews",asyncRoute(async(req,res)=>{const r=await pool.query("SELECT * FROM reviews ORDER BY created_at DESC LIMIT 8");res.json(r.rows)}));

router.get("/admin/users",requireAuth,allowRoles("Admin"),asyncRoute(async(req,res)=>{
 const r=await pool.query(`SELECT u.id,u.name,u.email,u.role,u."createdAt" AS created_at FROM "user" u ORDER BY u."createdAt" DESC`);res.json(r.rows);
}));
router.patch("/admin/users/:id/role",requireAuth,allowRoles("Admin"),asyncRoute(async(req,res)=>{
 const role=req.body.role;if(!["Customer","Owner","Admin"].includes(role))return res.status(400).json({message:"Invalid role"});
 const r=await pool.query(`UPDATE "user" SET role=$1 WHERE id=$2 RETURNING id,name,email,role`,[role,req.params.id]);res.json(r.rows[0]||null);
}));
router.get("/admin/equipment",requireAuth,allowRoles("Admin"),asyncRoute(async(req,res)=>{const r=await pool.query("SELECT * FROM equipment ORDER BY created_at DESC");res.json(r.rows)}));
router.patch("/admin/equipment/:id/status",requireAuth,allowRoles("Admin"),asyncRoute(async(req,res)=>{
 const status=req.body.status;if(!["Approved","Rejected","Pending"].includes(status))return res.status(400).json({message:"Invalid status"});
 const r=await pool.query("UPDATE equipment SET status=$1,updated_at=NOW() WHERE id=$2 RETURNING *",[status,req.params.id]);res.json(r.rows[0]||null);
}));
router.get("/admin/bookings",requireAuth,allowRoles("Admin"),asyncRoute(async(req,res)=>{
 const r=await pool.query(`SELECT b.*,e.name AS equipment_name,c.name AS customer_name,o.name AS owner_name FROM bookings b JOIN equipment e ON e.id=b.equipment_id JOIN "user" c ON c.id=b.customer_id JOIN "user" o ON o.id=b.owner_id ORDER BY b.created_at DESC`);res.json(r.rows);
}));
router.get("/analytics",requireAuth,allowRoles("Admin","Owner"),asyncRoute(async(req,res)=>{
 const owner=req.user.role==="Owner";
 const filter=owner?"WHERE owner_id=$1":"";
 const args=owner?[req.user.id]:[];
 const [equip,book,paid,monthly]=await Promise.all([
  pool.query(`SELECT COUNT(*)::int total,COUNT(*) FILTER(WHERE status='Pending')::int pending FROM equipment ${owner?"WHERE owner_id=$1":""}`,args),
  pool.query(`SELECT COUNT(*)::int total,COUNT(*) FILTER(WHERE booking_status='Completed')::int completed FROM bookings ${owner?"WHERE owner_id=$1":""}`,args),
  pool.query(`SELECT COALESCE(SUM(amount),0)::numeric(12,2) revenue FROM payments ${owner?"WHERE booking_id IN (SELECT id FROM bookings WHERE owner_id=$1)":""}`,args),
  pool.query(`SELECT date_trunc('month',created_at)::date month,COUNT(*)::int bookings FROM bookings ${owner?"WHERE owner_id=$1":""} GROUP BY 1 ORDER BY 1 DESC LIMIT 6`,args)
 ]);
 res.json({equipment:equip.rows[0],bookings:book.rows[0],revenue:paid.rows[0].revenue,monthly:monthly.rows});
}));
export default router;
