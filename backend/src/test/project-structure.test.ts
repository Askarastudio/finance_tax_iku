import { test, expect } from 'bun:test';
import * as fc from 'fast-check';
import { existsSync, statSync } from 'fs';
import { join } from 'path';

/**
 * **Feature: finance-tax-compliance, Property 1: Project structure consistency**
 * **Validates: Requirements 1.1, 2.1**
 * 
 * For any valid project structure, all required directories and configuration files
 * must exist and be properly configured for the finance and tax compliance system.
 */

// Define the expected project structure
const REQUIRED_BACKEND_DIRECTORIES = [
  'src',
  'src/controllers',
  'src/services', 
  'src/repositories',
  'src/models',
  'src/db',
  'src/db/schema',
  'src/utils',
  'src/types'
];

const REQUIRED_FRONTEND_DIRECTORIES = [
  'src',
  'src/components',
  'src/pages',
  'src/hooks',
  'src/store',
  'src/utils',
  'src/types',
  'src/lib'
];

const REQUIRED_ROOT_FILES = [
  'package.json',
  'tsconfig.json',
  'README.md',
  '.gitignore'
];

const REQUIRED_BACKEND_FILES = [
  'package.json',
  'tsconfig.json',
  'drizzle.config.ts',
  '.env.example',
  'src/index.ts',
  'src/db/connection.ts',
  'src/db/migrate.ts',
  'src/db/schema/index.ts'
];

const REQUIRED_FRONTEND_FILES = [
  'package.json',
  'tsconfig.json',
  'tsconfig.node.json',
  'vite.config.ts',
  'tailwind.config.js',
  'postcss.config.js',
  'index.html',
  'src/main.tsx',
  'src/App.tsx',
  'src/index.css',
  'src/test/setup.ts'
];

function getProjectRoot(): string {
  // Navigate up from backend/src/test to project root
  return join(__dirname, '../../..');
}

function checkDirectoryExists(basePath: string, directory: string): boolean {
  const fullPath = join(basePath, directory);
  return existsSync(fullPath) && statSync(fullPath).isDirectory();
}

function checkFileExists(basePath: string, file: string): boolean {
  const fullPath = join(basePath, file);
  return existsSync(fullPath) && statSync(fullPath).isFile();
}

test('Property 1: Project structure consistency - Root structure', () => {
  const projectRoot = getProjectRoot();
  
  // Check that backend and frontend directories exist
  expect(checkDirectoryExists(projectRoot, 'backend')).toBe(true);
  expect(checkDirectoryExists(projectRoot, 'frontend')).toBe(true);
  
  // Check required root files
  for (const file of REQUIRED_ROOT_FILES) {
    expect(checkFileExists(projectRoot, file)).toBe(true);
  }
});

test('Property 1: Project structure consistency - Backend structure', () => {
  const projectRoot = getProjectRoot();
  const backendPath = join(projectRoot, 'backend');
  
  // Check required backend directories
  for (const directory of REQUIRED_BACKEND_DIRECTORIES) {
    expect(checkDirectoryExists(backendPath, directory)).toBe(true);
  }
  
  // Check required backend files
  for (const file of REQUIRED_BACKEND_FILES) {
    expect(checkFileExists(backendPath, file)).toBe(true);
  }
});

test('Property 1: Project structure consistency - Frontend structure', () => {
  const projectRoot = getProjectRoot();
  const frontendPath = join(projectRoot, 'frontend');
  
  // Check required frontend directories
  for (const directory of REQUIRED_FRONTEND_DIRECTORIES) {
    expect(checkDirectoryExists(frontendPath, directory)).toBe(true);
  }
  
  // Check required frontend files
  for (const file of REQUIRED_FRONTEND_FILES) {
    expect(checkFileExists(frontendPath, file)).toBe(true);
  }
});

