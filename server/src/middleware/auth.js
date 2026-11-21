
import { auth } from "../auth.js";
import { fromNodeHeaders } from "better-auth/node";
import { pool } from "../db/pool.js";

export async function requireAuth(req, res, next) {
  try {
    const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
    if (!session?.user) return res.status(401).json({ message: "Please sign in first." });
    let role = session.user.role || "Customer";
    if (process.env.ADMIN_EMAIL && session.user.email?.toLowerCase() === process.env.ADMIN_EMAIL.toLowerCase()) {
      role = "Admin";
      await pool.query("UPDATE \"user\" SET role='Admin' WHERE id=$1 AND role IS DISTINCT FROM 'Admin'", [session.user.id]).catch(()=>{});
    }
    req.user = { id: session.user.id, name: session.user.name, email: session.user.email, role };
    next();
  } catch (error) {
    console.error("Auth verification failed:", error.message);
    return res.status(401).json({ message: "Invalid or expired session." });
  }
}
export const allowRoles = (...roles) => (req,res,next) => {
  if (!req.user || !roles.includes(req.user.role)) return res.status(403).json({message:"You do not have permission for this action."});
  next();
};
export const verifyToken = requireAuth;
export const verifyRenter = [requireAuth, allowRoles("Customer")];
export const verifyOwner = [requireAuth, allowRoles("Owner")];
export const verifyAdmin = [requireAuth, allowRoles("Admin")];
