import React, { useMemo } from "react";
import * as THREE from "three";
import { STATUS_STYLE } from "@/lib/depot-visuals";

export interface TrainData {
  id: number;
  code: string;
  type: number;
  isDisposed: boolean;
  lineId: number | null;
  slotIndex: number;
  status: number;
}

export interface LineData {
  id: number;
  name: string;
  capacity: number;
  length: number;
  posX: number;
  posY: number;
  rotation: number;
  terminal: number;
}

export default function TrainModel3D({
  train,
  line,
  isDragging,
  dragPos,
  onPointerDown,
  onClick,
}: {
  train: TrainData;
  line: LineData | undefined;
  isDragging: boolean;
  dragPos: [number, number, number];
  onPointerDown: (e: any) => void;
  onClick: () => void;
}) {
  // محاسبه موقعیت قطار روی ریل بر اساس slotIndex
  const position = useMemo(() => {
    if (isDragging) return dragPos;
    if (!line) return [0, -100, 0] as [number, number, number]; // خارج از صحنه

    const angle = (line.rotation * Math.PI) / 180;
    const slotSpacing = line.length / Math.max(1, line.capacity);
    const offset = -line.length / 2 + train.slotIndex * slotSpacing + slotSpacing / 2;

    const dx = Math.sin(angle) * offset;
    const dz = Math.cos(angle) * offset;

    return [line.posX + dx, 1.8, line.posY + dz] as [number, number, number];
  }, [line, train.slotIndex, isDragging, dragPos]);

  const rotationY = line ? (line.rotation * Math.PI) / 180 : 0;

  // تم رنگی بدنه قطار بر اساس نوع ناوگان:
  // AC (نوع ۰) = برقی نسل جدید نقره‌ای با نوار آبی
  // DC (نوع ۱) = برقی نسل قدیم خاکستری روشن با نوار سبز
  // دیزل (نوع ۲) = لوکوموتیو دیزلی خاکستری تیره با نوار زرد
  let baseColor = "#cbd5e1";
  let stripeColor = "#1d4ed8";
  if (train.type === 1) {
    baseColor = "#e2e8f0";
    stripeColor = "#10b981";
  } else if (train.type === 2) {
    baseColor = "#334155";
    stripeColor = "#eab308";
  }
  const isMetro = train.type !== 2;
  
  // دریافت مشخصات وضعیت برای چراغ‌های emissive
  const statusConfig = STATUS_STYLE[train.status] || STATUS_STYLE[1];
  const glowColor = statusConfig.color3d;
  const glowIntensity = statusConfig.emissiveIntensity * 2.5;

  return (
    <group
      position={position}
      rotation={[0, rotationY, 0]}
      onPointerDown={onPointerDown}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      onPointerOver={() => {
        document.body.style.cursor = "pointer";
      }}
      onPointerOut={() => {
        document.body.style.cursor = "auto";
      }}
    >
      {/* --- شاسی و سیستم تعلیق (بوجی و چرخ‌ها) --- */}
      {/* بوجی جلو */}
      <group position={[0, -0.6, 3.5]}>
        <mesh castShadow>
          <boxGeometry args={[1.8, 0.25, 2.8]} />
          <meshStandardMaterial color="#1e293b" metalness={0.95} roughness={0.35} />
        </mesh>
        {/* چرخ جلو چپ ۱ */}
        <mesh position={[-0.85, -0.15, 0.9]} rotation={[0, 0, Math.PI / 2]} castShadow>
          <cylinderGeometry args={[0.36, 0.36, 0.2, 16]} />
          <meshStandardMaterial color="#334155" metalness={0.9} roughness={0.2} />
        </mesh>
        {/* چرخ جلو راست ۱ */}
        <mesh position={[0.85, -0.15, 0.9]} rotation={[0, 0, Math.PI / 2]} castShadow>
          <cylinderGeometry args={[0.36, 0.36, 0.2, 16]} />
          <meshStandardMaterial color="#334155" metalness={0.9} roughness={0.2} />
        </mesh>
        {/* چرخ جلو چپ ۲ */}
        <mesh position={[-0.85, -0.15, -0.9]} rotation={[0, 0, Math.PI / 2]} castShadow>
          <cylinderGeometry args={[0.36, 0.36, 0.2, 16]} />
          <meshStandardMaterial color="#334155" metalness={0.9} roughness={0.2} />
        </mesh>
        {/* چرخ جلو راست ۲ */}
        <mesh position={[0.85, -0.15, -0.9]} rotation={[0, 0, Math.PI / 2]} castShadow>
          <cylinderGeometry args={[0.36, 0.36, 0.2, 16]} />
          <meshStandardMaterial color="#334155" metalness={0.9} roughness={0.2} />
        </mesh>
      </group>

      {/* بوجی عقب */}
      <group position={[0, -0.6, -3.5]}>
        <mesh castShadow>
          <boxGeometry args={[1.8, 0.25, 2.8]} />
          <meshStandardMaterial color="#1e293b" metalness={0.95} roughness={0.35} />
        </mesh>
        {/* چرخ عقب چپ ۱ */}
        <mesh position={[-0.85, -0.15, 0.9]} rotation={[0, 0, Math.PI / 2]} castShadow>
          <cylinderGeometry args={[0.36, 0.36, 0.2, 16]} />
          <meshStandardMaterial color="#334155" metalness={0.9} roughness={0.2} />
        </mesh>
        {/* چرخ عقب راست ۱ */}
        <mesh position={[0.85, -0.15, 0.9]} rotation={[0, 0, Math.PI / 2]} castShadow>
          <cylinderGeometry args={[0.36, 0.36, 0.2, 16]} />
          <meshStandardMaterial color="#334155" metalness={0.9} roughness={0.2} />
        </mesh>
        {/* چرخ عقب چپ ۲ */}
        <mesh position={[-0.85, -0.15, -0.9]} rotation={[0, 0, Math.PI / 2]} castShadow>
          <cylinderGeometry args={[0.36, 0.36, 0.2, 16]} />
          <meshStandardMaterial color="#334155" metalness={0.9} roughness={0.2} />
        </mesh>
        {/* چرخ عقب راست ۲ */}
        <mesh position={[0.85, -0.15, -0.9]} rotation={[0, 0, Math.PI / 2]} castShadow>
          <cylinderGeometry args={[0.36, 0.36, 0.2, 16]} />
          <meshStandardMaterial color="#334155" metalness={0.9} roughness={0.2} />
        </mesh>
      </group>

      {/* --- بدنه اصلی قطار (واگن مسافربری یا لوکوموتیو) --- */}
      <mesh position={[0, 0.2, -0.3]} castShadow>
        <boxGeometry args={[2.2, 1.35, 11.4]} />
        <meshStandardMaterial color={baseColor} metalness={isMetro ? 0.75 : 0.6} roughness={0.15} />
      </mesh>

      {/* --- دماغه و کابین راهبر (آیرودینامیک و شیب‌دار) --- */}
      <group position={[0, 0.2, 5.7]}>
        {/* شیار پایینی دماغه */}
        <mesh castShadow>
          <boxGeometry args={[2.18, 1.15, 0.6]} />
          <meshStandardMaterial color={baseColor} metalness={isMetro ? 0.75 : 0.6} roughness={0.15} />
        </mesh>
        {/* شیشه جلو خمیده (کابین راهبر) */}
        <mesh position={[0, 0.2, 0.31]} castShadow>
          <boxGeometry args={[1.9, 0.75, 0.05]} />
          <meshStandardMaterial color="#0f172a" roughness={0.02} metalness={0.9} />
        </mesh>
      </group>

      {/* --- سقف نقره‌ای با جزییات تهویه --- */}
      <mesh position={[0, 0.9, -0.2]} castShadow>
        <boxGeometry args={[2.1, 0.15, 11.6]} />
        <meshStandardMaterial color="#94a3b8" metalness={0.8} roughness={0.3} />
      </mesh>
      {/* فن تهویه سقف ۱ */}
      <mesh position={[0, 1.0, 2.5]}>
        <cylinderGeometry args={[0.4, 0.4, 0.1, 16]} />
        <meshStandardMaterial color="#64748b" metalness={0.8} roughness={0.4} />
      </mesh>
      {/* فن تهویه سقف ۲ */}
      <mesh position={[0, 1.0, -2.5]}>
        <cylinderGeometry args={[0.4, 0.4, 0.1, 16]} />
        <meshStandardMaterial color="#64748b" metalness={0.8} roughness={0.4} />
      </mesh>

      {/* --- درب‌های مسافری کشویی ته‌رنگ فلزی (۲ عدد در هر سمت) --- */}
      {/* درب‌های سمت چپ */}
      <mesh position={[-1.105, 0.1, 2.2]} castShadow>
        <boxGeometry args={[0.02, 1.0, 1.3]} />
        <meshStandardMaterial color="#cbd5e1" metalness={0.85} roughness={0.25} />
      </mesh>
      <mesh position={[-1.105, 0.1, -2.2]} castShadow>
        <boxGeometry args={[0.02, 1.0, 1.3]} />
        <meshStandardMaterial color="#cbd5e1" metalness={0.85} roughness={0.25} />
      </mesh>
      {/* درب‌های سمت راست */}
      <mesh position={[1.105, 0.1, 2.2]} castShadow>
        <boxGeometry args={[0.02, 1.0, 1.3]} />
        <meshStandardMaterial color="#cbd5e1" metalness={0.85} roughness={0.25} />
      </mesh>
      <mesh position={[1.105, 0.1, -2.2]} castShadow>
        <boxGeometry args={[0.02, 1.0, 1.3]} />
        <meshStandardMaterial color="#cbd5e1" metalness={0.85} roughness={0.25} />
      </mesh>

      {/* --- پنجره‌های جانبی کشیده مسافران --- */}
      {/* پنجره‌های سمت چپ */}
      <mesh position={[-1.11, 0.4, 0]}>
        <boxGeometry args={[0.02, 0.45, 2.0]} />
        <meshStandardMaterial color="#0f172a" roughness={0.05} />
      </mesh>
      <mesh position={[-1.11, 0.4, 4.0]}>
        <boxGeometry args={[0.02, 0.45, 1.2]} />
        <meshStandardMaterial color="#0f172a" roughness={0.05} />
      </mesh>
      <mesh position={[-1.11, 0.4, -4.0]}>
        <boxGeometry args={[0.02, 0.45, 1.2]} />
        <meshStandardMaterial color="#0f172a" roughness={0.05} />
      </mesh>

      {/* پنجره‌های سمت راست */}
      <mesh position={[1.11, 0.4, 0]}>
        <boxGeometry args={[0.02, 0.45, 2.0]} />
        <meshStandardMaterial color="#0f172a" roughness={0.05} />
      </mesh>
      <mesh position={[1.11, 0.4, 4.0]}>
        <boxGeometry args={[0.02, 0.45, 1.2]} />
        <meshStandardMaterial color="#0f172a" roughness={0.05} />
      </mesh>
      <mesh position={[1.11, 0.4, -4.0]}>
        <boxGeometry args={[0.02, 0.45, 1.2]} />
        <meshStandardMaterial color="#0f172a" roughness={0.05} />
      </mesh>

      {/* --- خط لهجه و نوار تزیینی بدنه (Stripe) --- */}
      <mesh position={[-1.115, -0.28, 0]} castShadow>
        <boxGeometry args={[0.015, 0.12, 11.2]} />
        <meshStandardMaterial color={stripeColor} emissive={stripeColor} emissiveIntensity={0.15} />
      </mesh>
      <mesh position={[1.115, -0.28, 0]} castShadow>
        <boxGeometry args={[0.015, 0.12, 11.2]} />
        <meshStandardMaterial color={stripeColor} emissive={stripeColor} emissiveIntensity={0.15} />
      </mesh>

      {/* --- پلاک کد قطار روی بدنه جانبی واگن --- */}
      <mesh position={[1.12, 0.25, 0]}>
        <boxGeometry args={[0.01, 0.16, 0.8]} />
        <meshStandardMaterial color="#1e293b" />
      </mesh>
      <mesh position={[-1.12, 0.25, 0]}>
        <boxGeometry args={[0.01, 0.16, 0.8]} />
        <meshStandardMaterial color="#1e293b" />
      </mesh>

      {/* --- چراغ‌های جلو با نور خیره‌کننده (Emissive) و تابلو دیجیتال --- */}
      {/* چراغ راست */}
      <mesh position={[0.72, -0.25, 6.01]} castShadow>
        <boxGeometry args={[0.22, 0.15, 0.05]} />
        <meshStandardMaterial color={glowColor} emissive={glowColor} emissiveIntensity={glowIntensity} />
      </mesh>
      {/* چراغ چپ */}
      <mesh position={[-0.72, -0.25, 6.01]} castShadow>
        <boxGeometry args={[0.22, 0.15, 0.05]} />
        <meshStandardMaterial color={glowColor} emissive={glowColor} emissiveIntensity={glowIntensity} />
      </mesh>

      {/* تابلوی نمایش مقصد بالای شیشه جلو (Destination Matrix) */}
      <mesh position={[0, 0.72, 6.01]}>
        <boxGeometry args={[0.8, 0.15, 0.05]} />
        <meshStandardMaterial color="#0f172a" emissive={glowColor} emissiveIntensity={0.6} />
      </mesh>
    </group>
  );
}
