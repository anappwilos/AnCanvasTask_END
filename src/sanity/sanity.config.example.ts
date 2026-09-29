// @ts-nocheck
/**
 * Example Sanity Studio configuration (sanity.config.ts)
 * Copy this file to your Sanity Studio project.
 */
import { defineConfig } from 'sanity';
import { structureTool } from 'sanity/structure';
import { schemaTypes } from './schemas';

export default defineConfig({
  name: 'default',
  title: 'AnTaskCanvas Studio',

  projectId: process.env.SANITY_STUDIO_PROJECT_ID || 'tu-project-id',
  dataset: process.env.SANITY_STUDIO_DATASET || 'production',

  plugins: [structureTool()],

  schema: {
    types: schemaTypes,
  },
});
