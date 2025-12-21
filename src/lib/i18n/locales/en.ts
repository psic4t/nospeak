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
    contacts: {
        title: 'Contacts',
        manage: 'Manage',
        scanQr: 'Scan QR',
        scanQrAria: 'Scan contact QR code',
        emptyHint: 'If no contacts appear, click Manage to add some.',
        selectPrompt: 'Select a contact to start chatting',
        youPrefix: 'You'
    },
    connection: {
        relaysLabel: 'Relays:',
        authLabel: 'Auth:',
        authFailedLabel: 'Failed:'
    },
    sync: {
         title: 'Syncing messages...',
         fetched: '{count} fetched',
         steps: {
             connectDiscoveryRelays: 'Connect to discovery relays',
             fetchMessagingRelays: "Fetch and cache user's messaging relays",
             connectReadRelays: "Connect to user's messaging relays",
             fetchHistory: 'Fetch and cache history items from relays',
             fetchContactProfiles: 'Fetch and cache contact profiles and relay info',
             fetchUserProfile: 'Fetch and cache user profile'
         }
     },

        modals: {
         manageContacts: {
             title: 'Manage Contacts',
             searchPlaceholder: 'npub or search term',
             addContactAria: 'Add contact',
             searchContactsAria: 'Search contacts',
             searching: 'Searching...',
             searchFailed: 'Search failed',
             noResults: 'No results',
             noContacts: 'No contacts added',
             removeContactAria: 'Remove contact'
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
            continue: 'Continue'
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
        userQr: {
            preparing: 'Preparing QR code…'
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
        attachmentPreview: {
            title: 'Attachment preview',
            imageAlt: 'Attachment preview',
            noPreview: 'No preview available',
            captionLabel: 'Caption (optional)',
            cancelButton: 'Cancel',
            sendButtonIdle: 'Send',
            sendButtonSending: 'Sending…'
        }
    },
    chat: {
        sendFailedTitle: 'Send failed',
        sendFailedMessagePrefix: 'Failed to send message: ',
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
            none: 'No more messages available from relays',
            error: 'Failed to fetch older messages. Try again later.'
        },
        empty: {
            noMessagesTitle: 'No messages yet',
            forContact: 'Start the conversation with {name}.',
            generic: 'Select a contact to start chatting.'
        },
        inputPlaceholder: 'Type a message...',
        contextMenu: {
            cite: 'Cite',
            copy: 'Copy'
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
            image: 'Image',
            video: 'Video',
            audio: 'Music'
        },
        mediaErrors: {
            cameraErrorTitle: 'Camera error',
            cameraErrorMessage: 'Failed to capture photo'
        }
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
            label: 'Message Notifications',
            supportedDescription:
                'Get notified when you receive new messages on this device',
            unsupportedDescription:
                'Notifications not supported on this device'
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
              toggleLabel: 'Use Blossom servers',
              toggleDescription: 'When enabled, uploads go to your configured Blossom servers instead of nospeak\'s local storage.',
              toggleDisabledNoServers: 'Add at least one media server to enable Blossom uploads.',
              toggleAriaEnable: 'Enable Blossom uploads',
              toggleAriaDisable: 'Disable Blossom uploads',
              inputPlaceholder: 'https://cdn.example.com',
              addButton: 'Add',
              emptyState: 'No servers configured',
              saveStatusSuccess: 'Saved server list to {count} relays.',
              saveStatusPartial: 'Saved server list to {succeeded} of {attempted} relays.',
              saveStatusNone: 'Could not save server list to any relays.',
              saveStatusError: 'Error saving server list. Your settings may not be fully propagated.',
              savingStatus: 'Saving media server settings…'
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
    }
};

export default en;
