import { z } from 'zod';
import { router, publicProcedure, protectedProcedure } from '../trpc';
import { TRPCError } from '@trpc/server';


export const authRouter = router({
  // Change password with old and new password
  changeCreate: protectedProcedure
    .input(z.object({
    data: z.unknown()
  }))
    .mutation(async ({ input, ctx }) => {
      try {
        const response = await ctx.api.auth.undefined(, { data: input.data });
        return response;
      } catch (error) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Failed to post /auth/change',
          cause: error
        });
      }
    }),

  // Login with email and password
  loginCreate: protectedProcedure
    .input(z.object({
    data: z.unknown()
  }))
    .mutation(async ({ input, ctx }) => {
      try {
        const response = await ctx.api.auth.undefined(, { data: input.data });
        return response;
      } catch (error) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Failed to post /auth/login',
          cause: error
        });
      }
    }),

  // Verify the login code
  loginVerifyCreate: protectedProcedure
    .input(z.object({
    data: z.unknown()
  }))
    .mutation(async ({ input, ctx }) => {
      try {
        const response = await ctx.api.auth.undefined(, { data: input.data });
        return response;
      } catch (error) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Failed to post /auth/login/verify',
          cause: error
        });
      }
    }),

  // Register with email and password
  registerCreate: protectedProcedure
    .input(z.object({
    data: z.unknown()
  }))
    .mutation(async ({ input, ctx }) => {
      try {
        const response = await ctx.api.auth.undefined(, { data: input.data });
        return response;
      } catch (error) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Failed to post /auth/register',
          cause: error
        });
      }
    }),

  // Terminate sessions by IDs
  terminateCreate: protectedProcedure
    .input(z.object({
    data: z.array(z.unknown())
  }))
    .mutation(async ({ input, ctx }) => {
      try {
        const response = await ctx.api.auth.undefined(, { data: input.data });
        return response;
      } catch (error) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Failed to post /auth/terminate',
          cause: error
        });
      }
    }),

  // Terminate all sessions
  terminateAllCreate: protectedProcedure
    .input(z.object({}))
    .mutation(async ({ input, ctx }) => {
      try {
        const response = await ctx.api.auth.undefined(, { data: undefined });
        return response;
      } catch (error) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Failed to post /auth/terminate/all',
          cause: error
        });
      }
    })
});