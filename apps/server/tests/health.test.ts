import { createApp } from '../src/app';

describe('health route', () => {
  it('creates an app without listening and returns the health contract', async () => {
    const app = createApp();

    expect(app.server.listening).toBe(false);

    const response = await app.inject({ method: 'GET', url: '/health' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      status: 'ok',
      service: 'dice-arena-server',
    });

    await app.close();
  });
});
