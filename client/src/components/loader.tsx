import { Html } from "@react-three/drei";

export default function Loader() {
  return (
    <Html center>
      <div className="loader-container">
        <div className="loader"></div>
        <p>Loading Character...</p>
      </div>
    </Html>
  );
}