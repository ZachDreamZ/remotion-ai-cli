<p align="center">
  <img alt="remotion-ai" src="https://img.shields.io/badge/remotion--ai-cli-00FF88?style=flat-square&logo=node.js&logoColor=white" width="128">
</p>

<h1 align="center">remotion-ai</h1>

<p align="center">
  <strong>Vibe coding for video</strong> — describe what you want, AI builds it
</p>

<p align="center">
  <a href="#quick-start">Quick Start</a> ·
  <a href="#features">Features</a> ·
  <a href="#commands">Commands</a> ·
  <a href="#examples">Examples</a> ·
  <a href="#ai-agent-integration">AI Integration</a> ·
  <a href="https://github.com/ZachDreamZ/remotion-ai-cli">GitHub</a>
</p>

---

**remotion-ai** is a CLI that turns natural language into video. No timeline editing. No keyframes. Just tell it what you want.

```bash
# Install
npm install -g remotion-ai-cli

# Create a video from natural language
remotion-ai vibe "Make a 30s tech explainer about AI agents" --render

# One-shot: scrape a URL and generate a video
remotion-ai auto https://en.wikipedia.org/wiki/Artificial_intelligence --render

# Get trending video ideas
remotion-ai suggest --category tech
```

**remotion-ai** is built on [Remotion](https://www.remotion.dev/) and uses your GPU (AMD/NVIDIA/Intel) for fast hardware-accelerated rendering.

---

## Quick Start

```bash
# Install globally
npm install -g remotion-ai-cli

# Initialize a project
mkdir my-video && cd my-video
remotion-ai init

# Create content
remotion-ai vibe "Top 5 AI tools for developers" --dry-run

# Render
remotion-ai render --gpu
```

### Requirements

- **Node.js** ≥ 18
- **FFmpeg** (for rendering)
- **GPU** (optional, for hardware encoding)

---

## Features

| Feature | Description |
|---------|-------------|
| **Vibe Coding** | Natural language → full video in one command |
| **Auto Pipeline** | Scrape URL → summarize → script → render |
| **Data Infographics** | Import JSON/CSV → animated charts and stats |
| **Web Scraping** | Extract content from any webpage |
| **Template Library** | Pre-built video structures (explainer, listicle, news, tutorial, promo) |
| **GPU Acceleration** | AMD AMF, NVIDIA NVENC, Intel QSV auto-detection |
| **MCP Server** | AI agent integration via Model Context Protocol |
| **Remix** | Analyze existing video and suggest improvements |

---

## Commands

### Core

| Command | Description |
|---------|-------------|
| `init` | Initialize a new video project |
| `render [--gpu]` | Render video to `~/Downloads/remotion-ai-renders/` |
| `preview` | Start Remotion Studio for live preview |
| `status` | Show project summary (timeline, assets, settings) |
| `info` | Show tool version, Node, FFmpeg, GPU info |

### Vibe Coding

| Command | Description |
|---------|-------------|
| `vibe <prompt>` | Natural language → video (with `--render` for auto-render) |
| `auto <url>` | One-shot pipeline: scrape → script → render |
| `remix` | Analyze current video and suggest improvements |
| `suggest` | Get trending video topic suggestions |

### Content

| Command | Description |
|---------|-------------|
| `text add <content>` | Add text overlay with effects |
| `text style <id>` | Style text (color, size) |
| `clip add <file>` | Add video/image clip |
| `audio add <file>` | Add background music |
| `duration <frames>` | Set project duration |

### Data Infographics

| Command | Description |
|---------|-------------|
| `data import <file>` | Import JSON/CSV data |
| `data chart <type>` | Generate chart: counter, bar, comparison, ranking |
| `data list` | Show imported data points |

### Web Scraping

| Command | Description |
|---------|-------------|
| `scrape url <url>` | Extract headlines, stats, text from webpage |
| `scrape trend <topic>` | Search trending topics |
| `scrape to-video <url>` | Auto-generate video from scraped content |

### Templates & Ideas

| Command | Description |
|---------|-------------|
| `template list` | List available templates |
| `template preview <name>` | Preview template structure |
| `idea <topic>` | Get video structure suggestions for a topic |

### GPU

| Command | Description |
|---------|-------------|
| `gpu detect` | Detect GPU and show encoder info |
| `gpu test` | Test GPU encoding with short render |

### MCP Server

| Command | Description |
|---------|-------------|
| `mcp` | Start MCP server for AI agent integration |

---

## Examples

### Vibe Coding — Describe your video

```bash
# Tech explainer
remotion-ai vibe "Make a 30s tech explainer about quantum computing"

# Listicle
remotion-ai vibe "Top 5 productivity tips for developers" --render

# Comparison
remotion-ai vibe "React vs Vue vs Svelte comparison" --dry-run

# Tutorial
remotion-ai vibe "How to set up a Next.js project in 2 minutes"
```

### Auto Pipeline — One-shot from URL

```bash
# Scrape Wikipedia and generate video
remotion-ai auto https://en.wikipedia.org/wiki/Artificial_intelligence --render

# Scrape a blog post
remotion-ai auto https://blog.example.com/ai-trends --duration 600
```

### Data Infographics — Animated charts

```bash
# Import data
remotion-ai data import market-share.json

# Generate ranking chart
remotion-ai data chart ranking --title "Market Share 2024"

# Generate comparison
remotion-ai data chart comparison --title "GPT vs Claude"

# Generate counter
remotion-ai data chart counter --title "Total Users"
```

### Web Scraping — Extract and visualize

```bash
# Extract content from any webpage
remotion-ai scrape url https://news.ycombinator.com

# Generate video from scraped content
remotion-ai scrape to-video https://example.com/article --render

# Search trending topics
remotion-ai scrape trend "AI agents" --json
```

### Templates — Pre-built structures

```bash
# List all templates
remotion-ai template list

# Preview a template
remotion-ai template preview explainer

# Get video ideas for a topic
remotion-ai idea "Machine Learning"
```

### Remix — Improve existing video

```bash
# Analyze and get suggestions
remotion-ai remix

# Auto-apply fixes
remotion-ai remix --apply
```

---

## AI Agent Integration

remotion-ai includes an MCP server for integration with AI coding agents (Claude, GPT, etc.):

```bash
# Start MCP server
remotion-ai mcp
```

### Available MCP Tools

| Tool | Description |
|------|-------------|
| `remotion_init` | Initialize a new project |
| `remotion_render` | Render video with GPU acceleration |
| `remotion_preview` | Start Remotion Studio |
| `remotion_add_text` | Add text overlay with effects |
| `remotion_add_clip` | Add video/image clip |
| `remotion_add_audio` | Add background music |
| `remotion_status` | Get project status |

### Example: AI Agent Workflow

```
User: "Make a 30s video about AI trends for TikTok"

Agent:
1. remotion_init
2. remotion_add_text "AI Trends 2024" --effect scale
3. remotion_add_text "1. AI Agents" --effect kinetic
4. remotion_add_text "2. Multimodal AI" --effect wave
5. remotion_add_text "3. AI Coding" --effect glitch
6. remotion_add_text "Follow for more" --effect bounce
7. remotion_render --gpu
```

---

## Project Structure

```
my-video/
├── .remotion-ai/
│   └── project.json      # Project state (timeline, settings, assets)
├── public/               # Static assets (videos, images, audio)
├── src/
│   ├── index.tsx         # Root component
│   └── Composition.tsx   # Main composition (effects, particles, scanlines)
├── templates/            # Video templates (YAML)
├── schema.json           # Project JSON schema
└── package.json
```

---

## Configuration

### Settings

Edit `.remotion-ai/project.json` or use CLI:

```bash
# Set resolution
remotion-ai init  # Creates 1080x1920 (vertical)

# Set duration (in frames at 30fps)
remotion-ai duration 900  # 30 seconds
```

### GPU Acceleration

```bash
# Detect GPU
remotion-ai gpu detect

# Render with GPU
remotion-ai render --gpu

# Force specific encoder
remotion-ai render --encoder h264_amf  # AMD
remotion-ai render --encoder h264_nvenc  # NVIDIA
remotion-ai render --encoder h264_qsv    # Intel
```

### Custom Templates

Create YAML templates in `templates/`:

```yaml
name: My Template
description: Custom video structure
category: custom
duration: 600
scenes:
  - effect: scale
    text: "Title"
    duration: 90
    accent: "#00FF88"
  - effect: kinetic
    text: "Content"
    duration: 120
    accent: "#4ECDC4"
```

---

## Effects

| Effect | Description |
|--------|-------------|
| `scale` | Scale in with bounce |
| `kinetic` | Slide up with fade |
| `liquid` | Reveal with clip-path |
| `shader` | Blur to focus |
| `typewriter` | Character-by-character reveal |
| `wave` | Character wave animation |
| `glitch` | RGB split glitch |
| `bounce` | Drop with bounce |
| `flash` | Quick flash in |
| `pulse` | Gentle pulse |
| `slide-left` | Slide in from left |
| `slide-right` | Slide in from right |

---

## Tech Stack

- **Runtime:** Node.js 18+
- **Video Engine:** [Remotion](https://www.remotion.dev/)
- **GPU Encoding:** AMD AMF, NVIDIA NVENC, Intel QSV
- **Web Scraping:** [Cheerio](https://cheerio.js.org/)
- **Schema Validation:** [Ajv](https://ajv.js.org/)
- **CLI Framework:** [Commander.js](https://github.com/tj/commander.js)
- **MCP SDK:** [@modelcontextprotocol/sdk](https://www.npmjs.com/package/@modelcontextprotocol/sdk)

---

## Contributing

1. Fork the repo
2. Create a branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## License

MIT © [Vendex](https://github.com/Vendex-ai)

---

<p align="center">
  Built with ❤️ for the AI video era
</p>
