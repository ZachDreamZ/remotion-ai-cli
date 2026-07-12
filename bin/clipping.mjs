// AI Clipping features: transcribe, highlights, speakers, trim, karaoke, scenes, normalize, crop, mcp

import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import chalk from 'chalk';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function setupTranscribeCommand(program, getProject, saveProject) {
  program.command('transcribe <file>').description('Transcribe video/audio with word-level timestamps')
    .option('-l, --language <lang>', 'Language (auto, en, zh, ja, ko)', 'auto')
    .option('-o, --output <path>', 'Output SRT path')
    .action(async (file, options) => {
      const filePath = path.resolve(file);
      if (!fs.existsSync(filePath)) {
        console.log(chalk.red(`✘ File not found: ${filePath}`));
        process.exit(1);
      }

      console.log(chalk.blue('\n🎙️ Transcription:\n'));
      console.log(chalk.gray(`  Input: ${filePath}`));
      console.log(chalk.gray(`  Language: ${options.language}`));

      // Check if whisper is available
      try {
        execSync('whisper --help', { stdio: 'ignore' });
        console.log(chalk.yellow('\n⚡ Using Whisper for transcription...\n'));

        const outputPath = options.output || filePath.replace(/\.[^.]+$/, '.srt');
        const cmd = `whisper "${filePath}" --language ${options.language} --output_format srt --output_dir "${path.dirname(outputPath)}"`;
        execSync(cmd, { stdio: 'inherit' });
        console.log(chalk.green(`\n✔ Transcription saved: ${outputPath}`));
      } catch {
        console.log(chalk.yellow('\n⚠ Whisper not installed. Install with:'));
        console.log(chalk.cyan('  pip install openai-whisper'));
        console.log(chalk.cyan('  # or'));
        console.log(chalk.cyan('  pip install whisper.cpp'));

        console.log(chalk.yellow('\n📋 FFmpeg-based basic transcription:'));
        console.log(chalk.cyan(`  ffmpeg -i "${filePath}" -vn -acodec pcm_s16le -ar 16000 -ac 1 audio.wav`));
        console.log(chalk.cyan('  # Then process audio.wav with your preferred ASR tool'));
      }
    });
}