test('Property 1: Project structure consistency - Package.json workspace configuration', () => {
  const projectRoot = getProjectRoot();
  const packageJsonPath = join(projectRoot, 'package.json');
  
  expect(checkFileExists(projectRoot, 'package.json')).toBe(true);
  
  // Read and validate package.json structure
  const packageJson = require(packageJsonPath);
  
  // Check workspace configuration
  expect(packageJson.workspaces).toBeDefined();
  expect(packageJson.workspaces).toContain('backend');
  expect(packageJson.workspaces).toContain('frontend');
  
  // Check essential scripts
  expect(packageJson.scripts).toBeDefined();
  expect(packageJson.scripts['dev']).toBeDefined();
  expect(packageJson.scripts['build']).toBeDefined();
  expect(packageJson.scripts['test']).toBeDefined();
});

test('Property 1: Project structure consistency - TypeScript configuration', () => {
  const projectRoot = getProjectRoot();
  
  // Check root tsconfig.json
  const rootTsConfigPath = join(projectRoot, 'tsconfig.json');
  expect(checkFileExists(projectRoot, 'tsconfig.json')).toBe(true);
  
  const rootTsConfig = require(rootTsConfigPath);
  expect(rootTsConfig.references).toBeDefined();
  expect(rootTsConfig.references.some((ref: any) => ref.path === './backend')).toBe(true);
  expect(rootTsConfig.references.some((ref: any) => ref.path === './frontend')).toBe(true);
  
  // Check backend tsconfig.json
  const backendTsConfigPath = join(projectRoot, 'backend', 'tsconfig.json');
  expect(checkFileExists(join(projectRoot, 'backend'), 'tsconfig.json')).toBe(true);
  
  const backendTsConfig = require(backendTsConfigPath);
  expect(backendTsConfig.compilerOptions.baseUrl).toBe('./src');
  expect(backendTsConfig.compilerOptions.paths).toBeDefined();
  
  // Check frontend tsconfig.json
  const frontendTsConfigPath = join(projectRoot, 'frontend', 'tsconfig.json');
  expect(checkFileExists(join(projectRoot, 'frontend'), 'tsconfig.json')).toBe(true);
  
  const frontendTsConfig = require(frontendTsConfigPath);
  expect(frontendTsConfig.compilerOptions.baseUrl).toBe('./src');
  expect(frontendTsConfig.compilerOptions.paths).toBeDefined();
});

// Property-based test using fast-check
test('Property 1: Project structure consistency - Property-based validation', () => {
  fc.assert(
    fc.property(
      fc.constantFrom(...REQUIRED_BACKEND_DIRECTORIES),
      (directory) => {
        const projectRoot = getProjectRoot();
        const backendPath = join(projectRoot, 'backend');
        
        // For any required backend directory, it must exist
        return checkDirectoryExists(backendPath, directory);
      }
    ),
    { numRuns: 100 }
  );
  
  fc.assert(
    fc.property(
      fc.constantFrom(...REQUIRED_FRONTEND_DIRECTORIES),
      (directory) => {
        const projectRoot = getProjectRoot();
        const frontendPath = join(projectRoot, 'frontend');
        
        // For any required frontend directory, it must exist
        return checkDirectoryExists(frontendPath, directory);
      }
    ),
    { numRuns: 100 }
  );
  
  fc.assert(
    fc.property(
      fc.constantFrom(...REQUIRED_BACKEND_FILES),
      (file) => {
        const projectRoot = getProjectRoot();
        const backendPath = join(projectRoot, 'backend');
        
        // For any required backend file, it must exist
        return checkFileExists(backendPath, file);
      }
    ),
    { numRuns: 100 }
  );
  
  fc.assert(
    fc.property(
      fc.constantFrom(...REQUIRED_FRONTEND_FILES),
      (file) => {
        const projectRoot = getProjectRoot();
        const frontendPath = join(projectRoot, 'frontend');
        
        // For any required frontend file, it must exist
        return checkFileExists(frontendPath, file);
      }
    ),
    { numRuns: 100 }
  );
});