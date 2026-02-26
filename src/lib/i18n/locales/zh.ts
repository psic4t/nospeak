const zh = {
    common: {
        appName: 'nospeak',
        save: '保存',
        cancel: '取消'
    },
    auth: {
        loginWithAmber: '使用Amber登录',
        loginWithExtension: '使用Nostr签名扩展登录',
        orSeparator: '或',
        loginWithNsecLabel: '使用nsec登录',
        nsecPlaceholder: 'nsec1...',
        loginButton: '登录',
        connecting: '连接中...',
        generateKeypairLink: '生成新密钥对',
        downloadAndroidApp: '下载Android应用',
        amber: {
            title: '使用Amber登录',
            helper: '使用Amber扫描此QR码，或使用下方按钮。',
            openInAmber: '在Amber中打开',
            copyConnectionString: '复制连接字符串',
            copied: '已复制！'
        },
        keypair: {
            title: '生成新密钥对',
            description: '新的Nostr密钥对将在浏览器中本地生成。',
            npubLabel: 'npub（公钥）',
            nsecLabel: 'nsec（私钥）',
            generateAnother: '生成另一个',
            useAndLogin: '使用此密钥对并登录'
        }
    },
    chats: {
        title: '聊天',
        emptyHint: '暂无聊天。点击+添加联系人。',
        selectPrompt: '选择一个聊天开始发消息',
        addContact: '添加联系人',
        filterAll: '全部',
        filterUnread: '未读',
        filterGroups: '群组',
        emptyUnread: '没有未读聊天',
        emptyGroups: '没有群组',
        favorites: '收藏',
        favoriteMessage: '条消息',
        favoriteMessages: '条消息',
        emptyFavorites: '暂无收藏消息',
        archive: '归档',
        unarchive: '取消归档',
        archived: '已归档',
        emptyArchive: '没有已归档的聊天',
        chatArchived: '聊天已归档'
    },
    contacts: {
        title: '联系人',
        manage: '管理',
        scanQr: '扫描QR',
        scanQrAria: '扫描联系人QR码',
        emptyHint: '如果没有显示联系人，请点击"管理"添加。',
        selectPrompt: '选择联系人开始聊天',
        youPrefix: '你',
        mediaPreview: {
            image: '图片',
            video: '视频',
            voiceMessage: '语音消息',
            audio: '音频',
            file: '文件',
            location: '位置'
        }
    },
    connection: {
        relaysLabel: '中继：',
        authLabel: '认证：',
        authFailedLabel: '失败：'
    },
    sync: {
        title: '正在同步消息...',
        fetched: '已获取 {count} 条',
        errorTitle: '同步失败',
        timeoutError: '同步在5分钟后超时',
        relayErrorsTitle: '中继错误',
        retryButton: '重试',
        skipButton: '跳过并继续',
        continueInBackground: '在后台继续',
        backgroundComplete: '同步完成',
        manualRelay: {
            label: '或手动输入中继',
            placeholder: 'ws://192.168.1.50:7777',
            connectButton: '连接',
            connecting: '连接中...',
            invalidUrl: '无效的中继URL'
        },
        steps: {
            connectDiscoveryRelays: '连接到发现中继',
            fetchMessagingRelays: '获取并缓存用户的消息中继',
            connectReadRelays: '连接到用户的消息中继',
            fetchHistory: '从中继获取并缓存历史记录',
            fetchContacts: '从中继获取并合并联系人',
            fetchContactProfiles: '获取并缓存联系人资料和中继信息',
            fetchUserProfile: '获取并缓存用户资料'
        }
    },
    modals: {
        manageContacts: {
            title: '联系人',
            scanQr: '扫描QR',
            scanQrAria: '扫描QR码添加联系人',
            searchPlaceholder: 'npub、NIP-05或搜索词',
            addContactAria: '添加联系人',
            searchContactsAria: '搜索联系人',
            searching: '搜索中...',
            searchFailed: '搜索失败',
            noResults: '无结果',
            noContacts: '未添加联系人',
            removeContactAria: '删除联系人',
            resolvingNip05: '正在查找NIP-05...',
            nip05LookupFailed: 'NIP-05查找失败',
            nip05NotFound: '未找到NIP-05',
            nip05InvalidFormat: '无效的NIP-05格式（请使用name@domain.com格式）',
            alreadyAdded: '已添加',
            syncing: '正在同步联系人…',
            pullToRefresh: '下拉刷新',
            releaseToRefresh: '释放刷新',
            newContact: '添加联系人',
            createGroup: '创建群组',
            contextMenu: {
                openMenu: '打开菜单',
                viewProfile: '查看资料',
                delete: '删除'
            },
            confirmDelete: {
                title: '删除联系人',
                message: '确定要删除{name}吗？',
                confirm: '删除'
            }
        },
        createGroup: {
            title: '创建群聊',
            searchPlaceholder: '搜索联系人',
            selectedCount: '已选择 {count} 人',
            minContactsHint: '请至少选择2个联系人',
            createButton: '创建群组',
            creating: '创建中...',
            noContacts: '没有可添加到群组的联系人'
        },
        profile: {
            unknownName: '未知',
            about: '关于',
            publicKey: '公钥',
            messagingRelays: '消息中继',
            noRelays: '无',
            refreshing: '正在刷新资料…',
            notFound: '未找到资料',
            addToContacts: '添加到联系人',
            addingContact: '添加中…',
            contactAdded: '联系人已添加'
        },
        emptyProfile: {
            title: '完成个人资料设置',
            introLine1: '此密钥尚未配置消息中继或用户名。',
            introLine2: '我们将配置一些默认的消息中继，以便nospeak可以发送和接收消息。您可以稍后在设置中的消息中继部分进行更改。',
            usernameLabel: '用户名',
            usernamePlaceholder: '你的名字',
            usernameRequired: '请输入用户名以继续。',
            saveError: '无法保存初始设置。请重试。',
            doLater: '稍后设置',
            saving: '保存中...',
            continue: '继续',
            autoRelaysConfigured: '消息中继已配置。您可以在设置中更改。'
        },
        relayStatus: {
            title: '中继连接',
            noRelays: '未配置中继',
            connected: '已连接',
            disconnected: '已断开',
            typeLabel: '类型：',
            lastConnectedLabel: '上次连接：',
            successLabel: '成功：',
            failureLabel: '失败：',
            authLabel: '认证：',
            authErrorLabel: '认证错误：',
            authNotRequired: '不需要',
            authRequired: '需要',
            authAuthenticating: '认证中',
            authAuthenticated: '已认证',
            authFailed: '失败',
            typePersistent: '持久',
            typeTemporary: '临时',
            never: '从未'
        },
        qr: {
            title: 'QR码',
            tabs: {
                myQr: '我的二维码',
                scanQr: '扫描二维码'
            }
        },
        userQr: {
            preparing: '正在准备QR码…',
            hint: '这是您的npub的QR码。分享给他人，他们可以扫描后将您添加为联系人。'
        },
        scanContactQr: {
            title: '扫描联系人QR',
            instructions: '将相机对准Nostr QR码以添加联系人。',
            scanning: '扫描中…',
            noCamera: '此设备上相机不可用。',
            invalidQr: '此QR码不包含有效的联系人npub。',
            addFailed: '无法从此QR添加联系人。请重试。',
            added: '已从QR添加联系人。'
        },
        scanContactQrResult: {
            title: 'QR中的联系人',
            alreadyContact: '此联系人已在您的联系人列表中。',
            reviewHint: '添加前请确认扫描到的联系人信息。',
            updatingProfile: '正在更新资料…',
            loadFailed: '无法从QR加载联系人详情。',
            addFailed: '无法从QR添加联系人。',
            closeButton: '关闭',
            addButton: '添加联系人',
            startChatButton: '开始聊天'
        },
        attachmentPreview: {
            title: '附件预览',
            imageAlt: '附件预览',
            noPreview: '无法预览',
            captionLabel: '说明（可选）',
            cancelButton: '取消',
            sendButtonIdle: '发送',
            sendButtonSending: '发送中…',
            uploadButtonIdle: '上传',
            uploadButtonUploading: '上传中…'
        },
        locationPreview: {
            title: '位置',
            closeButton: '关闭',
            openInOpenStreetMap: '在OpenStreetMap中打开',
            ctrlScrollToZoom: '使用Ctrl + 滚轮缩放'
        },
        mediaServersAutoConfigured: {
            title: '媒体服务器已配置',
            message: '未配置Blossom服务器。我们已添加{server1}和{server2}。\n\n您可以在设置→媒体服务器中更改。'
        }
    },
    chat: {
        sendFailedTitle: '发送失败',
        sendFailedMessagePrefix: '消息发送失败：',
        location: {
            errorTitle: '位置错误',
            errorMessage: '无法获取您的位置。请检查权限设置。'
        },
        relative: {
            justNow: '刚刚',
            minutes: '{count}分钟前',
            minutesPlural: '{count}分钟前',
            hours: '{count}小时前',
            hoursPlural: '{count}小时前',
            days: '{count}天前',
            daysPlural: '{count}天前',
            weeks: '{count}周前',
            weeksPlural: '{count}周前',
            months: '{count}个月前',
            monthsPlural: '{count}个月前',
            years: '{count}年前',
            yearsPlural: '{count}年前'
        },
        dateLabel: {
            today: '今天',
            yesterday: '昨天'
        },
        history: {
            fetchOlder: '从中继获取更早的消息',
            summary: '获取了{events}个事件，保存了{saved}条新消息（此聊天{chat}条）',
            none: '中继中没有更多消息',
            error: '获取旧消息失败。请稍后重试。'
        },
        empty: {
            noMessagesTitle: '暂无消息',
            forContact: '开始与{name}的对话。',
            forGroup: '在{name}中开始对话。',
            generic: '选择联系人开始聊天。'
        },
        group: {
            defaultTitle: '群聊',
            participants: '{count}位参与者',
            participantsShort: '{count}',
            members: '成员：{count}',
            membersTitle: '成员',
            viewMembers: '查看成员',
            editName: '编辑群名',
            editNameTitle: '群名称',
            editNamePlaceholder: '输入群名称...',
            editNameHint: '留空则使用参与者名称',
            editNameSave: '保存',
            editNameCancel: '取消',
            nameSavedToast: '已保存。将在下一条消息时设置。',
            nameValidationTooLong: '名称过长（最多100个字符）',
            nameValidationInvalidChars: '名称包含无效字符'
        },
        inputPlaceholder: '输入消息...',
        contextMenu: {
            cite: '引用',
            copy: '复制',
            sentAt: '发送时间',
            favorite: '收藏',
            unfavorite: '取消收藏'
        },
        reactions: {
            cannotReactTitle: '无法回应',
            cannotReactMessage: '此消息太旧，不支持回应。',
            failedTitle: '回应失败',
            failedMessagePrefix: '发送回应失败：'
        },
        mediaMenu: {
            uploadMediaTooltip: '上传媒体',
            takePhoto: '拍照',
            location: '位置',
            image: '图片',
            video: '视频',
            audio: '音乐',
            file: '文件'
        },
        mediaErrors: {
            cameraErrorTitle: '相机错误',
            cameraErrorMessage: '拍照失败'
        },
        fileUpload: {
            fileTooLarge: '文件太大。最大大小为10 MB。',
            download: '下载',
            decrypting: '解密中...'
        },
        mediaUnavailable: '此媒体已不可用。',
        voiceMessage: {
            title: '语音消息',
            recordAria: '录制语音消息',
            playPreviewAria: '播放预览',
            pausePreviewAria: '暂停预览',
            cancelButton: '取消',
            pauseButton: '暂停',
            doneButton: '完成',
            resumeButton: '继续',
            sendButton: '发送',
            microphoneTitle: '麦克风',
            permissionDeniedTitle: '麦克风权限',
            permissionDeniedMessage: '请允许访问麦克风以进行录音。',
            nativeNotAvailable: '原生录音不可用。',
            unsupported: '此设备不支持语音录制。',
            failedToStart: '无法开始录音。',
            failedToStop: '无法停止录音。',
            recordingFailed: '录音失败。'
        },
        relayStatus: {
            sending: '发送中...',
            sentToRelays: '已发送到{successful}/{desired}个中继'
        },
        searchPlaceholder: '搜索',
        searchNoMatches: '无匹配',
        searchAriaLabel: '搜索聊天'
    },
    settings: {
        title: '设置',
        categories: {
            general: '通用',
            profile: '个人资料',
            messagingRelays: '消息中继',
            mediaServers: '媒体服务器',
            security: '安全',
            about: '关于'
        },
        general: {
            appearanceLabel: '外观',
            appearanceDescription: '选择跟随系统、浅色或深色模式。',
            languageLabel: '语言',
            languageDescription: '选择您偏好的应用语言。'
        },
        notifications: {
            label: '通知',
            supportedDescription: '在此设备上收到新消息时获取通知',
            unsupportedDescription: '此设备不支持通知'
        },
        backgroundMessaging: {
            label: '后台消息',
            description: '保持nospeak连接到消息中继，在应用处于后台时接收消息和回应通知。启用后，Android将显示常驻通知。支持本地密钥（nsec）和Amber登录。通知预览可能受Android锁屏隐私设置限制。',
            openBatterySettings: '打开电池设置'
        },
        urlPreviews: {
            label: 'URL预览',
            description: '显示消息中非媒体链接的预览卡片。'
        },
        profile: {
            nameLabel: '名称',
            namePlaceholder: '你的名字',
            displayNameLabel: '显示名称',
            displayNamePlaceholder: '显示名称',
            aboutLabel: '关于',
            aboutPlaceholder: '介绍一下自己',
            pictureUrlLabel: '头像URL',
            pictureUrlPlaceholder: 'https://example.com/avatar.jpg',
            bannerUrlLabel: '横幅URL',
            bannerUrlPlaceholder: 'https://example.com/banner.jpg',
            nip05Label: 'NIP-05（用户名）',
            nip05Placeholder: 'name@domain.com',
            websiteLabel: '网站',
            websitePlaceholder: 'https://example.com',
            lightningLabel: 'Lightning地址（LUD-16）',
            lightningPlaceholder: 'user@provider.com',
            saveButton: '保存更改',
            savingButton: '保存中...'
        },
        messagingRelays: {
            description: '配置您的NIP-17消息中继。这些中继用于接收加密消息。为获得最佳性能，通常建议使用2个消息中继。',
            inputPlaceholder: 'wss://relay.example.com',
            addButton: '添加',
            emptyState: '未配置中继',
            tooManyWarning: '超过3个消息中继可能会降低性能和可靠性。',
            saveStatusSuccess: '已将中继列表保存到{count}个中继。',
            saveStatusPartial: '已将中继列表保存到{attempted}个中继中的{succeeded}个。',
            saveStatusNone: '无法将中继列表保存到任何中继。',
            saveStatusError: '保存中继列表时出错。您的设置可能未完全同步。',
            savingStatus: '正在保存中继设置…'
        },
        mediaServers: {
            description: '配置您的Blossom媒体服务器。这些服务器用于存储您上传的文件（个人资料媒体和聊天附件）。',
            inputPlaceholder: 'https://cdn.example.com',
            addButton: '添加',
            emptyState: '未配置服务器',
            saveStatusSuccess: '已将服务器列表保存到{count}个中继。',
            saveStatusPartial: '已将服务器列表保存到{attempted}个中继中的{succeeded}个。',
            saveStatusNone: '无法将服务器列表保存到任何中继。',
            saveStatusError: '保存服务器列表时出错。您的设置可能未完全同步。',
            savingStatus: '正在保存媒体服务器设置…',
            primary: '主要',
            setAsPrimary: '设为主要',
            mediaCacheLabel: '媒体缓存',
            mediaCacheDescription: '将查看过的媒体保存到相册以便离线访问。文件可在相册应用中管理。'
        },
        security: {
            loginMethodTitle: '登录方式',
            loginMethodUnknown: '未知',
            npubLabel: '你的npub',
            nsecLabel: '你的nsec',
            hideNsecAria: '隐藏nsec',
            showNsecAria: '显示nsec',
            dangerZoneTitle: '危险操作',
            dangerZoneDescription: '登出将删除此设备上的所有缓存数据。',
            logoutButton: '登出'
        },
        pin: {
            appLockLabel: '应用锁',
            appLockDescription: '访问应用时需要输入PIN码',
            changePinButton: '更改PIN码',
            enterNewPin: '设置PIN码',
            enterNewPinDescription: '输入4位PIN码',
            confirmPin: '确认PIN码',
            confirmPinDescription: '再次输入相同的PIN码',
            enterCurrentPin: '输入PIN码',
            enterCurrentPinDescription: '输入您当前的PIN码',
            wrongPin: 'PIN码错误',
            pinMismatch: 'PIN码不匹配，请重试',
            enterPinToUnlock: '输入PIN码解锁'
        }
    },
    signerMismatch: {
        title: '账户不匹配',
        description: '您的浏览器签名扩展中激活的账户与您登录的账户不同。',
        expectedAccount: '已登录账户',
        actualAccount: '签名扩展活动账户',
        instructions: '请在签名扩展中切换到正确的账户，然后重新加载此页面。'
    }
};

export default zh;
