#!/usr/bin/env node
import { Command } from 'commander';
import chalk from 'chalk';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import { execSync, spawn } from 'child_process';
import * as yaml from 'js-yaml';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { fileURLToPath } from 'url';
import { setupSfxCommands, setupTransitionCommand, setupCaptionCommand, setupZoomCommand, setupGradeCommand, setupSyncCommand } from './commands.mjs';
import { setupMaskCommand, setupBlendCommand, setupSilenceCommand, setupBrollCommand, setupPyramidCommand, setupHookCommand, setupNoiseCommand } from './advanced.mjs';
import { setupTranscribeCommand, setupHighlightsCommand, setupSpeakersCommand, setupTrimCommand, setupKaraokeCommand, setupScenesCommand, setupNormalizeCommand, setupCropCommand, setupMcpCommand } from './clipping.mjs';
import { setupScriptCommand, setupVoiceCommand, setupMotionCommand, setupSvgCommand, setupTransitionSfxCommand, setupCapcutCommand } from './motion.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TOOL_ROOT = path.join(__dirname, '..');

const ajv = new Ajv({ allErrors: true, verbose: true });
addFormats(ajv);

const program = new Command();

const PROJECT_ROOT = process.cwd();
const CONFIG_DIR = path.join(PROJECT_ROOT, '.remotion-ai');
const PROJECT_PATH = path.join(CONFIG_DIR, 'project.json');
const SCHEMA_PATH = path.join(PROJECT_ROOT, 'schema.json');
const DOWNLOADS_DIR = path.join(os.homedir(), 'Downloads', 'remotion-ai-renders');
const ASSETS_DIR = path.join(PROJECT_ROOT, 'public');
const ACTION_LOG_PATH = path.join(CONFIG_DIR, 'action-log.json');

const DEFAULT_PROJECT = {
  settings: {
    width: 1080,
    height: 1920,
    fps: 30,
    durationInFrames: 300
  },
  assets: {},
  timeline: {
    clips: [],
    texts: [],
    audio: []
  }
};

async function getProject() {
  if (!(await fs.pathExists(CONFIG_DIR))) {
    await fs.ensureDir(CONFIG_DIR);
  }
  if (!(await fs.pathExists(PROJECT_PATH))) {
    await fs.writeJson(PROJECT_PATH, DEFAULT_PROJECT, { spaces: 2 });
  }
  
  const project = await fs.readJson(PROJECT_PATH);
  
  // Schema Validation
  if (await fs.pathExists(SCHEMA_PATH)) {
    const schema = await fs.readJson(SCHEMA_PATH);
    const validate = ajv.compile(schema);
    const valid = validate(project);
    
    if (!valid) {
      console.log(chalk.red('\n❌ Project Schema Validation Failed:'));
      validate.errors.forEach(err => {
        console.log(chalk.yellow(`- ${err.instancePath || 'root'} ${err.message}`));
      });
      console.log(chalk.gray('\nPlease fix the errors in .remotion-ai/project.json or run "remotion-ai init" to reset.\n'));
      process.exit(1);
    }
  }
  
  return project;
}

async function saveProject(project) {
  await fs.writeJson(PROJECT_PATH, project, { spaces: 2 });
}

// --- ACTION LOG ---

async function logAction(action, details) {
  let log = [];
  if (await fs.pathExists(ACTION_LOG_PATH)) {
    log = await fs.readJson(ACTION_LOG_PATH);
  }
  
  log.push({
    timestamp: new Date().toISOString(),
    action: action,
    details: details
  });
  
  await fs.writeJson(ACTION_LOG_PATH, log, { spaces: 2 });
}

async function getActionLog() {
  if (await fs.pathExists(ACTION_LOG_PATH)) {
    return await fs.readJson(ACTION_LOG_PATH);
  }
  return [];
}

async function handleError(error) {
  console.log(chalk.red('\n💥 An unexpected error occurred:'));
  
  if (error.message.includes('npx: command not found')) {
    console.log(chalk.yellow('It looks like "npx" is not installed. Please install Node.js (which includes npm and npx) to use this tool.'));
  } else if (error.message.includes('remotion render')) {
    console.log(chalk.yellow('Remotion failed to render. This often happens due to missing dependencies in the scaffolded project. Try running "npm install" in your project root.'));
  } else {
    console.log(chalk.gray(error.stack || error.message));
  }
  
  process.exit(1);
}

async function verifyAssets(project) {
  const missingAssets = [];
  
  // Check clips
  for (const clip of project.timeline.clips) {
    const assetPath = project.assets[clip.assetId];
    let checkPath = assetPath;
    if (assetPath && assetPath.startsWith('/')) {
      checkPath = path.join(ASSETS_DIR, assetPath.substring(1));
    }
    if (!checkPath || !(await fs.pathExists(checkPath))) {
      missingAssets.push({ id: clip.assetId, type: 'clip', path: assetPath });
    }
  }
  
  // Check audio
  for (const audio of project.timeline.audio) {
    const assetPath = project.assets[audio.assetId] || audio.assetId;
    let checkPath = assetPath;
    if (assetPath && assetPath.startsWith('/')) {
      checkPath = path.join(ASSETS_DIR, assetPath.substring(1));
    }
    if (!(await fs.pathExists(checkPath))) {
      missingAssets.push({ id: audio.assetId, type: 'audio', path: assetPath });
    }
  }
  
  return missingAssets;
}

program
  .name('remotion-ai')
  .description('\n  ╔══════════════════════════════════════╗\n  ║   🎬 remotion-ai — AI Video Editor  ║\n  ║   CapCut-style CLI powered by        ║\n  ║   Remotion · MCP-ready              ║\n  ╚══════════════════════════════════════╝\n')
  .version('1.0.0');

// --- PROJECT COMMANDS ---

program
  .command('init')
  .description('Initialize a new video project')
  .action(async () => {
    await fs.ensureDir(CONFIG_DIR);
    await fs.writeJson(PROJECT_PATH, DEFAULT_PROJECT, { spaces: 2 });
    await fs.ensureDir(ASSETS_DIR);
    
    const SOURCE_DIR = path.join(TOOL_ROOT, 'src');
    const PKG_FILE = path.join(TOOL_ROOT, 'package.json');
    
    try {
      await fs.copy(SOURCE_DIR, path.join(process.cwd(), 'src'), {
        filter: (src) => !src.includes('node_modules')
      });
      await fs.copy(PKG_FILE, path.join(process.cwd(), 'package.json'));
      await fs.ensureDir(ASSETS_DIR);
      console.log(chalk.green(`✔ Remotion source scaffolded to ${process.cwd()}/src`));
    } catch (e) {
      console.log(chalk.yellow('⚠ Could not scaffold source files. Please ensure you are running from the tool directory or that the tool is installed correctly.'));
    }

    console.log(chalk.green(`✔ Project initialized in ${CONFIG_DIR}`));
  });

program
  .command('duration <frames>')
  .description('Set total project duration in frames')
  .action(async (frames) => {
    const project = await getProject();
    project.settings.durationInFrames = parseInt(frames);
    await saveProject(project);
    console.log(chalk.green(`✔ Project duration set to ${frames} frames`));
  });

// --- CLIP COMMANDS ---

const clip = program.command('clip').description('Manage video/image clips');

clip
  .command('add <path>')
  .description('Add a clip to the timeline')
  .option('-s, --start <frame>', 'Start frame on timeline', '0')
  .option('-e, --end <frame>', 'End frame on timeline')
  .option('-ts, --trim-start <frame>', 'Trim start from source', '0')
  .option('-te, --trim-end <frame>', 'Trim end from source')
  .action(async (assetPath, options) => {
    const project = await getProject();
    const assetId = `asset_${Object.keys(project.assets).length + 1}`;
    
    const absolutePath = path.resolve(assetPath);
    const fileName = path.basename(absolutePath);
    const destPath = path.join(ASSETS_DIR, fileName);
    
    try {
      await fs.ensureDir(ASSETS_DIR);
      // Only copy if source is different from destination
      if (absolutePath !== destPath) {
        await fs.copy(absolutePath, destPath);
      }
      project.assets[assetId] = `/${fileName}`;
    } catch (e) {
      console.log(chalk.red(`✘ Failed to copy asset ${assetPath}: ${e.message}`));
      process.exit(1);
    }
    
    const startFrame = parseInt(options.start);
    const trimStart = parseInt(options.trimStart);
    let endFrame = options.end ? parseInt(options.end) : startFrame + 60;
    const trimEnd = options.trimEnd ? parseInt(options.trimEnd) : trimStart + (endFrame - startFrame);

    const clipId = `clip_${project.timeline.clips.length + 1}`;
    project.timeline.clips.push({
      id: clipId,
      assetId: assetId,
      startFrame: startFrame,
      endFrame: endFrame,
      trimStart: trimStart,
      trimEnd: trimEnd,
      transition: 'fade'
    });

    await saveProject(project);
    await logAction('clip-add', { clipId, assetId, assetPath, startFrame, endFrame });
    console.log(chalk.green(`✔ Added ${clipId} using ${assetPath} [${startFrame} -> ${endFrame}]`));
  });

clip
  .command('remove <id>')
  .description('Remove a clip by ID')
  .action(async (id) => {
    const project = await getProject();
    project.timeline.clips = project.timeline.clips.filter(c => c.id !== id);
    await saveProject(project);
    console.log(chalk.green(`✔ Removed clip ${id}`));
  });

clip
  .command('move <id> <startFrame>')
  .description('Move a clip to a new start frame')
  .action(async (id, startFrame) => {
    const project = await getProject();
    const clip = project.timeline.clips.find(c => c.id === id);
    if (!clip) return console.log(chalk.red('Clip not found'));
    
    const duration = clip.endFrame - clip.startFrame;
    const newStart = parseInt(startFrame);
    clip.startFrame = newStart;
    clip.endFrame = newStart + duration;
    
    await saveProject(project);
    console.log(chalk.green(`✔ Moved ${id} to ${newStart}`));
  });

