/**
 * Pathfinding - BFS-based pathfinding for office navigation
 * 
 * Uses Breadth-First Search to find optimal paths around
 * walls and obstacles in the office layout.
 */

import { TileMap, TileType } from './OfficeLayout';

export interface PathNode {
  x: number;
  y: number;
  parent: PathNode | null;
}

export interface PathResult {
  path: Array<{ x: number, y: number }>;
  distance: number;
  found: boolean;
}

/**
 * Pathfinder - BFS pathfinding algorithm
 */
export class Pathfinder {
  private tileMap: TileMap;
  private pathCache: Map<string, PathResult> = new Map();
  private maxDistance: number = 100;

  constructor(tileMap: TileMap) {
    this.tileMap = tileMap;
  }

  /**
   * Find path using BFS algorithm
   */
  public findPath(startX: number, startY: number, endX: number, endY: number): PathResult {
    // Check cache first
    const cacheKey = `${startX},${startY}-${endX},${endY}`;
    const cached = this.pathCache.get(cacheKey);
    if (cached) return cached;

    // BFS implementation
    const queue: PathNode[] = [];
    const visited: Set<string> = new Set();
    
    const startNode: PathNode = { x: startX, y: startY, parent: null };
    queue.push(startNode);
    visited.add(`${startX},${startY}`);

    let currentNode: PathNode | undefined;
    let found = false;

    while (queue.length > 0 && !found) {
      currentNode = queue.shift();
      if (!currentNode) break;

      if (currentNode.x === endX && currentNode.y === endY) {
        found = true;
        break;
      }

      // Check neighbors (4-directional)
      const neighbors = this.getNeighbors(currentNode.x, currentNode.y);
      for (const [nx, ny] of neighbors) {
        const key = `${nx},${ny}`;
        if (!visited.has(key)) {
          visited.add(key);
          const neighbor: PathNode = { x: nx, y: ny, parent: currentNode };
          queue.push(neighbor);
        }
      }
    }

    // Reconstruct path
    const path: Array<{ x: number, y: number }> = [];
    if (found && currentNode) {
      let node: PathNode | null = currentNode;
      while (node !== null) {
        path.unshift({ x: node.x, y: node.y });
        node = node.parent;
      }
    }

    const result: PathResult = {
      path,
      distance: path.length - 1,
      found
    };

    // Cache the result
    this.pathCache.set(cacheKey, result);

    return result;
  }

  /**
   * Get valid neighbors for a position
   */
  private getNeighbors(x: number, y: number): Array<[number, number]> {
    const neighbors: Array<[number, number]> = [];
    const directions = [
      [0, -1], // North
      [1, 0],  // East
      [0, 1],  // South
      [-1, 0]  // West
    ];

    for (const [dx, dy] of directions) {
      const nx = x + dx;
      const ny = y + dy;

      if (this.isWalkable(nx, ny)) {
        neighbors.push([nx, ny]);
      }
    }

    return neighbors;
  }

  /**
   * Check if a tile is walkable
   */
  private isWalkable(x: number, y: number): boolean {
    if (!this.tileMap.isInBounds(x, y)) return false;

    const tile = this.tileMap.getTile(x, y);
    if (!tile) return false;

    return tile.type === TileType.Floor || 
           tile.type === TileType.Empty ||
           tile.type === TileType.Desk ||
           tile.type === TileType.Chair;
  }

  /**
   * Get straight-line distance
   */
  public getDistance(x1: number, y1: number, x2: number, y2: number): number {
    return Math.hypot(x2 - x1, y2 - y1);
  }

  /**
   * Get Manhattan distance
   */
  public getManhattanDistance(x1: number, y1: number, x2: number, y2: number): number {
    return Math.abs(x2 - x1) + Math.abs(y2 - y1);
  }

  /**
   * Clear path cache
   */
  public clearCache(): void {
    this.pathCache.clear();
  }

  /**
   * Get cache size
   */
  public getCacheSize(): number {
    return this.pathCache.size;
  }

  /**
   * Check if path is valid (continuous and non-blocking)
   */
  public isPathValid(path: Array<{ x: number, y: number }>): boolean {
    if (path.length < 2) return false;

    for (let i = 0; i < path.length - 1; i++) {
      const current = path[i];
      const next = path[i + 1];

      // Check if adjacent
      const distance = this.getManhattanDistance(current.x, current.y, next.x, next.y);
      if (distance !== 1) return false;

      // Check if walkable
      if (!this.isWalkable(next.x, next.y)) return false;
    }

    return true;
  }

  /**
   * Smooth path (reduce waypoints)
   */
  public smoothPath(path: Array<{ x: number, y: number }>): Array<{ x: number, y: number }> {
    if (path.length <= 2) return path;

    const smoothed: Array<{ x: number, y: number }> = [path[0]];

    for (let i = 1; i < path.length - 1; i++) {
      const prev = path[i - 1];
      const current = path[i];
      const next = path[i + 1];

      // Check if current point is necessary (not collinear)
      const dx1 = current.x - prev.x;
      const dy1 = current.y - prev.y;
      const dx2 = next.x - current.x;
      const dy2 = next.y - current.y;

      // If directions are different, keep point
      if (dx1 !== dx2 || dy1 !== dy2) {
        smoothed.push(current);
      }
    }

    smoothed.push(path[path.length - 1]);
    return smoothed;
  }

  /**
   * Get nearest walkable tile
   */
  public getNearestWalkableTile(x: number, y: number, maxRadius: number = 5): { x: number, y: number } | null {
    const checked: Set<string> = new Set();
    const queue: Array<{ x: number, y: number, distance: number }> = [{ x, y, distance: 0 }];

    while (queue.length > 0) {
      const current = queue.shift();
      if (!current) break;

      const key = `${current.x},${current.y}`;
      if (checked.has(key)) continue;
      checked.add(key);

      if (this.isWalkable(current.x, current.y)) {
        return { x: current.x, y: current.y };
      }

      if (current.distance < maxRadius) {
        const neighbors = [
          [current.x, current.y - 1],
          [current.x + 1, current.y],
          [current.x, current.y + 1],
          [current.x - 1, current.y]
        ];

        for (const [nx, ny] of neighbors) {
          if (this.tileMap.isInBounds(nx, ny) && !checked.has(`${nx},${ny}`)) {
            queue.push({ x: nx, y: ny, distance: current.distance + 1 });
          }
        }
      }
    }

    return null;
  }

  /**
   * Get all adjacent tiles
   */
  public getAdjacentWalkableTiles(x: number, y: number): Array<{ x: number, y: number }> {
    const tiles: Array<{ x: number, y: number }> = [];
    const directions = [
      [0, -1], [1, 0], [0, 1], [-1, 0]
    ];

    for (const [dx, dy] of directions) {
      const nx = x + dx;
      const ny = y + dy;
      if (this.isWalkable(nx, ny)) {
        tiles.push({ x: nx, y: ny });
      }
    }

    return tiles;
  }
}
