import { z } from 'zod';
import { router, publicProcedure, protectedProcedure } from '../trpc';
import { TRPCError } from '@trpc/server';


export const vehiclesRouter = router({
  // Bulk edit vehicles
  bulkEditUpdate: protectedProcedure
    .input(z.object({
    data: z.unknown()
  }))
    .mutation(async ({ input, ctx }) => {
      try {
        const response = await ctx.api.vehicles.bulkEditUpdate(, { data: input.data });
        return response;
      } catch (error) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Failed to put /vehicles/bulk-edit',
          cause: error
        });
      }
    }),

  // Count total vehicles
  countList: publicProcedure
    .input(z.object({}))
    .query(async ({ input, ctx }) => {
      try {
        const response = await ctx.api.vehicles.countList(, { data: undefined });
        return response;
      } catch (error) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Failed to get /vehicles/count',
          cause: error
        });
      }
    }),

  // Create a new vehicle with the provided data
  createCreate: protectedProcedure
    .input(z.object({}))
    .mutation(async ({ input, ctx }) => {
      try {
        const response = await ctx.api.vehicles.createCreate(, { data: input.data });
        return response;
      } catch (error) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Failed to post /vehicles/create',
          cause: error
        });
      }
    }),

  // Get all vehicles with optional filters
  listCreate: protectedProcedure
    .input(z.object({
    data: z.unknown()
  }))
    .mutation(async ({ input, ctx }) => {
      try {
        const response = await ctx.api.vehicles.listCreate(, { data: input.data });
        return response;
      } catch (error) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Failed to post /vehicles/list',
          cause: error
        });
      }
    }),

  // Add a vehicle treatment
  treatmentsCreate: protectedProcedure
    .input(z.object({
    data: z.unknown()
  }))
    .mutation(async ({ input, ctx }) => {
      try {
        const response = await ctx.api.vehicles.treatmentsCreate(, { data: input.data });
        return response;
      } catch (error) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Failed to post /vehicles/treatments',
          cause: error
        });
      }
    }),

  // Get a vehicle treatment
  treatmentsDetail: publicProcedure
    .input(z.object({
    treatment_id: z.string()
  }))
    .query(async ({ input, ctx }) => {
      try {
        const response = await ctx.api.vehicles.treatmentsDetail(${input.params.treatment_id}, { data: undefined });
        return response;
      } catch (error) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Failed to get /vehicles/treatments/{treatment_id}',
          cause: error
        });
      }
    }),

  // Remove a vehicle treatment
  treatmentsDelete: protectedProcedure
    .input(z.object({
    treatment_id: z.string()
  }))
    .mutation(async ({ input, ctx }) => {
      try {
        const response = await ctx.api.vehicles.treatmentsDelete(${input.params.treatment_id}, { data: undefined });
        return response;
      } catch (error) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Failed to delete /vehicles/treatments/{treatment_id}',
          cause: error
        });
      }
    }),

  // Get a vehicle by ID
  vehiclesDetail: publicProcedure
    .input(z.object({
    id: z.string()
  }))
    .query(async ({ input, ctx }) => {
      try {
        const response = await ctx.api.vehicles.vehiclesDetail(${input.params.id}, { data: undefined });
        return response;
      } catch (error) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Failed to get /vehicles/{id}',
          cause: error
        });
      }
    }),

  // Update a vehicle with the provided data
  vehiclesUpdate: protectedProcedure
    .input(z.object({
    id: z.string()
  }))
    .mutation(async ({ input, ctx }) => {
      try {
        const response = await ctx.api.vehicles.vehiclesUpdate(${input.params.id}, { data: input.data });
        return response;
      } catch (error) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Failed to put /vehicles/{id}',
          cause: error
        });
      }
    }),

  // Delete a vehicle by ID
  vehiclesDelete: protectedProcedure
    .input(z.object({
    id: z.string()
  }))
    .mutation(async ({ input, ctx }) => {
      try {
        const response = await ctx.api.vehicles.vehiclesDelete(${input.params.id}, { data: undefined });
        return response;
      } catch (error) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Failed to delete /vehicles/{id}',
          cause: error
        });
      }
    })
});