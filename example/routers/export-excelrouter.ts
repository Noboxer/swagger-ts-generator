import { z } from 'zod';
import { router, publicProcedure, protectedProcedure } from '../trpc';
import { TRPCError } from '@trpc/server';


export const export-excelRouter = router({
  // Uploads an Excel file, processes the data, and posts the submodels
  processExcelCreate: protectedProcedure
    .input(z.object({}))
    .mutation(async ({ input, ctx }) => {
      try {
        const response = await ctx.api.exportExcel.processExcelCreate(, { data: input.data });
        return response;
      } catch (error) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Failed to post /export-excel/process-excel',
          cause: error
        });
      }
    })
});