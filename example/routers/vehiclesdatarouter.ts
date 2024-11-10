import { z } from 'zod';
import { router, publicProcedure, protectedProcedure } from '../trpc';
import { TRPCError } from '@trpc/server';


export const vehiclesDataRouter = router({
  // Retrieve distinct values of a specified field from the vehicle database, after applying filters and an optional search query.
  getFieldOptionsOptionsCreate: protectedProcedure
    .input(z.object({
    field: z.string(),
    data: z.unknown()
  }))
    .mutation(async ({ input, ctx }) => {
      try {
        const response = await ctx.api.vehiclesData.getFieldOptionsOptionsCreate(${input.params.field}, { data: input.data });
        return response;
      } catch (error) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Failed to post /vehiclesData/getFieldOptions/{field}/options',
          cause: error
        });
      }
    })
});