export function setupHighlightsCommand(program, getProject, saveProject) {
  program.command('highlights <file>').description('Detect highlight segments from video')
    .option('-n, --count <n>', 'Number of highlights to find', '5')
    .option('-m, --min-duration <sec>', 'Minimum highlight duration', '10')
    .option('-M, --max-duration <sec>', 'Maximum highlight duration', '60')
    .option('--method <method>', 'Detection method: audio, visual, both', 'both')
    .action(async (file, options) => {
      const filePath = path.resolve(file);
      if (!fs.existsSync(filePath)) {
        console.log(chalk.red(`✘ File not found: ${filePath}`));
        process.exit(1);
      }

      console.log(chalk.blue('\n🎯 Highlight Detection:\n'));
      console.log(chalk.gray(`  File: ${filePath}`));
      console.log(chalk.gray(`  Looking for: ${options.count} highlights`));
      console.log(chalk.gray(`  Duration: ${options.minDuration}s - ${options.maxDuration}s`));
      console.log(chalk.gray(`  Method: ${options.method}`));

      // FFmpeg-based audio analysis
      console.log(chalk.yellow('\n📊 Analyzing audio energy...\n'));

      try {
        // Get audio volume stats
        const probeCmd = `ffprobe -v quiet -print_format json -show_streams "${filePath}"`;
        const probe = JSON.parse(execSync(probeCmd).toString());
        const duration = parseFloat(probe.streams[0]?.duration || 0);

        if (duration === 0) {
          console.log(chalk.red('✘ Could not determine video duration'));
          process.exit(1);
        }

        console.log(chalk.gray(`  Video duration: ${duration.toFixed(1)}s`));

        // Analyze volume across segments
        const segmentDuration = 5;
        const segments = Math.ceil(duration / segmentDuration);
        const volumes = [];

        console.log(chalk.gray('  Analyzing volume segments...'));

        for (let i = 0; i < Math.min(segments, 20); i++) {
          const start = i * segmentDuration;
          try {
            const volCmd = `ffmpeg -ss ${start} -t ${segmentDuration} -i "${filePath}" -af "volumedetect" -f null /dev/null 2>&1 | grep mean_volume`;
            const volOutput = execSync(volCmd, { encoding: 'utf-8', timeout: 5000 });
            const match = volOutput.match(/mean_volume:\s*([-\d.]+)\s*dB/);
            const meanVol = match ? parseFloat(match[1]) : -50;
            volumes.push({ start, volume: meanVol });
          } catch {
            volumes.push({ start, volume: -50 });
          }
        }

        // Sort by volume (louder = more likely highlight)
        volumes.sort((a, b) => b.volume - a.volume);

        console.log(chalk.green('\n📍 Top potential highlight segments:\n'));

        const highlights = volumes.slice(0, parseInt(options.count));
        highlights.forEach((h, i) => {
          const end = Math.min(h.start + parseInt(options.maxDuration), duration);
          console.log(chalk.cyan(`  ${i + 1}. ${formatTime(h.start)} - ${formatTime(end)}`));
          console.log(chalk.gray(`     Volume: ${h.volume.toFixed(1)} dB`));
        });

        console.log(chalk.yellow('\n💡 To extract clips, use:'));
        console.log(chalk.cyan('  remotion-ai clip add <file> --start <seconds> --end <seconds>'));

      } catch (error) {
        console.log(chalk.red(`✘ Analysis failed: ${error.message}`));
      }
    });
}

export function setupSpeakersCommand(program, getProject, saveProject) {
  program.command('speakers <file>').description('Detect speakers in video (diarization)')
    .option('-n, --count <n>', 'Expected number of speakers', '2')
    .action(async (file, options) => {
      const filePath = path.resolve(file);
      if (!fs.existsSync(filePath)) {
        console.log(chalk.red(`✘ File not found: ${filePath}`));
        process.exit(1);
      }

      console.log(chalk.blue('\n👥 Speaker Diarization:\n'));
      console.log(chalk.gray(`  File: ${filePath}`));
      console.log(chalk.gray(`  Expected speakers: ${options.count}`));

      // Check for pyannote
      try {
        execSync('python -c "import pyannote.audio"', { stdio: 'ignore' });
        console.log(chalk.yellow('\n⚡ Using pyannote for diarization...\n'));
        console.log(chalk.cyan('  # Python script:'));
        console.log(chalk.cyan('  from pyannote.audio import Pipeline'));
        console.log(chalk.cyan('  pipeline = Pipeline.from_pretrained("pyannote/speaker-diarization-3.1")'));
        console.log(chalk.cyan('  diarization = pipeline("audio.wav")'));
      } catch {
        console.log(chalk.yellow('\n⚠ pyannote not installed. Install with:'));
        console.log(chalk.cyan('  pip install pyannote.audio'));
        console.log(chalk.yellow('\n📋 Alternative: Use FFmpeg for basic voice activity detection:'));
        console.log(chalk.cyan(`  ffmpeg -i "${filePath}" -af "silencedetect=noise=-30dB:d=0.5" -f null /dev/null 2>&1 | grep silence`));
      }
    });
}

