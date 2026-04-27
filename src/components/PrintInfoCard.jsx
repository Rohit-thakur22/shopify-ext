import React from "react";
import {
  CheckCircle2,
  ClipboardList,
  Gauge,
  Lightbulb,
  RotateCcw,
  Snowflake,
  Sparkles,
  Thermometer,
  Timer,
} from "lucide-react";

const PRODUCT_HIGHLIGHTS = [
  "Premium DTF printing",
  "Vibrant colors",
  "Durable and stretchable transfers",
  "Easy heat press application",
  "Compatible with cotton, polyester, and blends",
];

const PRESS_SETTINGS = [
  {
    label: "Temperature",
    value: "300-315°F",
    Icon: Thermometer,
    color: "#b45309",
    bg: "#fef3c7",
  },
  {
    label: "Pressure",
    value: "Medium",
    Icon: Gauge,
    color: "#1d4ed8",
    bg: "#dbeafe",
  },
  {
    label: "Press Time",
    value: "10-15 seconds",
    Icon: Timer,
    color: "#047857",
    bg: "#d1fae5",
  },
  { label: "Peel", value: "Cold peel", Icon: Snowflake, color: "#0369a1", bg: "#e0f2fe" },
  {
    label: "Repress",
    value: "5 seconds with parchment paper or Teflon sheet",
    Icon: RotateCcw,
    color: "#6d28d9",
    bg: "#ede9fe",
  },
];

const QUICK_STEPS = [
  {
    no: 1,
    title: "Pre-press garment",
    value: "10 sec",
    Icon: Thermometer,
    color: "#b45309",
    bg: "#fffbeb",
    badgeBg: "#fde68a",
  },
  {
    no: 2,
    title: "Press transfer onto apparel",
    value: "10-15 sec",
    Icon: Timer,
    color: "#047857",
    bg: "#ecfdf5",
    badgeBg: "#a7f3d0",
  },
  {
    no: 3,
    title: "Wait before peeling",
    value: "At least 10 sec",
    Icon: Snowflake,
    color: "#0369a1",
    bg: "#f0f9ff",
    badgeBg: "#bae6fd",
  },
  {
    no: 4,
    title: "Final repress with cover sheet",
    value: "5 sec",
    Icon: RotateCcw,
    color: "#6d28d9",
    bg: "#f5f3ff",
    badgeBg: "#ddd6fe",
  },
];

const TIPS = [
  "Keep the pressing area flat with no seams, collars, or folds.",
  "Use parchment paper or a Teflon sheet for the final repress.",
  "Start peel near bold parts of the design for best results.",
  "Allow garment to cool fully after pressing to avoid creasing.",
];

const FABRIC_NOTES = [
  "Cotton and blends typically perform best at 300-315°F.",
  "For polyester-sensitive garments, start lower (around 270-290°F) and test first.",
];

