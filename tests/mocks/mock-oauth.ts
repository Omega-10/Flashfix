/**
 * Hermetic Google OAuth2 Mock Adapter for Flashfix platform tests.
 */

export interface GoogleUserProfile {
  googleId: string;
  email: string;
  name: string;
  avatarUrl: string;
  emailVerified: boolean;
}

export class MockGoogleOAuthAdapter {
  private validAuthCodes = new Map<string, GoogleUserProfile>();

  /**
   * Registers a mock Google user with an authorization code.
   */
  public registerMockCode(code: string, profile: GoogleUserProfile): void {
    this.validAuthCodes.set(code, profile);
  }

  /**
   * Simulates Google OAuth2 callback exchange: exchange code for user profile.
   */
  public exchangeCodeForProfile(code: string): GoogleUserProfile {
    if (!this.validAuthCodes.has(code)) {
      throw new Error('INVALID_OAUTH_CODE: Authorization code expired or invalid');
    }

    const profile = this.validAuthCodes.get(code)!;
    this.validAuthCodes.delete(code); // single-use code
    return profile;
  }

  /**
   * Generates a pre-configured Google user profile.
   */
  public createStandardProfile(overrides: Partial<GoogleUserProfile> = {}): GoogleUserProfile {
    const id = `goog-${Math.floor(Math.random() * 1000000)}`;
    return {
      googleId: id,
      email: `user.${id}@gmail.com`,
      name: 'Test Google User',
      avatarUrl: `https://lh3.googleusercontent.com/a/${id}`,
      emailVerified: true,
      ...overrides
    };
  }

  public clear(): void {
    this.validAuthCodes.clear();
  }
}

export const mockGoogleOAuth = new MockGoogleOAuthAdapter();
