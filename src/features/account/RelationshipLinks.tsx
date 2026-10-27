"use client";

import { ArrowUpRight } from 'lucide-react';
import { Link } from '@/lib/navigation';
import styles from './RelationshipLinks.module.css';

/** The account page points to the single connection experience in Property Hub. */
export default function RelationshipLinks() {
  return <div className={styles.shortcut}><Link to="/manage-property#pending-connections">Review Pending Connections <ArrowUpRight size={16} aria-hidden="true"/></Link></div>;
}
