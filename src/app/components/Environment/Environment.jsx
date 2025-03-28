import * as THREE from 'three';
import React, { useEffect, useRef, useState } from 'react';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import * as CANNON from 'cannon-es';
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RotateCw } from 'lucide-react';

export default function Environment() {
  const mountRef = useRef(null);
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const rendererRef = useRef(null);
  const controlsRef = useRef(null);
  const worldRef = useRef(null);
  const boxBodyRef = useRef(null);
  const boxMeshRef = useRef(null);
  const clockRef = useRef(new THREE.Clock());
  const windForceRef = useRef(new CANNON.Vec3(2, 0, 0));

  const [params, setParams] = useState({
    gravity: 9.8,
    atmosphericPressure: 1.0,
    windSpeed: 2.0,
    windDirection: 0,
    atmosphericDensity: 1.2,
  });

  // Initialize the scene once on mount
  useEffect(() => {
    // Three.js setup
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xbfd1e5);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 10, 20);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    mountRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controlsRef.current = controls;

    // Cannon.js physics setup
    const world = new CANNON.World();
    world.gravity.set(0, -params.gravity, 0);
    worldRef.current = world;

    // Ground
    const groundMaterial = new CANNON.Material({ friction: 0.5 });
    const groundBody = new CANNON.Body({
      mass: 0,
      shape: new CANNON.Plane(),
      material: groundMaterial,
    });
    groundBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
    world.addBody(groundBody);

    const groundGeometry = new THREE.PlaneGeometry(100, 100);
    const groundMesh = new THREE.Mesh(
      groundGeometry,
      new THREE.MeshBasicMaterial({ color: 0x888888 })
    );
    groundMesh.rotation.x = -Math.PI / 2;
    scene.add(groundMesh);

    // Falling box
    const boxMaterial = new CANNON.Material({ friction: 0.5 });
    const boxBody = new CANNON.Body({
      mass: 1,
      shape: new CANNON.Box(new CANNON.Vec3(1, 1, 1)),
      material: boxMaterial,
      position: new CANNON.Vec3(0, 10, 0),
    });
    world.addBody(boxBody);
    boxBodyRef.current = boxBody;

    const boxGeometry = new THREE.BoxGeometry(2, 2, 2);
    const boxMesh = new THREE.Mesh(
      boxGeometry,
      new THREE.MeshBasicMaterial({ color: 0xff0000 })
    );
    scene.add(boxMesh);
    boxMeshRef.current = boxMesh;

    // Contact material
    const contactMaterial = new CANNON.ContactMaterial(groundMaterial, boxMaterial, {
      friction: 0.5,
    });
    world.addContactMaterial(contactMaterial);

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
    directionalLight.position.set(5, 10, 5);
    scene.add(directionalLight);

    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', handleResize);

    // Start animation loop
    const animate = () => {
      requestAnimationFrame(animate);
      const deltaTime = clockRef.current.getDelta();

      // Update physics
      worldRef.current.step(deltaTime);

      // Sync Three.js mesh with Cannon.js body
      boxMeshRef.current.position.copy(boxBodyRef.current.position);
      boxMeshRef.current.quaternion.copy(boxBodyRef.current.quaternion);

      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      window.removeEventListener('resize', handleResize);
      mountRef.current?.removeChild(renderer.domElement);
    };
  }, []);

  // Update physics when params change
  useEffect(() => {
    if (!worldRef.current || !boxBodyRef.current) return;

    // Update gravity
    worldRef.current.gravity.set(0, -params.gravity, 0);

    // Update wind force
    const angle = THREE.MathUtils.degToRad(params.windDirection);
    const forceMagnitude = params.windSpeed * params.atmosphericDensity;
    windForceRef.current.set(
      Math.cos(angle) * forceMagnitude,
      0,
      Math.sin(angle) * forceMagnitude
    );

    // Apply wind force continuously (this will be handled in the animation loop)
  }, [params]);

  // Animation loop for continuous wind force
  useEffect(() => {
    if (!worldRef.current || !boxBodyRef.current) return;

    const applyForces = () => {
      if (boxBodyRef.current) {
        boxBodyRef.current.applyForce(windForceRef.current, boxBodyRef.current.position);
      }
      requestAnimationFrame(applyForces);
    };

    const forceAnimationId = requestAnimationFrame(applyForces);

    return () => {
      cancelAnimationFrame(forceAnimationId);
    };
  }, []);

  const resetSimulation = () => {
    if (boxBodyRef.current) {
      boxBodyRef.current.position.set(0, 10, 0);
      boxBodyRef.current.velocity.set(0, 0, 0);
      boxBodyRef.current.angularVelocity.set(0, 0, 0);
    }
    setParams({
      gravity: 9.8,
      atmosphericPressure: 1.0,
      windSpeed: 0,
      windDirection: 0,
      atmosphericDensity: 1.2,
    });
  };

  return (
    <div className="relative w-full h-full">
      <div ref={mountRef} className="absolute inset-0" />
      
      <Card className="absolute top-4 left-4 w-80 bg-zinc-900/90 backdrop-blur-sm border-zinc-800 shadow-xl">
        <CardHeader>
          <CardTitle className="text-zinc-100">Environment Controls</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Gravity Control */}
          <div className="space-y-2">
            <Label className="text-zinc-300">Gravity: {params.gravity} m/s²</Label>
            <Slider
              min={0}
              max={20}
              step={0.1}
              value={[params.gravity]}
              onValueChange={(val) => setParams(p => ({...p, gravity: val[0]}))}
              className="[&_[role=slider]]:bg-emerald-500"
            />
          </div>

          {/* Wind Speed */}
          <div className="space-y-2">
            <Label className="text-zinc-300">Wind Speed: {params.windSpeed} m/s</Label>
            <Slider
              min={0}
              max={20}
              step={0.1}
              value={[params.windSpeed]}
              onValueChange={(val) => setParams(p => ({...p, windSpeed: val[0]}))}
              className="[&_[role=slider]]:bg-sky-500"
            />
          </div>

          {/* Wind Direction */}
          <div className="space-y-2">
            <Label className="text-zinc-300">Wind Direction: {params.windDirection}°</Label>
            <div className="flex items-center gap-4">
              <Slider
                min={0}
                max={360}
                step={90}
                value={[params.windDirection]}
                onValueChange={(val) => setParams(p => ({...p, windDirection: val[0]}))}
                className="[&_[role=slider]]:bg-amber-500 flex-1"
              />
              <div className="w-16">
                <Input
                  type="number"
                  min={0}
                  max={360}
                  value={params.windDirection}
                  onChange={(e) => setParams(p => ({...p, windDirection: Number(e.target.value)}))}
                  className="bg-zinc-800 border-zinc-700 text-zinc-100"
                />
              </div>
            </div>
          </div>

          {/* Atmospheric Density */}
          <div className="space-y-2">
            <Label className="text-zinc-300">Air Density: {params.atmosphericDensity} kg/m³</Label>
            <Slider
              min={0.1}
              max={2}
              step={0.1}
              value={[params.atmosphericDensity]}
              onValueChange={(val) => setParams(p => ({...p, atmosphericDensity: val[0]}))}
              className="[&_[role=slider]]:bg-purple-500"
            />
          </div>

          {/* Pressure */}
          <div className="space-y-2">
            <Label className="text-zinc-300">Atmospheric Pressure: {params.atmosphericPressure} atm</Label>
            <Slider
              min={0}
              max={2}
              step={0.1}
              value={[params.atmosphericPressure]}
              onValueChange={(val) => setParams(p => ({...p, atmosphericPressure: val[0]}))}
              className="[&_[role=slider]]:bg-rose-500"
            />
          </div>

          <Button 
            onClick={resetSimulation}
            variant="outline"
            className="w-full bg-zinc-900 hover:bg-zinc-700 text-zinc-100 border-zinc-700 gap-2"
          >
            <RotateCw className="w-4 h-4" />
            Reset Environment
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}