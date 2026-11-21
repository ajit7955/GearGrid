
import "./globals.css";
import { Toaster } from "react-hot-toast";
import Link from "next/link";
export const metadata={title:"GearGrid — Rent What You Need",description:"A smarter way to rent professional equipment."};
export default function RootLayout({children}){return <html lang="en"><body><header className="nav"><div className="container row-between"><Link className="brand" href="/">gear<span>grid.</span></Link><nav className="navlinks"><Link href="/">Home</Link><Link href="/equipment">Equipment</Link><Link href="/#how">How it works</Link><Link href="/login">Login</Link><Link className="btn" href="/register">Get Started</Link></nav></div></header>{children}<footer className="footer"><div className="container row-between"><div><div className="brand">geargrid.</div><p className="muted">Access more. Own less. Make things happen.</p></div><span>© {new Date().getFullYear()} GearGrid</span></div></footer><Toaster position="top-right"/></body></html>}
