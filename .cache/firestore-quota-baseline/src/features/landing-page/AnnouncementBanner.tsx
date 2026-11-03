import { Megaphone } from "lucide-react";
import styles from "./AnnouncementBanner.module.css";

interface AnnouncementBannerProps {
  isAnnouncementActive: boolean;
  announcementText: string;
}

export const AnnouncementBanner = ({ isAnnouncementActive, announcementText }: AnnouncementBannerProps) => {
  if (!isAnnouncementActive || !announcementText) return null;
  return <div className={styles.banner}><Megaphone size={15} aria-hidden="true"/><p>{announcementText}</p></div>;
};
