import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { AuthService } from './AuthService';

let isAndroidNativeMock = false;

const setAndroidLocalSecretKeyHexMock = vi.fn().mockResolvedValue(undefined);
const getAndroidLocalSecretKeyHexMock = vi.fn().mockResolvedValue(null);
const clearAndroidLocalSecretKeyMock = vi.fn().mockResolvedValue(undefined);

const requestNotificationPermissionMock = vi.fn().mockResolvedValue(true);

vi.mock('./NativeDialogs', () => ({
    isAndroidNative: () => isAndroidNativeMock
}));

vi.mock('./AndroidLocalSecretKey', () => ({
    setAndroidLocalSecretKeyHex: setAndroidLocalSecretKeyHexMock,
    getAndroidLocalSecretKeyHex: getAndroidLocalSecretKeyHexMock,
    clearAndroidLocalSecretKey: clearAndroidLocalSecretKeyMock
}));

vi.mock('./NotificationService', () => ({
    notificationService: {
        requestPermission: requestNotificationPermissionMock
    }
}));

beforeEach(() => {
    isAndroidNativeMock = false;
    setAndroidLocalSecretKeyHexMock.mockClear();
    getAndroidLocalSecretKeyHexMock.mockClear();
    clearAndroidLocalSecretKeyMock.mockClear();
    requestNotificationPermissionMock.mockClear();
});

vi.mock('$app/navigation', () => ({
    goto: vi.fn()
}));

vi.mock('$lib/stores/auth', () => {
    return {
        signer: { set: vi.fn() },
        currentUser: { set: vi.fn() }
    };
});
 
vi.mock('./connection/instance', () => ({
    connectionManager: {
        stop: vi.fn(),
        addPersistentRelay: vi.fn(),
        addTemporaryRelay: vi.fn(),
        clearAllRelays: vi.fn(),
        fetchEvents: vi.fn(),
        subscribe: vi.fn(),
        getConnectedRelays: vi.fn(),
        cleanupTemporaryConnections: vi.fn()
    },
    retryQueue: {
        enqueue: vi.fn()
    }
}));
 
vi.mock('$lib/db/db', () => ({

    db: {
        clearAll: vi.fn().mockResolvedValue(undefined)
    }
}));

vi.mock('$lib/db/ProfileRepository', () => ({
    profileRepo: {
        getProfileIgnoreTTL: vi.fn(),
        getProfile: vi.fn(),
        updateProfile: vi.fn()
    }
}));

vi.mock('$lib/db/MessageRepository', () => ({
    messageRepo: {
        countMessages: vi.fn().mockResolvedValue(0)
    }
}));

vi.mock('$lib/db/ContactRepository', () => ({
    contactRepo: {
        getContacts: vi.fn().mockResolvedValue([])
    }
}));

vi.mock('./ProfileResolver', () => ({
    profileResolver: {
        resolveProfile: vi.fn().mockResolvedValue(undefined)
    }
}));
 
vi.mock('./Messaging', () => ({
    messagingService: {
        fetchHistory: vi.fn().mockResolvedValue({ totalFetched: 0, processed: 0 }),
        startSubscriptionsForCurrentUser: vi.fn().mockResolvedValue(undefined),
        stopSubscriptions: vi.fn()
    }
}));
 
vi.mock('$lib/core/signer/LocalSigner', () => ({
    LocalSigner: class {
        getPublicKey = vi.fn().mockResolvedValue('local-pubkey');
    }
}));
 
 
vi.mock('$lib/core/signer/Nip07Signer', () => ({
    Nip07Signer: {
        clearCache: vi.fn()
    }
}));
 
vi.mock('$lib/core/signer/Nip55Signer', () => ({
    Nip55Signer: class {
        getPublicKey = vi.fn().mockResolvedValue('amber-pubkey');
        signEvent = vi.fn();
        encrypt = vi.fn();
        decrypt = vi.fn();
    }
}));
 
 vi.mock('./BackgroundMessaging', () => ({
     syncAndroidBackgroundMessagingFromPreference: vi.fn().mockResolvedValue(undefined),
     disableAndroidBackgroundMessaging: vi.fn().mockResolvedValue(undefined)
 }));
 
 vi.mock('$lib/stores/sync', () => ({
    beginLoginSyncFlow: vi.fn(),
    updateLoginSyncIsFirstSync: vi.fn(),
    setLoginSyncActiveStep: vi.fn(),
    completeLoginSyncFlow: vi.fn()
 }));
 

