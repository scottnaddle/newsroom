/**
 * OfficeLayout - Tile-Based Office Layout System
 * 
 * Manages office grid layout with support for different tile types,
 * auto-tiling for walls, and JSON serialization.
 */

import { PixelRenderer } from './PixelRenderer';

export enum TileType {
  Empty = 'empty',
  Floor = 'floor',
  Wall = 'wall',
  Desk = 'desk',
  Chair = 'chair',
  Computer = 'computer',
  Door = 'door',
  Decoration = 'decoration'
}

export interface Tile {
  type: TileType;
  color: string;
  walkable: boolean;
}

export interface TilePosition {
  x: number;
  y: number;
}

export interface LayoutConfig {
  width: number;
  height: number;
  defaultColor: string;
}

/**
 * TileMap - Grid-based tile storage
 */
export class TileMap {
  private width: number;
  private height: number;
  private tiles: Map<string, Tile>;
  private defaultColor: string = '#cccccc';

  constructor(width: number, height: number, defaultColor?: string) {
    this.width = width;
    this.height = height;
    if (defaultColor) this.defaultColor = defaultColor;
    this.tiles = new Map();

    // Initialize empty floor
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        this.setTile(x, y, TileType.Floor, this.defaultColor);
      }
    }
  }

  /**
   * Set a tile at position
   */
  public setTile(x: number, y: number, type: TileType, color: string = this.defaultColor): void {
    if (!this.isInBounds(x, y)) return;

    const key = `${x},${y}`;
    const walkable = this.isWalkable(type);

    this.tiles.set(key, { type, color, walkable });
  }

  /**
   * Get a tile at position
   */
  public getTile(x: number, y: number): Tile | undefined {
    if (!this.isInBounds(x, y)) return undefined;
    return this.tiles.get(`${x},${y}`);
  }

  /**
   * Get all tiles
   */
  public getAllTiles(): Map<string, Tile> {
    return this.tiles;
  }

  /**
   * Check if position is walkable
   */
  public isWalkable(type: TileType): boolean {
    return type === TileType.Floor || type === TileType.Empty;
  }

  /**
   * Check if a position is in bounds
   */
  public isInBounds(x: number, y: number): boolean {
    return x >= 0 && x < this.width && y >= 0 && y < this.height;
  }

  /**
   * Get width
   */
  public getWidth(): number {
    return this.width;
  }

  /**
   * Get height
   */
  public getHeight(): number {
    return this.height;
  }

  /**
   * Clear all tiles
   */
  public clear(): void {
    this.tiles.clear();
  }

  /**
   * Expand grid
   */
  public expandGrid(newWidth: number, newHeight: number): void {
    if (newWidth <= this.width && newHeight <= this.height) return;

    const oldTiles = new Map(this.tiles);
    this.tiles.clear();
    this.width = newWidth;
    this.height = newHeight;

    // Initialize new grid
    for (let y = 0; y < newHeight; y++) {
      for (let x = 0; x < newWidth; x++) {
        const key = `${x},${y}`;
        if (oldTiles.has(key)) {
          const tile = oldTiles.get(key);
          if (tile) this.tiles.set(key, tile);
        } else {
          this.setTile(x, y, TileType.Floor, this.defaultColor);
        }
      }
    }
  }
}

/**
 * OfficeLayout - Main layout manager
 */
export class OfficeLayout {
  private tileMap: TileMap;
  private characterPositions: Map<string, TilePosition> = new Map();
  private desks: Map<string, TilePosition> = new Map();

  constructor(config: LayoutConfig) {
    this.tileMap = new TileMap(config.width, config.height, config.defaultColor);
    this.initializeDefaultLayout();
  }

  /**
   * Initialize default newsroom layout
   */
  private initializeDefaultLayout(): void {
    const w = this.tileMap.getWidth();
    const h = this.tileMap.getHeight();

    // Create default desks and rooms
    this.createDesk('entrance', 2, 2);
    this.createDesk('research', 8, 2);
    this.createDesk('main', 14, 2);
    this.createDesk('verification', 2, 8);
    this.createDesk('editor', 8, 8);
    this.createDesk('publishing', 14, 8);
    this.createDesk('proofreading', 8, 14);

    // Create walls (simple grid pattern)
    for (let x = 0; x < w; x++) {
      for (let y = 0; y < h; y++) {
        // Vertical lines every 6 tiles
        if (x % 7 === 6 && y > 1 && y < h - 2) {
          this.tileMap.setTile(x, y, TileType.Wall, '#666666');
        }
        // Horizontal lines every 6 tiles
        if (y % 6 === 5 && x > 1 && x < w - 2) {
          this.tileMap.setTile(x, y, TileType.Wall, '#666666');
        }
      }
    }
  }

