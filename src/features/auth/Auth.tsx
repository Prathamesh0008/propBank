"use client";

import React from "react";
import GoogleAuth from "./GoogleAuth";
import BrandLogo from "../brand/BrandLogo";
import styles from "./Auth.module.css";

const Auth: React.FC = () => (
  <main className={styles.page}>
    <div className={styles.layout}>
      <section className={styles.intro} aria-labelledby="auth-intro-title">
        <BrandLogo />
        <p className={styles.kicker}>Your property workspace</p>
        <h1 id="auth-intro-title" className={styles.heading}>One place for every property decision.</h1>
        <p className={styles.description}>
          Discover homes, manage listings and keep property conversations organised, all from one account.
        </p>
        <div className={styles.divider} aria-hidden="true" />
        <p className={styles.note}>Sign in securely with Google to continue. New members can complete their profile after sign-in.</p>
      </section>
      <section className={styles.formArea} aria-label="PropBank account sign-in">
        <div className={styles.formHeader}>
          <span className={styles.eyebrow}>Access your account</span>
          <h2>Welcome to PropBank</h2>
          <p>Use your Google account to sign in or register.</p>
        </div>
        <GoogleAuth />
      </section>
    </div>
  </main>
);

export default Auth;
