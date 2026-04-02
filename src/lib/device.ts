export function getDeviceType(): 'mobile' | 'desktop' | 'console' | 'other' {
  const ua = navigator.userAgent.toLowerCase();
  
  if (/(ipad|tablet|(android(?!.*mobile))|(windows(?!.*phone)(.*touch))|kindle|playbook|silk|(puffin(?!.*(IP|AP|WP))))/.test(ua)) {
    return 'mobile'; // Treating tablets as mobile for simplicity in this context
  }
  
  if (/(mobi|ipod|phone|blackberry|opera mini|fennec|minimo|symbian|psp|nintendo ds|archos|skyfire|puffin|blazer|bolt|gobrowser|iris|maemo|semc|teashark|uxb2)/.test(ua)) {
    return 'mobile';
  }

  if (/(playstation|nintendo|xbox|wii|gameboy|dreamcast|sega|atari)/.test(ua)) {
    return 'console';
  }

  if (/(windows|macintosh|linux|x11)/.test(ua)) {
    return 'desktop';
  }

  return 'other';
}
