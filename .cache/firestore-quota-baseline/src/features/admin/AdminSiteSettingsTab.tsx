"use client";
import styles from "./AdminSiteSettingsTab.module.css";

import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/ui/card";
import { Button } from "@/ui/button";
import { Checkbox } from "@/ui/checkbox";
import { ImageIcon, Upload, X } from "lucide-react";
import { Skeleton } from "@/ui/skeleton";
import { SiteSettings } from "./AdminTypes";

interface AdminSiteSettingsTabProps {
  loading: boolean;
  siteSettings: SiteSettings;
  setSiteSettings: React.Dispatch<React.SetStateAction<SiteSettings>>;
  savingSettings: boolean;
  uploadingBanner: boolean;
  pendingBannerImages: string[];
  handleUpdateSiteSettings: () => void;
  handleBannerImageUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleRemoveBannerImage: (indexToRemove: number, isPending: boolean) => void;
}

export const AdminSiteSettingsTab = ({
  loading,
  siteSettings,
  setSiteSettings,
  savingSettings,
  uploadingBanner,
  pendingBannerImages,
  handleUpdateSiteSettings,
  handleBannerImageUpload,
  handleRemoveBannerImage
}: AdminSiteSettingsTabProps) => {
  return (
    <Card className={styles.settings}>
      <CardHeader>
        <CardTitle>Site Settings</CardTitle>
        <CardDescription>
          Manage dynamic content displayed on the homepage - Quote, Hero Text, and Announcements
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-4">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Quote Field */}
            <div className="space-y-2">
              <label className="text-sm font-medium">
                Homepage Quote
                <span className="text-muted-foreground ml-2 font-normal">
                  (Shown above Manage Property and Visit Planner cards)
                </span>
              </label>
              <input
                type="text"
                value={siteSettings.quote}
                onChange={(e) => setSiteSettings({ ...siteSettings, quote: e.target.value })}
                placeholder="Enter quote text..."
                className={`${styles.input} w-full px-3 py-2`}
              />
              <p className="text-xs text-muted-foreground">
                Current: "{siteSettings.quote}"
              </p>
            </div>

            {/* Hero Title */}
            <div className="space-y-2">
              <label className="text-sm font-medium">
                Hero Title
                <span className="text-muted-foreground ml-2 font-normal">
                  (Main heading on homepage)
                </span>
              </label>
              <input
                type="text"
                value={siteSettings.heroTitle || ""}
                onChange={(e) => setSiteSettings({ ...siteSettings, heroTitle: e.target.value })}
                placeholder="Enter hero title..."
                className={`${styles.input} w-full px-3 py-2`}
              />
            </div>

            {/* Hero Subtitle */}
            <div className="space-y-2">
              <label className="text-sm font-medium">
                Hero Subtitle
                <span className="text-muted-foreground ml-2 font-normal">
                  (Sub-heading below the main title)
                </span>
              </label>
              <input
                type="text"
                value={siteSettings.heroSubtitle || ""}
                onChange={(e) => setSiteSettings({ ...siteSettings, heroSubtitle: e.target.value })}
                placeholder="Enter hero subtitle..."
                className={`${styles.input} w-full px-3 py-2`}
              />
            </div>

            {/* Announcement Text */}
            <div className="space-y-2">
              <label className="text-sm font-medium">
                Announcement Text
                <span className="text-muted-foreground ml-2 font-normal">
                  (Optional banner announcement)
                </span>
              </label>
              <input
                type="text"
                value={siteSettings.announcementText || ""}
                onChange={(e) => setSiteSettings({ ...siteSettings, announcementText: e.target.value })}
                placeholder="Enter announcement text (leave empty to hide)..."
                className={`${styles.input} w-full px-3 py-2`}
              />
            </div>

            {/* Announcement Active Toggle */}
            <div className="flex items-center space-x-2">
              <Checkbox
                id="announcement-active"
                checked={siteSettings.isAnnouncementActive || false}
                onCheckedChange={(checked) =>
                  setSiteSettings({ ...siteSettings, isAnnouncementActive: checked === true })
                }
              />
              <label htmlFor="announcement-active" className="text-sm font-medium">
                Show Announcement Banner
              </label>
            </div>

            {/* Banner Images Section */}
            <div className="space-y-4 pt-4 border-t">
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  Banner Images
                  <span className="text-muted-foreground ml-2 font-normal">
                    (Carousel images for homepage hero section - rotates every 30 seconds)
                  </span>
                </label>
                <p className="text-xs text-muted-foreground">
                  Upload multiple images to display as a rotating carousel. If no banner images are uploaded, the default hero image will be shown.
                </p>
              </div>

              {/* Upload Button */}
              <div className="flex items-center gap-4 flex-wrap">
                <label className="cursor-pointer">
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleBannerImageUpload}
                    className="hidden"
                    disabled={savingSettings}
                  />
                  <div className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors">
                    <Upload className="w-4 h-4" />
                    <span>Add Banner Images</span>
                  </div>
                </label>
                <div className="flex gap-2 text-sm text-muted-foreground">
                  {siteSettings.bannerImages && siteSettings.bannerImages.length > 0 && (
                    <span>{siteSettings.bannerImages.length} saved</span>
                  )}
                  {pendingBannerImages.length > 0 && (
                    <span className="text-orange-600">+ {pendingBannerImages.length} pending upload</span>
                  )}
                </div>
              </div>

              {/* Uploaded Banner Images */}
              {siteSettings.bannerImages && siteSettings.bannerImages.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-green-700">Saved Images:</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                    {siteSettings.bannerImages.map((imageUrl, index) => (
                      <div key={`saved-${index}`} className="relative group">
                        <img
                          src={imageUrl}
                          alt={`Banner ${index + 1}`}
                          className="w-full h-24 object-cover rounded-lg border-2 border-green-200"
                        />
                        <button
                          onClick={() => handleRemoveBannerImage(index, false)}
                          className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                          title="Remove image"
                        >
                          <X className="w-3 h-3" />
                        </button>
                        <span className="absolute bottom-1 left-1 bg-green-600 text-white text-xs px-1.5 py-0.5 rounded">
                          {index + 1}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Pending Banner Images (not yet uploaded) */}
              {pendingBannerImages.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-orange-600">Pending Upload (will be uploaded on save):</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                    {pendingBannerImages.map((base64Image, index) => (
                      <div key={`pending-${index}`} className="relative group">
                        <img
                          src={base64Image}
                          alt={`Pending ${index + 1}`}
                          className="w-full h-24 object-cover rounded-lg border-2 border-orange-300 border-dashed"
                        />
                        <button
                          onClick={() => handleRemoveBannerImage(index, true)}
                          className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                          title="Remove image"
                        >
                          <X className="w-3 h-3" />
                        </button>
                        <span className="absolute bottom-1 left-1 bg-orange-500 text-white text-xs px-1.5 py-0.5 rounded">
                          New
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Empty State */}
              {(!siteSettings.bannerImages || siteSettings.bannerImages.length === 0) && pendingBannerImages.length === 0 && (
                <div className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-gray-300 rounded-lg bg-gray-50">
                  <ImageIcon className="w-12 h-12 text-gray-400 mb-2" />
                  <p className="text-sm text-gray-500">No banner images uploaded</p>
                  <p className="text-xs text-gray-400">Default hero image will be displayed</p>
                </div>
              )}
            </div>

            {/* Save Button */}
            <div className="pt-4 border-t">
              <Button
                onClick={handleUpdateSiteSettings}
                disabled={savingSettings}
                className="w-full sm:w-auto"
              >
                {savingSettings ? (
                  uploadingBanner ? "Uploading images..." : "Saving..."
                ) : (
                  pendingBannerImages.length > 0
                    ? `Save Settings & Upload ${pendingBannerImages.length} Image(s)`
                    : "Save Settings"
                )}
              </Button>
            </div>

            {/* Preview Section */}
            <div className="pt-4 border-t">
              <h4 className="text-sm font-medium mb-3">Preview</h4>
              <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                <p className="font-bold text-lg">{siteSettings.heroTitle}</p>
                <p className="text-muted-foreground">{siteSettings.heroSubtitle}</p>
                <div className="pt-2 border-t mt-2">
                  <p className="text-muted-foreground italic">"{siteSettings.quote}"</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
