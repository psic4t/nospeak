const ja = {
    common: {
        appName: 'nospeak',
        save: '保存',
        cancel: 'キャンセル'
    },
    auth: {
        loginWithAmber: 'Amberでログイン',
        loginWithExtension: 'Nostr署名拡張機能でログイン',
        orSeparator: 'または',
        loginWithNsecLabel: 'nsecでログイン',
        nsecPlaceholder: 'nsec1...',
        loginButton: 'ログイン',
        connecting: '接続中...',
        generateKeypairLink: '新しいキーペアを生成',
        downloadAndroidApp: 'Androidアプリをダウンロード',
        amber: {
            title: 'Amberでログイン',
            helper: 'このQRコードをAmberでスキャンするか、下のボタンを使用してください。',
            openInAmber: 'Amberで開く',
            copyConnectionString: '接続文字列をコピー',
            copied: 'コピーしました！'
        },
        keypair: {
            title: '新しいキーペアを生成',
            description: '新しいNostrキーペアがブラウザ内でローカルに生成されます。',
            npubLabel: 'npub（公開鍵）',
            nsecLabel: 'nsec（秘密鍵）',
            generateAnother: '別のキーペアを生成',
            useAndLogin: 'このキーペアを使用してログイン'
        }
    },
    chats: {
        title: 'チャット',
        emptyHint: 'チャットはまだありません。+をタップして連絡先を追加してください。',
        selectPrompt: 'チャットを選択してメッセージを始めましょう',
        addContact: '連絡先を追加',
        filterAll: 'すべて',
        filterUnread: '未読',
        filterGroups: 'グループ',
        emptyUnread: '未読のチャットはありません',
        emptyGroups: 'グループはありません',
        favorites: 'お気に入り',
        favoriteMessage: '件のメッセージ',
        favoriteMessages: '件のメッセージ',
        emptyFavorites: 'お気に入りのメッセージはまだありません',
        export: 'エクスポート',
        archive: 'アーカイブ',
        unarchive: 'アーカイブ解除',
        archived: 'アーカイブ済み',
        emptyArchive: 'アーカイブされたチャットはありません',
        chatArchived: 'チャットをアーカイブしました'
    },
    contacts: {
        title: '連絡先',
        manage: '管理',
        scanQr: 'QRスキャン',
        scanQrAria: '連絡先のQRコードをスキャン',
        emptyHint: '連絡先が表示されない場合は、「管理」をクリックして追加してください。',
        selectPrompt: '連絡先を選択してチャットを始めましょう',
        youPrefix: 'あなた',
        mediaPreview: {
            image: '画像',
            video: '動画',
            voiceMessage: 'ボイスメッセージ',
            audio: 'オーディオ',
            file: 'ファイル',
            location: '位置情報'
        }
    },
    connection: {
        relaysLabel: 'リレー:',
        authLabel: '認証:',
        authFailedLabel: '失敗:'
    },
    sync: {
        title: 'メッセージを同期中...',
        fetched: '{count} 件取得',
        errorTitle: '同期に失敗しました',
        timeoutError: '同期が5分後にタイムアウトしました',
        relayErrorsTitle: 'リレーエラー',
        retryButton: '再試行',
        skipButton: 'スキップして続行',
        continueInBackground: 'バックグラウンドで続行',
        backgroundComplete: '同期が完了しました',
        manualRelay: {
            label: 'またはリレーを手動で入力',
            placeholder: 'ws://192.168.1.50:7777',
            connectButton: '接続',
            connecting: '接続中...',
            invalidUrl: '無効なリレーURL'
        },
        steps: {
            connectDiscoveryRelays: 'ディスカバリーリレーに接続',
            fetchMessagingRelays: 'ユーザーのメッセージングリレーを取得してキャッシュ',
            connectReadRelays: 'ユーザーのメッセージングリレーに接続',
            fetchHistory: 'リレーから履歴アイテムを取得してキャッシュ',
            fetchContacts: 'リレーから連絡先を取得してマージ',
            fetchContactProfiles: '連絡先のプロフィールとリレー情報を取得してキャッシュ',
            fetchUserProfile: 'ユーザープロフィールを取得してキャッシュ'
        }
    },
    modals: {
        manageContacts: {
            title: '連絡先',
            scanQr: 'QRスキャン',
            scanQrAria: 'QRコードをスキャンして連絡先を追加',
            searchPlaceholder: 'npub、NIP-05、または検索語',
            addContactAria: '連絡先を追加',
            searchContactsAria: '連絡先を検索',
            searching: '検索中...',
            searchFailed: '検索に失敗しました',
            noResults: '結果なし',
            noContacts: '連絡先が追加されていません',
            removeContactAria: '連絡先を削除',
            resolvingNip05: 'NIP-05を検索中...',
            nip05LookupFailed: 'NIP-05の検索に失敗しました',
            nip05NotFound: 'NIP-05が見つかりません',
            nip05InvalidFormat: '無効なNIP-05形式です（name@domain.comの形式で入力してください）',
            alreadyAdded: '既に追加済み',
            syncing: '連絡先を同期中…',
            pullToRefresh: '引き下げて更新',
            releaseToRefresh: '離して更新',
            newContact: '連絡先を追加',
            createGroup: 'グループを作成',
            contextMenu: {
                openMenu: 'メニューを開く',
                viewProfile: 'プロフィールを表示',
                delete: '削除'
            },
            confirmDelete: {
                title: '連絡先を削除',
                message: '{name}を削除してもよろしいですか？',
                confirm: '削除'
            }
        },
        createGroup: {
            title: 'グループチャットを作成',
            searchPlaceholder: '連絡先を検索',
            selectedCount: '{count} 件選択',
            minContactsHint: '2人以上の連絡先を選択してください',
            createButton: 'グループを作成',
            creating: '作成中...',
            noContacts: 'グループに追加する連絡先がありません'
        },
        profile: {
            unknownName: '不明',
            about: '自己紹介',
            publicKey: '公開鍵',
            messagingRelays: 'メッセージングリレー',
            noRelays: 'なし',
            refreshing: 'プロフィールを更新中…',
            notFound: 'プロフィールが見つかりません',
            addToContacts: '連絡先に追加',
            addingContact: '追加中…',
            contactAdded: '連絡先を追加しました'
        },
        emptyProfile: {
            title: 'プロフィールの設定を完了する',
            introLine1: 'この鍵にはメッセージングリレーやユーザー名がまだ設定されていません。',
            introLine2: 'デフォルトのメッセージングリレーを設定して、nospeakがメッセージの送受信をできるようにします。これらは後で設定のメッセージングリレーから変更できます。',
            usernameLabel: 'ユーザー名',
            usernamePlaceholder: 'あなたの名前',
            usernameRequired: '続行するにはユーザー名を入力してください。',
            saveError: '初期設定を保存できませんでした。もう一度お試しください。',
            doLater: '後で設定する',
            saving: '保存中...',
            continue: '続行',
            autoRelaysConfigured: 'メッセージングリレーを設定しました。設定から変更できます。'
        },
        relayStatus: {
            title: 'リレー接続',
            noRelays: 'リレーが設定されていません',
            connected: '接続済み',
            disconnected: '切断',
            typeLabel: 'タイプ:',
            lastConnectedLabel: '最終接続:',
            successLabel: '成功:',
            failureLabel: '失敗:',
            authLabel: '認証:',
            authErrorLabel: '認証エラー:',
            authNotRequired: '不要',
            authRequired: '必要',
            authAuthenticating: '認証中',
            authAuthenticated: '認証済み',
            authFailed: '失敗',
            typePersistent: '永続',
            typeTemporary: '一時',
            never: 'なし'
        },
        qr: {
            title: 'QRコード',
            tabs: {
                myQr: '自分のコード',
                scanQr: 'コードをスキャン'
            }
        },
        userQr: {
            preparing: 'QRコードを準備中…',
            hint: 'これはあなたのnpubのQRコードです。他の人に共有して、スキャンしてもらうことで連絡先として追加できます。'
        },
        scanContactQr: {
            title: '連絡先QRをスキャン',
            instructions: 'カメラをNostr QRコードに向けて連絡先を追加してください。',
            scanning: 'スキャン中…',
            noCamera: 'このデバイスではカメラを使用できません。',
            invalidQr: 'このQRコードには有効な連絡先のnpubが含まれていません。',
            addFailed: 'このQRから連絡先を追加できませんでした。もう一度お試しください。',
            added: 'QRから連絡先を追加しました。'
        },
        scanContactQrResult: {
            title: 'QRからの連絡先',
            alreadyContact: 'この連絡先は既に追加されています。',
            reviewHint: '追加する前にスキャンしたQRの連絡先を確認してください。',
            updatingProfile: 'プロフィールを更新中…',
            loadFailed: 'QRから連絡先の詳細を読み込めませんでした。',
            addFailed: 'QRから連絡先を追加できませんでした。',
            closeButton: '閉じる',
            addButton: '連絡先を追加',
            startChatButton: 'チャットを開始'
        },
        attachmentPreview: {
            title: '添付ファイルのプレビュー',
            imageAlt: '添付ファイルのプレビュー',
            noPreview: 'プレビューを表示できません',
            captionLabel: 'キャプション（任意）',
            cancelButton: 'キャンセル',
            sendButtonIdle: '送信',
            sendButtonSending: '送信中…',
            uploadButtonIdle: 'アップロード',
            uploadButtonUploading: 'アップロード中…'
        },
        locationPreview: {
            title: '位置情報',
            closeButton: '閉じる',
            openInOpenStreetMap: 'OpenStreetMapで開く',
            ctrlScrollToZoom: 'Ctrl + スクロールでズーム'
        },
        mediaServersAutoConfigured: {
            title: 'メディアサーバーを設定しました',
            message: 'Blossomサーバーが設定されていなかったため、{server1}と{server2}を追加しました。\n\n設定→メディアサーバーから変更できます。'
        }
    },
    chat: {
        sendFailedTitle: '送信に失敗しました',
        sendFailedMessagePrefix: 'メッセージの送信に失敗しました: ',
        location: {
            errorTitle: '位置情報エラー',
            errorMessage: '位置情報を取得できませんでした。権限を確認してください。'
        },
        relative: {
            justNow: 'たった今',
            minutes: '{count}分前',
            minutesPlural: '{count}分前',
            hours: '{count}時間前',
            hoursPlural: '{count}時間前',
            days: '{count}日前',
            daysPlural: '{count}日前',
            weeks: '{count}週間前',
            weeksPlural: '{count}週間前',
            months: '{count}ヶ月前',
            monthsPlural: '{count}ヶ月前',
            years: '{count}年前',
            yearsPlural: '{count}年前'
        },
        dateLabel: {
            today: '今日',
            yesterday: '昨日'
        },
        history: {
            fetchOlder: 'リレーから古いメッセージを取得',
            summary: '{events}件のイベントを取得し、{saved}件の新しいメッセージを保存しました（このチャットに{chat}件）',
            none: 'リレーにこれ以上のメッセージはありません',
            error: '古いメッセージの取得に失敗しました。後でもう一度お試しください。'
        },
        empty: {
            noMessagesTitle: 'メッセージはまだありません',
            forContact: '{name}との会話を始めましょう。',
            forGroup: '{name}で会話を始めましょう。',
            generic: '連絡先を選択してチャットを始めましょう。'
        },
        group: {
            defaultTitle: 'グループチャット',
            participants: '{count}人の参加者',
            participantsShort: '{count}',
            members: 'メンバー: {count}',
            membersTitle: 'メンバー',
            viewMembers: 'メンバーを表示',
            editName: 'グループ名を編集',
            editNameTitle: 'グループ名',
            editNamePlaceholder: 'グループ名を入力...',
            editNameHint: '空にすると参加者名が使用されます',
            editNameSave: '保存',
            editNameCancel: 'キャンセル',
            nameSavedToast: '保存しました。次のメッセージで設定されます。',
            nameValidationTooLong: '名前が長すぎます（最大100文字）',
            nameValidationInvalidChars: '名前に無効な文字が含まれています'
        },
        inputPlaceholder: 'メッセージを入力...',
        contextMenu: {
            cite: '引用',
            copy: 'コピー',
            sentAt: '送信日時',
            favorite: 'お気に入り',
            unfavorite: 'お気に入り解除'
        },
        reactions: {
            cannotReactTitle: 'リアクションできません',
            cannotReactMessage: 'このメッセージは古すぎてリアクションに対応していません。',
            failedTitle: 'リアクションに失敗しました',
            failedMessagePrefix: 'リアクションの送信に失敗しました: '
        },
        mediaMenu: {
            uploadMediaTooltip: 'メディアをアップロード',
            takePhoto: '写真を撮る',
            location: '位置情報',
            image: '画像',
            video: '動画',
            audio: '音楽',
            file: 'ファイル'
        },
        mediaErrors: {
            cameraErrorTitle: 'カメラエラー',
            cameraErrorMessage: '写真の撮影に失敗しました'
        },
        fileUpload: {
            fileTooLarge: 'ファイルが大きすぎます。最大サイズは10 MBです。',
            download: 'ダウンロード',
            decrypting: '復号中...'
        },
        mediaUnavailable: 'このメディアは利用できなくなりました。',
        voiceMessage: {
            title: 'ボイスメッセージ',
            recordAria: 'ボイスメッセージを録音',
            playPreviewAria: 'プレビューを再生',
            pausePreviewAria: 'プレビューを一時停止',
            cancelButton: 'キャンセル',
            pauseButton: '一時停止',
            doneButton: '完了',
            resumeButton: '再開',
            sendButton: '送信',
            microphoneTitle: 'マイク',
            permissionDeniedTitle: 'マイクの権限',
            permissionDeniedMessage: '録音するにはマイクへのアクセスを許可してください。',
            nativeNotAvailable: 'ネイティブ録音が利用できません。',
            unsupported: 'このデバイスでは音声録音がサポートされていません。',
            failedToStart: '録音を開始できませんでした。',
            failedToStop: '録音を停止できませんでした。',
            recordingFailed: '録音に失敗しました。'
        },
        relayStatus: {
            sending: '送信中...',
            sentToRelays: '{successful}/{desired}のリレーに送信しました'
        },
        searchPlaceholder: '検索',
        searchNoMatches: '一致なし',
        searchAriaLabel: 'チャットを検索'
    },
    settings: {
        title: '設定',
        categories: {
            general: '一般',
            profile: 'プロフィール',
            messagingRelays: 'メッセージングリレー',
            mediaServers: 'メディアサーバー',
            security: 'セキュリティ',
            about: 'アプリについて'
        },
        general: {
            appearanceLabel: '外観',
            appearanceDescription: 'システム、ライト、ダークモードから選択します。',
            languageLabel: '言語',
            languageDescription: 'アプリの言語を選択します。'
        },
        notifications: {
            label: '通知',
            supportedDescription: 'このデバイスで新しいメッセージを受信したときに通知を受け取ります',
            unsupportedDescription: 'このデバイスでは通知がサポートされていません'
        },
        backgroundMessaging: {
            label: 'バックグラウンドメッセージング',
            description: 'nospeakをメッセージングリレーに接続したままにし、アプリがバックグラウンドにあるときもメッセージやリアクションの通知を受け取ります。有効にすると、Androidは常駐通知を表示します。ローカルキー（nsec）とAmberログインの両方で動作します。通知のプレビューはAndroidのロック画面のプライバシー設定によって制限される場合があります。',
            openBatterySettings: 'バッテリー設定を開く'
        },
        urlPreviews: {
            label: 'URLプレビュー',
            description: 'メッセージ内のメディア以外のリンクにプレビューカードを表示します。'
        },
        profile: {
            nameLabel: '名前',
            namePlaceholder: 'あなたの名前',
            displayNameLabel: '表示名',
            displayNamePlaceholder: '表示名',
            aboutLabel: '自己紹介',
            aboutPlaceholder: '自己紹介を入力してください',
            pictureUrlLabel: 'プロフィール画像URL',
            pictureUrlPlaceholder: 'https://example.com/avatar.jpg',
            bannerUrlLabel: 'バナーURL',
            bannerUrlPlaceholder: 'https://example.com/banner.jpg',
            nip05Label: 'NIP-05（ユーザー名）',
            nip05Placeholder: 'name@domain.com',
            websiteLabel: 'ウェブサイト',
            websitePlaceholder: 'https://example.com',
            lightningLabel: 'Lightningアドレス（LUD-16）',
            lightningPlaceholder: 'user@provider.com',
            saveButton: '変更を保存',
            savingButton: '保存中...'
        },
        messagingRelays: {
            description: 'NIP-17メッセージングリレーを設定します。これらのリレーは暗号化されたメッセージの受信に使用されます。最適なパフォーマンスのために、通常は2つのメッセージングリレーが最適です。',
            inputPlaceholder: 'wss://relay.example.com',
            addButton: '追加',
            emptyState: 'リレーが設定されていません',
            tooManyWarning: 'メッセージングリレーが3つを超えると、パフォーマンスと信頼性が低下する可能性があります。',
            saveStatusSuccess: '{count}個のリレーにリレーリストを保存しました。',
            saveStatusPartial: '{attempted}個中{succeeded}個のリレーにリレーリストを保存しました。',
            saveStatusNone: 'どのリレーにもリレーリストを保存できませんでした。',
            saveStatusError: 'リレーリストの保存中にエラーが発生しました。設定が完全に反映されていない可能性があります。',
            savingStatus: 'リレー設定を保存中…'
        },
        mediaServers: {
            description: 'Blossomメディアサーバーを設定します。これらのサーバーは、アップロードするファイル（プロフィールメディアやチャットの添付ファイル）の保存に使用されます。',
            inputPlaceholder: 'https://cdn.example.com',
            addButton: '追加',
            emptyState: 'サーバーが設定されていません',
            saveStatusSuccess: '{count}個のリレーにサーバーリストを保存しました。',
            saveStatusPartial: '{attempted}個中{succeeded}個のリレーにサーバーリストを保存しました。',
            saveStatusNone: 'どのリレーにもサーバーリストを保存できませんでした。',
            saveStatusError: 'サーバーリストの保存中にエラーが発生しました。設定が完全に反映されていない可能性があります。',
            savingStatus: 'メディアサーバー設定を保存中…',
            primary: 'プライマリ',
            setAsPrimary: 'プライマリに設定',
            mediaCacheLabel: 'メディアキャッシュ',
            mediaCacheDescription: '閲覧したメディアをギャラリーに保存してオフラインアクセスできるようにします。ファイルはフォトアプリで管理できます。'
        },
        security: {
            loginMethodTitle: 'ログイン方法',
            loginMethodUnknown: '不明',
            npubLabel: 'あなたのnpub',
            nsecLabel: 'あなたのnsec',
            hideNsecAria: 'nsecを非表示',
            showNsecAria: 'nsecを表示',
            dangerZoneTitle: '危険な操作',
            dangerZoneDescription: 'ログアウトすると、このデバイスからすべてのキャッシュデータが削除されます。',
            logoutButton: 'ログアウト'
        },
        pin: {
            appLockLabel: 'アプリロック',
            appLockDescription: 'アプリへのアクセスにPINを要求する',
            changePinButton: 'PINを変更',
            enterNewPin: 'PINを設定',
            enterNewPinDescription: '4桁のPINを入力してください',
            confirmPin: 'PINを確認',
            confirmPinDescription: '同じPINをもう一度入力してください',
            enterCurrentPin: 'PINを入力',
            enterCurrentPinDescription: '現在のPINを入力してください',
            wrongPin: 'PINが正しくありません',
            pinMismatch: 'PINが一致しません。もう一度お試しください',
            enterPinToUnlock: 'PINを入力してロックを解除'
        }
    },
    signerMismatch: {
        title: 'アカウントの不一致',
        description: 'ブラウザの署名拡張機能で、ログインしたアカウントとは異なるアカウントがアクティブになっています。',
        expectedAccount: 'ログイン中のアカウント',
        actualAccount: '署名拡張機能のアクティブアカウント',
        instructions: '署名拡張機能で正しいアカウントに切り替えて、このページを再読み込みしてください。'
    }
};

export default ja;
