"use client";

import React, { useEffect, useMemo } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Html, ContactShadows, Environment, Grid } from "@react-three/drei";
import * as THREE from "three";
import IndustrialShed from "./Shed";
import TrainModel3D from "./TrainModel";
import { LineData, TrainData, ActiveManovrData, ZoneMap } from "../types";

// کامپوننت هدایت دوربین سه‌بعدی برای زوم روی سوله‌ها
function CameraDirector({
  focusTarget,
  controlsRef,
}: {
  focusTarget: [number, number, number] | null;
  controlsRef: React.MutableRefObject<any>;
}) {
  const { camera, invalidate } = useThree();

  useFrame(() => {
    if (focusTarget && controlsRef.current) {
      const targetVec = new THREE.Vector3(...focusTarget);
      const currentTarget = controlsRef.current.target;
      const distTarget = currentTarget.distanceTo(targetVec);

      const targetCamPos = new THREE.Vector3(focusTarget[0], focusTarget[1] + 60, focusTarget[2] + 75);
      const distCam = camera.position.distanceTo(targetCamPos);

      if (distTarget > 0.05 || distCam > 0.05) {
        controlsRef.current.target.x = THREE.MathUtils.lerp(controlsRef.current.target.x, focusTarget[0], 0.08);
        controlsRef.current.target.y = THREE.MathUtils.lerp(controlsRef.current.target.y, focusTarget[1], 0.08);
        controlsRef.current.target.z = THREE.MathUtils.lerp(controlsRef.current.target.z, focusTarget[2], 0.08);

        camera.position.x = THREE.MathUtils.lerp(camera.position.x, focusTarget[0], 0.05);
        camera.position.y = THREE.MathUtils.lerp(camera.position.y, focusTarget[1] + 60, 0.05);
        camera.position.z = THREE.MathUtils.lerp(camera.position.z, focusTarget[2] + 75, 0.05);

        controlsRef.current.update();
        invalidate();
      }
    }
  });

  return null;
}

// کامپوننت هدایت زنده دوربین به ترمینال پیش‌فرض
function CameraController({
  defaultTerminal,
  zones,
}: {
  defaultTerminal: number;
  zones: ZoneMap;
}) {
  const { camera } = useThree();

  useEffect(() => {
    if (defaultTerminal > 0 && zones[defaultTerminal]) {
      const zone = zones[defaultTerminal];
      camera.position.set(zone.x, 90, zone.z + 130);
      camera.lookAt(new THREE.Vector3(zone.x, 0, zone.z));
    } else {
      camera.position.set(0, 380, 420);
      camera.lookAt(new THREE.Vector3(0, 0, 0));
    }
  }, [defaultTerminal, camera, zones]);

  return null;
}

export interface Depot3DCanvasProps {
  appearance: { theme: string };
  currentQuality: "high" | "low" | "2d";
  lines: LineData[];
  trains: TrainData[];
  activeManovrs: ActiveManovrData[];
  zones: ZoneMap;
  defaultTerminal: number;
  modifiedPositions: Record<number, { posX: number; posY: number; rotation: number }>;
  cameraFocusTarget: [number, number, number] | null;
  setCameraFocusTarget: (target: [number, number, number] | null) => void;
  controlsRef: React.MutableRefObject<any>;
  hoveredLineId: number | null;
  setHoveredLineId: (id: number | null) => void;
  selectedLine: LineData | null;
  setSelectedLine: (line: LineData | null) => void;
  selectedTrain: TrainData | null;
  setSelectedTrain: (train: TrainData | null) => void;
  draggedTrainId: number | null;
  dragPos: [number, number, number];
  canCreateManovr: boolean;
  onTrainDragStart: (trainId: number, startPos: [number, number, number]) => void;
  onSelectEmptySlot: (sourceLineId: number | null, destLineId: number, slotIdx: number) => void;
}

