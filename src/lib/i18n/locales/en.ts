const en = {
    common: {
        appName: 'nospeak',
        save: 'Save',
        cancel: 'Cancel'
    },
    auth: {
        loginWithAmber: 'Login with Amber',
        loginWithExtension: 'Login with Nostr Signer Extension',
        orSeparator: 'OR',
        loginWithNsecLabel: 'Login with nsec',
        nsecPlaceholder: 'nsec1...',
        loginButton: 'Login',
        connecting: 'Connecting...',
        generateKeypairLink: 'Generate new keypair',
        downloadAndroidApp: 'Download Android App',
        amber: {
            title: 'Login with Amber',
            helper: 'Scan this QR code with Amber or use the buttons below.',
            openInAmber: 'Open in Amber',
            copyConnectionString: 'Copy Connection String',
            copied: 'Copied!'
        },
        keypair: {
            title: 'Generate new keypair',
            description: 'A new Nostr keypair is generated locally in your browser.',
            npubLabel: 'npub (public key)',
            nsecLabel: 'nsec (secret key)',
            generateAnother: 'Generate another',
            useAndLogin: 'Use this keypair and login'
        }
    },
    chats: {
        title: 'Chats',
        emptyHint: 'No chats yet. Tap + to add a contact.',
        selectPrompt: 'Select a chat to start messaging',
        addContact: 'Add contact',
        filterAll: 'All',
        filterUnread: 'Unread',
        filterGroups: 'Groups',
        emptyUnread: 'No unread chats',
        emptyGroups: 'No groups',
        favorites: 'Favorites',
        favoriteMessage: 'message',
        favoriteMessages: 'messages',
        emptyFavorites: 'No favorited messages yet'
    },
    contacts: {
        title: 'Contacts',
        manage: 'Manage',
        scanQr: 'Scan QR',
        scanQrAria: 'Scan contact QR code',
        emptyHint: 'If no contacts appear, click Manage to add some.',
        selectPrompt: 'Select a contact to start chatting',
        youPrefix: 'You',
        mediaPreview: {
            image: 'Image',
            video: 'Video',
            voiceMessage: 'Voice Message',
            audio: 'Audio',
            file: 'File',
            location: 'Location'
        }
    },
    connection: {
        relaysLabel: 'Relays:',
        authLabel: 'Auth:',
        authFailedLabel: 'Failed:'
    },
    sync: {
        title: 'Syncing messages...',
        fetched: '{count} fetched',
        errorTitle: 'Sync failed',
        timeoutError: 'Sync timed out after 5 minutes',
        relayErrorsTitle: 'Relay errors',
        retryButton: 'Retry',
        skipButton: 'Skip and continue',
        continueInBackground: 'Continue in background',
        backgroundComplete: 'Sync completed',
        steps: {
            connectDiscoveryRelays: 'Connect to discovery relays',
            fetchMessagingRelays: "Fetch and cache user's messaging relays",
            connectReadRelays: "Connect to user's messaging relays",
            fetchHistory: 'Fetch and cache history items from relays',
            fetchContacts: 'Fetch and merge contacts from relays',
            fetchContactProfiles: 'Fetch and cache contact profiles and relay info',
            fetchUserProfile: 'Fetch and cache user profile'
        }
    },

         modals: {
          manageContacts: {
              title: 'Contacts',
              scanQr: 'Scan QR',
              scanQrAria: 'Scan QR code to add contact',
              searchPlaceholder: 'npub, NIP-05, or search term',
              addContactAria: 'Add contact',
              searchContactsAria: 'Search contacts',
              searching: 'Searching...',
              searchFailed: 'Search failed',
              noResults: 'No results',
              noContacts: 'No contacts added',
              removeContactAria: 'Remove contact',
              resolvingNip05: 'Looking up NIP-05...',
              nip05LookupFailed: 'Failed to look up NIP-05',
              nip05NotFound: 'NIP-05 not found',
              nip05InvalidFormat: 'Invalid NIP-05 format (use name@domain.com)',
              alreadyAdded: 'Already added',
              syncing: 'Syncing contacts…',
              pullToRefresh: 'Pull to refresh',
              releaseToRefresh: 'Release to refresh',
              newContact: 'Add contact',
              createGroup: 'Create group',
              contextMenu: {
                  openMenu: 'Open menu',
                  delete: 'Delete'
              },
              confirmDelete: {
                  title: 'Delete Contact',
                  message: 'Are you sure you want to delete {name}?',
                  confirm: 'Delete'
              }
          },
          createGroup: {
              title: 'Create Group Chat',
              searchPlaceholder: 'Search contacts',
              selectedCount: '{count} selected',
              minContactsHint: 'Select at least 2 contacts',
              createButton: 'Create Group',
              creating: 'Creating...',
              noContacts: 'No contacts to add to group'
          },
         profile: {
              unknownName: 'Unknown',
              about: 'About',
              publicKey: 'Public Key',
              messagingRelays: 'Messaging Relays',
              noRelays: 'None',
              refreshing: 'Refreshing profile…',
              notFound: 'Profile not found'
          },

        emptyProfile: {
            title: 'Finish setting up your profile',
            introLine1: "This key doesn't have any messaging relays or a username configured yet.",
            introLine2: "We'll configure some default messaging relays so nospeak can send and receive messages. You can change these later in Settings under Messaging Relays.",
            usernameLabel: 'Username',
            usernamePlaceholder: 'Your name',
            usernameRequired: 'Please enter a username to continue.',
            saveError: 'Could not save your initial setup. Please try again.',
            doLater: "I'll do this later",
            saving: 'Saving...',
            continue: 'Continue',
            autoRelaysConfigured: 'Messaging relays configured. You can change them in Settings.'
        },
        relayStatus: {
            title: 'Relay Connections',
            noRelays: 'No relays configured',
            connected: 'Connected',
            disconnected: 'Disconnected',
            typeLabel: 'Type:',
            lastConnectedLabel: 'Last Connected:',
            successLabel: 'Success:',
            failureLabel: 'Failures:',
            authLabel: 'Auth:',
            authErrorLabel: 'Auth error:',
            authNotRequired: 'Not required',
            authRequired: 'Required',
            authAuthenticating: 'Authenticating',
            authAuthenticated: 'Authenticated',
            authFailed: 'Failed',
            typePersistent: 'Persistent',
            typeTemporary: 'Temporary',
            never: 'Never'
        },
        qr: {
            title: 'QR Code',
            tabs: {
                myQr: 'My code',
                scanQr: 'Scan code'
            }
        },
        userQr: {
            preparing: 'Preparing QR code…',
            hint: 'This is your npub as a QR code. Share it with someone so they can scan it to add you as a contact.'
        },
        scanContactQr: {
            title: 'Scan contact QR',
            instructions: 'Point your camera at a nostr QR code to add a contact.',
            scanning: 'Scanning…',
            noCamera: 'Camera is not available on this device.',
            invalidQr: 'This QR code does not contain a valid contact npub.',
            addFailed: 'Could not add contact from this QR. Please try again.',
            added: 'Contact added from QR.'
        },
        scanContactQrResult: {
            title: 'Contact from QR',
            alreadyContact: 'This contact is already in your contacts.',
            reviewHint: 'Review the contact from the scanned QR before adding.',
            updatingProfile: 'Updating profile…',
            loadFailed: 'Failed to load contact details from QR.',
            addFailed: 'Failed to add contact from QR.',
            closeButton: 'Close',
            addButton: 'Add contact',
            startChatButton: 'Start chat'
        },
        attachmentPreview: {
            title: 'Attachment preview',
            imageAlt: 'Attachment preview',
            noPreview: 'No preview available',
            captionLabel: 'Caption (optional)',
            cancelButton: 'Cancel',
            sendButtonIdle: 'Send',
            sendButtonSending: 'Sending…',
            uploadButtonIdle: 'Upload',
            uploadButtonUploading: 'Uploading…'
        },
        locationPreview: {
            title: 'Location',
            closeButton: 'Close',
            openInOpenStreetMap: 'Open in OpenStreetMap',
            ctrlScrollToZoom: 'Use Ctrl + scroll to zoom'
        },
        mediaServersAutoConfigured: {
            title: 'Media servers configured',
            message: 'No Blossom servers were configured. We added {server1} and {server2}.\n\nYou can change these in Settings → Media Servers.'
        }
    },
    chat: {
        sendFailedTitle: 'Send failed',
        sendFailedMessagePrefix: 'Failed to send message: ',
        location: {
            errorTitle: 'Location Error',
            errorMessage: 'Failed to get your location. Please check permissions.'
        },
        relative: {
            justNow: 'just now',
            minutes: '{count} min ago',
            minutesPlural: '{count} mins ago',
            hours: '{count} hour ago',
            hoursPlural: '{count} hours ago',
            days: '{count} day ago',
            daysPlural: '{count} days ago',
            weeks: '{count} week ago',
            weeksPlural: '{count} weeks ago',
            months: '{count} month ago',
            monthsPlural: '{count} months ago',
            years: '{count} year ago',
            yearsPlural: '{count} years ago'
        },
        dateLabel: {
            today: 'Today',
            yesterday: 'Yesterday'
        },
        history: {
            fetchOlder: 'Fetch older messages from relays',
            summary: 'Fetched {events} events, saved {saved} new messages ({chat} in this chat)',
            none: 'No more messages available from relays',
            error: 'Failed to fetch older messages. Try again later.'
        },
        empty: {
            noMessagesTitle: 'No messages yet',
            forContact: 'Start the conversation with {name}.',
            forGroup: 'Start the conversation in {name}.',
            generic: 'Select a contact to start chatting.'
        },
        group: {
            defaultTitle: 'Group Chat',
            participants: '{count} participants',
            participantsShort: '{count}',
            members: 'Members: {count}',
            membersTitle: 'Members',
            viewMembers: 'View members',
            editName: 'Edit group name',
            editNameTitle: 'Group Name',
            editNamePlaceholder: 'Enter group name...',
            editNameHint: 'Leave empty to use participant names',
            editNameSave: 'Save',
            editNameCancel: 'Cancel',
            nameSavedToast: 'Saved. Will be set with next message.',
            nameValidationTooLong: 'Name too long (max 100 characters)',
            nameValidationInvalidChars: 'Name contains invalid characters'
        },
        inputPlaceholder: 'Type a message...',
        contextMenu: {
            cite: 'Cite',
            copy: 'Copy',
            sentAt: 'Sent',
            favorite: 'Favorite',
            unfavorite: 'Remove favorite'
        },
        reactions: {
            cannotReactTitle: 'Cannot React',
            cannotReactMessage: 'This message is too old to support reactions.',
            failedTitle: 'Reaction failed',
            failedMessagePrefix: 'Failed to send reaction: '
        },
        mediaMenu: {
            uploadMediaTooltip: 'Upload media',
            takePhoto: 'Take photo',
            location: 'Location',
            image: 'Image',
            video: 'Video',
            audio: 'Music',
            file: 'File'
        },
        mediaErrors: {
            cameraErrorTitle: 'Camera error',
            cameraErrorMessage: 'Failed to capture photo'
        },
        fileUpload: {
            fileTooLarge: 'File is too large. Maximum size is 10 MB.',
            download: 'Download',
            decrypting: 'Decrypting...'
        },
        mediaUnavailable: 'This media is no longer available.',
        voiceMessage: {
            title: 'Voice message',
            recordAria: 'Record voice message',
            playPreviewAria: 'Play preview',
            pausePreviewAria: 'Pause preview',
            cancelButton: 'Cancel',
            pauseButton: 'Pause',
            doneButton: 'Done',
            resumeButton: 'Resume',
            sendButton: 'Send',
            microphoneTitle: 'Microphone',
            permissionDeniedTitle: 'Microphone permission',
            permissionDeniedMessage: 'Please allow microphone access to record.',
            nativeNotAvailable: 'Native recording not available.',
            unsupported: 'Voice recording unsupported on this device.',
            failedToStart: 'Failed to start recording.',
            failedToStop: 'Failed to stop recording.',
            recordingFailed: 'Recording failed.'
        },
        relayStatus: {
            sending: 'sending...',
            sentToRelays: 'sent to {successful}/{desired} relays'
        },
        searchPlaceholder: 'Search',
        searchNoMatches: 'No matches',
        searchAriaLabel: 'Search chat'
    },
    settings: {
          title: 'Settings',
          categories: {
              general: 'General',
              profile: 'Profile',
               messagingRelays: 'Messaging Relays',
               mediaServers: 'Media Servers',
               security: 'Security',
               about: 'About'
          },

        general: {
            appearanceLabel: 'Appearance',
            appearanceDescription:
                'Choose whether to follow System, Light, or Dark mode.',
            languageLabel: 'Language',
            languageDescription: 'Choose your preferred app language.'
        },
        notifications: {
            label: 'Notifications',
            supportedDescription:
                'Get notified when you receive new messages on this device',
            unsupportedDescription:
                'Notifications not supported on this device'
        },
        backgroundMessaging: {
            label: 'Background Messaging',
            description:
                'Keep nospeak connected to your messaging relays and receive message/reaction notifications while the app is in the background. Android will show a persistent notification when this is enabled. Works with both local-key (nsec) and Amber logins. Notification previews may be limited by your Android lockscreen privacy settings.',
            openBatterySettings: 'Open battery settings'
        },
        urlPreviews: {
            label: 'URL Previews',
            description:
                'Show preview cards for non-media links in messages.'
        },
        profile: {
            nameLabel: 'Name',
            namePlaceholder: 'Your name',
            displayNameLabel: 'Display Name',
            displayNamePlaceholder: 'Display name',
            aboutLabel: 'About',
            aboutPlaceholder: 'Tell us about yourself',
            pictureUrlLabel: 'Picture URL',
            pictureUrlPlaceholder: 'https://example.com/avatar.jpg',
            bannerUrlLabel: 'Banner URL',
            bannerUrlPlaceholder: 'https://example.com/banner.jpg',
            nip05Label: 'NIP-05 (Username)',
            nip05Placeholder: 'name@domain.com',
            websiteLabel: 'Website',
            websitePlaceholder: 'https://example.com',
            lightningLabel: 'Lightning Address (LUD-16)',
            lightningPlaceholder: 'user@provider.com',
            saveButton: 'Save Changes',
            savingButton: 'Saving...'
        },
          messagingRelays: {
              description: 'Configure your NIP-17 messaging relays. These relays are used to receive your encrypted messages. For best performance, 2 messaging relays usually work best.',
              inputPlaceholder: 'wss://relay.example.com',
              addButton: 'Add',
              emptyState: 'No relays configured',
              tooManyWarning: 'Having more than 3 messaging relays may reduce performance and reliability.',
              saveStatusSuccess: 'Saved relay list to {count} relays.',
              saveStatusPartial: 'Saved relay list to {succeeded} of {attempted} relays.',
              saveStatusNone: 'Could not save relay list to any relays.',
              saveStatusError: 'Error saving relay list. Your settings may not be fully propagated.',
              savingStatus: 'Saving relay settings…'
          },

           mediaServers: {
               description: 'Configure your Blossom media servers. These servers are used to store files you upload (profile media and chat attachments).',
 
               inputPlaceholder: 'https://cdn.example.com',
               addButton: 'Add',
               emptyState: 'No servers configured',
               saveStatusSuccess: 'Saved server list to {count} relays.',
               saveStatusPartial: 'Saved server list to {succeeded} of {attempted} relays.',
               saveStatusNone: 'Could not save server list to any relays.',
               saveStatusError: 'Error saving server list. Your settings may not be fully propagated.',
               savingStatus: 'Saving media server settings…',
               primary: 'Primary',
               setAsPrimary: 'Set as primary',
               mediaCacheLabel: 'Media Cache',
               mediaCacheDescription: 'Save viewed media to your gallery for offline access. Files can be managed in your Photos app.'
           },
 
 
           security: {
            loginMethodTitle: 'Login method',
            loginMethodUnknown: 'Unknown',
            npubLabel: 'Your npub',
            nsecLabel: 'Your nsec',
            hideNsecAria: 'Hide nsec',
            showNsecAria: 'Show nsec',
            dangerZoneTitle: 'Danger Zone',
            dangerZoneDescription: 'Logging out will remove all cached data from this device.',
            logoutButton: 'Logout'
        }
    },
    signerMismatch: {
        title: 'Account Mismatch',
        description: 'Your browser signer extension has a different account active than the one you logged in with.',
        expectedAccount: 'Logged in as',
        actualAccount: 'Signer active account',
        instructions: 'Please switch to the correct account in your signer extension and reload this page.'
    }
};

export default en;