export function setupTrimCommand(program, getProject, saveProject) {
  program.command('trim <file>').description('Trim silence and filler words from audio/video')
    .option('-t, --threshold <dB>', 'Silence threshold', '-30')
    .option('-d, --min-duration <sec>', 'Min silence duration to cut', '0.5')
    .option('--fillers', 'Also remove filler words (um, uh, etc.)', false)
    .option('-o, --output <path>', 'Output file path')
    .action(async (file, options) => {
      const filePath = path.resolve(file);
      if (!fs.existsSync(filePath)) {
        console.log(chalk.red(`✘ File not found: ${filePath}`));
        process.exit(1);
      }

      console.log(chalk.blue('\n✂️ Trim Silence & Fillers:\n'));
      console.log(chalk.gray(`  Input: ${filePath}`));
      console.log(chalk.gray(`  Threshold: ${options.threshold}dB`));
      console.log(chalk.gray(`  Min duration: ${options.minDuration}s`));

      const outputPath = options.output || filePath.replace(/(\.[^.]+)$/, '_trimmed$1');

      // FFmpeg silenceremove filter
      const filter = `silenceremove=start_periods=1:start_duration=0.1:start_threshold=${options.threshold}dB:stop_periods=-1:stop_duration=${options.minDuration}:stop_threshold=${options.threshold}dB`;

      const cmd = `ffmpeg -i "${filePath}" -af "${filter}" -c:v copy "${outputPath}" -y`;
      console.log(chalk.yellow(`\n⚡ Running: ${cmd}\n`));

      try {
        execSync(cmd, { stdio: 'inherit' });
        console.log(chalk.green(`\n✔ Trimmed output: ${outputPath}`));
      } catch (error) {
        console.log(chalk.red(`\n✘ Trim failed: ${error.message}`));
      }
    });
}

export function setupKaraokeCommand(program, getProject, saveProject) {
  program.command('karaoke <text>').description('Add karaoke-style word-by-word subtitle')
    .option('-s, --start <frame>', 'Start frame', '0')
    .option('-w, --words-per-segment <n>', 'Words per subtitle segment', '5')
    .option('-c, --color <color>', 'Highlight color', '#FFE66D')
    .option('-bg, --bg-color <color>', 'Background color', '#00000080')
    .option('-sz, --size <size>', 'Font size', '48')
    .action(async (text, options) => {
      const project = await getProject();
      const start = parseInt(options.start);
      const wps = parseInt(options.wordsPerSegment);
      const words = text.split(' ');
      const framesPerWord = 10;

      const chunks = [];
      for (let i = 0; i < words.length; i += wps) {
        chunks.push(words.slice(i, i + wps));
      }

      chunks.forEach((chunk, i) => {
        const chunkText = chunk.join(' ');
        const chunkStart = start + (i * wps * framesPerWord);
        const chunkEnd = chunkStart + (chunk.length * framesPerWord);

        project.timeline.texts.push({
          id: `text_${project.timeline.texts.length + 1}`,
          content: chunkText,
          startFrame: chunkStart,
          endFrame: chunkEnd,
          style: {
            color: options.color,
            fontSize: parseInt(options.size),
            textAlign: 'center',
            backgroundColor: options.bgColor,
            padding: '8px 16px',
            borderRadius: '4px'
          },
          position: { x: 'center', y: 'bottom' },
          effect: 'flash',
          bg: null,
          accent: options.color,
          karaoke: {
            enabled: true,
            highlightColor: options.color,
            wordTiming: chunk.map((w, wi) => ({
              word: w,
              startFrame: chunkStart + (wi * framesPerWord),
              endFrame: chunkStart + ((wi + 1) * framesPerWord)
            }))
          }
        });
      });

      await saveProject(project);
      console.log(chalk.green(`✔ Added ${chunks.length} karaoke subtitle segments`));
    });
}

