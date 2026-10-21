"use client";
import {Link,NavLink} from '@/lib/navigation';
import {Menu,LogOut,LogIn,X} from 'lucide-react';
import type {User} from 'firebase/auth';
import * as Dialog from '@radix-ui/react-dialog';
import BrandLogo from '@/features/brand/BrandLogo';
import styles from './MobileNav.module.css';
interface MobileNavProps {user:User|null;userName?:string;userEmail:string;userPhone:string;userRole:string;handleLogout:()=>Promise<void>;isOpen:boolean;setIsOpen:(open:boolean)=>void}
export const MobileNav=({user,userName,userEmail,userPhone,handleLogout,isOpen,setIsOpen}:MobileNavProps)=><div className={styles.root}>
 <Dialog.Root open={isOpen} onOpenChange={setIsOpen}><Dialog.Trigger asChild><button type="button" className={styles.trigger} aria-label="Toggle menu"><Menu className={styles.icon} aria-hidden="true"/></button></Dialog.Trigger>
 <Dialog.Portal><Dialog.Overlay className={styles.overlay}/><Dialog.Content className={styles.content}>
  <div className={styles.top}><Link to="/" className={styles.brandLink} aria-label="PropBank home" onClick={()=>setIsOpen(false)}><BrandLogo/></Link><Dialog.Close className={styles.close} aria-label="Close navigation"><X className={styles.icon} aria-hidden="true"/></Dialog.Close></div>
  <Dialog.Title className={styles.title}>Space for what&apos;s next.</Dialog.Title><Dialog.Description className={styles.description}>Find your place. Make it yours. Manage it well.</Dialog.Description>
  <nav className={styles.navigation} aria-label="Mobile navigation">{[['/buy','Buy'],['/rent','Rent'],['/sell','Sell'],['/manage-property','Manage Property'],['/visit-planner','Visit Planner'],['/admin','Admin Portal'],['/contact','Contact Us']].map(([to,label])=><NavLink key={to} to={to} className={styles.link} onClick={()=>setIsOpen(false)}>{label}</NavLink>)}</nav>
  <div className={styles.account}>{user?<><p className={styles.name}>{user.displayName||userName||'User'}</p><p className={styles.detail}>{user.email||userEmail}</p>{userPhone&&<p className={styles.detail}>{userPhone}</p>}<button type="button" className={styles.action} onClick={handleLogout}><LogOut className={styles.icon} aria-hidden="true"/>Logout</button></>:<Link to="/auth" className={styles.action} onClick={()=>setIsOpen(false)}><LogIn className={styles.icon} aria-hidden="true"/>Login</Link>}</div>
 </Dialog.Content></Dialog.Portal></Dialog.Root>
</div>;