vi.mock('nostr-tools', () => ({
    nip19: {
        npubEncode: vi.fn(),
        nsecEncode: vi.fn(),
        decode: vi.fn()
    },
    generateSecretKey: vi.fn(),
    getPublicKey: vi.fn(),
    SimplePool: vi.fn()
}));

vi.mock('nostr-tools/nip46', () => ({
    BunkerSigner: {
        fromURI: vi.fn().mockResolvedValue({
            connect: vi.fn(),
            getPublicKey: vi.fn(),
            bp: { pubkey: 'test', relays: [] }
        }),
        fromBunker: vi.fn().mockReturnValue({
            getPublicKey: vi.fn()
        })
    },
    createNostrConnectURI: vi.fn()
}));
 
 
 describe('AuthService.generateKeypair', () => {
     let authService: AuthService;
 
     beforeEach(async () => {
         vi.clearAllMocks();
 
         const module = await import('./AuthService');
         authService = new module.AuthService();
 
         const { nip19, generateSecretKey, getPublicKey } = await import('nostr-tools');
 
         (generateSecretKey as any).mockReturnValue(new Uint8Array([1, 2, 3]));
         (getPublicKey as any).mockReturnValue('pubkey-hex');
         (nip19.nsecEncode as any).mockReturnValue('nsec1test');
         (nip19.npubEncode as any).mockReturnValue('npub1test');
     });
 
     it('returns npub and nsec encoded from generated secret key', async () => {
         const pair = authService.generateKeypair();
 
         const { nip19, generateSecretKey, getPublicKey } = await import('nostr-tools');
 
         expect(generateSecretKey).toHaveBeenCalledTimes(1);
         expect(getPublicKey).toHaveBeenCalledWith(new Uint8Array([1, 2, 3]));
         expect((nip19.nsecEncode as any)).toHaveBeenCalledWith(new Uint8Array([1, 2, 3]));
         expect((nip19.npubEncode as any)).toHaveBeenCalledWith('pubkey-hex');
         expect(pair).toEqual({ npub: 'npub1test', nsec: 'nsec1test' });
     });
 });
 
 
 describe('AuthService.logout localStorage cleanup', () => {
    let authService: AuthService;

    beforeEach(async () => {
        vi.clearAllMocks();

        const storageData: Record<string, string> = {};
        const storageImpl: any = {
            get length() {
                return Object.keys(storageData).length;
            },
            key(index: number) {
                const keys = Object.keys(storageData);
                return keys[index] ?? null;
            },
            getItem(key: string) {
                return Object.prototype.hasOwnProperty.call(storageData, key) ? storageData[key] : null;
            },
            setItem(key: string, value: string) {
                storageData[key] = String(value);
            },
            removeItem(key: string) {
                delete storageData[key];
            },
            clear() {
                Object.keys(storageData).forEach((key) => delete storageData[key]);
            }
        };

        Object.defineProperty(globalThis, 'localStorage', {
            value: storageImpl,
            configurable: true
        });

        if (typeof window !== 'undefined') {
            Object.defineProperty(window, 'localStorage', {
                value: storageImpl,
                configurable: true
            });
        }

        // Seed auth-related and settings-related keys
        localStorage.setItem('nospeak:nsec', 'test-nsec');
        localStorage.setItem('nospeak:auth_method', 'local');
        localStorage.setItem('nospeak:nip46_secret', 'secret');
        localStorage.setItem('nospeak:nip46_uri', 'uri');
        localStorage.setItem('nospeak-settings', JSON.stringify({ notificationsEnabled: true }));
        localStorage.setItem('nospeak-theme', 'mocha');
        localStorage.setItem('nospeak-theme-mode', 'dark');
        localStorage.setItem('nospeak_notifications_permission_prompted', '1');
        localStorage.setItem('nospeak:custom', 'value');
        localStorage.setItem('nospeak-custom-dash', 'value');

        // Unrelated key that should not be touched
        localStorage.setItem('unrelated-key', 'keep');

        const module = await import('./AuthService');
        authService = new module.AuthService();
    });

    it('clears all nospeak auth and settings keys but preserves unrelated keys', async () => {
        await authService.logout();
 
        expect(localStorage.getItem('nospeak:nsec')).toBeNull();
        expect(localStorage.getItem('nospeak:auth_method')).toBeNull();
        expect(localStorage.getItem('nospeak:nip46_secret')).toBeNull();
        expect(localStorage.getItem('nospeak:nip46_uri')).toBeNull();
        expect(localStorage.getItem('nospeak-settings')).toBeNull();
        expect(localStorage.getItem('nospeak-theme')).toBeNull();
        expect(localStorage.getItem('nospeak-theme-mode')).toBeNull();
        expect(localStorage.getItem('nospeak:custom')).toBeNull();
        expect(localStorage.getItem('nospeak-custom-dash')).toBeNull();

        expect(localStorage.getItem('nospeak_notifications_permission_prompted')).toBe('1');
        expect(localStorage.getItem('unrelated-key')).toBe('keep');
    });
});

