import { z } from "zod";

export const ALGORITHM_IDS = [
  "nearest-neighbor",
  "mst-2approx",
  "kmeans",
  "branch-and-bound",
  "brute-force",
  "sweep",
];

export const GeoPointSchema = z.object({
  id: z.string().optional(),
  label: z.string().min(1).max(100).optional(),
  address: z.string().max(200).optional(),
  lat: z.number().finite().min(-90).max(90),
  lng: z.number().finite().min(-180).max(180),
});

export const TimeWindowSchema = z.object({
  start: z.number().finite().min(0).max(1440),
  end: z.number().finite().min(0).max(1440),
}).refine((window) => window.end >= window.start, { message: "Time window end must be after start" });

export const StopSchema = GeoPointSchema.extend({
  id: z.string().min(1).max(60),
  label: z.string().min(1).max(100),
  demand: z.number().finite().positive().max(100000),
  serviceMinutes: z.number().finite().min(0).max(1440).default(5),
  timeWindow: TimeWindowSchema.optional().nullable(),
});

export const OptimizationRequestSchema = z.object({
  depot: GeoPointSchema,
  stops: z.array(StopSchema).min(1).max(250),
  vehicles: z.number().int().min(1).max(30),
  capacity: z.number().finite().positive().max(100000),
  algorithm: z.enum(ALGORITHM_IDS),
  options: z.object({
    seed: z.number().int().optional().default(42),
    trace: z.boolean().optional().default(true),
    maxIterations: z.number().int().min(50).max(50000).optional().default(1500),
    averageSpeedKmh: z.number().finite().positive().max(150).optional().default(28),
    startTimeMinutes: z.number().finite().min(0).max(1440).optional().default(480),
  }).optional().default({}),
});

export const CompareRequestSchema = OptimizationRequestSchema.extend({
  algorithms: z.array(z.enum(ALGORITHM_IDS)).min(2).max(6),
});

export const BenchmarkRequestSchema = z.object({
  algorithms: z.array(z.enum(ALGORITHM_IDS)).min(1).max(8).optional(),
  sizes: z.array(z.number().int().min(4).max(200)).min(1).max(12).optional(),
  seeds: z.number().int().min(1).max(10).optional().default(2),
});

export const ApiErrorSchema = z.object({ error: z.string(), details: z.unknown().optional() });
