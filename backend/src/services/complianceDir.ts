import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { COMPLIANCE_DIR } from '../config.js';

export function jobDir(jobId: string): string {
  return path.join(COMPLIANCE_DIR, jobId);
}

export function initDir(jobId: string): string {
  const dir = jobDir(jobId);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function sha256File(filePath: string): string {
  const buf = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(buf).digest('hex');
}

interface ManifestEntry {
  name: string;
  sha256: string;
  size: number;
  createdAt: string;
}

interface Manifest {
  jobId: string;
  createdAt: string;
  files: ManifestEntry[];
}

function readManifest(jobId: string): Manifest {
  const manifestPath = path.join(jobDir(jobId), 'manifest.json');
  if (!fs.existsSync(manifestPath)) {
    return { jobId, createdAt: new Date().toISOString(), files: [] };
  }
  return JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as Manifest;
}

function writeManifest(jobId: string, manifest: Manifest): void {
  const manifestPath = path.join(jobDir(jobId), 'manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
}

export function writeFile(jobId: string, name: string, content: string | Buffer): string {
  const dir = initDir(jobId);
  const filePath = path.join(dir, name);
  fs.writeFileSync(filePath, content);

  const manifest = readManifest(jobId);
  const existing = manifest.files.findIndex(f => f.name === name);
  const entry: ManifestEntry = {
    name,
    sha256: sha256File(filePath),
    size: fs.statSync(filePath).size,
    createdAt: new Date().toISOString(),
  };
  if (existing >= 0) {
    manifest.files[existing] = entry;
  } else {
    manifest.files.push(entry);
  }
  writeManifest(jobId, manifest);
  return filePath;
}

export function appendEvent(jobId: string, event: Record<string, unknown>): void {
  const dir = initDir(jobId);
  const eventsPath = path.join(dir, 'events.jsonl');
  const line = JSON.stringify({ ts: new Date().toISOString(), ...event }) + '\n';
  fs.appendFileSync(eventsPath, line);
}

export function buildManifest(jobId: string): Manifest {
  const dir = jobDir(jobId);
  if (!fs.existsSync(dir)) return { jobId, createdAt: new Date().toISOString(), files: [] };

  const files = fs.readdirSync(dir)
    .filter(f => f !== 'manifest.json')
    .map(name => {
      const filePath = path.join(dir, name);
      return {
        name,
        sha256: sha256File(filePath),
        size: fs.statSync(filePath).size,
        createdAt: fs.statSync(filePath).birthtime.toISOString(),
      };
    });

  const manifest: Manifest = { jobId, createdAt: new Date().toISOString(), files };
  writeManifest(jobId, manifest);
  return manifest;
}
