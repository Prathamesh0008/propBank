"use client";
import { Link, NavLink } from '@/lib/navigation';
import { ArrowUpRight } from 'lucide-react';
import type { User } from 'firebase/auth';
import { UserMenu } from './UserMenu';
import styles from './DesktopNav.module.css';

interface DesktopNavProps {
  user: User | null;
  userName?: string;
  userEmail: string;
  userPhone: string;
  userRole: string;
  handleLogout: () => Promise<void>;
}

const publicLinks = [['/buy', 'Buy'], ['/rent', 'Rent'], ['/sell', 'Sell'], ['/contact', 'Contact Us']] as const;
const accountLinks = [['/manage-property', 'Manage Property'], ['/visit-planner', 'Visit Planner'], ['/contact', 'Contact Us']] as const;

export const DesktopNav = ({ user, userName, userEmail, userPhone, userRole, handleLogout }: DesktopNavProps) => (
  <div className={styles.root}>
    <nav className={styles.links} aria-label="Main navigation">
      {(user ? accountLinks : publicLinks).map(([to, label]) => <NavLink key={to} to={to} className={styles.link}>{label}</NavLink>)}
      {user && userRole === 'admin' && <NavLink to="/admin" className={styles.link}>Admin Workspace</NavLink>}
    </nav>
    {user ? (
      <UserMenu user={user} userName={userName} userEmail={userEmail} userPhone={userPhone} handleLogout={handleLogout} />
    ) : (
      <Link to="/auth" className={styles.login}>Login <ArrowUpRight className={styles.icon} aria-hidden="true" /></Link>
    )}
  </div>
);