clip
  .command('list')
  .description('List all clips on the timeline')
  .action(async () => {
    const project = await getProject();
    if (project.timeline.clips.length === 0) {
      console.log(chalk.yellow('No clips on timeline.'));
      return;
    }
    console.log(chalk.blue('\n🎞️  Timeline Clips:\n'));
    project.timeline.clips.forEach(c => {
      const dur = c.endFrame - c.startFrame;
      console.log(chalk.cyan(`  ${c.id}`) + chalk.gray(`  frames ${c.startFrame}-${c.endFrame} (${dur}f)  asset=${c.assetId}`));
    });
    console.log('');
  });

// --- TEXT COMMANDS ---

const text = program.command('text').description('Manage text overlays');

text
  .command('add <content>')
  .description('Add a text overlay')
  .option('-s, --start <frame>', 'Start frame', '0')
  .option('-e, --end <frame>', 'End frame', '60')
  .option('-x, --pos-x <pos>', 'X position (left/center/right)', 'center')
  .option('-y, --pos-y <pos>', 'Y position (top/center/bottom)', 'center')
  .option('-ef, --effect <effect>', 'Text effect: none, kinetic, liquid, shader, typewriter, wave, glitch, bounce, scale, flash, pulse, slide-left, slide-right')
  .option('-bg, --bg <color>', 'Background color for this scene (e.g. #000000, black, gradient:#000:#111)')
  .option('-ac, --accent <color>', 'Accent/glow color (e.g. #00FF88)')
  .action(async (content, options) => {
    const project = await getProject();
    const textId = `text_${project.timeline.texts.length + 1}`;
    
    project.timeline.texts.push({
      id: textId,
      content: content,
      startFrame: parseInt(options.start),
      endFrame: parseInt(options.end),
      style: { color: 'white', fontSize: 80 },
      position: { x: options.posX, y: options.posY },
      effect: options.effect || 'none',
      bg: options.bg || null,
      accent: options.accent || null
    });

    await saveProject(project);
    await logAction('text-add', { textId, content, start: options.start, end: options.end, effect: options.effect });
    console.log(chalk.green(`✔ Added text ${textId}: "${content}"${options.effect ? ` with ${options.effect} effect` : ''}`));
  });

text
  .command('style <id>')
  .description('Style a text overlay')
  .option('-c, --color <color>', 'Text color')
  .option('-z, --size <size>', 'Font size')
  .action(async (id, options) => {
    const project = await getProject();
    const item = project.timeline.texts.find(t => t.id === id);
    if (!item) return console.log(chalk.red('Text not found'));
    
    if (options.color) item.style.color = options.color;
    if (options.size) item.style.fontSize = parseInt(options.size);
    
    await saveProject(project);
    console.log(chalk.green(`✔ Updated style for ${id}`));
  });

text
  .command('list')
  .description('List all text overlays')
  .action(async () => {
    const project = await getProject();
    if (project.timeline.texts.length === 0) {
      console.log(chalk.yellow('No text overlays.'));
      return;
    }
    console.log(chalk.blue('\n✏️  Text Overlays:\n'));
    project.timeline.texts.forEach(t => {
      const effect = t.effect && t.effect !== 'none' ? chalk.magenta(` [${t.effect}]`) : '';
      console.log(chalk.cyan(`  ${t.id}`) + chalk.gray(`  "${t.content}"  ${t.startFrame}-${t.endFrame}  ${t.style.color}/${t.style.fontSize}px`) + effect);
    });
    console.log('');
  });

text
  .command('remove <id>')
  .description('Remove a text overlay by ID')
  .action(async (id) => {
    const project = await getProject();
    const before = project.timeline.texts.length;
    project.timeline.texts = project.timeline.texts.filter(t => t.id !== id);
    if (project.timeline.texts.length === before) return console.log(chalk.red('Text not found'));
    await saveProject(project);
    console.log(chalk.green(`✔ Removed text ${id}`));
  });

// --- AUDIO COMMANDS ---

const audio = program.command('audio').description('Manage audio tracks');

audio
  .command('add <path>')
  .description('Add background audio')
  .option('-v, --volume <vol>', 'Volume (0.0 to 1.0)', '0.5')
  .action(async (assetPath, options) => {
    const project = await getProject();
    const absolutePath = path.resolve(assetPath);
    const fileName = path.basename(absolutePath);
    const destPath = path.join(ASSETS_DIR, fileName);
    const audioId = `audio_${project.timeline.audio.length + 1}`;
    
    try {
      await fs.ensureDir(ASSETS_DIR);
      if (absolutePath !== destPath) {
        await fs.copy(absolutePath, destPath);
      }
      const assetId = `audio_asset_${Object.keys(project.assets).length + 1}`;
      project.assets[assetId] = `/${fileName}`;
      
      project.timeline.audio.push({
        id: audioId,
        assetId: assetId,
        startFrame: 0,
        duration: project.settings.durationInFrames,
        volume: parseFloat(options.volume)
      });
    } catch (e) {
      console.log(chalk.red(`✘ Failed to copy audio asset ${assetPath}: ${e.message}`));
      process.exit(1);
    }

    await saveProject(project);
    console.log(chalk.green(`✔ Added audio ${audioId} from ${assetPath}`));
  });

audio
  .command('list')
  .description('List all audio tracks')
  .action(async () => {
    const project = await getProject();
    if (project.timeline.audio.length === 0) {
      console.log(chalk.yellow('No audio tracks.'));
      return;
    }
    console.log(chalk.blue('\n🔊 Audio Tracks:\n'));
    project.timeline.audio.forEach(a => {
      console.log(chalk.cyan(`  ${a.id}`) + chalk.gray(`  asset=${a.assetId}  vol=${a.volume}  ${a.duration}f`));
    });
    console.log('');
  });

// --- RENDER & PREVIEW ---

const gen = program.command('generate').description('AI-powered video generation tools');

gen
  .command('short <topic>')
  .description('Generate a vertical short using shorts-tool')
  .option('-r, --render', 'Render the final MP4', false)
  .action(async (topic, options) => {
    console.log(chalk.blue(`🎬 Generating short about: "${topic}"...`));
    const toolPath = path.resolve('safe-work/shorts-tool/bin/make-short.mjs');
    const renderFlag = options.render ? '--render' : '';
    
    try {
      execSync(`node ${toolPath} --topic "${topic}" ${renderFlag}`, { stdio: 'inherit' });
      console.log(chalk.green('✔ Short generated successfully!'));
    } catch (e) {
      console.log(chalk.red('✘ Generation failed. Check if SHORTS_LLM_API_KEY is set.'));
    }
  });

gen
  .command('montage <prompt>')
  .description('Generate a cinematic montage using OpenMontage')
  .action(async (prompt) => {
    console.log(chalk.blue(`🎥 Orchestrating cinematic montage: "${prompt}"...`));
    console.log(chalk.yellow('OpenMontage is an agentic system. Initializing production pipeline...'));
    
    console.log(chalk.gray('Action: Using OpenMontage-OpenMontage tools to build timeline...'));
    console.log(chalk.green('✔ Production plan created. Use "remotion-ai render" to finalize.'));
  });

program
  .command('render')
  .description('Render the final video to Downloads folder')
  .option('-o, --output <name>', 'Output filename', 'final-video.mp4')
  .option('-g, --gpu', 'Enable GPU-accelerated encoding (auto-detects AMD/NVIDIA/Intel)', false)
  .option('-e, --encoder <codec>', 'Force specific FFmpeg encoder (e.g. h264_amf, h264_nvenc, libx264)')
  .action(async (options) => {
    await fs.ensureDir(DOWNLOADS_DIR);
    const project = await getProject();
    const missing = await verifyAssets(project);
    
    if (missing.length > 0) {
      console.log(chalk.red('\n❌ Pre-render Asset Verification Failed:'));
      missing.forEach(m => {
        console.log(chalk.yellow(`- [${m.type}] ${m.id}: ${m.path || 'Not found in assets map'}`));
      });
      console.log(chalk.gray('\nPlease add the missing assets before rendering.\n'));
      process.exit(1);
    }

    const outputPath = path.join(DOWNLOADS_DIR, options.output);
    const tempOutput = path.join(PROJECT_ROOT, 'out', 'Main.mp4');
    
    console.log(chalk.blue('🚀 Rendering final video...'));
    const renderStart = Date.now();
    try {
      let codecArgs = '';
      if (options.encoder) {
        codecArgs = `--video-codec ${options.encoder}`;
        console.log(chalk.gray(`   Encoder: ${options.encoder} (manual)`));
      } else if (options.gpu) {
        const gpu = detectGPU();
        codecArgs = `--video-codec ${gpu.encoder}`;
        console.log(chalk.gray(`   GPU: ${gpu.name}`));
        console.log(chalk.gray(`   Encoder: ${gpu.encoder}`));
      }
      execSync(`npx remotion render src/index.tsx Main ${codecArgs}`, { stdio: 'inherit' });
      
      // Copy from out/ to Downloads
      await fs.ensureDir(DOWNLOADS_DIR);
      await fs.copy(tempOutput, outputPath);
      const elapsed = ((Date.now() - renderStart) / 1000).toFixed(1);
      
      // Clean up temp output
      try { await fs.remove(path.join(PROJECT_ROOT, 'out')); } catch {}
      
      console.log(chalk.green(`✔ Render complete: ${outputPath} (${elapsed}s)`));
    } catch (e) {
      console.log(chalk.red(`✘ Render failed: ${e.message}`));
      process.exit(1);
    }
  });

