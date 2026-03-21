import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export interface ExecResult {
	stdout: string;
	stderr: string;
}

/**
 * Execute a command and return stdout/stderr.
 * Throws if the command exits with non-zero status.
 */
export async function execCommand(
	command: string,
	args: string[],
	options?: { stdin?: string; cwd?: string },
): Promise<ExecResult> {
	if (options?.stdin !== undefined) {
		return new Promise<ExecResult>((resolve, reject) => {
			const child = execFile(command, args, { cwd: options?.cwd }, (err, stdout, stderr) => {
				if (err) {
					reject(err);
					return;
				}
				resolve({ stdout: stdout.toString(), stderr: stderr.toString() });
			});
			child.stdin?.write(options.stdin);
			child.stdin?.end();
		});
	}
	const { stdout, stderr } = await execFileAsync(command, args, { cwd: options?.cwd });
	return { stdout, stderr };
}