export default function Depot3DCanvas({
  appearance,
  currentQuality,
  lines,
  trains,
  activeManovrs,
  zones,
  defaultTerminal,
  modifiedPositions,
  cameraFocusTarget,
  setCameraFocusTarget,
  controlsRef,
  hoveredLineId,
  setHoveredLineId,
  selectedLine,
  setSelectedLine,
  selectedTrain,
  setSelectedTrain,
  draggedTrainId,
  dragPos,
  canCreateManovr,
  onTrainDragStart,
  onSelectEmptySlot,
}: Depot3DCanvasProps) {
  // تمیزکاری سراسری اشاره‌گر ماوس در صورت خروج غیرمنتظره از صحنه
  useEffect(() => {
    return () => {
      if (typeof document !== "undefined") {
        document.body.style.cursor = "auto";
      }
    };
  }, []);

  // کش هوشمند اسلات‌های خالی برای جلوگیری از محاسبات سنگین O(N^2) در هر فریم
  const emptySlotsByLine = useMemo(() => {
    if (!selectedTrain) return new Map<number, number[]>();
    const map = new Map<number, number[]>();
    for (const line of lines) {
      const occupied = new Set(
        trains.filter((t) => t.lineId === line.id).map((t) => t.slotIndex)
      );
      const empty: number[] = [];
      for (let i = 0; i < line.capacity; i++) {
        if (!occupied.has(i)) {
          empty.push(i);
        }
      }
      map.set(line.id, empty);
    }
    return map;
  }, [selectedTrain, lines, trains]);

  return (
    <Canvas
      shadows
      frameloop="demand"
      camera={{ position: [0, 380, 420], fov: 42, near: 1, far: 2500 }}
      gl={{ antialias: true, powerPreference: "high-performance" }}
      style={{
        flex: 1,
        background:
          appearance.theme === "dark"
            ? "linear-gradient(180deg, #0a0e14 0%, #131a26 100%)"
            : "linear-gradient(180deg, #f5f7fa 0%, #dfe6ee 100%)",
      }}
    >
      {/* نورپردازی صحنه */}
      <ambientLight intensity={appearance.theme === "dark" ? 0.35 : 0.55} />
      <hemisphereLight
        args={[
          appearance.theme === "dark" ? "#7ea6d8" : "#eef4ff",
          appearance.theme === "dark" ? "#101828" : "#c7d2df",
          appearance.theme === "dark" ? 0.35 : 0.6,
        ]}
      />
      <directionalLight
        position={[120, 200, 80]}
        intensity={appearance.theme === "dark" ? 1.0 : 1.4}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-400}
        shadow-camera-right={400}
        shadow-camera-top={300}
        shadow-camera-bottom={-300}
        shadow-bias={-0.0005}
      />
      {currentQuality === "high" && (
        <Environment preset={appearance.theme === "dark" ? "night" : "city"} />
      )}

      {/* کف پایانه — گرید ظریف صنعتی */}
      <Grid
        args={[1400, 700]}
        position={[0, 0, 0]}
        cellSize={6}
        cellThickness={0.6}
        cellColor={appearance.theme === "dark" ? "#1e2a3b" : "#c3ccd8"}
        sectionSize={60}
        sectionThickness={1.2}
        sectionColor={appearance.theme === "dark" ? "#2a3a52" : "#94a3b8"}
        fadeDistance={520}
        fadeStrength={1}
        infiniteGrid={false}
        followCamera={false}
      />

      {/* سایه‌ی نرم و یکپارچه پایانه با ایجاد تنها یک FBO به جای تکثیر به ازای هر زون */}
      {currentQuality === "high" && (
        <ContactShadows
          position={[0, 0.04, 0]}
          opacity={appearance.theme === "dark" ? 0.55 : 0.35}
          scale={1200}
          blur={2.2}
          far={30}
          resolution={1024}
          color="#000000"
        />
      )}

      {/* کامپوننت هدایت زنده دوربین */}
      <CameraDirector focusTarget={cameraFocusTarget} controlsRef={controlsRef} />

      {/* رندر مناطق و سوله‌های پایانه دپو */}
      {Object.entries(zones).map(([id, zone]) => {
        const termId = Number(id);
        const isFull = zone.gridRow === "full";
        const lineCount = lines.filter((l) => l.terminal === termId).length;

        const shedW = Math.min(220, Math.max(90, 24 + Math.max(0, lineCount - 1) * 8));
        const shedD = isFull ? 180 : 90;

        const gW = shedW - 4;
        const gD = shedD - 4;
        return (
          <group key={id}>
            {/* کف زون */}
            <mesh
              rotation={[-Math.PI / 2, 0, 0]}
              position={[zone.x, 0.05, zone.z]}
              receiveShadow
              raycast={() => null}
            >
              <planeGeometry args={[gW, gD]} />
              <meshStandardMaterial
                color={zone.color}
                roughness={0.95}
                metalness={0.02}
                transparent
                opacity={appearance.theme === "dark" ? 0.22 : 0.28}
              />
            </mesh>

            {/* سازه سه‌بعدی سوله */}
            <IndustrialShed
              zoneX={zone.x}
              zoneZ={zone.z}
              label={zone.label}
              color={zone.color}
              gridRow={zone.gridRow ?? "full"}
              width={shedW}
              depth={shedD}
              onSelect={() => setCameraFocusTarget([zone.x, 0, zone.z])}
            />
          </group>
        );
      })}

      {/* رندر ریل‌ها و خطوط آهن */}
      {lines.map((line) => {
        const isModified = !!modifiedPositions[line.id];
        const posX = isModified ? modifiedPositions[line.id].posX : line.posX;
        const posY = isModified ? modifiedPositions[line.id].posY : line.posY;
        const rotation = isModified ? modifiedPositions[line.id].rotation : line.rotation;
        const angle = (rotation * Math.PI) / 180;

        return (
          <group
            key={line.id}
            position={[posX, 0.2, posY]}
            rotation={[0, angle, 0]}
            onPointerOver={(e) => {
              e.stopPropagation();
              setHoveredLineId(line.id);
            }}
            onPointerOut={() => {
              setHoveredLineId(null);
            }}
          >
            {/* ریل فلزی PBR */}
            <mesh castShadow receiveShadow position={[0.9, 0.3, 0]}>
              <boxGeometry args={[0.35, 0.35, line.length]} />
              <meshStandardMaterial color="#8fa2b8" metalness={0.9} roughness={0.25} />
            </mesh>
            <mesh castShadow receiveShadow position={[-0.9, 0.3, 0]}>
              <boxGeometry args={[0.35, 0.35, line.length]} />
              <meshStandardMaterial color="#8fa2b8" metalness={0.9} roughness={0.25} />
            </mesh>
            {/* بستر تراورس با ته‌رنگ زون */}
            <mesh receiveShadow>
              <boxGeometry args={[3, 0.1, line.length]} />
              <meshStandardMaterial
                color={zones[line.terminal]?.color ?? "#78350f"}
                roughness={0.95}
                metalness={0.02}
              />
            </mesh>

            {/* برچسب نام ریل */}
            {(hoveredLineId === line.id || selectedLine?.id === line.id) && (
              <Html position={[0, 1.6, -line.length / 2]} center distanceFactor={40} zIndexRange={[100, 0]}>
                <div
                  style={{
                    background: "color-mix(in oklab, var(--panel) 92%, transparent)",
                    backdropFilter: "blur(6px)",
                    WebkitBackdropFilter: "blur(6px)",
                    color: "var(--ink)",
                    padding: "3px 9px",
                    borderRadius: "999px",
                    fontSize: "11px",
                    fontWeight: 700,
                    whiteSpace: "nowrap",
                    cursor: "pointer",
                    boxShadow: "var(--sh-2)",
                    border: `1px solid ${selectedLine?.id === line.id ? "var(--accent)" : "var(--line)"}`,
                  }}
                  onClick={() => setSelectedLine(line)}
                >
                  {line.name}
                </div>
              </Html>
            )}

            {/* نشان مانور فعال */}
            {activeManovrs.some((m) => m.destinationLineId === line.id) &&
              hoveredLineId !== line.id &&
              selectedLine?.id !== line.id && (
                <mesh position={[0, 1.4, 0]} raycast={() => null}>
                  <sphereGeometry args={[0.55, 12, 12]} />
                  <meshStandardMaterial color="#22c55e" emissive="#22c55e" emissiveIntensity={2.5} />
                </mesh>
              )}
          </group>
        );
      })}

      {/* رندر قطارها */}
      {trains.map((train) => {
        const line = lines.find((l) => l.id === train.lineId);
        return (
          <TrainModel3D
            key={train.id}
            train={train}
            line={line}
            isDragging={draggedTrainId === train.id}
            dragPos={dragPos}
            onPointerDown={(e) => {
              if (canCreateManovr) onTrainDragStart(train.id, [e.point.x, 1.8, e.point.z]);
            }}
            onClick={() => setSelectedTrain(train)}
          />
        );
      })}

      {/* رندر نشانگرهای اسلات خالی جهت مانور قطار منتخب با استفاده از کش O(1) */}
      {selectedTrain &&
        lines.map((line) => {
          const emptySlots = emptySlotsByLine.get(line.id) || [];
          if (emptySlots.length === 0) return null;

          const angle = (line.rotation * Math.PI) / 180;
          const slotSpacing = line.length / Math.max(1, line.capacity);

          return emptySlots.map((slotIdx) => {
            const offset = -line.length / 2 + slotIdx * slotSpacing + slotSpacing / 2;
            const dx = Math.sin(angle) * offset;
            const dz = Math.cos(angle) * offset;
            const slotPos = [line.posX + dx, 0.6, line.posY + dz] as [number, number, number];

            return (
              <mesh
                key={`${line.id}-${slotIdx}`}
                position={slotPos}
                rotation={[0, angle, 0]}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectEmptySlot(selectedTrain.lineId, line.id, slotIdx);
                }}
                onPointerOver={(e) => {
                  e.stopPropagation();
                  document.body.style.cursor = "pointer";
                }}
                onPointerOut={(e) => {
                  e.stopPropagation();
                  document.body.style.cursor = "auto";
                }}
              >
                <cylinderGeometry args={[1.6, 1.6, 0.4, 16]} />
                <meshStandardMaterial
                  color="#22c55e"
                  emissive="#22c55e"
                  emissiveIntensity={1.2}
                  transparent
                  opacity={0.75}
                />
              </mesh>
            );
          });
        })}

      <CameraController defaultTerminal={defaultTerminal} zones={zones} />
      <OrbitControls
        ref={controlsRef}
        makeDefault
        maxPolarAngle={Math.PI / 2.15}
        minDistance={20}
        maxDistance={800}
        target={[0, 0, 0]}
        enableDamping
        dampingFactor={0.08}
      />
    </Canvas>
  );
}