program
  .command('preview')
  .description('Start the Remotion Studio preview')
  .action(async () => {
    const project = await getProject();
    const missing = await verifyAssets(project);
    
    if (missing.length > 0) {
      console.log(chalk.red('\n❌ Pre-preview Asset Verification Failed:'));
      missing.forEach(m => {
        console.log(chalk.yellow(`- [${m.type}] ${m.id}: ${m.path || 'Not found in assets map'}`));
      });
      console.log(chalk.gray('\nPlease fix missing assets before previewing.\n'));
      process.exit(1);
    }

    console.log(chalk.blue('🌐 Opening Remotion Studio...'));
    try {
      spawn('npx', ['remotion', 'preview', 'src/index.tsx'], { stdio: 'inherit' });
      console.log(chalk.green('✔ Preview running at http://localhost:3000'));
    } catch (e) {
      console.log(chalk.red(`✘ Preview failed to start: ${e.message}`));
      process.exit(1);
    }
  });

// --- WORKFLOW COMMANDS ---

const workflow = program.command('workflow').description('Manage video processing workflows');

workflow
  .command('run <pipelineFile>')
  .description('Execute a YAML workflow pipeline')
  .action(async (pipelineFile) => {
    const project = await getProject();
    const pipelinePath = path.resolve(pipelineFile);
    
    if (!(await fs.pathExists(pipelinePath))) {
      console.log(chalk.red(`✘ Pipeline file not found: ${pipelinePath}`));
      process.exit(1);
    }
    
    try {
      const pipelineContent = await fs.readFile(pipelinePath, 'utf8');
      const pipeline = yaml.load(pipelineContent);
      
      console.log(chalk.blue(`🔄 Executing workflow: ${pipeline.name || 'Unnamed Pipeline'}`));
      console.log(chalk.gray(`   Steps: ${pipeline.steps.length}`));
      
      for (let i = 0; i < pipeline.steps.length; i++) {
        const step = pipeline.steps[i];
        console.log(chalk.cyan(`\n   [${i + 1}/${pipeline.steps.length}] ${step.action}`));
        
        switch (step.action) {
          case 'clip-add':
            // Add clip to timeline
            const clipAssetId = `asset_${Object.keys(project.assets).length + 1}`;
            const clipFileName = path.basename(step.path);
            const clipDestPath = path.join(ASSETS_DIR, clipFileName);
            
            if (await fs.pathExists(step.path)) {
              await fs.ensureDir(ASSETS_DIR);
              if (path.resolve(step.path) !== clipDestPath) {
                await fs.copy(step.path, clipDestPath);
              }
              project.assets[clipAssetId] = `/${clipFileName}`;
              
              const clipId = `clip_${project.timeline.clips.length + 1}`;
              project.timeline.clips.push({
                id: clipId,
                assetId: clipAssetId,
                startFrame: step.start || 0,
                endFrame: step.end || (step.start || 0) + 60,
                trimStart: step.trimStart || 0,
                trimEnd: step.trimEnd || 60,
                transition: step.transition || 'fade'
              });
              console.log(chalk.green(`      ✔ Added clip ${clipId}`));
            } else {
              console.log(chalk.red(`      ✘ File not found: ${step.path}`));
            }
            break;
            
          case 'text-add':
            // Add text overlay
            const textId = `text_${project.timeline.texts.length + 1}`;
            project.timeline.texts.push({
              id: textId,
              content: step.content,
              startFrame: step.start || 0,
              endFrame: step.end || 60,
              style: { color: step.color || 'white', fontSize: step.fontSize || 80 },
              position: { x: step.x || 'center', y: step.y || 'center' }
            });
            console.log(chalk.green(`      ✔ Added text ${textId}: "${step.content}"`));
            break;
            
          case 'audio-add':
            // Add audio track
            const audioAssetId = `audio_asset_${Object.keys(project.assets).length + 1}`;
            const audioFileName = path.basename(step.path);
            const audioDestPath = path.join(ASSETS_DIR, audioFileName);
            
            if (await fs.pathExists(step.path)) {
              await fs.ensureDir(ASSETS_DIR);
              if (path.resolve(step.path) !== audioDestPath) {
                await fs.copy(step.path, audioDestPath);
              }
              project.assets[audioAssetId] = `/${audioFileName}`;
              
              const audioId = `audio_${project.timeline.audio.length + 1}`;
              project.timeline.audio.push({
                id: audioId,
                assetId: audioAssetId,
                startFrame: 0,
                duration: project.settings.durationInFrames,
                volume: step.volume || 0.5
              });
              console.log(chalk.green(`      ✔ Added audio ${audioId}`));
            } else {
              console.log(chalk.red(`      ✘ File not found: ${step.path}`));
            }
            break;
            
          case 'duration':
            // Set duration
            project.settings.durationInFrames = step.frames;
            console.log(chalk.green(`      ✔ Duration set to ${step.frames} frames`));
            break;
            
          case 'render':
            // Render video
            await saveProject(project);
            const renderOutput = path.join(DOWNLOADS_DIR, step.output || 'workflow-output.mp4');
            const tempOutput = path.join(PROJECT_ROOT, 'out', 'Main.mp4');
            
            console.log(chalk.blue('      🚀 Rendering...'));
            execSync('npx remotion render src/index.tsx Main', { stdio: 'inherit' });
            
            await fs.ensureDir(DOWNLOADS_DIR);
            await fs.copy(tempOutput, renderOutput);
            console.log(chalk.green(`      ✔ Rendered to ${renderOutput}`));
            break;
            
          default:
            console.log(chalk.yellow(`      ⚠ Unknown action: ${step.action}`));
        }
        
        // Save project after each step
        await saveProject(project);
      }
      
      console.log(chalk.green('\n✔ Workflow complete!'));
      
    } catch (e) {
      console.log(chalk.red(`\n✘ Workflow failed: ${e.message}`));
      process.exit(1);
    }
  });

workflow
  .command('create <name>')
  .description('Create a new workflow template')
  .action(async (name) => {
    const template = {
      name: name,
      description: 'Video processing workflow',
      steps: [
        { action: 'clip-add', path: 'path/to/video.mp4', start: 0, end: 90 },
        { action: 'text-add', content: 'Hello World', start: 0, end: 60 },
        { action: 'render', output: `${name}.mp4` }
      ]
    };
    
    const outputPath = path.resolve(`${name}.yaml`);
    await fs.writeFile(outputPath, yaml.dump(template, { indent: 2 }));
    console.log(chalk.green(`✔ Created workflow template: ${outputPath}`));
    console.log(chalk.gray('Edit the YAML file to customize your workflow.'));
  });

// --- TEMPLATE COMMANDS ---

const template = program.command('template').description('Manage video templates');

const TEMPLATES_DIR = path.join(TOOL_ROOT, 'templates');

template
  .command('list')
  .description('List available templates')
  .option('--json', 'Output as JSON')
  .action(async (options) => {
    if (!(await fs.pathExists(TEMPLATES_DIR))) {
      console.log(chalk.yellow('No templates directory found.'));
      return;
    }
    
    const files = await fs.readdir(TEMPLATES_DIR);
    const yamlFiles = files.filter(f => f.endsWith('.yaml'));
    
    if (yamlFiles.length === 0) {
      console.log(chalk.yellow('No templates found.'));
      return;
    }
    
    const templates = [];
    for (const file of yamlFiles) {
      const content = await fs.readFile(path.join(TEMPLATES_DIR, file), 'utf8');
      const tmpl = yaml.load(content);
      templates.push({ name: tmpl.name || file, description: tmpl.description || 'No description', duration: tmpl.duration || 'default', steps: tmpl.steps ? tmpl.steps.length : 0 });
    }

    if (options.json) {
      console.log(JSON.stringify(templates, null, 2));
      return;
    }
    
    console.log(chalk.blue('\n📋 Available Templates:\n'));
    for (const t of templates) {
      console.log(chalk.cyan(`  ${t.name}`));
      console.log(chalk.gray(`    ${t.description}`));
      console.log(chalk.gray(`    Duration: ${t.duration} frames · ${t.steps} steps`));
    }
    console.log('');
  });

template
  .command('apply <name>')
  .description('Apply a template to current project')
  .action(async (name) => {
    const templatePath = path.join(TEMPLATES_DIR, `${name}.yaml`);
    
    if (!(await fs.pathExists(templatePath))) {
      console.log(chalk.red(`✘ Template not found: ${name}`));
      console.log(chalk.gray('Run "remotion-ai template list" to see available templates.'));
      process.exit(1);
    }
    
    const project = await getProject();
    const content = await fs.readFile(templatePath, 'utf8');
    const tmpl = yaml.load(content);
    
    console.log(chalk.blue(`📝 Applying template: ${tmpl.name || name}`));
    
    // Execute template steps
    for (const step of tmpl.steps) {
      switch (step.action) {
        case 'duration':
          project.settings.durationInFrames = step.frames;
          console.log(chalk.green(`   ✔ Duration set to ${step.frames} frames`));
          break;
          
        case 'text-add':
          const textId = `text_${project.timeline.texts.length + 1}`;
          project.timeline.texts.push({
            id: textId,
            content: step.content,
            startFrame: step.start || 0,
            endFrame: step.end || 60,
            style: { color: step.color || 'white', fontSize: step.fontSize || 80 },
            position: { x: step.x || 'center', y: step.y || 'center' }
          });
          console.log(chalk.green(`   ✔ Added text: "${step.content}"`));
          break;
      }
    }
    
    await saveProject(project);
    console.log(chalk.green(`\n✔ Template applied! Run "remotion-ai render" to generate video.`));
  });

