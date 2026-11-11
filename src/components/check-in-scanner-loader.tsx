"use client";
import dynamic from "next/dynamic";

/** The scanner uses the camera and device storage, so it renders client-only. */
export const CheckInScannerLoader = dynamic(() => import("./check-in-scanner").then((m) => m.CheckInScanner), {
  ssr: false,
  loading: () => <div className="flex-1 bg-ink-900" />,
});
