import { createApp, type CfBindings } from './app.js';
import { createHyperdriveQuery } from './db/hyperdrive.js';

export default {
  async fetch(request: Request, env: CfBindings) {
    if (!env.HYPERDRIVE || !env.JWT_SECRET || !env.IOT_DEVICE_SECRET) {
      return Response.json({ error: 'Service not configured' }, { status: 500 });
    }

    const query = createHyperdriveQuery(env.HYPERDRIVE.connectionString);
    const app = createApp({
      query,
      jwtSecret: env.JWT_SECRET,
      iotSecret: env.IOT_DEVICE_SECRET,
    });

    return app.fetch(request, env);
  },
};
