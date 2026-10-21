"use client";
import {Link,NavLink} from '@/lib/navigation';
import {ArrowUpRight} from 'lucide-react';
import type {User} from 'firebase/auth';
import {UserMenu} from './UserMenu';
import styles from './DesktopNav.module.css';
interface DesktopNavProps {user:User|null;userName?:string;userEmail:string;userPhone:string;userRole:string;handleLogout:()=>Promise<void>}
export const DesktopNav=({user,userName,userEmail,userPhone,handleLogout}:DesktopNavProps)=><div className={styles.root}>
 <nav className={styles.links} aria-label="Main navigation">
  {[['/buy','Buy'],['/rent','Rent'],['/sell','Sell'],['/manage-property','Manage Property'],['/visit-planner','Visit Planner'],['/admin','Admin Portal'],['/contact','Contact Us']].map(([to,label])=><NavLink key={to} to={to} className={styles.link}>{label}</NavLink>)}
 </nav>
 {user?<UserMenu user={user} userName={userName} userEmail={userEmail} userPhone={userPhone} handleLogout={handleLogout}/>:<Link to="/auth" className={styles.login}>Login<ArrowUpRight className={styles.icon} aria-hidden="true"/></Link>}
</div>;
