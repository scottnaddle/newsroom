/**
 * PixelRenderer - 16x16 Pixel-Perfect Canvas Renderer
 * 
 * Handles sprite rendering with integer zoom levels,
 * dirty rectangle optimization, and frame-based animation.
 */

export interface Sprite {
  spriteSheet: HTMLImageElement;
  frameWidth: number;
  frameHeight: number;
}

export interface AnimationFrame {
  frameX: number;
  frameY: number;
  duration: number;
}

export class PixelRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private zoomLevel: number = 2;
  private spriteCache: Map<string, Sprite> = new Map();
  private dirtyRects: Set<string> = new Set();
  private frameCount: number = 0;
  private lastFrameTime: number = 0;
  private fps: number = 60;
  private pixelSize: number = 16;

  constructor(canvas: HTMLCanvasElement, zoomLevel: number = 2) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Failed to get 2D context');
    this.ctx = ctx;
    this.zoomLevel = zoomLevel;
    
    // Disable image smoothing for pixel-perfect rendering
    this.ctx.imageSmoothingEnabled = false;
  }

  /**
   * Register a sprite sheet for later use
   */
  public registerSprite(key: string, spriteSheet: HTMLImageElement, frameWidth: number, frameHeight: number): void {
    this.spriteCache.set(key, { spriteSheet, frameWidth, frameHeight });
  }

  /**
   * Draw a sprite from a registered sprite sheet
   * @param spriteKey - Key of registered sprite
   * @param x - X position in pixels (not scaled)
   * @param y - Y position in pixels (not scaled)
   * @param frameX - Frame column index
   * @param frameY - Frame row index
   */
  public drawSprite(spriteKey: string, x: number, y: number, frameX: number, frameY: number): void {
    const sprite = this.spriteCache.get(spriteKey);
    if (!sprite) {
      console.warn(`Sprite '${spriteKey}' not found`);
      return;
    }

    const sourceX = frameX * sprite.frameWidth;
    const sourceY = frameY * sprite.frameHeight;
    const destX = x * this.zoomLevel;
    const destY = y * this.zoomLevel;
    const destWidth = sprite.frameWidth * this.zoomLevel;
    const destHeight = sprite.frameHeight * this.zoomLevel;

    this.ctx.drawImage(
      sprite.spriteSheet,
      sourceX, sourceY, sprite.frameWidth, sprite.frameHeight,
      destX, destY, destWidth, destHeight
    );

    // Mark dirty rect
    this.markDirtyRect(x, y, sprite.frameWidth, sprite.frameHeight);
  }

  /**
   * Draw a filled rectangle
   */
  public drawRect(x: number, y: number, width: number, height: number, color: string): void {
    this.ctx.fillStyle = color;
    this.ctx.fillRect(x * this.zoomLevel, y * this.zoomLevel, width * this.zoomLevel, height * this.zoomLevel);
    this.markDirtyRect(x, y, width, height);
  }

  /**
   * Draw text
   */
  public drawText(text: string, x: number, y: number, color: string = '#000000', size: number = 12): void {
    this.ctx.fillStyle = color;
    this.ctx.font = `${size}px Arial`;
    this.ctx.fillText(text, x * this.zoomLevel, y * this.zoomLevel);
  }

  /**
   * Clear the entire canvas
   */
  public clear(): void {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  /**
   * Clear a specific region
   */
  public clearRect(x: number, y: number, width: number, height: number): void {
    this.ctx.clearRect(x * this.zoomLevel, y * this.zoomLevel, width * this.zoomLevel, height * this.zoomLevel);
  }

  /**
   * Mark a rectangular region as dirty
   */
  private markDirtyRect(x: number, y: number, width: number, height: number): void {
    const key = `${x},${y},${width},${height}`;
    this.dirtyRects.add(key);
  }

  /**
   * Get current dirty rectangles
   */
  public getDirtyRects(): Array<{x: number, y: number, width: number, height: number}> {
    const rects: Array<{x: number, y: number, width: number, height: number}> = [];
    this.dirtyRects.forEach(key => {
      const [x, y, width, height] = key.split(',').map(Number);
      rects.push({ x, y, width, height });
    });
    return rects;
  }

  /**
   * Clear dirty rectangles
   */
  public clearDirtyRects(): void {
    this.dirtyRects.clear();
  }

  /**
   * Set zoom level
   */
  public setZoom(level: number): void {
    if (level < 1 || level > 4) {
      console.warn('Zoom level must be between 1 and 4');
      return;
    }
    this.zoomLevel = level;
    this.markDirtyRect(0, 0, this.canvas.width, this.canvas.height);
  }

  /**
   * Get zoom level
   */
  public getZoom(): number {
    return this.zoomLevel;
  }

  /**
   * Resize canvas
   */
  public resize(width: number, height: number): void {
    this.canvas.width = width;
    this.canvas.height = height;
  }

  /**
   * Get canvas dimensions
   */
  public getSize(): { width: number, height: number } {
    return { width: this.canvas.width, height: this.canvas.height };
  }

  /**
   * Get pixel coordinates from canvas coordinates
   */
  public canvasToPixel(canvasX: number, canvasY: number): { x: number, y: number } {
    return {
      x: Math.floor(canvasX / this.zoomLevel),
      y: Math.floor(canvasY / this.zoomLevel)
    };
  }

  /**
   * Get canvas coordinates from pixel coordinates
   */
  public pixelToCanvas(pixelX: number, pixelY: number): { x: number, y: number } {
    return {
      x: pixelX * this.zoomLevel,
      y: pixelY * this.zoomLevel
    };
  }
}

/**
 * SpriteManager - Manages sprite sheets and animations
 */
export class SpriteManager {
  private sprites: Map<string, Sprite> = new Map();
  private animations: Map<string, AnimationFrame[]> = new Map();

  public registerSprite(key: string, spriteSheet: HTMLImageElement, frameWidth: number, frameHeight: number): void {
    this.sprites.set(key, { spriteSheet, frameWidth, frameHeight });
  }

  public registerAnimation(key: string, frames: AnimationFrame[]): void {
    this.animations.set(key, frames);
  }

  public getSprite(key: string): Sprite | undefined {
    return this.sprites.get(key);
  }

  public getAnimation(key: string): AnimationFrame[] | undefined {
    return this.animations.get(key);
  }

  public getAnimationFrame(animationKey: string, frameIndex: number): AnimationFrame | undefined {
    const animation = this.animations.get(animationKey);
    if (!animation) return undefined;
    return animation[frameIndex % animation.length];
  }
}
