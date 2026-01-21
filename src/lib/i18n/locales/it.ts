const it = {
    common: {
        appName: 'nospeak',
        save: 'Salva',
        cancel: 'Annulla'
    },
    auth: {
        loginWithAmber: 'Accedi con Amber',
        loginWithExtension: "Accedi con l’estensione Nostr Signer",
        orSeparator: 'OPPURE',
        loginWithNsecLabel: 'Accedi con nsec',
        nsecPlaceholder: 'nsec1...',
        loginButton: 'Accedi',
        connecting: 'Connessione...',
        generateKeypairLink: 'Genera una nuova coppia di chiavi',
        downloadAndroidApp: "Scarica l’app Android",
        amber: {
            title: 'Accedi con Amber',
            helper: 'Scansiona questo codice QR con Amber oppure usa i pulsanti qui sotto.',
            openInAmber: 'Apri in Amber',
            copyConnectionString: 'Copia stringa di connessione',
            copied: 'Copiato!'
        },
        keypair: {
            title: 'Genera una nuova coppia di chiavi',
            description: 'Una nuova coppia di chiavi Nostr viene generata localmente nel tuo browser.',
            npubLabel: 'npub (chiave pubblica)',
            nsecLabel: 'nsec (chiave segreta)',
            generateAnother: 'Generane un’altra',
            useAndLogin: 'Usa questa coppia di chiavi e accedi'
        }
    },
    chats: {
        title: 'Chat',
        emptyHint: 'Nessuna chat ancora. Tocca + per aggiungere un contatto.',
        selectPrompt: 'Seleziona una chat per iniziare a messaggiare',
        addContact: 'Aggiungi contatto'
    },
    contacts: {
        title: 'Contatti',
        manage: 'Gestisci',
        scanQr: 'Scansiona QR',
        scanQrAria: 'Scansiona il QR del contatto',
        emptyHint: 'Se non vedi contatti, clicca su Gestisci per aggiungerne.',
        selectPrompt: 'Seleziona un contatto per iniziare a chattare',
        youPrefix: 'Tu',
        mediaPreview: {
            image: 'Immagine',
            video: 'Video',
            voiceMessage: 'Messaggio vocale',
            audio: 'Audio',
            file: 'File'
        }
    },
    connection: {
        relaysLabel: 'Relays:',
        authLabel: 'Auth:',
        authFailedLabel: 'Fallito:'
    },
    sync: {
        title: 'Sincronizzazione messaggi...',
        fetched: '{count} recuperati',
        errorTitle: 'Sincronizzazione fallita',
        timeoutError: 'Timeout dopo 5 minuti',
        relayErrorsTitle: 'Errori relay',
        retryButton: 'Riprova',
        skipButton: 'Salta e continua',
        continueInBackground: 'Continua in background',
        backgroundComplete: 'Sincronizzazione completata',
        steps: {
            connectDiscoveryRelays: 'Connetti ai relays di discovery',
            fetchMessagingRelays: "Recupera e memorizza nella cache i relays di messaggistica dell'utente",
            connectReadRelays: "Connetti ai relays di messaggistica dell'utente",
            fetchHistory: 'Recupera e memorizza nella cache la cronologia dai relays',
            fetchContacts: 'Recupera e unisci i contatti dai relays',
            fetchContactProfiles: 'Recupera e memorizza nella cache profili dei contatti e info relay',
            fetchUserProfile: "Recupera e memorizza nella cache il profilo dell'utente"
        }
    },

    modals: {
        manageContacts: {
            title: 'Contatti',
            scanQr: 'Scansiona QR',
            scanQrAria: 'Scansiona codice QR per aggiungere contatto',
            searchPlaceholder: 'npub, NIP-05 o termine di ricerca',
            addContactAria: 'Aggiungi contatto',
            searchContactsAria: 'Cerca contatti',
            searching: 'Ricerca...',
            searchFailed: 'Ricerca non riuscita',
            noResults: 'Nessun risultato',
            noContacts: 'Nessun contatto aggiunto',
            removeContactAria: 'Rimuovi contatto',
            resolvingNip05: 'Ricerca NIP-05...',
            nip05LookupFailed: 'Impossibile cercare NIP-05',
            nip05NotFound: 'NIP-05 non trovato',
            nip05InvalidFormat: 'Formato NIP-05 non valido (usa nome@dominio.com)',
            alreadyAdded: 'Già aggiunto',
            syncing: 'Sincronizzazione contatti…',
            pullToRefresh: 'Tira per aggiornare',
            releaseToRefresh: 'Rilascia per aggiornare',
            contextMenu: {
                openMenu: 'Apri menu',
                delete: 'Elimina'
            },
            confirmDelete: {
                title: 'Elimina contatto',
                message: 'Sei sicuro di voler eliminare {name}?',
                confirm: 'Elimina'
            },
            createGroup: 'Crea gruppo'
        },
        createGroup: {
            title: 'Crea chat di gruppo',
            searchPlaceholder: 'Cerca contatti',
            selectedCount: '{count} selezionati',
            minContactsHint: 'Seleziona almeno 2 contatti',
            createButton: 'Crea gruppo',
            creating: 'Creazione…',
            noContacts: 'Nessun contatto da aggiungere al gruppo'
        },
        profile: {
            unknownName: 'Sconosciuto',
            about: 'Informazioni',
            publicKey: 'Chiave pubblica',
            messagingRelays: 'Relays di messaggistica',
            noRelays: 'Nessuno',
            refreshing: 'Aggiornamento profilo…',
            notFound: 'Profilo non trovato'
        },

        emptyProfile: {
            title: 'Completa la configurazione del profilo',
            introLine1: 'Questa chiave non ha ancora relays di messaggistica o un nome utente configurati.',
            introLine2: 'Configureremo alcuni relays di messaggistica predefiniti così nospeak potrà inviare e ricevere messaggi. Potrai modificarli più tardi in Impostazioni → Relays di messaggistica.',
            usernameLabel: 'Nome utente',
            usernamePlaceholder: 'Il tuo nome',
            usernameRequired: 'Inserisci un nome utente per continuare.',
            saveError: 'Impossibile salvare la configurazione iniziale. Riprova.',
            doLater: 'Lo farò più tardi',
            saving: 'Salvataggio...',
            continue: 'Continua'
        },
        relayStatus: {
            title: 'Connessioni relay',
            noRelays: 'Nessun relay configurato',
            connected: 'Connesso',
            disconnected: 'Disconnesso',
            typeLabel: 'Tipo:',
            lastConnectedLabel: 'Ultima connessione:',
            successLabel: 'Successi:',
            failureLabel: 'Fallimenti:',
            authLabel: 'Auth:',
            authErrorLabel: 'Errore auth:',
            authNotRequired: 'Non richiesto',
            authRequired: 'Richiesto',
            authAuthenticating: 'Autenticazione',
            authAuthenticated: 'Autenticato',
            authFailed: 'Fallito',
            typePersistent: 'Persistente',
            typeTemporary: 'Temporaneo',
            never: 'Mai'
        },
        userQr: {
            preparing: 'Preparazione del QR…'
        },
        scanContactQr: {
            title: 'Scansiona QR contatto',
            instructions: 'Punta la fotocamera su un QR nostr per aggiungere un contatto.',
            scanning: 'Scansione…',
            noCamera: 'La fotocamera non è disponibile su questo dispositivo.',
            invalidQr: 'Questo codice QR non contiene un npub di contatto valido.',
            addFailed: 'Impossibile aggiungere il contatto da questo QR. Riprova.',
            added: 'Contatto aggiunto dal QR.'
        },
        attachmentPreview: {
            title: 'Anteprima allegato',
            imageAlt: 'Anteprima allegato',
            noPreview: 'Nessuna anteprima disponibile',
            captionLabel: 'Didascalia (opzionale)',
            cancelButton: 'Annulla',
            sendButtonIdle: 'Invia',
            sendButtonSending: 'Invio…',
            uploadButtonIdle: 'Carica',
            uploadButtonUploading: 'Caricamento…'
        },
        locationPreview: {
            title: 'Posizione',
            closeButton: 'Chiudi',
            openInOpenStreetMap: 'Apri in OpenStreetMap'
        },
        mediaServersAutoConfigured: {
            title: 'Server multimediali configurati',
            message: 'Non erano configurati server Blossom. Abbiamo aggiunto {server1} e {server2}.\n\nPuoi modificarli in Impostazioni → Server multimediali.'
        }
    },
    chat: {
        sendFailedTitle: 'Invio non riuscito',
        sendFailedMessagePrefix: 'Impossibile inviare il messaggio: ',
        location: {
            errorTitle: 'Errore di posizione',
            errorMessage: 'Impossibile ottenere la tua posizione. Controlla i permessi.'
        },
        relative: {
            justNow: 'proprio ora',
            minutes: '{count} min fa',
            minutesPlural: '{count} min fa',
            hours: '{count} ora fa',
            hoursPlural: '{count} ore fa',
            days: '{count} giorno fa',
            daysPlural: '{count} giorni fa',
            weeks: '{count} settimana fa',
            weeksPlural: '{count} settimane fa',
            months: '{count} mese fa',
            monthsPlural: '{count} mesi fa',
            years: '{count} anno fa',
            yearsPlural: '{count} anni fa'
        },
        dateLabel: {
            today: 'Oggi',
            yesterday: 'Ieri'
        },
        history: {
            fetchOlder: 'Recupera messaggi più vecchi dai relays',
            summary: 'Recuperati {events} eventi, salvati {saved} nuovi messaggi ({chat} in questa chat)',
            none: 'Non ci sono altri messaggi disponibili dai relays',
            error: 'Impossibile recuperare messaggi più vecchi. Riprova più tardi.'
        },
        empty: {
            noMessagesTitle: 'Nessun messaggio',
            forContact: 'Inizia la conversazione con {name}.',
            forGroup: 'Inizia la conversazione in {name}.',
            generic: 'Seleziona un contatto per iniziare a chattare.'
        },
        group: {
            defaultTitle: 'Chat di gruppo',
            participants: '{count} partecipanti',
            participantsShort: '{count}',
            members: 'Membri: {count}',
            membersTitle: 'Membri',
            viewMembers: 'Visualizza membri'
        },
        inputPlaceholder: 'Scrivi un messaggio...',
        contextMenu: {
            cite: 'Cita',
            copy: 'Copia',
            sentAt: 'Inviato'
        },
        reactions: {
            cannotReactTitle: 'Impossibile reagire',
            cannotReactMessage: 'Questo messaggio è troppo vecchio per supportare le reazioni.',
            failedTitle: 'Reazione non riuscita',
            failedMessagePrefix: 'Impossibile inviare la reazione: '
        },
        mediaMenu: {
            uploadMediaTooltip: 'Carica media',
            takePhoto: 'Scatta foto',
            location: 'Posizione',
            image: 'Immagine',
            video: 'Video',
            audio: 'Musica'
        },
        mediaErrors: {
            cameraErrorTitle: 'Errore fotocamera',
            cameraErrorMessage: 'Impossibile scattare la foto'
        },
        mediaUnavailable: 'Questo media non è più disponibile.',
        voiceMessage: {
            title: 'Messaggio vocale',
            recordAria: 'Registra messaggio vocale',
            playPreviewAria: 'Riproduci anteprima',
            pausePreviewAria: 'Metti in pausa anteprima',
            cancelButton: 'Annulla',
            pauseButton: 'Pausa',
            doneButton: 'Fatto',
            resumeButton: 'Riprendi',
            sendButton: 'Invia',
            microphoneTitle: 'Microfono',
            permissionDeniedTitle: 'Permesso microfono',
            permissionDeniedMessage: 'Consenti l’accesso al microfono per registrare.',
            nativeNotAvailable: 'Registrazione nativa non disponibile.',
            unsupported: 'La registrazione vocale non è supportata su questo dispositivo.',
            failedToStart: 'Impossibile avviare la registrazione.',
            failedToStop: 'Impossibile interrompere la registrazione.',
            recordingFailed: 'Registrazione non riuscita.'
        },
        relayStatus: {
            sending: 'invio...',
            sentToRelays: 'inviato a {successful}/{desired} relays'
        },
        searchPlaceholder: 'Cerca',
        searchNoMatches: 'Nessuna corrispondenza',
        searchAriaLabel: 'Cerca nella chat'
    },
    settings: {
        title: 'Impostazioni',
        categories: {
            general: 'Generale',
            profile: 'Profilo',
            messagingRelays: 'Relays di messaggistica',
            mediaServers: 'Server multimediali',
            security: 'Sicurezza',
            unifiedPush: 'UnifiedPush',
            about: 'Informazioni'
        },

        general: {
            appearanceLabel: 'Aspetto',
            appearanceDescription: 'Scegli se seguire il sistema, la modalità chiara o scura.',
            languageLabel: 'Lingua',
            languageDescription: "Scegli la lingua dell’app."
        },
        notifications: {
            label: 'Notifiche',
            supportedDescription: 'Ricevi notifiche quando arrivano nuovi messaggi su questo dispositivo',
            unsupportedDescription: 'Notifiche non supportate su questo dispositivo'
        },
        backgroundMessaging: {
            label: 'Messaggistica in background',
            description: 'Mantieni nospeak connesso ai tuoi relays di messaggistica e ricevi notifiche di messaggi/reazioni mentre l’app è in background. Android mostrerà una notifica persistente quando questa opzione è abilitata. Funziona sia con login con chiave locale (nsec) sia con Amber. Le anteprime delle notifiche potrebbero essere limitate dalle impostazioni di privacy della schermata di blocco di Android.',
            openBatterySettings: 'Apri impostazioni batteria'
        },
        urlPreviews: {
            label: 'Anteprime URL',
            description: 'Mostra schede di anteprima per link non multimediali nei messaggi.'
        },
        profile: {
            nameLabel: 'Nome',
            namePlaceholder: 'Il tuo nome',
            displayNameLabel: 'Nome visualizzato',
            displayNamePlaceholder: 'Nome visualizzato',
            aboutLabel: 'Informazioni',
            aboutPlaceholder: 'Parlaci di te',
            pictureUrlLabel: 'URL immagine',
            pictureUrlPlaceholder: 'https://example.com/avatar.jpg',
            bannerUrlLabel: 'URL banner',
            bannerUrlPlaceholder: 'https://example.com/banner.jpg',
            nip05Label: 'NIP-05 (Nome utente)',
            nip05Placeholder: 'nome@dominio.com',
            websiteLabel: 'Sito web',
            websitePlaceholder: 'https://example.com',
            lightningLabel: 'Indirizzo Lightning (LUD-16)',
            lightningPlaceholder: 'utente@provider.com',
            saveButton: 'Salva modifiche',
            savingButton: 'Salvataggio...'
        },
        messagingRelays: {
            description: 'Configura i tuoi relays di messaggistica NIP-17. Questi relays vengono usati per ricevere i tuoi messaggi cifrati. Per prestazioni migliori, in genere funzionano meglio 2–3 relays di messaggistica.',
            inputPlaceholder: 'wss://relay.example.com',
            addButton: 'Aggiungi',
            emptyState: 'Nessun relay configurato',
            tooManyWarning: 'Avere più di 3 relays di messaggistica può ridurre prestazioni e affidabilità.',
            saveStatusSuccess: 'Elenco relay salvato su {count} relays.',
            saveStatusPartial: 'Elenco relay salvato su {succeeded} relays su {attempted}.',
            saveStatusNone: 'Impossibile salvare l’elenco relay su qualsiasi relay.',
            saveStatusError: 'Errore durante il salvataggio dell’elenco relay. Le impostazioni potrebbero non essere propagate completamente.',
            savingStatus: 'Salvataggio impostazioni relay…'
        },

        mediaServers: {
            description: 'Configura i tuoi server multimediali Blossom. Questi server vengono usati per archiviare i file che carichi (media del profilo e allegati della chat).',

            inputPlaceholder: 'https://cdn.example.com',
            addButton: 'Aggiungi',
            emptyState: 'Nessun server configurato',
            saveStatusSuccess: 'Elenco server salvato su {count} relays.',
            saveStatusPartial: 'Elenco server salvato su {succeeded} relays su {attempted}.',
            saveStatusNone: "Impossibile salvare l'elenco server su qualsiasi relay.",
            saveStatusError: "Errore durante il salvataggio dell'elenco server. Le impostazioni potrebbero non essere propagate completamente.",
            savingStatus: 'Salvataggio impostazioni server multimediali…',
            primary: 'Principale',
            setAsPrimary: 'Imposta come principale'
        },

        unifiedPush: {
            description: 'Configura UnifiedPush per ricevere notifiche push da server compatibili con ntfy.',
            enableLabel: 'Abilita UnifiedPush',
            enableDescription: 'Permetti a nospeak di agire come distributore UnifiedPush',
            toggleEnableAria: 'Abilita UnifiedPush',
            toggleDisableAria: 'Disabilita UnifiedPush',
            serverUrlLabel: 'URL server',
            serverUrlPlaceholder: 'https://ntfy.sh',
            topicsLabel: 'Topic',
            topicPlaceholder: 'es. avvisi, backup',
            topicsEmpty: 'Nessun topic configurato. Aggiungi il primo topic per iniziare a ricevere notifiche push.',
            registeredAppsLabel: 'App registrate',
            uninstalledBadge: 'Disinstallata',
            noDescription: 'Nessuna descrizione',
            registrationsEmpty: 'Nessuna app ha ancora registrato notifiche push. Installa app compatibili con UnifiedPush per vederle qui.',
            removeTopicTitle: 'Rimuovi topic',
            removeRegistrationTitle: 'Rimuovi registrazione',
            sendTestPush: 'Invia push di test',
            sending: 'Invio...'
        },

        security: {
            loginMethodTitle: 'Metodo di accesso',
            loginMethodUnknown: 'Sconosciuto',
            npubLabel: 'Il tuo npub',
            nsecLabel: 'Il tuo nsec',
            hideNsecAria: 'Nascondi nsec',
            showNsecAria: 'Mostra nsec',
            dangerZoneTitle: 'Zona pericolosa',
            dangerZoneDescription: 'Il logout rimuoverà tutti i dati in cache da questo dispositivo.',
            logoutButton: 'Logout'
        }
    }
};

export default it;