const PrintInfoCard = () => {
  return (
    <div
      style={{
        marginTop: "0.9rem",
        padding: "1rem",
        backgroundColor: "#ffffff",
        borderRadius: "0.875rem",
        border: "1px solid #e5e7eb",
        boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "0.75rem",
          paddingBottom: "0.75rem",
          marginBottom: "0.75rem",
          borderBottom: "1px solid #f3f4f6",
        }}
      >
        <img
          src="https://highqualitytransfers.com/cdn/shop/files/hqlogo_200x.webp?v=1753438444"
          alt="High Quality Transfers"
          loading="lazy"
          style={{ height: "1.6rem", width: "auto", objectFit: "contain" }}
        />
        <span
          style={{
            fontSize: "0.6875rem",
            fontWeight: 600,
            color: "#6b7280",
            letterSpacing: "0.02em",
            textTransform: "uppercase",
          }}
        >
          Print Info
        </span>
      </div>

      <div style={{ marginBottom: "0.85rem" }}>
        <p
          style={{
            margin: 0,
            fontSize: "0.875rem",
            fontWeight: 700,
            color: "#111827",
            display: "inline-flex",
            alignItems: "center",
            gap: "0.35rem",
          }}
        >
          <Sparkles size={14} style={{ color: "#7c3aed" }} />
          Product Description
        </p>
        <ul
          style={{
            margin: "0.5rem 0 0",
            padding: 0,
            listStyle: "none",
            fontSize: "0.9375rem",
            color: "#4b5563",
            lineHeight: 1.65,
          }}
        >
          {PRODUCT_HIGHLIGHTS.map((item) => (
            <li
              key={item}
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: "0.45rem",
                marginBottom: "0.25rem",
              }}
            >
              <CheckCircle2
                size={14}
                style={{ color: "#16a34a", marginTop: "0.15rem", flexShrink: 0 }}
              />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </div>

      <div
        style={{
          paddingTop: "0.8rem",
          borderTop: "1px solid #f3f4f6",
        }}
      >
        <p
          style={{
            margin: 0,
            fontSize: "0.875rem",
            fontWeight: 700,
            color: "#111827",
            display: "inline-flex",
            alignItems: "center",
            gap: "0.35rem",
          }}
        >
          <ClipboardList size={14} style={{ color: "#2563eb" }} />
          Application Instructions (DTF Transfers)
        </p>

        <ul
          style={{
            margin: "0.55rem 0 0",
            padding: 0,
            listStyle: "none",
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "0.5rem",
          }}
        >
          {QUICK_STEPS.map((step) => (
            <li
              key={step.no}
              style={{
                border: "1px solid #e5e7eb",
                borderRadius: "0.6rem",
                backgroundColor: step.bg,
                padding: "0.6rem",
                minHeight: "4.8rem",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "0.35rem", marginBottom: "0.35rem" }}>
                <step.Icon size={13} style={{ color: step.color, flexShrink: 0 }} />
                <span style={{ fontSize: "0.7rem", color: step.color, fontWeight: 600 }}>Step {step.no}</span>
              </div>
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: "1.35rem",
                  height: "1.35rem",
                  borderRadius: "9999px",
                  backgroundColor: step.badgeBg,
                  color: step.color,
                  fontSize: "0.72rem",
                  fontWeight: 700,
                  marginBottom: "0.35rem",
                }}
              >
                {step.no}
              </div>
              <p
                style={{
                  margin: 0,
                  fontSize: "0.9rem",
                  fontWeight: 600,
                  lineHeight: 1.35,
                  color: "#1f2937",
                }}
              >
                {step.title}
              </p>
              <p
                style={{
                  margin: "0.28rem 0 0",
                  fontSize: "0.86rem",
                  color: step.color,
                  fontWeight: 600,
                }}
              >
                {step.value}
              </p>
            </li>
          ))}
        </ul>

        <ul
          style={{
            margin: "0.7rem 0 0",
            padding: 0,
            listStyle: "none",
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "0.45rem",
          }}
        >
          {PRESS_SETTINGS.map((step, idx) => (
            <li
              key={step.label}
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: "0.45rem",
                border: "1px solid #e5e7eb",
                borderRadius: "0.55rem",
                padding: "0.45rem 0.5rem",
                backgroundColor: "#ffffff",
                ...(idx === PRESS_SETTINGS.length - 1 && PRESS_SETTINGS.length % 2 !== 0
                  ? { gridColumn: "1 / -1" }
                  : {}),
              }}
            >
              <span
                style={{
                  width: "1.1rem",
                  height: "1.1rem",
                  borderRadius: "9999px",
                  backgroundColor: step.bg,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  marginTop: "0.05rem",
                }}
              >
                <step.Icon size={12} style={{ color: step.color, flexShrink: 0 }} />
              </span>
              <span style={{ fontSize: "0.88rem", color: "#4b5563", lineHeight: 1.45 }}>
                <strong style={{ color: "#111827", fontWeight: 600 }}>
                  {step.label}:
                </strong>{" "}
                {step.value}
              </span>
            </li>
          ))}
        </ul>

        <div
          style={{
            marginTop: "0.65rem",
            padding: "0.55rem 0.65rem",
            borderRadius: "0.6rem",
            backgroundColor: "#f9fafb",
            border: "1px solid #e5e7eb",
          }}
        >
          <p
            style={{
              margin: 0,
              fontSize: "0.85rem",
              fontWeight: 700,
              color: "#374151",
            }}
          >
            Fabric Temperature Note
          </p>
          <ul
            style={{
              margin: "0.35rem 0 0",
              padding: 0,
              listStyle: "none",
              fontSize: "0.86rem",
              color: "#4b5563",
              lineHeight: 1.55,
            }}
          >
            {FABRIC_NOTES.map((note) => (
              <li
                key={note}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "0.4rem",
                  marginBottom: "0.2rem",
                }}
              >
                <CheckCircle2
                  size={13}
                  style={{ color: "#0ea5e9", marginTop: "0.1rem", flexShrink: 0 }}
                />
                <span>{note}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div
        style={{
          marginTop: "0.8rem",
          paddingTop: "0.75rem",
          borderTop: "1px solid #f3f4f6",
        }}
      >
        <p
          style={{
            margin: 0,
            fontSize: "0.875rem",
            fontWeight: 700,
            color: "#111827",
            display: "inline-flex",
            alignItems: "center",
            gap: "0.35rem",
          }}
        >
          <Lightbulb size={14} style={{ color: "#ea580c" }} />
          Tips
        </p>
        <ul
          style={{
            margin: "0.5rem 0 0",
            padding: 0,
            listStyle: "none",
            fontSize: "0.8125rem",
            color: "#4b5563",
            lineHeight: 1.65,
          }}
        >
          {TIPS.map((tip) => (
            <li
              key={tip}
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: "0.45rem",
                marginBottom: "0.25rem",
              }}
            >
              <CheckCircle2
                size={14}
                style={{ color: "#0ea5e9", marginTop: "0.15rem", flexShrink: 0 }}
              />
              <span>{tip}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default PrintInfoCard;
