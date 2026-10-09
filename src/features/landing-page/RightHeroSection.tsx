"use client";

import React from "react";
import { Settings, Calendar, ArrowRight } from "lucide-react";

interface RightHeroSectionProps {
  quote: string;
  onNavigate: (path: string) => void;
}

export const RightHeroSection: React.FC<RightHeroSectionProps> = ({ quote, onNavigate }) => {
  return (
    <div className="space-y-6 w-full max-w-2xl mx-auto lg:mx-0">
      <div className="text-center lg:text-left mb-2">
        <p className="text-lg text-muted-foreground font-medium">
          {quote || "Manage your properties and plan visits with ease"}
        </p>
      </div>

      <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 sm:p-6 border border-white/20 space-y-4 w-full">
        <div className="flex flex-col gap-6">
          {/* Manage Property Card */}
          <div
            onClick={() => onNavigate("/manage-property")}
            className="group cursor-pointer bg-white border border-gray-200 rounded-xl p-5 sm:p-6 hover:shadow-md transition-shadow"
          >
            <div className="flex flex-col sm:flex-row items-center sm:items-start text-center sm:text-left gap-6">
              <div className="relative bg-gradient-to-br from-blue-400/20 to-blue-600/30 p-3 sm:p-4 rounded-xl flex-shrink-0 border border-gray-200 flex items-center justify-center shadow-sm">
                <div className="relative w-12 h-12 sm:w-16 sm:h-16 flex items-center justify-center">
                  <div className="absolute inset-0 bg-gradient-to-br from-blue-400 to-blue-600 rounded-lg shadow-md"></div>
                  <img
                    src="/icons/icon-512.png"
                    alt="Propbank Logo"
                    className="relative h-10 w-10 sm:h-14 sm:w-14 object-contain drop-shadow-lg"
                    style={{
                      filter: "drop-shadow(0 4px 6px rgba(0, 0, 0, 0.2))",
                    }}
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.style.display = "none";
                      const fallback = target.nextElementSibling as HTMLElement;
                      if (fallback) {
                        fallback.style.display = "block";
                      }
                    }}
                  />
                  <Settings className="h-6 w-6 sm:h-8 sm:w-8 text-white hidden drop-shadow-lg" />
                </div>
              </div>
              <div className="flex-1 w-full space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                  <h3 className="text-lg font-bold text-black">
                    Manage Property
                  </h3>
                  <span className="w-fit px-2 py-0.5 bg-gray-100 text-black text-xs font-medium rounded-full border border-gray-200">
                    Property Management
                  </span>
                </div>
                <p className="text-sm text-gray-600">
                  Take complete control of your real estate portfolio. View, edit, and manage all your property listings and details in one place.
                </p>
                <div className="flex items-center justify-center sm:justify-start text-black pt-2 group-hover:text-blue-600 transition-colors">
                  <span className="text-sm font-semibold">Get Started</span>
                  <ArrowRight className="h-4 w-4 ml-1 transition-transform group-hover:translate-x-1" />
                </div>
              </div>
            </div>
          </div>

          {/* Visit Planner Card */}
          <div
            onClick={() => onNavigate("/visit-planner")}
            className="group cursor-pointer bg-white border border-gray-200 rounded-xl p-5 sm:p-6 hover:shadow-md transition-shadow"
          >
            <div className="flex flex-col sm:flex-row items-center sm:items-start text-center sm:text-left gap-6">
              <div className="relative bg-gradient-to-br from-purple-400/20 to-purple-600/30 p-3 sm:p-4 rounded-xl flex-shrink-0 border border-gray-200 flex items-center justify-center shadow-sm">
                <div className="relative w-12 h-12 sm:w-16 sm:h-16 flex items-center justify-center">
                  <div className="absolute inset-0 bg-gradient-to-br from-purple-400 to-purple-600 rounded-lg shadow-md"></div>
                  <Calendar className="relative h-6 w-6 sm:h-8 sm:w-8 text-white drop-shadow-lg"
                    style={{
                      filter: "drop-shadow(0 4px 6px rgba(0, 0, 0, 0.2))",
                    }}
                  />
                </div>
              </div>
              <div className="flex-1 w-full space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                  <h3 className="text-lg font-bold text-black">
                    Visit Planner
                  </h3>
                  <span className="w-fit px-2 py-0.5 bg-gray-100 text-black text-xs font-medium rounded-full border border-gray-200">
                    Schedule Visits
                  </span>
                </div>
                <p className="text-sm text-gray-600">
                  Schedule and organize property visits with clients efficiently. Coordinate dates, times, and get notifications on upcoming inspections.
                </p>
                <div className="flex items-center justify-center sm:justify-start text-black pt-2 group-hover:text-purple-600 transition-colors">
                  <span className="text-sm font-semibold">Plan Visits</span>
                  <ArrowRight className="h-4 w-4 ml-1 transition-transform group-hover:translate-x-1" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
