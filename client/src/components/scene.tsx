import React, { Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { Character } from "./character/Character";

interface SceneProps {
  characterId: string;
}

export const Scene: React.FC<SceneProps> = ({ characterId }) => {
  return (
    <div className="scene-container">
      <Canvas
        camera={{ position: [0, 1.38, 1.15], fov: 30 }}
        gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
        dpr={[1, 2]}
      >
        {/* Anime Character Studio Lighting */}
        <ambientLight intensity={1.1} />
        <directionalLight position={[1, 2, 2]} intensity={1.5} color="#ffffff" />
        <directionalLight position={[-1, 1, 1]} intensity={0.8} color="#e0e7ff" />
        <directionalLight position={[0, 2, -2]} intensity={1.2} color="#c084fc" />

        <Suspense fallback={null}>
          <Character characterId={characterId} />
        </Suspense>

        <OrbitControls
          target={[0, 1.28, 0]}
          minDistance={0.6}
          maxDistance={3.5}
          maxPolarAngle={Math.PI / 2 + 0.1}
          minPolarAngle={Math.PI / 6}
          enablePan={false}
          dampingFactor={0.05}
        />
      </Canvas>
    </div>
  );
};