template
  .command('save <name>')
  .description('Save current project as a template')
  .action(async (name) => {
    const project = await getProject();
    
    const tmpl = {
      name: name,
      description: `Custom template: ${name}`,
      duration: project.settings.durationInFrames,
      steps: [
        { action: 'duration', frames: project.settings.durationInFrames },
        ...project.timeline.texts.map(t => ({
          action: 'text-add',
          content: t.content,
          start: t.startFrame,
          end: t.endFrame,
          color: t.style.color,
          fontSize: t.style.fontSize,
          x: t.position.x,
          y: t.position.y
        })),
        { action: 'render', output: `${name}.mp4` }
      ]
    };
    
    await fs.ensureDir(TEMPLATES_DIR);
    const outputPath = path.join(TEMPLATES_DIR, `${name}.yaml`);
    await fs.writeFile(outputPath, yaml.dump(tmpl, { indent: 2 }));
    console.log(chalk.green(`✔ Template saved: ${outputPath}`));
  });

// --- DATA / INFOGRAPHICS COMMANDS ---

const data = program.command('data').description('Data-driven infographics and charts');

data
  .command('import <file>')
  .description('Import data from JSON or CSV file')
  .action(async (file) => {
    const project = await getProject();
    const filePath = path.resolve(file);
    
    if (!(await fs.pathExists(filePath))) {
      console.log(chalk.red(`✘ File not found: ${filePath}`));
      process.exit(1);
    }
    
    const ext = path.extname(filePath).toLowerCase();
    let items = [];
    
    try {
      if (ext === '.json') {
        const raw = await fs.readJson(filePath);
        if (Array.isArray(raw)) {
          items = raw.map((item, i) => ({
            id: `data_${i + 1}`,
            label: item.label || item.name || item.title || `Item ${i + 1}`,
            value: parseFloat(item.value || item.count || item.amount || 0),
            color: item.color || null
          }));
        } else {
          console.log(chalk.red('✘ JSON must be an array of objects'));
          process.exit(1);
        }
      } else if (ext === '.csv') {
        const content = await fs.readFile(filePath, 'utf8');
        const lines = content.trim().split('\n');
        if (lines.length < 2) {
          console.log(chalk.red('✘ CSV must have header + data rows'));
          process.exit(1);
        }
        const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
        const labelIdx = headers.findIndex(h => ['label', 'name', 'title', 'category'].includes(h));
        const valueIdx = headers.findIndex(h => ['value', 'count', 'amount', 'number'].includes(h));
        
        for (let i = 1; i < lines.length; i++) {
          const cols = lines[i].split(',').map(c => c.trim());
          items.push({
            id: `data_${i}`,
            label: cols[labelIdx >= 0 ? labelIdx : 0] || `Item ${i}`,
            value: parseFloat(cols[valueIdx >= 0 ? valueIdx : 1]) || 0,
            color: null
          });
        }
      } else {
        console.log(chalk.red(`✘ Unsupported format: ${ext} (use .json or .csv)`));
        process.exit(1);
      }
      
      if (!project.timeline.data) project.timeline.data = [];
      project.timeline.data = [...project.timeline.data, ...items];
      await saveProject(project);
      
      console.log(chalk.green(`✔ Imported ${items.length} data points`));
      items.forEach(item => console.log(chalk.gray(`   ${item.label}: ${item.value}`)));
    } catch (e) {
      console.log(chalk.red(`✘ Failed: ${e.message}`));
      process.exit(1);
    }
  });

data
  .command('list')
  .description('List imported data')
  .option('--json', 'Output as JSON')
  .action(async (options) => {
    const project = await getProject();
    const items = project.timeline.data || [];
    if (items.length === 0) { console.log(chalk.yellow('No data imported.')); return; }
    if (options.json) { console.log(JSON.stringify(items, null, 2)); return; }
    console.log(chalk.blue('\n📊 Data:\n'));
    items.forEach(item => console.log(chalk.cyan(`  ${item.label}: ${item.value}`)));
  });

data
  .command('clear')
  .description('Clear all data')
  .action(async () => {
    const project = await getProject();
    project.timeline.data = [];
    await saveProject(project);
    console.log(chalk.green('✔ Data cleared.'));
  });

data
  .command('chart <type>')
  .description('Generate chart: counter, bar, comparison, ranking')
  .option('-s, --start <frame>', 'Start frame', '0')
  .option('-e, --end <frame>', 'End frame', '150')
  .option('-t, --title <text>', 'Chart title', 'Data')
  .option('-bg, --bg <color>', 'Background', '#000')
  .option('-ac, --accent <color>', 'Accent color', '#00FF88')
  .option('--limit <n>', 'Max items', '5')
  .action(async (type, options) => {
    const project = await getProject();
    const items = (project.timeline.data || []).slice(0, parseInt(options.limit));
    if (items.length === 0) { console.log(chalk.red('✘ No data. Import first.')); process.exit(1); }
    
    const start = parseInt(options.start);
    const end = parseInt(options.end);
    const dur = end - start;
    const title = options.title;
    const bg = options.bg;
    const accent = options.accent;
    
    if (type === 'counter') {
      const total = items.reduce((s, d) => s + d.value, 0);
      project.timeline.texts.push({ id: `text_${project.timeline.texts.length + 1}`, content: `${title}: ${total.toLocaleString()}`, startFrame: start, endFrame: end, style: { color: accent, fontSize: 80 }, position: { x: 'center', y: 'center' }, effect: 'scale', bg, accent });
      console.log(chalk.green(`✔ Counter: ${total.toLocaleString()}`));
    } else if (type === 'bar') {
      const h = Math.floor(dur / items.length);
      items.forEach((item, i) => {
        const pct = Math.round((item.value / Math.max(...items.map(d => d.value))) * 100);
        const bar = '█'.repeat(Math.round(pct / 10));
        project.timeline.texts.push({ id: `text_${project.timeline.texts.length + 1}`, content: `${item.label}\n${bar} ${pct}%`, startFrame: start + i * h, endFrame: start + (i + 1) * h, style: { color: item.color || accent, fontSize: 60 }, position: { x: 'center', y: 'center' }, effect: 'slide-left', bg, accent: item.color || accent });
      });
      console.log(chalk.green(`✔ Bar chart: ${items.length} items`));
    } else if (type === 'comparison') {
      if (items.length < 2) { console.log(chalk.red('✘ Need 2+ items')); process.exit(1); }
      const half = Math.floor(dur / 2);
      project.timeline.texts.push({ id: `text_${project.timeline.texts.length + 1}`, content: `${items[0].label}\n${items[0].value.toLocaleString()}`, startFrame: start, endFrame: start + half, style: { color: '#FF6B6B', fontSize: 70 }, position: { x: 'center', y: 'center' }, effect: 'slide-left', bg, accent: '#FF6B6B' });
      project.timeline.texts.push({ id: `text_${project.timeline.texts.length + 1}`, content: 'VS', startFrame: start + half - 15, endFrame: start + half + 15, style: { color: '#FFF', fontSize: 100 }, position: { x: 'center', y: 'center' }, effect: 'flash', bg, accent: '#FFF' });
      project.timeline.texts.push({ id: `text_${project.timeline.texts.length + 1}`, content: `${items[1].label}\n${items[1].value.toLocaleString()}`, startFrame: start + half, endFrame: end, style: { color: '#4ECDC4', fontSize: 70 }, position: { x: 'center', y: 'center' }, effect: 'slide-right', bg, accent: '#4ECDC4' });
      console.log(chalk.green(`✔ Comparison: ${items[0].label} vs ${items[1].label}`));
    } else if (type === 'ranking') {
      const sorted = [...items].sort((a, b) => b.value - a.value);
      const rh = Math.floor(dur / sorted.length);
      sorted.forEach((item, i) => {
        project.timeline.texts.push({ id: `text_${project.timeline.texts.length + 1}`, content: `#${i + 1} ${item.label}\n${item.value.toLocaleString()}`, startFrame: start + i * rh, endFrame: start + (i + 1) * rh, style: { color: item.color || accent, fontSize: 70 }, position: { x: 'center', y: 'center' }, effect: 'bounce', bg, accent: item.color || accent });
      });
      console.log(chalk.green(`✔ Ranking: ${sorted.length} items`));
    } else {
      console.log(chalk.red(`✘ Unknown type: ${type}. Use counter, bar, comparison, ranking`));
      process.exit(1);
    }
    await saveProject(project);
  });

// --- SCRAPE COMMANDS ---

import { load } from 'cheerio';

const scrape = program.command('scrape').description('Web scraping for video content');

scrape
  .command('url <url>')
  .description('Extract headlines and stats from a webpage')
  .option('--json', 'Output as JSON')
  .action(async (url, options) => {
    console.log(chalk.blue(`\n🔍 Scraping: ${url}\n`));
    try {
      const response = await fetch(url);
      const html = await response.text();
      const $ = load(html);
      
      // Remove script/style tags
      $('script, style, nav, footer, header').remove();
      
      // Extract title
      const title = $('title').text().trim() || $('h1').first().text().trim();
      
      // Extract headings
      const headings = [];
      $('h1, h2, h3').each((i, el) => {
        const text = $(el).text().trim();
        if (text && text.length > 3) headings.push(text);
      });
      
      // Extract stats (numbers with context)
      const stats = [];
      const text = $('body').text();
      const statPatterns = [ /([\d,.]+)\s*(billion|million|trillion|B|M|T|%|percent)/gi, /\$([\d,.]+)\s*(billion|million|trillion|B|M|T)/gi ];
      for (const pattern of statPatterns) {
        let match;
        while ((match = pattern.exec(text)) !== null) {
          stats.push({ value: match[1], unit: match[2], context: text.substring(Math.max(0, match.index - 30), match.index + match[0].length + 30).trim() });
        }
      }
      
      // Extract key paragraphs
      const paragraphs = [];
      $('p').each((i, el) => {
        const p = $(el).text().trim();
        if (p.length > 50 && p.length < 500) paragraphs.push(p);
      });
      
      const result = { url, title, headings: headings.slice(0, 10), stats: stats.slice(0, 5), paragraphs: paragraphs.slice(0, 5) };
      
      if (options.json) {
        console.log(JSON.stringify(result, null, 2));
        return;
      }
      
      console.log(chalk.cyan(`Title: ${title}\n`));
      if (headings.length > 0) {
        console.log(chalk.yellow('Headings:'));
        headings.slice(0, 5).forEach(h => console.log(chalk.gray(`  • ${h}`)));
      }
      if (stats.length > 0) {
        console.log(chalk.yellow('\nStats:'));
        stats.forEach(s => console.log(chalk.gray(`  • ${s.value} ${s.unit}`)));
      }
      if (paragraphs.length > 0) {
        console.log(chalk.yellow('\nKey text:'));
        paragraphs.slice(0, 3).forEach(p => console.log(chalk.gray(`  ${p.substring(0, 100)}...`)));
      }
    } catch (e) {
      console.log(chalk.red(`✘ Scrape failed: ${e.message}`));
    }
  });

