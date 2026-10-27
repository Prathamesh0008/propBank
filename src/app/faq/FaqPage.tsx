"use client";
import { useState } from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import styles from "./FaqPage.module.css";

const faqs = [
 { question:"How do I search for properties?", answer:"Open Properties or Search, choose Buy or Rent, and use the available category and condition filters to narrow the results." },
 { question:"How do I add my property?", answer:"Sign in, select Sell or Manage Property, choose whether you are submitting as owner or tenant, and complete the relevant property form." },
 { question:"Will my listing appear immediately?", answer:"New owner-submitted sale and rental listings enter an admin review process. You'll see the moderation status and any requested changes in Manage Property." },
 { question:"Can I change a listing after submission?", answer:"Owners can edit their listings. Listing-content changes are sent for review again before the revised property is published." },
 { question:"Can I request a visit?", answer:"Use the enquiry form to share a preferred visit date when available. Signed-in users can also use Visit Planner for their scheduled visits." },
 { question:"How are property offers handled?", answer:"Eligible customers can submit offers on published listings. Broker or admin proposals, owner decisions, and final customer confirmation follow a recorded workflow." },
 { question:"Where can I find my rental documents?", answer:"Open the relevant property management view to access your authorized agreements, documents, rent records, and service history." },
 { question:"How do I get help?", answer:"Use the Contact page to send an enquiry. For an existing property, use the relevant service-request workflow when available." },
];
export default function FaqPage(){
 const [open,setOpen]=useState<number|null>(0);
 return <div className={styles.page}>
  <header className={styles.intro}><div className={styles.wrap}><h1>Frequently asked <em>questions.</em></h1><p>Find clear guidance for property discovery, listing review, visits, and managing your property records.</p></div></header>
  <section className={styles.content}><div className={styles.wrap}><div className={styles.grid}><div className={styles.side}><h2>Good questions lead to better decisions.</h2><Link href="/contact">Still need help? Contact us <span aria-hidden="true">↗</span></Link></div><div className={styles.questions}>{faqs.map((f,i)=><article className={styles.question} key={f.question}><h3><button type="button" className={styles.trigger} onClick={()=>setOpen(open===i?null:i)} aria-expanded={open===i} aria-controls={`faq-answer-${i}`}><span>{f.question}</span><ChevronDown className={open===i?styles.rotated:styles.chevron} size={20} aria-hidden="true"/></button></h3><div id={`faq-answer-${i}`} className={styles.answer} hidden={open!==i}><p>{f.answer}</p></div></article>)}</div></div></div></section>
 </div>;
}