describe('AuthService ordered login history flow integration', () => {
    let authService: AuthService;
 
    beforeEach(async () => {
        vi.clearAllMocks();

        const storageData: Record<string, string> = {};
        const storageImpl: any = {
            get length() {
                return Object.keys(storageData).length;
            },
            key(index: number) {
                const keys = Object.keys(storageData);
                return keys[index] ?? null;
            },
            getItem(key: string) {
                return Object.prototype.hasOwnProperty.call(storageData, key) ? storageData[key] : null;
            },
            setItem(key: string, value: string) {
                storageData[key] = String(value);
            },
            removeItem(key: string) {
                delete storageData[key];
            },
            clear() {
                Object.keys(storageData).forEach((key) => delete storageData[key]);
            }
        };

        Object.defineProperty(globalThis, 'localStorage', {
            value: storageImpl,
            configurable: true
        });

        if (typeof window !== 'undefined') {
            Object.defineProperty(window, 'localStorage', {
                value: storageImpl,
                configurable: true
            });
        }
 
        const module = await import('./AuthService');
        authService = new module.AuthService();
 
        const { nip19 } = await import('nostr-tools');
        (nip19.npubEncode as any).mockReturnValue('npub1test');
    });


    it('login navigates to /chat and starts ordered login history flow', async () => {
         const module = await import('./AuthService');
         const runFlowSpy = vi
             .spyOn(module.AuthService.prototype as any, 'runLoginHistoryFlow')
             .mockResolvedValue(undefined);
 
         const { goto } = await import('$app/navigation');
 
         await authService.login('nsec1test');
 
        expect(goto).toHaveBeenCalledWith('/chat', { replaceState: true });
        expect(runFlowSpy).toHaveBeenCalledWith('npub1test', 'Login');
     });

    it('calls beginLoginSyncFlow before navigating to /chat', async () => {
        const module = await import('./AuthService');
        vi
            .spyOn(module.AuthService.prototype as any, 'runLoginHistoryFlow')
            .mockResolvedValue(undefined);

        const { goto } = await import('$app/navigation');
        const { beginLoginSyncFlow } = await import('$lib/stores/sync');

        const callOrder: string[] = [];
        (beginLoginSyncFlow as any).mockImplementation(() => {
            callOrder.push('beginLoginSyncFlow');
        });
        (goto as any).mockImplementation(() => {
            callOrder.push('goto');
        });

        await authService.login('nsec1test');

        expect(callOrder.indexOf('beginLoginSyncFlow')).toBeLessThan(callOrder.indexOf('goto'));
    });
 
  });

  describe('AuthService notification permission prompting', () => {
      let authService: AuthService;

      beforeEach(async () => {
          vi.clearAllMocks();

          const storageData: Record<string, string> = {};
          const storageImpl: any = {
              get length() {
                  return Object.keys(storageData).length;
              },
              key(index: number) {
                  const keys = Object.keys(storageData);
                  return keys[index] ?? null;
              },
              getItem(key: string) {
                  return Object.prototype.hasOwnProperty.call(storageData, key) ? storageData[key] : null;
              },
              setItem(key: string, value: string) {
                  storageData[key] = String(value);
              },
              removeItem(key: string) {
                  delete storageData[key];
              },
              clear() {
                  Object.keys(storageData).forEach((key) => delete storageData[key]);
              }
          };

          Object.defineProperty(globalThis, 'localStorage', {
              value: storageImpl,
              configurable: true
          });

          if (typeof window !== 'undefined') {
              Object.defineProperty(window, 'localStorage', {
                  value: storageImpl,
                  configurable: true
              });
          }

          const module = await import('./AuthService');
          vi
              .spyOn(module.AuthService.prototype as any, 'runLoginHistoryFlow')
              .mockResolvedValue(undefined);
          authService = new module.AuthService();

          const { nip19 } = await import('nostr-tools');
          (nip19.npubEncode as any).mockReturnValue('npub1test');
      });

      it('prompts for notification permission once on login by default', async () => {
          await authService.login('nsec1test');

          expect(requestNotificationPermissionMock).toHaveBeenCalledTimes(1);
          expect(localStorage.getItem('nospeak_notifications_permission_prompted')).toBe('1');
      });

      it('does not prompt on login when notifications are disabled in settings', async () => {
          localStorage.setItem('nospeak-settings', JSON.stringify({ notificationsEnabled: false }));

          await authService.login('nsec1test');

          expect(requestNotificationPermissionMock).not.toHaveBeenCalled();
          expect(localStorage.getItem('nospeak_notifications_permission_prompted')).toBeNull();
      });

      it('does not prompt on login when already prompted', async () => {
          localStorage.setItem('nospeak_notifications_permission_prompted', '1');

          await authService.login('nsec1test');

          expect(requestNotificationPermissionMock).not.toHaveBeenCalled();
      });

      it('prompts for notification permission once on Amber login by default', async () => {
          await authService.loginWithAmber();

          expect(requestNotificationPermissionMock).toHaveBeenCalledTimes(1);
          expect(localStorage.getItem('nospeak_notifications_permission_prompted')).toBe('1');
      });
  });
  
  describe('AuthService restore integrates background messaging preference sync', () => {
     let authService: AuthService;
 
     beforeEach(async () => {
         vi.clearAllMocks();
 
         const storageData: Record<string, string> = {};
         const storageImpl: any = {
             get length() {
                 return Object.keys(storageData).length;
             },
             key(index: number) {
                 const keys = Object.keys(storageData);
                 return keys[index] ?? null;
             },
             getItem(key: string) {
                 return Object.prototype.hasOwnProperty.call(storageData, key) ? storageData[key] : null;
             },
             setItem(key: string, value: string) {
                 storageData[key] = String(value);
             },
             removeItem(key: string) {
                 delete storageData[key];
             },
             clear() {
                 Object.keys(storageData).forEach((key) => delete storageData[key]);
             }
         };
 
         Object.defineProperty(globalThis, 'localStorage', {
             value: storageImpl,
             configurable: true
         });
 
         if (typeof window !== 'undefined') {
             Object.defineProperty(window, 'localStorage', {
                 value: storageImpl,
                 configurable: true
             });
         }
 
         // Seed local auth restore state
         localStorage.setItem('nospeak:auth_method', 'local');
         localStorage.setItem('nospeak:nsec', 'test-nsec');
 
         const module = await import('./AuthService');
         authService = new module.AuthService();
 
         const { nip19 } = await import('nostr-tools');
         (nip19.npubEncode as any).mockReturnValue('npub1test');
 
         const { profileRepo } = await import('$lib/db/ProfileRepository');
         (profileRepo.getProfileIgnoreTTL as any).mockResolvedValue({
             messagingRelays: ['wss://relay.example.com']
         });
     });
 
     it('calls syncAndroidBackgroundMessagingFromPreference after successful local restore', async () => {
         const { syncAndroidBackgroundMessagingFromPreference } = await import('./BackgroundMessaging');
 
         const result = await authService.restore();
 
         expect(result).toBe(true);
         expect(syncAndroidBackgroundMessagingFromPreference).toHaveBeenCalledTimes(1);
     });
 });
 
 describe('AuthService amber login and restore', () => {
     let authService: AuthService;
 
     beforeEach(async () => {
         vi.clearAllMocks();
 
         const storageData: Record<string, string> = {};
         const storageImpl: any = {
             get length() {
                 return Object.keys(storageData).length;
             },
             key(index: number) {
                 const keys = Object.keys(storageData);
                 return keys[index] ?? null;
             },
             getItem(key: string) {
                 return Object.prototype.hasOwnProperty.call(storageData, key) ? storageData[key] : null;
             },
             setItem(key: string, value: string) {
                 storageData[key] = String(value);
             },
             removeItem(key: string) {
                 delete storageData[key];
             },
             clear() {
                 Object.keys(storageData).forEach((key) => delete storageData[key]);
             }
         };
 
         Object.defineProperty(globalThis, 'localStorage', {
             value: storageImpl,
             configurable: true
         });
 
         if (typeof window !== 'undefined') {
             Object.defineProperty(window, 'localStorage', {
                 value: storageImpl,
                 configurable: true
             });
         }
 
         const module = await import('./AuthService');
         authService = new module.AuthService();
 
         const { nip19 } = await import('nostr-tools');
         (nip19.npubEncode as any).mockReturnValue('npub1amber');
 
         const { profileRepo } = await import('$lib/db/ProfileRepository');
         (profileRepo.getProfileIgnoreTTL as any).mockResolvedValue({
             messagingRelays: ['wss://relay.example.com']
         });
     });
 
      it('loginWithAmber navigates to /chat, sets auth method amber, caches pubkey, and starts history flow', async () => {

         const module = await import('./AuthService');
         const runFlowSpy = vi
             .spyOn(module.AuthService.prototype as any, 'runLoginHistoryFlow')
             .mockResolvedValue(undefined);
 
         const { goto } = await import('$app/navigation');
 
          await authService.loginWithAmber();
 
          expect(goto).toHaveBeenCalledWith('/chat', { replaceState: true });
          expect(runFlowSpy).toHaveBeenCalledWith('npub1amber', 'Amber login');
          expect(localStorage.getItem('nospeak:auth_method')).toBe('amber');
          expect(localStorage.getItem('nospeak:amber_pubkey_hex')).toBeTruthy();
      });

    it('loginWithAmber calls beginLoginSyncFlow before navigating to /chat', async () => {
        const module = await import('./AuthService');
        vi
            .spyOn(module.AuthService.prototype as any, 'runLoginHistoryFlow')
            .mockResolvedValue(undefined);

        const { goto } = await import('$app/navigation');
        const { beginLoginSyncFlow } = await import('$lib/stores/sync');

        const callOrder: string[] = [];
        (beginLoginSyncFlow as any).mockImplementation(() => {
            callOrder.push('beginLoginSyncFlow');
        });
        (goto as any).mockImplementation(() => {
            callOrder.push('goto');
        });

        await authService.loginWithAmber();

        expect(callOrder.indexOf('beginLoginSyncFlow')).toBeLessThan(callOrder.indexOf('goto'));
    });
 
      it('restore() returns true and syncs background messaging for amber sessions when cached pubkey exists', async () => {
          const { syncAndroidBackgroundMessagingFromPreference } = await import('./BackgroundMessaging');
 
          localStorage.setItem('nospeak:auth_method', 'amber');
          localStorage.setItem('nospeak:amber_pubkey_hex', 'deadbeef');
 
          const result = await authService.restore();
 
          expect(result).toBe(true);
          expect(syncAndroidBackgroundMessagingFromPreference).toHaveBeenCalledTimes(1);
      });
 
      it('restore() returns false and clears auth method when amber session has no cached pubkey', async () => {
          localStorage.setItem('nospeak:auth_method', 'amber');
 
          const result = await authService.restore();
 
          expect(result).toBe(false);
          expect(localStorage.getItem('nospeak:auth_method')).toBeNull();
      });
 
      it('restore() clears legacy nip46 sessions and returns false', async () => {

         localStorage.setItem('nospeak:auth_method', 'nip46');
         localStorage.setItem('nospeak:nip46_secret', 'secret');
         localStorage.setItem('nospeak:nip46_uri', 'uri');
         localStorage.setItem('nospeak:nip46_bunker_pubkey', 'pubkey');
         localStorage.setItem('nospeak:nip46_bunker_relays', 'wss://relay.example.com');
 
         const result = await authService.restore();
 
         expect(result).toBe(false);
         expect(localStorage.getItem('nospeak:nip46_secret')).toBeNull();
         expect(localStorage.getItem('nospeak:nip46_uri')).toBeNull();
         expect(localStorage.getItem('nospeak:nip46_bunker_pubkey')).toBeNull();
          expect(localStorage.getItem('nospeak:nip46_bunker_relays')).toBeNull();
          expect(localStorage.getItem('nospeak:auth_method')).toBeNull();
      });
  });

  describe('AuthService Android local secret storage', () => {
      let authService: AuthService;

      beforeEach(async () => {
          isAndroidNativeMock = true;
          vi.clearAllMocks();

          const storageData: Record<string, string> = {};
          const storageImpl: any = {
              get length() {
                  return Object.keys(storageData).length;
              },
              key(index: number) {
                  const keys = Object.keys(storageData);
                  return keys[index] ?? null;
              },
              getItem(key: string) {
                  return Object.prototype.hasOwnProperty.call(storageData, key) ? storageData[key] : null;
              },
              setItem(key: string, value: string) {
                  storageData[key] = String(value);
              },
              removeItem(key: string) {
                  delete storageData[key];
              },
              clear() {
                  Object.keys(storageData).forEach((key) => delete storageData[key]);
              }
          };

          Object.defineProperty(globalThis, 'localStorage', {
              value: storageImpl,
              configurable: true
          });

          if (typeof window !== 'undefined') {
              Object.defineProperty(window, 'localStorage', {
                  value: storageImpl,
                  configurable: true
              });
          }

          const module = await import('./AuthService');
          authService = new module.AuthService();

          const { nip19 } = await import('nostr-tools');
          (nip19.npubEncode as any).mockReturnValue('npub1test');
          (nip19.decode as any).mockReturnValue({ type: 'nsec', data: new Uint8Array([0, 1, 2, 3]) });
          (nip19.nsecEncode as any).mockReturnValue('nsec1restored');

          const { profileRepo } = await import('$lib/db/ProfileRepository');
          (profileRepo.getProfileIgnoreTTL as any).mockResolvedValue({
              messagingRelays: ['wss://relay.example.com']
          });
      });

      it('login stores secret via Android plugin and not localStorage', async () => {
          const module = await import('./AuthService');
          const runFlowSpy = vi
              .spyOn(module.AuthService.prototype as any, 'runLoginHistoryFlow')
              .mockResolvedValue(undefined);

          await authService.login('nsec1test');

          expect(setAndroidLocalSecretKeyHexMock).toHaveBeenCalledWith('00010203');
          expect(localStorage.getItem('nospeak:nsec')).toBeNull();
          expect(localStorage.getItem('nospeak:auth_method')).toBe('local');
          expect(runFlowSpy).toHaveBeenCalledWith('npub1test', 'Login');
      });

      it('restore fails and clears auth method when Android secret missing', async () => {
          localStorage.setItem('nospeak:auth_method', 'local');
          getAndroidLocalSecretKeyHexMock.mockResolvedValueOnce(null);

          const result = await authService.restore();

          expect(result).toBe(false);
          expect(localStorage.getItem('nospeak:auth_method')).toBeNull();
      });

      it('restore succeeds when Android secret exists', async () => {
          localStorage.setItem('nospeak:auth_method', 'local');
          getAndroidLocalSecretKeyHexMock.mockResolvedValueOnce('00'.repeat(32));

          const result = await authService.restore();

          expect(result).toBe(true);
          expect(localStorage.getItem('nospeak:nsec')).toBeNull();
      });

      it('logout clears Android secret key store', async () => {
          await authService.logout();

          expect(clearAndroidLocalSecretKeyMock).toHaveBeenCalledTimes(1);
      });
  });
  
 

