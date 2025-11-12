import path from 'node:path';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

export interface DistCleanupOptions {
	distDir?: string;
	nestedDirs?: string[];
}

const DEFAULT_NESTED_DIRS = ['src', 'api'];

/**
 * Flattens nested build outputs such as dist/src or dist/api so runtime imports
 * line up with the source tree layout.
 *
 * The function is exported so it can be re-used by other scripts (e.g. register).
 */
export async function cleanupDistArtifacts(options: DistCleanupOptions = {}): Promise<void> {
	const { distDir = 'dist', nestedDirs = DEFAULT_NESTED_DIRS } = options;
	const resolvedDistDir = path.resolve(process.cwd(), distDir);

	if (!(await pathExists(resolvedDistDir))) {
		console.warn(`[postbuild] Skipping cleanup, directory not found: ${resolvedDistDir}`);
		return;
	}

	for (const nested of nestedDirs) {
		const nestedPath = path.join(resolvedDistDir, nested);

		if (!(await pathExists(nestedPath))) {
			continue;
		}

		await moveChildrenInto(nestedPath, resolvedDistDir);
		await fs.rm(nestedPath, { recursive: true, force: true });
		console.info(`[postbuild] Flattened ${path.relative(process.cwd(), nestedPath)}`);
	}
}

async function moveChildrenInto(sourceDir: string, targetDir: string): Promise<void> {
	const entries = await fs.readdir(sourceDir);

	for (const entry of entries) {
		const from = path.join(sourceDir, entry);
		const to = path.join(targetDir, entry);
		await moveEntry(from, to);
	}
}

async function moveEntry(sourcePath: string, targetPath: string): Promise<void> {
	await fs.rm(targetPath, { recursive: true, force: true }).catch(() => undefined);
	await fs.mkdir(path.dirname(targetPath), { recursive: true });

	try {
		await fs.rename(sourcePath, targetPath);
	} catch (error) {
		const code = (error as NodeJS.ErrnoException).code;
		if (code === 'EXDEV') {
			await fs.cp(sourcePath, targetPath, { recursive: true });
			await fs.rm(sourcePath, { recursive: true, force: true });
		} else {
			throw error;
		}
	}
}

async function pathExists(targetPath: string): Promise<boolean> {
	try {
		await fs.access(targetPath);
		return true;
	} catch {
		return false;
	}
}

function isRunDirectly(): boolean {
	const executed = process.argv[1] ? path.resolve(process.argv[1]) : '';
	const modulePath = fileURLToPath(import.meta.url);
	return executed === modulePath;
}

if (isRunDirectly()) {
	cleanupDistArtifacts().catch((error) => {
		console.error('[postbuild] Failed to clean dist directory:', error);
		process.exitCode = 1;
	});
}
