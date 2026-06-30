import { BarChart3, ListChecks } from "lucide-react";

const options = [
  {
    value: "simple",
    labelKey: "simpleMode",
    Icon: ListChecks,
  },
  {
    value: "detailed",
    labelKey: "detailedMode",
    Icon: BarChart3,
  },
];

export default function ModeSwitch({ disabled = false, mode, onChange, t }) {
  return (
    <fieldset
      aria-label={t.expenseMode}
      className="inline-flex w-full border-0 p-0 sm:w-auto"
      disabled={disabled}
    >
      <legend className="sr-only">{t.expenseMode}</legend>
      <div className="inline-flex w-full border-2 border-black bg-white sm:w-auto">
      {options.map(({ value, labelKey, Icon }) => {
        const isSelected = mode === value;
        const label = t[labelKey];

        return (
          <label
            className={`flex flex-1 border-r-2 border-black last:border-r-0 sm:min-w-32 ${
              disabled ? "cursor-not-allowed" : "cursor-pointer"
            }`}
            key={value}
          >
            <input
              checked={isSelected}
              className="peer sr-only"
              disabled={disabled}
              name="expense-mode"
              onChange={() => onChange(value)}
              type="radio"
              value={value}
            />
            <span
              className={`flex min-h-11 w-full items-center justify-center gap-2 px-3 text-xs font-semibold uppercase tracking-widest transition-none peer-focus-visible:outline peer-focus-visible:outline-3 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-black ${
                isSelected
                  ? "bg-black text-white"
                  : "text-black hover:bg-black hover:text-white"
              } ${disabled ? "opacity-60" : ""}`}
            >
              <Icon className="h-4 w-4 shrink-0" strokeWidth={1.5} />
              <span>{label}</span>
            </span>
          </label>
        );
      })}
      </div>
    </fieldset>
  );
}
