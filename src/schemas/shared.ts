import { z } from "zod";

/**
 * Validates standard UUID version 4 string values.
 */
export const uuidSchema = z.string().uuid({ message: "Invalid UUID format" });

/**
 * Validates email string structures.
 */
export const emailSchema = z.string().email({ message: "Invalid email format" });

/**
 * Validates web URL strings.
 */
export const urlSchema = z.string().url({ message: "Invalid URL format" });

/**
 * Validates common pagination queries.
 */
export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});
