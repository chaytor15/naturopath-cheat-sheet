"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function ConfirmationPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const bookingId = searchParams.get("bookingId");

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white rounded-2xl p-8 shadow-lg text-center">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg
            className="w-8 h-8 text-green-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 13l4 4L19 7"
            />
          </svg>
        </div>
        <h1 className="text-2xl font-semibold mb-2 text-slate-900">Booking Confirmed!</h1>
        <p className="text-slate-600 mb-6">
          Your appointment has been successfully booked. You will receive a confirmation email
          shortly.
        </p>
        {bookingId && (
          <p className="text-xs text-slate-500 mb-6">Booking ID: {bookingId}</p>
        )}
        <button
          onClick={() => router.push("/")}
          className="px-6 py-3 text-sm font-medium rounded-lg bg-[#72B01D] hover:bg-[#6AA318] text-white"
        >
          Return Home
        </button>
      </div>
    </div>
  );
}

