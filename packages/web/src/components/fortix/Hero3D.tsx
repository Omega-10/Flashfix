import { useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { PresentationControls, Environment, Float, ContactShadows, RoundedBox } from "@react-three/drei";
import * as THREE from "three";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";

function AbstractAccessory() {
  const group = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (!group.current) return;
    const t = state.clock.getElapsedTime();
    group.current.rotation.y = Math.sin(t / 4) / 4;
    group.current.rotation.z = Math.sin(t / 4) / 8;
  });

  return (
    <group ref={group}>
      {/* Main geometric core - representing a precision block/case */}
      <RoundedBox args={[2, 3.5, 0.4]} radius={0.15} smoothness={4} position={[0, 0.5, 0]} castShadow receiveShadow>
        <meshPhysicalMaterial 
          color="#1A1A1A" 
          metalness={0.9} 
          roughness={0.1} 
          clearcoat={1} 
          clearcoatRoughness={0.1}
        />
      </RoundedBox>

      {/* Accent glowing ring/element */}
      <mesh position={[0, 0.5, 0.22]}>
        <ringGeometry args={[0.5, 0.55, 64]} />
        <meshBasicMaterial color="#f3910c" toneMapped={false} />
      </mesh>
      
      {/* Abstract camera/lens bump */}
      <mesh position={[-0.5, 1.5, 0.2]}>
        <cylinderGeometry args={[0.3, 0.3, 0.1, 32]} />
        <meshPhysicalMaterial color="#0D0D0D" metalness={1} roughness={0} />
      </mesh>
    </group>
  );
}

function HeroFallback() {
  return (
    <div className="w-full h-full flex items-center justify-center relative">
      <div className="absolute inset-0 bg-[#f3910c] opacity-5 blur-[120px] rounded-full" />
      <div className="relative z-10 flex items-center select-none opacity-80">
        <span className="heading-fortix text-[clamp(80px,12vw,140px)] tracking-wider text-[var(--text-primary)] uppercase drop-shadow-2xl">
          FORTI
        </span>
        <span 
          className="heading-fortix text-[clamp(100px,14vw,160px)] text-[#f3910c] -ml-2 leading-none" 
          style={{ textShadow: "0 0 40px rgba(243,145,12,0.5)" }}
        >
          ×
        </span>
      </div>
    </div>
  );
}

export default function Hero3D() {
  return (
    <div className="w-full h-[500px] lg:h-[700px] relative cursor-grab active:cursor-grabbing">
      <ErrorBoundary fallback={<HeroFallback />}>
        <div className="absolute inset-0 bg-[#f3910c] opacity-[0.03] blur-[100px] rounded-full" />
        <Canvas shadows dpr={[1, 2]} camera={{ position: [0, 0, 6], fov: 45 }} gl={{ powerPreference: "high-performance", antialias: false }}>
          <Environment preset="city" />
          <ambientLight intensity={0.5} />
        <spotLight position={[10, 10, 10]} angle={0.15} penumbra={1} intensity={2} castShadow />
        
        <PresentationControls
          global
          rotation={[0, 0, 0]}
          polar={[-0.4, 0.2]}
          azimuth={[-1, 0.75]}
          config={{ mass: 2, tension: 400 }}
          snap={{ mass: 4, tension: 400 }}
        >
          <Float rotationIntensity={0.4} floatIntensity={2} speed={1.5}>
            <AbstractAccessory />
          </Float>
        </PresentationControls>

        <ContactShadows position={[0, -1.8, 0]} opacity={0.4} scale={10} blur={2} far={4} />
      </Canvas>
      </ErrorBoundary>
    </div>
  );
}