  /**
   * Create a desk at position
   */
  public createDesk(name: string, x: number, y: number): void {
    if (!this.tileMap.isInBounds(x, y)) return;

    this.tileMap.setTile(x, y, TileType.Desk, '#8B4513');
    this.tileMap.setTile(x + 1, y, TileType.Chair, '#A0522D');
    this.desks.set(name, { x, y });
  }

  /**
   * Get desk position
   */
  public getDesk(name: string): TilePosition | undefined {
    return this.desks.get(name);
  }

  /**
   * Add character to layout
   */
  public addCharacter(characterId: string, x: number, y: number): void {
    if (this.tileMap.isInBounds(x, y)) {
      this.characterPositions.set(characterId, { x, y });
    }
  }

  /**
   * Remove character from layout
   */
  public removeCharacter(characterId: string): void {
    this.characterPositions.delete(characterId);
  }

  /**
   * Move character
   */
  public moveCharacter(characterId: string, x: number, y: number): void {
    if (this.tileMap.isInBounds(x, y)) {
      const tile = this.tileMap.getTile(x, y);
      if (tile && tile.walkable) {
        this.characterPositions.set(characterId, { x, y });
      }
    }
  }

  /**
   * Get character position
   */
  public getCharacterPosition(characterId: string): TilePosition | undefined {
    return this.characterPositions.get(characterId);
  }

  /**
   * Get all character positions
   */
  public getCharacterPositions(): Map<string, TilePosition> {
    return this.characterPositions;
  }

  /**
   * Render layout
   */
  public render(renderer: PixelRenderer): void {
    const width = this.tileMap.getWidth();
    const height = this.tileMap.getHeight();

    // Draw tiles
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const tile = this.tileMap.getTile(x, y);
        if (tile) {
          renderer.drawRect(x, y, 1, 1, tile.color);

          // Draw borders for walls
          if (tile.type === TileType.Wall) {
            const ctx = (renderer as any).ctx; // Access for debugging
            // This would normally draw wall patterns
          }
        }
      }
    }

    // Draw desks labels
    const deskLabels = [
      ['entrance', '📰'],
      ['research', '🔍'],
      ['main', '✍️'],
      ['verification', '✓'],
      ['editor', '📝'],
      ['publishing', '📢'],
      ['proofreading', '🔤']
    ];

    for (const [deskName, icon] of deskLabels) {
      const desk = this.desks.get(deskName);
      if (desk) {
        renderer.drawText(icon, desk.x, desk.y - 1, '#000000', 10);
      }
    }
  }

  /**
   * Get tile map
   */
  public getTileMap(): TileMap {
    return this.tileMap;
  }

  /**
   * Save layout to JSON
   */
  public toJSON(): string {
    const data = {
      width: this.tileMap.getWidth(),
      height: this.tileMap.getHeight(),
      tiles: Array.from(this.tileMap.getAllTiles().entries()).map(([key, tile]) => ({
        key,
        ...tile
      })),
      desks: Array.from(this.desks.entries()).map(([name, pos]) => ({
        name,
        ...pos
      }))
    };
    return JSON.stringify(data, null, 2);
  }

  /**
   * Load layout from JSON
   */
  public static fromJSON(json: string): OfficeLayout {
    const data = JSON.parse(json);
    const layout = new OfficeLayout({
      width: data.width,
      height: data.height,
      defaultColor: '#cccccc'
    });

    // Load tiles
    layout.tileMap.clear();
    for (const tileData of data.tiles) {
      const [x, y] = tileData.key.split(',').map(Number);
      layout.tileMap.setTile(x, y, tileData.type, tileData.color);
    }

    // Load desks
    layout.desks.clear();
    for (const desk of data.desks) {
      layout.desks.set(desk.name, { x: desk.x, y: desk.y });
    }

    return layout;
  }
}
