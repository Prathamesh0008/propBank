"use client";
import type {User} from 'firebase/auth';
import * as Menu from '@radix-ui/react-dropdown-menu';
import {LogOut,ChevronDown,UserRound} from 'lucide-react';
import {Link} from '@/lib/navigation';
import styles from './UserMenu.module.css';
interface UserMenuProps {user:User;userName?:string;userEmail:string;userPhone:string;handleLogout:()=>Promise<void>}
export const UserMenu=({user,userName,userEmail,userPhone,handleLogout}:UserMenuProps)=>{
 const name=userName||user.displayName||'User';
 return <Menu.Root><Menu.Trigger asChild><button type="button" className={styles.trigger} aria-label="Profile"><span className={styles.avatar}>{user.photoURL?<img src={user.photoURL} alt="" className={styles.image}/>:name.slice(0,2).toUpperCase()}</span><ChevronDown className={styles.chevron} aria-hidden="true"/></button></Menu.Trigger>
 <Menu.Portal><Menu.Content className={styles.content} align="end" sideOffset={12}>
  <Menu.Label className={styles.label}><p className={styles.name}>{name}</p><span className={styles.detail}>{user.email||userEmail}</span>{userPhone&&<span className={styles.detail}>{userPhone}</span>}</Menu.Label>
  <Menu.Separator className={styles.separator}/><Menu.Item asChild><Link to="/my-account" className={styles.accountLink}><UserRound className={styles.icon} aria-hidden="true"/>My account</Link></Menu.Item><Menu.Item className={styles.logout} onSelect={handleLogout}><LogOut className={styles.icon} aria-hidden="true"/>Log out</Menu.Item>
 </Menu.Content></Menu.Portal></Menu.Root>;
};
