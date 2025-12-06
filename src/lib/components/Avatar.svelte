<script lang="ts">
    let { src, npub, size = 'md', class: className = '' } = $props<{ 
        src?: string, 
        npub: string, 
        size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl',
        class?: string 
    }>();

    const robotUrl = $derived(`https://robohash.org/${npub}.png?set=set1&bgset=bg2`);
    
    let imgError = $state(false);
    
    // If src provided and no error, use it. Otherwise fallback to robot.
    const finalSrc = $derived(!imgError && src ? src : robotUrl);

    // Reset error state when src changes
    $effect(() => {
        src;
        imgError = false;
    });
    
    // Size classes
    const sizeClasses = {
        sm: 'w-8 h-8',
        md: 'w-10 h-10',
        lg: 'w-16 h-16',
        xl: 'w-24 h-24',
        '2xl': 'w-32 h-32'
    };
</script>

<div class={`${sizeClasses[size as keyof typeof sizeClasses]} ${className} rounded-full ring-2 ring-white/50 dark:ring-white/10 overflow-hidden flex-shrink-0 bg-gray-200 dark:bg-slate-700 shadow-sm`}>
    <img 
        src={finalSrc} 
        alt="Avatar" 
        class="w-full h-full object-cover"
        onerror={() => imgError = true}
    />
</div>
