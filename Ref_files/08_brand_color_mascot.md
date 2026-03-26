# Brand, Color Palette & Mascot Design

## Color Palette

| Name | Hex | ANSI 256 | Role |
|------|-----|----------|------|
| **Deep Violet** | #8B5CF6 | 99 | Primary brand color, prompts, highlights |
| **Stark Rose** | #F43F5E | 204 | Errors, warnings, destructive actions |
| **Acidic Pistachio** | #A3E635 | 149 | Success, completion, positive feedback |
| **Icy Slate** | #F8FAFC | 255 | Primary text on dark backgrounds |
| **Midnight Slate** | #334155 | 237 | Background, secondary surfaces |

### Color Usage Guidelines
- **Deep Violet**: Prompt indicator, active selections, brand elements, spider mascot body
- **Stark Rose**: Error messages, permission denials, destructive operation warnings, spider scared expression
- **Acidic Pistachio**: Success confirmations, completed tasks, tool execution success, spider happy expression
- **Icy Slate**: Body text, file contents, code display
- **Midnight Slate**: Background fills, inactive panels, secondary info

### Additional Colors Needed
- Muted/dimmed violet for inactive/secondary elements
- Yellow/amber for caution states (can derive from palette)
- Blue for informational/debug messages
- Gray shades for borders, separators, comments

---

## Mascot: Geometric Spider

### Design Concept
- ASCII/Unicode art geometric spider
- Centered in brand Deep Violet color
- Has eyes and mouth showing expressions
- Lives in the terminal prompt area or status bar

### Expression States

| State | Expression | When |
|-------|-----------|------|
| **Idle/Waiting** | Sleepy eyes (- -), neutral mouth | Waiting for input |
| **Thinking** | Spinning animation, focused eyes (o o) | Processing/generating |
| **Success** | Happy eyes (^ ^), smile mouth | Task completed |
| **Error** | Scared eyes (O O), frown mouth | Error occurred |
| **Working** | Determined eyes (> <), building with web | File operations |
| **Greeting** | Wave animation, friendly eyes (◕ ◕) | Session start |
| **Confused** | Question marks (?), tilted head | Needs clarification |

### ASCII Art Concepts (Small - fits in prompt)

```
Idle:        Thinking:     Happy:        Error:
  /\  /\      /\  /\       /\  /\       /\  /\
 / - - \    / • • \      / ^ ^ \      / O O \
|  ---  |   |  ~~~  |    |  ___  |    |  ___  |
 \      /    \      /     \      /     \      /
  \/  \/      \/  \/       \/  \/       \/  \/
```

### ASCII Art Concepts (Large - welcome screen)

```
       ╱╲      ╱╲
      ╱  ╲    ╱  ╲
     ╱    ╲  ╱    ╲
    ╱   ◕  ╲╱  ◕   ╲
   ╱                 ╲
  │      ╲____╱       │
   ╲                 ╱
    ╲     ╱  ╲     ╱
     ╲   ╱    ╲   ╱
      ╲ ╱      ╲ ╱
       V        V

   F R I D A Y C O D E
   ═══════════════════
```

### Animation Ideas
- **Web spinning**: Lines extending from spider during thinking
- **Crawling**: Spider moves along prompt bar
- **Dangling**: Spider drops down on silk thread for notifications
- **Building**: Web construction animation for file creation
- **Blinking**: Occasional blink animation when idle

### Implementation Notes
- Use Unicode box-drawing characters for geometric look
- Braille characters (⠀⠁⠂...) for smoother animations
- Keep small version to 3-5 lines for prompt integration
- Large version (8-12 lines) for welcome screen only
- Color support: Render in Deep Violet with expression-matching colors
- Respect `prefersReducedMotion` setting (disable animations)
- Fallback to basic ASCII for terminals without Unicode support

---

## Brand Voice
- **Name**: FridayCode (like having a coding buddy on a Friday - relaxed but productive)
- **Personality**: Helpful, slightly cheeky, open-source ethos
- **Tagline Ideas**:
  - "Your open-source coding companion"
  - "Code freely. Build anything."
  - "The terminal's best friend"
  - "Web-slinging code since 2026"
