"use client";
import Link from "next/link";
import { Search, Tag, Wrench } from "lucide-react";
import GeneralInquiryForm from "@/features/landing-page/GeneralInquiryForm";
import styles from "./ContactPage.module.css";

const help = [
  { icon: Search, title: "Find a property", detail: "Tell us whether you want to buy or rent, and share the property type you're looking for." },
  { icon: Tag, title: "List a property", detail: "Start with the Sell journey to submit information for listing review." },
  { icon: Wrench, title: "Existing property support", detail: "For a property already in your account, use its management screen to review requests and documents." },
];

export default function ContactPage() {
 return <div className={styles.page}>
  <header className={styles.intro}><div className={styles.wrap}><h1>Tell us what <em>you're looking for.</em></h1><p>Buying, renting, selling, or requesting a visit? Share your requirements through the enquiry form and the PropBank team can review your request.</p></div></header>
  <section className={styles.content}><div className={styles.wrap}><div className={styles.layout}>
    <div className={styles.formSide}><h2>Send your requirement.</h2><p className={styles.helper}>Complete the form below. Please avoid including confidential documents or passwords in the message.</p><div className={styles.form}><GeneralInquiryForm hideHeader /></div></div>
    <aside className={styles.aside}>{help.map((x)=><div className={styles.help} key={x.title}><x.icon size={21} strokeWidth={1.4} aria-hidden="true"/><div><h3>{x.title}</h3><p>{x.detail}</p></div></div>)}<div className={styles.quick}><h3>Prefer to explore first?</h3><Link href="/properties">View properties <span aria-hidden="true">↗</span></Link><Link href="/faq">Frequently asked questions <span aria-hidden="true">↗</span></Link></div></aside>
  </div></div></section>
 </div>;
}
