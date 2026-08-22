import { spawn, execSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const backendDir = path.resolve(__dirname, '..', 'navigation-backend');

function findPythonCommand() {
  // Ordered by priority: Windows py launcher specific version, general py launcher, python3, python
  const candidates = [
    { cmd: 'py', args: ['-3.12', '--version'] },
    { cmd: 'py', args: ['-3', '--version'] },
    { cmd: 'py', args: ['--version'] },
    { cmd: 'python3', args: ['--version'] },
    { cmd: 'python', args: ['--version'] }
  ];

  for (const candidate of candidates) {
    try {
      execSync(`${candidate.cmd} ${candidate.args.join(' ')}`, { stdio: 'ignore' });
      return candidate.args.length > 1 && candidate.args[0].startsWith('-3')
        ? { cmd: candidate.cmd, baseArgs: [candidate.args[0]] }
        : { cmd: candidate.cmd, baseArgs: [] };
    } catch {
      // Continue to next candidate
    }
  }

  // Default fallback for Windows py -3.12 or python
  return process.platform === 'win32'
    ? { cmd: 'py', baseArgs: ['-3.12'] }
    : { cmd: 'python3', baseArgs: [] };
}

const pyLauncher = findPythonCommand();
const fullArgs = [...pyLauncher.baseArgs, '-m', 'uvicorn', 'main:app', '--host', '0.0.0.0', '--port', '8000', '--reload'];

console.log(`[AccessTwin Backend] Launching FastAPI using: ${pyLauncher.cmd} ${fullArgs.join(' ')} in ${backendDir}`);

const child = spawn(pyLauncher.cmd, fullArgs, {
  cwd: backendDir,
  stdio: 'inherit',
  shell: true,
  env: {
    ...process.env,
    PYTHONUNBUFFERED: '1'
  }
});

child.on('error', (err) => {
  console.warn(`[AccessTwin Backend] Notice: Could not launch python process (${err.message}). Node proxy fallback active.`);
});

child.on('exit', (code, signal) => {
  if (code !== 0 && code !== null) {
    console.log(`[AccessTwin Backend] Process exited with code ${code}. Node proxy fallback active.`);
  }
});

process.on('SIGINT', () => {
  child.kill('SIGINT');
  process.exit(0);
});

process.on('SIGTERM', () => {
  child.kill('SIGTERM');
  process.exit(0);
});
