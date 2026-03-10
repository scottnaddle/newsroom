# TOOLS.md - Local Notes

Skills define _how_ tools work. This file is for _your_ specifics — the stuff that's unique to your setup.

## What Goes Here

Things like:

- Camera names and locations
- SSH hosts and aliases
- Preferred voices for TTS
- Speaker/room names
- Device nicknames
- Anything environment-specific

## Examples

```markdown
### Cameras

- living-room → Main area, 180° wide angle
- front-door → Entrance, motion-triggered

### SSH

- home-server → 192.168.1.100, user: admin

### TTS

- Preferred voice: "Nova" (warm, slightly British)
- Default speaker: Kitchen HomePod
```

## Why Separate?

Skills are shared. Your setup is yours. Keeping them apart means you can update skills without losing your notes, and share skills without leaking your infrastructure.

---

Add whatever helps you do your job. This is your cheat sheet.

## API Keys

### Google AI Studio (Nano Banana / Gemini Image)
- Key: `AIzaSyDvH5WMJww3-hxjfGJ0yexIQxKQk48KVS0`
- Models: `gemini-3-pro-image-preview` (Nano Banana Pro), `gemini-2.5-flash-image` (Nano Banana)
- Used for: 일일 만평 이미지 생성 (`newsroom/scripts/generate-cartoon.js`)
