// Motion graphics: script analysis, voice generation, map/chart animations, SVG

import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import chalk from 'chalk';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function setupScriptCommand(program, getProject, saveProject) {
  const script = program.command('script').description('Script analysis and generation');

  script.command('analyze <text>').description('Analyze script for viral potential')
    .option('--fix', 'Show improvement suggestions')
    .action(async (text, options) => {
      console.log(chalk.blue('\n📝 Script Analysis:\n'));

      const words = text.split(' ');
      const sentences = text.split(/[.!?]+/).filter(s => s.trim());
      const avgWordsPerSentence = words.length / Math.max(sentences.length, 1);

      // Hook analysis
      const hookWords = ['secret', 'never', 'actually', 'shocking', 'truth', 'nobody', 'insane', 'crazy', 'mind-blowing'];
      const hasHook = hookWords.some(w => text.toLowerCase().includes(w));

      // Emotional triggers
      const emotionalWords = ['amazing', 'incredible', 'unbelievable', 'stunning', 'breathtaking'];
      const emotionalCount = emotionalWords.filter(w => text.toLowerCase().includes(w)).length;

      // Stats
      console.log(chalk.cyan('  Words: ') + words.length);
      console.log(chalk.cyan('  Sentences: ') + sentences.length);
      console.log(chalk.cyan('  Avg words/sentence: ') + avgWordsPerSentence.toFixed(1));
      console.log(chalk.cyan('  Hook words: ') + (hasHook ? chalk.green('✔ Yes') : chalk.red('✘ No')));
      console.log(chalk.cyan('  Emotional triggers: ') + emotionalCount);

      // Scoring
      let score = 50;
      if (hasHook) score += 20;
      if (emotionalCount > 0) score += 10;
      if (words.length >= 50 && words.length <= 150) score += 10;
      if (avgWordsPerSentence <= 15) score += 10;

      console.log(chalk.yellow(`\n  Viral Score: ${score}/100`));

      if (options.fix) {
        console.log(chalk.yellow('\n💡 Improvement Suggestions:'));
        if (!hasHook) console.log(chalk.cyan('  • Add hook words: secret, never, actually, shocking'));
        if (emotionalCount === 0) console.log(chalk.cyan('  • Add emotional triggers: amazing, incredible, stunning'));
        if (avgWordsPerSentence > 15) console.log(chalk.cyan('  • Shorten sentences for better pacing'));
        if (words.length < 50) console.log(chalk.cyan('  • Expand script for better engagement'));
      }
    });

  script.command('generate <topic>').description('Generate viral script structure')
    .option('-l, --length <words>', 'Target word count', '100')
    .option('-s, --style <style>', 'Style: educational, shocking, storytelling', 'educational')
    .action(async (topic, options) => {
      console.log(chalk.blue(`\n🎬 Script Structure for "${topic}":\n`));

      const length = parseInt(options.length);

      console.log(chalk.cyan('  HOOK (0-3 seconds):'));
      console.log(chalk.white(`    "Did you know that ${topic}..."`));
      console.log(chalk.white(`    "Nobody talks about this, but ${topic}..."`));

      console.log(chalk.cyan('\n  SETUP (3-10 seconds):'));
      console.log(chalk.white(`    "Here's what most people don't understand about ${topic}..."`));

      console.log(chalk.cyan('\n  CONTENT (10-45 seconds):'));
      console.log(chalk.white(`    Present 3-5 key facts with data points`));
      console.log(chalk.white(`    Use transitions: "But here's where it gets interesting..."`));

      console.log(chalk.cyan('\n  CLIMAX (45-55 seconds):'));
      console.log(chalk.white(`    "And the most shocking part?"`));
      console.log(chalk.white(`    Reveal the biggest fact or twist`));

      console.log(chalk.cyan('\n  CTA (55-60 seconds):'));
      console.log(chalk.white(`    "Follow for more facts about ${topic}"`));

      console.log(chalk.yellow('\n💡 Use with:'));
      console.log(chalk.cyan(`  remotion-ai voice generate "script text" --voice brian`));
      console.log(chalk.cyan(`  remotion-ai motion map --highlight "USA"`));
    });

  script.command('viral <url>').description('Analyze viral video script from URL')
    .action(async (url, options) => {
      console.log(chalk.blue('\n🔍 Viral Script Analysis:\n'));
      console.log(chalk.gray(`  URL: ${url}`));

      console.log(chalk.yellow('\n⚠ To analyze a viral script:'));
      console.log(chalk.cyan('  1. Use TokScript browser extension to transcribe the video'));
      console.log(chalk.cyan('  2. Copy the transcript'));
      console.log(chalk.cyan('  3. Run: remotion-ai script analyze "transcript text"'));
      console.log(chalk.cyan('  4. Run: remotion-ai script generate "topic"'));
    });
}

