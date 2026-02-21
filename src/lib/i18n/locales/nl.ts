const nl = {
    common: {
        appName: 'nospeak',
        save: 'Opslaan',
        cancel: 'Annuleren'
    },
    auth: {
        loginWithAmber: 'Inloggen met Amber',
        loginWithExtension: 'Inloggen met Nostr Signer Extensie',
        orSeparator: 'OF',
        loginWithNsecLabel: 'Inloggen met nsec',
        nsecPlaceholder: 'nsec1...',
        loginButton: 'Inloggen',
        connecting: 'Verbinden...',
        generateKeypairLink: 'Nieuw sleutelpaar genereren',
        downloadAndroidApp: 'Android-app downloaden',
        amber: {
            title: 'Inloggen met Amber',
            helper: 'Scan deze QR-code met Amber of gebruik de knoppen hieronder.',
            openInAmber: 'Openen in Amber',
            copyConnectionString: 'Verbindingsreeks kopiëren',
            copied: 'Gekopieerd!'
        },
        keypair: {
            title: 'Nieuw sleutelpaar genereren',
            description: 'Er wordt lokaal in je browser een nieuw Nostr-sleutelpaar gegenereerd.',
            npubLabel: 'npub (publieke sleutel)',
            nsecLabel: 'nsec (geheime sleutel)',
            generateAnother: 'Nog een genereren',
            useAndLogin: 'Dit sleutelpaar gebruiken en inloggen'
        }
    },
    chats: {
        title: 'Chats',
        emptyHint: 'Nog geen chats. Tik op + om een contact toe te voegen.',
        selectPrompt: 'Selecteer een chat om te beginnen met berichten',
        addContact: 'Contact toevoegen',
        filterAll: 'Alle',
        filterUnread: 'Ongelezen',
        filterGroups: 'Groepen',
        emptyUnread: 'Geen ongelezen chats',
        emptyGroups: 'Geen groepen',
        favorites: 'Favorieten',
        favoriteMessage: 'bericht',
        favoriteMessages: 'berichten',
        emptyFavorites: 'Nog geen favoriete berichten',
        archive: 'Archiveren',
        unarchive: 'Dearchiveren',
        archived: 'Gearchiveerd',
        emptyArchive: 'Geen gearchiveerde chats',
        chatArchived: 'Chat gearchiveerd'
    },
    contacts: {
        title: 'Contacten',
        manage: 'Beheren',
        scanQr: 'QR scannen',
        scanQrAria: 'Contact QR-code scannen',
        emptyHint: 'Als er geen contacten verschijnen, klik op Beheren om er toe te voegen.',
        selectPrompt: 'Selecteer een contact om te beginnen met chatten',
        youPrefix: 'Jij',
        mediaPreview: {
            image: 'Afbeelding',
            video: 'Video',
            voiceMessage: 'Spraakbericht',
            audio: 'Audio',
            file: 'Bestand',
            location: 'Locatie'
        }
    },
    connection: {
        relaysLabel: 'Relays:',
        authLabel: 'Auth:',
        authFailedLabel: 'Mislukt:'
    },
    sync: {
        title: 'Berichten synchroniseren...',
        fetched: '{count} opgehaald',
        errorTitle: 'Synchronisatie mislukt',
        timeoutError: 'Synchronisatie verlopen na 5 minuten',
        relayErrorsTitle: 'Relay-fouten',
        retryButton: 'Opnieuw proberen',
        skipButton: 'Overslaan en doorgaan',
        continueInBackground: 'Doorgaan op achtergrond',
        backgroundComplete: 'Synchronisatie voltooid',
        manualRelay: {
            label: 'Of voer handmatig een relay in',
            placeholder: 'ws://192.168.1.50:7777',
            connectButton: 'Verbinden',
            connecting: 'Verbinden...',
            invalidUrl: 'Ongeldige relay-URL'
        },
        steps: {
            connectDiscoveryRelays: 'Verbinden met ontdekkingsrelays',
            fetchMessagingRelays: 'Berichtenrelays van gebruiker ophalen en cachen',
            connectReadRelays: 'Verbinden met berichtenrelays van gebruiker',
            fetchHistory: 'Geschiedenisitems ophalen en cachen van relays',
            fetchContacts: 'Contacten ophalen en samenvoegen van relays',
            fetchContactProfiles: 'Contactprofielen en relay-info ophalen en cachen',
            fetchUserProfile: 'Gebruikersprofiel ophalen en cachen'
        }
    },

         modals: {
          manageContacts: {
              title: 'Contacten',
              scanQr: 'QR scannen',
              scanQrAria: 'QR-code scannen om contact toe te voegen',
              searchPlaceholder: 'npub, NIP-05 of zoekterm',
              addContactAria: 'Contact toevoegen',
              searchContactsAria: 'Contacten zoeken',
              searching: 'Zoeken...',
              searchFailed: 'Zoeken mislukt',
              noResults: 'Geen resultaten',
              noContacts: 'Geen contacten toegevoegd',
              removeContactAria: 'Contact verwijderen',
              resolvingNip05: 'NIP-05 opzoeken...',
              nip05LookupFailed: 'NIP-05 opzoeken mislukt',
              nip05NotFound: 'NIP-05 niet gevonden',
              nip05InvalidFormat: 'Ongeldig NIP-05 formaat (gebruik naam@domein.com)',
              alreadyAdded: 'Al toegevoegd',
              syncing: 'Contacten synchroniseren…',
              pullToRefresh: 'Trek om te vernieuwen',
              releaseToRefresh: 'Loslaten om te vernieuwen',
              newContact: 'Contact toevoegen',
              createGroup: 'Groep aanmaken',
              contextMenu: {
                  openMenu: 'Menu openen',
                  delete: 'Verwijderen'
              },
              confirmDelete: {
                  title: 'Contact verwijderen',
                  message: 'Weet je zeker dat je {name} wilt verwijderen?',
                  confirm: 'Verwijderen'
              }
          },
          createGroup: {
              title: 'Groepschat aanmaken',
              searchPlaceholder: 'Contacten zoeken',
              selectedCount: '{count} geselecteerd',
              minContactsHint: 'Selecteer minstens 2 contacten',
              createButton: 'Groep aanmaken',
              creating: 'Aanmaken...',
              noContacts: 'Geen contacten om aan groep toe te voegen'
          },
         profile: {
              unknownName: 'Onbekend',
              about: 'Over',
              publicKey: 'Publieke sleutel',
              messagingRelays: 'Berichtenrelays',
              noRelays: 'Geen',
              refreshing: 'Profiel vernieuwen…',
              notFound: 'Profiel niet gevonden',
              addToContacts: 'Toevoegen aan contacten',
              addingContact: 'Toevoegen…',
              contactAdded: 'Contact toegevoegd'
          },

        emptyProfile: {
            title: 'Stel je profiel in',
            introLine1: 'Deze sleutel heeft nog geen berichtenrelays of gebruikersnaam geconfigureerd.',
            introLine2: 'We configureren enkele standaard berichtenrelays zodat nospeak berichten kan verzenden en ontvangen. Je kunt deze later wijzigen in Instellingen onder Berichtenrelays.',
            usernameLabel: 'Gebruikersnaam',
            usernamePlaceholder: 'Je naam',
            usernameRequired: 'Voer een gebruikersnaam in om door te gaan.',
            saveError: 'Kon de initiële configuratie niet opslaan. Probeer het opnieuw.',
            doLater: 'Ik doe dit later',
            saving: 'Opslaan...',
            continue: 'Doorgaan',
            autoRelaysConfigured: 'Berichtenrelays geconfigureerd. Je kunt ze wijzigen in Instellingen.'
        },
        relayStatus: {
            title: 'Relay-verbindingen',
            noRelays: 'Geen relays geconfigureerd',
            connected: 'Verbonden',
            disconnected: 'Niet verbonden',
            typeLabel: 'Type:',
            lastConnectedLabel: 'Laatst verbonden:',
            successLabel: 'Succes:',
            failureLabel: 'Mislukkingen:',
            authLabel: 'Auth:',
            authErrorLabel: 'Auth-fout:',
            authNotRequired: 'Niet vereist',
            authRequired: 'Vereist',
            authAuthenticating: 'Authenticeren',
            authAuthenticated: 'Geauthenticeerd',
            authFailed: 'Mislukt',
            typePersistent: 'Permanent',
            typeTemporary: 'Tijdelijk',
            never: 'Nooit'
        },
        qr: {
            title: 'QR-code',
            tabs: {
                myQr: 'Mijn code',
                scanQr: 'Code scannen'
            }
        },
        userQr: {
            preparing: 'QR-code voorbereiden…',
            hint: 'Dit is je npub als QR-code. Deel het met iemand zodat ze het kunnen scannen om je als contact toe te voegen.'
        },
        scanContactQr: {
            title: 'Contact-QR scannen',
            instructions: 'Richt je camera op een Nostr QR-code om een contact toe te voegen.',
            scanning: 'Scannen…',
            noCamera: 'Camera is niet beschikbaar op dit apparaat.',
            invalidQr: 'Deze QR-code bevat geen geldig contact-npub.',
            addFailed: 'Kon contact niet toevoegen via deze QR. Probeer het opnieuw.',
            added: 'Contact toegevoegd via QR.'
        },
        scanContactQrResult: {
            title: 'Contact via QR',
            alreadyContact: 'Dit contact staat al in je contacten.',
            reviewHint: 'Controleer het contact uit de gescande QR voordat je toevoegt.',
            updatingProfile: 'Profiel bijwerken…',
            loadFailed: 'Kon contactgegevens niet laden via QR.',
            addFailed: 'Kon contact niet toevoegen via QR.',
            closeButton: 'Sluiten',
            addButton: 'Contact toevoegen',
            startChatButton: 'Chat starten'
        },
        attachmentPreview: {
            title: 'Bijlage-voorbeeld',
            imageAlt: 'Bijlage-voorbeeld',
            noPreview: 'Geen voorbeeld beschikbaar',
            captionLabel: 'Bijschrift (optioneel)',
            cancelButton: 'Annuleren',
            sendButtonIdle: 'Versturen',
            sendButtonSending: 'Versturen…',
            uploadButtonIdle: 'Uploaden',
            uploadButtonUploading: 'Uploaden…'
        },
        locationPreview: {
            title: 'Locatie',
            closeButton: 'Sluiten',
            openInOpenStreetMap: 'Openen in OpenStreetMap',
            ctrlScrollToZoom: 'Gebruik Ctrl + scrollen om te zoomen'
        },
        mediaServersAutoConfigured: {
            title: 'Mediaservers geconfigureerd',
            message: 'Er waren geen Blossom-servers geconfigureerd. We hebben {server1} en {server2} toegevoegd.\n\nJe kunt deze wijzigen in Instellingen → Mediaservers.'
        }
    },
    chat: {
        sendFailedTitle: 'Verzenden mislukt',
        sendFailedMessagePrefix: 'Bericht verzenden mislukt: ',
        location: {
            errorTitle: 'Locatiefout',
            errorMessage: 'Kon je locatie niet ophalen. Controleer de machtigingen.'
        },
        relative: {
            justNow: 'zojuist',
            minutes: '{count} min geleden',
            minutesPlural: '{count} min geleden',
            hours: '{count} uur geleden',
            hoursPlural: '{count} uur geleden',
            days: '{count} dag geleden',
            daysPlural: '{count} dagen geleden',
            weeks: '{count} week geleden',
            weeksPlural: '{count} weken geleden',
            months: '{count} maand geleden',
            monthsPlural: '{count} maanden geleden',
            years: '{count} jaar geleden',
            yearsPlural: '{count} jaar geleden'
        },
        dateLabel: {
            today: 'Vandaag',
            yesterday: 'Gisteren'
        },
        history: {
            fetchOlder: 'Oudere berichten ophalen van relays',
            summary: '{events} gebeurtenissen opgehaald, {saved} nieuwe berichten opgeslagen ({chat} in deze chat)',
            none: 'Geen berichten meer beschikbaar van relays',
            error: 'Kon oudere berichten niet ophalen. Probeer het later opnieuw.'
        },
        empty: {
            noMessagesTitle: 'Nog geen berichten',
            forContact: 'Begin het gesprek met {name}.',
            forGroup: 'Begin het gesprek in {name}.',
            generic: 'Selecteer een contact om te beginnen met chatten.'
        },
        group: {
            defaultTitle: 'Groepschat',
            participants: '{count} deelnemers',
            participantsShort: '{count}',
            members: 'Leden: {count}',
            membersTitle: 'Leden',
            viewMembers: 'Leden bekijken',
            editName: 'Groepsnaam bewerken',
            editNameTitle: 'Groepsnaam',
            editNamePlaceholder: 'Voer groepsnaam in...',
            editNameHint: 'Laat leeg om deelnemersnamen te gebruiken',
            editNameSave: 'Opslaan',
            editNameCancel: 'Annuleren',
            nameSavedToast: 'Opgeslagen. Wordt ingesteld bij het volgende bericht.',
            nameValidationTooLong: 'Naam te lang (max 100 tekens)',
            nameValidationInvalidChars: 'Naam bevat ongeldige tekens'
        },
        inputPlaceholder: 'Typ een bericht...',
        contextMenu: {
            cite: 'Citeren',
            copy: 'Kopiëren',
            sentAt: 'Verzonden',
            favorite: 'Favoriet',
            unfavorite: 'Favoriet verwijderen'
        },
        reactions: {
            cannotReactTitle: 'Kan niet reageren',
            cannotReactMessage: 'Dit bericht is te oud om reacties te ondersteunen.',
            failedTitle: 'Reactie mislukt',
            failedMessagePrefix: 'Reactie verzenden mislukt: '
        },
        mediaMenu: {
            uploadMediaTooltip: 'Media uploaden',
            takePhoto: 'Foto maken',
            location: 'Locatie',
            image: 'Afbeelding',
            video: 'Video',
            audio: 'Muziek',
            file: 'Bestand'
        },
        mediaErrors: {
            cameraErrorTitle: 'Camerafout',
            cameraErrorMessage: 'Kon geen foto maken'
        },
        fileUpload: {
            fileTooLarge: 'Bestand is te groot. Maximale grootte is 10 MB.',
            download: 'Downloaden',
            decrypting: 'Ontsleutelen...'
        },
        mediaUnavailable: 'Deze media is niet meer beschikbaar.',
        voiceMessage: {
            title: 'Spraakbericht',
            recordAria: 'Spraakbericht opnemen',
            playPreviewAria: 'Voorbeeld afspelen',
            pausePreviewAria: 'Voorbeeld pauzeren',
            cancelButton: 'Annuleren',
            pauseButton: 'Pauzeren',
            doneButton: 'Klaar',
            resumeButton: 'Hervatten',
            sendButton: 'Versturen',
            microphoneTitle: 'Microfoon',
            permissionDeniedTitle: 'Microfoontoestemming',
            permissionDeniedMessage: 'Sta microfoontogang toe om op te nemen.',
            nativeNotAvailable: 'Eigen opname niet beschikbaar.',
            unsupported: 'Spraakopname niet ondersteund op dit apparaat.',
            failedToStart: 'Kon opname niet starten.',
            failedToStop: 'Kon opname niet stoppen.',
            recordingFailed: 'Opname mislukt.'
        },
        relayStatus: {
            sending: 'versturen...',
            sentToRelays: 'verstuurd naar {successful}/{desired} relays'
        },
        searchPlaceholder: 'Zoeken',
        searchNoMatches: 'Geen resultaten',
        searchAriaLabel: 'Chat doorzoeken'
    },
    settings: {
          title: 'Instellingen',
          categories: {
              general: 'Algemeen',
              profile: 'Profiel',
               messagingRelays: 'Berichtenrelays',
               mediaServers: 'Mediaservers',
               security: 'Beveiliging',
               about: 'Over'
          },

        general: {
            appearanceLabel: 'Weergave',
            appearanceDescription:
                'Kies of je Systeem, Licht of Donker modus wilt volgen.',
            languageLabel: 'Taal',
            languageDescription: 'Kies je voorkeurstaal voor de app.'
        },
        notifications: {
            label: 'Meldingen',
            supportedDescription:
                'Ontvang een melding wanneer je nieuwe berichten ontvangt op dit apparaat',
            unsupportedDescription:
                'Meldingen worden niet ondersteund op dit apparaat'
        },
        backgroundMessaging: {
            label: 'Achtergrondberichten',
            description:
                'Houd nospeak verbonden met je berichtenrelays en ontvang bericht-/reactiemeldingen terwijl de app op de achtergrond draait. Android toont een permanente melding wanneer dit is ingeschakeld. Werkt met zowel lokale sleutel (nsec) als Amber-aanmeldingen. Berichtvoorbeelden kunnen beperkt worden door je Android-vergrendelscherm privacyinstellingen.',
            openBatterySettings: 'Batterij-instellingen openen'
        },
        urlPreviews: {
            label: 'URL-voorbeelden',
            description:
                'Toon voorbeeldkaarten voor niet-medialinks in berichten.'
        },
        profile: {
            nameLabel: 'Naam',
            namePlaceholder: 'Je naam',
            displayNameLabel: 'Weergavenaam',
            displayNamePlaceholder: 'Weergavenaam',
            aboutLabel: 'Over',
            aboutPlaceholder: 'Vertel iets over jezelf',
            pictureUrlLabel: 'Foto-URL',
            pictureUrlPlaceholder: 'https://example.com/avatar.jpg',
            bannerUrlLabel: 'Banner-URL',
            bannerUrlPlaceholder: 'https://example.com/banner.jpg',
            nip05Label: 'NIP-05 (Gebruikersnaam)',
            nip05Placeholder: 'naam@domein.com',
            websiteLabel: 'Website',
            websitePlaceholder: 'https://example.com',
            lightningLabel: 'Lightning-adres (LUD-16)',
            lightningPlaceholder: 'gebruiker@provider.com',
            saveButton: 'Wijzigingen opslaan',
            savingButton: 'Opslaan...'
        },
          messagingRelays: {
              description: 'Configureer je NIP-17 berichtenrelays. Deze relays worden gebruikt om je versleutelde berichten te ontvangen. Voor de beste prestaties werken meestal 2 berichtenrelays het best.',
              inputPlaceholder: 'wss://relay.example.com',
              addButton: 'Toevoegen',
              emptyState: 'Geen relays geconfigureerd',
              tooManyWarning: 'Meer dan 3 berichtenrelays kan de prestaties en betrouwbaarheid verminderen.',
              saveStatusSuccess: 'Relay-lijst opgeslagen naar {count} relays.',
              saveStatusPartial: 'Relay-lijst opgeslagen naar {succeeded} van {attempted} relays.',
              saveStatusNone: 'Kon relay-lijst niet opslaan naar relays.',
              saveStatusError: 'Fout bij opslaan van relay-lijst. Je instellingen zijn mogelijk niet volledig doorgevoerd.',
              savingStatus: 'Relay-instellingen opslaan…'
          },

           mediaServers: {
               description: 'Configureer je Blossom-mediaservers. Deze servers worden gebruikt om bestanden op te slaan die je uploadt (profielmedia en chatbijlagen).',

               inputPlaceholder: 'https://cdn.example.com',
               addButton: 'Toevoegen',
               emptyState: 'Geen servers geconfigureerd',
               saveStatusSuccess: 'Serverlijst opgeslagen naar {count} relays.',
               saveStatusPartial: 'Serverlijst opgeslagen naar {succeeded} van {attempted} relays.',
               saveStatusNone: 'Kon serverlijst niet opslaan naar relays.',
               saveStatusError: 'Fout bij opslaan van serverlijst. Je instellingen zijn mogelijk niet volledig doorgevoerd.',
               savingStatus: 'Mediaserverinstellingen opslaan…',
               primary: 'Primair',
               setAsPrimary: 'Instellen als primair',
               mediaCacheLabel: 'Mediacache',
               mediaCacheDescription: 'Sla bekeken media op in je galerij voor offline toegang. Bestanden kunnen worden beheerd in je Foto\'s-app.'
           },


           security: {
            loginMethodTitle: 'Inlogmethode',
            loginMethodUnknown: 'Onbekend',
            npubLabel: 'Je npub',
            nsecLabel: 'Je nsec',
            hideNsecAria: 'nsec verbergen',
            showNsecAria: 'nsec tonen',
            dangerZoneTitle: 'Gevarenzone',
            dangerZoneDescription: 'Uitloggen verwijdert alle gecachte gegevens van dit apparaat.',
            logoutButton: 'Uitloggen'
        }
    },
    signerMismatch: {
        title: 'Account komt niet overeen',
        description: 'Je browser signer-extensie heeft een ander account actief dan waarmee je bent ingelogd.',
        expectedAccount: 'Ingelogd als',
        actualAccount: 'Actief signer-account',
        instructions: 'Schakel naar het juiste account in je signer-extensie en herlaad deze pagina.'
    }
};

export default nl;
