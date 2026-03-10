/**
 * CharacterStateMachine - Agent Character State Management
 * 
 * Handles character states (Idle, Walking, Typing, Reading, etc.)
 * and manages state transitions with animations.
 */

export enum CharacterState {
  Idle = 'idle',
  Walking = 'walking',
  Typing = 'typing',
  Reading = 'reading',
  Processing = 'processing',
  Publishing = 'publishing',
  Error = 'error',
  Waiting = 'waiting'
}

export interface CharacterAnimationConfig {
  frames: number[];  // Frame indices
  frameDuration: number;  // ms per frame
  loop: boolean;
}

export interface CharacterConfig {
  id: string;
  name: string;
  x: number;
  y: number;
  spriteKey: string;
  color: string;
  animations: Map<CharacterState, CharacterAnimationConfig>;
}

/**
 * Abstract base class for character states
 */
export abstract class BaseCharacterState {
  protected character: Character;
  protected elapsedTime: number = 0;
  protected frameIndex: number = 0;

  constructor(character: Character) {
    this.character = character;
  }

  abstract onEnter(): void;
  abstract onUpdate(deltaTime: number): void;
  abstract onExit(): void;

  protected getCurrentFrameIndex(): number {
    return this.frameIndex;
  }

  protected advanceFrame(): void {
    const animation = this.character.getAnimationConfig();
    if (animation) {
      this.frameIndex = (this.frameIndex + 1) % animation.frames.length;
    }
  }
}

/**
 * Idle State - Character sitting
 */
export class IdleState extends BaseCharacterState {
  onEnter(): void {
    this.frameIndex = 0;
    this.elapsedTime = 0;
  }

  onUpdate(deltaTime: number): void {
    this.elapsedTime += deltaTime;
    const animation = this.character.getAnimationConfig();
    
    if (animation && this.elapsedTime > animation.frameDuration) {
      this.advanceFrame();
      this.elapsedTime = 0;
    }
  }

  onExit(): void {
    // Clean up if needed
  }
}

/**
 * Walking State - Character moving
 */
export class WalkingState extends BaseCharacterState {
  private targetX: number;
  private targetY: number;
  private speed: number = 2; // pixels per frame

  constructor(character: Character, targetX: number, targetY: number) {
    super(character);
    this.targetX = targetX;
    this.targetY = targetY;
  }

  onEnter(): void {
    this.frameIndex = 0;
    this.elapsedTime = 0;
  }

  onUpdate(deltaTime: number): void {
    const [x, y] = this.character.getPosition();
    const distance = Math.hypot(this.targetX - x, this.targetY - y);

    if (distance < this.speed) {
      // Reached destination
      this.character.setPosition(this.targetX, this.targetY);
      this.character.setState(CharacterState.Idle);
      return;
    }

    // Move towards target
    const angle = Math.atan2(this.targetY - y, this.targetX - x);
    const newX = x + Math.cos(angle) * this.speed;
    const newY = y + Math.sin(angle) * this.speed;
    this.character.setPosition(newX, newY);

    // Animate
    this.elapsedTime += deltaTime;
    const animation = this.character.getAnimationConfig();
    if (animation && this.elapsedTime > animation.frameDuration) {
      this.advanceFrame();
      this.elapsedTime = 0;
    }
  }

  onExit(): void {
    // Clean up
  }
}

/**
 * Typing State - Character writing code
 */
export class TypingState extends BaseCharacterState {
  private duration: number = 0;
  private maxDuration: number = 5000; // 5 seconds

  onEnter(): void {
    this.frameIndex = 0;
    this.elapsedTime = 0;
    this.duration = 0;
  }

  onUpdate(deltaTime: number): void {
    this.duration += deltaTime;
    this.elapsedTime += deltaTime;

    const animation = this.character.getAnimationConfig();
    if (animation && this.elapsedTime > animation.frameDuration) {
      this.advanceFrame();
      this.elapsedTime = 0;
    }

    // Auto-exit after duration
    if (this.duration > this.maxDuration) {
      this.character.setState(CharacterState.Idle);
    }
  }

  onExit(): void {
    // Clean up
  }

  public setDuration(duration: number): void {
    this.maxDuration = duration;
  }
}

/**
 * Reading State - Character reading documents
 */
export class ReadingState extends BaseCharacterState {
  private duration: number = 0;
  private maxDuration: number = 3000; // 3 seconds

  onEnter(): void {
    this.frameIndex = 0;
    this.elapsedTime = 0;
    this.duration = 0;
  }

  onUpdate(deltaTime: number): void {
    this.duration += deltaTime;
    this.elapsedTime += deltaTime;

    const animation = this.character.getAnimationConfig();
    if (animation && this.elapsedTime > animation.frameDuration) {
      this.advanceFrame();
      this.elapsedTime = 0;
    }

    if (this.duration > this.maxDuration) {
      this.character.setState(CharacterState.Idle);
    }
  }

  onExit(): void {
    // Clean up
  }

  public setDuration(duration: number): void {
    this.maxDuration = duration;
  }
}

/**
 * Processing State - Character thinking
 */
export class ProcessingState extends BaseCharacterState {
  onEnter(): void {
    this.frameIndex = 0;
    this.elapsedTime = 0;
  }

