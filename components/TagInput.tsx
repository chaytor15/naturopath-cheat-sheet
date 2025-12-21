"use client";

import { useState, KeyboardEvent } from "react";

type TagInputProps = {
  tags: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
  className?: string;
};

export default function TagInput({
  tags,
  onChange,
  placeholder = "Type and press Enter to add",
  className = "",
}: TagInputProps) {
  const [inputValue, setInputValue] = useState("");

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && inputValue.trim()) {
      e.preventDefault();
      if (!tags.includes(inputValue.trim())) {
        onChange([...tags, inputValue.trim()]);
      }
      setInputValue("");
    } else if (e.key === "Backspace" && !inputValue && tags.length > 0) {
      // Remove last tag if backspace is pressed on empty input
      onChange(tags.slice(0, -1));
    }
  };

  const removeTag = (indexToRemove: number) => {
    onChange(tags.filter((_, index) => index !== indexToRemove));
  };

  return (
    <div className={`flex flex-wrap gap-2 p-2 border border-slate-200 rounded-md bg-white min-h-[60px] focus-within:ring-1 focus-within:ring-[#72B01D66] focus-within:border-[#72B01D] ${className}`}>
      {tags.map((tag, index) => (
        <span
          key={index}
          className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-slate-100 text-[12px] text-slate-700"
        >
          {tag}
          <button
            type="button"
            onClick={() => removeTag(index)}
            className="text-slate-500 hover:text-slate-700 ml-1"
            aria-label={`Remove ${tag}`}
          >
            ×
          </button>
        </span>
      ))}
      <input
        type="text"
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={tags.length === 0 ? placeholder : ""}
        className="flex-1 min-w-[120px] outline-none text-[13px] text-slate-900 bg-transparent"
      />
    </div>
  );
}



