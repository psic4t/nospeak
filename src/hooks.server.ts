import { sequence } from '@sveltejs/kit/hooks';

export const handle = sequence(async ({ event, resolve }) => {
    return resolve(event);
});
