import { router } from '../trpc';
import { authRouter } from './authrouter';
import { categoriesRouter } from './categoriesrouter';
import { export-excelRouter } from './export-excelrouter';
import { imagesRouter } from './imagesrouter';
import { manufacturersRouter } from './manufacturersrouter';
import { vehiclesRouter } from './vehiclesrouter';
import { vehiclesDataRouter } from './vehiclesdatarouter';

export const appRouter = router({
  auth: authRouter,
  categories: categoriesRouter,
  export-excel: export-excelRouter,
  images: imagesRouter,
  manufacturers: manufacturersRouter,
  vehicles: vehiclesRouter,
  vehiclesdata: vehiclesDataRouter,
});

export type AppRouter = typeof appRouter;