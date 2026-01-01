"use client";

import { useEffect, useState } from "react";
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

export default function BookPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const practitionerId = searchParams.get("practitionerId") || "";

  const [step, setStep] = useState<"type" | "date" | "time" | "info" | "confirm">("type");
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

  useEffect(() => {
    if (!practitionerId) {
      alert("Missing practitioner ID");
      return;
    }

    loadConsultTypes();
    loadClinicSettings();
  }, [practitionerId]);

  const loadClinicSettings = async () => {
    try {
      const response = await fetch(`/api/book/clinic-settings?practitionerId=${practitionerId}`);
      if (response.ok) {
        const data = await response.json();
        setClinicTimezone(data.timezone || "Australia/Sydney");
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

  const handleDateSelect = async (date: string) => {
    setSelectedDate(date);
    setSelectedTime("");
    setTimeSlots([]);
    setStep("time");
    await checkAvailability(date);
  };

  const checkAvailability = async (date: string) => {
    if (!selectedType) return;

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
    }
  };

  const handleTimeSelect = (time: string) => {
    setSelectedTime(time);
    setStep("info");
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
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-semibold mb-8 text-slate-900 text-center">
          Book an Appointment
        </h1>

        {/* Step 1: Select Consult Type */}
        {step === "type" && (
          <div className="bg-white rounded-2xl p-6 shadow-lg">
            <h2 className="text-lg font-semibold mb-4">Select Consultation Type</h2>
            <div className="space-y-3">
              {consultTypes.map((type) => (
                <button
                  key={type.consult_type}
                  onClick={() => {
                    setSelectedType(type);
                    setStep("date");
                  }}
                  className="w-full p-4 text-left border-2 rounded-lg transition hover:border-[#72B01D] hover:bg-green-50"
                >
                  <div className="font-semibold text-slate-900">{type.name}</div>
                  <div className="text-sm text-slate-600 mt-1">
                    {type.duration_minutes} minutes • ${type.price}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 2: Select Date */}
        {step === "date" && selectedType && (
          <div className="bg-white rounded-2xl p-6 shadow-lg">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Select Date</h2>
              <button
                onClick={() => setStep("type")}
                className="text-sm text-slate-600 hover:text-slate-900"
              >
                ← Back
              </button>
            </div>
            <input
              type="date"
              min={new Date().toISOString().split("T")[0]}
              value={selectedDate}
              onChange={(e) => handleDateSelect(e.target.value)}
              className="w-full px-4 py-3 border border-slate-300 rounded-lg text-slate-900"
            />
          </div>
        )}

        {/* Step 3: Select Time */}
        {step === "time" && selectedType && selectedDate && (
          <div className="bg-white rounded-2xl p-6 shadow-lg">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Select Time</h2>
              <button
                onClick={() => setStep("date")}
                className="text-sm text-slate-600 hover:text-slate-900"
              >
                ← Back
              </button>
            </div>
            {checkingAvailability ? (
              <div className="text-center py-8 text-slate-600">Checking availability...</div>
            ) : (
              <div className="grid grid-cols-4 gap-3">
                {timeSlots.map((slot) => (
                  <button
                    key={slot.time}
                    onClick={() => slot.available && handleTimeSelect(slot.time)}
                    disabled={!slot.available}
                    className={`p-3 rounded-lg text-sm font-medium transition ${
                      slot.available
                        ? "bg-[#72B01D] text-white hover:bg-[#6AA318]"
                        : "bg-slate-100 text-slate-400 cursor-not-allowed"
                    }`}
                  >
                    {slot.time}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Step 4: Client Information */}
        {step === "info" && selectedType && selectedDate && selectedTime && (
          <div className="bg-white rounded-2xl p-6 shadow-lg">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Your Information</h2>
              <button
                onClick={() => setStep("time")}
                className="text-sm text-slate-600 hover:text-slate-900"
              >
                ← Back
              </button>
            </div>
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
              <button
                onClick={handleSubmit}
                disabled={submitting || !clientInfo.name || !clientInfo.email}
                className="w-full px-6 py-3 text-sm font-medium rounded-lg bg-[#72B01D] hover:bg-[#6AA318] text-white disabled:opacity-50"
              >
                {submitting ? "Booking..." : "Confirm Booking"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

