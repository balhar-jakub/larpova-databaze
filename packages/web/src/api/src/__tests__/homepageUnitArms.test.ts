import { describe, it, expect } from '@jest/globals';
import { bandOf } from '../resolvers/homepage';
import { commentAsText } from '../resolvers/textUtils';
import { urlLinkify } from '../resolvers/gameMutation';
import { hasRealAvatar } from '../resolvers/yearReview';
import { currentUsersRatingResolver } from '../resolvers/game';

describe('homepage pure-helper arms', () => {
  it('bandOf: null, short, medium and long bands', () => {
    expect(bandOf(null)).toBe('SHORT');
    expect(bandOf(undefined)).toBe('SHORT');
    expect(bandOf('')).toBe('SHORT');
    expect(bandOf('a'.repeat(199))).toBe('SHORT');
    expect(bandOf('a'.repeat(200))).toBe('MEDIUM');
    expect(bandOf('a'.repeat(1000))).toBe('LONG');
  });

  it('urlLinkify: empty stays empty, URLs become anchors, plain text untouched', () => {
    expect(urlLinkify('')).toBe('');
    expect(urlLinkify('see https://example.com/x now')).toBe(
      'see <a href="https://example.com/x" target="_blank" rel="noopener noreferrer">https://example.com/x</a> now',
    );
    expect(urlLinkify('no links here')).toBe('no links here');
  });

  it('hasRealAvatar: missing user/image/path are false, legacy default is false, real path true', () => {
    expect(hasRealAvatar(null)).toBe(false);
    expect(hasRealAvatar(undefined)).toBe(false);
    expect(hasRealAvatar({ csld_image: null } as never)).toBe(false);
    expect(hasRealAvatar({ csld_image: { path: null } } as never)).toBe(false);
    expect(hasRealAvatar({ csld_image: { path: 'upload/default_avatar.png' } } as never)).toBe(false);
    expect(hasRealAvatar({ csld_image: { path: 'upload/users/123.png' } } as never)).toBe(true);
  });

  it('currentUsersRatingResolver: no user → null, finds by user.id or user_id, else null', () => {
    const ratings = [{ user: { id: 7 }, rating: 4 }, { user_id: 9, rating: 5 }];
    expect(currentUsersRatingResolver({ ratings }, {}, { user: null } as never)).toBeNull();
    expect(currentUsersRatingResolver({ ratings }, {}, { user: { id: 7 } } as never)?.rating).toBe(4);
    expect(currentUsersRatingResolver({ ratings }, {}, { user: { id: 9 } } as never)?.rating).toBe(5);
    expect(currentUsersRatingResolver({ ratings }, {}, { user: { id: 42 } } as never)).toBeNull();
    expect(currentUsersRatingResolver({}, {}, { user: { id: 7 } } as never)).toBeNull();
  });

  it('commentAsText strips tags and trims, null-safe', () => {
    expect(commentAsText(null as any)).toBeNull();
    expect(commentAsText('<p>Hello <b>world</b></p>')).toBe('Hello world');
    expect(commentAsText('   plain   ')).toBe('plain');
  });
});
