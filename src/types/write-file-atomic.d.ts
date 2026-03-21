declare module "write-file-atomic" {
	function writeFileAtomic(
		filename: string,
		data: string | Buffer,
		options?: string | { encoding?: string; mode?: number; chown?: { uid: number; gid: number } },
	): Promise<void>;

	export default writeFileAtomic;
}