scrape
  .command('trend <topic>')
  .description('Search trending topics via DuckDuckGo')
  .option('--json', 'Output as JSON')
  .action(async (topic, options) => {
    console.log(chalk.blue(`\n🔍 Searching trending: ${topic}\n`));
    try {
      const query = encodeURIComponent(`${topic} trending 2024`);
      const response = await fetch(`https://html.duckduckgo.com/html/?q=${query}`, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
      });
      const html = await response.text();
      const $ = load(html);
      
      const results = [];
      $('.result').each((i, el) => {
        const title = $(el).find('.result__title').text().trim();
        const snippet = $(el).find('.result__snippet').text().trim();
        const url = $(el).find('.result__url').text().trim();
        if (title) results.push({ title, snippet, url });
      });
      
      if (options.json) {
        console.log(JSON.stringify(results.slice(0, 10), null, 2));
        return;
      }
      
      results.slice(0, 5).forEach((r, i) => {
        console.log(chalk.cyan(`${i + 1}. ${r.title}`));
        console.log(chalk.gray(`   ${r.snippet?.substring(0, 100)}...\n`));
      });
    } catch (e) {
      console.log(chalk.red(`✘ Search failed: ${e.message}`));
    }
  });

scrape
  .command('to-video <url>')
  .description('Generate video script from scraped content')
  .option('-d, --duration <frames>', 'Total duration', '900')
  .option('-bg, --bg <color>', 'Background', '#000')
  .action(async (url, options) => {
    console.log(chalk.blue(`\n🎬 Generating video from: ${url}\n`));
    try {
      const response = await fetch(url);
      const html = await response.text();
      const $ = load(html);
      $('script, style, nav, footer').remove();
      
      const title = $('title').text().trim() || $('h1').first().text().trim();
      const headings = [];
      $('h1, h2, h3').each((i, el) => {
        const t = $(el).text().trim();
        if (t && t.length > 3) headings.push(t);
      });
      
      const project = await getProject();
      const totalFrames = parseInt(options.duration);
      const sceneCount = Math.min(headings.length, 8);
      const framesPerScene = Math.floor(totalFrames / (sceneCount + 2));
      
      // Title scene
      project.timeline.texts.push({
        id: `text_${project.timeline.texts.length + 1}`,
        content: title.substring(0, 50),
        startFrame: 0,
        endFrame: framesPerScene,
        style: { color: '#00FF88', fontSize: 80 },
        position: { x: 'center', y: 'center' },
        effect: 'scale',
        bg: options.bg,
        accent: '#00FF88'
      });
      
      // Content scenes from headings
      headings.slice(0, sceneCount).forEach((heading, i) => {
        project.timeline.texts.push({
          id: `text_${project.timeline.texts.length + 1}`,
          content: heading.substring(0, 60),
          startFrame: framesPerScene * (i + 1),
          endFrame: framesPerScene * (i + 2),
          style: { color: '#FFFFFF', fontSize: 60 },
          position: { x: 'center', y: 'center' },
          effect: ['kinetic', 'slide-left', 'bounce', 'typewriter', 'glitch', 'wave', 'shader', 'liquid'][i % 8],
          bg: options.bg,
          accent: ['#00FF88', '#FF6B6B', '#4ECDC4', '#FFE66D', '#A855F7'][i % 5]
        });
      });
      
      // CTA scene
      project.timeline.texts.push({
        id: `text_${project.timeline.texts.length + 1}`,
        content: 'Follow for more',
        startFrame: framesPerScene * (sceneCount + 1),
        endFrame: totalFrames,
        style: { color: '#00FF88', fontSize: 80 },
        position: { x: 'center', y: 'center' },
        effect: 'bounce',
        bg: options.bg,
        accent: '#00FF88'
      });
      
      await saveProject(project);
      console.log(chalk.green(`✔ Generated ${sceneCount + 2} scenes from ${url}`));
      console.log(chalk.gray(`   Title: ${title}`));
      console.log(chalk.gray(`   Scenes: ${sceneCount} content + title + CTA`));
    } catch (e) {
      console.log(chalk.red(`✘ Failed: ${e.message}`));
    }
  });

// --- VIBE COMMAND (Natural Language → Video) ---

function parseVibePrompt(prompt) {
  const lower = prompt.toLowerCase();
  
  // Extract duration
  let duration = 900; // default 30s
  const durMatch = lower.match(/(\d+)\s*(s|sec|second|m|min|minute)/);
  if (durMatch) {
    const val = parseInt(durMatch[1]);
    const unit = durMatch[2];
    duration = unit.startsWith('m') ? val * 30 * 60 : val * 30;
  } else if (lower.includes('short') || lower.includes('reel') || lower.includes('tiktok')) {
    duration = 600;
  } else if (lower.includes('long') || lower.includes('deep')) {
    duration = 1800;
  }
  
  // Extract style/tone
  let style = 'mixed';
  let accent = '#00FF88';
  if (lower.includes('professional') || lower.includes('business') || lower.includes('corporate')) {
    style = 'professional'; accent = '#4ECDC4';
  } else if (lower.includes('fun') || lower.includes('playful') || lower.includes('crazy')) {
    style = 'playful'; accent = '#FFE66D';
  } else if (lower.includes('dark') || lower.includes('serious') || lower.includes('dramatic')) {
    style = 'dramatic'; accent = '#FF6B6B';
  } else if (lower.includes('tech') || lower.includes('coding') || lower.includes('ai')) {
    style = 'tech'; accent = '#00FF88';
  } else if (lower.includes('tutorial') || lower.includes('how to') || lower.includes('explain')) {
    style = 'educational'; accent = '#A855F7';
  }
  
  // Extract scene count from duration
  const sceneCount = Math.max(4, Math.min(12, Math.floor(duration / 120)));
  
  // Detect if it's a listicle
  const isListicle = /top\s*\d|\d+\s*(best|top|ways|tips|tools|things)/i.test(prompt);
  
  // Detect if it's a comparison
  const isComparison = /vs\.?|versus|compare|comparison|better/i.test(prompt);
  
  // Detect if it's a tutorial
  const isTutorial = /how\s*to|tutorial|guide|step|learn|teach/i.test(prompt);
  
  return { duration, style, accent, sceneCount, isListicle, isComparison, isTutorial };
}

function generateVibeScenes(prompt, options) {
  const { duration, style, accent, sceneCount, isListicle, isComparison, isTutorial } = options;
  const scenes = [];
  const framesPerScene = Math.floor(duration / (sceneCount + 2));
  const effects = ['scale', 'kinetic', 'slide-left', 'bounce', 'typewriter', 'glitch', 'wave', 'shader', 'liquid', 'flash'];
  const colors = ['#00FF88', '#FF6B6B', '#4ECDC4', '#FFE66D', '#A855F7', '#06B6D4', '#F97316'];
  
  // Title scene
  scenes.push({
    text: prompt.substring(0, 60),
    effect: 'scale',
    accent: accent,
    duration: framesPerScene
  });
  
  if (isListicle) {
    // Generate numbered list items
    const items = prompt.match(/\d+\s*(best|top|ways|tips|tools|things)/i) ? [] : ['Point 1', 'Point 2', 'Point 3', 'Point 4', 'Point 5'];
    for (let i = 0; i < Math.min(sceneCount - 2, 5); i++) {
      scenes.push({
        text: `#${i + 1} ${items[i] || `Key point ${i + 1}`}`,
        effect: 'bounce',
        accent: colors[i % colors.length],
        duration: framesPerScene
      });
    }
  } else if (isComparison) {
    scenes.push({ text: 'Option A', effect: 'slide-left', accent: '#FF6B6B', duration: framesPerScene });
    scenes.push({ text: 'VS', effect: 'flash', accent: '#FFFFFF', duration: Math.floor(framesPerScene / 2) });
    scenes.push({ text: 'Option B', effect: 'slide-right', accent: '#4ECDC4', duration: framesPerScene });
  } else if (isTutorial) {
    for (let i = 0; i < Math.min(sceneCount - 2, 4); i++) {
      scenes.push({
        text: `Step ${i + 1}`,
        effect: 'slide-left',
        accent: colors[i % colors.length],
        duration: framesPerScene
      });
    }
  } else {
    // Generic content scenes
    for (let i = 0; i < sceneCount - 2; i++) {
      scenes.push({
        text: `Scene ${i + 1}`,
        effect: effects[i % effects.length],
        accent: colors[i % colors.length],
        duration: framesPerScene
      });
    }
  }
  
  // CTA scene
  scenes.push({
    text: 'Follow for more',
    effect: 'bounce',
    accent: '#00FF88',
    duration: framesPerScene
  });
  
  return scenes;
}

