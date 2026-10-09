"use client";

import React from "react";

interface AnnouncementBannerProps {
  isAnnouncementActive: boolean;
  announcementText: string;
}

export const AnnouncementBanner: React.FC<AnnouncementBannerProps> = ({
  isAnnouncementActive,
  announcementText,
}) => {
  if (!isAnnouncementActive || !announcementText) return null;

  return (
    <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white py-3 px-4">
      <div className="container mx-auto">
        <p className="text-center text-sm md:text-base font-medium capitalize">
          📢 {announcementText}
        </p>
      </div>
    </div>
  );
};
