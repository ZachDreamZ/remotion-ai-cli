#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import fs from 'fs-extra';
import path from 'path';
import { execSync } from 'child_process';
import os from 'os';

const PROJECT_ROOT = process.cwd();
const CONFIG_DIR = path.join(PROJECT_ROOT, '.remotion-ai');
const PROJECT_PATH = path.join(CONFIG_DIR, 'project.json');
const ASSETS_DIR = path.join(PROJECT_ROOT, 'public');
const DOWNLOADS_DIR = path.join(os.homedir(), 'Downloads', 'remotion-ai-renders');

// Create MCP server
const server = new Server(
  {
    name: 'remotion-ai',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'init-project',
        description: 'Initialize a new Remotion video project',
        inputSchema: {
          type: 'object',
          properties: {},
          required: [],
        },
      },
      {
        name: 'add-clip',
        description: 'Add a video clip to the project timeline',
        inputSchema: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'Path to the video file' },
            start: { type: 'number', description: 'Start frame on timeline' },
            end: { type: 'number', description: 'End frame on timeline' },
          },
          required: ['path'],
        },
      },
      {
        name: 'add-text',
        description: 'Add a text overlay to the video',
        inputSchema: {
          type: 'object',
          properties: {
            content: { type: 'string', description: 'Text content' },
            start: { type: 'number', description: 'Start frame' },
            end: { type: 'number', description: 'End frame' },
            color: { type: 'string', description: 'Text color' },
            fontSize: { type: 'number', description: 'Font size' },
            effect: { type: 'string', description: 'Text effect: none, kinetic, liquid, shader, typewriter, wave, glitch, bounce, scale' },
          },
          required: ['content'],
        },
      },
      {
        name: 'add-audio',
        description: 'Add an audio track to the video',
        inputSchema: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'Path to the audio file' },
            volume: { type: 'number', description: 'Volume (0.0 to 1.0)' },
          },
          required: ['path'],
        },
      },
      {
        name: 'remove-clip',
        description: 'Remove a clip from the timeline by ID',
        inputSchema: {
          type: 'object',
          properties: { id: { type: 'string', description: 'Clip ID' } },
          required: ['id'],
        },
      },
      {
        name: 'remove-text',
        description: 'Remove a text overlay by ID',
        inputSchema: {
          type: 'object',
          properties: { id: { type: 'string', description: 'Text ID' } },
          required: ['id'],
        },
      },
      {
        name: 'render-video',
        description: 'Render the current project to an MP4 file',
        inputSchema: {
          type: 'object',
          properties: {
            output: { type: 'string', description: 'Output filename' },
          },
          required: [],
        },
      },
      {
        name: 'get-project',
        description: 'Get current project state',
        inputSchema: {
          type: 'object',
          properties: {},
          required: [],
        },
      },
    ],
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'init-project': {
        await fs.ensureDir(CONFIG_DIR);
        await fs.ensureDir(ASSETS_DIR);
        const defaultProject = {
          settings: { width: 1080, height: 1920, fps: 30, durationInFrames: 300 },
          assets: {},
          timeline: { clips: [], texts: [], audio: [] },
        };
        await fs.writeJson(PROJECT_PATH, defaultProject, { spaces: 2 });
        return { content: [{ type: 'text', text: 'Project initialized successfully.' }] };
      }

      case 'add-clip': {
        const project = await fs.readJson(PROJECT_PATH);
        const assetId = `asset_${Object.keys(project.assets).length + 1}`;
        const fileName = path.basename(args.path);
        const destPath = path.join(ASSETS_DIR, fileName);
        
        await fs.ensureDir(ASSETS_DIR);
        if (path.resolve(args.path) !== destPath) {
          await fs.copy(args.path, destPath);
        }
        project.assets[assetId] = `/${fileName}`;
        
        const clipId = `clip_${project.timeline.clips.length + 1}`;
        project.timeline.clips.push({
          id: clipId,
          assetId: assetId,
          startFrame: args.start || 0,
          endFrame: args.end || (args.start || 0) + 60,
          trimStart: 0,
          trimEnd: (args.end || 60) - (args.start || 0),
          transition: 'fade',
        });
        
        await fs.writeJson(PROJECT_PATH, project, { spaces: 2 });
        return { content: [{ type: 'text', text: `Added clip ${clipId} using ${args.path}` }] };
      }

      case 'add-text': {
        const project = await fs.readJson(PROJECT_PATH);
        const textId = `text_${project.timeline.texts.length + 1}`;
        project.timeline.texts.push({
          id: textId,
          content: args.content,
          startFrame: args.start || 0,
          endFrame: args.end || 60,
          style: { color: args.color || 'white', fontSize: args.fontSize || 80 },
          position: { x: 'center', y: 'center' },
          effect: args.effect || 'none',
        });
        
        await fs.writeJson(PROJECT_PATH, project, { spaces: 2 });
        return { content: [{ type: 'text', text: `Added text ${textId}: "${args.content}"` + (args.effect ? ` [${args.effect}]` : '') }] };
      }

      case 'add-audio': {
        const project = await fs.readJson(PROJECT_PATH);
        const audioAssetId = `audio_asset_${Object.keys(project.assets).length + 1}`;
        const audioFileName = path.basename(args.path);
        const audioDestPath = path.join(ASSETS_DIR, audioFileName);
        await fs.ensureDir(ASSETS_DIR);
        if (path.resolve(args.path) !== audioDestPath) {
          await fs.copy(args.path, audioDestPath);
        }
        project.assets[audioAssetId] = `/${audioFileName}`;
        const audioId = `audio_${project.timeline.audio.length + 1}`;
        project.timeline.audio.push({ id: audioId, assetId: audioAssetId, startFrame: 0, duration: project.settings.durationInFrames, volume: args.volume || 0.5 });
        await fs.writeJson(PROJECT_PATH, project, { spaces: 2 });
        return { content: [{ type: 'text', text: `Added audio ${audioId} from ${args.path}` }] };
      }

      case 'remove-clip': {
        const project = await fs.readJson(PROJECT_PATH);
        project.timeline.clips = project.timeline.clips.filter(c => c.id !== args.id);
        await fs.writeJson(PROJECT_PATH, project, { spaces: 2 });
        return { content: [{ type: 'text', text: `Removed clip ${args.id}` }] };
      }

      case 'remove-text': {
        const project = await fs.readJson(PROJECT_PATH);
        project.timeline.texts = project.timeline.texts.filter(t => t.id !== args.id);
        await fs.writeJson(PROJECT_PATH, project, { spaces: 2 });
        return { content: [{ type: 'text', text: `Removed text ${args.id}` }] };
      }

      case 'render-video': {
        const outputPath = path.join(DOWNLOADS_DIR, args.output || 'render.mp4');
        await fs.ensureDir(DOWNLOADS_DIR);
        
        execSync('npx remotion render src/index.tsx Main', { stdio: 'inherit' });
        
        const tempOutput = path.join(PROJECT_ROOT, 'out', 'Main.mp4');
        await fs.copy(tempOutput, outputPath);
        
        return { content: [{ type: 'text', text: `Rendered video to ${outputPath}` }] };
      }

      case 'get-project': {
        const project = await fs.readJson(PROJECT_PATH);
        return { content: [{ type: 'text', text: JSON.stringify(project, null, 2) }] };
      }

      default:
        return { content: [{ type: 'text', text: `Unknown tool: ${name}` }], isError: true };
    }
  } catch (error) {
    return { content: [{ type: 'text', text: `Error: ${error.message}` }], isError: true };
  }
});

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Remotion AI MCP server running on stdio');
}

main().catch(console.error);