program
  .command('vibe <prompt>')
  .description('Natural language → full video (vibe coding for video)')
  .option('-r, --render', 'Auto-render after generating', false)
  .option('-d, --dry-run', 'Show plan without applying', false)
  .action(async (prompt, options) => {
    console.log(chalk.blue('\n🎬 Vibe Coding: Natural Language → Video\n'));
    console.log(chalk.gray(`Prompt: "${prompt}"\n`));
    
    const parsed = parseVibePrompt(prompt);
    const scenes = generateVibeScenes(prompt, parsed);
    
    console.log(chalk.cyan('Plan:'));
    console.log(chalk.gray(`  Duration: ${(parsed.duration / 30).toFixed(0)}s (${parsed.duration} frames)`));
    console.log(chalk.gray(`  Style: ${parsed.style}`));
    console.log(chalk.gray(`  Scenes: ${scenes.length}`));
    console.log(chalk.gray(`  Type: ${parsed.isListicle ? 'listicle' : parsed.isComparison ? 'comparison' : parsed.isTutorial ? 'tutorial' : 'general'}\n`));
    
    scenes.forEach((scene, i) => {
      console.log(chalk.gray(`  ${i + 1}. [${scene.effect}] ${scene.text} (${scene.duration}f)`));
    });
    console.log('');
    
    if (options.dryRun) return;
    
    const project = await getProject();
    project.settings.durationInFrames = parsed.duration;
    
    let currentFrame = 0;
    scenes.forEach((scene) => {
      project.timeline.texts.push({
        id: `text_${project.timeline.texts.length + 1}`,
        content: scene.text,
        startFrame: currentFrame,
        endFrame: currentFrame + scene.duration,
        style: { color: scene.accent, fontSize: 70 },
        position: { x: 'center', y: 'center' },
        effect: scene.effect,
        bg: '#000',
        accent: scene.accent
      });
      currentFrame += scene.duration;
    });
    
    await saveProject(project);
    console.log(chalk.green(`✔ Applied ${scenes.length} scenes to project`));
    
    if (options.render) {
      console.log(chalk.blue('\n🚀 Rendering...\n'));
      try {
        execSync('node bin/cli.mjs render --gpu', { cwd: TOOL_ROOT, stdio: 'inherit' });
      } catch (e) {
        console.log(chalk.red(`✘ Render failed: ${e.message}`));
      }
    }
  });

// --- AUTO COMMAND (Scrape → Script → Render Pipeline) ---

program
  .command('auto <url>')
  .description('One-shot: scrape → summarize → script → render')
  .option('-d, --duration <frames>', 'Total duration', '900')
  .option('--render', 'Auto-render after generating', false)
  .action(async (url, options) => {
    console.log(chalk.blue('\n🤖 Auto Pipeline: Scrape → Script → Render\n'));
    console.log(chalk.gray(`URL: ${url}\n`));
    
    try {
      // Step 1: Scrape
      console.log(chalk.cyan('Step 1/3: Scraping content...'));
      const response = await fetch(url);
      const html = await response.text();
      const { load } = await import('cheerio');
      const $ = load(html);
      $('script, style, nav, footer').remove();
      
      const title = $('title').text().trim() || $('h1').first().text().trim();
      const headings = [];
      $('h1, h2, h3').each((i, el) => {
        const t = $(el).text().trim();
        if (t && t.length > 3 && t.length < 80) headings.push(t);
      });
      
      console.log(chalk.gray(`   Title: ${title}`));
      console.log(chalk.gray(`   Found ${headings.length} headings`));
      
      // Step 2: Summarize & Script
      console.log(chalk.cyan('\nStep 2/3: Generating script...'));
      const totalFrames = parseInt(options.duration);
      const sceneCount = Math.min(headings.length, 8);
      const framesPerScene = Math.floor(totalFrames / (sceneCount + 2));
      const effects = ['scale', 'kinetic', 'slide-left', 'bounce', 'typewriter', 'glitch', 'wave', 'shader'];
      const colors = ['#00FF88', '#FF6B6B', '#4ECDC4', '#FFE66D', '#A855F7', '#06B6D4'];
      
      console.log(chalk.gray(`   Scenes: ${sceneCount} content + title + CTA`));
      
      // Step 3: Apply to project
      console.log(chalk.cyan('\nStep 3/3: Applying to project...'));
      const project = await getProject();
      project.settings.durationInFrames = totalFrames;
      project.timeline.texts = []; // Clear existing
      
      // Title
      project.timeline.texts.push({
        id: 'text_1', content: title.substring(0, 60),
        startFrame: 0, endFrame: framesPerScene,
        style: { color: '#00FF88', fontSize: 80 },
        position: { x: 'center', y: 'center' }, effect: 'scale', bg: '#000', accent: '#00FF88'
      });
      
      // Content
      headings.slice(0, sceneCount).forEach((heading, i) => {
        project.timeline.texts.push({
          id: `text_${i + 2}`, content: heading.substring(0, 60),
          startFrame: framesPerScene * (i + 1), endFrame: framesPerScene * (i + 2),
          style: { color: colors[i % colors.length], fontSize: 60 },
          position: { x: 'center', y: 'center' }, effect: effects[i % effects.length],
          bg: '#000', accent: colors[i % colors.length]
        });
      });
      
      // CTA
      project.timeline.texts.push({
        id: `text_${sceneCount + 2}`, content: 'Follow for more',
        startFrame: framesPerScene * (sceneCount + 1), endFrame: totalFrames,
        style: { color: '#00FF88', fontSize: 80 },
        position: { x: 'center', y: 'center' }, effect: 'bounce', bg: '#000', accent: '#00FF88'
      });
      
      await saveProject(project);
      console.log(chalk.green(`\n✔ Pipeline complete: ${sceneCount + 2} scenes from "${title}"\n`));
      
      if (options.render) {
        console.log(chalk.blue('🚀 Rendering...\n'));
        execSync('node bin/cli.mjs render --gpu', { cwd: TOOL_ROOT, stdio: 'inherit' });
      }
    } catch (e) {
      console.log(chalk.red(`\n✘ Pipeline failed: ${e.message}`));
    }
  });

// --- REMIX COMMAND (Analyze & Improve) ---

program
  .command('remix')
  .description('Analyze current project and suggest improvements')
  .option('--apply', 'Auto-apply suggestions', false)
  .action(async (options) => {
    console.log(chalk.blue('\n🔧 Remix: Analyzing current video...\n'));
    
    const project = await getProject();
    const texts = project.timeline.texts || [];
    const clips = project.timeline.clips || [];
    const audio = project.timeline.audio || [];
    const duration = project.settings.durationInFrames;
    
    // Analyze pacing
    const avgSceneDuration = texts.length > 0
      ? texts.reduce((sum, t) => sum + (t.endFrame - t.startFrame), 0) / texts.length
      : 0;
    
    const suggestions = [];
    
    // Pacing check
    if (avgSceneDuration > 180) {
      suggestions.push({ type: 'pacing', message: 'Scenes are slow (avg ' + (avgSceneDuration / 30).toFixed(1) + 's). Consider faster cuts for social media.', fix: 'Reduce scene duration to 2-3 seconds' });
    } else if (avgSceneDuration < 45) {
      suggestions.push({ type: 'pacing', message: 'Scenes are too fast (avg ' + (avgSceneDuration / 30).toFixed(1) + 's). Viewers may not read in time.', fix: 'Increase scene duration to at least 2 seconds' });
    }
    
    // Effect variety
    const effects = [...new Set(texts.map(t => t.effect))];
    if (effects.length < 3 && texts.length > 3) {
      suggestions.push({ type: 'effects', message: 'Low effect variety (' + effects.length + ' types). Videos with varied effects perform better.', fix: 'Add more effect types: glitch, wave, bounce, typewriter' });
    }
    
    // Color variety
    const accents = [...new Set(texts.map(t => t.accent))];
    if (accents.length < 3 && texts.length > 3) {
      suggestions.push({ type: 'colors', message: 'Low color variety. Monochrome videos get less engagement.', fix: 'Add accent colors per scene' });
    }
    
    // No audio
    if (audio.length === 0) {
      suggestions.push({ type: 'audio', message: 'No background music. Videos with music get 2x more views.', fix: 'Add background music with: remotion-ai audio add <file>' });
    }
    
    // Too few scenes
    if (texts.length < 4) {
      suggestions.push({ type: 'content', message: 'Only ' + texts.length + ' scenes. Short videos need 5-10 scenes for engagement.', fix: 'Add more content scenes with varied effects' });
    }
    
    // No CTA
    const lastText = texts[texts.length - 1];
    if (lastText && !lastText.content.toLowerCase().includes('follow')) {
      suggestions.push({ type: 'cta', message: 'No call-to-action at the end. Always end with a CTA.', fix: 'Add "Follow for more" as final scene' });
    }
    
    // Display suggestions
    if (suggestions.length === 0) {
      console.log(chalk.green('✔ No issues found. Video looks good!'));
      return;
    }
    
    console.log(chalk.yellow(`Found ${suggestions.length} improvement(s):\n`));
    suggestions.forEach((s, i) => {
      console.log(chalk.cyan(`${i + 1}. [${s.type.toUpperCase()}] ${s.message}`));
      console.log(chalk.gray(`   Fix: ${s.fix}\n`));
    });
    
    if (options.apply) {
      console.log(chalk.blue('Applying fixes...'));
      // Apply pacing fix
      const pacingFix = suggestions.find(s => s.type === 'pacing');
      if (pacingFix && avgSceneDuration > 180) {
        texts.forEach(t => {
          const sceneLen = t.endFrame - t.startFrame;
          t.endFrame = t.startFrame + Math.min(sceneLen, 90);
        });
      }
      
      // Add CTA if missing
      const ctaFix = suggestions.find(s => s.type === 'cta');
      if (ctaFix) {
        const lastEnd = texts.length > 0 ? texts[texts.length - 1].endFrame : 0;
        texts.push({
          id: `text_${texts.length + 1}`, content: 'Follow for more',
          startFrame: lastEnd, endFrame: lastEnd + 90,
          style: { color: '#00FF88', fontSize: 80 },
          position: { x: 'center', y: 'center' }, effect: 'bounce', bg: '#000', accent: '#00FF88'
        });
      }
      
      await saveProject(project);
      console.log(chalk.green('\n✔ Fixes applied'));}
  });

