const de = {
    common: {
        appName: 'nospeak',
        save: 'Speichern',
        cancel: 'Abbrechen'
    },
    auth: {
        loginWithAmber: 'Mit Amber anmelden',
        loginWithExtension: 'Mit Nostr-Signer-Erweiterung anmelden',
        orSeparator: 'ODER',
        loginWithNsecLabel: 'Mit nsec anmelden',
        nsecPlaceholder: 'nsec1...',
        loginButton: 'Anmelden',
        connecting: 'Verbinden...',
        generateKeypairLink: 'Neues Schlüsselpaar erzeugen',
        downloadAndroidApp: 'Android-App herunterladen',
        amber: {
            title: 'Mit Amber anmelden',
            helper: 'Scanne diesen QR-Code mit Amber oder nutze die Schaltflächen unten.',
            openInAmber: 'In Amber öffnen',
            copyConnectionString: 'Verbindungszeichenfolge kopieren',
            copied: 'Kopiert!'
        },
        keypair: {
            title: 'Neues Schlüsselpaar erzeugen',
            description: 'Ein neues Nostr-Schlüsselpaar wird lokal im Browser erzeugt.',
            npubLabel: 'npub (öffentlicher Schlüssel)',
            nsecLabel: 'nsec (geheimer Schlüssel)',
            generateAnother: 'Weiteres Schlüsselpaar erzeugen',
            useAndLogin: 'Dieses Schlüsselpaar verwenden und anmelden'
        }
    },
    chats: {
        title: 'Chats',
        emptyHint: 'Noch keine Chats. Tippe auf +, um einen Kontakt hinzuzufügen.',
        selectPrompt: 'Wähle einen Chat aus, um zu schreiben',
        addContact: 'Kontakt hinzufügen',
        filterAll: 'Alle',
        filterUnread: 'Ungelesen',
        filterGroups: 'Gruppen',
        emptyUnread: 'Keine ungelesenen Chats',
        emptyGroups: 'Keine Gruppen',
        favorites: 'Favoriten',
        favoriteMessage: 'Nachricht',
        favoriteMessages: 'Nachrichten',
        emptyFavorites: 'Noch keine Favoriten',
        archive: 'Archivieren',
        unarchive: 'Dearchivieren',
        archived: 'Archiviert',
        emptyArchive: 'Keine archivierten Chats',
        chatArchived: 'Chat archiviert'
    },
    contacts: {
        title: 'Kontakte',
        manage: 'Verwalten',
        scanQr: 'QR scannen',
        scanQrAria: 'Kontakt-QR-Code scannen',
        emptyHint: 'Wenn keine Kontakte angezeigt werden, klicke auf „Verwalten", um welche hinzuzufügen.',
        selectPrompt: 'Wähle einen Kontakt aus, um zu chatten',
        youPrefix: 'Du',
        mediaPreview: {
            image: 'Bild',
            video: 'Video',
            voiceMessage: 'Sprachnachricht',
            audio: 'Audio',
            file: 'Datei',
            location: 'Standort'
        }
    },

    connection: {
        relaysLabel: 'Relays:',
        authLabel: 'Auth:',
        authFailedLabel: 'Fehlgeschlagen:'
    },
    sync: {
        title: 'Nachrichten werden synchronisiert...',
        fetched: '{count} abgerufen',
        errorTitle: 'Synchronisierung fehlgeschlagen',
        timeoutError: 'Zeitüberschreitung nach 5 Minuten',
        relayErrorsTitle: 'Relay-Fehler',
        retryButton: 'Erneut versuchen',
        skipButton: 'Überspringen und fortfahren',
        continueInBackground: 'Im Hintergrund fortfahren',
        backgroundComplete: 'Synchronisierung abgeschlossen',
        manualRelay: {
            label: 'Oder Relay manuell eingeben',
            placeholder: 'ws://192.168.1.50:7777',
            connectButton: 'Verbinden',
            connecting: 'Verbinde...',
            invalidUrl: 'Ungültige Relay-URL'
        },
        steps: {
            connectDiscoveryRelays: 'Verbindung zu Discovery-Relays herstellen',
            fetchMessagingRelays: 'Messaging-Relays des Nutzers abrufen und zwischenspeichern',
            connectReadRelays: 'Verbindung zu den Messaging-Relays des Nutzers herstellen',
            fetchHistory: 'Verlaufseinträge von Relays abrufen und zwischenspeichern',
            fetchContacts: 'Kontakte von Relays abrufen und zusammenführen',
            fetchContactProfiles: 'Kontaktprofile und Relay-Informationen abrufen und zwischenspeichern',
            fetchUserProfile: 'Benutzerprofil abrufen und zwischenspeichern'
        }
    },

         modals: {
          manageContacts: {
              title: 'Kontakte',
              scanQr: 'QR scannen',
              scanQrAria: 'QR-Code scannen um Kontakt hinzuzufügen',
              searchPlaceholder: 'npub, NIP-05 oder Suchbegriff',
              addContactAria: 'Kontakt hinzufügen',
              searchContactsAria: 'Kontakte suchen',
              searching: 'Suche…',
              searchFailed: 'Suche fehlgeschlagen',
              noResults: 'Keine Treffer',
              noContacts: 'Keine Kontakte hinzugefügt',
              removeContactAria: 'Kontakt entfernen',
              resolvingNip05: 'NIP-05 wird gesucht...',
              nip05LookupFailed: 'NIP-05 Suche fehlgeschlagen',
              nip05NotFound: 'NIP-05 nicht gefunden',
              nip05InvalidFormat: 'Ungültiges NIP-05 Format (nutze name@domain.com)',
              alreadyAdded: 'Bereits hinzugefügt',
              syncing: 'Kontakte werden synchronisiert…',
              pullToRefresh: 'Zum Aktualisieren ziehen',
              releaseToRefresh: 'Loslassen zum Aktualisieren',
              contextMenu: {
                  openMenu: 'Menü öffnen',
                  delete: 'Löschen'
              },
              confirmDelete: {
                  title: 'Kontakt löschen',
                  message: 'Möchtest du {name} wirklich löschen?',
                  confirm: 'Löschen'
              },
              newContact: 'Kontakt hinzufügen',
              createGroup: 'Gruppe erstellen'
          },
          createGroup: {
              title: 'Gruppenchat erstellen',
              searchPlaceholder: 'Kontakte suchen',
              selectedCount: '{count} ausgewählt',
              minContactsHint: 'Wähle mindestens 2 Kontakte',
              createButton: 'Gruppe erstellen',
              creating: 'Wird erstellt…',
              noContacts: 'Keine Kontakte zum Hinzufügen'
          },
         profile: {
              unknownName: 'Unbekannt',
              about: 'Über',
              publicKey: 'Öffentlicher Schlüssel',
              messagingRelays: 'Messaging-Relays',
              noRelays: 'Keine',
              refreshing: 'Profil wird aktualisiert…',
              notFound: 'Profil nicht gefunden',
              addToContacts: 'Zu Kontakten hinzufügen',
              addingContact: 'Wird hinzugefügt…',
              contactAdded: 'Kontakt hinzugefügt'
          },

        emptyProfile: {
            title: 'Profil-Einrichtung abschließen',
            introLine1: 'Dieser Schlüssel hat noch keine Messaging-Relays oder einen Benutzernamen.',
            introLine2: 'Wir richten einige Standard-Messaging-Relays ein, damit nospeak Nachrichten senden und empfangen kann. Du kannst diese später in den Einstellungen unter Messaging-Relays ändern.',
            usernameLabel: 'Benutzername',
            usernamePlaceholder: 'Dein Name',
            usernameRequired: 'Bitte gib einen Benutzernamen ein, um fortzufahren.',
            saveError: 'Deine Ersteinrichtung konnte nicht gespeichert werden. Bitte versuche es erneut.',
            doLater: 'Ich kümmere mich später darum',
            saving: 'Speichere…',
            continue: 'Weiter',
            autoRelaysConfigured: 'Messaging-Relays wurden konfiguriert. Du kannst sie in den Einstellungen ändern.'
        },
        relayStatus: {
            title: 'Relay-Verbindungen',
            noRelays: 'Keine Relays konfiguriert',
            connected: 'Verbunden',
            disconnected: 'Getrennt',
            typeLabel: 'Typ:',
            lastConnectedLabel: 'Zuletzt verbunden:',
            successLabel: 'Erfolge:',
            failureLabel: 'Fehler:',
            authLabel: 'Auth:',
            authErrorLabel: 'Auth-Fehler:',
            authNotRequired: 'Nicht erforderlich',
            authRequired: 'Erforderlich',
            authAuthenticating: 'Authentifiziere',
            authAuthenticated: 'Authentifiziert',
            authFailed: 'Fehlgeschlagen',
            typePersistent: 'Persistent',
            typeTemporary: 'Temporär',
            never: 'Nie'
        },
        qr: {
            title: 'QR-Code',
            tabs: {
                myQr: 'Mein Code',
                scanQr: 'Code scannen'
            }
        },
        userQr: {
            preparing: 'QR-Code wird vorbereitet…',
            hint: 'Dies ist dein npub als QR-Code. Teile ihn mit jemandem, damit diese Person ihn scannen und dich als Kontakt hinzufügen kann.'
        },
        scanContactQr: {
            title: 'Kontakt-QR scannen',
            instructions: 'Richte die Kamera auf einen nostr-QR-Code, um einen Kontakt hinzuzufügen.',
            scanning: 'Scanne…',
            noCamera: 'Auf diesem Gerät ist keine Kamera verfügbar.',
            invalidQr: 'Dieser QR-Code enthält keinen gültigen Kontakt-npub.',
            addFailed: 'Kontakt konnte aus diesem QR nicht hinzugefügt werden. Bitte versuche es erneut.',
            added: 'Kontakt per QR hinzugefügt.'
        },
        scanContactQrResult: {
            title: 'Kontakt aus QR',
            alreadyContact: 'Dieser Kontakt ist bereits in deinen Kontakten.',
            reviewHint: 'Überprüfe den Kontakt aus dem gescannten QR vor dem Hinzufügen.',
            updatingProfile: 'Profil wird aktualisiert…',
            loadFailed: 'Kontaktdaten aus QR konnten nicht geladen werden.',
            addFailed: 'Kontakt aus QR konnte nicht hinzugefügt werden.',
            closeButton: 'Schließen',
            addButton: 'Kontakt hinzufügen',
            startChatButton: 'Chat starten'
        },
        attachmentPreview: {
            title: 'Anhangvorschau',
            imageAlt: 'Anhangvorschau',
            noPreview: 'Keine Vorschau verfügbar',
            captionLabel: 'Beschriftung (optional)',
            cancelButton: 'Abbrechen',
            sendButtonIdle: 'Senden',
            sendButtonSending: 'Senden…',
            uploadButtonIdle: 'Hochladen',
            uploadButtonUploading: 'Wird hochgeladen…'
        },
        locationPreview: {
            title: 'Standort',
            closeButton: 'Schließen',
            openInOpenStreetMap: 'In OpenStreetMap öffnen',
            ctrlScrollToZoom: 'Strg + Scrollen zum Zoomen'
        },
        mediaServersAutoConfigured: {
            title: 'Medienserver konfiguriert',
            message: 'Es waren keine Blossom-Server konfiguriert. Wir haben {server1} und {server2} hinzugefügt.\n\nDu kannst diese später unter Einstellungen → Medienserver ändern.'
        }
 
    },
    chat: {
        sendFailedTitle: 'Senden fehlgeschlagen',
        sendFailedMessagePrefix: 'Nachricht konnte nicht gesendet werden: ',
        location: {
            errorTitle: 'Standortfehler',
            errorMessage: 'Standort konnte nicht abgerufen werden. Bitte überprüfe die Berechtigungen.'
        },
        relative: {
            justNow: 'gerade eben',
            minutes: 'vor {count} Minute',
            minutesPlural: 'vor {count} Minuten',
            hours: 'vor {count} Stunde',
            hoursPlural: 'vor {count} Stunden',
            days: 'vor {count} Tag',
            daysPlural: 'vor {count} Tagen',
            weeks: 'vor {count} Woche',
            weeksPlural: 'vor {count} Wochen',
            months: 'vor {count} Monat',
            monthsPlural: 'vor {count} Monaten',
            years: 'vor {count} Jahr',
            yearsPlural: 'vor {count} Jahren'
        },
        dateLabel: {
            today: 'Heute',
            yesterday: 'Gestern'
        },
        history: {
            fetchOlder: 'Ältere Nachrichten von Relays abrufen',
            summary: '{events} Events geladen, {saved} neue Nachrichten gespeichert ({chat} in diesem Chat)',
            none: 'Keine weiteren Nachrichten von den Relays verfügbar',
            error: 'Ältere Nachrichten konnten nicht geladen werden. Bitte versuche es später erneut.'
        },
        empty: {
            noMessagesTitle: 'Noch keine Nachrichten',
            forContact: 'Starte das Gespräch mit {name}.',
            forGroup: 'Starte das Gespräch in {name}.',
            generic: 'Wähle einen Kontakt aus, um zu chatten.'
        },
        group: {
            defaultTitle: 'Gruppenchat',
            participants: '{count} Teilnehmer',
            participantsShort: '{count}',
            members: 'Mitglieder: {count}',
            membersTitle: 'Mitglieder',
            viewMembers: 'Mitglieder anzeigen',
            editName: 'Gruppenname bearbeiten',
            editNameTitle: 'Gruppenname',
            editNamePlaceholder: 'Gruppenname eingeben...',
            editNameHint: 'Leer lassen für Teilnehmernamen',
            editNameSave: 'Speichern',
            editNameCancel: 'Abbrechen',
            nameSavedToast: 'Gespeichert. Wird mit nächster Nachricht gesetzt.',
            nameValidationTooLong: 'Name zu lang (max. 100 Zeichen)',
            nameValidationInvalidChars: 'Name enthält ungültige Zeichen'
        },
        inputPlaceholder: 'Nachricht eingeben...',
        contextMenu: {
            cite: 'Zitieren',
            copy: 'Kopieren',
            sentAt: 'Gesendet',
            favorite: 'Favorit',
            unfavorite: 'Favorit entfernen'
        },
        reactions: {
            cannotReactTitle: 'Reaktion nicht möglich',
            cannotReactMessage: 'Diese Nachricht ist zu alt für Reaktionen.',
            failedTitle: 'Reaktion fehlgeschlagen',
            failedMessagePrefix: 'Reaktion konnte nicht gesendet werden: '
        },
        mediaMenu: {
            uploadMediaTooltip: 'Medien hochladen',
            takePhoto: 'Foto aufnehmen',
            location: 'Standort',
            image: 'Bild',
            video: 'Video',
            audio: 'Musik',
            file: 'Datei'
        },
        mediaErrors: {
            cameraErrorTitle: 'Kamerafehler',
            cameraErrorMessage: 'Foto konnte nicht aufgenommen werden'
        },
        fileUpload: {
            fileTooLarge: 'Datei ist zu groß. Maximale Größe ist 10 MB.',
            download: 'Herunterladen',
            decrypting: 'Entschlüsseln...'
        },
        mediaUnavailable: 'Dieses Medium ist nicht mehr verfügbar.',
        voiceMessage: {
            title: 'Sprachnachricht',
            recordAria: 'Sprachnachricht aufnehmen',
            playPreviewAria: 'Vorschau abspielen',
            pausePreviewAria: 'Vorschau pausieren',
            cancelButton: 'Abbrechen',
            pauseButton: 'Pausieren',
            doneButton: 'Fertig',
            resumeButton: 'Fortsetzen',
            sendButton: 'Senden',
            microphoneTitle: 'Mikrofon',
            permissionDeniedTitle: 'Mikrofonberechtigung',
            permissionDeniedMessage: 'Bitte erlaube Zugriff auf das Mikrofon, um aufzunehmen.',
            nativeNotAvailable: 'Native Aufnahme nicht verfügbar.',
            unsupported: 'Sprachaufnahme wird auf diesem Gerät nicht unterstützt.',
            failedToStart: 'Aufnahme konnte nicht gestartet werden.',
            failedToStop: 'Aufnahme konnte nicht beendet werden.',
            recordingFailed: 'Aufnahme fehlgeschlagen.'
        },
        relayStatus: {
            sending: 'wird gesendet...',
            sentToRelays: 'an {successful}/{desired} Relays gesendet'
        },
        searchPlaceholder: 'Suche',
        searchNoMatches: 'Keine Treffer',
        searchAriaLabel: 'Chat durchsuchen'
    },
    settings: {
          title: 'Einstellungen',
          categories: {
              general: 'Allgemein',
              profile: 'Profil',
               messagingRelays: 'Messaging-Relays',
               mediaServers: 'Medienserver',
               security: 'Sicherheit',
               about: 'Info'
          },

        general: {
            appearanceLabel: 'Darstellung',
            appearanceDescription:
                'Wähle, ob System-, Hell- oder Dunkelmodus verwendet werden soll.',
            languageLabel: 'Sprache',
            languageDescription: 'Wähle deine bevorzugte App-Sprache.'
        },
        notifications: {
            label: 'Benachrichtigungen',
            supportedDescription:
                'Erhalte Benachrichtigungen, wenn neue Nachrichten auf diesem Gerät eingehen',
            unsupportedDescription:
                'Benachrichtigungen werden auf diesem Gerät nicht unterstützt'
        },
        backgroundMessaging: {
            label: 'Background Messaging',
            description:
                'Halte nospeak mit deinen Messaging-Relays verbunden und erhalte Nachrichten-/Reaktionsbenachrichtigungen, während die App im Hintergrund ist. Android zeigt hierfür eine dauerhafte Benachrichtigung an. Funktioniert sowohl mit lokalem Schlüssel (nsec) als auch mit Amber-Login. Vorschauen können durch deine Android-Sperrbildschirm-Einstellungen eingeschränkt sein.',
            openBatterySettings: 'Batterieeinstellungen öffnen'
        },
        urlPreviews: {
            label: 'URL-Vorschauen',
            description:
                'Zeige Vorschauboxen für Nicht-Medien-Links in Nachrichten an.'
        },
        profile: {
            nameLabel: 'Name',
            namePlaceholder: 'Dein Name',
            displayNameLabel: 'Anzeigename',
            displayNamePlaceholder: 'Anzeigename',
            aboutLabel: 'Über dich',
            aboutPlaceholder: 'Erzähle etwas über dich',
            pictureUrlLabel: 'Bild-URL',
            pictureUrlPlaceholder: 'https://example.com/avatar.jpg',
            bannerUrlLabel: 'Banner-URL',
            bannerUrlPlaceholder: 'https://example.com/banner.jpg',
            nip05Label: 'NIP-05 (Benutzername)',
            nip05Placeholder: 'name@domain.com',
            websiteLabel: 'Webseite',
            websitePlaceholder: 'https://example.com',
            lightningLabel: 'Lightning-Adresse (LUD-16)',
            lightningPlaceholder: 'user@provider.com',
            saveButton: 'Änderungen speichern',
            savingButton: 'Speichere…'
        },
          messagingRelays: {
              description: 'Konfiguriere deine NIP-17-Messaging-Relays. Diese Relays werden verwendet, um deine verschlüsselten Nachrichten zu empfangen. Für die meisten Nutzer funktionieren 2–3 Messaging-Relays am zuverlässigsten.',
              inputPlaceholder: 'wss://relay.example.com',
              addButton: 'Hinzufügen',
              emptyState: 'Keine Relays konfiguriert',
              tooManyWarning: 'Mehr als 3 Messaging-Relays können Performance und Zuverlässigkeit verschlechtern.',
              saveStatusSuccess: 'Relay-Liste auf {count} Relays gespeichert.',
              saveStatusPartial: 'Relay-Liste auf {succeeded} von {attempted} Relays gespeichert.',
              saveStatusNone: 'Relay-Liste konnte auf keinem Relay gespeichert werden.',
              saveStatusError: 'Fehler beim Speichern der Relay-Liste. Einstellungen sind möglicherweise nicht vollständig propagiert.',
              savingStatus: 'Relay-Einstellungen werden gespeichert…'
          },

           mediaServers: {
               description: 'Konfiguriere deine Blossom-Medienserver. Diese Server speichern Dateien, die du hochlädst (Profilmedien und Chat-Anhänge).',
 
               inputPlaceholder: 'https://cdn.example.com',
               addButton: 'Hinzufügen',
               emptyState: 'Keine Server konfiguriert',
               saveStatusSuccess: 'Serverliste auf {count} Relays gespeichert.',
               saveStatusPartial: 'Serverliste auf {succeeded} von {attempted} Relays gespeichert.',
               saveStatusNone: 'Serverliste konnte auf keinem Relay gespeichert werden.',
               saveStatusError: 'Fehler beim Speichern der Serverliste. Einstellungen sind möglicherweise nicht vollständig propagiert.',
               savingStatus: 'Medienserver-Einstellungen werden gespeichert…',
               primary: 'Primär',
               setAsPrimary: 'Als primär festlegen',
               mediaCacheLabel: 'Medien-Cache',
               mediaCacheDescription: 'Speichere angesehene Medien in deiner Galerie für Offline-Zugriff. Dateien können in deiner Fotos-App verwaltet werden.'
           },
 

          security: {
            loginMethodTitle: 'Anmeldemethode',
            loginMethodUnknown: 'Unbekannt',
            npubLabel: 'Dein npub',
            nsecLabel: 'Dein nsec',
            hideNsecAria: 'nsec ausblenden',
            showNsecAria: 'nsec anzeigen',
            dangerZoneTitle: 'Gefahrenzone',
            dangerZoneDescription: 'Abmelden entfernt alle zwischengespeicherten Daten von diesem Gerät.',
            logoutButton: 'Abmelden'
        }
    },
    signerMismatch: {
        title: 'Konto stimmt nicht überein',
        description: 'Deine Browser-Signer-Erweiterung hat ein anderes Konto aktiv als das, mit dem du dich angemeldet hast.',
        expectedAccount: 'Angemeldet als',
        actualAccount: 'Signer aktives Konto',
        instructions: 'Bitte wechsle in deiner Signer-Erweiterung zum richtigen Konto und lade diese Seite neu.'
    }
};

export default de;
