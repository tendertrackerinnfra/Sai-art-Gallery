import { ImageResponse } from "next/og";

export const size = {
  width: 512,
  height: 512,
};

export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #fff7ed 0%, #ffe4e6 55%, #fce7f3 100%)",
          color: "#7a0f2e",
          fontWeight: 800,
          position: "relative",
          fontFamily: "Arial, sans-serif",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 34,
            borderRadius: 112,
            border: "22px solid #b45309",
          }}
        />
        <div
          style={{
            position: "absolute",
            inset: 64,
            borderRadius: 92,
            border: "10px solid rgba(122, 15, 46, 0.20)",
          }}
        />
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            lineHeight: 1,
          }}
        >
          <span style={{ fontSize: 176, letterSpacing: 0 }}>SAG</span>
          <span style={{ marginTop: 18, fontSize: 32, color: "#b45309" }}>Sai Art Gallery</span>
        </div>
      </div>
    ),
    size,
  );
}
