/**
 * PixelOfficeCanvas - Main canvas component for pixel art office visualization
 * 
 * Renders office layout with animated agent characters,
 * handles mouse events, and manages real-time WebSocket updates.
 */

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { PixelRenderer } from '../engines/PixelRenderer';
import { OfficeLayout } from '../engines/OfficeLayout';
import { Character, CharacterState, CharacterConfig, CharacterAnimationConfig } from '../engines/CharacterStateMachine';
import { Pathfinder } from '../engines/Pathfinding';

export interface Agent {
  id: string;
  name: string;
  state: string;
  color: string;
  x?: number;
  y?: number;
}

interface PixelOfficeCanvasProps {
  agents: Agent[];
  onAgentSelect: (agentId: string) => void;
  onAgentMove: (agentId: string, x: number, y: number) => void;
}

export const PixelOfficeCanvas: React.FC<PixelOfficeCanvasProps> = ({
  agents,
  onAgentSelect,
  onAgentMove
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [renderer, setRenderer] = useState<PixelRenderer | null>(null);
  const [layout, setLayout] = useState<OfficeLayout | null>(null);
  const [pathfinder, setPathfinder] = useState<Pathfinder | null>(null);
  const [characters, setCharacters] = useState<Map<string, Character>>(new Map());
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const [hoveredAgent, setHoveredAgent] = useState<string | null>(null);
  const [isMouseDown, setIsMouseDown] = useState(false);
  const [draggedAgent, setDraggedAgent] = useState<string | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const lastUpdateRef = useRef<number>(Date.now());

  // Initialize Canvas and Renderer
  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    canvas.width = 800;
    canvas.height = 600;

    const pixelRenderer = new PixelRenderer(canvas, 2);
    const officeLayout = new OfficeLayout({ width: 400, height: 300, defaultColor: '#cccccc' });
    const tileMap = officeLayout.getTileMap();
    const pathfinder = new Pathfinder(tileMap);

    setRenderer(pixelRenderer);
    setLayout(officeLayout);
    setPathfinder(pathfinder);

    // Create default animation configs
    const animationConfigs: Map<CharacterState, CharacterAnimationConfig> = new Map([
      [CharacterState.Idle, { frames: [0, 1], frameDuration: 500, loop: true }],
      [CharacterState.Walking, { frames: [0, 1, 2, 3], frameDuration: 100, loop: true }],
      [CharacterState.Typing, { frames: [0, 1, 0, 1], frameDuration: 200, loop: true }],
      [CharacterState.Reading, { frames: [0, 1], frameDuration: 300, loop: true }],
      [CharacterState.Processing, { frames: [0, 1, 2], frameDuration: 250, loop: true }],
      [CharacterState.Publishing, { frames: [0, 1, 2, 1, 0], frameDuration: 150, loop: true }],
      [CharacterState.Error, { frames: [0, 1, 0, 1], frameDuration: 150, loop: true }],
      [CharacterState.Waiting, { frames: [0], frameDuration: 500, loop: false }]
    ]);

    // Create characters for agents
    const agentDesk: Record<string, [number, number]> = {
      'source-collector': [2, 2],
      'reporter': [8, 2],
      'writer': [14, 2],
      'fact-checker': [2, 8],
      'editor-desk': [8, 8],
      'copy-editor': [8, 14],
      'publisher': [14, 8]
    };

    const newCharacters = new Map<string, Character>();
    agents.forEach((agent, index) => {
      const [x, y] = agentDesk[agent.id] || [index * 6, index * 6];
      
      const config: CharacterConfig = {
        id: agent.id,
        name: agent.name,
        x,
        y,
        spriteKey: `agent-${agent.id}`,
        color: agent.color,
        animations: animationConfigs
      };

      const character = new Character(config);
      newCharacters.set(agent.id, character);
      officeLayout.addCharacter(agent.id, x, y);
    });

    setCharacters(newCharacters);
  }, [agents]);

  // Mouse event handlers
  const handleCanvasClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!renderer || !canvasRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const canvasX = e.clientX - rect.left;
    const canvasY = e.clientY - rect.top;
    const { x: pixelX, y: pixelY } = renderer.canvasToPixel(canvasX, canvasY);

    // Find clicked agent
    for (const [agentId, character] of characters) {
      const [charX, charY] = character.getPosition();
      const distance = Math.hypot(pixelX - charX, pixelY - charY);
      
      if (distance < 2) {
        setSelectedAgent(agentId);
        onAgentSelect(agentId);
        return;
      }
    }

    setSelectedAgent(null);
  }, [renderer, characters, onAgentSelect]);

  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!renderer || !canvasRef.current) return;

    setIsMouseDown(true);

    const rect = canvasRef.current.getBoundingClientRect();
    const canvasX = e.clientX - rect.left;
    const canvasY = e.clientY - rect.top;
    const { x: pixelX, y: pixelY } = renderer.canvasToPixel(canvasX, canvasY);

    // Find agent at mouse position
    for (const [agentId, character] of characters) {
      const [charX, charY] = character.getPosition();
      const distance = Math.hypot(pixelX - charX, pixelY - charY);
      
      if (distance < 2) {
        setDraggedAgent(agentId);
        break;
      }
    }
  }, [renderer, characters]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!renderer || !canvasRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const canvasX = e.clientX - rect.left;
    const canvasY = e.clientY - rect.top;
    const { x: pixelX, y: pixelY } = renderer.canvasToPixel(canvasX, canvasY);

    // Update hovered agent
    let found = false;
    for (const [agentId, character] of characters) {
      const [charX, charY] = character.getPosition();
      const distance = Math.hypot(pixelX - charX, pixelY - charY);
      
      if (distance < 2) {
        setHoveredAgent(agentId);
        found = true;
        break;
      }
    }
    if (!found) setHoveredAgent(null);

    // Handle dragging
    if (isMouseDown && draggedAgent && layout && pathfinder) {
      const character = characters.get(draggedAgent);
      if (character) {
        // Find path and move character
        const [currentX, currentY] = character.getPosition();
        const path = pathfinder.findPath(
          Math.floor(currentX),
          Math.floor(currentY),
          Math.floor(pixelX),
          Math.floor(pixelY)
        );

        if (path.found && path.path.length > 1) {
          const nextPos = path.path[1];
          character.setPosition(nextPos.x, nextPos.y);
          layout.moveCharacter(draggedAgent, nextPos.x, nextPos.y);
          onAgentMove(draggedAgent, nextPos.x, nextPos.y);
        }
      }
    }
  }, [renderer, characters, isMouseDown, draggedAgent, layout, pathfinder, onAgentMove]);

  const handleMouseUp = useCallback(() => {
    setIsMouseDown(false);
    setDraggedAgent(null);
  }, []);

  const handleContextMenu = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    if (!selectedAgent) return;

    // Trigger context menu (would normally show menu)
    console.log('Context menu for agent:', selectedAgent);
  }, [selectedAgent]);

  // Animation loop
  useEffect(() => {
    const animate = () => {
      if (!renderer || !layout || !canvasRef.current) {
        animationFrameRef.current = requestAnimationFrame(animate);
        return;
      }

      const now = Date.now();
      const deltaTime = now - lastUpdateRef.current;
      lastUpdateRef.current = now;

      // Update character states
      characters.forEach((character, agentId) => {
        const agent = agents.find(a => a.id === agentId);
        if (agent) {
          const state = agent.state as CharacterState;
          if (character.getState() !== state) {
            character.setState(state);
          }
        }
        character.update(deltaTime);
      });

      // Clear canvas
      renderer.clear();

      // Render layout
      layout.render(renderer);

      // Render characters
      characters.forEach((character, agentId) => {
        const [x, y] = character.getPosition();
        const isSelected = agentId === selectedAgent;
        const isHovered = agentId === hoveredAgent;

        // Draw character
        renderer.drawRect(x, y, 1, 1, character.getColor());

        // Draw selection outline
        if (isSelected) {
          renderer.drawRect(x - 1, y - 1, 3, 3, '#ffff00');
        }

        // Draw hover outline
        if (isHovered) {
          renderer.drawRect(x - 0.5, y - 0.5, 2, 2, '#ff00ff');
        }

        // Draw agent name
        renderer.drawText(character.getName().substring(0, 3), x - 1, y - 2, '#000000', 8);
      });

      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animationFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [renderer, layout, characters, agents, selectedAgent, hoveredAgent]);

  // Resize handler
  useEffect(() => {
    const handleResize = () => {
      if (!renderer || !canvasRef.current) return;

      const container = canvasRef.current.parentElement;
      if (container) {
        const width = container.clientWidth;
        const height = container.clientHeight;
        renderer.resize(width, height);
      }
    };

    const resizeObserver = new ResizeObserver(handleResize);
    if (canvasRef.current?.parentElement) {
      resizeObserver.observe(canvasRef.current.parentElement);
    }

    return () => resizeObserver.disconnect();
  }, [renderer]);

  return (
    <div style={{ width: '100%', height: '100%', overflow: 'hidden' }}>
      <canvas
        ref={canvasRef}
        onClick={handleCanvasClick}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onContextMenu={handleContextMenu}
        style={{
          border: '2px solid #333',
          cursor: draggedAgent ? 'grabbing' : hoveredAgent ? 'pointer' : 'default',
          display: 'block'
        }}
      />
    </div>
  );
};

export default PixelOfficeCanvas;
