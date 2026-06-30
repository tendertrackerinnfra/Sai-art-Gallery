import { ImageResponse } from "next/og";

export const size = {
  width: 180,
  height: 180,
};

export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#fff7ed",
          borderRadius: 36,
          color: "#7a0f2e",
          fontWeight: 800,
          fontFamily: "Arial, sans-serif",
          position: "relative",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 14,
            borderRadius: 28,
            border: "8px solid #b45309",
          }}
        />
        <span style={{ fontSize: 68, letterSpacing: 0 }}>SAG</span>
      </div>
    ),
    size,
  );
}
