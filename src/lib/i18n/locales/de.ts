const de = {
    common: {
        appName: 'nospeak',
        save: 'Speichern',
        cancel: 'Abbrechen'
    },
    auth: {
        loginWithAmber: 'Mit Amber anmelden',
        loginWithExtension: 'Mit Erweiterung anmelden',
        orSeparator: 'ODER',
        loginWithNsecLabel: 'Mit nsec anmelden',
        nsecPlaceholder: 'nsec1...',
        loginButton: 'Anmelden',
        connecting: 'Verbinden...',
        generateKeypairLink: 'Neues Schlüsselpaar erzeugen',
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
    contacts: {
        title: 'Kontakte',
        manage: 'Verwalten',
        scanQr: 'QR scannen',
        scanQrAria: 'Kontakt-QR-Code scannen',
        emptyHint: 'Wenn keine Kontakte angezeigt werden, klicke auf „Verwalten“, um welche hinzuzufügen.',
        selectPrompt: 'Wähle einen Kontakt aus, um zu chatten',
        youPrefix: 'Du'
    },

    connection: {
        relaysLabel: 'Relays:'
    },
    sync: {
        title: 'Nachrichten werden synchronisiert...'
    },
        modals: {
         manageContacts: {
             title: 'Kontakte verwalten',
             searchPlaceholder: 'npub oder Suchbegriff',
             addContactAria: 'Kontakt hinzufügen',
             searchContactsAria: 'Kontakte suchen',
             searching: 'Suche…',
             searchFailed: 'Suche fehlgeschlagen',
             noResults: 'Keine Treffer',
             noContacts: 'Keine Kontakte hinzugefügt',
             removeContactAria: 'Kontakt entfernen'
         },
         profile: {
             unknownName: 'Unbekannt',
             about: 'Über',
             publicKey: 'Öffentlicher Schlüssel',
             messagingRelays: 'Messaging-Relays',
             noRelays: 'Keine',
             notFound: 'Profil nicht gefunden'
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
            continue: 'Weiter'
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
            typePersistent: 'Persistent',
            typeTemporary: 'Temporär',
            never: 'Nie'
        },
        userQr: {
            preparing: 'QR-Code wird vorbereitet…'
        },
        scanContactQr: {
            title: 'Kontakt-QR scannen',
            instructions: 'Richte die Kamera auf einen nostr-QR-Code, um einen Kontakt hinzuzufügen.',
            scanning: 'Scanne…',
            noCamera: 'Auf diesem Gerät ist keine Kamera verfügbar.',
            invalidQr: 'Dieser QR-Code enthält keinen gültigen Kontakt-npub.',
            addFailed: 'Kontakt konnte aus diesem QR nicht hinzugefügt werden. Bitte versuche es erneut.',
            added: 'Kontakt per QR hinzugefügt.'
        }

    },
    chat: {
        sendFailedTitle: 'Senden fehlgeschlagen',
        sendFailedMessagePrefix: 'Nachricht konnte nicht gesendet werden: ',
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
            none: 'Keine weiteren Nachrichten von den Relays verfügbar',
            error: 'Ältere Nachrichten konnten nicht geladen werden. Bitte versuche es später erneut.'
        },
        empty: {
            noMessagesTitle: 'Noch keine Nachrichten',
            forContact: 'Starte das Gespräch mit {name}.',
            generic: 'Wähle einen Kontakt aus, um zu chatten.'
        },
        inputPlaceholder: 'Nachricht eingeben...',
        contextMenu: {
            cite: 'Zitieren',
            copy: 'Kopieren'
        },
        reactions: {
            cannotReactTitle: 'Reaktion nicht möglich',
            cannotReactMessage: 'Diese Nachricht ist zu alt für Reaktionen.',
            failedTitle: 'Reaktion fehlgeschlagen',
            failedMessagePrefix: 'Reaktion konnte nicht gesendet werden: '
        }
    },
        settings: {
         title: 'Einstellungen',
         categories: {
             general: 'Allgemein',
             profile: 'Profil',
             messagingRelays: 'Messaging-Relays',
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
            label: 'Nachrichten-Benachrichtigungen',
            supportedDescription:
                'Erhalte Benachrichtigungen, wenn neue Nachrichten auf diesem Gerät eingehen',
            unsupportedDescription:
                'Benachrichtigungen werden auf diesem Gerät nicht unterstützt'
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
             tooManyWarning: 'Mehr als 3 Messaging-Relays können Performance und Zuverlässigkeit verschlechtern.'
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
    }
};

export default de;
