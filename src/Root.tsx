import React from 'react';
import { Composition } from 'remotion';
import { MainComposition } from './Composition';
import project from '../.remotion-ai/project.json';

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="Main"
        component={MainComposition}
        durationInFrames={project.settings.durationInFrames}
        fps={project.settings.fps}
        width={project.settings.width}
        height={project.settings.height}
      />
    </>
  );
};