export function setupVoiceCommand(program, getProject, saveProject) {
  const voice = program.command('voice').description('AI voice generation (ElevenLabs)');

  voice.command('generate <text>').description('Generate voice narration')
    .option('-v, --voice <name>', 'Voice name: brian, rachel, adam, bella', 'brian')
    .option('-s, --stability <n>', 'Voice stability (0-1)', '0.5')
    .option('-c, --clarity <n>', 'Clarity boost (0-1)', '0.75')
    .option('-o, --output <path>', 'Output file path')
    .action(async (text, options) => {
      console.log(chalk.blue('\n🎙️ Voice Generation:\n'));
      console.log(chalk.gray(`  Text: "${text.substring(0, 50)}..."`));
      console.log(chalk.gray(`  Voice: ${options.voice}`));
      console.log(chalk.gray(`  Stability: ${options.stability}`));
      console.log(chalk.gray(`  Clarity: ${options.clarity}`));

      const outputPath = options.output || `voice-${Date.now()}.mp3`;

      console.log(chalk.yellow('\n⚠ ElevenLabs API required. Setup:'));
      console.log(chalk.cyan('  1. Get API key from https://elevenlabs.io'));
      console.log(chalk.cyan('  2. Set environment variable:'));
      console.log(chalk.cyan('     export ELEVENLABS_API_KEY="your-key"'));
      console.log(chalk.cyan('  3. Run with curl:\n'));

      const curlCmd = `curl -X POST "https://api.elevenlabs.io/v1/text-to-speech/21m00Tcm4TlvDq8ikWAM" \\
  -H "xi-api-key: $ELEVENLABS_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '${JSON.stringify({
        text: text,
        model_id: "eleven_monolingual_v1",
        voice_settings: {
          stability: parseFloat(options.stability),
          similarity_boost: parseFloat(options.clarity)
        }
      })}' \\
  -o "${outputPath}"`;

      console.log(chalk.cyan(curlCmd));

      console.log(chalk.yellow('\n💡 Popular voices:'));
      console.log(chalk.cyan('  brian  - Very realistic male reader'));
      console.log(chalk.cyan('  rachel - Natural female voice'));
      console.log(chalk.cyan('  adam   - Deep male voice'));
      console.log(chalk.cyan('  bella  - Warm female voice'));

      console.log(chalk.yellow('\n💡 After generating, add to project:'));
      console.log(chalk.cyan(`  remotion-ai audio add ${outputPath}`));
    });

  voice.command('list').description('List available ElevenLabs voices')
    .action(async () => {
      console.log(chalk.blue('\n🎤 Popular ElevenLabs Voices:\n'));

      const voices = [
        { name: 'Brian', id: '21m00Tcm4TlvDq8ikWAM', style: 'Very realistic male reader' },
        { name: 'Rachel', id: '21m00Tcm4TlvDq8ikWAM', style: 'Natural female voice' },
        { name: 'Adam', id: '21m00Tcm4TlvDq8ikWAM', style: 'Deep male voice' },
        { name: 'Bella', id: '21m00Tcm4TlvDq8ikWAM', style: 'Warm female voice' },
        { name: 'Antoni', id: '21m00Tcm4TlvDq8ikWAM', style: 'Well-rounded male' },
        { name: 'Elli', id: '21m00Tcm4TlvDq8ikWAM', style: 'Young female' }
      ];

      voices.forEach(v => {
        console.log(chalk.cyan(`  ${v.name}`) + chalk.gray(` (${v.id})`));
        console.log(chalk.white(`    ${v.style}`));
      });

      console.log(chalk.yellow('\n⚠ Note: Voice IDs shown are placeholders. Use your own voice IDs from ElevenLabs dashboard.'));
    });
}

