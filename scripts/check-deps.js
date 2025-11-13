#!/usr/bin/env node

/**
 * node_modules 존재 여부를 확인하고 없으면 npm install 실행
 * Windows/Linux/Mac 모두 지원
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const nodeModulesPath = path.join(__dirname, '..', 'node_modules');

console.log('🔍 Checking for dependencies...');

if (!fs.existsSync(nodeModulesPath)) {
  console.log('⚠️  node_modules not found. Installing dependencies...');
  try {
    execSync('npm install', {
      stdio: 'inherit',
      cwd: path.join(__dirname, '..')
    });
    console.log('✅ Dependencies installed successfully');
  } catch (error) {
    console.error('❌ Failed to install dependencies');
    process.exit(1);
  }
} else {
  console.log('✅ Dependencies already installed');
}
