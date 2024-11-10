import { z } from 'zod';
import { router, publicProcedure, protectedProcedure } from '../trpc';
import { TRPCError } from '@trpc/server';


export const manufacturersRouter = router({
  // Get a list of all manufacturers with pagination
  manufacturersList: publicProcedure
    .input(z.object({}))
    .query(async ({ input, ctx }) => {
      try {
        const response = await ctx.api.manufacturers.manufacturersList(, { data: undefined });
        return response;
      } catch (error) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Failed to get /manufacturers',
          cause: error
        });
      }
    }),

  // Update the details of a manufacturer by ID
  manufacturersUpdate: protectedProcedure
    .input(z.object({
    id: z.string(),
    data: z.unknown()
  }))
    .mutation(async ({ input, ctx }) => {
      try {
        const response = await ctx.api.manufacturers.manufacturersUpdate(${input.params.id}, { data: input.data });
        return response;
      } catch (error) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Failed to put /manufacturers/{id}',
          cause: error
        });
      }
    })
});