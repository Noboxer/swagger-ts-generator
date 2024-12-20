import { z } from 'zod';
import { router, publicProcedure, protectedProcedure } from '../trpc';
import { TRPCError } from '@trpc/server';


export const categoriesRouter = router({
  // Get a list of all vehicle categories with pagination
  categoriesList: publicProcedure
    .input(z.object({}))
    .query(async ({ input, ctx }) => {
      try {
        const response = await ctx.api.categories.categoriesList();
        return response;
      } catch (error) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Failed to get /categories',
          cause: error
        });
      }
    }),

  // Create a new vehicle category
  categoriesCreate: protectedProcedure
    .input(z.object({
    data: [object Object]
  }))
    .mutation(async ({ input, ctx }) => {
      try {
        const response = await ctx.api.categories.categoriesCreate(input.data);
        return response;
      } catch (error) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Failed to post /categories',
          cause: error
        });
      }
    }),

  // Update a vehicle category
  categoriesUpdate: protectedProcedure
    .input(z.object({
    id: z.number(),
    data: [object Object]
  }))
    .mutation(async ({ input, ctx }) => {
      try {
        const response = await ctx.api.categories.categoriesUpdate(input.id, input.data);
        return response;
      } catch (error) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Failed to put /categories/{id}',
          cause: error
        });
      }
    })
});