import React, { useMemo } from "react";
import { Html } from "@react-three/drei";

// سولهٔ صنعتی — چهار ستون فلزی، دیوار انتهایی شیشه‌ای، سقف شیب‌دار،
// خرپا/تیرک‌های سقفی برای حس صنعتی، و پلاک نام سولهٔ خوانا.
export default function IndustrialShed({
  zoneX,
  zoneZ,
  label,
  color,
  onSelect,
  gridRow = "full",
  width: widthProp,
  depth: depthProp,
}: {
  zoneX: number;
  zoneZ: number;
  label: string;
  color: string;
  onSelect: () => void;
  gridRow?: "top" | "bottom" | "full";
  width?: number;
  depth?: number;
}) {
  // ابعاد بر اساس نوع ردیف — «full» بلندتر (خط اصلی، واگن‌سازی، دیزل‌شاپ)
  const width = widthProp ?? 100;
  const depth = depthProp ?? (gridRow === "full" ? 180 : 90);
  const height = 26;

  // موقعیت مرکز سوله — همان [zoneX, 0, zoneZ] که در ZONE_CONFIG آمده
  // بدون افزودن size/2 (چون مرکز زون از قبل خودش مرکز است).
  const cx = zoneX;
  const cz = zoneZ;

  // خرپای سقفی — ۵ تیر عرضی
  const trusses = useMemo(
    () => Array.from({ length: 5 }, (_, i) => -depth / 2 + (depth / 4) * i),
    [depth],
  );

  return (
    <group position={[cx, 0, cz]}>
      {/* ۴ ستون گوشه فلزی PBR */}
      {[
        [-width / 2, -depth / 2],
        [ width / 2, -depth / 2],
        [-width / 2,  depth / 2],
        [ width / 2,  depth / 2],
      ].map(([x, z], i) => (
        <mesh key={i} position={[x, height / 2, z]} raycast={() => null} castShadow>
          <boxGeometry args={[1.6, height, 1.6]} />
          <meshStandardMaterial color="#3f4a5a" metalness={0.85} roughness={0.28} />
        </mesh>
      ))}

      {/* تیرک‌های سقف عرضی (خرپا) */}
      {trusses.map((z, i) => (
        <mesh key={`t-${i}`} position={[0, height, z]} raycast={() => null} castShadow>
          <boxGeometry args={[width, 0.35, 0.4]} />
          <meshStandardMaterial color="#4b5563" metalness={0.7} roughness={0.35} />
        </mesh>
      ))}

      {/* تیرک‌های طولی نگهدارنده در دو طرف */}
      <mesh position={[-width / 2, height, 0]} raycast={() => null} castShadow>
        <boxGeometry args={[0.4, 0.5, depth]} />
        <meshStandardMaterial color="#4b5563" metalness={0.7} roughness={0.35} />
      </mesh>
      <mesh position={[width / 2, height, 0]} raycast={() => null} castShadow>
        <boxGeometry args={[0.4, 0.5, depth]} />
        <meshStandardMaterial color="#4b5563" metalness={0.7} roughness={0.35} />
      </mesh>

      {/* دیوارهای انتهایی (Z axis) — شیشه‌ی نیمه‌شفاف با ته‌رنگ زون */}
      <mesh position={[0, height / 2, -depth / 2]} raycast={() => null}>
        <boxGeometry args={[width, height, 0.22]} />
        <meshStandardMaterial color={color} transparent opacity={0.20} roughness={0.15} metalness={0.05} />
      </mesh>
      <mesh position={[0, height / 2,  depth / 2]} raycast={() => null}>
        <boxGeometry args={[width, height, 0.22]} />
        <meshStandardMaterial color={color} transparent opacity={0.20} roughness={0.15} metalness={0.05} />
      </mesh>

      {/* دیوارهای جانبی (X axis) — تا مرز بصری خطوط را قاب بگیرد */}
      <mesh position={[-width / 2, height / 2, 0]} raycast={() => null}>
        <boxGeometry args={[0.22, height, depth]} />
        <meshStandardMaterial color={color} transparent opacity={0.20} roughness={0.15} metalness={0.05} />
      </mesh>
      <mesh position={[ width / 2, height / 2, 0]} raycast={() => null}>
        <boxGeometry args={[0.22, height, depth]} />
        <meshStandardMaterial color={color} transparent opacity={0.20} roughness={0.15} metalness={0.05} />
      </mesh>

      {/* پاخور رنگی — نوار افقی پایین دیوار جانبی برای تشخیص سریع رنگ زون */}
      <mesh position={[-width / 2 + 0.15, 0.5, 0]} raycast={() => null}>
        <boxGeometry args={[0.32, 1, depth - 0.5]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.15} />
      </mesh>
      <mesh position={[ width / 2 - 0.15, 0.5, 0]} raycast={() => null}>
        <boxGeometry args={[0.32, 1, depth - 0.5]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.15} />
      </mesh>

      {/* سقف دو شیب — شیشه‌ای مه‌آلود */}
      <mesh position={[-width / 4, height + 1, 0]} rotation={[0, 0, 0.18]} castShadow receiveShadow raycast={() => null}>
        <boxGeometry args={[width / 2 + 2, 0.35, depth]} />
        <meshStandardMaterial color="#cfe7fa" transparent opacity={0.18} roughness={0.08} metalness={0.05} />
      </mesh>
      <mesh position={[width / 4, height + 1, 0]} rotation={[0, 0, -0.18]} castShadow receiveShadow raycast={() => null}>
        <boxGeometry args={[width / 2 + 2, 0.35, depth]} />
        <meshStandardMaterial color="#cfe7fa" transparent opacity={0.18} roughness={0.08} metalness={0.05} />
      </mesh>

      {/* نوار رنگی لهجه‌ی زون بالای دیوار انتهایی جلو — تشخیص سریع */}
      <mesh position={[0, height - 1, depth / 2 - 0.15]} raycast={() => null}>
        <boxGeometry args={[width - 8, 1.2, 0.3]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.35} />
      </mesh>

      {/* پلاک نام سوله — خوانا، بدون ایموجی */}
      <Html position={[0, height + 6, 0]} center>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onSelect();
          }}
          style={{
            background: "color-mix(in oklab, var(--panel) 92%, transparent)",
            backdropFilter: "blur(6px)",
            WebkitBackdropFilter: "blur(6px)",
            color: "var(--ink)",
            border: `1px solid ${color}`,
            padding: "5px 12px",
            borderRadius: "var(--r-pill)",
            fontSize: "11.5px",
            fontWeight: 700,
            letterSpacing: "-.01em",
            cursor: "pointer",
            boxShadow: "var(--sh-2)",
            whiteSpace: "nowrap",
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            transition: "transform .15s cubic-bezier(.32,.72,0,1), box-shadow .15s cubic-bezier(.32,.72,0,1)",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = "translateY(-1px)";
            e.currentTarget.style.boxShadow = "var(--sh-3)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = "none";
            e.currentTarget.style.boxShadow = "var(--sh-2)";
          }}
        >
          <span
            style={{
              width: 8, height: 8, borderRadius: 999,
              background: color,
              boxShadow: `0 0 0 3px color-mix(in oklab, ${color} 22%, transparent)`,
            }}
          />
          {label}
        </button>
      </Html>
    </group>
  );
}
