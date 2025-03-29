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
  
  // Refs
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const rendererRef = useRef(null);
  const worldRef = useRef(null);
  const boxBodyRef = useRef(null);
  const groundBodyRef = useRef(null);
  const clockRef = useRef(new THREE.Clock());
  const windForceRef = useRef(new CANNON.Vec3());

  // Physics data state
  const [physicsData, setPhysicsData] = useState({
    position: [0, 0, 0],
    velocity: [0, 0, 0],
    speed: 0,
    kineticEnergy: 0,
    angularVelocity: [0, 0, 0]
  });

  const [params, setParams] = useState({
    gravity: 9.8,
    windSpeed: 2.0,
    windDirection: 0,
    atmosphericDensity: 1.2,
    atmosphericPressure: 1.0,
    groundFriction: 0.5,
    boxFriction: 0.5
  });

  // Initialize scene
  useEffect(() => {
    // Scene setup
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xbfd1e5);
    sceneRef.current = scene;

    // Camera
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 15, 30);
    cameraRef.current = camera;

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    mountRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.screenSpacePanning = true;

    // Physics world
    const world = new CANNON.World();
    world.gravity.set(0, -params.gravity, 0);
    worldRef.current = world;

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
    directionalLight.position.set(5, 10, 5);
    scene.add(directionalLight);

    // Create plane (fixed size)
    createPlane(world, scene);
    addBox(world, scene);

    // Animation loop
    const animate = () => {
      requestAnimationFrame(animate);
      const deltaTime = clockRef.current.getDelta();

      // Apply wind force
      if (boxBodyRef.current) {
        boxBodyRef.current.applyForce(
          windForceRef.current, 
          boxBodyRef.current.position
        );
      }

      // Update physics
      world.step(deltaTime);

      // Sync Three.js with physics
      if (boxBodyRef.current && boxBodyRef.current.mesh) {
        boxBodyRef.current.mesh.position.copy(boxBodyRef.current.position);
        boxBodyRef.current.mesh.quaternion.copy(boxBodyRef.current.quaternion);

        // Update physics data
        setPhysicsData({
          position: [
            boxBodyRef.current.position.x.toFixed(2),
            boxBodyRef.current.position.y.toFixed(2),
            boxBodyRef.current.position.z.toFixed(2)
          ],
          velocity: [
            boxBodyRef.current.velocity.x.toFixed(2),
            boxBodyRef.current.velocity.y.toFixed(2),
            boxBodyRef.current.velocity.z.toFixed(2)
          ],
          speed: Math.sqrt(
            boxBodyRef.current.velocity.x ** 2 +
            boxBodyRef.current.velocity.y ** 2 +
            boxBodyRef.current.velocity.z ** 2
          ).toFixed(2),
          kineticEnergy: (0.5 * boxBodyRef.current.mass * 
            (boxBodyRef.current.velocity.x ** 2 +
             boxBodyRef.current.velocity.y ** 2 +
             boxBodyRef.current.velocity.z ** 2)).toFixed(2),
          angularVelocity: [
            boxBodyRef.current.angularVelocity.x.toFixed(2),
            boxBodyRef.current.angularVelocity.y.toFixed(2),
            boxBodyRef.current.angularVelocity.z.toFixed(2)
          ]
        });
      }

      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      renderer.dispose();
      mountRef.current?.removeChild(renderer.domElement);
    };
  }, []);

  // Update physics when parameters change
  useEffect(() => {
    if (!worldRef.current || !boxBodyRef.current) return;

    // Update gravity
    worldRef.current.gravity.set(0, -params.gravity, 0);

    // Calculate wind force (includes atmospheric density)
    const angle = THREE.MathUtils.degToRad(params.windDirection);
    const forceMagnitude = params.windSpeed * params.atmosphericDensity;
    windForceRef.current.set(
      Math.cos(angle) * forceMagnitude,
      0,
      Math.sin(angle) * forceMagnitude
    );

    // Update contact material
    updateContactMaterial();
  }, [params]);

  const createPlane = (world, scene) => {
    // Physics plane (fixed size)
    const groundMaterial = new CANNON.Material({ friction: params.groundFriction });
    const groundBody = new CANNON.Body({
      mass: 0,
      shape: new CANNON.Plane(),
      material: groundMaterial,
    });
    groundBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
    world.addBody(groundBody);

    // Visual plane (fixed size)
    const groundMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(50, 50),
      new THREE.MeshStandardMaterial({ 
        color: 0x888888,
        side: THREE.DoubleSide
      })
    );
    groundMesh.rotation.x = -Math.PI / 2;
    groundMesh.receiveShadow = true;
    scene.add(groundMesh);

    // Store references
    groundBody.mesh = groundMesh;
    groundBodyRef.current = groundBody;

    // Add grid helper
    const gridHelper = new THREE.GridHelper(50, 50, 0x555555, 0x333333);
    scene.add(gridHelper);
  };

  const addBox = (world, scene) => {
    // Physics box
    const boxMaterial = new CANNON.Material({ friction: params.boxFriction });
    const boxBody = new CANNON.Body({
      mass: 1,
      shape: new CANNON.Box(new CANNON.Vec3(1, 1, 1)),
      material: boxMaterial,
      position: new CANNON.Vec3(0, 5, 0),
    });
    world.addBody(boxBody);

    // Visual box
    const boxMesh = new THREE.Mesh(
      new THREE.BoxGeometry(2, 2, 2),
      new THREE.MeshStandardMaterial({ color: 0xff0000 })
    );
    scene.add(boxMesh);

    // Store references
    boxBody.mesh = boxMesh;
    boxBodyRef.current = boxBody;

    updateContactMaterial();
  };

  const updateContactMaterial = () => {
    if (!worldRef.current || !groundBodyRef.current || !boxBodyRef.current) return;
    
    // Clear old contact materials
    worldRef.current.contactmaterials = [];
    
    // Create new contact material
    const contactMaterial = new CANNON.ContactMaterial(
      groundBodyRef.current.material,
      boxBodyRef.current.material,
      {
        friction: (params.groundFriction + params.boxFriction) / 2,
        restitution: 0.3
      }
    );
    worldRef.current.addContactMaterial(contactMaterial);
  };

  const resetSimulation = () => {
    if (boxBodyRef.current) {
      boxBodyRef.current.position.set(0, 5, 0);
      boxBodyRef.current.velocity.set(0, 0, 0);
      boxBodyRef.current.angularVelocity.set(0, 0, 0);
    }
  };

  return (
    <div className="relative w-full h-full">
      <div ref={mountRef} className="absolute inset-0" />
      
      {/* Left Control Panel */}
      <Card className="absolute top-4 left-4 w-80 bg-zinc-900/90 backdrop-blur-sm border-zinc-800 shadow-xl">
        <CardHeader>
          <CardTitle className="text-zinc-100">Physics Controls</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Physics Controls */}
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

          <div className="space-y-2">
            <Label className="text-zinc-300">Wind Direction: {params.windDirection}°</Label>
            <div className="flex items-center gap-4">
              <Slider
                min={0}
                max={360}
                step={1}
                value={[params.windDirection]}
                onValueChange={(val) => setParams(p => ({...p, windDirection: val[0]}))}
                className="[&_[role=slider]]:bg-amber-500 flex-1"
              />
              <Input
                type="number"
                min={0}
                max={360}
                value={params.windDirection}
                onChange={(e) => setParams(p => ({...p, windDirection: Number(e.target.value)}))}
                className="w-16 bg-zinc-800 border-zinc-700 text-zinc-100"
              />
            </div>
          </div>

          {/* Atmospheric Controls */}
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

          <div className="space-y-2">
            <Label className="text-zinc-300">Air Pressure: {params.atmosphericPressure} atm</Label>
            <Slider
              min={0}
              max={2}
              step={0.1}
              value={[params.atmosphericPressure]}
              onValueChange={(val) => setParams(p => ({...p, atmosphericPressure: val[0]}))}
              className="[&_[role=slider]]:bg-rose-500"
            />
          </div>

          {/* Friction Controls */}
          <div className="space-y-2">
            <Label className="text-zinc-300">Ground Friction: {params.groundFriction}</Label>
            <Slider
              min={0}
              max={1}
              step={0.05}
              value={[params.groundFriction]}
              onValueChange={(val) => setParams(p => ({...p, groundFriction: val[0]}))}
              className="[&_[role=slider]]:bg-blue-500"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-zinc-300">Box Friction: {params.boxFriction}</Label>
            <Slider
              min={0}
              max={1}
              step={0.05}
              value={[params.boxFriction]}
              onValueChange={(val) => setParams(p => ({...p, boxFriction: val[0]}))}
              className="[&_[role=slider]]:bg-indigo-500"
            />
          </div>

          <Button 
            onClick={resetSimulation}
            variant="outline"
            className="w-full bg-zinc-900 hover:bg-zinc-700 text-zinc-100 border-zinc-700 gap-2"
          >
            <RotateCw className="w-4 h-4" />
            Reset Simulation
          </Button>
        </CardContent>
      </Card>

      {/* Right Data Panel */}
      <Card className="absolute top-4 right-4 w-80 bg-zinc-900/90 backdrop-blur-sm border-zinc-800 shadow-xl">
        <CardHeader>
          <CardTitle className="text-zinc-100">Box Physics Data</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex justify-between">
            <span className="text-zinc-300">Position (X, Y, Z):</span>
            <span className="text-zinc-100">
              [{physicsData.position.join(", ")}]
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-zinc-300">Velocity (X, Y, Z):</span>
            <span className="text-zinc-100">
              [{physicsData.velocity.join(", ")}] m/s
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-zinc-300">Speed:</span>
            <span className="text-zinc-100">{physicsData.speed} m/s</span>
          </div>
          <div className="flex justify-between">
            <span className="text-zinc-300">Kinetic Energy:</span>
            <span className="text-zinc-100">{physicsData.kineticEnergy} J</span>
          </div>
          <div className="flex justify-between">
            <span className="text-zinc-300">Angular Velocity:</span>
            <span className="text-zinc-100">
              [{physicsData.angularVelocity.join(", ")}] rad/s
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}