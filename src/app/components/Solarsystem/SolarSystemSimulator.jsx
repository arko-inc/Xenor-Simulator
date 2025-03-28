'use client'
import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, useMotionValue } from 'framer-motion';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";

const SolarSystem = () => {
  // Constants (scaled for visualization)
  const AU = 100; // Astronomical Unit in pixels
  const SCALE_FACTOR = 0.5; // Scale factor for planet sizes
  const MIN_ZOOM = 0.1;
  const MAX_ZOOM = 5;
  
  // Orbital data (semi-major axis in AU, orbital period in days)
  const celestialData = {
    sun: { radius: 696340 / 10000 * SCALE_FACTOR, color: '#FDB813', orbitalRadius: 0, orbitalPeriod: 0 },
    mercury: { radius: 2439.7 / 1000 * SCALE_FACTOR, color: '#B7B8B9', orbitalRadius: 0.387 * AU, orbitalPeriod: 88 },
    venus: { radius: 6051.8 / 1000 * SCALE_FACTOR, color: '#E6E6FA', orbitalRadius: 0.723 * AU, orbitalPeriod: 224.7 },
    earth: { radius: 6371 / 1000 * SCALE_FACTOR, color: '#6B93D6', orbitalRadius: 1 * AU, orbitalPeriod: 365.25 },
    moon: { radius: 1737.4 / 1000 * SCALE_FACTOR, color: '#D0D0D0', orbitalRadius: 0.00257 * AU, orbitalPeriod: 27.3, parent: 'earth' },
    mars: { radius: 3389.5 / 1000 * SCALE_FACTOR, color: '#C1440E', orbitalRadius: 1.524 * AU, orbitalPeriod: 687 },
    phobos: { radius: 11.1 / 10 * SCALE_FACTOR, color: '#A69F94', orbitalRadius: 0.000062 * AU, orbitalPeriod: 0.3189, parent: 'mars' },
    deimos: { radius: 6.2 / 10 * SCALE_FACTOR, color: '#8E8C84', orbitalRadius: 0.000157 * AU, orbitalPeriod: 1.2624, parent: 'mars' },
    jupiter: { radius: 69911 / 1000 * SCALE_FACTOR, color: '#D39C7E', orbitalRadius: 5.204 * AU, orbitalPeriod: 4333 },
    saturn: { radius: 58232 / 1000 * SCALE_FACTOR, color: '#E6D9A5', orbitalRadius: 9.582 * AU, orbitalPeriod: 10759 },
    uranus: { radius: 25362 / 1000 * SCALE_FACTOR, color: '#C1E3E3', orbitalRadius: 19.189 * AU, orbitalPeriod: 30687 },
    neptune: { radius: 24622 / 1000 * SCALE_FACTOR, color: '#5B5DDF', orbitalRadius: 30.07 * AU, orbitalPeriod: 60190 },
    pluto: { radius: 1188.3 / 1000 * SCALE_FACTOR, color: '#D6CFC1', orbitalRadius: 39.482 * AU, orbitalPeriod: 90560 }
  };

  // State
  const [speed, setSpeed] = useState(0.5);
  const [paused, setPaused] = useState(false);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [dateInput, setDateInput] = useState(new Date().toISOString().slice(0, 10));
  const [showOrbits, setShowOrbits] = useState(true);
  const [showLabels, setShowLabels] = useState(true);
  const [timeElapsed, setTimeElapsed] = useState(0);
  
  // View controls
  const scale = useMotionValue(1);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const containerRef = useRef(null);
  const requestRef = useRef();
  const previousTimeRef = useRef();
  const isDragging = useRef(false);
  const startPos = useRef({ x: 0, y: 0 });

  // Handle wheel event for zooming (with mouse position as origin)
  const handleWheel = useCallback((e) => {
    e.preventDefault();
    const container = containerRef.current;
    if (!container) return;

    // Get mouse position relative to container
    const rect = container.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // Calculate current transform origin in world space
    const worldX = (mouseX - x.get()) / scale.get();
    const worldY = (mouseY - y.get()) / scale.get();

    // Calculate new scale
    const delta = -e.deltaY;
    const zoomFactor = 0.001;
    const newScale = Math.min(Math.max(MIN_ZOOM, scale.get() * (1 + delta * zoomFactor)), MAX_ZOOM);

    // Calculate new position to zoom toward mouse
    const newX = mouseX - worldX * newScale;
    const newY = mouseY - worldY * newScale;

    // Apply new transform
    scale.set(newScale);
    x.set(newX);
    y.set(newY);
  }, [scale, x, y]);

  // Handle mouse down for panning
  const handleMouseDown = useCallback((e) => {
    if (e.button === 1) { // Middle mouse button
      e.preventDefault();
      isDragging.current = true;
      startPos.current = { x: e.clientX - x.get(), y: e.clientY - y.get() };
      document.body.style.cursor = 'grabbing';
    }
  }, [x, y]);

  // Handle mouse move for panning
  const handleMouseMove = useCallback((e) => {
    if (isDragging.current) {
      x.set(e.clientX - startPos.current.x);
      y.set(e.clientY - startPos.current.y);
    }
  }, [x, y]);

  // Handle mouse up for panning
  const handleMouseUp = useCallback(() => {
    if (isDragging.current) {
      isDragging.current = false;
      document.body.style.cursor = '';
    }
  }, []);

  // Calculate planet positions based on time (fixed calculation)
  const calculatePositions = (date) => {
    const positions = {};
    const startOfYear = new Date(date.getFullYear(), 0, 0);
    const timeInDays = (date.getTime() - startOfYear.getTime()) / (1000 * 60 * 60 * 24);
    
    // First calculate parent positions
    for (const [name, data] of Object.entries(celestialData)) {
      if (data.orbitalPeriod === 0 || data.parent) continue;
      
      const angle = (2 * Math.PI * timeInDays / data.orbitalPeriod) % (2 * Math.PI);
      positions[name] = {
        x: Math.cos(angle) * data.orbitalRadius,
        y: Math.sin(angle) * data.orbitalRadius
      };
    }
    
    // Then calculate moons
    for (const [name, data] of Object.entries(celestialData)) {
      if (!data.parent || !positions[data.parent]) continue;
      
      const angle = (2 * Math.PI * timeInDays / data.orbitalPeriod) % (2 * Math.PI);
      positions[name] = {
        x: Math.cos(angle) * data.orbitalRadius + positions[data.parent].x,
        y: Math.sin(angle) * data.orbitalRadius + positions[data.parent].y
      };
    }
    
    return positions;
  };

  // Animation loop
  const animate = (time) => {
    if (previousTimeRef.current === undefined) {
      previousTimeRef.current = time;
    }
    
    const deltaTime = time - previousTimeRef.current;
    previousTimeRef.current = time;
    
    if (!paused) {
      const newTimeElapsed = timeElapsed + (deltaTime * speed) / 1000;
      setTimeElapsed(newTimeElapsed);
      
      // Update date continuously
      const newDate = new Date(currentDate.getTime() + deltaTime * speed * 1000);
      setCurrentDate(newDate);
      setDateInput(newDate.toISOString().slice(0, 10));
    }
    
    requestRef.current = requestAnimationFrame(animate);
  };

  // Initialize animation and event listeners
  useEffect(() => {
    requestRef.current = requestAnimationFrame(animate);
    
    const container = containerRef.current;
    if (container) {
      container.addEventListener('wheel', handleWheel, { passive: false });
      container.addEventListener('mousedown', handleMouseDown);
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    
    return () => {
      cancelAnimationFrame(requestRef.current);
      if (container) {
        container.removeEventListener('wheel', handleWheel);
        container.removeEventListener('mousedown', handleMouseDown);
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      }
    };
  }, [paused, speed, timeElapsed, handleWheel, handleMouseDown, handleMouseMove, handleMouseUp]);

  // Handle date input change
  const handleDateChange = (e) => {
    const newDateStr = e.target.value;
    setDateInput(newDateStr);
    
    const newDate = new Date(newDateStr);
    if (!isNaN(newDate.getTime())) {
      setCurrentDate(newDate);
      setTimeElapsed(0);
    }
  };

  // Handle speed change
  const handleSpeedChange = (value) => {
    setSpeed(value[0]);
  };

  // Reset view
  const handleResetView = () => {
    scale.set(1);
    x.set(window.innerWidth / 2);
    y.set(window.innerHeight / 2);
  };

  // Calculate current positions
  const positions = calculatePositions(currentDate);

  return (
    <div 
      ref={containerRef}
      className="relative w-full h-screen bg-black overflow-hidden cursor-grab"
      style={{ touchAction: 'none' }}
    >
      {/* Control Panel */}
      <Card className="absolute top-4 left-4 z-10 bg-gray-900/80 p-4 w-80">
        <div className="flex flex-col space-y-4">
          <div className="flex items-center justify-between space-x-2">
            <Button 
              onClick={() => setPaused(!paused)}
              className="flex-1"
            >
              {paused ? 'Play' : 'Pause'}
            </Button>
            <Button 
              onClick={handleResetView}
              variant="outline"
              className="flex-1"
            >
              Reset View
            </Button>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="speed-slider">Speed: {speed.toFixed(2)}x</Label>
            <Slider
              id="speed-slider"
              min={0.1}
              max={20000}
              step={0.1}
              value={[speed]}
              onValueChange={handleSpeedChange}
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="date-input">Date</Label>
            <Input
              id="date-input"
              type="date"
              value={dateInput}
              onChange={handleDateChange}
            />
          </div>
          
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="show-orbits"
                checked={showOrbits}
                onCheckedChange={() => setShowOrbits(!showOrbits)}
              />
              <Label htmlFor="show-orbits">Show Orbits</Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="show-labels"
                checked={showLabels}
                onCheckedChange={() => setShowLabels(!showLabels)}
              />
              <Label htmlFor="show-labels">Show Labels</Label>
            </div>
          </div>
        </div>
      </Card>
      
      {/* Date Display */}
      <Card className="absolute top-4 right-4 z-10 bg-gray-900/80 p-3">
        <div className="text-sm font-mono">
          {currentDate.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            weekday: 'short'
          })}
          <span className="mx-2">|</span>
          {currentDate.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
          })}
        </div>
      </Card>
      
      {/* Solar System */}
      <motion.div 
        className="absolute inset-0 origin-center"
        style={{
          scale,
          x,
          y,
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
        {/* Sun */}
        <div
          className="absolute rounded-full bg-yellow-500 shadow-lg shadow-yellow-500/50"
          style={{
            width: celestialData.sun.radius * 2,
            height: celestialData.sun.radius * 2,
            backgroundColor: celestialData.sun.color,
            left: '50%',
            top: '50%',
            transform: `translate(-50%, -50%) translate(${positions.sun?.x || 0}px, ${positions.sun?.y || 0}px)`,
            zIndex: 10
          }}
        >
          {showLabels && (
            <div className="absolute top-full left-1/2 transform -translate-x-1/2 mt-2 text-white text-sm font-medium">
              Sun
            </div>
          )}
        </div>
        
        {/* Planets */}
        {Object.entries(celestialData).map(([name, data]) => {
          if (name === 'sun') return null;
          
          return (
            <div key={name}>
              {/* Orbit path */}
              {showOrbits && data.orbitalRadius > 0 && (
                <div
                  className="absolute border border-gray-600 rounded-full"
                  style={{
                    width: data.orbitalRadius * 2,
                    height: data.orbitalRadius * 2,
                    left: '50%',
                    top: '50%',
                    transform: `translate(-50%, -50%) ${
                      data.parent 
                        ? `translate(${positions[data.parent].x}px, ${positions[data.parent].y}px)`
                        : ''
                    }`,
                    zIndex: 1
                  }}
                />
              )}
              
              {/* Planet */}
              <div
                className={`absolute rounded-full shadow-md ${name === 'earth' ? 'bg-blue-500' : ''}`}
                style={{
                  width: data.radius * 2,
                  height: data.radius * 2,
                  backgroundColor: data.color,
                  left: '50%',
                  top: '50%',
                  transform: `translate(-50%, -50%) translate(${positions[name].x}px, ${positions[name].y}px)`,
                  zIndex: name === 'moon' || name === 'phobos' || name === 'deimos' ? 5 : 
                         name === 'jupiter' || name === 'saturn' ? 9 : 8
                }}
              >
                {showLabels && (
                  <div className="absolute top-full left-1/2 transform -translate-x-1/2 mt-1 text-white text-xs font-medium">
                    {name.charAt(0).toUpperCase() + name.slice(1)}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </motion.div>
      
      {/* Help Tooltip */}
      <Card className="absolute bottom-4 left-4 z-10 bg-gray-900/80 p-2 text-sm">
        <div className="flex items-center space-x-2">
          <span className="text-gray-400">Scroll to zoom</span>
          <span className="text-gray-400">•</span>
          <span className="text-gray-400">Middle mouse to pan</span>
        </div>
      </Card>
    </div>
  );
};

export default SolarSystem;