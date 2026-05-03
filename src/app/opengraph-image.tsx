import { ImageResponse } from "next/og";

export const size = {
  width: 1200,
  height: 630,
};

export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "56px",
          background:
            "radial-gradient(circle at 8% 12%, #33d85f40 0%, transparent 36%), radial-gradient(circle at 92% 82%, #6d58f540 0%, transparent 34%), #120f24",
          color: "#f2efff",
          fontFamily: "Inter, system-ui, sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "18px",
            color: "#c9fbdd",
            fontSize: 28,
            letterSpacing: 3,
            textTransform: "uppercase",
          }}
        >
          <div
            style={{
              width: 54,
              height: 54,
              borderRadius: 12,
              border: "2px solid #5bf7a6",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 28,
              fontWeight: 700,
            }}
          >
            IQ
          </div>
          Interview Prep Studio
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div
            style={{
              fontSize: 74,
              fontWeight: 800,
              lineHeight: 1.05,
              display: "flex",
              flexDirection: "column",
              gap: 4,
            }}
          >
            <span>Interview Question</span>
            <span style={{ color: "#8dffac" }}>Forecaster</span>
          </div>
          <div style={{ fontSize: 32, color: "#d6d0ff", maxWidth: 1000 }}>
            Generate interview questions, answer frameworks, and red flags from
            any job description.
          </div>
        </div>
      </div>
    ),
    size,
  );
}
