import styles from './BrandLogo.module.css';

/** Original mark: two offset spatial boundaries, separated by an open threshold. */
export default function BrandLogo({compact=false}:{compact?:boolean}) {
 return <span className={styles.logo}>
  <svg className={styles.mark} viewBox="0 0 48 48" fill="currentColor" aria-hidden="true" focusable="false"><path d="M4 4h26v8H12v32H4V4Zm16 16h24v24H20v-8h16v-8H20v-8Z"/></svg>
  {!compact&&<span className={styles.wordmark}>PropBank</span>}
 </span>;
}