export function setupMotionCommand(program, getProject, saveProject) {
  const motion = program.command('motion').description('Motion graphics generation (Hera-style)');

  motion.command('map').description('Generate map animation')
    .option('--highlight <region>', 'Region to highlight', 'USA')
    .option('--zoom <level>', 'Zoom level: country, state, city', 'country')
    .option('--style <style>', 'Animation style: zoom, pan, flyover', 'zoom')
    .option('--duration <seconds>', 'Animation duration', '5')
    .action(async (options) => {
      console.log(chalk.blue('\n🗺️ Map Animation:\n'));
      console.log(chalk.gray(`  Highlight: ${options.highlight}`));
      console.log(chalk.gray(`  Zoom: ${options.zoom}`));
      console.log(chalk.gray(`  Style: ${options.style}`));
      console.log(chalk.gray(`  Duration: ${options.duration}s`));

      console.log(chalk.yellow('\n💡 Hera-style map animation workflow:'));
      console.log(chalk.cyan('  1. Use ChatGPT to generate data about the region'));
      console.log(chalk.cyan('  2. Create map visualization prompt:'));
      console.log(chalk.cyan(`     "Highlight ${options.highlight}, then zoom into the capital"`));
      console.log(chalk.cyan('  3. Generate with Hera or similar tool'));
      console.log(chalk.cyan('  4. Export as 4K 60fps video'));

      console.log(chalk.yellow('\n💡 FFmpeg map animation (basic):'));
      console.log(chalk.cyan(`  ffmpeg -f lavfi -i "color=c=black:s=1080x1920:d=${options.duration}" \\
  -vf "drawtext=text='${options.highlight}':fontsize=120:fontcolor=white:x=(w-tw)/2:y=(h-th)/2" \\
  -c:v libx264 -pix_fmt yuv420p map-animation.mp4`));

      console.log(chalk.yellow('\n💡 Add to project:'));
      console.log(chalk.cyan('  remotion-ai clip add map-animation.mp4 --start 0'));
    });

  motion.command('chart').description('Generate animated chart')
    .option('-t, --type <type>', 'Chart type: bar, line, pie, doughnut', 'bar')
    .option('-d, --data <json>', 'Chart data as JSON')
    .option('--style <style>', 'Animation style: grow, slide, fade', 'grow')
    .option('--duration <seconds>', 'Animation duration', '5')
    .action(async (type, options) => {
      console.log(chalk.blue('\n📊 Chart Animation:\n'));
      console.log(chalk.gray(`  Type: ${type}`));
      console.log(chalk.gray(`  Style: ${options.style}`));
      console.log(chalk.gray(`  Duration: ${options.duration}s`));

      if (options.data) {
        try {
          const data = JSON.parse(options.data);
          console.log(chalk.cyan('\n  Data:'));
          data.forEach((item, i) => {
            console.log(chalk.white(`    ${item.label || i}: ${item.value}`));
          });
        } catch {
          console.log(chalk.red('  Invalid JSON data'));
        }
      }

      console.log(chalk.yellow('\n💡 Chart animation workflow:'));
      console.log(chalk.cyan('  1. Prepare data (JSON or CSV)'));
      console.log(chalk.cyan('  2. Generate chart with Chart.js or D3.js'));
      console.log(chalk.cyan('  3. Record animation with Puppeteer'));
      console.log(chalk.cyan('  4. Export as video'));

      console.log(chalk.yellow('\n💡 Quick chart with FFmpeg:'));
      console.log(chalk.cyan(`  # Create bar chart animation
ffmpeg -f lavfi -i "color=c=black:s=1080x1920:d=5" \\
  -vf "drawbox=x=100:y=800:w=200:h=0:c=blue:t=fill,\\
       drawbox=x=100:y=800:w=200:h=400:c=blue:t=fill:enable='between(t,0.5,5)'" \\
  -c:v libx264 chart.mp4`));

      console.log(chalk.yellow('\n💡 Add to project:'));
      console.log(chalk.cyan('  remotion-ai clip add chart.mp4 --start 0'));
    });

  motion.command('text-anim').description('Generate text animation')
    .option('-t, --text <text>', 'Text to animate')
    .option('-a, --animation <type>', 'Animation: typewriter, wave, bounce, glitch, kinetic', 'typewriter')
    .option('-s, --style <style>', 'Text style: neon, minimal, bold, gradient', 'bold')
    .option('--duration <seconds>', 'Animation duration', '3')
    .action(async (text, options) => {
      console.log(chalk.blue('\n✨ Text Animation:\n'));
      console.log(chalk.gray(`  Text: ${text}`));
      console.log(chalk.gray(`  Animation: ${options.animation}`));
      console.log(chalk.gray(`  Style: ${options.style}`));

      console.log(chalk.yellow('\n💡 Add animated text to project:'));
      console.log(chalk.cyan(`  remotion-ai text add "${text}" --effect ${options.animation}`));

      console.log(chalk.yellow('\n💡 Available effects:'));
      console.log(chalk.cyan('  kinetic, liquid, shader, typewriter, wave, glitch'));
      console.log(chalk.cyan('  bounce, scale, flash, pulse, slide-left, slide-right'));
      console.log(chalk.cyan('  zoom-in, zoom-out, shake, spin'));
    });
}

