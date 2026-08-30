import { createApp } from '../src/app';
import type { CreateMatchPersistence } from '../src/application/matches/create-match';
import type { CreateMatchResponse, CreateMatchErrorResponse } from '../src/routes/matches';

const createStubPersistence = (
  behavior: 'success' | 'user_not_found' | 'error',
): CreateMatchPersistence => ({
  createInitialMatch: jest.fn(async () => {
    if (behavior === 'success') return true;
    if (behavior === 'user_not_found') return false;
    throw new Error('Database error');
  }),
});

describe('POST /matches route', () => {
  it('creates a match and returns 201 with MatchCreated response', async () => {
    const app = createApp({
      createMatchPersistence: createStubPersistence('success'),
    });

    const response = await app.inject({
      method: 'POST',
      url: '/matches',
      payload: {
        playerAUserId: 'user-a',
        playerBUserId: 'user-b',
      },
    });

    expect(response.statusCode).toBe(201);
    const body = response.json() as CreateMatchResponse;
    expect(body).toMatchObject({
      status: 'ACTIVE',
      version: 0,
      playerAUserId: 'user-a',
      playerBUserId: 'user-b',
      activePlayerId: 'user-a',
    });
    expect(body.matchId).toBeDefined();
    expect(body.createdAt).toBeDefined();

    await app.close();
  });

  it('returns 400 when body is missing', async () => {
    const app = createApp({
      createMatchPersistence: createStubPersistence('success'),
    });

    const response = await app.inject({
      method: 'POST',
      url: '/matches',
      payload: {},
    });

    expect(response.statusCode).toBe(400);
    const body = response.json() as CreateMatchErrorResponse;
    expect(body.error).toBeDefined();

    await app.close();
  });

  it('returns 400 when playerAUserId is missing', async () => {
    const app = createApp({
      createMatchPersistence: createStubPersistence('success'),
    });

    const response = await app.inject({
      method: 'POST',
      url: '/matches',
      payload: {
        playerBUserId: 'user-b',
      },
    });

    expect(response.statusCode).toBe(400);
    const body = response.json() as CreateMatchErrorResponse;
    expect(body.error).toBeDefined();

    await app.close();
  });

  it('returns 400 when playerBUserId is missing', async () => {
    const app = createApp({
      createMatchPersistence: createStubPersistence('success'),
    });

    const response = await app.inject({
      method: 'POST',
      url: '/matches',
      payload: {
        playerAUserId: 'user-a',
      },
    });

    expect(response.statusCode).toBe(400);
    const body = response.json() as CreateMatchErrorResponse;
    expect(body.error).toBeDefined();

    await app.close();
  });

  it('returns 400 when playerAUserId is empty string', async () => {
    const app = createApp({
      createMatchPersistence: createStubPersistence('success'),
    });

    const response = await app.inject({
      method: 'POST',
      url: '/matches',
      payload: {
        playerAUserId: '',
        playerBUserId: 'user-b',
      },
    });

    expect(response.statusCode).toBe(400);

    await app.close();
  });

  it('returns 400 when playerBUserId is empty string', async () => {
    const app = createApp({
      createMatchPersistence: createStubPersistence('success'),
    });

    const response = await app.inject({
      method: 'POST',
      url: '/matches',
      payload: {
        playerAUserId: 'user-a',
        playerBUserId: '',
      },
    });

    expect(response.statusCode).toBe(400);

    await app.close();
  });

  it('returns 422 when players are the same', async () => {
    const app = createApp({
      createMatchPersistence: createStubPersistence('success'),
    });

    const response = await app.inject({
      method: 'POST',
      url: '/matches',
      payload: {
        playerAUserId: 'same-user',
        playerBUserId: 'same-user',
      },
    });

    expect(response.statusCode).toBe(422);
    const body = response.json() as CreateMatchErrorResponse;
    expect(body.error.code).toBe('SAME_PLAYER');

    await app.close();
  });

  it('returns 404 when one or more users do not exist', async () => {
    const app = createApp({
      createMatchPersistence: createStubPersistence('user_not_found'),
    });

    const response = await app.inject({
      method: 'POST',
      url: '/matches',
      payload: {
        playerAUserId: 'unknown-user',
        playerBUserId: 'user-b',
      },
    });

    expect(response.statusCode).toBe(404);
    const body = response.json() as CreateMatchErrorResponse;
    expect(body.error.code).toBe('USER_NOT_FOUND');

    await app.close();
  });

  it('returns 500 when persistence throws unexpected error', async () => {
    const app = createApp({
      createMatchPersistence: createStubPersistence('error'),
    });

    const response = await app.inject({
      method: 'POST',
      url: '/matches',
      payload: {
        playerAUserId: 'user-a',
        playerBUserId: 'user-b',
      },
    });

    expect(response.statusCode).toBe(500);
    const body = response.json() as CreateMatchErrorResponse;
    expect(body.error.code).toBe('INTERNAL_ERROR');
    // Ensure no stack trace or internal details leak
    expect(JSON.stringify(body)).not.toContain('Database error');

    await app.close();
  });

  it('returns 201 with ISO-8601 timestamp', async () => {
    const app = createApp({
      createMatchPersistence: createStubPersistence('success'),
    });

    const response = await app.inject({
      method: 'POST',
      url: '/matches',
      payload: {
        playerAUserId: 'user-a',
        playerBUserId: 'user-b',
      },
    });

    expect(response.statusCode).toBe(201);
    const body = response.json() as CreateMatchResponse;
    // Validate ISO-8601 format
    expect(new Date(body.createdAt).toISOString()).toBe(body.createdAt);

    await app.close();
  });
});
