// Advanced video techniques: mask, blend, silence, broll, pyramid, hook

import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import chalk from 'chalk';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function setupMaskCommand(program, getProject, saveProject) {
  program.command('mask <type>').description('Add mask: rounded, circle, diagonal, none')
    .option('-f, --frame <frame>', 'Frame', '0')
    .option('-d, --duration <frames>', 'Duration', '0')
    .option('-r, --radius <px>', 'Corner radius', '20')
    .action(async (type, options) => {
      const validTypes = ['rounded', 'circle', 'diagonal', 'none'];
      if (!validTypes.includes(type)) {
        console.log(chalk.red(`✘ Use: ${validTypes.join(', ')}`));
        process.exit(1);
      }
      const project = await getProject();
      const frame = parseInt(options.frame);
      const dur = parseInt(options.duration) || project.settings.durationInFrames;
      const radius = parseInt(options.radius);

      project.timeline.texts.push({
        id: `text_${project.timeline.texts.length + 1}`,
        content: '',
        startFrame: frame,
        endFrame: frame + dur,
        style: { color: 'transparent', fontSize: 1 },
        position: { x: 'center', y: 'center' },
        effect: 'none',
        bg: '#000',
        accent: '#FFFFFF',
        mask: { type, radius }
      });
      await saveProject(project);
      console.log(chalk.green(`✔ Added ${type} mask at frame ${frame}`));
    });
}

export function setupBlendCommand(program, getProject, saveProject) {
  program.command('blend <mode>').description('Set blend mode: soft-light, overlay, multiply, screen, normal')
    .option('-t, --text-id <id>', 'Text ID to apply to')
    .option('-o, --opacity <n>', 'Opacity 0-1', '0.8')
    .action(async (mode, options) => {
      const validModes = ['soft-light', 'overlay', 'multiply', 'screen', 'normal'];
      if (!validModes.includes(mode)) {
        console.log(chalk.red(`✘ Use: ${validModes.join(', ')}`));
        process.exit(1);
      }
      const project = await getProject();
      const textId = options.textId;
      const opacity = parseFloat(options.opacity);

      if (textId) {
        const text = project.timeline.texts.find(t => t.id === textId);
        if (text) {
          text.blend = { mode, opacity };
          await saveProject(project);
          console.log(chalk.green(`✔ Set ${mode} blend on ${textId}`));
        } else {
          console.log(chalk.red(`✘ Text not found: ${textId}`));
        }
      } else {
        project.timeline.texts.forEach(t => {
          t.blend = { mode, opacity };
        });
        await saveProject(project);
        console.log(chalk.green(`✔ Set ${mode} blend on all texts`));
      }
    });
}

export function setupSilenceCommand(program, getProject, saveProject) {
  program.command('silence').description('Remove silence from audio (mark silent regions)')
    .option('-t, --threshold <dB>', 'Silence threshold in dB', '-30')
    .option('-d, --duration <ms>', 'Min silence duration in ms', '500')
    .action(async (options) => {
      const project = await getProject();
      const threshold = parseInt(options.threshold);
      const minDuration = parseInt(options.duration);

      if (project.timeline.audio.length === 0) {
        console.log(chalk.red('✘ No audio tracks'));
        process.exit(1);
      }

      console.log(chalk.blue(`\n🔇 Silence Detection:`));
      console.log(chalk.gray(`  Threshold: ${threshold}dB`));
      console.log(chalk.gray(`  Min duration: ${minDuration}ms`));
      console.log(chalk.gray(`  Audio tracks: ${project.timeline.audio.length}`));

      console.log(chalk.yellow('\n⚠ Use FFmpeg to detect and remove silence:'));
      console.log(chalk.cyan(`  ffmpeg -i audio.mp3 -af "silenceremove=stop_periods=-1:stop_duration=${minDuration/1000}:stop_threshold=${threshold}dB" output.mp3`));

      await saveProject(project);
      console.log(chalk.green('✔ Silence removal instructions saved'));
    });
}

export function setupBrollCommand(program, getProject, saveProject) {
  program.command('broll <query>').description('Suggest B-roll sources from web')
    .option('-c, --count <n>', 'Number of suggestions', '5')
    .option('-s, --start <frame>', 'Start frame', '0')
    .action(async (query, options) => {
      const count = parseInt(options.count);
      const frame = parseInt(options.start);

      console.log(chalk.blue(`\n🎬 B-Roll Suggestions for "${query}":\n`));

      const sources = [
        { name: 'Pexels', url: `https://www.pexels.com/search/${encodeURIComponent(query)}`, type: 'Free HD' },
        { name: 'Pixabay', url: `https://pixabay.com/videos/search/${encodeURIComponent(query)}/`, type: 'Free' },
        { name: 'Coverr', url: `https://coverr.co/s?q=${encodeURIComponent(query)}`, type: 'Free' },
        { name: 'Videvo', url: `https://www.videvo.net/search/${encodeURIComponent(query)}/`, type: 'Free/Premium' },
        { name: 'Artgrid', url: `https://artgrid.io/search?q=${encodeURIComponent(query)}`, type: 'Subscription' }
      ];

      sources.slice(0, count).forEach((src, i) => {
        console.log(chalk.cyan(`  ${i + 1}. ${src.name}`) + chalk.gray(` (${src.type})`));
        console.log(chalk.white(`     ${src.url}`));
      });

      console.log(chalk.yellow(`\n💡 After downloading, use:`));
      console.log(chalk.cyan(`  remotion-ai clip add <file> --start ${frame}`));
    });
}