export function setupSvgCommand(program, getProject, saveProject) {
  program.command('svg <file>').description('Import SVG graphics to project')
    .option('-s, --start <frame>', 'Start frame', '0')
    .option('-d, --duration <frames>', 'Duration', '60')
    .option('-o, --opacity <n>', 'Opacity (0-1)', '1')
    .option('--scale <n>', 'Scale factor', '1')
    .action(async (file, options) => {
      const filePath = path.resolve(file);
      if (!fs.existsSync(filePath)) {
        console.log(chalk.red(`✘ File not found: ${filePath}`));
        process.exit(1);
      }

      const ext = path.extname(filePath).toLowerCase();
      if (ext !== '.svg') {
        console.log(chalk.red('✘ Only SVG files are supported'));
        process.exit(1);
      }

      console.log(chalk.blue('\n🖼️ SVG Import:\n'));
      console.log(chalk.gray(`  File: ${filePath}`));

      const project = await getProject();
      const svgContent = await fs.readFile(filePath, 'utf-8');

      // Copy to public folder
      await fs.ensureDir(path.join(process.cwd(), 'public'));
      const destPath = path.join('public', path.basename(filePath));
      await fs.copy(filePath, path.join(process.cwd(), destPath));

      // Add as a clip
      project.assets[`svg_${Date.now()}`] = `/${path.basename(filePath)}`;
      await saveProject(project);

      console.log(chalk.green(`✔ SVG imported: ${destPath}`));
      console.log(chalk.yellow('\n💡 SVG files can be used as:'));
      console.log(chalk.cyan('  • Logo overlays'));
      console.log(chalk.cyan('  • Map elements'));
      console.log(chalk.cyan('  • Chart graphics'));
      console.log(chalk.cyan('  • Custom icons'));
    });
}

