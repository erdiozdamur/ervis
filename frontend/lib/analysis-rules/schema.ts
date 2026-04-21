import { z } from 'zod';

const keywordValueSchema = z.string().trim().min(1).max(120);

export const stage1CompositeDishRuleSchema = z
  .object({
    id: z.string().trim().min(1).max(64),
    dishName: z.string().trim().min(1).max(120),
    dishKeywords: z.array(keywordValueSchema).min(1).max(24),
    componentKeywords: z.array(keywordValueSchema).min(2).max(48),
    enabled: z.boolean().default(true),
    priority: z.number().int().min(1).max(999).default(100),
  })
  .strict();

export const analysisRuleSetSchema = z
  .object({
    stage1: z
      .object({
        platterKeywords: z.array(keywordValueSchema).min(1).max(120),
        genericImageNamePrefixes: z.array(keywordValueSchema).min(1).max(64),
        compositeDishRules: z.array(stage1CompositeDishRuleSchema).max(64),
      })
      .strict(),
  })
  .strict();

export type AnalysisRuleSet = z.infer<typeof analysisRuleSetSchema>;
