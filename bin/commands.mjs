// SFX, Transitions, Captions, Zoom, Grade, Sync commands

import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import chalk from 'chalk';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TOOL_ROOT = path.join(__dirname, '..');
const SFX_DIR = path.join(TOOL_ROOT, 'sfx');

export const SFX_TYPES = ['whoosh', 'pop', 'riser', 'hit', 'drone'];

export const GRADE_PRESETS = {
  'cinematic': { bg: 'gradient:#0a0a0a:#1a1a2e', accent: '#FFE66D' },
  'neon': { bg: 'gradient:#000:#0a001a', accent: '#00FF88' },
  'dark': { bg: 'gradient:#000:#0a0a0a', accent: '#FFFFFF' },
  'warm': { bg: 'gradient:#1a0a00:#0a0a0a', accent: '#FF6B6B' },
  'cool': { bg: 'gradient:#0a0a1a:#000', accent: '#4ECDC4' },
  'vintage': { bg: 'gradient:#1a1a0a:#0a0a0a', accent: '#FFE66D' },
  'cyberpunk': { bg: 'gradient:#0a001a:#1a0000', accent: '#FF0040' },
  'minimal': { bg: '#000', accent: '#FFFFFF' }
};

export function setupSfxCommands(program, getProject, saveProject, ASSETS_DIR) {
  const sfx = program.command('sfx').description('Sound effects library');

  sfx.command('list').description('List built-in SFX').action(() => {
    console.log(chalk.blue('\n🔊 Built-in SFX:\n'));
    SFX_TYPES.forEach(type => {
      const exists = fs.existsSync(path.join(SFX_DIR, `${type}.mp3`));
      console.log(chalk.cyan(`  ${type}`) + (exists ? chalk.green(' ✔') : chalk.red(' ✘')));
    });
  });

  sfx.command('add <type>').description('Add SFX to timeline')
    .option('-s, --start <frame>', 'Start frame', '0')
    .option('-v, --volume <vol>', 'Volume', '0.5')
    .action(async (type, options) => {
      if (!SFX_TYPES.includes(type)) {
        console.log(chalk.red(`✘ Unknown SFX. Use: ${SFX_TYPES.join(', ')}`));
        process.exit(1);
      }
      const project = await getProject();
      const sfxPath = path.join(SFX_DIR, `${type}.mp3`);
      if (!(await fs.pathExists(sfxPath))) {
        console.log(chalk.red(`✘ SFX not found: ${type}`));
        process.exit(1);
      }
      await fs.ensureDir(ASSETS_DIR);
      await fs.copy(sfxPath, path.join(ASSETS_DIR, `sfx-${type}.mp3`));
      project.assets[`sfx_${type}`] = `/sfx-${type}.mp3`;
      project.timeline.audio.push({
        id: `audio_${project.timeline.audio.length + 1}`,
        assetId: `sfx_${type}`,
        startFrame: parseInt(options.start),
        duration: 30,
        volume: parseFloat(options.volume)
      });
      await saveProject(project);
      console.log(chalk.green(`✔ Added ${type} at frame ${options.start}`));
    });

  sfx.command('batch <pattern>').description('Add SFX pattern: whoosh-pop, riser-hit, cinematic, minimal')
    .option('-s, --start <frame>', 'Start frame', '0')
    .option('-i, --interval <frames>', 'Interval', '60')
    .action(async (pattern, options) => {
      const patterns = {
        'whoosh-pop': ['whoosh', 'pop', 'whoosh', 'pop'],
        'riser-hit': ['riser', 'hit', 'riser', 'hit'],
        'cinematic': ['drone', 'riser', 'hit', 'whoosh', 'pop'],
        'minimal': ['pop', 'whoosh']
      };
      if (!patterns[pattern]) {
        console.log(chalk.red(`✘ Available: ${Object.keys(patterns).join(', ')}`));
        process.exit(1);
      }
      const project = await getProject();
      const seq = patterns[pattern];
      const start = parseInt(options.start);
      const interval = parseInt(options.interval);
      await fs.ensureDir(ASSETS_DIR);
      seq.forEach((type, i) => {
        const src = path.join(SFX_DIR, `${type}.mp3`);
        if (fs.existsSync(src)) {
          fs.copySync(src, path.join(ASSETS_DIR, `sfx-${type}.mp3`));
          project.assets[`sfx_${type}`] = `/sfx-${type}.mp3`;
          project.timeline.audio.push({
            id: `audio_${project.timeline.audio.length + 1}`,
            assetId: `sfx_${type}`,
            startFrame: start + (i * interval),
            duration: 30,
            volume: 0.5
          });
        }
      });
      await saveProject(project);
      console.log(chalk.green(`✔ Added ${pattern}: ${seq.length} SFX`));
    });
}