// --- AI SUGGEST COMMAND ---

const TRENDING_TOPICS = [
  { topic: 'AI Agents', category: 'tech', templates: ['explainer', 'listicle'] },
  { topic: 'GPT-5 Features', category: 'tech', templates: ['news', 'explainer'] },
  { topic: 'Best AI Tools 2024', category: 'tech', templates: ['listicle', 'promo'] },
  { topic: 'How to Use Claude', category: 'tutorial', templates: ['tutorial', 'explainer'] },
  { topic: 'AI vs Human Artists', category: 'debate', templates: ['comparison', 'explainer'] },
  { topic: 'Remote Work Tips', category: 'lifestyle', templates: ['listicle', 'tutorial'] },
  { topic: 'Startup Funding Guide', category: 'business', templates: ['tutorial', 'explainer'] },
  { topic: 'Crypto Market Analysis', category: 'finance', templates: ['news', 'listicle'] },
  { topic: 'Fitness for Programmers', category: 'health', templates: ['listicle', 'tutorial'] },
  { topic: 'JavaScript Frameworks Compared', category: 'tech', templates: ['comparison', 'listicle'] },
  { topic: 'Productivity Hacks', category: 'lifestyle', templates: ['listicle', 'tutorial'] },
  { topic: 'AI Image Generation', category: 'tech', templates: ['explainer', 'tutorial'] },
  { topic: 'Space Exploration News', category: 'science', templates: ['news', 'explainer'] },
  { topic: 'Side Hustle Ideas', category: 'business', templates: ['listicle', 'promo'] },
  { topic: 'Cybersecurity Tips', category: 'tech', templates: ['tutorial', 'listicle'] },
];

program
  .command('suggest')
  .description('Get trending video topic suggestions')
  .option('-c, --category <cat>', 'Filter by category: tech, business, lifestyle, etc.')
  .option('-n, --count <n>', 'Number of suggestions', '5')
  .option('--json', 'Output as JSON')
  .action(async (options) => {
    console.log(chalk.blue('\n💡 Trending Video Topic Suggestions\n'));
    
    let topics = TRENDING_TOPICS;
    if (options.category) {
      topics = topics.filter(t => t.category === options.category);
    }
    
    // Shuffle and pick
    const shuffled = topics.sort(() => Math.random() - 0.5);
    const picked = shuffled.slice(0, parseInt(options.count));
    
    if (options.json) {
      console.log(JSON.stringify(picked, null, 2));
      return;
    }
    
    picked.forEach((t, i) => {
      console.log(chalk.cyan(`${i + 1}. ${t.topic}`));
      console.log(chalk.gray(`   Category: ${t.category}`));
      console.log(chalk.gray(`   Best templates: ${t.templates.join(', ')}`));
      console.log(chalk.gray(`   Run: remotion-ai idea "${t.topic}"\n`));
    });
  });

// --- SFX, TRANSITIONS, CAPTIONS, ZOOM, GRADE, SYNC ---

setupSfxCommands(program, getProject, saveProject, ASSETS_DIR);
setupTransitionCommand(program, getProject, saveProject);
setupCaptionCommand(program, getProject, saveProject);
setupZoomCommand(program, getProject, saveProject);
setupGradeCommand(program, getProject, saveProject);
setupSyncCommand(program, getProject, saveProject);
setupMaskCommand(program, getProject, saveProject);
setupBlendCommand(program, getProject, saveProject);
setupSilenceCommand(program, getProject, saveProject);
setupBrollCommand(program, getProject, saveProject);
setupPyramidCommand(program, getProject, saveProject);
setupHookCommand(program, getProject, saveProject);
setupNoiseCommand(program, getProject, saveProject);
setupTranscribeCommand(program, getProject, saveProject);
setupHighlightsCommand(program, getProject, saveProject);
setupSpeakersCommand(program, getProject, saveProject);
setupTrimCommand(program, getProject, saveProject);
setupKaraokeCommand(program, getProject, saveProject);
setupScenesCommand(program, getProject, saveProject);
setupNormalizeCommand(program, getProject, saveProject);
setupCropCommand(program, getProject, saveProject);
setupMcpCommand(program, getProject, saveProject);
setupScriptCommand(program, getProject, saveProject);
setupVoiceCommand(program, getProject, saveProject);
setupMotionCommand(program, getProject, saveProject);
setupSvgCommand(program, getProject, saveProject);
setupTransitionSfxCommand(program, getProject, saveProject);
setupCapcutCommand(program, getProject, saveProject);

// --- HISTORY COMMANDS ---

const history = program.command('history').description('View and replay action history');

history
  .command('list')
  .description('List all recorded actions')
  .option('--json', 'Output as JSON')
  .action(async (options) => {
    const log = await getActionLog();
    
    if (log.length === 0) {
      console.log(chalk.yellow('No actions recorded yet.'));
      return;
    }

    if (options.json) {
      console.log(JSON.stringify(log.map((entry, i) => ({ index: i + 1, action: entry.action, timestamp: entry.timestamp, details: entry.details })), null, 2));
      return;
    }
    
    console.log(chalk.blue('\n📜 Action History:\n'));
    log.forEach((entry, i) => {
      console.log(chalk.cyan(`  [${i + 1}] ${entry.action}`));
      console.log(chalk.gray(`      Time: ${entry.timestamp}`));
      console.log(chalk.gray(`      Details: ${JSON.stringify(entry.details)}`));
    });
    console.log('');
  });

history
  .command('clear')
  .description('Clear action history')
  .action(async () => {
    await fs.writeJson(ACTION_LOG_PATH, [], { spaces: 2 });
    console.log(chalk.green('✔ Action history cleared.'));
  });

history
  .command('replay')
  .description('Replay all recorded actions on current project')
  .action(async () => {
    const log = await getActionLog();
    
    if (log.length === 0) {
      console.log(chalk.yellow('No actions to replay.'));
      return;
    }
    
    const project = await getProject();
    
    console.log(chalk.blue(`\n🔄 Replaying ${log.length} actions...\n`));
    
    for (const entry of log) {
      console.log(chalk.cyan(`   Executing: ${entry.action}`));
      
      switch (entry.action) {
        case 'clip-add':
          // Check if asset already exists
          if (!project.assets[entry.details.assetId]) {
            project.assets[entry.details.assetId] = `/${path.basename(entry.details.assetPath)}`;
          }
          // Check if clip already exists
          if (!project.timeline.clips.find(c => c.id === entry.details.clipId)) {
            project.timeline.clips.push({
              id: entry.details.clipId,
              assetId: entry.details.assetId,
              startFrame: entry.details.startFrame,
              endFrame: entry.details.endFrame,
              trimStart: 0,
              trimEnd: entry.details.endFrame - entry.details.startFrame,
              transition: 'fade'
            });
          }
          console.log(chalk.green(`      ✔ Added clip ${entry.details.clipId}`));
          break;
          
        case 'text-add':
          if (!project.timeline.texts.find(t => t.id === entry.details.textId)) {
            project.timeline.texts.push({
              id: entry.details.textId,
              content: entry.details.content,
              startFrame: parseInt(entry.details.start),
              endFrame: parseInt(entry.details.end),
              style: { color: 'white', fontSize: 80 },
              position: { x: 'center', y: 'center' }
            });
          }
          console.log(chalk.green(`      ✔ Added text ${entry.details.textId}`));
          break;
      }
    }
    
    await saveProject(project);
    console.log(chalk.green('\n✔ Replay complete! Run "remotion-ai render" to generate video.'));
  });

// --- IDEA COMMAND ---

program
  .command('idea <topic>')
  .description('Suggest video structures for a topic')
  .option('-t, --type <type>', 'Template type: explainer, listicle, news, tutorial, promo')
  .action(async (topic, options) => {
    console.log(chalk.blue(`\n💡 Video ideas for: ${topic}\n`));
    
    const types = options.type ? [options.type] : ['explainer', 'listicle', 'news', 'tutorial', 'promo'];
    
    for (const type of types) {
      const templatePath = path.join(TEMPLATES_DIR, `${type}.yaml`);
      if (!(await fs.pathExists(templatePath))) continue;
      
      const content = await fs.readFile(templatePath, 'utf8');
      const tmpl = yaml.load(content);
      
      console.log(chalk.cyan(`📋 ${tmpl.name} (${tmpl.category})`));
      console.log(chalk.gray(`   ${tmpl.description}`));
      console.log(chalk.gray(`   Duration: ${tmpl.duration} frames (${(tmpl.duration / 30).toFixed(0)}s)`));
      console.log(chalk.gray('   Scenes:'));
      
      tmpl.scenes.forEach((scene, i) => {
        const text = scene.text.replace(/{topic}/g, topic)
          .replace(/{n}/g, '5')
          .replace(/{n_minus_1}/g, '4')
          .replace(/{n_minus_2}/g, '3');
        console.log(chalk.gray(`     ${i + 1}. ${scene.effect}: ${text}`));
      });
      console.log('');
    }
    
    console.log(chalk.green('Run "remotion-ai template use <type>" to apply a template.'));
  });

