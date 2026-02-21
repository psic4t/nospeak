const th = {
    common: { appName: 'nospeak', save: 'บันทึก', cancel: 'ยกเลิก' },
    auth: {
        loginWithAmber: 'เข้าสู่ระบบด้วย Amber', loginWithExtension: 'เข้าสู่ระบบด้วยส่วนขยาย Nostr Signer',
        orSeparator: 'หรือ', loginWithNsecLabel: 'เข้าสู่ระบบด้วย nsec', nsecPlaceholder: 'nsec1...',
        loginButton: 'เข้าสู่ระบบ', connecting: 'กำลังเชื่อมต่อ...', generateKeypairLink: 'สร้างคู่กุญแจใหม่',
        downloadAndroidApp: 'ดาวน์โหลดแอป Android',
        amber: { title: 'เข้าสู่ระบบด้วย Amber', helper: 'สแกน QR โค้ดนี้ด้วย Amber หรือใช้ปุ่มด้านล่าง', openInAmber: 'เปิดใน Amber', copyConnectionString: 'คัดลอกสตริงการเชื่อมต่อ', copied: 'คัดลอกแล้ว!' },
        keypair: { title: 'สร้างคู่กุญแจใหม่', description: 'คู่กุญแจ Nostr ใหม่ถูกสร้างขึ้นในเบราว์เซอร์ของคุณ', npubLabel: 'npub (กุญแจสาธารณะ)', nsecLabel: 'nsec (กุญแจลับ)', generateAnother: 'สร้างอันใหม่', useAndLogin: 'ใช้คู่กุญแจนี้และเข้าสู่ระบบ' }
    },
    chats: {
        title: 'แชท', emptyHint: 'ยังไม่มีแชท แตะ + เพื่อเพิ่มผู้ติดต่อ', selectPrompt: 'เลือกแชทเพื่อเริ่มส่งข้อความ',
        addContact: 'เพิ่มผู้ติดต่อ', filterAll: 'ทั้งหมด', filterUnread: 'ยังไม่ได้อ่าน', filterGroups: 'กลุ่ม',
        emptyUnread: 'ไม่มีแชทที่ยังไม่ได้อ่าน', emptyGroups: 'ไม่มีกลุ่ม', favorites: 'รายการโปรด',
        favoriteMessage: 'ข้อความ', favoriteMessages: 'ข้อความ', emptyFavorites: 'ยังไม่มีข้อความที่ชื่นชอบ',
        archive: 'เก็บถาวร', unarchive: 'ยกเลิกการเก็บถาวร', archived: 'เก็บถาวรแล้ว', emptyArchive: 'ไม่มีแชทที่เก็บถาวร', chatArchived: 'เก็บถาวรแชทแล้ว'
    },
    contacts: {
        title: 'ผู้ติดต่อ', manage: 'จัดการ', scanQr: 'สแกน QR', scanQrAria: 'สแกน QR โค้ดของผู้ติดต่อ',
        emptyHint: 'หากไม่มีผู้ติดต่อปรากฏ คลิกจัดการเพื่อเพิ่ม', selectPrompt: 'เลือกผู้ติดต่อเพื่อเริ่มแชท',
        youPrefix: 'คุณ', mediaPreview: { image: 'รูปภาพ', video: 'วิดีโอ', voiceMessage: 'ข้อความเสียง', audio: 'เสียง', file: 'ไฟล์', location: 'ตำแหน่ง' }
    },
    connection: { relaysLabel: 'รีเลย์:', authLabel: 'ยืนยันตัวตน:', authFailedLabel: 'ล้มเหลว:' },
    sync: {
        title: 'กำลังซิงค์ข้อความ...', fetched: 'ดึงข้อมูลแล้ว {count} รายการ', errorTitle: 'การซิงค์ล้มเหลว',
        timeoutError: 'การซิงค์หมดเวลาหลังจาก 5 นาที', relayErrorsTitle: 'ข้อผิดพลาดของรีเลย์',
        retryButton: 'ลองใหม่', skipButton: 'ข้ามและดำเนินการต่อ', continueInBackground: 'ดำเนินการต่อในพื้นหลัง',
        backgroundComplete: 'การซิงค์เสร็จสมบูรณ์',
        manualRelay: { label: 'หรือป้อนรีเลย์ด้วยตนเอง', placeholder: 'ws://192.168.1.50:7777', connectButton: 'เชื่อมต่อ', connecting: 'กำลังเชื่อมต่อ...', invalidUrl: 'URL รีเลย์ไม่ถูกต้อง' },
        steps: { connectDiscoveryRelays: 'เชื่อมต่อกับรีเลย์สำรวจ', fetchMessagingRelays: 'ดึงและแคชรีเลย์ส่งข้อความของผู้ใช้', connectReadRelays: 'เชื่อมต่อกับรีเลย์ส่งข้อความของผู้ใช้', fetchHistory: 'ดึงและแคชประวัติจากรีเลย์', fetchContacts: 'ดึงและรวมผู้ติดต่อจากรีเลย์', fetchContactProfiles: 'ดึงและแคชโปรไฟล์ผู้ติดต่อและข้อมูลรีเลย์', fetchUserProfile: 'ดึงและแคชโปรไฟล์ผู้ใช้' }
    },
    modals: {
        manageContacts: {
            title: 'ผู้ติดต่อ', scanQr: 'สแกน QR', scanQrAria: 'สแกน QR โค้ดเพื่อเพิ่มผู้ติดต่อ',
            searchPlaceholder: 'npub, NIP-05 หรือคำค้นหา', addContactAria: 'เพิ่มผู้ติดต่อ',
            searchContactsAria: 'ค้นหาผู้ติดต่อ', searching: 'กำลังค้นหา...', searchFailed: 'การค้นหาล้มเหลว',
            noResults: 'ไม่พบผลลัพธ์', noContacts: 'ยังไม่มีผู้ติดต่อ', removeContactAria: 'ลบผู้ติดต่อ',
            resolvingNip05: 'กำลังค้นหา NIP-05...', nip05LookupFailed: 'การค้นหา NIP-05 ล้มเหลว',
            nip05NotFound: 'ไม่พบ NIP-05', nip05InvalidFormat: 'รูปแบบ NIP-05 ไม่ถูกต้อง (ใช้ name@domain.com)',
            alreadyAdded: 'เพิ่มแล้ว', syncing: 'กำลังซิงค์ผู้ติดต่อ…',
            pullToRefresh: 'ดึงลงเพื่อรีเฟรช', releaseToRefresh: 'ปล่อยเพื่อรีเฟรช',
            newContact: 'เพิ่มผู้ติดต่อ', createGroup: 'สร้างกลุ่ม',
            contextMenu: { openMenu: 'เปิดเมนู', delete: 'ลบ' },
            confirmDelete: { title: 'ลบผู้ติดต่อ', message: 'คุณแน่ใจหรือไม่ว่าต้องการลบ {name}?', confirm: 'ลบ' }
        },
        createGroup: { title: 'สร้างแชทกลุ่ม', searchPlaceholder: 'ค้นหาผู้ติดต่อ', selectedCount: 'เลือกแล้ว {count} คน', minContactsHint: 'เลือกผู้ติดต่ออย่างน้อย 2 คน', createButton: 'สร้างกลุ่ม', creating: 'กำลังสร้าง...', noContacts: 'ไม่มีผู้ติดต่อที่จะเพิ่มในกลุ่ม' },
        profile: { unknownName: 'ไม่ทราบ', about: 'เกี่ยวกับ', publicKey: 'กุญแจสาธารณะ', messagingRelays: 'รีเลย์ส่งข้อความ', noRelays: 'ไม่มี', refreshing: 'กำลังรีเฟรชโปรไฟล์…', notFound: 'ไม่พบโปรไฟล์', addToContacts: 'เพิ่มในผู้ติดต่อ', addingContact: 'กำลังเพิ่ม…', contactAdded: 'เพิ่มผู้ติดต่อแล้ว' },
        emptyProfile: { title: 'ตั้งค่าโปรไฟล์ของคุณให้เสร็จสมบูรณ์', introLine1: 'กุญแจนี้ยังไม่ได้กำหนดค่ารีเลย์ส่งข้อความหรือชื่อผู้ใช้', introLine2: 'เราจะกำหนดค่ารีเลย์ส่งข้อความเริ่มต้นเพื่อให้ nospeak สามารถส่งและรับข้อความได้ คุณสามารถเปลี่ยนได้ภายหลังในการตั้งค่าภายใต้รีเลย์ส่งข้อความ', usernameLabel: 'ชื่อผู้ใช้', usernamePlaceholder: 'ชื่อของคุณ', usernameRequired: 'กรุณาใส่ชื่อผู้ใช้เพื่อดำเนินการต่อ', saveError: 'ไม่สามารถบันทึกการตั้งค่าเริ่มต้นได้ กรุณาลองใหม่อีกครั้ง', doLater: 'ฉันจะทำภายหลัง', saving: 'กำลังบันทึก...', continue: 'ดำเนินการต่อ', autoRelaysConfigured: 'กำหนดค่ารีเลย์ส่งข้อความแล้ว คุณสามารถเปลี่ยนได้ในการตั้งค่า' },
        relayStatus: { title: 'การเชื่อมต่อรีเลย์', noRelays: 'ไม่มีรีเลย์ที่กำหนดค่า', connected: 'เชื่อมต่อแล้ว', disconnected: 'ตัดการเชื่อมต่อ', typeLabel: 'ประเภท:', lastConnectedLabel: 'เชื่อมต่อล่าสุด:', successLabel: 'สำเร็จ:', failureLabel: 'ล้มเหลว:', authLabel: 'ยืนยันตัวตน:', authErrorLabel: 'ข้อผิดพลาดการยืนยัน:', authNotRequired: 'ไม่จำเป็น', authRequired: 'จำเป็น', authAuthenticating: 'กำลังยืนยันตัวตน', authAuthenticated: 'ยืนยันตัวตนแล้ว', authFailed: 'ล้มเหลว', typePersistent: 'ถาวร', typeTemporary: 'ชั่วคราว', never: 'ไม่เคย' },
        qr: { title: 'QR โค้ด', tabs: { myQr: 'โค้ดของฉัน', scanQr: 'สแกนโค้ด' } },
        userQr: { preparing: 'กำลังเตรียม QR โค้ด…', hint: 'นี่คือ npub ของคุณในรูปแบบ QR โค้ด แชร์ให้คนอื่นเพื่อให้สแกนเพิ่มคุณเป็นผู้ติดต่อ' },
        scanContactQr: { title: 'สแกน QR ผู้ติดต่อ', instructions: 'หันกล้องไปที่ QR โค้ด Nostr เพื่อเพิ่มผู้ติดต่อ', scanning: 'กำลังสแกน…', noCamera: 'กล้องไม่พร้อมใช้งานบนอุปกรณ์นี้', invalidQr: 'QR โค้ดนี้ไม่มี npub ผู้ติดต่อที่ถูกต้อง', addFailed: 'ไม่สามารถเพิ่มผู้ติดต่อจาก QR นี้ได้ กรุณาลองใหม่', added: 'เพิ่มผู้ติดต่อจาก QR แล้ว' },
        scanContactQrResult: { title: 'ผู้ติดต่อจาก QR', alreadyContact: 'ผู้ติดต่อนี้อยู่ในรายชื่อผู้ติดต่อของคุณแล้ว', reviewHint: 'ตรวจสอบผู้ติดต่อจาก QR ที่สแกนก่อนเพิ่ม', updatingProfile: 'กำลังอัปเดตโปรไฟล์…', loadFailed: 'ไม่สามารถโหลดรายละเอียดผู้ติดต่อจาก QR', addFailed: 'ไม่สามารถเพิ่มผู้ติดต่อจาก QR', closeButton: 'ปิด', addButton: 'เพิ่มผู้ติดต่อ', startChatButton: 'เริ่มแชท' },
        attachmentPreview: { title: 'ตัวอย่างไฟล์แนบ', imageAlt: 'ตัวอย่างไฟล์แนบ', noPreview: 'ไม่มีตัวอย่าง', captionLabel: 'คำบรรยาย (ไม่บังคับ)', cancelButton: 'ยกเลิก', sendButtonIdle: 'ส่ง', sendButtonSending: 'กำลังส่ง…', uploadButtonIdle: 'อัปโหลด', uploadButtonUploading: 'กำลังอัปโหลด…' },
        locationPreview: { title: 'ตำแหน่ง', closeButton: 'ปิด', openInOpenStreetMap: 'เปิดใน OpenStreetMap', ctrlScrollToZoom: 'ใช้ Ctrl + เลื่อนเพื่อซูม' },
        mediaServersAutoConfigured: { title: 'กำหนดค่าเซิร์ฟเวอร์สื่อแล้ว', message: 'ไม่มีเซิร์ฟเวอร์ Blossom ที่กำหนดค่าไว้ เราได้เพิ่ม {server1} และ {server2}\n\nคุณสามารถเปลี่ยนได้ในการตั้งค่า → เซิร์ฟเวอร์สื่อ' }
    },
    chat: {
        sendFailedTitle: 'การส่งล้มเหลว', sendFailedMessagePrefix: 'ส่งข้อความไม่สำเร็จ: ',
        location: { errorTitle: 'ข้อผิดพลาดตำแหน่ง', errorMessage: 'ไม่สามารถรับตำแหน่งของคุณได้ กรุณาตรวจสอบสิทธิ์' },
        relative: { justNow: 'เมื่อสักครู่', minutes: '{count} นาทีที่แล้ว', minutesPlural: '{count} นาทีที่แล้ว', hours: '{count} ชั่วโมงที่แล้ว', hoursPlural: '{count} ชั่วโมงที่แล้ว', days: '{count} วันที่แล้ว', daysPlural: '{count} วันที่แล้ว', weeks: '{count} สัปดาห์ที่แล้ว', weeksPlural: '{count} สัปดาห์ที่แล้ว', months: '{count} เดือนที่แล้ว', monthsPlural: '{count} เดือนที่แล้ว', years: '{count} ปีที่แล้ว', yearsPlural: '{count} ปีที่แล้ว' },
        dateLabel: { today: 'วันนี้', yesterday: 'เมื่อวาน' },
        history: { fetchOlder: 'ดึงข้อความเก่าจากรีเลย์', summary: 'ดึงข้อมูล {events} เหตุการณ์ บันทึก {saved} ข้อความใหม่ ({chat} ในแชทนี้)', none: 'ไม่มีข้อความเพิ่มเติมจากรีเลย์', error: 'ไม่สามารถดึงข้อความเก่าได้ ลองใหม่ภายหลัง' },
        empty: { noMessagesTitle: 'ยังไม่มีข้อความ', forContact: 'เริ่มการสนทนากับ {name}', forGroup: 'เริ่มการสนทนาใน {name}', generic: 'เลือกผู้ติดต่อเพื่อเริ่มแชท' },
        group: { defaultTitle: 'แชทกลุ่ม', participants: '{count} ผู้เข้าร่วม', participantsShort: '{count}', members: 'สมาชิก: {count}', membersTitle: 'สมาชิก', viewMembers: 'ดูสมาชิก', editName: 'แก้ไขชื่อกลุ่ม', editNameTitle: 'ชื่อกลุ่ม', editNamePlaceholder: 'ป้อนชื่อกลุ่ม...', editNameHint: 'เว้นว่างเพื่อใช้ชื่อผู้เข้าร่วม', editNameSave: 'บันทึก', editNameCancel: 'ยกเลิก', nameSavedToast: 'บันทึกแล้ว จะถูกตั้งค่าพร้อมข้อความถัดไป', nameValidationTooLong: 'ชื่อยาวเกินไป (สูงสุด 100 ตัวอักษร)', nameValidationInvalidChars: 'ชื่อมีอักขระที่ไม่ถูกต้อง' },
        inputPlaceholder: 'พิมพ์ข้อความ...',
        contextMenu: { cite: 'อ้างอิง', copy: 'คัดลอก', sentAt: 'ส่งเมื่อ', favorite: 'ชื่นชอบ', unfavorite: 'ยกเลิกชื่นชอบ' },
        reactions: { cannotReactTitle: 'ไม่สามารถรีแอคได้', cannotReactMessage: 'ข้อความนี้เก่าเกินไปที่จะรองรับรีแอคชัน', failedTitle: 'รีแอคล้มเหลว', failedMessagePrefix: 'ส่งรีแอคไม่สำเร็จ: ' },
        mediaMenu: { uploadMediaTooltip: 'อัปโหลดสื่อ', takePhoto: 'ถ่ายรูป', location: 'ตำแหน่ง', image: 'รูปภาพ', video: 'วิดีโอ', audio: 'เพลง', file: 'ไฟล์' },
        mediaErrors: { cameraErrorTitle: 'ข้อผิดพลาดกล้อง', cameraErrorMessage: 'ถ่ายรูปไม่สำเร็จ' },
        fileUpload: { fileTooLarge: 'ไฟล์มีขนาดใหญ่เกินไป ขนาดสูงสุดคือ 10 MB', download: 'ดาวน์โหลด', decrypting: 'กำลังถอดรหัส...' },
        mediaUnavailable: 'สื่อนี้ไม่พร้อมใช้งานแล้ว',
        voiceMessage: { title: 'ข้อความเสียง', recordAria: 'บันทึกข้อความเสียง', playPreviewAria: 'เล่นตัวอย่าง', pausePreviewAria: 'หยุดตัวอย่างชั่วคราว', cancelButton: 'ยกเลิก', pauseButton: 'หยุดชั่วคราว', doneButton: 'เสร็จสิ้น', resumeButton: 'ดำเนินการต่อ', sendButton: 'ส่ง', microphoneTitle: 'ไมโครโฟน', permissionDeniedTitle: 'สิทธิ์ไมโครโฟน', permissionDeniedMessage: 'กรุณาอนุญาตการเข้าถึงไมโครโฟนเพื่อบันทึกเสียง', nativeNotAvailable: 'การบันทึกเสียงแบบเนทีฟไม่พร้อมใช้งาน', unsupported: 'การบันทึกเสียงไม่รองรับบนอุปกรณ์นี้', failedToStart: 'เริ่มบันทึกเสียงไม่สำเร็จ', failedToStop: 'หยุดบันทึกเสียงไม่สำเร็จ', recordingFailed: 'การบันทึกเสียงล้มเหลว' },
        relayStatus: { sending: 'กำลังส่ง...', sentToRelays: 'ส่งไปยัง {successful}/{desired} รีเลย์' },
        searchPlaceholder: 'ค้นหา', searchNoMatches: 'ไม่พบผลลัพธ์', searchAriaLabel: 'ค้นหาในแชท'
    },
    settings: {
        title: 'การตั้งค่า',
        categories: { general: 'ทั่วไป', profile: 'โปรไฟล์', messagingRelays: 'รีเลย์ส่งข้อความ', mediaServers: 'เซิร์ฟเวอร์สื่อ', security: 'ความปลอดภัย', about: 'เกี่ยวกับ' },
        general: { appearanceLabel: 'รูปลักษณ์', appearanceDescription: 'เลือกว่าจะตามระบบ สว่าง หรือมืด', languageLabel: 'ภาษา', languageDescription: 'เลือกภาษาที่ต้องการสำหรับแอป' },
        notifications: { label: 'การแจ้งเตือน', supportedDescription: 'รับการแจ้งเตือนเมื่อคุณได้รับข้อความใหม่บนอุปกรณ์นี้', unsupportedDescription: 'การแจ้งเตือนไม่รองรับบนอุปกรณ์นี้' },
        backgroundMessaging: { label: 'การส่งข้อความในพื้นหลัง', description: 'ให้ nospeak เชื่อมต่อกับรีเลย์ส่งข้อความของคุณและรับการแจ้งเตือนข้อความ/รีแอคชันขณะที่แอปทำงานในพื้นหลัง Android จะแสดงการแจ้งเตือนถาวรเมื่อเปิดใช้งาน ใช้งานได้กับทั้งกุญแจภายในเครื่อง (nsec) และการเข้าสู่ระบบด้วย Amber ตัวอย่างการแจ้งเตือนอาจถูกจำกัดโดยการตั้งค่าความเป็นส่วนตัวของหน้าจอล็อก Android', openBatterySettings: 'เปิดการตั้งค่าแบตเตอรี่' },
        urlPreviews: { label: 'ตัวอย่าง URL', description: 'แสดงการ์ดตัวอย่างสำหรับลิงก์ที่ไม่ใช่สื่อในข้อความ' },
        profile: { nameLabel: 'ชื่อ', namePlaceholder: 'ชื่อของคุณ', displayNameLabel: 'ชื่อที่แสดง', displayNamePlaceholder: 'ชื่อที่แสดง', aboutLabel: 'เกี่ยวกับ', aboutPlaceholder: 'เล่าเกี่ยวกับตัวคุณ', pictureUrlLabel: 'URL รูปภาพ', pictureUrlPlaceholder: 'https://example.com/avatar.jpg', bannerUrlLabel: 'URL แบนเนอร์', bannerUrlPlaceholder: 'https://example.com/banner.jpg', nip05Label: 'NIP-05 (ชื่อผู้ใช้)', nip05Placeholder: 'name@domain.com', websiteLabel: 'เว็บไซต์', websitePlaceholder: 'https://example.com', lightningLabel: 'ที่อยู่ Lightning (LUD-16)', lightningPlaceholder: 'user@provider.com', saveButton: 'บันทึกการเปลี่ยนแปลง', savingButton: 'กำลังบันทึก...' },
        messagingRelays: { description: 'กำหนดค่ารีเลย์ส่งข้อความ NIP-17 ของคุณ รีเลย์เหล่านี้ใช้สำหรับรับข้อความเข้ารหัสของคุณ เพื่อประสิทธิภาพสูงสุด รีเลย์ส่งข้อความ 2 ตัวมักทำงานได้ดีที่สุด', inputPlaceholder: 'wss://relay.example.com', addButton: 'เพิ่ม', emptyState: 'ไม่มีรีเลย์ที่กำหนดค่า', tooManyWarning: 'การมีรีเลย์ส่งข้อความมากกว่า 3 ตัวอาจลดประสิทธิภาพและความน่าเชื่อถือ', saveStatusSuccess: 'บันทึกรายการรีเลย์ไปยัง {count} รีเลย์แล้ว', saveStatusPartial: 'บันทึกรายการรีเลย์ไปยัง {succeeded} จาก {attempted} รีเลย์', saveStatusNone: 'ไม่สามารถบันทึกรายการรีเลย์ไปยังรีเลย์ใดได้', saveStatusError: 'เกิดข้อผิดพลาดในการบันทึกรายการรีเลย์ การตั้งค่าของคุณอาจไม่ได้เผยแพร่ทั้งหมด', savingStatus: 'กำลังบันทึกการตั้งค่ารีเลย์…' },
        mediaServers: { description: 'กำหนดค่าเซิร์ฟเวอร์สื่อ Blossom ของคุณ เซิร์ฟเวอร์เหล่านี้ใช้สำหรับจัดเก็บไฟล์ที่คุณอัปโหลด (สื่อโปรไฟล์และไฟล์แนบในแชท)', inputPlaceholder: 'https://cdn.example.com', addButton: 'เพิ่ม', emptyState: 'ไม่มีเซิร์ฟเวอร์ที่กำหนดค่า', saveStatusSuccess: 'บันทึกรายการเซิร์ฟเวอร์ไปยัง {count} รีเลย์แล้ว', saveStatusPartial: 'บันทึกรายการเซิร์ฟเวอร์ไปยัง {succeeded} จาก {attempted} รีเลย์', saveStatusNone: 'ไม่สามารถบันทึกรายการเซิร์ฟเวอร์ไปยังรีเลย์ใดได้', saveStatusError: 'เกิดข้อผิดพลาดในการบันทึกรายการเซิร์ฟเวอร์ การตั้งค่าของคุณอาจไม่ได้เผยแพร่ทั้งหมด', savingStatus: 'กำลังบันทึกการตั้งค่าเซิร์ฟเวอร์สื่อ…', primary: 'หลัก', setAsPrimary: 'ตั้งเป็นหลัก', mediaCacheLabel: 'แคชสื่อ', mediaCacheDescription: 'บันทึกสื่อที่ดูแล้วลงในแกลเลอรีเพื่อเข้าถึงแบบออฟไลน์ ไฟล์สามารถจัดการได้ในแอปรูปภาพของคุณ' },
        security: { loginMethodTitle: 'วิธีการเข้าสู่ระบบ', loginMethodUnknown: 'ไม่ทราบ', npubLabel: 'npub ของคุณ', nsecLabel: 'nsec ของคุณ', hideNsecAria: 'ซ่อน nsec', showNsecAria: 'แสดง nsec', dangerZoneTitle: 'โซนอันตราย', dangerZoneDescription: 'การออกจากระบบจะลบข้อมูลแคชทั้งหมดออกจากอุปกรณ์นี้', logoutButton: 'ออกจากระบบ' },
        pin: {
            appLockLabel: 'ล็อกแอป',
            appLockDescription: 'ต้องใช้ PIN เพื่อเข้าถึงแอป',
            changePinButton: 'เปลี่ยน PIN',
            enterNewPin: 'ตั้ง PIN',
            enterNewPinDescription: 'ป้อน PIN 4 หลัก',
            confirmPin: 'ยืนยัน PIN',
            confirmPinDescription: 'ป้อน PIN เดิมอีกครั้ง',
            enterCurrentPin: 'ป้อน PIN',
            enterCurrentPinDescription: 'ป้อน PIN ปัจจุบันของคุณ',
            wrongPin: 'PIN ไม่ถูกต้อง',
            pinMismatch: 'PIN ไม่ตรงกัน ลองใหม่อีกครั้ง',
            enterPinToUnlock: 'ป้อน PIN เพื่อปลดล็อก'
        }
    },
    signerMismatch: { title: 'บัญชีไม่ตรงกัน', description: 'ส่วนขยาย Signer ในเบราว์เซอร์ของคุณมีบัญชีที่ใช้งานอยู่ซึ่งแตกต่างจากบัญชีที่คุณเข้าสู่ระบบ', expectedAccount: 'เข้าสู่ระบบเป็น', actualAccount: 'บัญชีที่ใช้งานอยู่ใน Signer', instructions: 'กรุณาสลับไปยังบัญชีที่ถูกต้องในส่วนขยาย Signer ของคุณและโหลดหน้านี้ใหม่' }
};
export default th;