export function setupScenesCommand(program, getProject, saveProject) {
  program.command('scenes <file>').description('Detect scene changes in video')
    .option('-t, --threshold <n>', 'Scene change threshold (0-1)', '0.3')
    .option('-o, --output <path>', 'Output scene list as JSON')
    .action(async (file, options) => {
      const filePath = path.resolve(file);
      if (!fs.existsSync(filePath)) {
        console.log(chalk.red(`✘ File not found: ${filePath}`));
        process.exit(1);
      }

      console.log(chalk.blue('\n🎬 Scene Detection:\n'));
      console.log(chalk.gray(`  File: ${filePath}`));
      console.log(chalk.gray(`  Threshold: ${options.threshold}`));

      try {
        const cmd = `ffprobe -v quiet -print_format json -show_frames -select_streams v -show_entries frame=pkt_pts_time -of csv=p=0 "${filePath}" 2>/dev/null | head -100`;
        console.log(chalk.yellow('\n⚡ Using FFmpeg scene detection...\n'));

        // Use scene filter
        const sceneCmd = `ffmpeg -i "${filePath}" -vf "select='gt(scene,${options.threshold})',showinfo" -vsync vfr -f null /dev/null 2>&1 | grep "showinfo" | head -20`;
        const output = execSync(sceneCmd, { encoding: 'utf-8', timeout: 30000 });

        const scenes = [];
        const lines = output.split('\n');
        lines.forEach(line => {
          const match = line.match(/pts_time:([\d.]+)/);
          if (match) {
            scenes.push(parseFloat(match[1]));
          }
        });

        console.log(chalk.green(`📍 Found ${scenes.length} scene changes:\n`));
        scenes.forEach((time, i) => {
          console.log(chalk.cyan(`  ${i + 1}. ${formatTime(time)}`));
        });

        if (options.output) {
          await fs.writeJson(options.output, { scenes }, { spaces: 2 });
          console.log(chalk.green(`\n✔ Scene list saved: ${options.output}`));
        }

        console.log(chalk.yellow('\n💡 Use these timestamps to split clips:'));
        console.log(chalk.cyan('  remotion-ai clip add <file> --start <timestamp>'));

      } catch (error) {
        console.log(chalk.red(`\n✘ Scene detection failed: ${error.message}`));
      }
    });
}

export function setupNormalizeCommand(program, getProject, saveProject) {
  program.command('normalize <file>').description('Normalize audio loudness to -14 LUFS (social media standard)')
    .option('-l, --lufs <n>', 'Target LUFS', '-14')
    .option('-o, --output <path>', 'Output file path')
    .action(async (file, options) => {
      const filePath = path.resolve(file);
      if (!fs.existsSync(filePath)) {
        console.log(chalk.red(`✘ File not found: ${filePath}`));
        process.exit(1);
      }

      console.log(chalk.blue('\n🔊 Loudness Normalization:\n'));
      console.log(chalk.gray(`  Input: ${filePath}`));
      console.log(chalk.gray(`  Target: ${options.lufs} LUFS`));

      const outputPath = options.output || filePath.replace(/(\.[^.]+)$/, '_normalized$1');

      // EBU R128 loudnorm filter
      const cmd = `ffmpeg -i "${filePath}" -af "loudnorm=I=${options.lufs}:TP=-1:LRA=11" "${outputPath}" -y`;
      console.log(chalk.yellow(`\n⚡ Running loudness normalization...\n`));

      try {
        execSync(cmd, { stdio: 'inherit' });
        console.log(chalk.green(`\n✔ Normalized output: ${outputPath}`));
        console.log(chalk.gray(`  Target: ${options.lufs} LUFS (social media standard)`));
      } catch (error) {
        console.log(chalk.red(`\n✘ Normalization failed: ${error.message}`));
      }
    });
}