export function setupTransitionCommand(program, getProject, saveProject) {
  program.command('transition <type>').description('Add transition: whoosh, fade, zoom, glitch')
    .option('-f, --frame <frame>', 'Frame', '0')
    .option('-d, --duration <frames>', 'Duration', '15')
    .action(async (type, options) => {
      const effects = { 'whoosh': 'slide-left', 'fade': 'liquid', 'zoom': 'zoom-in', 'glitch': 'glitch' };
      if (!effects[type]) {
        console.log(chalk.red(`✘ Use: ${Object.keys(effects).join(', ')}`));
        process.exit(1);
      }
      const project = await getProject();
      const frame = parseInt(options.frame);
      const dur = parseInt(options.duration);
      project.timeline.texts.push({
        id: `text_${project.timeline.texts.length + 1}`,
        content: '',
        startFrame: frame - Math.floor(dur / 2),
        endFrame: frame + Math.floor(dur / 2),
        style: { color: 'transparent', fontSize: 1 },
        position: { x: 'center', y: 'center' },
        effect: effects[type],
        bg: type === 'glitch' ? '#FF0040' : '#000',
        accent: '#FFFFFF'
      });
      await saveProject(project);
      console.log(chalk.green(`✔ Added ${type} transition at frame ${frame}`));
    });
}

export function setupCaptionCommand(program, getProject, saveProject) {
  program.command('caption <text>').description('Add word-by-word caption (3 words max)')
    .option('-s, --start <frame>', 'Start frame', '0')
    .option('-w, --words-per-frame <n>', 'Words at once', '3')
    .option('-c, --color <color>', 'Color', '#FFFFFF')
    .option('-sz, --size <size>', 'Font size', '60')
    .action(async (text, options) => {
      const project = await getProject();
      const start = parseInt(options.start);
      const wpf = parseInt(options.wordsPerFrame);
      const words = text.split(' ');
      const fps = 12;
      const chunks = [];
      for (let i = 0; i < words.length; i += wpf) {
        chunks.push(words.slice(i, i + wpf).join(' '));
      }
      chunks.forEach((chunk, i) => {
        project.timeline.texts.push({
          id: `text_${project.timeline.texts.length + 1}`,
          content: chunk,
          startFrame: start + (i * fps),
          endFrame: start + ((i + 1) * fps),
          style: { color: options.color, fontSize: parseInt(options.size) },
          position: { x: 'center', y: 'bottom' },
          effect: 'flash',
          bg: null,
          accent: options.color
        });
      });
      await saveProject(project);
      console.log(chalk.green(`✔ Added ${chunks.length} caption chunks`));
    });
}

export function setupZoomCommand(program, getProject, saveProject) {
  program.command('zoom <type>').description('Add zoom: in, out, pulse, shake')
    .option('-f, --frame <frame>', 'Frame', '0')
    .option('-d, --duration <frames>', 'Duration', '30')
    .action(async (type, options) => {
      const effects = { 'in': 'zoom-in', 'out': 'zoom-out', 'pulse': 'pulse', 'shake': 'shake' };
      if (!effects[type]) {
        console.log(chalk.red(`✘ Use: ${Object.keys(effects).join(', ')}`));
        process.exit(1);
      }
      const project = await getProject();
      const frame = parseInt(options.frame);
      const dur = parseInt(options.duration);
      project.timeline.texts.push({
        id: `text_${project.timeline.texts.length + 1}`,
        content: '',
        startFrame: frame,
        endFrame: frame + dur,
        style: { color: 'transparent', fontSize: 1 },
        position: { x: 'center', y: 'center' },
        effect: effects[type],
        bg: null,
        accent: '#FFFFFF'
      });
      await saveProject(project);
      console.log(chalk.green(`✔ Added ${type} zoom at frame ${frame}`));
    });
}

export function setupGradeCommand(program, getProject, saveProject) {
  program.command('grade [preset]').description('Apply color grading: cinematic, neon, dark, warm, cool, vintage, cyberpunk, minimal')
    .option('--list', 'List presets')
    .action(async (preset, options) => {
      if (options.list || !preset) {
        console.log(chalk.blue('\n🎨 Presets:\n'));
        Object.entries(GRADE_PRESETS).forEach(([name, cfg]) => {
          console.log(chalk.cyan(`  ${name}`) + chalk.gray(` — ${cfg.accent}`));
        });
        return;
      }
      if (!GRADE_PRESETS[preset]) {
        console.log(chalk.red('✘ Unknown preset. Use --list'));
        process.exit(1);
      }
      const project = await getProject();
      const cfg = GRADE_PRESETS[preset];
      project.timeline.texts.forEach(t => { t.bg = cfg.bg; t.accent = cfg.accent; });
      await saveProject(project);
      console.log(chalk.green(`✔ Applied ${preset} to ${project.timeline.texts.length} scenes`));
    });
}

export function setupSyncCommand(program, getProject, saveProject) {
  program.command('sync').description('Auto-sync cuts to audio beats')
    .action(async () => {
      const project = await getProject();
      if (project.timeline.audio.length === 0) {
        console.log(chalk.red('✘ No audio to sync'));
        process.exit(1);
      }
      const texts = project.timeline.texts;
      if (texts.length < 2) {
        console.log(chalk.red('✘ Need 2+ scenes'));
        process.exit(1);
      }
      const total = project.settings.durationInFrames;
      const interval = Math.floor(total / (texts.length + 1));
      texts.forEach((t, i) => {
        t.startFrame = i * interval;
        t.endFrame = (i + 1) * interval;
      });
      await saveProject(project);
      console.log(chalk.green(`✔ Synced ${texts.length} scenes (interval: ${interval}f)`));
    });
}
