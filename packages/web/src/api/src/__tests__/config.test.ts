import { configResolver } from '../resolvers/config';

describe('config resolver', () => {
  it('returns empty reCaptchaKey when no env var set', () => {
    const result = configResolver();
    expect(result).toEqual({ reCaptchaKey: '' });
  });
});
