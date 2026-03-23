import { z } from "zod";

const ModelSchema = z.union([
	z.enum(["sonnet", "opus", "haiku", "opusplan", "default"]),
	z.string().regex(/^claude-/),
]);

export const PipelineConfigSchema = z.object({
	enabled: z.boolean().default(false),
	planModel: ModelSchema.default("haiku"),
	implementModel: ModelSchema.default("opus"),
	reviewModel: ModelSchema.default("sonnet"),
	maxReviewRounds: z.number().int().positive().default(1),
});

export type PipelineConfig = z.infer<typeof PipelineConfigSchema>;

export const JobConfigSchema = z.object({
	id: z.string().min(1),
	name: z.string().min(1),
	repo: z.object({
		path: z.string().min(1),
		branch: z.string().default("main"),
		remote: z.string().default("origin"),
	}),
	schedule: z.object({
		cron: z.string().min(1),
		timezone: z.string().default("UTC"),
	}),
	focus: z
		.array(z.enum(["open-issues", "bug-discovery", "features", "documentation"]))
		.default(["open-issues", "bug-discovery"]),
	systemPrompt: z.string().optional(),
	guardrails: z
		.object({
			maxTurns: z.number().int().nonnegative().default(50),
			maxBudgetUsd: z.number().nonnegative().default(5.0),
			noNewDependencies: z.boolean().default(false),
			noArchitectureChanges: z.boolean().default(false),
			bugFixOnly: z.boolean().default(false),
			restrictToPaths: z.array(z.string()).optional(),
		})
		.default({
			maxTurns: 50,
			maxBudgetUsd: 5.0,
			noNewDependencies: false,
			noArchitectureChanges: false,
			bugFixOnly: false,
		}),
	notifications: z
		.object({
			discord: z
				.object({
					webhookUrl: z.string().url(),
					onSuccess: z.boolean().default(true),
					onFailure: z.boolean().default(true),
					onNoChanges: z.boolean().default(false),
					onLocked: z.boolean().default(false),
				})
				.optional(),
			slack: z
				.object({
					webhookUrl: z.string().url(),
					onSuccess: z.boolean().default(true),
					onFailure: z.boolean().default(true),
					onNoChanges: z.boolean().default(false),
					onLocked: z.boolean().default(false),
				})
				.optional(),
			telegram: z
				.object({
					botToken: z.string(),
					chatId: z.string(),
					onSuccess: z.boolean().default(true),
					onFailure: z.boolean().default(true),
					onNoChanges: z.boolean().default(false),
					onLocked: z.boolean().default(false),
				})
				.optional(),
		})
		.default({}),
	enabled: z.boolean().default(true),
	model: ModelSchema.optional(),
	budget: z
		.object({
			dailyUsd: z.number().positive().optional(),
			weeklyUsd: z.number().positive().optional(),
			monthlyUsd: z.number().positive().optional(),
		})
		.optional(),
	maxFeedbackRounds: z.number().int().positive().default(3).optional(),
	pipeline: PipelineConfigSchema.optional(),
});

export type JobConfig = z.infer<typeof JobConfigSchema>;

export interface ScheduleInfo {
	cron: string;
	timezone: string;
	humanReadable: string;
	nextRuns: Date[];
}
