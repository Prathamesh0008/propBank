"use client";

import { Clock, ShieldCheck, CheckCircle2 } from "lucide-react";
import GeneralInquiryForm from "@/features/landing-page/GeneralInquiryForm";

export const QuickInquirySection: React.FC = () => {
  return (
    <section id="quick-inquiry" className="py-12 sm:py-16 px-4 bg-gradient-to-b from-gray-50 to-white scroll-mt-20">
      <div className="container mx-auto max-w-6xl">
        <div className="grid md:grid-cols-2 gap-12 items-center justify-center">
          <div className="text-center md:text-left space-y-6">
            <div className="space-y-3">
              <h2 className="text-3xl md:text-4xl font-bold text-gray-900 leading-tight">Quick Inquiry</h2>
              <p className="text-gray-600 text-lg sm:text-xl font-medium">Let us know what you're looking for</p>
            </div>
            
            <p className="text-gray-500 max-w-md mx-auto md:mx-0">
              Whether you are buying, renting, or selling, we offer customized solutions and expert guidance. Fill out this brief form, and our property advisors will get in touch with you.
            </p>

            <div className="space-y-4 pt-4 text-left max-w-md mx-auto md:mx-0">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 h-5 w-5 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0">
                  <Clock className="h-3.5 w-3.5" />
                </div>
                <div>
                  <h4 className="font-semibold text-sm text-gray-900">Fast Response Rate</h4>
                  <p className="text-xs text-gray-500 mt-0.5">Expect a follow-up from our team within 24 business hours.</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="mt-0.5 h-5 w-5 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0">
                  <ShieldCheck className="h-3.5 w-3.5" />
                </div>
                <div>
                  <h4 className="font-semibold text-sm text-gray-900">Verified Assistance</h4>
                  <p className="text-xs text-gray-500 mt-0.5">Get guidance on paperwork, negotiation, and legal processes.</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="mt-0.5 h-5 w-5 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                </div>
                <div>
                  <h4 className="font-semibold text-sm text-gray-900">Zero Obligation</h4>
                  <p className="text-xs text-gray-500 mt-0.5">All initial consultations and property visits are completely free.</p>
                </div>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm">
            <GeneralInquiryForm hideHeader={true} />
          </div>
        </div>
      </div>
    </section>
  );
};