export function setupPyramidCommand(program, getProject, saveProject) {
  program.command('pyramid <text>').description('Word-by-word sliding pyramid captions')
    .option('-s, --start <frame>', 'Start frame', '0')
    .option('-w, --words <n>', 'Max words visible', '3')
    .option('-c, --color <color>', 'Color', '#FFFFFF')
    .option('-sz, --size <size>', 'Font size', '60')
    .option('--slide', 'Enable sliding animation', true)
    .action(async (text, options) => {
      const project = await getProject();
      const start = parseInt(options.start);
      const maxWords = parseInt(options.words);
      const words = text.split(' ');
      const framesPerWord = 8;

      const chunks = [];
      for (let i = 0; i < words.length; i += maxWords) {
        chunks.push(words.slice(i, i + maxWords).join(' '));
      }

      chunks.forEach((chunk, i) => {
        const yBase = 70;
        const yOffset = (i % maxWords) * 8;

        project.timeline.texts.push({
          id: `text_${project.timeline.texts.length + 1}`,
          content: chunk,
          startFrame: start + (i * framesPerWord),
          endFrame: start + ((i + 1) * framesPerWord),
          style: {
            color: options.color,
            fontSize: parseInt(options.size),
            textAlign: 'center'
          },
          position: { x: 'center', y: `${yBase + yOffset}%` },
          effect: options.slide ? 'slide-left' : 'flash',
          bg: null,
          accent: options.color,
          blend: { mode: 'soft-light', opacity: 0.9 }
        });
      });

      await saveProject(project);
      console.log(chalk.green(`✔ Added ${chunks.length} pyramid chunks`));
    });
}

export function setupHookCommand(program, getProject, saveProject) {
  program.command('hook').description('Apply climax-first editing (trim to best moment)')
    .option('-f, --frame <frame>', 'Best frame to start from', '0')
    .option('-d, --duration <frames>', 'Keep duration', '450')
    .action(async (options) => {
      const project = await getProject();
      const hookFrame = parseInt(options.frame);
      const duration = parseInt(options.duration);

      console.log(chalk.blue('\n🎯 Climax-First Editing:\n'));

      if (hookFrame > 0) {
        console.log(chalk.gray(`  Shifting timeline to start at frame ${hookFrame}`));

        project.timeline.texts.forEach(t => {
          t.startFrame = Math.max(0, t.startFrame - hookFrame);
          t.endFrame = Math.max(1, t.endFrame - hookFrame);
        });

        project.timeline.audio.forEach(a => {
          a.startFrame = Math.max(0, a.startFrame - hookFrame);
        });

        project.timeline.clips.forEach(c => {
          c.startFrame = Math.max(0, c.startFrame - hookFrame);
        });

        project.settings.durationInFrames = duration;
      }

      console.log(chalk.gray(`  New duration: ${duration} frames (${(duration/30).toFixed(1)}s)`));

      await saveProject(project);
      console.log(chalk.green('✔ Applied climax-first editing'));
    });
}

export function setupNoiseCommand(program, getProject, saveProject) {
  program.command('noise').description('Show noise reduction instructions')
    .action(async () => {
      console.log(chalk.blue('\n🔇 Audio Noise Reduction:\n'));
      console.log(chalk.yellow('FFmpeg commands for noise reduction:\n'));
      console.log(chalk.cyan('  # Light noise reduction:'));
      console.log(chalk.white('  ffmpeg -i input.mp3 -af "afftdn=nf=-25" output.mp3\n'));
      console.log(chalk.cyan('  # Medium noise reduction:'));
      console.log(chalk.white('  ffmpeg -i input.mp3 -af "afftdn=nf=-25,highpass=f=200,lowpass=f=3000" output.mp3\n'));
      console.log(chalk.cyan('  # Heavy noise reduction:'));
      console.log(chalk.white('  ffmpeg -i input.mp3 -af "afftdn=nf=-30,agate=threshold=0.003" output.mp3\n'));
      console.log(chalk.gray('  nf = noise floor (lower = more aggressive)'));
      console.log(chalk.gray('  highpass/lowpass = frequency range to keep'));
    });
}
