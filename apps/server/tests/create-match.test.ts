import {
  createMatchUseCase,
  CreateMatchError,
  type CreateMatchPersistence,
} from '../src/application/matches/create-match';

const createPersistence = (result = true): CreateMatchPersistence => ({
  createInitialMatch: jest.fn().mockResolvedValue(result),
});

describe('CreateMatch application use case', () => {
  it('creates an active version-zero match with player A active', async () => {
    const persistence = createPersistence();
    const result = await createMatchUseCase(persistence, {
      playerAUserId: 'a',
      playerBUserId: 'b',
    });
    expect(result).toMatchObject({
      status: 'ACTIVE',
      version: 0,
      playerAUserId: 'a',
      playerBUserId: 'b',
      activePlayerId: 'a',
    });
  });
  it('rejects missing, duplicate, and unknown players', async () => {
    await expect(
      createMatchUseCase(createPersistence(), { playerAUserId: '', playerBUserId: 'b' }),
    ).rejects.toThrow(CreateMatchError);
    await expect(
      createMatchUseCase(createPersistence(), { playerAUserId: 'a', playerBUserId: 'a' }),
    ).rejects.toThrow(CreateMatchError);
    await expect(
      createMatchUseCase(createPersistence(false), { playerAUserId: 'a', playerBUserId: 'b' }),
    ).rejects.toThrow(CreateMatchError);
  });
});
