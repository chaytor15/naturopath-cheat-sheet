"use client";

import { useEffect, useState, useCallback, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

type ConsultType = {
  consult_type: string;
  name: string;
  duration_minutes: number;
  price: number;
};

type TimeSlot = {
  time: string;
  available: boolean;
};

// Currency symbol mapping
const getCurrencySymbol = (currency: string): string => {
  const symbols: Record<string, string> = {
    USD: "$",
    NZD: "$",
    AUD: "$",
    EUR: "€",
    GBP: "£",
  };
  return symbols[currency] || "$";
};

// Get currency display format: "USD ($)", "EUR (€)", etc.
const getCurrencyDisplay = (currency: string): string => {
  const display: Record<string, string> = {
    USD: "USD ($)",
    NZD: "NZD ($)",
    AUD: "AUD ($)",
    EUR: "EUR (€)",
    GBP: "GBP (£)",
  };
  return display[currency] || "USD ($)";
};

function BookPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const practitionerId = searchParams.get("practitionerId") || "";

  const [loading, setLoading] = useState(true);
  const [consultTypes, setConsultTypes] = useState<ConsultType[]>([]);
  const [selectedType, setSelectedType] = useState<ConsultType | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [selectedTime, setSelectedTime] = useState<string>("");
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);
  const [checkingAvailability, setCheckingAvailability] = useState(false);
  const [clientInfo, setClientInfo] = useState({
    name: "",
    email: "",
    phone: "",
    notes: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [clinicTimezone, setClinicTimezone] = useState<string>("Australia/Sydney");
  const [currency, setCurrency] = useState<string>("USD");
  const checkingRef = useRef(false);

  const loadClinicSettings = async () => {
    try {
      const response = await fetch(`/api/book/clinic-settings?practitionerId=${practitionerId}`);
      if (response.ok) {
        const data = await response.json();
        setClinicTimezone(data.timezone || "Australia/Sydney");
        setCurrency(data.currency || "USD");
      }
    } catch (error) {
      console.error("Error loading clinic settings:", error);
    }
  };

  const loadConsultTypes = async () => {
    try {
      const response = await fetch(`/api/book/consult-types?practitionerId=${practitionerId}`);
      if (response.ok) {
        const data = await response.json();
        setConsultTypes(data);
      }
    } catch (error) {
      console.error("Error loading consult types:", error);
    } finally {
      setLoading(false);
    }
  };

  const checkAvailability = useCallback(async (date: string) => {
    if (!selectedType || checkingRef.current) return;

    checkingRef.current = true;
    setCheckingAvailability(true);
    try {
      // Generate time slots for the day (9 AM to 5 PM, 30-minute intervals)
      const slots: string[] = [];
      for (let hour = 9; hour < 17; hour++) {
        for (let minute = 0; minute < 60; minute += 30) {
          slots.push(`${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`);
        }
      }

      const response = await fetch("/api/book/availability-batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          practitionerId,
          date,
          timeSlots: slots,
          consultType: selectedType.consult_type,
          durationMinutes: selectedType.duration_minutes,
        }),
      });

      if (response.ok) {
        const { availability } = await response.json();
        setTimeSlots(
          slots.map((time) => ({
            time,
            available: availability[time] === true,
          }))
        );
      }
    } catch (error) {
      console.error("Error checking availability:", error);
    } finally {
      setCheckingAvailability(false);
      checkingRef.current = false;
    }
  }, [practitionerId, selectedType]);

  useEffect(() => {
    if (!practitionerId) {
      alert("Missing practitioner ID");
      return;
    }

    loadConsultTypes();
    loadClinicSettings();
  }, [practitionerId]);

  // Auto-check availability when both type and date are selected
  useEffect(() => {
    if (selectedType && selectedDate && !checkingRef.current) {
      checkAvailability(selectedDate);
    }
  }, [selectedType, selectedDate, checkAvailability]);

  const handleDateSelect = (date: string) => {
    setSelectedDate(date);
    setSelectedTime("");
    setTimeSlots([]);
    checkingRef.current = false; // Reset checking flag when date changes
  };

  const handleTypeSelect = (type: ConsultType) => {
    setSelectedType(type);
    setSelectedTime("");
    setTimeSlots([]);
    checkingRef.current = false; // Reset checking flag when type changes
  };

  const handleTimeSelect = (time: string) => {
    setSelectedTime(time);
  };

  const handleSubmit = async () => {
    if (!selectedType || !selectedDate || !selectedTime || !clientInfo.email) {
      alert("Please fill in all required fields");
      return;
    }

    setSubmitting(true);
    try {
      // Send date, time, and timezone separately - server will handle conversion
      const response = await fetch("/api/book/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          practitionerId,
          consultType: selectedType.consult_type,
          date: selectedDate,
          time: selectedTime,
          durationMinutes: selectedType.duration_minutes,
          timezone: clinicTimezone,
          clientName: clientInfo.name,
          clientEmail: clientInfo.email,
          clientPhone: clientInfo.phone,
          notes: clientInfo.notes,
        }),
      });

      if (response.ok) {
        const { bookingId } = await response.json();
        router.push(`/book/confirmation?bookingId=${bookingId}`);
      } else {
        const error = await response.json();
        alert(`Error creating booking: ${error.error}`);
      }
    } catch (error: any) {
      console.error("Error submitting booking:", error);
      alert(`Error submitting booking: ${error.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-slate-600">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-semibold mb-8 text-slate-900 text-center">
          Book an Appointment
        </h1>

        <div className="bg-white rounded-2xl p-6 shadow-lg space-y-6">
          {/* Select Consultation Type */}
          <div>
            <h2 className="text-lg font-semibold mb-4">Select Consultation Type</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {consultTypes.map((type) => (
                <button
                  key={type.consult_type}
                  onClick={() => handleTypeSelect(type)}
                  className={`p-4 text-left border-2 rounded-lg transition ${
                    selectedType?.consult_type === type.consult_type
                      ? "border-[#72B01D] bg-green-50"
                      : "border-slate-200 hover:border-[#72B01D] hover:bg-green-50"
                  }`}
                >
                  <div className="font-semibold text-slate-900">{type.name}</div>
                  <div className="text-sm text-slate-600 mt-1">
                    {type.duration_minutes} minutes • {getCurrencyDisplay(currency)} {type.price}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Select Date */}
          <div>
            <h2 className="text-lg font-semibold mb-4">Select Date</h2>
            <input
              type="date"
              min={new Date().toISOString().split("T")[0]}
              value={selectedDate}
              onChange={(e) => handleDateSelect(e.target.value)}
              disabled={!selectedType}
              className="w-full px-4 py-3 border border-slate-300 rounded-lg text-slate-900 disabled:bg-slate-100 disabled:cursor-not-allowed"
            />
          </div>

          {/* Select Time */}
          {selectedType && selectedDate && (
            <div>
              <h2 className="text-lg font-semibold mb-4">Select Time</h2>
              {checkingAvailability ? (
                <div className="text-center py-8 text-slate-600">Checking availability...</div>
              ) : timeSlots.length > 0 ? (
                <div className="grid grid-cols-4 md:grid-cols-6 gap-3">
                  {timeSlots.map((slot) => {
                    const isSelected = selectedTime === slot.time;
                    const isAvailable = slot.available;
                    return (
                      <button
                        key={slot.time}
                        onClick={() => isAvailable && handleTimeSelect(slot.time)}
                        disabled={!isAvailable}
                        type="button"
                        className={
                          !isAvailable
                            ? "p-3 rounded-lg text-sm font-medium bg-slate-100 text-slate-400 cursor-not-allowed border-2 border-transparent"
                            : isSelected
                              ? "p-3 rounded-lg text-sm font-medium bg-[#4B7C0E] text-white border-2 border-[#72B01D] ring-2 ring-[#72B01D] ring-offset-2 shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-[#72B01D] focus-visible:ring-offset-2"
                              : "p-3 rounded-lg text-sm font-medium bg-[#72B01D] text-white border-2 border-transparent hover:bg-[#6AA318] hover:border-slate-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#72B01D] focus-visible:ring-offset-2 transition-colors"
                        }
                      >
                        {isSelected ? (
                          <span className="block">{slot.time}<span className="block text-[10px] mt-0.5 opacity-90">Selected</span></span>
                        ) : (
                          slot.time
                        )}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-4 text-slate-500 text-sm">
                  Please select a date to see available times
                </div>
              )}
            </div>
          )}

          {/* Client Information */}
          <div>
            <h2 className="text-lg font-semibold mb-4">Your Information</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  value={clientInfo.name}
                  onChange={(e) => setClientInfo({ ...clientInfo, name: e.target.value })}
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Email *
                </label>
                <input
                  type="email"
                  value={clientInfo.email}
                  onChange={(e) => setClientInfo({ ...clientInfo, email: e.target.value })}
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Phone
                </label>
                <input
                  type="tel"
                  value={clientInfo.phone}
                  onChange={(e) => setClientInfo({ ...clientInfo, phone: e.target.value })}
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Notes (optional)
                </label>
                <textarea
                  value={clientInfo.notes}
                  onChange={(e) => setClientInfo({ ...clientInfo, notes: e.target.value })}
                  rows={4}
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg"
                />
              </div>
            </div>
          </div>

          {/* Submit Button */}
          <div className="pt-4 border-t border-slate-200">
            <button
              onClick={handleSubmit}
              disabled={
                submitting ||
                !selectedType ||
                !selectedDate ||
                !selectedTime ||
                !clientInfo.name ||
                !clientInfo.email
              }
              className="w-full px-6 py-3 text-base font-medium rounded-lg bg-[#72B01D] hover:bg-[#6AA318] text-white disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {submitting ? "Booking..." : "Confirm Booking"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function BookPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-600 text-sm">
          Loading…
        </div>
      }
    >
      <BookPageContent />
    </Suspense>
  );
}