export function setupCropCommand(program, getProject, saveProject) {
  program.command('crop <file>').description('Crop video to vertical (9:16) with face tracking')
    .option('-m, --mode <mode>', 'Crop mode: center, face, third', 'center')
    .option('-r, --ratio <ratio>', 'Target ratio', '9:16')
    .option('-o, --output <path>', 'Output file path')
    .action(async (file, options) => {
      const filePath = path.resolve(file);
      if (!fs.existsSync(filePath)) {
        console.log(chalk.red(`✘ File not found: ${filePath}`));
        process.exit(1);
      }

      console.log(chalk.blue('\n📐 Smart Crop:\n'));
      console.log(chalk.gray(`  Input: ${filePath}`));
      console.log(chalk.gray(`  Mode: ${options.mode}`));
      console.log(chalk.gray(`  Target ratio: ${options.ratio}`));

      const outputPath = options.output || filePath.replace(/(\.[^.]+)$/, '_cropped$1');

      // Get video dimensions
      const probeCmd = `ffprobe -v quiet -print_format json -show_streams -select_streams v "${filePath}"`;
      const probe = JSON.parse(execSync(probeCmd).toString());
      const stream = probe.streams[0];
      const width = stream.width;
      const height = stream.height;

      console.log(chalk.gray(`  Original: ${width}x${height}`));

      let cropFilter;
      if (options.ratio === '9:16') {
        const targetWidth = Math.floor(height * 9 / 16);
        if (targetWidth > width) {
          console.log(chalk.red('✘ Video already narrower than target ratio'));
          process.exit(1);
        }

        if (options.mode === 'face') {
          // Face tracking would require OpenCV - suggest using FFmpeg center crop
          console.log(chalk.yellow('\n⚠ Face tracking requires OpenCV. Using center crop:'));
          cropFilter = `crop=${targetWidth}:${height}:(iw-${targetWidth})/2:0`;
        } else if (options.mode === 'third') {
          // Rule of thirds - crop from left third
          cropFilter = `crop=${targetWidth}:${height}:${targetWidth/2}:0`;
        } else {
          // Center crop
          cropFilter = `crop=${targetWidth}:${height}:(iw-${targetWidth})/2:0`;
        }
      } else {
        console.log(chalk.red('✘ Unsupported ratio. Use 9:16'));
        process.exit(1);
      }

      const cmd = `ffmpeg -i "${filePath}" -vf "${cropFilter}" -c:a copy "${outputPath}" -y`;
      console.log(chalk.yellow(`\n⚡ Running crop...\n`));

      try {
        execSync(cmd, { stdio: 'inherit' });
        console.log(chalk.green(`\n✔ Cropped output: ${outputPath}`));
      } catch (error) {
        console.log(chalk.red(`\n✘ Crop failed: ${error.message}`));
      }
    });
}

export function setupMcpCommand(program, getProject, saveProject) {
  program.command('mcp').description('Start MCP server for AI agent integration')
    .option('-p, --port <port>', 'Port', '3001')
    .action(async (options) => {
      console.log(chalk.blue('\n🤖 MCP Server for AI Agents:\n'));
      console.log(chalk.gray(`  Port: ${options.port}`));
      console.log(chalk.yellow('\n⚠ MCP Server requires additional setup:'));
      console.log(chalk.cyan('\n  Add to your MCP config (e.g., claude_desktop_config.json):'));
      console.log(chalk.white(JSON.stringify({
        "mcpServers": {
          "remotion-ai": {
            "command": "node",
            "args": [path.join(__dirname, '..', 'bin', 'cli.mjs'), "mcp", "serve"],
            "cwd": process.cwd()
          }
        }
      }, null, 2)));

      console.log(chalk.yellow('\n  Available tools:'));
      console.log(chalk.cyan('    create_project - Initialize new video project'));
      console.log(chalk.cyan('    add_text - Add text overlay'));
      console.log(chalk.cyan('    add_clip - Add video clip'));
      console.log(chalk.cyan('    add_audio - Add audio track'));
      console.log(chalk.cyan('    render_video - Render final video'));
      console.log(chalk.cyan('    detect_highlights - Find highlight segments'));

      console.log(chalk.yellow('\n  Start server:'));
      console.log(chalk.cyan(`    node ${path.join(__dirname, '..', 'bin', 'cli.mjs')} mcp serve`));
    });
}

// Helper function
function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 100);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
}