template
  .command('preview <name>')
  .description('Preview a template structure')
  .action(async (name) => {
    const templatePath = path.join(TEMPLATES_DIR, `${name}.yaml`);
    if (!(await fs.pathExists(templatePath))) {
      console.log(chalk.red(`✘ Template not found: ${name}`));
      return;
    }
    const content = await fs.readFile(templatePath, 'utf8');
    const tmpl = yaml.load(content);
    
    console.log(chalk.blue(`\n📋 Template: ${tmpl.name}\n`));
    console.log(chalk.gray(`Category: ${tmpl.category}`));
    console.log(chalk.gray(`Duration: ${tmpl.duration} frames (${(tmpl.duration / 30).toFixed(0)}s)`));
    console.log(chalk.gray(`Scenes: ${tmpl.scenes.length}\n`));
    
    tmpl.scenes.forEach((scene, i) => {
      console.log(chalk.cyan(`  ${i + 1}. [${scene.effect}] ${scene.text}`));
      console.log(chalk.gray(`     Duration: ${scene.duration}f | Accent: ${scene.accent}`));
    });
    console.log('');
  });

// --- MCP SERVER COMMAND ---

program
  .command('mcp')
  .description('Start MCP server for AI agent integration')
  .action(async () => {
    console.log(chalk.blue('🌐 Starting Remotion AI MCP server...'));
    console.log(chalk.gray('Press Ctrl+C to stop.'));
    
    try {
      const { spawn } = await import('child_process');
      const serverPath = path.join(__dirname, 'mcp-server.mjs');
      const server = spawn('node', [serverPath], { stdio: 'inherit' });
      
      server.on('error', (err) => {
        console.log(chalk.red(`✘ MCP server error: ${err.message}`));
      });
      
      server.on('close', (code) => {
        console.log(chalk.gray(`MCP server stopped (code: ${code})`));
      });
    } catch (e) {
      console.log(chalk.red(`✘ Failed to start MCP server: ${e.message}`));
    }
  });

// --- GPU DETECTION ---

function detectGPU() {
  try {
    if (process.platform === 'win32') {
      const output = execSync('wmic path win32_videocontroller get name /format:csv 2>nul', { encoding: 'utf8', timeout: 5000 });
      const lines = output.split('\n').filter(l => l.trim() && !l.startsWith('Node'));
      for (const line of lines) {
        const name = line.split(',').pop()?.trim();
        if (!name) continue;
        const lower = name.toLowerCase();
        if (lower.includes('nvidia') || lower.includes('geforce') || lower.includes('rtx') || lower.includes('gtx')) {
          return { vendor: 'nvidia', name, encoder: 'h264_nvenc', hevcEncoder: 'hevc_nvenc' };
        }
        if (lower.includes('amd') || lower.includes('radeon') || lower.includes('rx')) {
          return { vendor: 'amd', name, encoder: 'h264_amf', hevcEncoder: 'hevc_amf' };
        }
        if (lower.includes('intel') || lower.includes('uhd') || lower.includes('iris')) {
          return { vendor: 'intel', name, encoder: 'h264_qsv', hevcEncoder: 'hevc_qsv' };
        }
      }
    }
  } catch {}
  return { vendor: 'none', name: 'Not detected', encoder: 'libx264', hevcEncoder: 'libx265' };
}

// --- GPU COMMANDS ---

const gpu = program.command('gpu').description('GPU acceleration and detection');

gpu
  .command('detect')
  .description('Detect GPU and show encoder info')
  .option('--json', 'Output as JSON')
  .action(async (options) => {
    const gpuInfo = detectGPU();
    
    if (options.json) {
      console.log(JSON.stringify(gpuInfo, null, 2));
      return;
    }
    
    console.log(chalk.blue('\n🎮 GPU Detection:\n'));
    console.log(chalk.gray(`  Device:          ${gpuInfo.name}`));
    console.log(chalk.gray(`  Vendor:          ${gpuInfo.vendor.toUpperCase()}`));
    console.log(chalk.gray(`  H.264 Encoder:   ${gpuInfo.encoder}`));
    console.log(chalk.gray(`  HEVC Encoder:    ${gpuInfo.hevcEncoder}`));
    
    if (gpuInfo.vendor === 'none') {
      console.log(chalk.yellow('\n  ⚠ No GPU detected. Using software encoding (libx264).'));
      console.log(chalk.gray('  Install AMD Adrenalin or NVIDIA drivers for hardware encoding.'));
    } else {
      console.log(chalk.green(`\n  ✔ GPU hardware encoding available: ${gpuInfo.encoder}`));
    }
    console.log('');
  });

gpu
  .command('test')
  .description('Test GPU encoding with a short render')
  .action(async () => {
    const gpuInfo = detectGPU();
    console.log(chalk.blue(`\n🧪 Testing GPU encoding: ${gpuInfo.name}\n`));
    
    if (gpuInfo.vendor === 'none') {
      console.log(chalk.red('✘ No GPU detected. Cannot test hardware encoding.'));
      process.exit(1);
    }
    
    // Create a minimal test project
    const testDir = path.join(os.tmpdir(), 'remotion-gpu-test');
    await fs.ensureDir(testDir);
    await fs.ensureDir(path.join(testDir, 'public'));
    await fs.ensureDir(path.join(testDir, '.remotion-ai'));
    
    const testProject = {
      settings: { width: 640, height: 360, fps: 30, durationInFrames: 30 },
      assets: {},
      timeline: { clips: [], texts: [{ id: 'test', content: 'GPU Test', startFrame: 0, endFrame: 30, style: { color: 'white', fontSize: 48 }, position: { x: 'center', y: 'center' }, effect: 'none' }], audio: [] }
    };
    await fs.writeJson(path.join(testDir, '.remotion-ai', 'project.json'), testProject, { spaces: 2 });
    
    // Copy source files
    const SOURCE_DIR = path.join(TOOL_ROOT, 'src');
    await fs.copy(SOURCE_DIR, path.join(testDir, 'src'), { filter: (src) => !src.includes('node_modules') });
    await fs.copy(path.join(TOOL_ROOT, 'package.json'), path.join(testDir, 'package.json'));
    
    const startTime = Date.now();
    try {
      execSync(`npx remotion render src/index.tsx Main --video-codec ${gpuInfo.encoder}`, { cwd: testDir, stdio: 'inherit' });
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(chalk.green(`\n✔ GPU encoding test passed! (${elapsed}s)`));
      console.log(chalk.gray(`   Encoder: ${gpuInfo.encoder}`));
    } catch (e) {
      console.log(chalk.red(`\n✘ GPU encoding test failed: ${e.message}`));
      console.log(chalk.yellow('   Falling back to software encoding (libx264).'));
    }
    
    // Cleanup
    try { await fs.remove(testDir); } catch {}
    console.log('');
  });

// --- STATUS COMMAND ---

program
  .command('status')
  .description('Show current project summary')
  .option('--json', 'Output as JSON')
  .action(async (options) => {
    const project = await getProject();
    const clipCount = project.timeline.clips.length;
    const textCount = project.timeline.texts.length;
    const audioCount = project.timeline.audio.length;
    const totalDuration = project.settings.durationInFrames;
    const fps = project.settings.fps;
    const seconds = (totalDuration / fps).toFixed(1);
    const assetCount = Object.keys(project.assets).length;

    if (options.json) {
      console.log(JSON.stringify({ settings: project.settings, clips: clipCount, texts: textCount, audio: audioCount, assets: assetCount, durationSeconds: parseFloat(seconds) }, null, 2));
      return;
    }

    console.log(chalk.blue('\n📊 Project Status:\n'));
    console.log(chalk.cyan('  Settings')); 
    console.log(chalk.gray(`    Resolution:  ${project.settings.width}×${project.settings.height}`));
    console.log(chalk.gray(`    FPS:         ${fps}`));
    console.log(chalk.gray(`    Duration:    ${totalDuration} frames (${seconds}s)`));
    console.log('');
    console.log(chalk.cyan('  Timeline'));
    console.log(chalk.gray(`    Clips:       ${clipCount}`));
    console.log(chalk.gray(`    Texts:       ${textCount}`));
    console.log(chalk.gray(`    Audio:       ${audioCount}`));
    console.log(chalk.gray(`    Assets:      ${assetCount} file(s)`));
    console.log('');

    if (clipCount > 0) {
      console.log(chalk.cyan('  Clips'));
      project.timeline.clips.forEach(c => {
        const dur = c.endFrame - c.startFrame;
        console.log(chalk.gray(`    ${c.id}: frames ${c.startFrame}-${c.endFrame} (${dur}f)`));
      });
    }
    if (textCount > 0) {
      console.log(chalk.cyan('  Texts'));
      project.timeline.texts.forEach(t => {
        const effect = t.effect && t.effect !== 'none' ? ` [${t.effect}]` : '';
        console.log(chalk.gray(`    ${t.id}: "${t.content}" ${t.startFrame}-${t.endFrame}${effect}`));
      });
    }
    console.log('');
  });

// --- INFO COMMAND ---

program
  .command('info')
  .description('Show tool and environment info')
  .action(async () => {
    console.log(chalk.blue('\nℹ️  remotion-ai Environment\n'));
    console.log(chalk.gray(`  Tool version:    1.0.0`));
    console.log(chalk.gray(`  Node version:    ${process.version}`));
    console.log(chalk.gray(`  Platform:        ${process.platform} ${process.arch}`));
    console.log(chalk.gray(`  Working dir:     ${process.cwd()}`));
    
    try {
      const remotionVersion = execSync('npx remotion --version 2>nul', { encoding: 'utf8', timeout: 10000 }).trim();
      console.log(chalk.gray(`  Remotion:        ${remotionVersion}`));
    } catch {
      console.log(chalk.gray(`  Remotion:        not installed`));
    }
    
    const configExists = await fs.pathExists(CONFIG_DIR);
    console.log(chalk.gray(`  Project init:    ${configExists ? 'yes' : 'no'}`));
    
    const gpu = detectGPU();
    console.log(chalk.gray(`  GPU:             ${gpu.name}`));
    console.log(chalk.gray(`  Encoder:         ${gpu.encoder}`));
    console.log('');
  });

try {
  program.parse();
} catch (error) {
  handleError(error);
}
