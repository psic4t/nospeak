const ru = {
    common: {
        appName: 'nospeak',
        save: 'Сохранить',
        cancel: 'Отмена'
    },
    auth: {
        loginWithAmber: 'Войти через Amber',
        loginWithExtension: 'Войти через расширение Nostr Signer',
        orSeparator: 'ИЛИ',
        loginWithNsecLabel: 'Войти с помощью nsec',
        nsecPlaceholder: 'nsec1...',
        loginButton: 'Войти',
        connecting: 'Подключение...',
        generateKeypairLink: 'Сгенерировать новую пару ключей',
        downloadAndroidApp: 'Скачать приложение для Android',
        amber: {
            title: 'Войти через Amber',
            helper: 'Отсканируйте этот QR-код с помощью Amber или используйте кнопки ниже.',
            openInAmber: 'Открыть в Amber',
            copyConnectionString: 'Копировать строку подключения',
            copied: 'Скопировано!'
        },
        keypair: {
            title: 'Сгенерировать новую пару ключей',
            description: 'Новая пара ключей Nostr генерируется локально в вашем браузере.',
            npubLabel: 'npub (открытый ключ)',
            nsecLabel: 'nsec (секретный ключ)',
            generateAnother: 'Сгенерировать другую',
            useAndLogin: 'Использовать эту пару ключей и войти'
        }
    },
    chats: {
        title: 'Чаты',
        emptyHint: 'Чатов пока нет. Нажмите +, чтобы добавить контакт.',
        selectPrompt: 'Выберите чат, чтобы начать общение',
        addContact: 'Добавить контакт',
        filterAll: 'Все',
        filterUnread: 'Непрочитанные',
        filterGroups: 'Группы',
        emptyUnread: 'Нет непрочитанных чатов',
        emptyGroups: 'Нет групп',
        favorites: 'Избранное',
        favoriteMessage: 'сообщение',
        favoriteMessages: 'сообщений',
        emptyFavorites: 'Нет избранных сообщений',
        archive: 'Архивировать',
        unarchive: 'Разархивировать',
        archived: 'Архив',
        emptyArchive: 'Нет архивных чатов',
        chatArchived: 'Чат архивирован'
    },
    contacts: {
        title: 'Контакты',
        manage: 'Управление',
        scanQr: 'Сканировать QR',
        scanQrAria: 'Сканировать QR-код контакта',
        emptyHint: 'Если контакты не отображаются, нажмите Управление, чтобы добавить.',
        selectPrompt: 'Выберите контакт, чтобы начать общение',
        youPrefix: 'Вы',
        mediaPreview: { image: 'Изображение', video: 'Видео', voiceMessage: 'Голосовое сообщение', audio: 'Аудио', file: 'Файл', location: 'Местоположение' }
    },
    connection: { relaysLabel: 'Реле:', authLabel: 'Аутентификация:', authFailedLabel: 'Ошибка:' },
    sync: {
        title: 'Синхронизация сообщений...',
        fetched: '{count} получено',
        errorTitle: 'Синхронизация не удалась',
        timeoutError: 'Синхронизация превысила время ожидания (5 минут)',
        relayErrorsTitle: 'Ошибки реле',
        retryButton: 'Повторить',
        skipButton: 'Пропустить и продолжить',
        continueInBackground: 'Продолжить в фоне',
        backgroundComplete: 'Синхронизация завершена',
        manualRelay: { label: 'Или введите реле вручную', placeholder: 'ws://192.168.1.50:7777', connectButton: 'Подключить', connecting: 'Подключение...', invalidUrl: 'Недопустимый URL реле' },
        steps: {
            connectDiscoveryRelays: 'Подключение к реле обнаружения',
            fetchMessagingRelays: 'Получение и кэширование реле сообщений пользователя',
            connectReadRelays: 'Подключение к реле сообщений пользователя',
            fetchHistory: 'Получение и кэширование истории из реле',
            fetchContacts: 'Получение и объединение контактов из реле',
            fetchContactProfiles: 'Получение и кэширование профилей контактов и информации о реле',
            fetchUserProfile: 'Получение и кэширование профиля пользователя'
        }
    },
    modals: {
        manageContacts: {
            title: 'Контакты', scanQr: 'Сканировать QR', scanQrAria: 'Сканировать QR-код для добавления контакта',
            searchPlaceholder: 'npub, NIP-05 или поисковый запрос', addContactAria: 'Добавить контакт',
            searchContactsAria: 'Поиск контактов', searching: 'Поиск...', searchFailed: 'Поиск не удался',
            noResults: 'Нет результатов', noContacts: 'Контакты не добавлены', removeContactAria: 'Удалить контакт',
            resolvingNip05: 'Поиск NIP-05...', nip05LookupFailed: 'Не удалось найти NIP-05',
            nip05NotFound: 'NIP-05 не найден', nip05InvalidFormat: 'Неверный формат NIP-05 (используйте имя@домен.com)',
            alreadyAdded: 'Уже добавлен', syncing: 'Синхронизация контактов…',
            pullToRefresh: 'Потяните для обновления', releaseToRefresh: 'Отпустите для обновления',
            newContact: 'Добавить контакт', createGroup: 'Создать группу',
            contextMenu: { openMenu: 'Открыть меню', delete: 'Удалить' },
            confirmDelete: { title: 'Удалить контакт', message: 'Вы уверены, что хотите удалить {name}?', confirm: 'Удалить' }
        },
        createGroup: {
            title: 'Создать групповой чат', searchPlaceholder: 'Поиск контактов',
            selectedCount: '{count} выбрано', minContactsHint: 'Выберите не менее 2 контактов',
            createButton: 'Создать группу', creating: 'Создание...', noContacts: 'Нет контактов для добавления в группу'
        },
        profile: {
            unknownName: 'Неизвестный', about: 'О себе', publicKey: 'Открытый ключ',
            messagingRelays: 'Реле сообщений', noRelays: 'Нет', refreshing: 'Обновление профиля…',
            notFound: 'Профиль не найден', addToContacts: 'Добавить в контакты', addingContact: 'Добавление…', contactAdded: 'Контакт добавлен'
        },
        emptyProfile: {
            title: 'Завершите настройку профиля',
            introLine1: 'Для этого ключа ещё не настроены реле сообщений и имя пользователя.',
            introLine2: 'Мы настроим реле сообщений по умолчанию, чтобы nospeak мог отправлять и получать сообщения. Вы можете изменить их позже в Настройках в разделе Реле сообщений.',
            usernameLabel: 'Имя пользователя', usernamePlaceholder: 'Ваше имя',
            usernameRequired: 'Введите имя пользователя для продолжения.',
            saveError: 'Не удалось сохранить начальную настройку. Попробуйте снова.',
            doLater: 'Сделаю это позже', saving: 'Сохранение...', continue: 'Продолжить',
            autoRelaysConfigured: 'Реле сообщений настроены. Вы можете изменить их в Настройках.'
        },
        relayStatus: {
            title: 'Подключения к реле', noRelays: 'Реле не настроены',
            connected: 'Подключено', disconnected: 'Отключено',
            typeLabel: 'Тип:', lastConnectedLabel: 'Последнее подключение:',
            successLabel: 'Успешно:', failureLabel: 'Ошибки:',
            authLabel: 'Аутентификация:', authErrorLabel: 'Ошибка аутентификации:',
            authNotRequired: 'Не требуется', authRequired: 'Требуется',
            authAuthenticating: 'Аутентификация', authAuthenticated: 'Аутентифицировано',
            authFailed: 'Ошибка', typePersistent: 'Постоянное', typeTemporary: 'Временное', never: 'Никогда'
        },
        qr: { title: 'QR-код', tabs: { myQr: 'Мой код', scanQr: 'Сканировать код' } },
        userQr: { preparing: 'Подготовка QR-кода…', hint: 'Это ваш npub в виде QR-кода. Поделитесь им, чтобы другие могли отсканировать и добавить вас в контакты.' },
        scanContactQr: {
            title: 'Сканировать QR контакта', instructions: 'Наведите камеру на QR-код Nostr, чтобы добавить контакт.',
            scanning: 'Сканирование…', noCamera: 'Камера недоступна на этом устройстве.',
            invalidQr: 'Этот QR-код не содержит действительного npub контакта.',
            addFailed: 'Не удалось добавить контакт из этого QR. Попробуйте снова.', added: 'Контакт добавлен из QR.'
        },
        scanContactQrResult: {
            title: 'Контакт из QR', alreadyContact: 'Этот контакт уже в вашем списке контактов.',
            reviewHint: 'Проверьте контакт из отсканированного QR перед добавлением.',
            updatingProfile: 'Обновление профиля…', loadFailed: 'Не удалось загрузить данные контакта из QR.',
            addFailed: 'Не удалось добавить контакт из QR.', closeButton: 'Закрыть',
            addButton: 'Добавить контакт', startChatButton: 'Начать чат'
        },
        attachmentPreview: {
            title: 'Предпросмотр вложения', imageAlt: 'Предпросмотр вложения', noPreview: 'Предпросмотр недоступен',
            captionLabel: 'Подпись (необязательно)', cancelButton: 'Отмена',
            sendButtonIdle: 'Отправить', sendButtonSending: 'Отправка…',
            uploadButtonIdle: 'Загрузить', uploadButtonUploading: 'Загрузка…'
        },
        locationPreview: { title: 'Местоположение', closeButton: 'Закрыть', openInOpenStreetMap: 'Открыть в OpenStreetMap', ctrlScrollToZoom: 'Используйте Ctrl + прокрутку для масштабирования' },
        mediaServersAutoConfigured: {
            title: 'Медиа-серверы настроены',
            message: 'Серверы Blossom не были настроены. Мы добавили {server1} и {server2}.\n\nВы можете изменить их в Настройки → Медиа-серверы.'
        }
    },
    chat: {
        sendFailedTitle: 'Ошибка отправки', sendFailedMessagePrefix: 'Не удалось отправить сообщение: ',
        location: { errorTitle: 'Ошибка местоположения', errorMessage: 'Не удалось определить ваше местоположение. Проверьте разрешения.' },
        relative: {
            justNow: 'только что', minutes: '{count} мин назад', minutesPlural: '{count} мин назад',
            hours: '{count} час назад', hoursPlural: '{count} часов назад',
            days: '{count} день назад', daysPlural: '{count} дней назад',
            weeks: '{count} неделю назад', weeksPlural: '{count} недель назад',
            months: '{count} месяц назад', monthsPlural: '{count} месяцев назад',
            years: '{count} год назад', yearsPlural: '{count} лет назад'
        },
        dateLabel: { today: 'Сегодня', yesterday: 'Вчера' },
        history: {
            fetchOlder: 'Получить старые сообщения из реле',
            summary: 'Получено {events} событий, сохранено {saved} новых сообщений ({chat} в этом чате)',
            none: 'Больше нет сообщений из реле',
            error: 'Не удалось получить старые сообщения. Попробуйте позже.'
        },
        empty: {
            noMessagesTitle: 'Сообщений пока нет', forContact: 'Начните разговор с {name}.',
            forGroup: 'Начните разговор в {name}.', generic: 'Выберите контакт, чтобы начать общение.'
        },
        group: {
            defaultTitle: 'Групповой чат', participants: '{count} участников', participantsShort: '{count}',
            members: 'Участники: {count}', membersTitle: 'Участники', viewMembers: 'Показать участников',
            editName: 'Изменить название группы', editNameTitle: 'Название группы',
            editNamePlaceholder: 'Введите название группы...', editNameHint: 'Оставьте пустым, чтобы использовать имена участников',
            editNameSave: 'Сохранить', editNameCancel: 'Отмена',
            nameSavedToast: 'Сохранено. Будет установлено со следующим сообщением.',
            nameValidationTooLong: 'Название слишком длинное (макс. 100 символов)',
            nameValidationInvalidChars: 'Название содержит недопустимые символы'
        },
        inputPlaceholder: 'Введите сообщение...',
        contextMenu: { cite: 'Цитировать', copy: 'Копировать', sentAt: 'Отправлено', favorite: 'В избранное', unfavorite: 'Убрать из избранного' },
        reactions: {
            cannotReactTitle: 'Невозможно отреагировать', cannotReactMessage: 'Это сообщение слишком старое для поддержки реакций.',
            failedTitle: 'Ошибка реакции', failedMessagePrefix: 'Не удалось отправить реакцию: '
        },
        mediaMenu: { uploadMediaTooltip: 'Загрузить медиа', takePhoto: 'Сделать фото', location: 'Местоположение', image: 'Изображение', video: 'Видео', audio: 'Музыка', file: 'Файл' },
        mediaErrors: { cameraErrorTitle: 'Ошибка камеры', cameraErrorMessage: 'Не удалось сделать фото' },
        fileUpload: { fileTooLarge: 'Файл слишком большой. Максимальный размер — 10 МБ.', download: 'Скачать', decrypting: 'Расшифровка...' },
        mediaUnavailable: 'Этот медиафайл больше недоступен.',
        voiceMessage: {
            title: 'Голосовое сообщение', recordAria: 'Записать голосовое сообщение',
            playPreviewAria: 'Воспроизвести предпросмотр', pausePreviewAria: 'Приостановить предпросмотр',
            cancelButton: 'Отмена', pauseButton: 'Пауза', doneButton: 'Готово',
            resumeButton: 'Продолжить', sendButton: 'Отправить', microphoneTitle: 'Микрофон',
            permissionDeniedTitle: 'Разрешение микрофона',
            permissionDeniedMessage: 'Разрешите доступ к микрофону для записи.',
            nativeNotAvailable: 'Нативная запись недоступна.',
            unsupported: 'Голосовая запись не поддерживается на этом устройстве.',
            failedToStart: 'Не удалось начать запись.', failedToStop: 'Не удалось остановить запись.',
            recordingFailed: 'Ошибка записи.'
        },
        relayStatus: { sending: 'отправка...', sentToRelays: 'отправлено на {successful}/{desired} реле' },
        searchPlaceholder: 'Поиск', searchNoMatches: 'Нет совпадений', searchAriaLabel: 'Поиск в чате'
    },
    settings: {
        title: 'Настройки',
        categories: { general: 'Общие', profile: 'Профиль', messagingRelays: 'Реле сообщений', mediaServers: 'Медиа-серверы', security: 'Безопасность', about: 'О приложении' },
        general: {
            appearanceLabel: 'Оформление', appearanceDescription: 'Выберите системную, светлую или тёмную тему.',
            languageLabel: 'Язык', languageDescription: 'Выберите предпочитаемый язык приложения.'
        },
        notifications: { label: 'Уведомления', supportedDescription: 'Получайте уведомления о новых сообщениях на этом устройстве', unsupportedDescription: 'Уведомления не поддерживаются на этом устройстве' },
        backgroundMessaging: {
            label: 'Фоновые сообщения',
            description: 'Поддерживайте подключение nospeak к реле сообщений и получайте уведомления о сообщениях и реакциях, когда приложение работает в фоне. Android будет показывать постоянное уведомление, когда эта функция включена. Работает как с локальным ключом (nsec), так и с Amber. Предпросмотр уведомлений может быть ограничен настройками конфиденциальности экрана блокировки Android.',
            openBatterySettings: 'Открыть настройки батареи'
        },
        urlPreviews: { label: 'Предпросмотр URL', description: 'Показывать карточки предпросмотра для немедийных ссылок в сообщениях.' },
        profile: {
            nameLabel: 'Имя', namePlaceholder: 'Ваше имя', displayNameLabel: 'Отображаемое имя',
            displayNamePlaceholder: 'Отображаемое имя', aboutLabel: 'О себе', aboutPlaceholder: 'Расскажите о себе',
            pictureUrlLabel: 'URL фотографии', pictureUrlPlaceholder: 'https://example.com/avatar.jpg',
            bannerUrlLabel: 'URL баннера', bannerUrlPlaceholder: 'https://example.com/banner.jpg',
            nip05Label: 'NIP-05 (имя пользователя)', nip05Placeholder: 'имя@домен.com',
            websiteLabel: 'Веб-сайт', websitePlaceholder: 'https://example.com',
            lightningLabel: 'Адрес Lightning (LUD-16)', lightningPlaceholder: 'пользователь@провайдер.com',
            saveButton: 'Сохранить изменения', savingButton: 'Сохранение...'
        },
        messagingRelays: {
            description: 'Настройте реле сообщений NIP-17. Эти реле используются для получения ваших зашифрованных сообщений. Для лучшей производительности обычно достаточно 2 реле сообщений.',
            inputPlaceholder: 'wss://relay.example.com', addButton: 'Добавить', emptyState: 'Реле не настроены',
            tooManyWarning: 'Наличие более 3 реле сообщений может снизить производительность и надёжность.',
            saveStatusSuccess: 'Список реле сохранён на {count} реле.',
            saveStatusPartial: 'Список реле сохранён на {succeeded} из {attempted} реле.',
            saveStatusNone: 'Не удалось сохранить список реле ни на одном реле.',
            saveStatusError: 'Ошибка сохранения списка реле. Ваши настройки могут быть не полностью распространены.',
            savingStatus: 'Сохранение настроек реле…'
        },
        mediaServers: {
            description: 'Настройте медиа-серверы Blossom. Эти серверы используются для хранения загружаемых файлов (медиа профиля и вложения чата).',
            inputPlaceholder: 'https://cdn.example.com', addButton: 'Добавить', emptyState: 'Серверы не настроены',
            saveStatusSuccess: 'Список серверов сохранён на {count} реле.',
            saveStatusPartial: 'Список серверов сохранён на {succeeded} из {attempted} реле.',
            saveStatusNone: 'Не удалось сохранить список серверов ни на одном реле.',
            saveStatusError: 'Ошибка сохранения списка серверов. Ваши настройки могут быть не полностью распространены.',
            savingStatus: 'Сохранение настроек медиа-серверов…', primary: 'Основной', setAsPrimary: 'Сделать основным',
            mediaCacheLabel: 'Кэш медиафайлов',
            mediaCacheDescription: 'Сохраняйте просмотренные медиафайлы в галерею для офлайн-доступа. Файлами можно управлять в приложении Фото.'
        },
        security: {
            loginMethodTitle: 'Способ входа', loginMethodUnknown: 'Неизвестный',
            npubLabel: 'Ваш npub', nsecLabel: 'Ваш nsec',
            hideNsecAria: 'Скрыть nsec', showNsecAria: 'Показать nsec',
            dangerZoneTitle: 'Опасная зона',
            dangerZoneDescription: 'Выход из аккаунта удалит все кэшированные данные с этого устройства.',
            logoutButton: 'Выйти'
        }
    },
    signerMismatch: {
        title: 'Несоответствие аккаунта',
        description: 'В расширении для подписи в вашем браузере активен другой аккаунт, отличный от того, под которым вы вошли.',
        expectedAccount: 'Вход выполнен как', actualAccount: 'Активный аккаунт подписчика',
        instructions: 'Переключитесь на правильный аккаунт в расширении для подписи и перезагрузите эту страницу.'
    }
};

export default ru;
