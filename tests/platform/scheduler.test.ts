import { afterEach, describe, expect, it, vi } from "vitest";

describe("detectPlatform", () => {
	afterEach(() => {
		vi.unstubAllGlobals();
		vi.resetModules();
	});

	it("returns 'darwin' when process.platform is 'darwin'", async () => {
		vi.stubGlobal("process", { ...process, platform: "darwin" });
		const { detectPlatform } = await import("../../src/platform/detect.js");
		expect(detectPlatform()).toBe("darwin");
	});

	it("returns 'linux' when process.platform is 'linux'", async () => {
		vi.stubGlobal("process", { ...process, platform: "linux" });
		const { detectPlatform } = await import("../../src/platform/detect.js");
		expect(detectPlatform()).toBe("linux");
	});

	it("returns 'win32' when process.platform is 'win32'", async () => {
		vi.stubGlobal("process", { ...process, platform: "win32" });
		const { detectPlatform } = await import("../../src/platform/detect.js");
		expect(detectPlatform()).toBe("win32");
	});

	it("throws SchedulerError for unsupported platform 'freebsd'", async () => {
		vi.stubGlobal("process", { ...process, platform: "freebsd" });
		const { detectPlatform } = await import("../../src/platform/detect.js");
		const { SchedulerError } = await import("../../src/util/errors.js");
		expect(() => detectPlatform()).toThrow(SchedulerError);
		expect(() => detectPlatform()).toThrow(/Unsupported platform/);
	});
});

describe("createScheduler", () => {
	afterEach(() => {
		vi.unstubAllGlobals();
		vi.resetModules();
	});

	it("returns a scheduler instance with register/unregister/isRegistered/list methods", async () => {
		const { createScheduler } = await import("../../src/platform/scheduler.js");
		const scheduler = await createScheduler();
		expect(scheduler).toBeDefined();
		expect(typeof scheduler.register).toBe("function");
		expect(typeof scheduler.unregister).toBe("function");
		expect(typeof scheduler.isRegistered).toBe("function");
		expect(typeof scheduler.list).toBe("function");
	});

	it("does not throw on current platform (darwin or linux)", async () => {
		const { createScheduler } = await import("../../src/platform/scheduler.js");
		await expect(createScheduler()).resolves.toBeDefined();
	});

	it("returns SchtasksScheduler on win32 with register/unregister/isRegistered/list methods", async () => {
		vi.stubGlobal("process", { ...process, platform: "win32" });
		const { createScheduler } = await import("../../src/platform/scheduler.js");
		const scheduler = await createScheduler();
		expect(scheduler).toBeDefined();
		expect(typeof scheduler.register).toBe("function");
		expect(typeof scheduler.unregister).toBe("function");
		expect(typeof scheduler.isRegistered).toBe("function");
		expect(typeof scheduler.list).toBe("function");
	});
});
