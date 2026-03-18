"use client";

import { useCallback } from "react";
import { driver } from "driver.js";
import "driver.js/dist/driver.css";

const TOUR_DONE_KEY = "carveo-dealer-setup-tour-done";

export function useDealerSetupTour() {
  const startTour = useCallback(() => {
    const driverObj = driver({
      showProgress: true,
      steps: [
        {
          element: "[data-tour='dealer-profile-section']",
          popover: {
            title: "1. Dealer profile",
            description:
              "Create or select your dealership. Use the same email as your account so your profile is linked. This step is optional—you can process images without a dealer profile.",
            side: "right",
            align: "start",
          },
        },
        {
          popover: {
            title: "2. Branding options",
            description:
              "After creating a dealer, enable logo in corner, custom license plate, or 3D wall logo. These are applied automatically when you process images with this dealer selected.",
          },
        },
        {
          popover: {
            title: "3. Upload assets",
            description:
              "Upload your logo (PNG with transparent background works best), license plate logo, and optionally a custom studio background. Each asset is used when the corresponding branding option is enabled.",
          },
        },
        {
          popover: {
            title: "4. Custom studio",
            description:
              "Upload a custom studio image to use as the background for your vehicle photos. If not set, the default studio presets will be used.",
          },
        },
        {
          popover: {
            title: "You're all set!",
            description:
              "Remember to save your preferences after making changes. Your branding will be applied automatically when you process images with this dealer selected. You can always come back to update your settings.",
          },
        },
      ],
      onDestroyStarted: () => {
        if (typeof window !== "undefined") {
          try {
            localStorage.setItem(TOUR_DONE_KEY, "true");
          } catch {
            /* ignore */
          }
        }
      },
    });
    driverObj.drive();
  }, []);

  const hasSeenTour = typeof window !== "undefined" && localStorage.getItem(TOUR_DONE_KEY) === "true";

  return { startTour, hasSeenTour };
}
