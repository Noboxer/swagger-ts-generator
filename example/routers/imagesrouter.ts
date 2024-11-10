import { z } from 'zod';
import { router, publicProcedure, protectedProcedure } from '../trpc';
import { TRPCError } from '@trpc/server';


export const imagesRouter = router({
  // Upload an image
  uploadCreate: protectedProcedure
    .input(z.object({
    data: [object Object]
  }))
    .mutation(async ({ input, ctx }) => {
      try {
        const response = await ctx.api.images.uploadCreate(input.data);
        return response;
      } catch (error) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Failed to post /images/upload',
          cause: error
        });
      }
    })
});