  onUpdate(deltaTime: number): void {
    this.elapsedTime += deltaTime;
    const animation = this.character.getAnimationConfig();
    
    if (animation && this.elapsedTime > animation.frameDuration) {
      this.advanceFrame();
      this.elapsedTime = 0;
    }
  }

  onExit(): void {
    // Clean up
  }
}

/**
 * Publishing State - Character celebrating
 */
export class PublishingState extends BaseCharacterState {
  private duration: number = 0;
  private maxDuration: number = 2000; // 2 seconds

  onEnter(): void {
    this.frameIndex = 0;
    this.elapsedTime = 0;
    this.duration = 0;
  }

  onUpdate(deltaTime: number): void {
    this.duration += deltaTime;
    this.elapsedTime += deltaTime;

    const animation = this.character.getAnimationConfig();
    if (animation && this.elapsedTime > animation.frameDuration) {
      this.advanceFrame();
      this.elapsedTime = 0;
    }

    if (this.duration > this.maxDuration) {
      this.character.setState(CharacterState.Idle);
    }
  }

  onExit(): void {
    // Clean up
  }
}

/**
 * Error State - Character showing error
 */
export class ErrorState extends BaseCharacterState {
  private duration: number = 0;
  private maxDuration: number = 3000; // 3 seconds

  onEnter(): void {
    this.frameIndex = 0;
    this.elapsedTime = 0;
    this.duration = 0;
  }

  onUpdate(deltaTime: number): void {
    this.duration += deltaTime;
    this.elapsedTime += deltaTime;

    const animation = this.character.getAnimationConfig();
    if (animation && this.elapsedTime > animation.frameDuration) {
      this.advanceFrame();
      this.elapsedTime = 0;
    }

    if (this.duration > this.maxDuration) {
      this.character.setState(CharacterState.Idle);
    }
  }

  onExit(): void {
    // Clean up
  }
}

/**
 * Waiting State - Character waiting for input
 */
export class WaitingState extends BaseCharacterState {
  onEnter(): void {
    this.frameIndex = 0;
    this.elapsedTime = 0;
  }

  onUpdate(deltaTime: number): void {
    this.elapsedTime += deltaTime;
    const animation = this.character.getAnimationConfig();
    
    if (animation && this.elapsedTime > animation.frameDuration) {
      this.advanceFrame();
      this.elapsedTime = 0;
    }
  }

  onExit(): void {
    // Clean up
  }
}

/**
 * Character - Main character class with state machine
 */
export class Character {
  private id: string;
  private name: string;
  private x: number;
  private y: number;
  private spriteKey: string;
  private color: string;
  private currentState: CharacterState = CharacterState.Idle;
  private stateInstance: BaseCharacterState | null = null;
  private animations: Map<CharacterState, CharacterAnimationConfig>;
  private currentFrameIndex: number = 0;

  constructor(config: CharacterConfig) {
    this.id = config.id;
    this.name = config.name;
    this.x = config.x;
    this.y = config.y;
    this.spriteKey = config.spriteKey;
    this.color = config.color;
    this.animations = config.animations;

    // Initialize with Idle state
    this.setState(CharacterState.Idle);
  }

  public setState(newState: CharacterState, ...args: any[]): void {
    if (this.stateInstance) {
      this.stateInstance.onExit();
    }

    this.currentState = newState;
    this.currentFrameIndex = 0;

    // Create new state instance
    switch (newState) {
      case CharacterState.Idle:
        this.stateInstance = new IdleState(this);
        break;
      case CharacterState.Walking:
        this.stateInstance = new WalkingState(this, args[0] || this.x, args[1] || this.y);
        break;
      case CharacterState.Typing:
        this.stateInstance = new TypingState(this);
        if (args[0]) (this.stateInstance as TypingState).setDuration(args[0]);
        break;
      case CharacterState.Reading:
        this.stateInstance = new ReadingState(this);
        if (args[0]) (this.stateInstance as ReadingState).setDuration(args[0]);
        break;
      case CharacterState.Processing:
        this.stateInstance = new ProcessingState(this);
        break;
      case CharacterState.Publishing:
        this.stateInstance = new PublishingState(this);
        break;
      case CharacterState.Error:
        this.stateInstance = new ErrorState(this);
        break;
      case CharacterState.Waiting:
        this.stateInstance = new WaitingState(this);
        break;
    }

    this.stateInstance?.onEnter();
  }

  public update(deltaTime: number): void {
    this.stateInstance?.onUpdate(deltaTime);
  }

  public getState(): CharacterState {
    return this.currentState;
  }

  public getId(): string {
    return this.id;
  }

  public getName(): string {
    return this.name;
  }

  public getPosition(): [number, number] {
    return [this.x, this.y];
  }

  public setPosition(x: number, y: number): void {
    this.x = x;
    this.y = y;
  }

  public getColor(): string {
    return this.color;
  }

  public getSpriteKey(): string {
    return this.spriteKey;
  }

  public getCurrentFrameIndex(): number {
    return this.currentFrameIndex;
  }

  public getAnimationConfig(): CharacterAnimationConfig | undefined {
    return this.animations.get(this.currentState);
  }
}
