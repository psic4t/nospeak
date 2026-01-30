const es = {
    common: {
        appName: 'nospeak',
        save: 'Guardar',
        cancel: 'Cancelar'
    },
    auth: {
        loginWithAmber: 'Iniciar sesión con Amber',
        loginWithExtension: 'Iniciar sesión con la extensión Nostr Signer',
        orSeparator: 'O',
        loginWithNsecLabel: 'Iniciar sesión con nsec',
        nsecPlaceholder: 'nsec1...',
        loginButton: 'Iniciar sesión',
        connecting: 'Conectando...',
        generateKeypairLink: 'Generar nuevo par de claves',
        downloadAndroidApp: 'Descargar app de Android',
        amber: {
            title: 'Iniciar sesión con Amber',
            helper: 'Escanea este código QR con Amber o usa los botones de abajo.',
            openInAmber: 'Abrir en Amber',
            copyConnectionString: 'Copiar cadena de conexión',
            copied: '¡Copiado!'
        },
        keypair: {
            title: 'Generar nuevo par de claves',
            description: 'Se genera un nuevo par de claves Nostr localmente en tu navegador.',
            npubLabel: 'npub (clave pública)',
            nsecLabel: 'nsec (clave secreta)',
            generateAnother: 'Generar otro',
            useAndLogin: 'Usar este par de claves e iniciar sesión'
        }
    },
    chats: {
        title: 'Chats',
        emptyHint: 'Aún no hay chats. Toca + para añadir un contacto.',
        selectPrompt: 'Selecciona un chat para empezar a enviar mensajes',
        addContact: 'Añadir contacto'
    },
    contacts: {
        title: 'Contactos',
        manage: 'Gestionar',
        scanQr: 'Escanear QR',
        scanQrAria: 'Escanear código QR de contacto',
        emptyHint: 'Si no aparecen contactos, pulsa Gestionar para añadir algunos.',
        selectPrompt: 'Selecciona un contacto para empezar a chatear',
        youPrefix: 'Tú',
        mediaPreview: {
            image: 'Imagen',
            video: 'Vídeo',
            voiceMessage: 'Mensaje de voz',
            audio: 'Audio',
            file: 'Archivo',
            location: 'Ubicación'
        }
    },
    connection: {
        relaysLabel: 'Relays:',
        authLabel: 'Auth:',
        authFailedLabel: 'Falló:'
    },
    sync: {
        title: 'Sincronizando mensajes...',
        fetched: '{count} recuperados',
        errorTitle: 'Sincronización fallida',
        timeoutError: 'Tiempo de espera agotado después de 5 minutos',
        relayErrorsTitle: 'Errores de relay',
        retryButton: 'Reintentar',
        skipButton: 'Omitir y continuar',
        continueInBackground: 'Continuar en segundo plano',
        backgroundComplete: 'Sincronización completada',
        steps: {
            connectDiscoveryRelays: 'Conectar a relays de descubrimiento',
            fetchMessagingRelays: "Obtener y guardar en caché los relays de mensajería del usuario",
            connectReadRelays: "Conectar a los relays de mensajería del usuario",
            fetchHistory: 'Obtener y guardar en caché el historial desde los relays',
            fetchContacts: 'Obtener y fusionar contactos desde los relays',
            fetchContactProfiles: 'Obtener y guardar en caché perfiles de contactos e info de relays',
            fetchUserProfile: 'Obtener y guardar en caché el perfil del usuario'
        }
    },

    modals: {
        manageContacts: {
            title: 'Contactos',
            scanQr: 'Escanear QR',
            scanQrAria: 'Escanear código QR para añadir contacto',
            searchPlaceholder: 'npub, NIP-05 o término de búsqueda',
            addContactAria: 'Añadir contacto',
            searchContactsAria: 'Buscar contactos',
            searching: 'Buscando...',
            searchFailed: 'La búsqueda falló',
            noResults: 'Sin resultados',
            noContacts: 'No se han añadido contactos',
            removeContactAria: 'Eliminar contacto',
            resolvingNip05: 'Buscando NIP-05...',
            nip05LookupFailed: 'No se pudo buscar NIP-05',
            nip05NotFound: 'NIP-05 no encontrado',
            nip05InvalidFormat: 'Formato NIP-05 inválido (usa nombre@dominio.com)',
            alreadyAdded: 'Ya añadido',
            syncing: 'Sincronizando contactos…',
            pullToRefresh: 'Tira para actualizar',
            releaseToRefresh: 'Suelta para actualizar',
            contextMenu: {
                openMenu: 'Abrir menú',
                delete: 'Eliminar'
            },
            confirmDelete: {
                title: 'Eliminar contacto',
                message: '¿Estás seguro de que quieres eliminar a {name}?',
                confirm: 'Eliminar'
            },
            newContact: 'Añadir contacto',
            createGroup: 'Crear grupo'
        },
        createGroup: {
            title: 'Crear chat grupal',
            searchPlaceholder: 'Buscar contactos',
            selectedCount: '{count} seleccionados',
            minContactsHint: 'Selecciona al menos 2 contactos',
            createButton: 'Crear grupo',
            creating: 'Creando...',
            noContacts: 'No hay contactos para añadir al grupo'
        },
        profile: {
            unknownName: 'Desconocido',
            about: 'Acerca de',
            publicKey: 'Clave pública',
            messagingRelays: 'Relays de mensajería',
            noRelays: 'Ninguno',
            refreshing: 'Actualizando perfil…',
            notFound: 'Perfil no encontrado'
        },

        emptyProfile: {
            title: 'Termina de configurar tu perfil',
            introLine1: 'Esta clave aún no tiene relays de mensajería ni un nombre de usuario configurados.',
            introLine2: 'Configuraremos algunos relays de mensajería por defecto para que nospeak pueda enviar y recibir mensajes. Puedes cambiarlos más tarde en Ajustes → Relays de mensajería.',
            usernameLabel: 'Nombre de usuario',
            usernamePlaceholder: 'Tu nombre',
            usernameRequired: 'Introduce un nombre de usuario para continuar.',
            saveError: 'No se pudo guardar tu configuración inicial. Inténtalo de nuevo.',
            doLater: 'Lo haré más tarde',
            saving: 'Guardando...',
            continue: 'Continuar'
        },
        relayStatus: {
            title: 'Conexiones a relays',
            noRelays: 'No hay relays configurados',
            connected: 'Conectado',
            disconnected: 'Desconectado',
            typeLabel: 'Tipo:',
            lastConnectedLabel: 'Última conexión:',
            successLabel: 'Éxitos:',
            failureLabel: 'Fallos:',
            authLabel: 'Auth:',
            authErrorLabel: 'Error de auth:',
            authNotRequired: 'No requerido',
            authRequired: 'Requerido',
            authAuthenticating: 'Autenticando',
            authAuthenticated: 'Autenticado',
            authFailed: 'Falló',
            typePersistent: 'Persistente',
            typeTemporary: 'Temporal',
            never: 'Nunca'
        },
        qr: {
            title: 'Código QR',
            tabs: {
                myQr: 'Mi código',
                scanQr: 'Escanear código'
            }
        },
        userQr: {
            preparing: 'Preparando código QR…',
            hint: 'Este es tu npub como código QR. Compártelo con alguien para que pueda escanearlo y añadirte como contacto.'
        },
        scanContactQr: {
            title: 'Escanear QR de contacto',
            instructions: 'Apunta tu cámara a un código QR nostr para añadir un contacto.',
            scanning: 'Escaneando…',
            noCamera: 'La cámara no está disponible en este dispositivo.',
            invalidQr: 'Este código QR no contiene un npub de contacto válido.',
            addFailed: 'No se pudo añadir el contacto desde este QR. Inténtalo de nuevo.',
            added: 'Contacto añadido desde QR.'
        },
        scanContactQrResult: {
            title: 'Contacto desde QR',
            alreadyContact: 'Este contacto ya está en tus contactos.',
            reviewHint: 'Revisa el contacto del QR escaneado antes de agregarlo.',
            updatingProfile: 'Actualizando perfil…',
            loadFailed: 'Error al cargar los detalles del contacto desde QR.',
            addFailed: 'Error al agregar contacto desde QR.',
            closeButton: 'Cerrar',
            addButton: 'Agregar contacto',
            startChatButton: 'Iniciar chat'
        },
        attachmentPreview: {
            title: 'Vista previa del adjunto',
            imageAlt: 'Vista previa del adjunto',
            noPreview: 'No hay vista previa disponible',
            captionLabel: 'Leyenda (opcional)',
            cancelButton: 'Cancelar',
            sendButtonIdle: 'Enviar',
            sendButtonSending: 'Enviando…',
            uploadButtonIdle: 'Subir',
            uploadButtonUploading: 'Subiendo…'
        },
        locationPreview: {
            title: 'Ubicación',
            closeButton: 'Cerrar',
            openInOpenStreetMap: 'Abrir en OpenStreetMap'
        },
        mediaServersAutoConfigured: {
            title: 'Servidores de medios configurados',
            message: 'No se configuraron servidores Blossom. Añadimos {server1} y {server2}.\n\nPuedes cambiarlos en Ajustes → Servidores de medios.'
        }
    },
    chat: {
        sendFailedTitle: 'Error al enviar',
        sendFailedMessagePrefix: 'No se pudo enviar el mensaje: ',
        location: {
            errorTitle: 'Error de ubicación',
            errorMessage: 'No se pudo obtener tu ubicación. Comprueba los permisos.'
        },
        relative: {
            justNow: 'ahora mismo',
            minutes: 'hace {count} min',
            minutesPlural: 'hace {count} min',
            hours: 'hace {count} hora',
            hoursPlural: 'hace {count} horas',
            days: 'hace {count} día',
            daysPlural: 'hace {count} días',
            weeks: 'hace {count} semana',
            weeksPlural: 'hace {count} semanas',
            months: 'hace {count} mes',
            monthsPlural: 'hace {count} meses',
            years: 'hace {count} año',
            yearsPlural: 'hace {count} años'
        },
        dateLabel: {
            today: 'Hoy',
            yesterday: 'Ayer'
        },
        history: {
            fetchOlder: 'Obtener mensajes antiguos desde los relays',
            summary: 'Obtenidos {events} eventos, guardados {saved} mensajes nuevos ({chat} en este chat)',
            none: 'No hay más mensajes disponibles desde los relays',
            error: 'No se pudieron obtener mensajes antiguos. Inténtalo más tarde.'
        },
        empty: {
            noMessagesTitle: 'Aún no hay mensajes',
            forContact: 'Inicia la conversación con {name}.',
            forGroup: 'Inicia la conversación en {name}.',
            generic: 'Selecciona un contacto para empezar a chatear.'
        },
        group: {
            defaultTitle: 'Chat grupal',
            participants: '{count} participantes',
            participantsShort: '{count}',
            members: 'Miembros: {count}',
            membersTitle: 'Miembros',
            viewMembers: 'Ver miembros',
            editName: 'Editar nombre del grupo',
            editNameTitle: 'Nombre del grupo',
            editNamePlaceholder: 'Ingresa el nombre del grupo...',
            editNameHint: 'Dejar vacío para usar nombres de participantes',
            editNameSave: 'Guardar',
            editNameCancel: 'Cancelar',
            nameSavedToast: 'Guardado. Se establecerá con el próximo mensaje.',
            nameValidationTooLong: 'Nombre muy largo (máx. 100 caracteres)',
            nameValidationInvalidChars: 'El nombre contiene caracteres inválidos'
        },
        inputPlaceholder: 'Escribe un mensaje...',
        contextMenu: {
            cite: 'Citar',
            copy: 'Copiar',
            sentAt: 'Enviado'
        },
        reactions: {
            cannotReactTitle: 'No se puede reaccionar',
            cannotReactMessage: 'Este mensaje es demasiado antiguo para soportar reacciones.',
            failedTitle: 'Error al reaccionar',
            failedMessagePrefix: 'No se pudo enviar la reacción: '
        },
        mediaMenu: {
            uploadMediaTooltip: 'Subir medios',
            takePhoto: 'Hacer foto',
            location: 'Ubicación',
            image: 'Imagen',
            video: 'Vídeo',
            audio: 'Música'
        },
        mediaErrors: {
            cameraErrorTitle: 'Error de cámara',
            cameraErrorMessage: 'No se pudo capturar la foto'
        },
        mediaUnavailable: 'Este medio ya no está disponible.',
        voiceMessage: {
            title: 'Mensaje de voz',
            recordAria: 'Grabar mensaje de voz',
            playPreviewAria: 'Reproducir vista previa',
            pausePreviewAria: 'Pausar vista previa',
            cancelButton: 'Cancelar',
            pauseButton: 'Pausar',
            doneButton: 'Listo',
            resumeButton: 'Reanudar',
            sendButton: 'Enviar',
            microphoneTitle: 'Micrófono',
            permissionDeniedTitle: 'Permiso de micrófono',
            permissionDeniedMessage: 'Permite el acceso al micrófono para grabar.',
            nativeNotAvailable: 'La grabación nativa no está disponible.',
            unsupported: 'La grabación de voz no es compatible con este dispositivo.',
            failedToStart: 'No se pudo iniciar la grabación.',
            failedToStop: 'No se pudo detener la grabación.',
            recordingFailed: 'La grabación falló.'
        },
        relayStatus: {
            sending: 'enviando...',
            sentToRelays: 'enviado a {successful}/{desired} relays'
        },
        searchPlaceholder: 'Buscar',
        searchNoMatches: 'Sin coincidencias',
        searchAriaLabel: 'Buscar en el chat'
    },
    settings: {
        title: 'Ajustes',
        categories: {
            general: 'General',
            profile: 'Perfil',
            messagingRelays: 'Relays de mensajería',
            mediaServers: 'Servidores de medios',
            security: 'Seguridad',
            about: 'Acerca de'
        },

        general: {
            appearanceLabel: 'Apariencia',
            appearanceDescription: 'Elige si seguir el modo del sistema, claro u oscuro.',
            languageLabel: 'Idioma',
            languageDescription: 'Elige el idioma de la aplicación.'
        },
        notifications: {
            label: 'Notificaciones',
            supportedDescription: 'Recibe notificaciones cuando lleguen nuevos mensajes en este dispositivo',
            unsupportedDescription: 'Las notificaciones no están soportadas en este dispositivo'
        },
        backgroundMessaging: {
            label: 'Mensajería en segundo plano',
            description: 'Mantén nospeak conectado a tus relays de mensajería y recibe notificaciones de mensajes/reacciones mientras la app está en segundo plano. Android mostrará una notificación persistente cuando esto esté habilitado. Funciona tanto con clave local (nsec) como con inicios de sesión con Amber. Las vistas previas de notificaciones pueden estar limitadas por la configuración de privacidad de la pantalla de bloqueo de Android.',
            openBatterySettings: 'Abrir ajustes de batería'
        },
        urlPreviews: {
            label: 'Vistas previas de URL',
            description: 'Mostrar tarjetas de vista previa para enlaces no multimedia en los mensajes.'
        },
        profile: {
            nameLabel: 'Nombre',
            namePlaceholder: 'Tu nombre',
            displayNameLabel: 'Nombre para mostrar',
            displayNamePlaceholder: 'Nombre para mostrar',
            aboutLabel: 'Acerca de ti',
            aboutPlaceholder: 'Cuéntanos sobre ti',
            pictureUrlLabel: 'URL de la imagen',
            pictureUrlPlaceholder: 'https://example.com/avatar.jpg',
            bannerUrlLabel: 'URL del banner',
            bannerUrlPlaceholder: 'https://example.com/banner.jpg',
            nip05Label: 'NIP-05 (Nombre de usuario)',
            nip05Placeholder: 'nombre@dominio.com',
            websiteLabel: 'Sitio web',
            websitePlaceholder: 'https://example.com',
            lightningLabel: 'Dirección Lightning (LUD-16)',
            lightningPlaceholder: 'usuario@proveedor.com',
            saveButton: 'Guardar cambios',
            savingButton: 'Guardando...'
        },
        messagingRelays: {
            description: 'Configura tus relays de mensajería NIP-17. Estos relays se usan para recibir tus mensajes cifrados. Para un mejor rendimiento, normalmente funcionan mejor 2–3 relays de mensajería.',
            inputPlaceholder: 'wss://relay.example.com',
            addButton: 'Añadir',
            emptyState: 'No hay relays configurados',
            tooManyWarning: 'Tener más de 3 relays de mensajería puede reducir el rendimiento y la fiabilidad.',
            saveStatusSuccess: 'Guardada la lista de relays en {count} relays.',
            saveStatusPartial: 'Guardada la lista de relays en {succeeded} de {attempted} relays.',
            saveStatusNone: 'No se pudo guardar la lista de relays en ningún relay.',
            saveStatusError: 'Error al guardar la lista de relays. Es posible que tus ajustes no se propaguen completamente.',
            savingStatus: 'Guardando ajustes de relays…'
        },

        mediaServers: {
            description: 'Configura tus servidores de medios Blossom. Estos servidores se usan para almacenar los archivos que subes (medios de perfil y adjuntos del chat).',

            inputPlaceholder: 'https://cdn.example.com',
            addButton: 'Añadir',
            emptyState: 'No hay servidores configurados',
            saveStatusSuccess: 'Guardada la lista de servidores en {count} relays.',
            saveStatusPartial: 'Guardada la lista de servidores en {succeeded} de {attempted} relays.',
            saveStatusNone: 'No se pudo guardar la lista de servidores en ningún relay.',
            saveStatusError: 'Error al guardar la lista de servidores. Es posible que tus ajustes no se propaguen completamente.',
            savingStatus: 'Guardando ajustes de servidores de medios…',
            primary: 'Principal',
            setAsPrimary: 'Establecer como principal',
            mediaCacheLabel: 'Caché de medios',
            mediaCacheDescription: 'Guarda los medios vistos en tu galería para acceso sin conexión. Los archivos pueden gestionarse en tu aplicación Fotos.'
        },

        security: {
            loginMethodTitle: 'Método de inicio de sesión',
            loginMethodUnknown: 'Desconocido',
            npubLabel: 'Tu npub',
            nsecLabel: 'Tu nsec',
            hideNsecAria: 'Ocultar nsec',
            showNsecAria: 'Mostrar nsec',
            dangerZoneTitle: 'Zona peligrosa',
            dangerZoneDescription: 'Cerrar sesión eliminará todos los datos en caché de este dispositivo.',
            logoutButton: 'Cerrar sesión'
        }
    },
    signerMismatch: {
        title: 'Cuenta no coincide',
        description: 'Tu extensión de firmante del navegador tiene una cuenta diferente activa a la que iniciaste sesión.',
        expectedAccount: 'Conectado como',
        actualAccount: 'Cuenta activa del firmante',
        instructions: 'Por favor, cambia a la cuenta correcta en tu extensión de firmante y recarga esta página.'
    }
};

export default es;