export function setupTransitionSfxCommand(program, getProject, saveProject) {
  program.command('transition-sfx').description('Add sound effects to all transitions')
    .option('-t, --type <type>', 'SFX type: whoosh, swoosh, impact, rise', 'whoosh')
    .option('-v, --volume <n>', 'Volume (0-1)', '0.5')
    .action(async (options) => {
      const project = await getProject();
      const texts = project.timeline.texts;

      if (texts.length < 2) {
        console.log(chalk.red('✘ Need at least 2 scenes for transitions'));
        process.exit(1);
      }

      console.log(chalk.blue('\n🔊 Adding Transition SFX:\n'));

      const sfxTypes = {
        'whoosh': 'whoosh',
        'swoosh': 'whoosh',
        'impact': 'hit',
        'rise': 'riser'
      };

      const sfxType = sfxTypes[options.type] || 'whoosh';
      const sfxPath = path.join(__dirname, '..', 'sfx', `${sfxType}.mp3`);

      if (!fs.existsSync(sfxPath)) {
        console.log(chalk.red(`✘ SFX not found: ${sfxType}`));
        process.exit(1);
      }

      // Add SFX at each scene transition
      let sfxCount = 0;
      texts.forEach((text, i) => {
        if (i > 0 && text.startFrame > 0) {
          project.timeline.audio.push({
            id: `audio_${project.timeline.audio.length + 1}`,
            assetId: `sfx_${sfxType}`,
            startFrame: text.startFrame - 5, // Slightly before transition
            duration: 20,
            volume: parseFloat(options.volume)
          });
          sfxCount++;
        }
      });

      // Copy SFX to public
      const publicDir = path.join(process.cwd(), 'public');
      await fs.ensureDir(publicDir);
      await fs.copy(sfxPath, path.join(publicDir, `sfx-${sfxType}.mp3`));
      project.assets[`sfx_${sfxType}`] = `/sfx-${sfxType}.mp3`;

      await saveProject(project);
      console.log(chalk.green(`✔ Added ${sfxCount} transition SFX (${options.type})`));
    });
}

export function setupCapcutCommand(program, getProject, saveProject) {
  program.command('capcut').description('Export project for CapCut editing')
    .action(async () => {
      const project = await getProject();

      console.log(chalk.blue('\n🎬 CapCut Export:\n'));

      // Create CapCut-compatible project file
      const capcutProject = {
        name: project.settings.name || 'Remotion AI Project',
        duration: project.settings.durationInFrames / 30, // Convert to seconds
        fps: project.settings.fps,
        width: project.settings.width,
        height: project.settings.height,
        tracks: {
          video: project.timeline.clips.length,
          audio: project.timeline.audio.length,
          text: project.timeline.texts.length
        },
        exportSettings: {
          format: 'mp4',
          quality: '1080p',
          fps: 30
        }
      };

      const outputPath = 'capcut-project.json';
      await fs.writeJson(outputPath, capcutProject, { spaces: 2 });

      console.log(chalk.green(`✔ CapCut project exported: ${outputPath}`));
      console.log(chalk.yellow('\n💡 CapCut workflow:'));
      console.log(chalk.cyan('  1. Import rendered video into CapCut'));
      console.log(chalk.cyan('  2. Add auto-captions (AI feature)'));
      console.log(chalk.cyan('  3. Add sound effects from CapCut library'));
      console.log(chalk.cyan('  4. Fine-tune timing and effects'));
      console.log(chalk.cyan('  5. Export final video'));

      console.log(chalk.yellow('\n💡 CapCut shortcuts:'));
      console.log(chalk.cyan('  Ctrl+Shift+C - Auto captions'));
      console.log(chalk.cyan('  Ctrl+Shift+S - Speed adjust'));
      console.log(chalk.cyan('  Ctrl+Shift+E - Effects'));
    });
}
