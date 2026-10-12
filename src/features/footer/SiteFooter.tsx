"use client";

import React from "react";

import {
  Mail,
  Phone,
  MapPin,
  ArrowUp,
} from "lucide-react";

import {
  FaFacebookF,
  FaInstagram,
  FaLinkedinIn,
  FaXTwitter,
} from "react-icons/fa6";


const SiteFooter = () => {
  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };


  return (
    <footer className="mt-auto bg-gradient-to-br from-[#087BB5] via-[#086BA7] to-[#064D8C] text-white">

      {/* Main Footer */}
      <div className="container mx-auto px-5 py-12 lg:px-8 lg:py-16">

        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4 lg:gap-12">

          {/* Logo + About */}
          <div>

            <a
              href="/"
              className="mb-5 inline-flex items-center"
              aria-label="Propbank Home"
            >
              <span className="relative block h-16 w-56 overflow-hidden sm:h-20 sm:w-72">

                <img
                  src="/images/pb_footer.png"
                  alt="Propbank logo"
                  className="absolute left-0 top-1/2 w-full -translate-y-1/2 object-contain"
                />

              </span>
            </a>


            <h3 className="mb-3 text-lg font-semibold">
              About Propbank
            </h3>


            <p className="max-w-[300px] text-sm leading-6 text-white/80">
              Your go-to hub for buying, selling, and renting properties.
              Discover verified properties and find the right space for you.
            </p>


            {/* Contact */}
            <div className="mt-6 space-y-3">

              {/* Phone */}
              <a
                href="tel:+919999999999"
                className="flex items-center gap-3 text-sm text-white/85 transition hover:text-white"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/15">
                  <Phone size={15} />
                </span>

                +91 99999 99999
              </a>


              {/* Email */}
              <a
                href="mailto:support@propbank.com"
                className="flex items-center gap-3 text-sm text-white/85 transition hover:text-white"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/15">
                  <Mail size={15} />
                </span>

                support@propbank.com
              </a>


              {/* Location */}
              <div className="flex items-start gap-3 text-sm text-white/85">

                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/15">
                  <MapPin size={15} />
                </span>

                <span className="pt-1.5">
                  Mumbai, Maharashtra, India
                </span>

              </div>

            </div>

          </div>



          {/* Information */}
          <div>

            <h3 className="mb-5 text-lg font-semibold">
              Information
            </h3>


            <ul className="space-y-3 text-sm text-white/80">

              <li>
                <a
                  href="/about"
                  className="transition hover:text-white hover:underline"
                >
                  About Us
                </a>
              </li>


              <li>
                <a
                  href="/properties"
                  className="transition hover:text-white hover:underline"
                >
                  Properties
                </a>
              </li>


              <li>
                <a
                  href="/buy"
                  className="transition hover:text-white hover:underline"
                >
                  Buy Property
                </a>
              </li>


              <li>
                <a
                  href="/rent"
                  className="transition hover:text-white hover:underline"
                >
                  Rent Property
                </a>
              </li>


              <li>
                <a
                  href="/sell"
                  className="transition hover:text-white hover:underline"
                >
                  Sell Property
                </a>
              </li>


              <li>
                <a
                  href="/contact"
                  className="transition hover:text-white hover:underline"
                >
                  Contact Us
                </a>
              </li>

            </ul>

          </div>



          {/* Helpful Links */}
          <div>

            <h3 className="mb-5 text-lg font-semibold">
              Helpful Links
            </h3>


            <ul className="space-y-3 text-sm text-white/80">

              <li>
                <a
                  href="/services"
                  className="transition hover:text-white hover:underline"
                >
                  Services
                </a>
              </li>


              <li>
                <a
                  href="/support"
                  className="transition hover:text-white hover:underline"
                >
                  Support
                </a>
              </li>


              <li>
                <a
                  href="/terms"
                  className="transition hover:text-white hover:underline"
                >
                  Terms & Conditions
                </a>
              </li>


              <li>
                <a
                  href="/privacy"
                  className="transition hover:text-white hover:underline"
                >
                  Privacy Policy
                </a>
              </li>


              <li>
                <a
                  href="/faq"
                  className="transition hover:text-white hover:underline"
                >
                  FAQs
                </a>
              </li>


              <li>
                <a
                  href="/blog"
                  className="transition hover:text-white hover:underline"
                >
                  Blog
                </a>
              </li>

            </ul>

          </div>



          {/* Newsletter */}
          <div>

            <h3 className="mb-3 text-lg font-semibold">
              Stay Updated
            </h3>


            <p className="mb-5 text-sm leading-6 text-white/80">
              Get the latest property updates, offers and real estate insights.
            </p>


            {/* Email */}
            <div className="flex overflow-hidden rounded-lg bg-white shadow-lg">

              <div className="flex flex-1 items-center gap-2 px-4">

                <Mail
                  size={17}
                  className="shrink-0 text-slate-500"
                />

                <input
                  type="email"
                  placeholder="Enter your email"
                  className="h-12 w-full bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-400"
                />

              </div>

            </div>


            <button
              type="button"
              className="mt-3 h-11 rounded-lg bg-white px-6 text-sm font-semibold text-[#086BA7] shadow-md transition duration-200 hover:-translate-y-0.5 hover:bg-slate-100"
            >
              Subscribe
            </button>



            {/* Social */}
            <div className="mt-7">

              <p className="mb-3 text-sm font-medium">
                Follow Us
              </p>


              <div className="flex items-center gap-3">

                {/* Facebook */}
                <a
                  href="#"
                  aria-label="Facebook"
                  className="
                    group
                    flex h-10 w-10 items-center justify-center
                    rounded-full
                    border border-white/30
                    bg-white/10
                    transition-all duration-300
                    hover:-translate-y-1
                    hover:border-white
                    hover:bg-white
                    hover:shadow-lg
                  "
                >
                  <FaFacebookF
                    size={18}
                    className="
                      text-white
                      transition-colors duration-300
                      group-hover:text-[#1877F2]
                    "
                  />
                </a>


                {/* Instagram */}
                <a
                  href="#"
                  aria-label="Instagram"
                  className="
                    group
                    flex h-10 w-10 items-center justify-center
                    rounded-full
                    border border-white/30
                    bg-white/10
                    transition-all duration-300
                    hover:-translate-y-1
                    hover:border-white
                    hover:bg-white
                    hover:shadow-lg
                  "
                >
                  <FaInstagram
                    size={20}
                    className="
                      text-white
                      transition-colors duration-300
                      group-hover:text-[#E4405F]
                    "
                  />
                </a>


                {/* LinkedIn */}
                <a
                  href="#"
                  aria-label="LinkedIn"
                  className="
                    group
                    flex h-10 w-10 items-center justify-center
                    rounded-full
                    border border-white/30
                    bg-white/10
                    transition-all duration-300
                    hover:-translate-y-1
                    hover:border-white
                    hover:bg-white
                    hover:shadow-lg
                  "
                >
                  <FaLinkedinIn
                    size={19}
                    className="
                      text-white
                      transition-colors duration-300
                      group-hover:text-[#0A66C2]
                    "
                  />
                </a>


                {/* X / Twitter */}
                <a
                  href="#"
                  aria-label="X"
                  className="
                    group
                    flex h-10 w-10 items-center justify-center
                    rounded-full
                    border border-white/30
                    bg-white/10
                    transition-all duration-300
                    hover:-translate-y-1
                    hover:border-white
                    hover:bg-white
                    hover:shadow-lg
                  "
                >
                  <FaXTwitter
                    size={18}
                    className="
                      text-white
                      transition-colors duration-300
                      group-hover:text-black
                    "
                  />
                </a>

              </div>

            </div>

          </div>

        </div>

      </div>



      {/* Divider */}
      <div className="container mx-auto px-5 lg:px-8">

        <div className="h-px bg-white/20" />

      </div>



      {/* Bottom Footer */}
      <div className="container mx-auto flex flex-col items-center justify-between gap-4 px-5 py-5 text-center text-xs text-white/70 md:flex-row md:text-left lg:px-8">

        <p>
          © {new Date().getFullYear()} Propbank. All rights reserved.
        </p>


        <div className="flex items-center gap-5">

          <a
            href="/privacy"
            className="transition hover:text-white"
          >
            Privacy Policy
          </a>


          <a
            href="/terms"
            className="transition hover:text-white"
          >
            Terms & Conditions
          </a>


          {/* Scroll To Top */}
          <button
            onClick={scrollToTop}
            aria-label="Scroll to top"
            className="flex h-9 w-9 items-center justify-center rounded-lg bg-white text-[#086BA7] shadow-md transition hover:-translate-y-1 hover:bg-slate-100"
          >
            <ArrowUp size={18} />
          </button>

        </div>

      </div>

    </footer>
  );
};


export default SiteFooter;