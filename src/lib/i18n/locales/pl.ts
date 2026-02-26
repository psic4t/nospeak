const pl = {
    common: {
        appName: 'nospeak',
        save: 'Zapisz',
        cancel: 'Anuluj'
    },
    auth: {
        loginWithAmber: 'Zaloguj przez Amber',
        loginWithExtension: 'Zaloguj przez rozszerzenie Nostr Signer',
        orSeparator: 'LUB',
        loginWithNsecLabel: 'Zaloguj za pomocą nsec',
        nsecPlaceholder: 'nsec1...',
        loginButton: 'Zaloguj',
        connecting: 'Łączenie...',
        generateKeypairLink: 'Wygeneruj nową parę kluczy',
        downloadAndroidApp: 'Pobierz aplikację na Androida',
        amber: {
            title: 'Zaloguj przez Amber',
            helper: 'Zeskanuj ten kod QR za pomocą Amber lub użyj przycisków poniżej.',
            openInAmber: 'Otwórz w Amber',
            copyConnectionString: 'Kopiuj ciąg połączenia',
            copied: 'Skopiowano!'
        },
        keypair: {
            title: 'Wygeneruj nową parę kluczy',
            description: 'Nowa para kluczy Nostr jest generowana lokalnie w Twojej przeglądarce.',
            npubLabel: 'npub (klucz publiczny)',
            nsecLabel: 'nsec (klucz prywatny)',
            generateAnother: 'Wygeneruj kolejną',
            useAndLogin: 'Użyj tej pary kluczy i zaloguj się'
        }
    },
    chats: {
        title: 'Czaty',
        emptyHint: 'Brak czatów. Naciśnij +, aby dodać kontakt.',
        selectPrompt: 'Wybierz czat, aby rozpocząć rozmowę',
        addContact: 'Dodaj kontakt',
        filterAll: 'Wszystkie',
        filterUnread: 'Nieprzeczytane',
        filterGroups: 'Grupy',
        emptyUnread: 'Brak nieprzeczytanych czatów',
        emptyGroups: 'Brak grup',
        favorites: 'Ulubione',
        favoriteMessage: 'wiadomość',
        favoriteMessages: 'wiadomości',
        emptyFavorites: 'Brak ulubionych wiadomości',
        archive: 'Archiwizuj',
        unarchive: 'Przywróć z archiwum',
        archived: 'Zarchiwizowane',
        emptyArchive: 'Brak zarchiwizowanych czatów',
        chatArchived: 'Czat zarchiwizowany'
    },
    contacts: {
        title: 'Kontakty',
        manage: 'Zarządzaj',
        scanQr: 'Skanuj QR',
        scanQrAria: 'Skanuj kod QR kontaktu',
        emptyHint: 'Jeśli nie pojawiają się kontakty, kliknij Zarządzaj, aby dodać.',
        selectPrompt: 'Wybierz kontakt, aby rozpocząć rozmowę',
        youPrefix: 'Ty',
        mediaPreview: { image: 'Obraz', video: 'Wideo', voiceMessage: 'Wiadomość głosowa', audio: 'Audio', file: 'Plik', location: 'Lokalizacja' }
    },
    connection: { relaysLabel: 'Przekaźniki:', authLabel: 'Uwierzytelnianie:', authFailedLabel: 'Niepowodzenie:' },
    sync: {
        title: 'Synchronizacja wiadomości...',
        fetched: '{count} pobrano',
        errorTitle: 'Synchronizacja nie powiodła się',
        timeoutError: 'Synchronizacja przekroczyła limit czasu po 5 minutach',
        relayErrorsTitle: 'Błędy przekaźników',
        retryButton: 'Ponów',
        skipButton: 'Pomiń i kontynuuj',
        continueInBackground: 'Kontynuuj w tle',
        backgroundComplete: 'Synchronizacja zakończona',
        manualRelay: { label: 'Lub wprowadź przekaźnik ręcznie', placeholder: 'ws://192.168.1.50:7777', connectButton: 'Połącz', connecting: 'Łączenie...', invalidUrl: 'Nieprawidłowy adres URL przekaźnika' },
        steps: {
            connectDiscoveryRelays: 'Połącz z przekaźnikami wykrywania',
            fetchMessagingRelays: 'Pobierz i zapisz przekaźniki wiadomości użytkownika',
            connectReadRelays: 'Połącz z przekaźnikami wiadomości użytkownika',
            fetchHistory: 'Pobierz i zapisz historię z przekaźników',
            fetchContacts: 'Pobierz i scal kontakty z przekaźników',
            fetchContactProfiles: 'Pobierz i zapisz profile kontaktów oraz informacje o przekaźnikach',
            fetchUserProfile: 'Pobierz i zapisz profil użytkownika'
        }
    },
    modals: {
        manageContacts: {
            title: 'Kontakty', scanQr: 'Skanuj QR', scanQrAria: 'Skanuj kod QR, aby dodać kontakt',
            searchPlaceholder: 'npub, NIP-05 lub wyszukiwanie', addContactAria: 'Dodaj kontakt',
            searchContactsAria: 'Szukaj kontaktów', searching: 'Wyszukiwanie...', searchFailed: 'Wyszukiwanie nie powiodło się',
            noResults: 'Brak wyników', noContacts: 'Nie dodano kontaktów', removeContactAria: 'Usuń kontakt',
            resolvingNip05: 'Wyszukiwanie NIP-05...', nip05LookupFailed: 'Wyszukiwanie NIP-05 nie powiodło się',
            nip05NotFound: 'NIP-05 nie znaleziono', nip05InvalidFormat: 'Nieprawidłowy format NIP-05 (użyj nazwa@domena.com)',
            alreadyAdded: 'Już dodano', syncing: 'Synchronizacja kontaktów…',
            pullToRefresh: 'Pociągnij, aby odświeżyć', releaseToRefresh: 'Puść, aby odświeżyć',
            newContact: 'Dodaj kontakt', createGroup: 'Utwórz grupę',
            contextMenu: { openMenu: 'Otwórz menu', viewProfile: 'Zobacz profil', delete: 'Usuń' },
            confirmDelete: { title: 'Usuń kontakt', message: 'Czy na pewno chcesz usunąć {name}?', confirm: 'Usuń' }
        },
        createGroup: {
            title: 'Utwórz czat grupowy', searchPlaceholder: 'Szukaj kontaktów',
            selectedCount: '{count} wybranych', minContactsHint: 'Wybierz co najmniej 2 kontakty',
            createButton: 'Utwórz grupę', creating: 'Tworzenie...', noContacts: 'Brak kontaktów do dodania do grupy'
        },
        profile: {
            unknownName: 'Nieznany', about: 'O mnie', publicKey: 'Klucz publiczny',
            messagingRelays: 'Przekaźniki wiadomości', noRelays: 'Brak', refreshing: 'Odświeżanie profilu…',
            notFound: 'Profil nie znaleziony', addToContacts: 'Dodaj do kontaktów', addingContact: 'Dodawanie…', contactAdded: 'Kontakt dodany'
        },
        emptyProfile: {
            title: 'Dokończ konfigurację profilu',
            introLine1: 'Ten klucz nie ma jeszcze skonfigurowanych przekaźników wiadomości ani nazwy użytkownika.',
            introLine2: 'Skonfigurujemy domyślne przekaźniki wiadomości, aby nospeak mógł wysyłać i odbierać wiadomości. Możesz je zmienić później w Ustawieniach w sekcji Przekaźniki wiadomości.',
            usernameLabel: 'Nazwa użytkownika', usernamePlaceholder: 'Twoja nazwa',
            usernameRequired: 'Wprowadź nazwę użytkownika, aby kontynuować.',
            saveError: 'Nie udało się zapisać początkowej konfiguracji. Spróbuj ponownie.',
            doLater: 'Zrobię to później', saving: 'Zapisywanie...', continue: 'Kontynuuj',
            autoRelaysConfigured: 'Przekaźniki wiadomości skonfigurowane. Możesz je zmienić w Ustawieniach.'
        },
        relayStatus: {
            title: 'Połączenia z przekaźnikami', noRelays: 'Brak skonfigurowanych przekaźników',
            connected: 'Połączony', disconnected: 'Rozłączony',
            typeLabel: 'Typ:', lastConnectedLabel: 'Ostatnio połączony:',
            successLabel: 'Sukces:', failureLabel: 'Niepowodzenia:',
            authLabel: 'Uwierzytelnianie:', authErrorLabel: 'Błąd uwierzytelniania:',
            authNotRequired: 'Niewymagane', authRequired: 'Wymagane',
            authAuthenticating: 'Uwierzytelnianie', authAuthenticated: 'Uwierzytelniono',
            authFailed: 'Niepowodzenie', typePersistent: 'Stały', typeTemporary: 'Tymczasowy', never: 'Nigdy'
        },
        qr: { title: 'Kod QR', tabs: { myQr: 'Mój kod', scanQr: 'Skanuj kod' } },
        userQr: { preparing: 'Przygotowywanie kodu QR…', hint: 'To jest Twój npub jako kod QR. Udostępnij go komuś, aby mógł Cię zeskanować i dodać jako kontakt.' },
        scanContactQr: {
            title: 'Skanuj QR kontaktu', instructions: 'Skieruj kamerę na kod QR Nostr, aby dodać kontakt.',
            scanning: 'Skanowanie…', noCamera: 'Kamera jest niedostępna na tym urządzeniu.',
            invalidQr: 'Ten kod QR nie zawiera prawidłowego npub kontaktu.',
            addFailed: 'Nie udało się dodać kontaktu z tego QR. Spróbuj ponownie.', added: 'Kontakt dodany z QR.'
        },
        scanContactQrResult: {
            title: 'Kontakt z QR', alreadyContact: 'Ten kontakt jest już na Twojej liście kontaktów.',
            reviewHint: 'Sprawdź kontakt ze zeskanowanego QR przed dodaniem.',
            updatingProfile: 'Aktualizowanie profilu…', loadFailed: 'Nie udało się załadować szczegółów kontaktu z QR.',
            addFailed: 'Nie udało się dodać kontaktu z QR.', closeButton: 'Zamknij',
            addButton: 'Dodaj kontakt', startChatButton: 'Rozpocznij czat'
        },
        attachmentPreview: {
            title: 'Podgląd załącznika', imageAlt: 'Podgląd załącznika', noPreview: 'Podgląd niedostępny',
            captionLabel: 'Podpis (opcjonalnie)', cancelButton: 'Anuluj',
            sendButtonIdle: 'Wyślij', sendButtonSending: 'Wysyłanie…',
            uploadButtonIdle: 'Prześlij', uploadButtonUploading: 'Przesyłanie…'
        },
        locationPreview: { title: 'Lokalizacja', closeButton: 'Zamknij', openInOpenStreetMap: 'Otwórz w OpenStreetMap', ctrlScrollToZoom: 'Użyj Ctrl + przewijanie, aby powiększyć' },
        mediaServersAutoConfigured: {
            title: 'Serwery multimediów skonfigurowane',
            message: 'Nie skonfigurowano żadnych serwerów Blossom. Dodaliśmy {server1} i {server2}.\n\nMożesz je zmienić w Ustawienia → Serwery multimediów.'
        }
    },
    chat: {
        sendFailedTitle: 'Wysyłanie nie powiodło się', sendFailedMessagePrefix: 'Nie udało się wysłać wiadomości: ',
        location: { errorTitle: 'Błąd lokalizacji', errorMessage: 'Nie udało się pobrać Twojej lokalizacji. Sprawdź uprawnienia.' },
        relative: {
            justNow: 'przed chwilą', minutes: '{count} min temu', minutesPlural: '{count} min temu',
            hours: '{count} godzinę temu', hoursPlural: '{count} godzin temu',
            days: '{count} dzień temu', daysPlural: '{count} dni temu',
            weeks: '{count} tydzień temu', weeksPlural: '{count} tygodni temu',
            months: '{count} miesiąc temu', monthsPlural: '{count} miesięcy temu',
            years: '{count} rok temu', yearsPlural: '{count} lat temu'
        },
        dateLabel: { today: 'Dzisiaj', yesterday: 'Wczoraj' },
        history: {
            fetchOlder: 'Pobierz starsze wiadomości z przekaźników',
            summary: 'Pobrano {events} zdarzeń, zapisano {saved} nowych wiadomości ({chat} w tym czacie)',
            none: 'Brak kolejnych wiadomości dostępnych z przekaźników',
            error: 'Nie udało się pobrać starszych wiadomości. Spróbuj ponownie później.'
        },
        empty: {
            noMessagesTitle: 'Brak wiadomości', forContact: 'Rozpocznij rozmowę z {name}.',
            forGroup: 'Rozpocznij rozmowę w {name}.', generic: 'Wybierz kontakt, aby rozpocząć czat.'
        },
        group: {
            defaultTitle: 'Czat grupowy', participants: '{count} uczestników', participantsShort: '{count}',
            members: 'Członkowie: {count}', membersTitle: 'Członkowie', viewMembers: 'Pokaż członków',
            editName: 'Edytuj nazwę grupy', editNameTitle: 'Nazwa grupy',
            editNamePlaceholder: 'Wprowadź nazwę grupy...', editNameHint: 'Pozostaw puste, aby użyć nazw uczestników',
            editNameSave: 'Zapisz', editNameCancel: 'Anuluj',
            nameSavedToast: 'Zapisano. Zostanie ustawiona przy następnej wiadomości.',
            nameValidationTooLong: 'Nazwa zbyt długa (maks. 100 znaków)',
            nameValidationInvalidChars: 'Nazwa zawiera niedozwolone znaki'
        },
        inputPlaceholder: 'Wpisz wiadomość...',
        contextMenu: { cite: 'Cytuj', copy: 'Kopiuj', sentAt: 'Wysłano', favorite: 'Ulubione', unfavorite: 'Usuń z ulubionych' },
        reactions: {
            cannotReactTitle: 'Nie można zareagować', cannotReactMessage: 'Ta wiadomość jest zbyt stara, aby obsługiwać reakcje.',
            failedTitle: 'Reakcja nie powiodła się', failedMessagePrefix: 'Nie udało się wysłać reakcji: '
        },
        mediaMenu: { uploadMediaTooltip: 'Prześlij media', takePhoto: 'Zrób zdjęcie', location: 'Lokalizacja', image: 'Obraz', video: 'Wideo', audio: 'Muzyka', file: 'Plik' },
        mediaErrors: { cameraErrorTitle: 'Błąd kamery', cameraErrorMessage: 'Nie udało się zrobić zdjęcia' },
        fileUpload: { fileTooLarge: 'Plik jest za duży. Maksymalny rozmiar to 10 MB.', download: 'Pobierz', decrypting: 'Odszyfrowywanie...' },
        mediaUnavailable: 'Te media nie są już dostępne.',
        voiceMessage: {
            title: 'Wiadomość głosowa', recordAria: 'Nagraj wiadomość głosową',
            playPreviewAria: 'Odtwórz podgląd', pausePreviewAria: 'Wstrzymaj podgląd',
            cancelButton: 'Anuluj', pauseButton: 'Wstrzymaj', doneButton: 'Gotowe',
            resumeButton: 'Wznów', sendButton: 'Wyślij', microphoneTitle: 'Mikrofon',
            permissionDeniedTitle: 'Uprawnienia mikrofonu',
            permissionDeniedMessage: 'Zezwól na dostęp do mikrofonu, aby nagrywać.',
            nativeNotAvailable: 'Nagrywanie natywne niedostępne.',
            unsupported: 'Nagrywanie głosu nie jest obsługiwane na tym urządzeniu.',
            failedToStart: 'Nie udało się rozpocząć nagrywania.', failedToStop: 'Nie udało się zatrzymać nagrywania.',
            recordingFailed: 'Nagrywanie nie powiodło się.'
        },
        relayStatus: { sending: 'wysyłanie...', sentToRelays: 'wysłano do {successful}/{desired} przekaźników' },
        searchPlaceholder: 'Szukaj', searchNoMatches: 'Brak wyników', searchAriaLabel: 'Szukaj w czacie'
    },
    settings: {
        title: 'Ustawienia',
        categories: { general: 'Ogólne', profile: 'Profil', messagingRelays: 'Przekaźniki wiadomości', mediaServers: 'Serwery multimediów', security: 'Bezpieczeństwo', about: 'O aplikacji' },
        general: {
            appearanceLabel: 'Wygląd', appearanceDescription: 'Wybierz, czy używać motywu systemowego, jasnego czy ciemnego.',
            languageLabel: 'Język', languageDescription: 'Wybierz preferowany język aplikacji.'
        },
        notifications: { label: 'Powiadomienia', supportedDescription: 'Otrzymuj powiadomienia o nowych wiadomościach na tym urządzeniu', unsupportedDescription: 'Powiadomienia nie są obsługiwane na tym urządzeniu' },
        backgroundMessaging: {
            label: 'Wiadomości w tle',
            description: 'Utrzymuj połączenie nospeak z przekaźnikami wiadomości i otrzymuj powiadomienia o wiadomościach/reakcjach, gdy aplikacja jest w tle. Android wyświetli stałe powiadomienie, gdy ta opcja jest włączona. Działa zarówno z logowaniem kluczem lokalnym (nsec), jak i Amber. Podgląd powiadomień może być ograniczony przez ustawienia prywatności ekranu blokady Androida.',
            openBatterySettings: 'Otwórz ustawienia baterii'
        },
        urlPreviews: { label: 'Podglądy URL', description: 'Pokazuj karty podglądu dla linków niebędących multimediami w wiadomościach.' },
        profile: {
            nameLabel: 'Nazwa', namePlaceholder: 'Twoja nazwa', displayNameLabel: 'Wyświetlana nazwa',
            displayNamePlaceholder: 'Wyświetlana nazwa', aboutLabel: 'O mnie', aboutPlaceholder: 'Opowiedz o sobie',
            pictureUrlLabel: 'URL zdjęcia', pictureUrlPlaceholder: 'https://example.com/avatar.jpg',
            bannerUrlLabel: 'URL banera', bannerUrlPlaceholder: 'https://example.com/banner.jpg',
            nip05Label: 'NIP-05 (nazwa użytkownika)', nip05Placeholder: 'nazwa@domena.com',
            websiteLabel: 'Strona internetowa', websitePlaceholder: 'https://example.com',
            lightningLabel: 'Adres Lightning (LUD-16)', lightningPlaceholder: 'użytkownik@dostawca.com',
            saveButton: 'Zapisz zmiany', savingButton: 'Zapisywanie...'
        },
        messagingRelays: {
            description: 'Skonfiguruj przekaźniki wiadomości NIP-17. Te przekaźniki służą do odbierania zaszyfrowanych wiadomości. Dla najlepszej wydajności, 2 przekaźniki wiadomości zazwyczaj wystarczą.',
            inputPlaceholder: 'wss://relay.example.com', addButton: 'Dodaj', emptyState: 'Brak skonfigurowanych przekaźników',
            tooManyWarning: 'Posiadanie więcej niż 3 przekaźników wiadomości może obniżyć wydajność i niezawodność.',
            saveStatusSuccess: 'Zapisano listę przekaźników do {count} przekaźników.',
            saveStatusPartial: 'Zapisano listę przekaźników do {succeeded} z {attempted} przekaźników.',
            saveStatusNone: 'Nie udało się zapisać listy przekaźników do żadnego przekaźnika.',
            saveStatusError: 'Błąd podczas zapisywania listy przekaźników. Ustawienia mogą nie być w pełni rozpropagowane.',
            savingStatus: 'Zapisywanie ustawień przekaźników…'
        },
        mediaServers: {
            description: 'Skonfiguruj serwery multimediów Blossom. Te serwery służą do przechowywania przesyłanych plików (media profilowe i załączniki czatu).',
            inputPlaceholder: 'https://cdn.example.com', addButton: 'Dodaj', emptyState: 'Brak skonfigurowanych serwerów',
            saveStatusSuccess: 'Zapisano listę serwerów do {count} przekaźników.',
            saveStatusPartial: 'Zapisano listę serwerów do {succeeded} z {attempted} przekaźników.',
            saveStatusNone: 'Nie udało się zapisać listy serwerów do żadnego przekaźnika.',
            saveStatusError: 'Błąd podczas zapisywania listy serwerów. Ustawienia mogą nie być w pełni rozpropagowane.',
            savingStatus: 'Zapisywanie ustawień serwerów multimediów…', primary: 'Główny', setAsPrimary: 'Ustaw jako główny',
            mediaCacheLabel: 'Pamięć podręczna multimediów',
            mediaCacheDescription: 'Zapisuj przeglądane media w galerii do dostępu offline. Pliki można zarządzać w aplikacji Zdjęcia.'
        },
        security: {
            loginMethodTitle: 'Metoda logowania', loginMethodUnknown: 'Nieznana',
            npubLabel: 'Twój npub', nsecLabel: 'Twój nsec',
            hideNsecAria: 'Ukryj nsec', showNsecAria: 'Pokaż nsec',
            dangerZoneTitle: 'Strefa zagrożenia',
            dangerZoneDescription: 'Wylogowanie usunie wszystkie zapisane dane z tego urządzenia.',
            logoutButton: 'Wyloguj'
        },
        pin: {
            appLockLabel: 'Blokada aplikacji',
            appLockDescription: 'Wymagaj PIN-u, aby uzyskać dostęp do aplikacji',
            changePinButton: 'Zmień PIN',
            enterNewPin: 'Ustaw PIN',
            enterNewPinDescription: 'Wprowadź 4-cyfrowy PIN',
            confirmPin: 'Potwierdź PIN',
            confirmPinDescription: 'Wprowadź ten sam PIN ponownie',
            enterCurrentPin: 'Wprowadź PIN',
            enterCurrentPinDescription: 'Wprowadź swój aktualny PIN',
            wrongPin: 'Błędny PIN',
            pinMismatch: 'PINy się nie zgadzają, spróbuj ponownie',
            enterPinToUnlock: 'Wprowadź PIN, aby odblokować'
        }
    },
    signerMismatch: {
        title: 'Niezgodność konta',
        description: 'Rozszerzenie podpisujące w przeglądarce ma aktywne inne konto niż to, którym się zalogowałeś.',
        expectedAccount: 'Zalogowany jako', actualAccount: 'Aktywne konto podpisującego',
        instructions: 'Przełącz na prawidłowe konto w rozszerzeniu podpisującym i odśwież tę stronę.'
    }
};

export default pl;
